import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import Conta from '@/app/(cliente)/conta';
import { buscarRestaurantesPorIds } from '@/services/restaurantes';

// Separador Conta do cliente: os dados da conta e os restaurantes favoritos. Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
const mockSair = jest.fn();
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ sessao: { user: { id: 'u1', email: 'ana@email.pt' } }, perfil: { nome: 'Ana', tipo: 'cliente' }, sair: mockSair }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  // no teste, "ficar à frente" acontece quando o ecrã aparece e sempre que a função muda
  useFocusEffect: (efeito) => jest.requireActual('react').useEffect(efeito, [efeito]),
}));
const mockFavoritos = { ids: new Set() };
jest.mock('@/lib/favoritos', () => ({
  useFavoritos: () => ({ favoritos: mockFavoritos.ids, eFavorito: (id) => mockFavoritos.ids.has(id), alternarFavorito: jest.fn() }),
}));
jest.mock('@/services/restaurantes', () => ({ buscarRestaurantesPorIds: jest.fn() }));

const TASCA = { id: 'r1', nome: 'Tasca do Sancho', tipoCozinha: 'Portuguesa', temMenuHoje: true };
const PESCADOR = { id: 'r2', nome: 'O Pescador', tipoCozinha: null, temMenuHoje: false };

beforeEach(() => {
  jest.clearAllMocks();
  mockFavoritos.ids = new Set(['r2', 'r1']);
  buscarRestaurantesPorIds.mockResolvedValue([PESCADOR, TASCA]);
});

describe('Conta do cliente', () => {
  test('mostra o nome e o email da conta, e deixa terminar a sessão', async () => {
    await render(<Conta />);
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('ana@email.pt')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Terminar sessão' }));
    expect(mockSair).toHaveBeenCalledTimes(1);
  });
});

describe('Conta — os meus favoritos', () => {
  test('lista os favoritos e diz se já têm menu hoje', async () => {
    await render(<Conta />);
    expect(await screen.findByText('Tasca do Sancho')).toBeTruthy();
    expect(buscarRestaurantesPorIds).toHaveBeenCalledWith(['r1', 'r2']);
    expect(screen.getByText('Portuguesa · Menu de hoje publicado')).toBeTruthy();
    expect(screen.getByText('Ainda sem menu hoje')).toBeTruthy();
  });

  test('tocar num favorito abre a página do restaurante', async () => {
    await render(<Conta />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Tasca do Sancho, com menu hoje' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/restaurante/[id]', params: { id: 'r1' } });
  });

  test('sem favoritos, explica como os guardar', async () => {
    mockFavoritos.ids = new Set();
    buscarRestaurantesPorIds.mockResolvedValue([]);
    await render(<Conta />);
    expect(screen.getByText('Ainda não tens favoritos. Abre um restaurante e toca no coração para o guardar.')).toBeTruthy();
  });

  test('sem rede, mostra a mensagem e deixa tentar outra vez', async () => {
    buscarRestaurantesPorIds.mockRejectedValueOnce(new Error('Sem ligação à internet. Verifica a rede e tenta outra vez.'));
    await render(<Conta />);
    expect(await screen.findByText('Sem ligação à internet. Verifica a rede e tenta outra vez.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByText('Tasca do Sancho')).toBeTruthy();
    expect(buscarRestaurantesPorIds).toHaveBeenCalledTimes(2);
  });
});
