import { supabase } from '@/lib/supabase';

// Funções de acesso aos dados. Os ecrãs chamam estas funções em vez de falar
// diretamente com o Supabase, para o código ficar organizado (RNF09).

/**
 * RF05 / RF06 / RF07 — pratos de hoje perto do cliente.
 * Chama a função "pratos_perto" que já existe na base de dados.
 * Devolve uma lista de { prato_id, prato, categoria, preco, esgotado,
 * restaurante_id, restaurante, latitude, longitude, distancia_km },
 * ordenada por distância (os esgotados vão para o fim).
 */
export async function buscarPratosPerto({ latitude, longitude, raioKm = 2, precoMax = null, categoria = null, pesquisa = null }) {
  const { data, error } = await supabase.rpc('pratos_perto', {
    lat: latitude,
    lng: longitude,
    raio_km: raioKm,
    preco_max: precoMax,
    categoria_filtro: categoria,
    pesquisa: pesquisa?.trim() ? pesquisa.trim() : null,
  });
  if (error) throw error;
  return data;
}

/**
 * RF04 — ouvir em tempo real quando um prato muda (por exemplo, fica esgotado).
 * Uso num ecrã:
 *   useEffect(() => ouvirAlteracoesPratos((prato) => { ...atualizar a lista... }), []);
 * Devolve uma função que pára de ouvir.
 */
export function ouvirAlteracoesPratos(aoAlterar) {
  const canal = supabase
    .channel('pratos-alteracoes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pratos' }, (mudanca) => aoAlterar(mudanca.new))
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
