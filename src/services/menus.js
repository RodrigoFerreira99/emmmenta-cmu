import { hojeEmLisboa } from '@/lib/datas';
import { traduzirErro } from '@/lib/erros';
import { supabase } from '@/lib/supabase';
import { CATEGORIAS } from '@/services/pratos';

// RF03 (publicar o menu do dia) e RF04 (marcar pratos esgotados).
// Os ecrãs publicar.js e painel.js só falam com a base de dados através destas funções (RNF09).
//
// Tabelas usadas:
//   menus   um por restaurante e por dia (colunas: id, restaurante_id, dia, preco_menu_completo, publicado_em)
//   pratos  os pratos de um menu (colunas: id, menu_id, nome, categoria, preco, esgotado, criado_em)
//
// RN01 — "o menu só vale no dia em que é publicado": o dia é sempre o de Lisboa. Ao gravar,
// é a base de dados que o preenche (valor por omissão da coluna "dia"); ao ler, pedimos o dia
// de hoje com hojeEmLisboa(). Os menus de ontem não se apagam: simplesmente deixam de ser pedidos.

const VALORES_DE_CATEGORIA = CATEGORIAS.map((categoria) => categoria.valor);
const COLUNAS_DO_PRATO = 'id, nome, categoria, preco, esgotado, criado_em';

// ---------------------------------------------------------------------------
// Conversões e validação (funções simples, sem rede)
// ---------------------------------------------------------------------------

/** Tira os espaços a mais do nome de um prato: "  Arroz   de pato " → "Arroz de pato". */
export function limparNome(texto) {
  return (texto ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Preço escrito pelo utilizador → número. Aceita vírgula ou ponto e o símbolo do euro:
 * "8,5", "8.50" e "8,50 €" dão todos 8.5. Devolve null se não for um preço (RN03: até 2 casas decimais).
 */
export function lerPreco(texto) {
  const limpo = String(texto ?? '').replace('€', '').trim().replace(',', '.');
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(limpo)) return null;
  return Number(limpo);
}

/** Número → texto para pôr num campo de preço: 8.5 → "8,50". Sem valor → "". */
export function precoParaCampo(preco) {
  if (preco === null || preco === undefined) return '';
  return Number(preco).toFixed(2).replace('.', ',');
}

/** 'peixe' → 'Peixe' (o nome que aparece no ecrã). */
export function nomeDaCategoria(valor) {
  return CATEGORIAS.find((categoria) => categoria.valor === valor)?.nome ?? valor;
}

/**
 * Valida o formulário "Adicionar prato". Devolve um objeto com uma mensagem por cada campo errado
 * (nome, preco, categoria). Objeto vazio = tudo certo.
 */
export function validarPrato({ nome, preco, categoria }) {
  const erros = {};

  const nomeLimpo = limparNome(nome);
  if (!nomeLimpo) erros.nome = 'Escreve o nome do prato.';
  else if (nomeLimpo.length < 2 || nomeLimpo.length > 60) erros.nome = 'O nome do prato tem de ter entre 2 e 60 caracteres.';

  const valor = lerPreco(preco);
  if (!String(preco ?? '').trim()) erros.preco = 'Escreve o preço do prato.';
  else if (valor === null) erros.preco = 'O preço não é válido. Exemplo: 8,50';
  else if (valor <= 0) erros.preco = 'O preço tem de ser maior do que zero.';

  if (!VALORES_DE_CATEGORIA.includes(categoria)) erros.categoria = 'Escolhe a categoria do prato.';

  return erros;
}

/** Ordena os pratos como num menu: sopa, carne, peixe, vegetariano, sobremesa; dentro de cada categoria, pela ordem de criação. */
export function ordenarPratos(pratos) {
  const posicao = (categoria) => {
    const indice = VALORES_DE_CATEGORIA.indexOf(categoria);
    return indice === -1 ? VALORES_DE_CATEGORIA.length : indice;
  };
  return [...pratos].sort(
    (a, b) =>
      posicao(a.categoria) - posicao(b.categoria) ||
      String(a.criado_em ?? '').localeCompare(String(b.criado_em ?? '')) ||
      a.nome.localeCompare(b.nome)
  );
}

/**
 * Compara os pratos guardados na base de dados com os que estão no ecrã e diz o que é preciso fazer:
 *   aCriar      pratos novos (sem id)
 *   aAtualizar  pratos que já existiam e mudaram de nome, categoria ou preço
 *   aApagar     ids dos pratos que foram retirados do menu
 * Assim, ao editar um menu só se mexe no que mudou — os pratos em que não se tocou
 * mantêm o id e o estado "esgotado".
 */
export function calcularAlteracoes(guardados, doEcra) {
  const guardadoPorId = new Map(guardados.map((prato) => [prato.id, prato]));
  const idsNoEcra = new Set(doEcra.map((prato) => prato.id).filter(Boolean));

  // Novo = não tem id, ou tem um id que já não existe na base de dados (apagado noutro telemóvel).
  const eNovo = (prato) => !prato.id || !guardadoPorId.has(prato.id);
  const mudou = (prato) => {
    const guardado = guardadoPorId.get(prato.id);
    return guardado.nome !== prato.nome || guardado.categoria !== prato.categoria || Number(guardado.preco) !== Number(prato.preco);
  };

  return {
    aCriar: doEcra.filter(eNovo).map(({ nome, categoria, preco }) => ({ nome, categoria, preco })),
    aAtualizar: doEcra.filter((prato) => !eNovo(prato) && mudou(prato)).map(({ id, nome, categoria, preco }) => ({ id, nome, categoria, preco })),
    aApagar: guardados.filter((prato) => !idsNoEcra.has(prato.id)).map((prato) => prato.id),
  };
}

/** true se o que está no ecrã for diferente do que está guardado (há alguma coisa por publicar). */
export function haAlteracoesNosPratos(guardados, doEcra) {
  const { aCriar, aAtualizar, aApagar } = calcularAlteracoes(guardados, doEcra);
  return aCriar.length + aAtualizar.length + aApagar.length > 0;
}

// ---------------------------------------------------------------------------
// Ler, publicar e marcar esgotado
// ---------------------------------------------------------------------------

/**
 * RF03 / RF04 — o menu de hoje de um restaurante, já com os pratos ordenados.
 * Devolve { id, dia, publicado_em, preco_menu_completo, pratos: [...] } ou null se hoje ainda não há menu.
 */
export async function buscarMenuDeHoje(restauranteId) {
  try {
    const { data, error } = await supabase
      .from('menus')
      // "pratos(...)" pede também as linhas da tabela pratos ligadas a este menu (pela chave menu_id)
      .select(`id, dia, publicado_em, preco_menu_completo, pratos(${COLUNAS_DO_PRATO})`)
      .eq('restaurante_id', restauranteId)
      .eq('dia', hojeEmLisboa())
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { ...data, pratos: ordenarPratos(data.pratos ?? []) };
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

/**
 * Aviso dos favoritos — de que restaurante é este menu, e de que dia.
 * Devolve { restauranteId, restaurante, dia, publicadoEm } ou null se o menu não existir.
 */
export async function buscarRestauranteDoMenu(menuId) {
  try {
    const { data, error } = await supabase
      .from('menus')
      .select('dia, publicado_em, restaurantes(id, nome)')
      .eq('id', menuId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.restaurantes) return null;
    return { restauranteId: data.restaurantes.id, restaurante: data.restaurantes.nome, dia: data.dia, publicadoEm: data.publicado_em };
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

/**
 * Reutilizar pratos de dias anteriores — o último menu publicado ANTES de hoje
 * (normalmente o de ontem; se ontem o restaurante não publicou, o do último dia em que publicou).
 * Devolve { dia, precoMenuCompleto, pratos: [{ nome, categoria, preco }] } ou null se não houver nenhum.
 *
 * Os pratos vêm SEM id e sem "esgotado": ao publicar, são pratos novos do menu de hoje,
 * e o menu antigo fica como estava (RN01: cada menu pertence ao seu dia).
 */
export async function buscarUltimoMenuAnterior(restauranteId) {
  try {
    const { data, error } = await supabase
      .from('menus')
      .select(`dia, preco_menu_completo, pratos(${COLUNAS_DO_PRATO})`)
      .eq('restaurante_id', restauranteId)
      .lt('dia', hojeEmLisboa()) // "lt" = less than: só os dias antes de hoje
      .order('dia', { ascending: false }) // do mais recente para o mais antigo...
      .limit(1) // ...e só o primeiro
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.pratos?.length) return null;
    return {
      dia: data.dia,
      precoMenuCompleto: data.preco_menu_completo,
      pratos: ordenarPratos(data.pratos).map(({ nome, categoria, preco }) => ({ nome, categoria, preco: Number(preco) })),
    };
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

/**
 * RF03 — publica o menu de hoje, ou guarda as alterações se já estiver publicado.
 * "pratos" é a lista do ecrã: [{ id (se já existia), nome, categoria, preco }]. Devolve o menu como ficou guardado.
 *
 * Passos:
 *  1. Cria o menu de hoje ou, se já existir, atualiza-o ("upsert": só há um menu por restaurante e dia).
 *     Não enviamos o dia nem a hora: a base de dados preenche-os (o dia no fuso de Lisboa — RN01).
 *  2. Lê os pratos que já estavam guardados e compara-os com os do ecrã (calcularAlteracoes).
 *  3. Cria os novos, altera os que mudaram e, só no fim, apaga os retirados.
 *     As regras de segurança (RLS) garantem que só o dono do restaurante consegue fazer isto (RN02).
 */
export async function publicarMenu(restauranteId, { precoMenuCompleto = null, pratos }) {
  if (!pratos || pratos.length === 0) throw new Error('Adiciona pelo menos um prato antes de publicar.');
  // defesa extra: um prato lido de uma fotografia pode vir sem preço, e sem preço não se publica (RN03)
  if (pratos.some((prato) => !(prato.preco > 0))) throw new Error('Há pratos sem preço. Escreve o preço de todos antes de publicar.');

  try {
    const { data: menu, error: erroDoMenu } = await supabase
      .from('menus')
      .upsert({ restaurante_id: restauranteId, preco_menu_completo: precoMenuCompleto }, { onConflict: 'restaurante_id,dia' })
      .select('id')
      .single();
    if (erroDoMenu) throw erroDoMenu;

    const { data: guardados, error: erroAoLer } = await supabase.from('pratos').select('id, nome, categoria, preco').eq('menu_id', menu.id);
    if (erroAoLer) throw erroAoLer;

    const { aCriar, aAtualizar, aApagar } = calcularAlteracoes(guardados, pratos);
    const comMenu = (prato) => ({ ...prato, menu_id: menu.id });

    if (aCriar.length > 0) {
      const { error } = await supabase.from('pratos').insert(aCriar.map(comMenu));
      if (error) throw error;
    }
    if (aAtualizar.length > 0) {
      // upsert pelo id: altera o nome, a categoria e o preço; o "esgotado" fica como estava
      const { error } = await supabase.from('pratos').upsert(aAtualizar.map(comMenu), { onConflict: 'id' });
      if (error) throw error;
    }
    if (aApagar.length > 0) {
      const { error } = await supabase.from('pratos').delete().in('id', aApagar);
      if (error) throw error;
    }
  } catch (erro) {
    throw traduzirErro(erro);
  }

  return buscarMenuDeHoje(restauranteId);
}

/**
 * RF04 — marca (ou desmarca) um prato como esgotado. Devolve { id, esgotado } como ficou guardado.
 * A tabela pratos está no "tempo real" do Supabase, por isso os clientes com a app aberta
 * recebem a alteração logo (ver ouvirAlteracoesPratos em src/services/pratos.js).
 */
export async function marcarEsgotado(pratoId, esgotado) {
  try {
    const { data, error } = await supabase.from('pratos').update({ esgotado }).eq('id', pratoId).select('id, esgotado').single();
    if (error) throw error;
    return data;
  } catch (erro) {
    throw traduzirErro(erro);
  }
}
