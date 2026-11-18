import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import PaginaRestaurante from '@/app/restaurante/[id]';
import { alternarFavorito } from '@/lib/favoritos';
import { abrirDirecoes, ligar } from '@/lib/ligacoes';
import { traduzirPratos } from '@/services/assistente';
import { buscarMenuDeHoje } from '@/services/menus';
import { ouvirAlteracoesPratos } from '@/services/pratos';
import { buscarRestaurante } from '@/services/restaurantes';

// RF06 — testes à página do restaurante que o cliente vê.
// A base de dados, o tempo real e as outras apps (telefone, mapas) são simulados. Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useLocalSearchParams: jest.fn() }));
// Favoritos simulados: alternarFavorito muda mockFavoritos e o ecrã volta a ser desenhado.
const mockFavoritos = { ids: new Set(), avisar: null };
jest.mock('@/lib/favoritos', () => {
  const mockReact = require('react');
  const alternarFavorito = jest.fn();
  return {
    alternarFavorito,
    useFavoritos: () => {
      const [, redesenhar] = mockReact.useReducer((n) => n + 1, 0);
      mockFavoritos.avisar = redesenhar;
      return { favoritos: mockFavoritos.ids, eFavorito: (id) => mockFavoritos.ids.has(id), alternarFavorito };
    },
  };
});
// Ligar e Direções são simulados; o link das direções (para a partilha) é o verdadeiro.
jest.mock('@/lib/ligacoes', () => ({ ...jest.requireActual('@/lib/ligacoes'), abrirDirecoes: jest.fn(), ligar: jest.fn() }));
jest.mock('@/services/restaurantes', () => ({
  ...jest.requireActual('@/services/restaurantes'),
  buscarRestaurante: jest.fn(),
}));
jest.mock('@/services/menus', () => ({
  ...jest.requireActual('@/services/menus'),
  buscarMenuDeHoje: jest.fn(),
}));
jest.mock('@/services/assistente', () => ({
  ...jest.requireActual('@/services/assistente'),
  traduzirPratos: jest.fn(),
}));
jest.mock('@/services/pratos', () => ({
  ...jest.requireActual('@/services/pratos'),
  ouvirAlteracoesPratos: jest.fn(),
}));

const ID = '11111111-2222-3333-4444-555555555555';
const TASCA = {
  id: ID,
  nome: 'Tasca do Manuel',
  tipo_cozinha: 'Portuguesa',
  morada: 'Rua de Cedofeita, 123, Porto',
  latitude: 41.1496,
  longitude: -8.611,
  hora_abertura: '12:00:00',
  hora_fecho: '15:00:00',
  telefone: '+351222000000',
  foto_url: null,
};
const SOPA = { id: 'p1', nome: 'Caldo verde', categoria: 'sopa', preco: 1.8, esgotado: false };
const BACALHAU = { id: 'p2', nome: 'Bacalhau à Brás', categoria: 'peixe', preco: 8.5, esgotado: true };
const MENU = { id: 'm1', dia: '2026-11-17', preco_menu_completo: 10, pratos: [SOPA, BACALHAU] };

const pararDeOuvir = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockFavoritos.ids = new Set();
  alternarFavorito.mockImplementation(async (id) => {
    const novos = new Set(mockFavoritos.ids);
    if (novos.has(id)) novos.delete(id);
    else novos.add(id);
    mockFavoritos.ids = novos;
    mockFavoritos.avisar();
  });
  useLocalSearchParams.mockReturnValue({ id: ID, distancia: '0.35' });
  buscarRestaurante.mockResolvedValue(TASCA);
  buscarMenuDeHoje.mockResolvedValue(MENU);
  ouvirAlteracoesPratos.mockReturnValue(pararDeOuvir);
  abrirDirecoes.mockResolvedValue();
  ligar.mockResolvedValue();
});

describe('Página do restaurante (RF06)', () => {
  test('mostra o restaurante: tipo de cozinha, distância, horário, morada e telefone', async () => {
    await render(<PaginaRestaurante />);
    expect(await screen.findByText('Tasca do Manuel')).toBeTruthy();
    expect(buscarRestaurante).toHaveBeenCalledWith(ID);
    expect(screen.getByText('Portuguesa · a 350 m')).toBeTruthy();
    expect(screen.getByText('12:00 – 15:00')).toBeTruthy();
    expect(screen.getByText('Rua de Cedofeita, 123, Porto')).toBeTruthy();
    expect(screen.getByText('222 000 000')).toBeTruthy();
  });

  test('mostra o menu de hoje com os preços e o esgotado riscado', async () => {
    await render(<PaginaRestaurante />);
    expect(await screen.findByText('Menu de hoje')).toBeTruthy();
    expect(buscarMenuDeHoje).toHaveBeenCalledWith(ID);
    expect(screen.getByText('Caldo verde')).toBeTruthy();
    expect(screen.getByText('1,80 €')).toBeTruthy();
    expect(screen.getByLabelText('Bacalhau à Brás, Peixe, esgotado')).toBeTruthy();
    expect(screen.getAllByText('Esgotado')).toHaveLength(1);
    expect(screen.getByText(/Menu completo/)).toBeTruthy();
    expect(screen.getByText('10,00 €')).toBeTruthy();
  });

  test('o botão Ligar abre o telefone e o botão Direções abre a app de mapas', async () => {
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');

    await fireEvent.press(screen.getByRole('button', { name: 'Ligar' }));
    expect(ligar).toHaveBeenCalledWith('+351222000000');

    await fireEvent.press(screen.getByRole('button', { name: 'Direções' }));
    expect(abrirDirecoes).toHaveBeenCalledWith(expect.objectContaining({ latitude: 41.1496, longitude: -8.611 }));
  });

  test('se a outra app não abrir, a página explica em vez de não acontecer nada', async () => {
    abrirDirecoes.mockRejectedValue(new Error('Não foi possível abrir a app de mapas.'));
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');
    await fireEvent.press(screen.getByRole('button', { name: 'Direções' }));
    expect(await screen.findByText('Não foi possível abrir a app de mapas.')).toBeTruthy();
  });

  test('restaurante sem telefone nem horário: não mostra o botão Ligar nem a linha do horário', async () => {
    buscarRestaurante.mockResolvedValue({ ...TASCA, telefone: null, hora_abertura: null, hora_fecho: null, tipo_cozinha: null });
    useLocalSearchParams.mockReturnValue({ id: ID }); // aberto sem a distância
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');
    expect(screen.queryByRole('button', { name: 'Ligar' })).toBeNull();
    expect(screen.queryByText('Horário de almoço')).toBeNull();
    expect(screen.queryByText(/ a \d/)).toBeNull(); // sem distância, não inventa nenhuma
    expect(screen.getByRole('button', { name: 'Direções' })).toBeTruthy();
  });

  test('restaurante que hoje ainda não publicou o menu', async () => {
    buscarMenuDeHoje.mockResolvedValue(null);
    await render(<PaginaRestaurante />);
    expect(await screen.findByText('Este restaurante ainda não publicou o menu de hoje.')).toBeTruthy();
    expect(ouvirAlteracoesPratos).not.toHaveBeenCalled(); // sem menu não há pratos para ouvir
  });

  test('restaurante que não existe', async () => {
    buscarRestaurante.mockResolvedValue(null);
    await render(<PaginaRestaurante />);
    expect(await screen.findByText('Este restaurante já não está disponível.')).toBeTruthy();
    expect(buscarMenuDeHoje).not.toHaveBeenCalled();
  });

  test('falha ao carregar: mostra a mensagem e deixa tentar outra vez (RNF08)', async () => {
    buscarRestaurante.mockRejectedValueOnce(new Error('Sem ligação à internet. Verifica a rede e tenta outra vez.'));
    await render(<PaginaRestaurante />);
    expect(await screen.findByText('Sem ligação à internet. Verifica a rede e tenta outra vez.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByText('Menu de hoje')).toBeTruthy();
  });
});

describe('Página do restaurante — esgotados em tempo real (RF04)', () => {
  test('ouve só os pratos deste menu e mostra logo o que mudou', async () => {
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');
    expect(ouvirAlteracoesPratos).toHaveBeenCalledWith(expect.any(Function), { menuId: 'm1' });

    const aoAlterar = ouvirAlteracoesPratos.mock.calls[0][0];
    await act(async () => aoAlterar({ ...SOPA, esgotado: true }));
    expect(screen.getAllByText('Esgotado')).toHaveLength(2);

    await act(async () => aoAlterar({ ...BACALHAU, esgotado: false }));
    expect(screen.getAllByText('Esgotado')).toHaveLength(1);
    expect(screen.getByLabelText('Bacalhau à Brás, Peixe, 8,50 €')).toBeTruthy();
  });

  test('ao sair da página deixa de ouvir', async () => {
    const { unmount } = await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');
    await unmount();
    expect(pararDeOuvir).toHaveBeenCalledTimes(1);
  });
});

describe('Página do restaurante — horário e favoritos', () => {
  test('diz se está aberto agora (a frase depende da hora a que o teste corre)', async () => {
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');
    expect(
      screen.getByText(/^(Aberto agora · fecha às 15:00|Fechado agora · abre às 12:00|Fechado agora · o almoço de hoje já terminou)$/)
    ).toBeTruthy();
  });

  test('sem horário, não diz se está aberto', async () => {
    buscarRestaurante.mockResolvedValue({ ...TASCA, hora_abertura: null, hora_fecho: null });
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');
    expect(screen.queryByText(/agora/)).toBeNull();
  });

  test('o coração guarda e tira dos favoritos', async () => {
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');

    await fireEvent.press(screen.getByRole('button', { name: 'Guardar nos favoritos' }));
    expect(alternarFavorito).toHaveBeenCalledWith(ID);
    expect(screen.getByRole('button', { name: 'Tirar dos favoritos' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Tirar dos favoritos' }));
    expect(screen.getByRole('button', { name: 'Guardar nos favoritos' })).toBeTruthy();
  });

  test('se não for possível guardar, a página explica', async () => {
    alternarFavorito.mockRejectedValue(new Error('Não foi possível guardar os favoritos neste telemóvel.'));
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar nos favoritos' }));
    expect(await screen.findByText('Não foi possível guardar os favoritos neste telemóvel.')).toBeTruthy();
  });
});

describe('Página do restaurante — partilhar', () => {
  test('convida para almoçar com os pratos de hoje e o link das direções', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');

    await fireEvent.press(screen.getByRole('button', { name: 'Partilhar este restaurante' }));
    const texto = share.mock.calls[0][0].message;
    expect(texto).toContain('Almoçamos aqui? Tasca do Manuel (Portuguesa)');
    expect(texto).toContain('Hoje: Caldo verde (1,80 €)'); // o bacalhau está esgotado: não entra
    expect(texto).not.toContain('Bacalhau');
    expect(texto).toContain('Direções: https://www.google.com/maps/dir/?api=1&destination=41.1496,-8.611');
    share.mockRestore();
  });
});

describe('Página do restaurante — menu em inglês (para turistas)', () => {
  const EM_INGLES = ['Caldo verde (kale and potato soup)', 'Bacalhau à Brás (shredded salt cod with eggs and straw potatoes)'];

  test('traduz os pratos e mostra o nome português por baixo', async () => {
    traduzirPratos.mockResolvedValue(EM_INGLES);
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');

    await fireEvent.press(screen.getByRole('button', { name: 'Show the menu in English' }));
    expect(await screen.findByText("Today's menu")).toBeTruthy();
    expect(traduzirPratos).toHaveBeenCalledWith(['Caldo verde', 'Bacalhau à Brás']);
    expect(screen.getByText('Caldo verde (kale and potato soup)')).toBeTruthy();
    expect(screen.getByText('Caldo verde · Soup')).toBeTruthy();
    expect(screen.getByLabelText('Bacalhau à Brás (shredded salt cod with eggs and straw potatoes), Fish, sold out')).toBeTruthy();
    expect(screen.getByText('Sold out')).toBeTruthy();
    expect(screen.getByText(/Set menu/)).toBeTruthy();
  });

  test('voltar ao português e outra vez ao inglês não pede a tradução de novo', async () => {
    traduzirPratos.mockResolvedValue(EM_INGLES);
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');

    await fireEvent.press(screen.getByRole('button', { name: 'Show the menu in English' }));
    await screen.findByText("Today's menu");
    await fireEvent.press(screen.getByRole('button', { name: 'Ver o menu em português' }));
    expect(await screen.findByText('Menu de hoje')).toBeTruthy();
    expect(screen.getByText('Esgotado')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Show the menu in English' }));
    expect(await screen.findByText("Today's menu")).toBeTruthy();
    expect(traduzirPratos).toHaveBeenCalledTimes(1); // a tradução ficou guardada
  });

  test('se a tradução falhar, explica e o menu continua em português', async () => {
    traduzirPratos.mockRejectedValue(new Error('Não foi possível traduzir o menu. Tenta outra vez.'));
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');

    await fireEvent.press(screen.getByRole('button', { name: 'Show the menu in English' }));
    expect(await screen.findByText('Não foi possível traduzir o menu. Tenta outra vez.')).toBeTruthy();
    expect(screen.getByText('Menu de hoje')).toBeTruthy();
    expect(screen.getByText('Caldo verde')).toBeTruthy();
  });

  test('sem menu hoje, não há botão English', async () => {
    buscarMenuDeHoje.mockResolvedValue(null);
    await render(<PaginaRestaurante />);
    await screen.findByText('Este restaurante ainda não publicou o menu de hoje.');
    expect(screen.queryByRole('button', { name: 'Show the menu in English' })).toBeNull();
  });
});
