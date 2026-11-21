import { describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MapaDeCalor } from '@/components/MapaDeCalor';
import { htmlDoMapaDeCalor } from '@/lib/htmlDoMapaDeCalor';
import { camaraDoMapa, dadosDoMapa, jsonSeguro, restaurantesDoMapa } from '@/lib/mapaDeCalor';

// Mapa de calor 3D do Início — testes às contas (src/lib/mapaDeCalor.js), à página HTML e ao cartão.
// A WebView é simulada (no teste é uma caixa). Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
const mockMapa = { injetado: [] };
jest.mock('react-native-webview', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  // guarda o código que a app manda correr no mapa (window.atualizar)
  const WebView = mockReact.forwardRef((props, ref) => {
    mockReact.useImperativeHandle(ref, () => ({ injectJavaScript: (codigo) => mockMapa.injetado.push(codigo) }));
    return mockReact.createElement(View, { testID: 'mapa-3d', ...props });
  });
  return { WebView };
});

const ESMAD = { latitude: 41.36662, longitude: -8.73871 };
const prato = (restaurante, extra) => ({ menu_id: `m-${restaurante.id}`, restaurante_id: restaurante.id, restaurante: restaurante.nome, latitude: restaurante.lat, longitude: restaurante.lng, distancia_km: restaurante.km, esgotado: false, preco: 8, ...extra });
const TASCA = { id: 'r1', nome: 'Tasca do Sancho', lat: 41.3643, lng: -8.7375, km: 0.27 };
const PESCADOR = { id: 'r2', nome: 'O Pescador', lat: 41.3558, lng: -8.7387, km: 1.2 };
const CANTINHO = { id: 'r3', nome: 'Cantinho do Monte', lat: 41.3666, lng: -8.7423, km: 0.3 };

describe('restaurantes do mapa', () => {
  test('um por restaurante, do mais perto ao mais longe; perto é mais quente; tudo esgotado fica frio', () => {
    const restaurantes = restaurantesDoMapa([
      prato(PESCADOR),
      prato(TASCA),
      prato(TASCA, { prato_id: 'outro' }),
      prato(CANTINHO, { esgotado: true }),
    ]);
    expect(restaurantes.map((r) => r.nome)).toEqual(['Tasca do Sancho', 'Cantinho do Monte', 'O Pescador']);
    expect(restaurantes[0].calor).toBeGreaterThan(restaurantes[2].calor);
    expect(restaurantes[1].calor).toBe(0.3); // a feijoada do Cantinho esgotou
    expect(restaurantes[0].minutos).toBe(3); // 270 m a pé
    expect(restaurantes.filter((r) => r.comEtiqueta).map((r) => r.nome)).toEqual(['Tasca do Sancho']);
  });

  test('restaurantes sem ponto no mapa ficam de fora', () => {
    expect(restaurantesDoMapa([prato({ ...TASCA, lat: null })])).toEqual([]);
  });
});

describe('câmara', () => {
  test('olha do cliente para os restaurantes (aqui, para sul) e afasta-se conforme o mais longe', () => {
    const perto = camaraDoMapa(ESMAD, restaurantesDoMapa([prato(TASCA)]));
    const longe = camaraDoMapa(ESMAD, restaurantesDoMapa([prato(TASCA), prato(PESCADOR)]));
    expect(longe.rumo).toBeGreaterThan(150);
    expect(longe.rumo).toBeLessThan(210);
    expect(longe.zoom).toBeLessThan(perto.zoom);
    // o centro fica entre o cliente e os restaurantes
    expect(longe.centro[1]).toBeLessThan(ESMAD.latitude);
    expect(longe.centro[1]).toBeGreaterThan(PESCADOR.lat);
  });

  test('sem restaurantes, fica centrada no cliente', () => {
    expect(camaraDoMapa(ESMAD, [])).toEqual({ centro: [ESMAD.longitude, ESMAD.latitude], zoom: 15, rumo: 0 });
  });
});

describe('página HTML do mapa', () => {
  test('um nome com "</script>" não estraga a página', () => {
    expect(jsonSeguro({ nome: '</script><b>' })).toBe('{"nome":"\\u003c/script>\\u003cb>"}');
    const html = htmlDoMapaDeCalor(dadosDoMapa([prato({ ...TASCA, nome: 'Tasca </script> do Zé' })], ESMAD));
    expect(html.match(/<\/script>/g)).toHaveLength(2); // só os dois fechos verdadeiros (biblioteca e código)
    expect(html).toContain('https://tiles.openfreemap.org/planet');
    expect(html).toContain('maplibre-gl@4.7.1');
  });
});

describe('cartão do mapa', () => {
  test('diz quantos sítios há, avisa enquanto carrega e abre o separador Mapa ao tocar', async () => {
    const aoTocar = jest.fn();
    await render(<MapaDeCalor local={ESMAD} pratos={[prato(TASCA), prato(PESCADOR)]} onPress={aoTocar} />);
    expect(screen.getByText('2 SÍTIOS COM MENU HOJE')).toBeTruthy();
    expect(screen.getByText('A desenhar o mapa…')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Mapa de calor com 2 restaurantes com menu hoje/ }));
    expect(aoTocar).toHaveBeenCalled();
  });

  test('quando o mapa diz "pronto", o aviso sai; se falhar, explica que é da rede (RNF08)', async () => {
    await render(<MapaDeCalor local={ESMAD} pratos={[prato(TASCA)]} />);
    await fireEvent(screen.getByTestId('mapa-3d'), 'message', { nativeEvent: { data: 'pronto' } });
    expect(screen.queryByText('A desenhar o mapa…')).toBeNull();
    expect(mockMapa.injetado.at(-1)).toMatch(/^window\.atualizar\(/); // os dados vão para o mapa sem o recarregar

    await render(<MapaDeCalor local={ESMAD} pratos={[prato(TASCA)]} />);
    await fireEvent(screen.getByTestId('mapa-3d'), 'message', { nativeEvent: { data: 'falhou' } });
    expect(screen.getByText(/Sem rede, o mapa não aparece/)).toBeTruthy();
    expect(screen.queryByTestId('mapa-3d')).toBeNull();
  });
});
