import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import PaginaRestaurante from '@/app/restaurante/[id]';
import { alternarFavorito } from '@/lib/favoritos';
import { abrirDirecoes, ligar } from '@/lib/ligacoes';
import { traduzirPratos } from '@/services/assistente';
import { calcularCaminhoAPe } from '@/services/caminho';
import { estadoDaPermissao, lerLocalizacao, pedirPermissao } from '@/services/localizacao';
import { buscarMenuDeHoje, ouvirLotacao } from '@/services/menus';
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
  ouvirLotacao: jest.fn(),
}));
// A voz do telemóvel (ouvir o menu) é simulada.
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));
// O mapa só existe no telemóvel: aqui é trocado por caixas simples (a linha do caminho guarda os pontos).
jest.mock('react-native-maps', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  const MapView = (props) => mockReact.createElement(View, { testID: 'mapa-do-caminho', ...props });
  const Marker = (props) => mockReact.createElement(View, { testID: 'marcador-do-restaurante', ...props });
  const Polyline = (props) => mockReact.createElement(View, { testID: 'linha-do-caminho', ...props });
  return { __esModule: true, default: MapView, Marker, Polyline };
});
// A localização do telemóvel e o serviço de caminhos também são simulados.
jest.mock('@/services/localizacao', () => ({ estadoDaPermissao: jest.fn(), pedirPermissao: jest.fn(), lerLocalizacao: jest.fn() }));
jest.mock('@/services/caminho', () => ({ ...jest.requireActual('@/services/caminho'), calcularCaminhoAPe: jest.fn() }));
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
  ouvirLotacao.mockReturnValue(jest.fn());
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

describe('Página do restaurante — lotação, fotografias, etiquetas e últimas doses', () => {
  const agora = () => new Date().toISOString();

  test('mostra "Cheio agora" e muda logo quando o restaurante muda a lotação (tempo real)', async () => {
    buscarMenuDeHoje.mockResolvedValue({ ...MENU, lotacao: 'cheio', lotacao_em: agora() });
    await render(<PaginaRestaurante />);
    expect(await screen.findByLabelText('Cheio agora · agora mesmo')).toBeTruthy();
    expect(ouvirLotacao).toHaveBeenCalledWith(expect.any(Function), { menuId: 'm1' });

    const aoMudar = ouvirLotacao.mock.calls[0][0];
    await act(async () => aoMudar({ id: 'm1', lotacao: 'ha-mesa', lotacao_em: agora() }));
    expect(screen.getByLabelText('Há mesa · agora mesmo')).toBeTruthy();
    expect(screen.queryByLabelText(/Cheio agora/)).toBeNull();
  });

  test('sem lotação, ou com um aviso velho, não mostra nada', async () => {
    buscarMenuDeHoje.mockResolvedValue({ ...MENU, lotacao: 'cheio', lotacao_em: new Date(Date.now() - 2 * 3600000).toISOString() });
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');
    expect(screen.queryByLabelText(/Cheio agora/)).toBeNull();
  });

  test('etiquetas e "Últimas doses" aparecem no prato (e em inglês no menu em inglês)', async () => {
    const sopaVegana = { ...SOPA, etiquetas: ['vegano', 'sem-gluten'], ultimas_doses: true };
    buscarMenuDeHoje.mockResolvedValue({ ...MENU, pratos: [sopaVegana, BACALHAU] });
    traduzirPratos.mockResolvedValue(['Caldo verde (kale and potato soup)', 'Bacalhau à Brás (salt cod)']);
    await render(<PaginaRestaurante />);
    expect(await screen.findByLabelText('Caldo verde, Sopa, Vegano · Sem glúten, últimas doses, 1,80 €')).toBeTruthy();
    expect(screen.getByText('Últimas doses')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Show the menu in English' }));
    expect(await screen.findByText('Last portions')).toBeTruthy();
    expect(screen.getByText('Caldo verde · Soup · Vegan · Gluten-free')).toBeTruthy();
  });

  test('tocar na fotografia de um prato mostra-a em grande; tocar outra vez fecha', async () => {
    buscarMenuDeHoje.mockResolvedValue({ ...MENU, pratos: [{ ...SOPA, foto_url: 'https://fotos/caldo.jpg' }, BACALHAU] });
    await render(<PaginaRestaurante />);
    await fireEvent.press(await screen.findByRole('imagebutton', { name: 'Ver a fotografia de Caldo verde' }));
    expect(screen.getByLabelText('Fotografia de Caldo verde')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar a fotografia' }));
    expect(screen.queryByLabelText('Fotografia de Caldo verde')).toBeNull();
  });
});

describe('Página do restaurante — caminho a pé', () => {
  const AQUI = { latitude: 41.152, longitude: -8.613 };
  const PELAS_RUAS = { pontos: [AQUI, { latitude: 41.1496, longitude: -8.611 }], distanciaM: 872, duracaoMin: 12, emLinhaReta: false };

  async function abrirOCaminho() {
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');
    await fireEvent.press(screen.getByRole('button', { name: 'Ver o caminho a pé' }));
  }

  beforeEach(() => {
    estadoDaPermissao.mockResolvedValue('concedida');
    lerLocalizacao.mockResolvedValue(AQUI);
    pedirPermissao.mockResolvedValue(true);
    calcularCaminhoAPe.mockResolvedValue(PELAS_RUAS);
  });

  test('com a permissão já dada, mostra o tempo, a distância e a linha do caminho no mapa', async () => {
    await abrirOCaminho();
    expect(await screen.findByText('12 min a pé · 870 m')).toBeTruthy();
    expect(calcularCaminhoAPe).toHaveBeenCalledWith(AQUI, { latitude: 41.1496, longitude: -8.611 });
    expect(screen.getByTestId('linha-do-caminho').props.coordinates).toEqual(PELAS_RUAS.pontos);
    expect(screen.getByText('Corrigir o mapa')).toBeTruthy(); // atribuição ao OpenStreetMap (regra do serviço)

    await fireEvent.press(screen.getByRole('button', { name: 'Ser guiado pela app de mapas' }));
    expect(abrirDirecoes).toHaveBeenCalledWith(expect.objectContaining({ latitude: 41.1496, longitude: -8.611 }));

    await fireEvent.press(screen.getByRole('button', { name: 'Esconder o caminho a pé' }));
    expect(screen.queryByTestId('mapa-do-caminho')).toBeNull();
  });

  test('sem permissão, explica porque precisa da localização e só pede quando o cliente carrega (RNF04)', async () => {
    estadoDaPermissao.mockResolvedValue('porPedir');
    await abrirOCaminho();
    expect(await screen.findByText(/precisa de saber onde estás/)).toBeTruthy();
    expect(pedirPermissao).not.toHaveBeenCalled();
    expect(lerLocalizacao).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Usar a minha localização' }));
    expect(pedirPermissao).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('12 min a pé · 870 m')).toBeTruthy();
  });

  test('com a permissão recusada, explica e sugere as Direções', async () => {
    estadoDaPermissao.mockResolvedValue('negada');
    await abrirOCaminho();
    expect(await screen.findByText(/A permissão de localização está desligada/)).toBeTruthy();
    expect(calcularCaminhoAPe).not.toHaveBeenCalled();
  });

  test('se não souber onde o cliente está, deixa tentar outra vez', async () => {
    lerLocalizacao.mockRejectedValueOnce(new Error('Não foi possível saber onde estás.'));
    await abrirOCaminho();
    expect(await screen.findByText(/Não foi possível saber onde estás/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByText('12 min a pé · 870 m')).toBeTruthy();
    expect(lerLocalizacao).toHaveBeenCalledTimes(2);
  });

  test('plano B: sem o caminho pelas ruas, mostra a linha reta e avisa (RNF08)', async () => {
    calcularCaminhoAPe.mockResolvedValue({ pontos: PELAS_RUAS.pontos, distanciaM: 350, duracaoMin: 5, emLinhaReta: true });
    await abrirOCaminho();
    expect(await screen.findByText('cerca de 5 min a pé · 350 m')).toBeTruthy();
    expect(screen.getByText(/a linha no mapa é em linha reta/)).toBeTruthy();
    expect(screen.queryByText('Corrigir o mapa')).toBeNull();
  });

  test('longe demais para ir a pé: sugere a app de mapas', async () => {
    calcularCaminhoAPe.mockResolvedValue({ ...PELAS_RUAS, distanciaM: 4200, duracaoMin: 56 });
    await abrirOCaminho();
    expect(await screen.findByText('56 min a pé · 4,2 km')).toBeTruthy();
    expect(screen.getByText(/É longe para ir a pé/)).toBeTruthy();
  });
});

describe('Página do restaurante — ouvir o menu em voz alta', () => {
  test('o altifalante lê o menu; tocar outra vez pára; ao acabar o botão volta ao normal', async () => {
    const Speech = jest.requireMock('expo-speech');
    await render(<PaginaRestaurante />);
    await screen.findByText('Menu de hoje');

    await fireEvent.press(screen.getByRole('button', { name: 'Ouvir o menu em voz alta' }));
    expect(Speech.speak).toHaveBeenCalledWith(expect.stringContaining('Menu de hoje: Tasca do Manuel. Caldo verde, Sopa, 1 euro e 80.'), expect.anything());
    expect(screen.getByRole('button', { name: 'Parar de ler o menu' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Parar de ler o menu' }));
    expect(Speech.stop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Ouvir o menu em voz alta' })).toBeTruthy();

    // quando a voz acaba sozinha, o botão também volta a "Ouvir"
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvir o menu em voz alta' }));
    const { onDone } = Speech.speak.mock.calls.at(-1)[1];
    await act(async () => onDone());
    expect(screen.getByRole('button', { name: 'Ouvir o menu em voz alta' })).toBeTruthy();
  });
});
