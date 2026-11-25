import { hojeEmLisboa } from '@/lib/datas';
import { traduzirErro } from '@/lib/erros';
import { supabase } from '@/lib/supabase';
import { agruparPorRestaurante } from '@/services/pratos';

// Ranking dos restaurantes entre os estudantes (ideia do professor, 25 nov 2026).
//
// Cada estudante pode dizer "Vou almoçar aqui" num restaurante por dia (pode mudar de ideias ou
// desmarcar). A base de dados conta quantos vão hoje e quantos foram nos últimos 7 dias, e a app usa
// esses números para o "Top da semana", a ordem "Mais populares" e o calor do mapa.
// Privacidade: a app só recebe números, nunca quem vai; cada estudante só vê a sua própria ida,
// e as idas apagam-se ao fim de 30 dias (ver supabase/migracoes/2026-11-25-ranking-dos-estudantes.sql).
// Os restaurantes de demonstração têm visitas simuladas (guardadas à parte), para o ranking não começar vazio.

// ---------------------------------------------------------------------------
// Contas e textos (sem rede)
// ---------------------------------------------------------------------------

/** "1 estudante vai almoçar aqui hoje" / "12 estudantes vão almoçar aqui hoje"; com 0, null. */
export function descreverIdasDeHoje(quantos) {
  if (!quantos) return null;
  return quantos === 1 ? '1 estudante vai almoçar aqui hoje' : `${quantos} estudantes vão almoçar aqui hoje`;
}

/** "1 estudante esta semana" / "34 estudantes esta semana"; com 0, null. */
export function descreverIdasDaSemana(quantos) {
  if (!quantos) return null;
  return quantos === 1 ? '1 estudante esta semana' : `${quantos} estudantes esta semana`;
}

const semana = (popularidade, restauranteId) => popularidade?.get(restauranteId)?.semana ?? 0;
const hoje = (popularidade, restauranteId) => popularidade?.get(restauranteId)?.hoje ?? 0;

/**
 * "Mais populares": os disponíveis antes dos esgotados; depois os restaurantes com mais estudantes na
 * última semana (e, a empatar, hoje); no fim, o mais perto primeiro. Devolve uma lista nova.
 */
export function ordenarPorPopularidade(pratos, popularidade) {
  return [...pratos].sort(
    (a, b) =>
      Number(a.esgotado) - Number(b.esgotado) ||
      semana(popularidade, b.restaurante_id) - semana(popularidade, a.restaurante_id) ||
      hoje(popularidade, b.restaurante_id) - hoje(popularidade, a.restaurante_id) ||
      a.distancia_km - b.distancia_km
  );
}

/**
 * "Top da semana": os restaurantes da lista (com menu hoje, perto) com mais estudantes nos últimos 7 dias.
 * Cada um vem com o prato principal disponível (para a imagem) e os números. Só entram restaurantes com
 * pelo menos uma ida e com algum prato disponível.
 */
export function topDaSemana(pratos, popularidade, quantos = 3) {
  return agruparPorRestaurante(pratos)
    .filter((r) => r.disponiveis > 0 && semana(popularidade, r.id) > 0)
    .sort((a, b) => semana(popularidade, b.id) - semana(popularidade, a.id) || hoje(popularidade, b.id) - hoje(popularidade, a.id) || a.distanciaKm - b.distanciaKm)
    .slice(0, quantos)
    .map((r) => {
      const disponiveis = r.pratos.filter((p) => !p.esgotado);
      const prato = disponiveis.find((p) => ['carne', 'peixe', 'vegetariano'].includes(p.categoria)) ?? disponiveis[0];
      return { id: r.id, nome: r.nome, distanciaKm: r.distanciaKm, semana: semana(popularidade, r.id), hoje: hoje(popularidade, r.id), prato };
    });
}

// ---------------------------------------------------------------------------
// Base de dados
// ---------------------------------------------------------------------------

/**
 * Quantos estudantes vão hoje e quantos foram na última semana a cada restaurante.
 * Devolve um Map: id do restaurante → { hoje, semana } (os que não têm idas não aparecem).
 */
export async function buscarPopularidade(restauranteIds) {
  const ids = [...new Set((restauranteIds ?? []).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.rpc('popularidade_dos_restaurantes', { ids });
  if (error) throw traduzirErro(error);
  return new Map((data ?? []).map((linha) => [linha.restaurante_id, { hoje: linha.hoje, semana: linha.semana }]));
}

/** O restaurante onde este estudante disse que vai almoçar hoje (id), ou null. */
export async function buscarMinhaIdaDeHoje() {
  // a regra de segurança só deixa ler as idas do próprio estudante; o dia é o de hoje em Lisboa (RN01)
  const { data, error } = await supabase.from('idas').select('restaurante_id').eq('dia', hojeEmLisboa()).maybeSingle();
  if (error) throw traduzirErro(error);
  return data?.restaurante_id ?? null;
}

/** "Vou almoçar aqui": marca (ou muda) a ida de hoje. */
export async function marcarIda(restauranteId) {
  const { error } = await supabase.rpc('marcar_ida', { restaurante: restauranteId });
  if (error) throw traduzirErro(error);
}

/** Desmarca a ida de hoje. */
export async function desmarcarIda() {
  const { error } = await supabase.rpc('desmarcar_ida');
  if (error) throw traduzirErro(error);
}
