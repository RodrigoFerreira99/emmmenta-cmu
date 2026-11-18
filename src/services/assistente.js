import { traduzirErroDeFuncao } from '@/lib/erros';
import { supabase } from '@/lib/supabase';
import { CATEGORIAS, formatarPreco } from '@/services/pratos';

// O assistente de IA (função "assistente" do Supabase, que usa o Groq):
//  - interpretarPesquisa("peixe até 8 euros aqui perto") → filtros prontos a aplicar na lista e no mapa;
//  - traduzirPratos(["Bacalhau à Brás", ...]) → os nomes em inglês, para turistas.
//
// Plano B: se a IA não responder (sem rede, limite gratuito atingido…), a pesquisa tenta perceber
// o pedido aqui no telemóvel, com regras simples (interpretarPesquisaSemIa). A app nunca fica parada.
//
// O que a IA devolve nunca é usado às cegas: limparFiltrosDaIa só deixa passar valores que a app conhece.

const VALORES_DE_CATEGORIA = CATEGORIAS.map((categoria) => categoria.valor);
const RAIOS_KM = [1, 2, 5, 10]; // as distâncias dos filtros (OPCOES_DE_RAIO_KM)

// ---------------------------------------------------------------------------
// Funções sem rede (têm testes em tests/assistente.test.js)
// ---------------------------------------------------------------------------

/** Confirma os filtros que vieram da IA: tudo o que não for um valor conhecido passa a null. */
export function limparFiltrosDaIa(lido) {
  const categoria = VALORES_DE_CATEGORIA.includes(lido?.categoria) ? lido.categoria : null;
  const preco = Number(lido?.precoMax);
  const precoMax = lido?.precoMax != null && Number.isFinite(preco) && preco > 0 && preco < 100 ? Math.round(preco * 100) / 100 : null;
  const raio = Number(lido?.raioKm);
  const raioKm = lido?.raioKm != null && Number.isFinite(raio) && raio > 0 ? (RAIOS_KM.find((opcao) => opcao >= raio) ?? 10) : null;
  const pesquisa = typeof lido?.pesquisa === 'string' && lido.pesquisa.trim() ? lido.pesquisa.trim().slice(0, 40) : null;
  return { categoria, precoMax, raioKm, pesquisa };
}

/** As categorias em inglês (não precisam de IA: são sempre as mesmas cinco). */
export const CATEGORIAS_EM_INGLES = { sopa: 'Soup', carne: 'Meat', peixe: 'Fish', vegetariano: 'Vegetarian', sobremesa: 'Dessert' };

/** true se os filtros dizem alguma coisa (pelo menos um não é null). */
export const temAlgumFiltro = (filtros) => Object.values(filtros ?? {}).some((valor) => valor !== null && valor !== undefined);

// "Açúcar" → "acucar": sem acentos e em minúsculas, para comparar palavras.
// (o NFD separa cada letra do seu acento — "ç" fica "c" + cedilha — e depois apagam-se os acentos,
// que são os caracteres de \u0300 a \u036f)
const simplificar = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Palavras que indicam uma categoria (o "sem carne" tem de ser visto antes da "carne").
const PALAVRAS_DAS_CATEGORIAS = [
  ['vegetariano', ['vegetarian', 'vegan', 'sem carne']],
  ['sopa', ['sopa', 'caldo']],
  ['sobremesa', ['sobremesa', 'doce']],
  ['peixe', ['peixe', 'marisco']],
  ['carne', ['carne']],
];
// Pratos e ingredientes conhecidos: vão para a pesquisa pelo nome do prato. Estão escritos como nos
// menus (com acentos), porque a pesquisa na base de dados distingue "salmão" de "salmao".
const INGREDIENTES = [
  'bacalhau', 'polvo', 'sardinha', 'salmão', 'atum', 'francesinha', 'frango', 'bife', 'hambúrguer',
  'lasanha', 'feijoada', 'cozido', 'arroz de pato', 'rojões', 'picanha', 'pizza', 'massa',
];

/**
 * Plano B, sem IA: percebe pedidos simples com regras.
 * "peixe até 8 € aqui perto" → { categoria: 'peixe', precoMax: 8, raioKm: 1, pesquisa: null }.
 * Devolve null se não perceber nada.
 */
export function interpretarPesquisaSemIa(texto) {
  const frase = simplificar(texto ?? '');

  const ingrediente = INGREDIENTES.find((palavra) => frase.includes(simplificar(palavra))) ?? null;
  // com um prato concreto não se filtra também pela categoria (podia esconder o que se procura)
  const categoria = ingrediente ? null : (PALAVRAS_DAS_CATEGORIAS.find(([, palavras]) => palavras.some((palavra) => frase.includes(palavra)))?.[0] ?? null);

  // preço: "até 8", "menos de 8,5", "máximo 8", "8 euros", "8€"; "barato" sem número → 8
  // (o "(?!…)" impede que "até 3 km" seja lido como um preço de 3 €)
  const valorDoPreco =
    frase.match(/(?:ate|menos de|maximo|max\.?)\s*(\d+(?:[.,]\d{1,2})?)(?!\d|[.,]\d|\s*km)/)?.[1] ??
    frase.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur)/)?.[1];
  let precoMax = valorDoPreco ? Number(valorDoPreco.replace(',', '.')) : null;
  if (precoMax === null && frase.includes('barat')) precoMax = 8;

  // distância: "3 km" → o raio da lista igual ou maior; "perto", "ao pe", "aqui" → 1 km; "longe" → 10 km
  const valorDaDistancia = frase.match(/(\d+(?:[.,]\d+)?)\s*km/)?.[1];
  let raioKm = null;
  if (valorDaDistancia) raioKm = Number(valorDaDistancia.replace(',', '.'));
  else if (/\bperto\b|\bao pe\b|\baqui\b/.test(frase)) raioKm = 1;
  else if (frase.includes('longe')) raioKm = 10;

  const filtros = limparFiltrosDaIa({ categoria, precoMax, raioKm, pesquisa: ingrediente });
  return temAlgumFiltro(filtros) ? filtros : null;
}

/** Os filtros por palavras, para mostrar ao cliente o que se percebeu: "Peixe · até 8,00 € · até 1 km". */
export function descreverFiltros(filtros) {
  const partes = [];
  if (filtros?.pesquisa) partes.push(`«${filtros.pesquisa}»`);
  if (filtros?.categoria) partes.push(CATEGORIAS.find((categoria) => categoria.valor === filtros.categoria)?.nome ?? filtros.categoria);
  if (filtros?.precoMax) partes.push(`até ${formatarPreco(filtros.precoMax)}`);
  if (filtros?.raioKm) partes.push(`até ${filtros.raioKm} km`);
  return partes.join(' · ');
}

// ---------------------------------------------------------------------------
// Pedidos à função "assistente"
// ---------------------------------------------------------------------------

/**
 * Pesquisa por frase. Devolve { filtros, comIa } — comIa é false quando foi o plano B a perceber.
 * Lança um Error em português se não perceber nada.
 */
export async function interpretarPesquisa(texto) {
  const limpo = (texto ?? '').trim();
  if (limpo.length < 2) throw new Error('Escreve o que te apetece, por exemplo: peixe até 8 € aqui perto.');

  try {
    const { data, error } = await supabase.functions.invoke('assistente', { body: { tarefa: 'interpretar-pesquisa', texto: limpo } });
    if (error) throw error;
    const filtros = limparFiltrosDaIa(data);
    if (temAlgumFiltro(filtros)) return { filtros, comIa: true };
  } catch (erro) {
    console.warn('Erro técnico (assistente, pesquisa):', erro?.message ?? erro);
  }

  // a IA não respondeu ou não percebeu: tenta-se aqui, com regras simples
  const filtros = interpretarPesquisaSemIa(limpo);
  if (filtros) return { filtros, comIa: false };
  throw new Error('Não percebi. Experimenta, por exemplo: "peixe até 8 € aqui perto".');
}

/** Os nomes dos pratos em inglês, pela mesma ordem. Lança um Error em português se não for possível. */
export async function traduzirPratos(nomes) {
  const { data, error } = await supabase.functions.invoke('assistente', { body: { tarefa: 'traduzir-pratos', pratos: nomes } });
  if (error) {
    throw await traduzirErroDeFuncao(error, {
      quandoNaoExiste: 'A tradução ainda não está ativada.',
      geral: 'Não foi possível traduzir o menu. Tenta outra vez.',
    });
  }
  const traducoes = data?.traducoes;
  const certas = Array.isArray(traducoes) && traducoes.length === nomes.length && traducoes.every((traducao) => typeof traducao === 'string' && traducao.trim());
  if (!certas) throw new Error('Não foi possível traduzir o menu. Tenta outra vez.');
  return traducoes.map((traducao) => traducao.trim());
}
