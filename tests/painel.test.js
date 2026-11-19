import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import { router } from 'expo-router';

import Painel from '@/app/(restaurante)/painel';
import { buscarMenuDeHoje, marcarEsgotado, marcarLotacao, marcarUltimasDoses } from '@/services/menus';
import { ouvirAlteracoesPratos } from '@/services/pratos';
import { buscarMeuRestaurante } from '@/services/restaurantes';

// RF04 — testes ao ecrã Painel, a mexer nos interruptores como um utilizador faria.
// A base de dados e o tempo real são simulados. Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ sessao: { user: { id: 'u1', email: 'tasca@email.pt' } }, perfil: { nome: 'Manuel', tipo: 'restaurante' } }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn() },
  // No teste, "ficar à frente" acontece uma vez, quando o ecrã aparece.
  useFocusEffect: (efeito) => jest.requireActual('react').useEffect(efeito, [efeito]),
}));
jest.mock('@/services/restaurantes', () => ({ buscarMeuRestaurante: jest.fn() }));
jest.mock('@/services/menus', () => ({
  ...jest.requireActual('@/services/menus'),
  buscarMenuDeHoje: jest.fn(),
  marcarEsgotado: jest.fn(),
  marcarUltimasDoses: jest.fn(),
  marcarLotacao: jest.fn(),
}));
jest.mock('@/services/pratos', () => ({
  ...jest.requireActual('@/services/pratos'),
  ouvirAlteracoesPratos: jest.fn(),
}));

const SOPA = { id: 'p1', nome: 'Sopa de legumes', categoria: 'sopa', preco: 1.5, esgotado: false };
const BACALHAU = { id: 'p2', nome: 'Bacalhau à Brás', categoria: 'peixe', preco: 8.5, esgotado: false };
const MENU = { id: 'm1', dia: '2026-11-15', publicado_em: '2026-11-15T10:12:00Z', preco_menu_completo: 10, pratos: [SOPA, BACALHAU] };

const interruptor = (nome) => screen.getByLabelText(`${nome}: esgotado`);
const pararDeOuvir = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  buscarMeuRestaurante.mockResolvedValue({ id: 'r1', nome: 'Tasca do Manuel' });
  buscarMenuDeHoje.mockResolvedValue(MENU);
  marcarEsgotado.mockImplementation(async (id, esgotado) => ({ id, esgotado }));
  marcarUltimasDoses.mockImplementation(async (id, ultimas) => ({ id, esgotado: false, ultimas_doses: ultimas }));
  marcarLotacao.mockImplementation(async (id, lotacao) => ({ id, lotacao, lotacao_em: lotacao ? new Date().toISOString() : null }));
  ouvirAlteracoesPratos.mockReturnValue(pararDeOuvir);
});

describe('Painel — as três situações', () => {
  test('sem perfil de restaurante, manda preencher o perfil', async () => {
    buscarMeuRestaurante.mockResolvedValue(null);
    await render(<Painel />);
    expect(await screen.findByText('Primeiro, o perfil do restaurante')).toBeTruthy();
    expect(buscarMenuDeHoje).not.toHaveBeenCalled(); // sem restaurante não há menu para procurar

    await fireEvent.press(screen.getByRole('button', { name: 'Preencher o perfil' }));
    expect(router.navigate).toHaveBeenCalledWith('/perfil');
  });

  test('com perfil mas sem menu hoje, oferece publicar', async () => {
    buscarMenuDeHoje.mockResolvedValue(null);
    await render(<Painel />);
    expect(await screen.findByText('Ainda não publicaste o menu de hoje')).toBeTruthy();
    expect(screen.getByText('Tasca do Manuel')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu de hoje' }));
    expect(router.push).toHaveBeenCalledWith('/publicar');
  });

  test('com menu publicado, mostra a hora, os pratos e os preços', async () => {
    await render(<Painel />);
    expect(await screen.findByText('Menu de hoje publicado')).toBeTruthy();
    expect(buscarMenuDeHoje).toHaveBeenCalledWith('r1');
    expect(screen.getByText('Às 10h12 · visível até à meia-noite')).toBeTruthy();
    expect(screen.getByText('2 pratos')).toBeTruthy();
    expect(screen.getByText('Sopa de legumes')).toBeTruthy();
    expect(screen.getByText('8,50 €')).toBeTruthy();
    expect(screen.getByText('Menu completo: 10,00 €')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Editar menu de hoje' }));
    expect(router.push).toHaveBeenCalledWith('/publicar');
  });

  test('com um só prato escreve "1 prato"', async () => {
    buscarMenuDeHoje.mockResolvedValue({ ...MENU, preco_menu_completo: null, pratos: [SOPA] });
    await render(<Painel />);
    expect(await screen.findByText('1 prato')).toBeTruthy();
    expect(screen.queryByText(/Menu completo/)).toBeNull();
  });
});

describe('Painel — interruptor Esgotado (RF04)', () => {
  test('ligar o interruptor grava o esgotado desse prato', async () => {
    await render(<Painel />);
    await screen.findByText('Menu de hoje publicado');
    expect(interruptor('Bacalhau à Brás').props.value).toBe(false);

    await fireEvent(interruptor('Bacalhau à Brás'), 'valueChange', true);

    expect(marcarEsgotado).toHaveBeenCalledWith('p2', true);
    expect(interruptor('Bacalhau à Brás').props.value).toBe(true);
    expect(interruptor('Sopa de legumes').props.value).toBe(false); // os outros pratos não mudam
  });

  test('desligar volta a pôr o prato disponível', async () => {
    buscarMenuDeHoje.mockResolvedValue({ ...MENU, pratos: [SOPA, { ...BACALHAU, esgotado: true }] });
    await render(<Painel />);
    await screen.findByText('Menu de hoje publicado');
    expect(interruptor('Bacalhau à Brás').props.value).toBe(true);

    await fireEvent(interruptor('Bacalhau à Brás'), 'valueChange', false);
    expect(marcarEsgotado).toHaveBeenCalledWith('p2', false);
    expect(interruptor('Bacalhau à Brás').props.value).toBe(false);
  });

  test('se a gravação falhar, o interruptor volta atrás e aparece a mensagem', async () => {
    marcarEsgotado.mockRejectedValue(new Error('Sem ligação à internet. Verifica a rede e tenta outra vez.'));
    await render(<Painel />);
    await screen.findByText('Menu de hoje publicado');

    await fireEvent(interruptor('Bacalhau à Brás'), 'valueChange', true);

    expect(await screen.findByText('Sem ligação à internet. Verifica a rede e tenta outra vez.')).toBeTruthy();
    expect(interruptor('Bacalhau à Brás').props.value).toBe(false);
    expect(interruptor('Bacalhau à Brás').props.disabled).toBe(false); // pode tentar-se outra vez
  });
});

describe('Painel — tempo real', () => {
  test('uma mudança feita noutro telemóvel aparece neste ecrã', async () => {
    await render(<Painel />);
    await screen.findByText('Menu de hoje publicado');

    // o Supabase chama esta função quando um prato muda na base de dados
    const aoAlterar = ouvirAlteracoesPratos.mock.calls[0][0];
    await act(async () => aoAlterar({ ...SOPA, esgotado: true }));

    expect(interruptor('Sopa de legumes').props.value).toBe(true);
    expect(marcarEsgotado).not.toHaveBeenCalled(); // só mostra: quem gravou foi o outro telemóvel
  });

  test('uma mudança num prato de outro restaurante é ignorada', async () => {
    await render(<Painel />);
    await screen.findByText('Menu de hoje publicado');
    const aoAlterar = ouvirAlteracoesPratos.mock.calls[0][0];
    await act(async () => aoAlterar({ id: 'prato-de-outro', nome: 'Outro', preco: 5, esgotado: true }));
    expect(screen.queryByText('Outro')).toBeNull();
    expect(screen.getByText('2 pratos')).toBeTruthy();
  });

  test('ao sair do ecrã deixa de ouvir', async () => {
    const { unmount } = await render(<Painel />);
    await screen.findByText('Menu de hoje publicado');
    await unmount();
    expect(pararDeOuvir).toHaveBeenCalledTimes(1);
  });
});

describe('Painel — falha ao carregar', () => {
  test('mostra a mensagem e deixa tentar outra vez', async () => {
    buscarMeuRestaurante.mockRejectedValueOnce(new Error('Sem ligação à internet. Verifica a rede e tenta outra vez.'));
    await render(<Painel />);
    expect(await screen.findByText('Sem ligação à internet. Verifica a rede e tenta outra vez.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByText('Menu de hoje publicado')).toBeTruthy();
  });
});

describe('Painel — partilhar o menu de hoje', () => {
  test('o botão abre a janela de partilha com o menu (sem os esgotados)', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    buscarMenuDeHoje.mockResolvedValue({ ...MENU, pratos: [SOPA, { ...BACALHAU, esgotado: true }] });
    await render(<Painel />);
    await screen.findByText('Menu de hoje publicado');

    await fireEvent.press(screen.getByRole('button', { name: 'Partilhar o menu de hoje' }));
    const texto = share.mock.calls[0][0].message;
    expect(texto).toContain('Menu de hoje — Tasca do Manuel');
    expect(texto).toContain('• Sopa de legumes — 1,50 €');
    expect(texto).not.toContain('Bacalhau');
    expect(texto).toContain('Menu completo: 10,00 €');
    share.mockRestore();
  });

  test('se a partilha falhar, aparece o aviso', async () => {
    const share = jest.spyOn(Share, 'share').mockRejectedValue(new Error('falhou'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await render(<Painel />);
    await screen.findByText('Menu de hoje publicado');
    await fireEvent.press(screen.getByRole('button', { name: 'Partilhar o menu de hoje' }));
    expect(await screen.findByText('Não foi possível abrir a partilha neste telemóvel.')).toBeTruthy();
    share.mockRestore();
  });

  test('sem menu hoje não há nada para partilhar', async () => {
    buscarMenuDeHoje.mockResolvedValue(null);
    await render(<Painel />);
    await screen.findByText('Ainda não publicaste o menu de hoje');
    expect(screen.queryByRole('button', { name: 'Partilhar o menu de hoje' })).toBeNull();
  });
});

describe('Painel — "Últimas doses"', () => {
  const ultimas = (nome) => screen.getByRole('switch', { name: `${nome}: últimas doses` });

  test('tocar em "Últimas doses" grava e fica ligado; tocar outra vez desliga', async () => {
    await render(<Painel />);
    await screen.findByText('Menu de hoje publicado');

    await fireEvent.press(ultimas('Bacalhau à Brás'));
    expect(marcarUltimasDoses).toHaveBeenCalledWith('p2', true);
    expect(ultimas('Bacalhau à Brás').props.accessibilityState.checked).toBe(true);

    await fireEvent.press(ultimas('Bacalhau à Brás'));
    expect(marcarUltimasDoses).toHaveBeenLastCalledWith('p2', false);
    expect(ultimas('Bacalhau à Brás').props.accessibilityState.checked).toBe(false);
  });

  test('se a gravação falhar, volta atrás e explica', async () => {
    marcarUltimasDoses.mockRejectedValue(new Error('Sem ligação à internet. Verifica a rede e tenta outra vez.'));
    await render(<Painel />);
    await screen.findByText('Menu de hoje publicado');
    await fireEvent.press(ultimas('Sopa de legumes'));
    expect(await screen.findByText('Sem ligação à internet. Verifica a rede e tenta outra vez.')).toBeTruthy();
    expect(ultimas('Sopa de legumes').props.accessibilityState.checked).toBe(false);
  });

  test('um prato esgotado não mostra o botão (e esgotar tira as últimas doses)', async () => {
    buscarMenuDeHoje.mockResolvedValue({ ...MENU, pratos: [SOPA, { ...BACALHAU, ultimas_doses: true }] });
    await render(<Painel />);
    await screen.findByText('Menu de hoje publicado');
    expect(ultimas('Bacalhau à Brás').props.accessibilityState.checked).toBe(true);

    await fireEvent(interruptor('Bacalhau à Brás'), 'valueChange', true);
    expect(marcarEsgotado).toHaveBeenCalledWith('p2', true);
    expect(screen.queryByRole('switch', { name: 'Bacalhau à Brás: últimas doses' })).toBeNull();
  });
});

describe('Painel — "Como está a sala agora?"', () => {
  test('"Cheio" grava a lotação e mostra o que os clientes veem; tocar outra vez apaga', async () => {
    await render(<Painel />);
    expect(await screen.findByText('Como está a sala agora?')).toBeTruthy();
    expect(screen.getByText(/Diz aos clientes se há mesa/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Cheio' }));
    expect(marcarLotacao).toHaveBeenCalledWith('m1', 'cheio');
    expect(await screen.findByText(/Os clientes veem: Cheio agora · agora mesmo/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cheio' }).props.accessibilityState.selected).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Cheio' }));
    expect(marcarLotacao).toHaveBeenLastCalledWith('m1', null);
    expect(await screen.findByText(/Diz aos clientes se há mesa/)).toBeTruthy();
  });

  test('um aviso com mais de 45 minutos já não conta', async () => {
    const haUmaHora = new Date(Date.now() - 60 * 60000).toISOString();
    buscarMenuDeHoje.mockResolvedValue({ ...MENU, lotacao: 'ha-mesa', lotacao_em: haUmaHora });
    await render(<Painel />);
    expect(await screen.findByText(/Diz aos clientes se há mesa/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Há mesa' }).props.accessibilityState.selected).toBe(false);
  });

  test('se a gravação falhar, volta atrás e explica', async () => {
    marcarLotacao.mockRejectedValue(new Error('Sem ligação à internet. Verifica a rede e tenta outra vez.'));
    await render(<Painel />);
    await screen.findByText('Como está a sala agora?');
    await fireEvent.press(screen.getByRole('button', { name: 'Há mesa' }));
    expect(await screen.findByText('Sem ligação à internet. Verifica a rede e tenta outra vez.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Há mesa' }).props.accessibilityState.selected).toBe(false);
  });
});

describe('Painel — QR code e cartaz para a porta', () => {
  test('mostra o QR do restaurante e diz se o cartaz leva o menu de hoje', async () => {
    await render(<Painel />);
    await screen.findByText('Menu de hoje publicado');
    await fireEvent.press(screen.getByRole('button', { name: 'QR code e cartaz para a porta' }));
    expect(await screen.findByText('QR code do restaurante')).toBeTruthy();
    expect(screen.getByLabelText('QR code de Tasca do Manuel')).toBeTruthy();
    expect(screen.getByText('O cartaz leva também o menu de hoje.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Fechar o QR code' }));
    expect(screen.queryByText('QR code do restaurante')).toBeNull();
  });
});
