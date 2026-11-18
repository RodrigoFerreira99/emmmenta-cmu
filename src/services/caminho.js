import { Platform } from 'react-native';

// Caminho a pé até ao restaurante: o percurso pelas ruas aparece no mapa dentro da app, com o tempo
// e a distância. Para ser guiado passo a passo continua a haver o botão "Direções" (abre a app de mapas).
//
// Serviço de caminhos: o OSRM do FOSSGIS (routing.openstreetmap.de), com o perfil "a pé" — o mesmo que o
// site openstreetmap.org usa. É gratuito e não precisa de chave. As regras de utilização pedem: no máximo
// 1 pedido por segundo, nada de uso intensivo, identificar a app (User-Agent) e mostrar a atribuição ao
// OpenStreetMap com a ligação "corrigir o mapa". Aqui só há um pedido por toque no botão.
//
// Privacidade (RNF04): a localização só sai do telemóvel quando o cliente pede o caminho, e vai arredondada
// a cerca de 100 m (3 casas decimais). Não é guardada em lado nenhum: nem na base de dados, nem no telemóvel.
//
// Plano B: se o serviço não responder, a app mostra uma linha reta e uma estimativa do tempo (RNF08).

const SERVICO_DE_CAMINHOS = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving';
const TEMPO_MAXIMO_MS = 10 * 1000;
// A ligação que as regras do serviço pedem para mostrar junto do caminho.
export const LIGACAO_CORRIGIR_O_MAPA = 'https://www.openstreetmap.org/fixthemap';

const METROS_POR_MINUTO_A_PE = 75; // cerca de 4,5 km/h
const FATOR_DAS_RUAS = 1.3; // pelas ruas anda-se mais do que em linha reta
// A partir daqui sugere-se a app de mapas (carro ou transportes) em vez de ir a pé.
export const LONGE_PARA_IR_A_PE_MIN = 30;

// ---------------------------------------------------------------------------
// Contas e conversões (funções sem rede, com testes em tests/caminho.test.js)
// ---------------------------------------------------------------------------

/** Arredonda um ponto: com 3 casas decimais fica com uma precisão de cerca de 100 m. */
export function arredondarPonto({ latitude, longitude }, casas = 3) {
  const fator = 10 ** casas;
  return { latitude: Math.round(latitude * fator) / fator, longitude: Math.round(longitude * fator) / fator };
}

const RAIO_DA_TERRA_M = 6371000;
const radianos = (graus) => (graus * Math.PI) / 180;

/** Distância em linha reta entre dois pontos, em metros (fórmula de Haversine, a mesma de pratos_perto). */
export function distanciaEmMetros(a, b) {
  const dLatitude = radianos(b.latitude - a.latitude);
  const dLongitude = radianos(b.longitude - a.longitude);
  const h = Math.sin(dLatitude / 2) ** 2 + Math.cos(radianos(a.latitude)) * Math.cos(radianos(b.latitude)) * Math.sin(dLongitude / 2) ** 2;
  return 2 * RAIO_DA_TERRA_M * Math.asin(Math.sqrt(h));
}

/** Plano B: uma linha reta e uma estimativa (a distância pelas ruas é, em média, 30 % maior). */
export function caminhoEmLinhaReta(origem, destino) {
  const distanciaM = Math.round(distanciaEmMetros(origem, destino) * FATOR_DAS_RUAS);
  return { pontos: [origem, destino], distanciaM, duracaoMin: Math.max(1, Math.round(distanciaM / METROS_POR_MINUTO_A_PE)), emLinhaReta: true };
}

const coordenadaValida = (par) => Array.isArray(par) && par.length >= 2 && par.every((numero) => Number.isFinite(numero));

/**
 * Lê a resposta do serviço de caminhos (formato OSRM, com a linha em GeoJSON: [longitude, latitude]).
 * Devolve { pontos: [{ latitude, longitude }], distanciaM, duracaoMin, emLinhaReta: false } ou null se não servir.
 */
export function lerRespostaDoCaminho(dados) {
  const rota = dados?.routes?.[0];
  if (dados?.code !== 'Ok' || !Array.isArray(rota?.geometry?.coordinates)) return null;
  const coordenadas = rota.geometry.coordinates;
  if (coordenadas.length < 2 || !coordenadas.every(coordenadaValida)) return null;
  if (!Number.isFinite(rota.distance) || !Number.isFinite(rota.duration)) return null;
  return {
    pontos: coordenadas.map(([longitude, latitude]) => ({ latitude, longitude })),
    distanciaM: Math.round(rota.distance),
    duracaoMin: Math.max(1, Math.round(rota.duration / 60)),
    emLinhaReta: false,
  };
}

/**
 * A parte do mapa que mostra o caminho todo: o centro dos pontos e uma margem à volta (60 % a mais).
 * Devolve { latitude, longitude, latitudeDelta, longitudeDelta }, o formato do "initialRegion" do mapa.
 */
export function regiaoParaOsPontos(pontos) {
  const latitudes = pontos.map((ponto) => ponto.latitude);
  const longitudes = pontos.map((ponto) => ponto.longitude);
  const [minLat, maxLat] = [Math.min(...latitudes), Math.max(...latitudes)];
  const [minLng, maxLng] = [Math.min(...longitudes), Math.max(...longitudes)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    // nunca menos de 0,004 graus (cerca de 450 m): com os dois pontos muito juntos o mapa não fica colado
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.004),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.004),
  };
}

/** 870 → "870 m"; 1234 → "1,2 km". */
export function descreverDistancia(metros) {
  if (metros < 1000) return `${Math.max(10, Math.round(metros / 10) * 10)} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}

/** 12 → "12 min"; 75 → "1 h 15 min"; 60 → "1 h". */
export function descreverDuracao(minutos) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

/** "12 min a pé · 870 m" (ou "cerca de 10 min a pé · 780 m" no plano B, em linha reta). */
export function descreverCaminho({ distanciaM, duracaoMin, emLinhaReta }) {
  return `${emLinhaReta ? 'cerca de ' : ''}${descreverDuracao(duracaoMin)} a pé · ${descreverDistancia(distanciaM)}`;
}

// ---------------------------------------------------------------------------
// Pedido ao serviço de caminhos
// ---------------------------------------------------------------------------

/**
 * O caminho a pé de "origem" (onde o cliente está) até "destino" (o restaurante), ambos { latitude, longitude }.
 * Nunca lança erro: se o serviço falhar, devolve o plano B em linha reta (emLinhaReta: true).
 * O primeiro ponto do caminho é sempre a origem verdadeira (a que foi enviada vai arredondada).
 */
export async function calcularCaminhoAPe(origem, destino) {
  const de = arredondarPonto(origem);
  const endereco = `${SERVICO_DE_CAMINHOS}/${de.longitude},${de.latitude};${destino.longitude},${destino.latitude}?overview=full&geometries=geojson`;
  // no browser não se pode mudar o User-Agent (o próprio browser identifica-se)
  const cabecalhos = Platform.OS === 'web' ? {} : { 'User-Agent': 'Emmmenta/1.0' };
  const controlo = new AbortController();
  const relogio = setTimeout(() => controlo.abort(), TEMPO_MAXIMO_MS);

  try {
    const resposta = await fetch(endereco, { headers: cabecalhos, signal: controlo.signal });
    if (!resposta.ok) throw new Error(`o serviço respondeu ${resposta.status}`);
    const caminho = lerRespostaDoCaminho(await resposta.json());
    if (caminho) return { ...caminho, pontos: [origem, ...caminho.pontos] };
    throw new Error('resposta sem caminho');
  } catch (erro) {
    console.warn('Erro técnico (caminho a pé):', erro?.message ?? erro);
    return caminhoEmLinhaReta(origem, destino);
  } finally {
    clearTimeout(relogio);
  }
}
