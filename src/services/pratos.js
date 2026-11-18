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
 * RF05 / RF06 / RF07 — pratos de hoje perto do cliente.
 * Chama a função "pratos_perto" que já existe na base de dados: é ela que calcula as distâncias
 * e aplica os filtros, por isso o telemóvel só recebe os pratos que interessam (RNF05).
 * Devolve uma lista de { prato_id, prato, categoria, preco, esgotado,
 * restaurante_id, restaurante, latitude, longitude, distancia_km },
 * pela ordem de ordenarPratosDaLista() (esgotados no fim, depois distância, pratos principais primeiro).
 */
export async function buscarPratosPerto({
  latitude,
  longitude,
  raioKm = RAIO_POR_OMISSAO_KM,
  precoMax = null,
  categoria = null,
  pesquisa = null,
}) {
  try {
    const { data, error } = await supabase.rpc('pratos_perto', {
      lat: latitude,
      lng: longitude,
      raio_km: raioKm,
      preco_max: precoMax,
      categoria_filtro: categoria,
      pesquisa: pesquisa?.trim() ? pesquisa.trim() : null,
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
 * "alterado" é a linha da tabela pratos tal como ficou ({ id, nome, categoria, preco, esgotado }).
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
        }
      : prato
  );
  return ordenarPratosDaLista(nova);
}

// Cada ecrã que ouve as alterações precisa de um canal com um nome só seu: se dois pedissem
// o mesmo nome, o Supabase devolvia o canal que já existia e o segundo ecrã dava erro.
let numeroDoCanal = 0;

/**
 * RF04 — ouvir em tempo real quando um prato muda (por exemplo, fica esgotado).
 * Uso num ecrã:
 *   useEffect(() => ouvirAlteracoesPratos((prato) => { ...atualizar a lista... }), []);
 * Com { menuId } só chegam as alterações aos pratos desse menu (página de um restaurante).
 * Devolve uma função que pára de ouvir.
 */
export function ouvirAlteracoesPratos(aoAlterar, { menuId = null } = {}) {
  numeroDoCanal += 1;
  const oQueOuvir = { event: 'UPDATE', schema: 'public', table: 'pratos' };
  if (menuId) oQueOuvir.filter = `menu_id=eq.${menuId}`;

  const canal = supabase
    .channel(`pratos-alteracoes-${numeroDoCanal}`)
    .on('postgres_changes', oQueOuvir, (mudanca) => aoAlterar(mudanca.new))
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

// RN03: preços em euros, com duas casas decimais
export function formatarPreco(valor) {
  return `${Number(valor).toFixed(2).replace('.', ',')} €`;
}

export function formatarDistancia(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}
