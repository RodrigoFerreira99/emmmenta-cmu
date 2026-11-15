import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, usePreventRemove } from 'expo-router';

import Publicar from '@/app/publicar';
import { buscarMenuDeHoje, publicarMenu } from '@/services/menus';
import { buscarMeuRestaurante } from '@/services/restaurantes';

// RF03 — testes ao ecrã Publicar menu, a carregar nos botões como um utilizador faria.
// A base de dados é simulada: só interessa confirmar o que o ecrã mostra e o que pede para gravar.
// Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ sessao: { user: { id: 'u1', email: 'tasca@email.pt' } }, perfil: { nome: 'Manuel', tipo: 'restaurante' } }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) },
  usePreventRemove: jest.fn(),
}));
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 56 }));
jest.mock('@/services/restaurantes', () => ({ buscarMeuRestaurante: jest.fn() }));
// As funções sem rede (validar, ler preços...) são as verdadeiras; só as que falam com a base de dados são simuladas.
jest.mock('@/services/menus', () => ({
  ...jest.requireActual('@/services/menus'),
  buscarMenuDeHoje: jest.fn(),
  publicarMenu: jest.fn(),
}));

const SOPA = { id: 'p1', nome: 'Sopa de legumes', categoria: 'sopa', preco: 1.5, esgotado: false };
const BACALHAU = { id: 'p2', nome: 'Bacalhau à Brás', categoria: 'peixe', preco: 8.5, esgotado: true };

// Escreve um prato no formulário e carrega em "Adicionar prato".
async function adicionarPrato(nome, preco) {
  await fireEvent.changeText(screen.getByLabelText('Nome do prato'), nome);
  await fireEvent.changeText(screen.getByLabelText('Preço do prato em euros'), preco);
  await fireEvent.press(screen.getByRole('button', { name: 'Adicionar prato' }));
}

// O que o ecrã disse ao router sobre "travar a saída" na última vez que foi desenhado.
const saidaTravada = () => usePreventRemove.mock.calls.at(-1)[0];

beforeEach(() => {
  jest.clearAllMocks();
  router.canGoBack.mockReturnValue(true);
  buscarMeuRestaurante.mockResolvedValue({ id: 'r1', nome: 'Tasca do Manuel' });
  buscarMenuDeHoje.mockResolvedValue(null);
  publicarMenu.mockResolvedValue({ id: 'm1', pratos: [] });
});

describe('Publicar menu — primeira publicação do dia', () => {
  test('sem perfil de restaurante, pede para o preencher primeiro', async () => {
    buscarMeuRestaurante.mockResolvedValue(null);
    await render(<Publicar />);
    expect(await screen.findByText(/preenche o perfil do restaurante/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Preencher o perfil' }));
    expect(router.replace).toHaveBeenCalledWith('/perfil');
  });

  test('começa sem pratos e com o botão "Publicar menu"', async () => {
    await render(<Publicar />);
    expect(await screen.findByText('Ainda não há pratos. Adiciona o primeiro em cima.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publicar menu' })).toBeTruthy();
    expect(saidaTravada()).toBe(false); // sem alterações, pode sair-se à vontade
  });

  test('adicionar um prato põe-no na lista e limpa o formulário', async () => {
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await adicionarPrato('  Arroz   de pato ', '9,5');

    expect(screen.getByText('Arroz de pato')).toBeTruthy(); // nome sem espaços a mais
    expect(screen.getByText('9,50 €')).toBeTruthy(); // RN03: duas casas decimais
    // "Carne" aparece duas vezes: na etiqueta da categoria (escolhida por omissão) e na linha do prato
    expect(screen.getAllByText('Carne')).toHaveLength(2);
    expect(screen.getByLabelText('Nome do prato').props.value).toBe('');
    expect(screen.getByLabelText('Preço do prato em euros').props.value).toBe('');
    expect(saidaTravada()).toBe(true); // agora há alterações por publicar
  });

  test('campos vazios ou errados mostram o erro e não entram na lista', async () => {
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');

    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar prato' }));
    expect(screen.getByText(/Escreve o nome do prato\./)).toBeTruthy();
    expect(screen.getByText(/Escreve o preço do prato\./)).toBeTruthy();

    await adicionarPrato('Arroz de pato', 'abc');
    expect(screen.getByText(/O preço não é válido/)).toBeTruthy();
    expect(screen.getByText('Ainda não há pratos. Adiciona o primeiro em cima.')).toBeTruthy();
  });

  test('o mesmo prato não entra duas vezes', async () => {
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await adicionarPrato('Arroz de pato', '9,50');
    await adicionarPrato('arroz de pato', '10');
    expect(screen.getByText(/Este prato já está no menu\./)).toBeTruthy();
    expect(screen.getAllByText('Arroz de pato')).toHaveLength(1);
  });

  test('escolher outra categoria e publicar envia a lista e volta ao Painel', async () => {
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await adicionarPrato('Arroz de pato', '9,50');
    await fireEvent.press(screen.getByRole('radio', { name: 'Sobremesa' }));
    await adicionarPrato('Pudim caseiro', '2');
    await fireEvent.changeText(screen.getByLabelText('Preço do menu completo (opcional)'), '10');

    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));

    expect(publicarMenu).toHaveBeenCalledTimes(1);
    expect(publicarMenu).toHaveBeenCalledWith('r1', {
      precoMenuCompleto: 10,
      pratos: [
        expect.objectContaining({ nome: 'Arroz de pato', categoria: 'carne', preco: 9.5 }),
        expect.objectContaining({ nome: 'Pudim caseiro', categoria: 'sobremesa', preco: 2 }),
      ],
    });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  test('não publica um menu vazio', async () => {
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));
    expect(screen.getByText('Adiciona pelo menos um prato antes de publicar.')).toBeTruthy();
    expect(publicarMenu).not.toHaveBeenCalled();
  });

  test('avisa se ficou um prato escrito por adicionar', async () => {
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await adicionarPrato('Arroz de pato', '9,50');
    await fireEvent.changeText(screen.getByLabelText('Nome do prato'), 'Pudim');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));
    expect(screen.getByText(/Tens um prato por adicionar/)).toBeTruthy();
    expect(publicarMenu).not.toHaveBeenCalled();
  });

  test('preço do menu completo errado não deixa publicar', async () => {
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await adicionarPrato('Arroz de pato', '9,50');
    await fireEvent.changeText(screen.getByLabelText('Preço do menu completo (opcional)'), 'dez');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));
    expect(screen.getByText('O preço não é válido. Exemplo: 10,00')).toBeTruthy();
    expect(publicarMenu).not.toHaveBeenCalled();
  });

  test('se a publicação falhar, mostra a mensagem e a lista fica como estava', async () => {
    publicarMenu.mockRejectedValue(new Error('Sem ligação à internet. Verifica a rede e tenta outra vez.'));
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await adicionarPrato('Arroz de pato', '9,50');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));

    expect(await screen.findByText('Sem ligação à internet. Verifica a rede e tenta outra vez.')).toBeTruthy();
    expect(screen.getByText('Arroz de pato')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('Publicar menu — editar o menu já publicado', () => {
  beforeEach(() => {
    buscarMenuDeHoje.mockResolvedValue({ id: 'm1', preco_menu_completo: 10, pratos: [SOPA, BACALHAU] });
  });

  test('abre com os pratos de hoje, o preço do menu e o botão "Guardar alterações"', async () => {
    await render(<Publicar />);
    expect(await screen.findByText('Sopa de legumes')).toBeTruthy();
    expect(screen.getByText('Bacalhau à Brás')).toBeTruthy();
    expect(screen.getByLabelText('Preço do menu completo (opcional)').props.value).toBe('10,00');
    expect(screen.getByRole('button', { name: 'Guardar alterações' })).toBeTruthy();
    expect(saidaTravada()).toBe(false);
  });

  test('tocar num prato leva-o para o formulário; guardar altera-o sem perder o id', async () => {
    await render(<Publicar />);
    await fireEvent.press(await screen.findByLabelText('Alterar Bacalhau à Brás, 8,50 €'));

    expect(screen.getByText('Alterar prato')).toBeTruthy();
    expect(screen.getByLabelText('Nome do prato').props.value).toBe('Bacalhau à Brás');
    expect(screen.getByLabelText('Preço do prato em euros').props.value).toBe('8,50');

    await fireEvent.changeText(screen.getByLabelText('Preço do prato em euros'), '9');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar prato' }));
    expect(screen.getByText('9,00 €')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Guardar alterações' }));
    expect(publicarMenu).toHaveBeenCalledWith('r1', {
      precoMenuCompleto: 10,
      pratos: [expect.objectContaining({ id: 'p1' }), expect.objectContaining({ id: 'p2', nome: 'Bacalhau à Brás', preco: 9 })],
    });
  });

  test('remover um prato tira-o da lista que é publicada', async () => {
    await render(<Publicar />);
    await fireEvent.press(await screen.findByLabelText('Remover Sopa de legumes'));
    expect(screen.queryByText('Sopa de legumes')).toBeNull();
    expect(saidaTravada()).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Guardar alterações' }));
    expect(publicarMenu.mock.calls[0][1].pratos.map((prato) => prato.id)).toEqual(['p2']);
  });

  test('cancelar a alteração limpa o formulário e não mexe na lista', async () => {
    await render(<Publicar />);
    await fireEvent.press(await screen.findByLabelText('Alterar Sopa de legumes, 1,50 €'));
    await fireEvent.press(screen.getByText('Cancelar alteração'));
    expect(screen.getByLabelText('Nome do prato').props.value).toBe('');
    expect(screen.getByText('Sopa de legumes')).toBeTruthy();
    expect(saidaTravada()).toBe(false);
  });
});

describe('Publicar menu — falha ao carregar', () => {
  test('mostra a mensagem e deixa tentar outra vez', async () => {
    buscarMeuRestaurante.mockRejectedValueOnce(new Error('Sem ligação à internet. Verifica a rede e tenta outra vez.'));
    await render(<Publicar />);
    expect(await screen.findByText('Sem ligação à internet. Verifica a rede e tenta outra vez.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByText('Pratos de hoje')).toBeTruthy();
  });
});
