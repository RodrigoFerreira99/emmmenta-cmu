import { traduzirErro } from '@/lib/erros';
import { supabase } from '@/lib/supabase';

// Funções de acesso aos dados. Os ecrãs chamam estas funções em vez de falar
// diretamente com o Supabase, para o código ficar organizado (RNF09).

// RF05: por omissão procura-se num raio de 2 km. RF07: opções dos filtros rápidos.
export const RAIO_POR_OMISSAO_KM = 2;
export const OPCOES_DE_RAIO_KM = [1, 2, 5, 10];
export const OPCOES_DE_PRECO_MAXIMO = [6, 8, 10, 15];

// Ordem das categorias dentro do mesmo restaurante: quem procura onde almoçar quer ver primeiro
// os pratos principais; a sopa e a sobremesa vêm a seguir.
const ORDEM_NA_LISTA = { carne: 0, peixe: 0, vegetariano: 0, sopa: 1, sobremesa: 2 };

/**
 * RF05 — a ordem da lista "pratos perto de mim":
 *  1. os disponíveis antes dos esgotados;
 *  2. do restaurante mais perto para o mais longe;
 *  3. no mesmo restaurante, os pratos principais antes da sopa e da sobremesa;
 *  4. por fim, do mais barato para o mais caro.
 * Devolve uma lista nova (não altera a que recebe).
 */
export function ordenarPratosDaLista(pratos) {
  const posicao = (prato) => ORDEM_NA_LISTA[prato.categoria] ?? 1;
  return [...pratos].sort(
    (a, b) =>
      Number(a.esgotado) - Number(b.esgotado) ||
      a.distancia_km - b.distancia_km ||
      posicao(a) - posicao(b) ||
      Number(a.preco) - Number(b.preco)
  );
}

/**
 * RF07 — "Mais barato primeiro": os disponíveis antes dos esgotados, depois do mais barato para o mais caro
 * e, a preço igual, o mais perto primeiro. Devolve uma lista nova (não altera a que recebe).
 */
export function ordenarPorPreco(pratos) {
  return [...pratos].sort(
    (a, b) => Number(a.esgotado) - Number(b.esgotado) || Number(a.preco) - Number(b.preco) || a.distancia_km - b.distancia_km
  );
}

// Os pratos "de almoço": a sopa e a sobremesa sozinhas não contam como almoço.
const PRATOS_PRINCIPAIS = ['carne', 'peixe', 'vegetariano'];

/**
 * "O almoço mais barato perto de ti": o prato principal disponível mais barato da lista
 * (a preço igual, o mais perto). Devolve null se não houver nenhum.
 */
export function almocoMaisBarato(pratos) {
  const principais = (pratos ?? []).filter((prato) => !prato.esgotado && PRATOS_PRINCIPAIS.includes(prato.categoria));
  return ordenarPorPreco(principais)[0] ?? null;
}

/**
 * Os pratos que o "Abana para decidir" pode escolher: os principais disponíveis.
 * Se não houver nenhum principal, serve qualquer prato disponível.
 */
export function pratosParaSortear(pratos) {
  const disponiveis = (pratos ?? []).filter((prato) => !prato.esgotado);
  const principais = disponiveis.filter((prato) => PRATOS_PRINCIPAIS.includes(prato.categoria));
  return principais.length > 0 ? principais : disponiveis;
}

/**
 * "Abana para decidir": escolhe um prato ao acaso entre os de pratosParaSortear(). Devolve null se não houver.
 * "aleatorio" é Math.random por omissão; nos testes passa-se uma função fixa para o resultado ser sempre o mesmo.
 */
export function escolherAoAcaso(pratos, aleatorio = Math.random) {
  const candidatos = pratosParaSortear(pratos);
  if (candidatos.length === 0) return null;
  const posicao = Math.min(Math.floor(aleatorio() * candidatos.length), candidatos.length - 1);
  return candidatos[posicao];
}

/**
 * RF05 / RF06 / RF07 — pratos de hoje perto do cliente.
 * Chama a função "pratos_perto" que já existe na base de dados: é ela que calcula as distâncias
 * e aplica os filtros, por isso o telemóvel só recebe os pratos que interessam (RNF05).
 * Devolve uma lista de { prato_id, prato, categoria, preco, esgotado, ultimas_doses, etiquetas, foto_url,
 * menu_id, lotacao, lotacao_em, restaurante_id, restaurante, latitude, longitude, distancia_km },
 * pela ordem de ordenarPratosDaLista() (esgotados no fim, depois distância, pratos principais primeiro).
 * A pesquisa pelo nome não liga a acentos ("salmao" encontra "Salmão"): isso é feito na base de dados.
 * "etiqueta" (um valor de ETIQUETAS, por exemplo 'vegano') mostra só os pratos com essa etiqueta.
 */
export async function buscarPratosPerto({
  latitude,
  longitude,
  raioKm = RAIO_POR_OMISSAO_KM,
  precoMax = null,
  categoria = null,
  pesquisa = null,
  etiqueta = null,
}) {
  try {
    const { data, error } = await supabase.rpc('pratos_perto', {
      lat: latitude,
      lng: longitude,
      raio_km: raioKm,
      preco_max: precoMax,
      categoria_filtro: categoria,
      pesquisa: pesquisa?.trim() ? pesquisa.trim() : null,
      etiqueta_filtro: etiqueta,
    });
    if (error) throw error;
    return ordenarPratosDaLista(data ?? []);
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

/**
 * RF06 — junta os pratos por restaurante, para o mapa mostrar um marcador por restaurante.
 * Devolve uma lista de { id, nome, latitude, longitude, distanciaKm, pratos, disponiveis, precoMinimo },
 * do mais perto para o mais longe. "precoMinimo" é o prato disponível mais barato
 * (null se estiver tudo esgotado).
 */
export function agruparPorRestaurante(pratos) {
  const grupos = new Map();

  for (const prato of pratos ?? []) {
    let grupo = grupos.get(prato.restaurante_id);
    if (!grupo) {
      grupo = {
        id: prato.restaurante_id,
        nome: prato.restaurante,
        latitude: prato.latitude,
        longitude: prato.longitude,
        distanciaKm: prato.distancia_km,
        // "Há mesa" / "Cheio agora" é do menu, por isso é igual em todos os pratos do restaurante
        lotacao: prato.lotacao ?? null,
        lotacao_em: prato.lotacao_em ?? null,
        pratos: [],
        disponiveis: 0,
        precoMinimo: null,
      };
      grupos.set(prato.restaurante_id, grupo);
    }

    grupo.pratos.push(prato);
    if (!prato.esgotado) {
      grupo.disponiveis += 1;
      const preco = Number(prato.preco);
      if (grupo.precoMinimo === null || preco < grupo.precoMinimo) grupo.precoMinimo = preco;
    }
  }

  return [...grupos.values()].sort((a, b) => a.distanciaKm - b.distanciaKm);
}

/**
 * RF04 (lado do cliente) — aplica à lista uma alteração recebida em tempo real.
 * "alterado" é a linha da tabela pratos tal como ficou ({ id, nome, categoria, preco, esgotado, ultimas_doses, ... }).
 * Se o prato não estiver na lista, devolve a MESMA lista (assim o ecrã nem é redesenhado).
 * Depois de alterar volta a ordenar: disponíveis primeiro, e dentro de cada grupo por distância.
 */
export function aplicarAlteracaoDePrato(lista, alterado) {
  if (!alterado || !lista.some((prato) => prato.prato_id === alterado.id)) return lista;

  const nova = lista.map((prato) =>
    prato.prato_id === alterado.id
      ? {
          ...prato,
          prato: alterado.nome ?? prato.prato,
          categoria: alterado.categoria ?? prato.categoria,
          preco: alterado.preco ?? prato.preco,
          esgotado: alterado.esgotado ?? prato.esgotado,
          ultimas_doses: alterado.ultimas_doses ?? prato.ultimas_doses,
          etiquetas: alterado.etiquetas ?? prato.etiquetas,
          // a fotografia pode ter sido tirada (null): por isso conta se a coluna veio, e não se tem valor
          foto_url: 'foto_url' in alterado ? alterado.foto_url : prato.foto_url,
        }
      : prato
  );
  return ordenarPratosDaLista(nova);
}

/**
 * "Há mesa" / "Cheio agora" em tempo real — aplica à lista a alteração de um menu (tabela menus).
 * Todos os pratos desse menu ficam com a lotação nova. Se nenhum prato for desse menu, devolve a MESMA lista.
 */
export function aplicarAlteracaoDeMenu(lista, alterado) {
  if (!alterado || !lista.some((prato) => prato.menu_id === alterado.id)) return lista;
  return lista.map((prato) =>
    prato.menu_id === alterado.id ? { ...prato, lotacao: alterado.lotacao ?? null, lotacao_em: alterado.lotacao_em ?? null } : prato
  );
}

// Cada ecrã que ouve as alterações precisa de um canal com um nome só seu: se dois pedissem
// o mesmo nome, o Supabase devolvia o canal que já existia e o segundo ecrã dava erro.
let numeroDoCanal = 0;

// O Supabase aceita até 100 valores num filtro "in" do tempo real.
const MAXIMO_NO_FILTRO = 100;

/**
 * O filtro do tempo real para só chegarem as mudanças de certas linhas: "menu_id=in.(m1,m2)".
 * Devolve null (ouvir tudo) se não houver ids ou se houver mais do que o Supabase aceita.
 */
export function filtroDeTempoReal(coluna, ids) {
  if (!ids?.length || ids.length > MAXIMO_NO_FILTRO) return null;
  return ids.length === 1 ? `${coluna}=eq.${ids[0]}` : `${coluna}=in.(${ids.join(',')})`;
}

/**
 * RF04 — ouvir em tempo real quando um prato muda (por exemplo, fica esgotado).
 * Uso num ecrã:
 *   useEffect(() => ouvirAlteracoesPratos((prato) => { ...atualizar a lista... }), []);
 * Com { menuId } só chegam as alterações aos pratos desse menu (página de um restaurante);
 * com { menuIds } só as dos pratos desses menus (a lista do cliente). Sem nada, chegam todas (Painel).
 * Devolve uma função que pára de ouvir.
 */
export function ouvirAlteracoesPratos(aoAlterar, { menuId = null, menuIds = null } = {}) {
  numeroDoCanal += 1;
  const oQueOuvir = { event: 'UPDATE', schema: 'public', table: 'pratos' };
  const filtro = menuId ? `menu_id=eq.${menuId}` : filtroDeTempoReal('menu_id', menuIds);
  if (filtro) oQueOuvir.filter = filtro;

  const canal = supabase
    .channel(`pratos-alteracoes-${numeroDoCanal}`)
    .on('postgres_changes', oQueOuvir, (mudanca) => aoAlterar(mudanca.new))
    .subscribe();
  return () => supabase.removeChannel(canal);
}

/**
 * Ouvir os pratos novos (quando um restaurante publica o menu ou lhe acrescenta pratos).
 * "aoChegar" recebe a linha nova da tabela pratos ({ id, menu_id, nome, ... }). Devolve uma função que pára de ouvir.
 */
export function ouvirPratosNovos(aoChegar) {
  numeroDoCanal += 1;
  const canal = supabase
    .channel(`pratos-novos-${numeroDoCanal}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pratos' }, (mudanca) => aoChegar(mudanca.new))
    .subscribe();
  return () => supabase.removeChannel(canal);
}

// Categorias aceites pela base de dados (coluna pratos.categoria)
export const CATEGORIAS = [
  { valor: 'sopa', nome: 'Sopa' },
  { valor: 'carne', nome: 'Carne' },
  { valor: 'peixe', nome: 'Peixe' },
  { valor: 'vegetariano', nome: 'Vegetariano' },
  { valor: 'sobremesa', nome: 'Sobremesa' },
];

// Etiquetas que um prato pode ter (coluna pratos.etiquetas; a base de dados só aceita estes valores).
// "emIngles" é o nome no menu em inglês da página do restaurante.
export const ETIQUETAS = [
  { valor: 'vegano', nome: 'Vegano', emIngles: 'Vegan' },
  { valor: 'sem-gluten', nome: 'Sem glúten', emIngles: 'Gluten-free' },
  { valor: 'sem-lactose', nome: 'Sem lactose', emIngles: 'Lactose-free' },
  { valor: 'picante', nome: 'Picante', emIngles: 'Spicy' },
];

/** ['picante', 'vegano'] → 'Vegano · Picante' (sempre pela ordem de ETIQUETAS). Sem etiquetas → ''. */
export function descreverEtiquetas(etiquetas, { emIngles = false } = {}) {
  return ETIQUETAS.filter((etiqueta) => (etiquetas ?? []).includes(etiqueta.valor))
    .map((etiqueta) => (emIngles ? etiqueta.emIngles : etiqueta.nome))
    .join(' · ');
}

// RN03: preços em euros, com duas casas decimais
export function formatarPreco(valor) {
  return `${Number(valor).toFixed(2).replace('.', ',')} €`;
}

export function formatarDistancia(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}
