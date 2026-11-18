import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { AvisoDeFavoritos, textoDoAvisoDeFavorito } from '@/components/AvisoDeFavoritos';
import { hojeEmLisboa } from '@/lib/datas';
import { buscarRestauranteDoMenu } from '@/services/menus';
import { ouvirPratosNovos } from '@/services/pratos';

// Aviso em tempo real quando um restaurante favorito publica o menu (src/components/AvisoDeFavoritos.js).
// O tempo real, a base de dados e os favoritos são simulados. Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/services/pratos', () => ({ ouvirPratosNovos: jest.fn() }));
jest.mock('@/services/menus', () => ({ buscarRestauranteDoMenu: jest.fn() }));
const mockFavoritos = { ids: new Set(['r1']) };
jest.mock('@/lib/favoritos', () => ({ useFavoritos: () => ({ favoritos: mockFavoritos.ids }) }));

const pararDeOuvir = jest.fn();
const agoraMesmo = () => new Date().toISOString();

// o Supabase chama esta função quando chega um prato novo
const chegaPrato = async (prato) => {
  const aoChegar = ouvirPratosNovos.mock.calls.at(-1)[0];
  await act(async () => aoChegar(prato));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFavoritos.ids = new Set(['r1']);
  ouvirPratosNovos.mockReturnValue(pararDeOuvir);
  buscarRestauranteDoMenu.mockResolvedValue({ restauranteId: 'r1', restaurante: 'Tasca do Sancho', dia: hojeEmLisboa(), publicadoEm: agoraMesmo() });
});

describe('textoDoAvisoDeFavorito', () => {
  const agora = new Date('2026-11-18T12:00:00Z');
  test('menu acabado de publicar', () => {
    expect(textoDoAvisoDeFavorito({ restaurante: 'Tasca', publicadoEm: '2026-11-18T11:58:00Z' }, agora)).toBe('Tasca acabou de publicar o menu de hoje');
  });
  test('menu publicado há mais tempo: foram acrescentados pratos', () => {
    expect(textoDoAvisoDeFavorito({ restaurante: 'Tasca', publicadoEm: '2026-11-18T10:00:00Z' }, agora)).toBe('Tasca acrescentou pratos ao menu de hoje');
  });
});

describe('AvisoDeFavoritos', () => {
  test('um favorito publica o menu: aparece o aviso, e "Ver" abre o restaurante', async () => {
    await render(<AvisoDeFavoritos />);
    await chegaPrato({ id: 'p1', menu_id: 'm1', nome: 'Feijoada' });

    expect(buscarRestauranteDoMenu).toHaveBeenCalledWith('m1');
    expect(screen.getByText('Tasca do Sancho acabou de publicar o menu de hoje')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver o menu' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/restaurante/[id]', params: { id: 'r1' } });
    expect(screen.queryByText(/acabou de publicar/)).toBeNull();
  });

  test('um menu com vários pratos só dá um aviso', async () => {
    await render(<AvisoDeFavoritos />);
    await chegaPrato({ id: 'p1', menu_id: 'm1' });
    await chegaPrato({ id: 'p2', menu_id: 'm1' });
    await chegaPrato({ id: 'p3', menu_id: 'm1' });
    expect(buscarRestauranteDoMenu).toHaveBeenCalledTimes(1);
  });

  test('um restaurante que não é favorito não dá aviso', async () => {
    mockFavoritos.ids = new Set(['outro']);
    await render(<AvisoDeFavoritos />);
    await chegaPrato({ id: 'p1', menu_id: 'm1' });
    expect(screen.queryByText(/publicar o menu/)).toBeNull();
  });

  test('um menu que não é de hoje não dá aviso', async () => {
    buscarRestauranteDoMenu.mockResolvedValue({ restauranteId: 'r1', restaurante: 'Tasca do Sancho', dia: '2020-01-01', publicadoEm: agoraMesmo() });
    await render(<AvisoDeFavoritos />);
    await chegaPrato({ id: 'p1', menu_id: 'm1' });
    expect(screen.queryByText(/publicar o menu/)).toBeNull();
  });

  test('sem rede não dá aviso nem erro', async () => {
    buscarRestauranteDoMenu.mockRejectedValue(new Error('Sem ligação à internet.'));
    await render(<AvisoDeFavoritos />);
    await chegaPrato({ id: 'p1', menu_id: 'm1' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('o aviso pode fechar-se e desaparece sozinho ao fim de 8 segundos', async () => {
    jest.useFakeTimers();
    await render(<AvisoDeFavoritos />);
    await chegaPrato({ id: 'p1', menu_id: 'm1' });
    expect(screen.getByText(/acabou de publicar/)).toBeTruthy();

    await act(async () => jest.advanceTimersByTime(8000));
    expect(screen.queryByText(/acabou de publicar/)).toBeNull();

    await chegaPrato({ id: 'p9', menu_id: 'm2' });
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar o aviso' }));
    expect(screen.queryByText(/acabou de publicar/)).toBeNull();
    jest.useRealTimers();
  });

  test('ao sair deixa de ouvir', async () => {
    const { unmount } = await render(<AvisoDeFavoritos />);
    await unmount();
    expect(pararDeOuvir).toHaveBeenCalledTimes(1);
  });
});
