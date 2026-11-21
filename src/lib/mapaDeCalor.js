import { calorDoPrato, corDoCalor } from '@/lib/cores';
import { distanciaEmMetros, rumoEmGraus } from '@/services/caminho';
import { agruparPorRestaurante } from '@/services/pratos';
import { cores, coresDoMapa3d, fontes } from '@/theme';

// Mapa de calor 3D do Início (design térmico): as ruas e os prédios a sério (OpenStreetMap, em 3D),
// e em cada restaurante com menu hoje um "foco de calor" no chão e uma coluna de luz.
// Quanto mais perto, mais quente; um restaurante com tudo esgotado fica frio.
// Aqui ficam só as contas (sem rede); o desenho é feito numa WebView com o MapLibre (src/components/MapaDeCalor.js).

const METROS_POR_MINUTO_A_PE = 80;

// Restaurantes para o mapa, a partir dos pratos encontrados. Só o mais perto leva etiqueta com o nome,
// para o mapa não ficar cheio de texto.
export function restaurantesDoMapa(pratos) {
  return agruparPorRestaurante(pratos)
    .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .map((r, i) => ({
      id: r.id,
      nome: r.nome,
      latitude: r.latitude,
      longitude: r.longitude,
      calor: calorDoPrato({ distanciaKm: r.distanciaKm, esgotado: r.disponiveis === 0 }),
      minutos: Math.max(1, Math.round((r.distanciaKm * 1000) / METROS_POR_MINUTO_A_PE)),
      comEtiqueta: i === 0 && r.disponiveis > 0,
    }));
}

// Para onde olha a câmara: o cliente fica em baixo e a câmara olha para os restaurantes
// (para o meio deles), com mais ou menos zoom conforme o mais longe.
export function camaraDoMapa(local, restaurantes) {
  if (!restaurantes.length) return { centro: [local.longitude, local.latitude], zoom: 15, rumo: 0 };
  const meio = {
    latitude: restaurantes.reduce((s, r) => s + r.latitude, 0) / restaurantes.length,
    longitude: restaurantes.reduce((s, r) => s + r.longitude, 0) / restaurantes.length,
  };
  const longeKm = Math.max(...restaurantes.map((r) => distanciaEmMetros(local, r))) / 1000;
  const zoom = Math.min(16.2, Math.max(13.2, 15.5 - Math.log2(Math.max(longeKm, 0.3) / 0.6)));
  // o centro do mapa fica entre o cliente e o meio dos restaurantes, mais perto do cliente
  const centro = [local.longitude + (meio.longitude - local.longitude) * 0.42, local.latitude + (meio.latitude - local.latitude) * 0.42];
  const rumo = distanciaEmMetros(local, meio) > 30 ? Math.round(rumoEmGraus(local, meio)) : 0;
  return { centro, zoom: Math.round(zoom * 100) / 100, rumo };
}

// Tudo o que a página do mapa precisa, num objeto simples (vai para a WebView em JSON).
export function dadosDoMapa(pratos, local) {
  const restaurantes = restaurantesDoMapa(pratos);
  return {
    tu: [local.longitude, local.latitude],
    camara: camaraDoMapa(local, restaurantes),
    restaurantes,
    cores: {
      ...coresDoMapa3d,
      texto: cores.texto,
      acento: cores.acento,
      linha: cores.linha,
      superficie: cores.superficie,
      // as cores do calor, do mais frio (0) ao mais quente (1)
      calor: [0.12, 0.3, 0.46, 0.6, 0.74, 0.87, 1].map((t) => [t, corDoCalor(t)]),
    },
    letra: fontes.mono,
  };
}

// Texto JSON que se pode pôr dentro de um <script> sem o fechar por engano ("</script>" num nome).
export function jsonSeguro(valor) {
  return JSON.stringify(valor).replace(/</g, '\\u003c');
}
