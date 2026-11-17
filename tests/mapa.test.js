import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import Mapa from '@/app/(cliente)/mapa';
import { PertoProvider } from '@/context/PertoContext';
import { estadoDaPermissao, lerLocalizacao, pedirPermissao } from '@/services/localizacao';
import { buscarPratosPerto, ouvirAlteracoesPratos } from '@/services/pratos';

// RF06 / RF07 — testes ao ecrã Mapa. O mapa verdadeiro só existe no telemóvel, por isso aqui é
// trocado por caixas simples: interessa confirmar que marcadores o ecrã lhe pede para desenhar.
// Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/favoritos', () => ({
  useFavoritos: () => ({ favoritos: new Set(), eFavorito: () => false, alternarFavorito: jest.fn() }),
}));
jest.mock('@/services/localizacao', () => ({ estadoDaPermissao: jest.fn(), pedirPermissao: jest.fn(), lerLocalizacao: jest.fn() }));
jest.mock('@/services/pratos', () => ({
  ...jest.requireActual('@/services/pratos'),
  buscarPratosPerto: jest.fn(),
  ouvirAlteracoesPratos: jest.fn(),
}));
jest.mock('react-native-maps', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  const MapView = mockReact.forwardRef((props, ref) => {
    mockReact.useImperativeHandle(ref, () => ({ animateToRegion: () => {} }));
    return mockReact.createElement(View, { testID: 'mapa', ...props });
  });
  const Marker = (props) => mockReact.createElement(View, { testID: `marcador:${props.title}`, ...props });
  const Circle = (props) => mockReact.createElement(View, { testID: 'circulo', ...props });
  return { __esModule: true, default: MapView, Marker, Circle };
});

const TASCA = { restaurante_id: 'r1', restaurante: 'Tasca do Manuel', latitude: 41.15, longitude: -8.61, distancia_km: 0.35 };
const CAFE = { restaurante_id: 'r2', restaurante: 'Café Central', latitude: 41.16, longitude: -8.62, distancia_km: 1.4 };
const SOPA = { ...TASCA, prato_id: 'p2', prato: 'Caldo verde', categoria: 'sopa', preco: 1.8, esgotado: false };
const BACALHAU = { ...TASCA, prato_id: 'p1', prato: 'Bacalhau à Brás', categoria: 'peixe', preco: 8.5, esgotado: false };
const FRANCESINHA = { ...CAFE, prato_id: 'p3', prato: 'Francesinha', categoria: 'carne', preco: 9.5, esgotado: true };

const abrir = () =>
  render(
    <PertoProvider>
      <Mapa />
    </PertoProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  estadoDaPermissao.mockResolvedValue('concedida');
  pedirPermissao.mockResolvedValue(true);
  lerLocalizacao.mockResolvedValue({ latitude: 41.15, longitude: -8.61 });
  buscarPratosPerto.mockResolvedValue([SOPA, BACALHAU, FRANCESINHA]);
  ouvirAlteracoesPratos.mockReturnValue(jest.fn());
});

describe('Mapa (RF06)', () => {
  test('desenha um marcador por restaurante com menu hoje, e o círculo do raio de pesquisa', async () => {
    await abrir();
    const tasca = await screen.findByTestId('marcador:Tasca do Manuel');
    expect(tasca.props.coordinate).toEqual({ latitude: 41.15, longitude: -8.61 });
    expect(tasca.props.description).toBe('2 pratos · desde 1,80 €'); // o preço mais baixo
    expect(screen.getByTestId('marcador:Café Central').props.description).toBe('Tudo esgotado');
    expect(screen.getByTestId('circulo').props.radius).toBe(2000); // 2 km, em metros
    expect(screen.getByTestId('mapa').props.showsUserLocation).toBe(true);
  });

  test('tocar num marcador mostra o cartão do restaurante, e "Ver menu de hoje" abre a página', async () => {
    await abrir();
    const marcador = await screen.findByTestId('marcador:Tasca do Manuel');
    expect(screen.queryByRole('button', { name: 'Ver menu de hoje' })).toBeNull();

    await fireEvent(marcador, 'press');
    expect(screen.getByText('350 m · 2 pratos · desde 1,80 €')).toBeTruthy();
    expect(screen.getByText('Caldo verde · Bacalhau à Brás')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver menu de hoje' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/restaurante/[id]', params: { id: 'r1', distancia: '0.35' } });
  });

  test('tocar no mapa, fora dos marcadores, fecha o cartão', async () => {
    await abrir();
    await fireEvent(await screen.findByTestId('marcador:Tasca do Manuel'), 'press');
    await fireEvent(screen.getByTestId('mapa'), 'press', { nativeEvent: {} });
    expect(screen.queryByRole('button', { name: 'Ver menu de hoje' })).toBeNull();
  });

  test('sem restaurantes no raio, avisa por cima do mapa (RNF08)', async () => {
    buscarPratosPerto.mockResolvedValue([]);
    await abrir();
    expect(await screen.findByText(/Não há restaurantes com menu hoje a menos de 2 km/)).toBeTruthy();
  });

  test('com uma zona escolhida à mão não aparece o ponto azul da localização (RNF04)', async () => {
    estadoDaPermissao.mockResolvedValue('porPedir');
    await abrir();
    await fireEvent.press(await screen.findByRole('button', { name: 'Procurar em Porto' }));
    expect((await screen.findByTestId('mapa')).props.showsUserLocation).toBe(false);
    expect(lerLocalizacao).not.toHaveBeenCalled();
  });
});

describe('Mapa — os mesmos filtros da lista (RF07)', () => {
  test('escolher uma categoria ou outro raio volta a procurar e muda o círculo', async () => {
    await abrir();
    await screen.findByTestId('marcador:Tasca do Manuel');

    await fireEvent.press(screen.getByRole('radio', { name: 'Peixe' }));
    await waitFor(() => expect(buscarPratosPerto.mock.calls.at(-1)[0].categoria).toBe('peixe'));

    await fireEvent.press(screen.getByLabelText('Mostrar os filtros de preço, distância e favoritos'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Até 5 km' }));
    await waitFor(() => expect(buscarPratosPerto.mock.calls.at(-1)[0]).toMatchObject({ categoria: 'peixe', raioKm: 5 }));
    expect(screen.getByTestId('circulo').props.radius).toBe(5000);
  });

  test('se um filtro tirar do mapa o restaurante escolhido, o cartão fecha-se', async () => {
    await abrir();
    await fireEvent(await screen.findByTestId('marcador:Café Central'), 'press');
    expect(screen.getByRole('button', { name: 'Ver menu de hoje' })).toBeTruthy();

    buscarPratosPerto.mockResolvedValue([SOPA, BACALHAU]); // o Café Central deixa de corresponder
    await fireEvent.press(screen.getByRole('radio', { name: 'Sopa' }));
    await waitFor(() => expect(screen.queryByTestId('marcador:Café Central')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Ver menu de hoje' })).toBeNull();
  });
});
