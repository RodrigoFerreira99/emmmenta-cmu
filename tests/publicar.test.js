import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, usePreventRemove } from 'expo-router';

import Publicar from '@/app/publicar';
import { escolherDaGaleria, pedirAcessoACamara } from '@/lib/fotografias';
import { lerMenuDaFoto } from '@/services/lerMenu';
import { buscarMenuDeHoje, buscarUltimoMenuAnterior, publicarMenu } from '@/services/menus';
import { buscarMeuRestaurante, enviarFotoDoPrato, recortarFotoDoPrato } from '@/services/restaurantes';

// RF03 — testes ao ecrã Publicar menu, a carregar nos botões como um utilizador faria.
// A base de dados é simulada: só interessa confirmar o que o ecrã mostra e o que pede para gravar.
// Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ sessao: { user: { id: 'u1', email: 'tasca@email.pt' } }, perfil: { nome: 'Manuel', tipo: 'restaurante' } }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) },
  usePreventRemove: jest.fn(),
}));
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 56 }));
jest.mock('@/services/restaurantes', () => ({ buscarMeuRestaurante: jest.fn(), enviarFotoDoPrato: jest.fn(), recortarFotoDoPrato: jest.fn() }));
// As funções sem rede (validar, ler preços...) são as verdadeiras; só as que falam com a base de dados são simuladas.
jest.mock('@/services/menus', () => ({
  ...jest.requireActual('@/services/menus'),
  buscarMenuDeHoje: jest.fn(),
  buscarUltimoMenuAnterior: jest.fn(),
  publicarMenu: jest.fn(),
}));
// Ler o menu de uma fotografia: a permissão, a galeria, a câmara e a função que lê a imagem são simuladas.
jest.mock('@/lib/fotografias', () => ({ escolherDaGaleria: jest.fn(), pedirAcessoACamara: jest.fn() }));
// A câmara verdadeira só existe no telemóvel: aqui é trocada por dois botões ("Tirar fotografia" e "Cancelar").
jest.mock('@/components/CameraNaApp', () => {
  const mockReact = require('react');
  const { Pressable, View } = require('react-native');
  return {
    CameraNaApp: ({ aoTirar, aoFechar }) =>
      mockReact.createElement(
        View,
        null,
        mockReact.createElement(Pressable, {
          accessibilityRole: 'button',
          accessibilityLabel: 'Tirar fotografia',
          onPress: () => aoTirar('file:///fotos/quadro.jpg'),
        }),
        mockReact.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Cancelar', onPress: aoFechar })
      ),
  };
});
jest.mock('@/services/lerMenu', () => ({ lerMenuDaFoto: jest.fn() }));

const SOPA = { id: 'p1', nome: 'Sopa de legumes', categoria: 'sopa', preco: 1.5, esgotado: false };
const BACALHAU = { id: 'p2', nome: 'Bacalhau à Brás', categoria: 'peixe', preco: 8.5, esgotado: true };

// Escreve um prato no formulário e carrega em "Adicionar prato".
async function adicionarPrato(nome, preco) {
  await fireEvent.changeText(screen.getByLabelText('Nome do prato'), nome);
  await fireEvent.changeText(screen.getByLabelText('Preço do prato em euros'), preco);
  await fireEvent.press(screen.getByRole('button', { name: 'Adicionar prato' }));
}

// Carrega em "Fotografar" e, já com a câmara da app aberta, em "Tirar fotografia".
async function fotografar() {
  await fireEvent.press(screen.getByRole('button', { name: 'Fotografar' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Tirar fotografia' }));
}

// O que o ecrã disse ao router sobre "travar a saída" na última vez que foi desenhado.
const saidaTravada = () => usePreventRemove.mock.calls.at(-1)[0];

beforeEach(() => {
  jest.clearAllMocks();
  router.canGoBack.mockReturnValue(true);
  buscarMeuRestaurante.mockResolvedValue({ id: 'r1', nome: 'Tasca do Manuel' });
  buscarMenuDeHoje.mockResolvedValue(null);
  buscarUltimoMenuAnterior.mockResolvedValue(null);
  publicarMenu.mockResolvedValue({ id: 'm1', pratos: [] });
  escolherDaGaleria.mockResolvedValue('file:///fotos/quadro.jpg');
  pedirAcessoACamara.mockResolvedValue();
  lerMenuDaFoto.mockResolvedValue({ pratos: [], precoMenuCompleto: null });
});

describe('Publicar menu — primeira publicação do dia', () => {
  test('sem perfil de restaurante, pede para o preencher primeiro', async () => {
    buscarMeuRestaurante.mockResolvedValue(null);
    await render(<Publicar />);
    expect(await screen.findByText(/preenche o perfil do restaurante/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Preencher o perfil' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/perfil');
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

describe('Publicar menu — ler o menu de uma fotografia', () => {
  const CALDO = { nome: 'Caldo verde', categoria: 'sopa', preco: 1.8 };
  const PATO = { nome: 'Arroz de pato', categoria: 'carne', preco: 8.5 };

  test('os pratos lidos entram na lista para confirmar; nada é publicado sozinho', async () => {
    lerMenuDaFoto.mockResolvedValue({ pratos: [CALDO, PATO], precoMenuCompleto: 9.5 });
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');

    await fotografar();

    expect(pedirAcessoACamara).toHaveBeenCalledTimes(1); // a permissão é pedida antes de abrir a câmara
    expect(lerMenuDaFoto).toHaveBeenCalledWith('file:///fotos/quadro.jpg');
    expect(await screen.findByText(/Foram lidos 2 pratos\. Confirma os nomes/)).toBeTruthy();
    expect(screen.getByText('Caldo verde')).toBeTruthy();
    expect(screen.getByText('1,80 €')).toBeTruthy();
    expect(screen.getByText('Arroz de pato')).toBeTruthy();
    expect(screen.getByLabelText('Preço do menu completo (opcional)').props.value).toBe('9,50');
    expect(publicarMenu).not.toHaveBeenCalled(); // quem publica é o dono, depois de confirmar
    expect(saidaTravada()).toBe(true); // há alterações por publicar

    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));
    expect(publicarMenu).toHaveBeenCalledWith('r1', {
      precoMenuCompleto: 9.5,
      pratos: [expect.objectContaining(CALDO), expect.objectContaining(PATO)],
    });
  });

  test('a galeria também serve, e desistir de escolher a fotografia não faz nada', async () => {
    escolherDaGaleria.mockResolvedValue(null); // a pessoa fechou a galeria sem escolher
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');

    await fireEvent.press(screen.getByRole('button', { name: 'Galeria' }));
    expect(escolherDaGaleria).toHaveBeenCalledTimes(1);
    expect(lerMenuDaFoto).not.toHaveBeenCalled();
    expect(screen.getByText('Ainda não há pratos. Adiciona o primeiro em cima.')).toBeTruthy();
  });

  test('um prato lido sem preço não deixa publicar até o preço ser escrito', async () => {
    lerMenuDaFoto.mockResolvedValue({ pratos: [{ nome: 'Pudim', categoria: 'sobremesa', preco: null }], precoMenuCompleto: null });
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await fotografar();

    expect(await screen.findByText(/Foi lido 1 prato\..*Falta o preço de 1 prato: toca nele/)).toBeTruthy();
    expect(screen.getByText('Falta o preço')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));
    expect(screen.getByText('Falta o preço de 1 prato. Toca nele para o escrever.')).toBeTruthy();
    expect(publicarMenu).not.toHaveBeenCalled();

    // tocar no prato leva-o para o formulário; escreve-se o preço e guarda-se
    await fireEvent.press(screen.getByLabelText('Alterar Pudim, falta o preço'));
    expect(screen.getByLabelText('Nome do prato').props.value).toBe('Pudim');
    await fireEvent.changeText(screen.getByLabelText('Preço do prato em euros'), '2,5');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar prato' }));
    expect(screen.getByText('2,50 €')).toBeTruthy();
    expect(screen.queryByText('Falta o preço')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));
    expect(publicarMenu).toHaveBeenCalledWith('r1', {
      precoMenuCompleto: null,
      pratos: [expect.objectContaining({ nome: 'Pudim', categoria: 'sobremesa', preco: 2.5 })],
    });
  });

  test('um prato que já está no menu não entra outra vez', async () => {
    lerMenuDaFoto.mockResolvedValue({ pratos: [{ ...PATO, nome: 'ARROZ DE PATO' }, CALDO], precoMenuCompleto: 9.5 });
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await adicionarPrato('Arroz de pato', '9');
    await fireEvent.changeText(screen.getByLabelText('Preço do menu completo (opcional)'), '12');

    await fotografar();

    expect(await screen.findByText(/Foi lido 1 prato\./)).toBeTruthy();
    expect(screen.getByText('Caldo verde')).toBeTruthy();
    expect(screen.getByText('9,00 €')).toBeTruthy(); // o prato escrito à mão fica como estava
    expect(screen.queryByText('ARROZ DE PATO')).toBeNull();
    // o preço do menu completo que o dono escreveu não é trocado pelo da fotografia
    expect(screen.getByLabelText('Preço do menu completo (opcional)').props.value).toBe('12');
  });

  test('fotografia sem pratos legíveis: explica o que fazer', async () => {
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await fotografar();
    expect(await screen.findByText(/Não foi possível ler nenhum prato nesta fotografia/)).toBeTruthy();
  });

  test('se a leitura falhar, mostra a mensagem e o resto do ecrã continua a funcionar (RNF08)', async () => {
    lerMenuDaFoto.mockRejectedValue(new Error('A leitura por fotografia ainda não está ativada. Escreve os pratos à mão.'));
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');

    await fotografar();
    expect(await screen.findByText('A leitura por fotografia ainda não está ativada. Escreve os pratos à mão.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fotografar' })).toBeTruthy(); // pode tentar-se outra vez

    await adicionarPrato('Arroz de pato', '9');
    expect(screen.getByText('Arroz de pato')).toBeTruthy();
  });

  test('sem acesso à câmara, a mensagem aparece no cartão e a câmara não abre', async () => {
    pedirAcessoACamara.mockRejectedValue(new Error('Sem acesso à câmara não é possível tirar a fotografia. Podes escolher uma imagem da galeria.'));
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await fireEvent.press(screen.getByRole('button', { name: 'Fotografar' }));
    expect(await screen.findByText(/Sem acesso à câmara/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tirar fotografia' })).toBeNull();
    expect(lerMenuDaFoto).not.toHaveBeenCalled();
  });

  test('a câmara abre dentro da app; "Cancelar" fecha-a sem ler nada', async () => {
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await fireEvent.press(screen.getByRole('button', { name: 'Fotografar' }));
    expect(await screen.findByRole('button', { name: 'Tirar fotografia' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('button', { name: 'Tirar fotografia' })).toBeNull();
    expect(lerMenuDaFoto).not.toHaveBeenCalled();
  });

  test('depois de tirar a fotografia a câmara fecha e aparece "A ler o menu"', async () => {
    let terminarLeitura;
    lerMenuDaFoto.mockImplementation(() => new Promise((resolver) => (terminarLeitura = resolver)));
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');

    await fotografar();
    expect(screen.queryByRole('button', { name: 'Tirar fotografia' })).toBeNull();
    expect(screen.getByLabelText('A ler o menu')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fotografar' })).toBeNull(); // não se lê duas fotografias ao mesmo tempo

    await act(async () => terminarLeitura({ pratos: [CALDO], precoMenuCompleto: null }));
    expect(screen.getByText('Caldo verde')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fotografar' })).toBeTruthy();
  });
});

describe('Publicar menu — repetir o menu anterior', () => {
  // como vem do serviço: sem id e sem "esgotado"
  const ANTERIOR = {
    dia: '2026-11-13',
    precoMenuCompleto: 9.5,
    pratos: [
      { nome: 'Caldo verde', categoria: 'sopa', preco: 1.8 },
      { nome: 'Arroz de pato', categoria: 'carne', preco: 8.5 },
    ],
  };

  test('mostra o último menu e, com um toque, copia os pratos para hoje', async () => {
    buscarUltimoMenuAnterior.mockResolvedValue(ANTERIOR);
    await render(<Publicar />);

    expect(await screen.findByText(/^Repetir o menu de /)).toBeTruthy();
    expect(buscarUltimoMenuAnterior).toHaveBeenCalledWith('r1');
    expect(screen.getByText('Caldo verde · Arroz de pato')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Usar estes 2 pratos' }));
    expect(screen.getByText(/^Foram copiados 2 pratos\. Muda o que for diferente/)).toBeTruthy();
    expect(screen.getByText('1,80 €')).toBeTruthy();
    expect(screen.getByText('8,50 €')).toBeTruthy();
    expect(screen.getByLabelText('Preço do menu completo (opcional)').props.value).toBe('9,50');
    expect(saidaTravada()).toBe(true); // há alterações por publicar
    expect(publicarMenu).not.toHaveBeenCalled(); // nada é publicado sozinho
  });

  test('os pratos copiados são publicados como pratos novos de hoje (sem o id do menu antigo)', async () => {
    buscarUltimoMenuAnterior.mockResolvedValue({ ...ANTERIOR, pratos: ANTERIOR.pratos.map((prato, i) => ({ ...prato, id: `antigo-${i}` })) });
    await render(<Publicar />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Usar estes 2 pratos' }));

    // alterar o preço de um prato copiado, como o dono faria
    await fireEvent.press(screen.getByLabelText('Alterar Arroz de pato, 8,50 €'));
    await fireEvent.changeText(screen.getByLabelText('Preço do prato em euros'), '9');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar prato' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));
    const { pratos } = publicarMenu.mock.calls[0][1];
    expect(pratos).toEqual([
      expect.objectContaining({ nome: 'Caldo verde', categoria: 'sopa', preco: 1.8 }),
      expect.objectContaining({ nome: 'Arroz de pato', categoria: 'carne', preco: 9 }),
    ]);
    for (const prato of pratos) expect(prato.id).toBeUndefined();
  });

  test('carregar duas vezes não duplica os pratos', async () => {
    buscarUltimoMenuAnterior.mockResolvedValue(ANTERIOR);
    await render(<Publicar />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Usar estes 2 pratos' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Usar estes 2 pratos' }));
    expect(screen.getByText('Esses pratos já estão no menu de hoje.')).toBeTruthy();
    expect(screen.getAllByText('Caldo verde')).toHaveLength(1);
  });

  test('não aparece quando o menu de hoje já foi publicado', async () => {
    buscarMenuDeHoje.mockResolvedValue({ id: 'm1', preco_menu_completo: null, pratos: [SOPA] });
    buscarUltimoMenuAnterior.mockResolvedValue(ANTERIOR);
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    expect(screen.queryByText(/^Repetir o menu de /)).toBeNull();
  });

  test('sem menus anteriores, ou se a procura falhar, o ecrã abre na mesma sem o cartão', async () => {
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    expect(screen.queryByText(/^Repetir o menu de /)).toBeNull();

    buscarUltimoMenuAnterior.mockRejectedValue(new Error('Sem ligação à internet. Verifica a rede e tenta outra vez.'));
    await render(<Publicar />);
    expect(await screen.findByText('Pratos de hoje')).toBeTruthy();
    expect(screen.queryByText(/^Repetir o menu de /)).toBeNull();
  });
});

describe('Publicar menu — etiquetas e fotografia de cada prato', () => {
  const LINK = 'https://exemplo.supabase.co/storage/v1/object/public/fotos/u1/pratos/prato-1.jpg';
  const etiqueta = (nome) => screen.getByRole('checkbox', { name: nome });

  test('escolher várias etiquetas: aparecem na lista e são publicadas com o prato', async () => {
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await fireEvent.press(screen.getByRole('radio', { name: 'Vegetariano' }));
    await fireEvent.press(etiqueta('Vegano'));
    await fireEvent.press(etiqueta('Sem glúten'));
    expect(etiqueta('Vegano').props.accessibilityState.checked).toBe(true);
    await adicionarPrato('Salada de grão', '6,50');

    expect(screen.getByText('Vegetariano · Vegano · Sem glúten')).toBeTruthy();
    expect(etiqueta('Vegano').props.accessibilityState.checked).toBe(false); // o formulário fica limpo para o prato seguinte

    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));
    expect(publicarMenu).toHaveBeenCalledWith('r1', {
      precoMenuCompleto: null,
      pratos: [expect.objectContaining({ nome: 'Salada de grão', etiquetas: ['vegano', 'sem-gluten'], foto_url: null })],
    });
  });

  test('a fotografia do prato é enviada logo e o prato fica com o link', async () => {
    escolherDaGaleria.mockResolvedValue('file:///galeria/salada.jpg');
    enviarFotoDoPrato.mockResolvedValue(LINK);
    recortarFotoDoPrato.mockRejectedValue(new Error('O recorte das fotografias ainda não está ativado. Fica a fotografia normal.'));
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher fotografia do prato da galeria' }));
    expect(enviarFotoDoPrato).toHaveBeenCalledWith('u1', 'file:///galeria/salada.jpg');
    expect(await screen.findByLabelText('Fotografia do prato')).toBeTruthy();

    await adicionarPrato('Salada de grão', '6,50');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));
    expect(publicarMenu).toHaveBeenCalledWith('r1', expect.objectContaining({ pratos: [expect.objectContaining({ foto_url: LINK })] }));
    // o recorte não estava ativado: fica a fotografia normal e aparece só uma nota
    expect(screen.queryByText(/ainda não está ativado/)).toBeNull(); // o formulário ficou limpo para o prato seguinte
  });

  test('design térmico: a fotografia é recortada (sem fundo) e o prato fica com o recorte', async () => {
    const RECORTE = 'https://exemplo.supabase.co/storage/v1/object/public/fotos/u1/pratos/recorte-prato-1.png';
    escolherDaGaleria.mockResolvedValue('file:///galeria/salada.jpg');
    enviarFotoDoPrato.mockResolvedValue(LINK);
    recortarFotoDoPrato.mockResolvedValue(RECORTE);
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher fotografia do prato da galeria' }));
    expect(recortarFotoDoPrato).toHaveBeenCalledWith(LINK); // o recorte é pedido com o link da fotografia enviada
    await waitFor(() => expect(screen.getByLabelText('Fotografia do prato').props.source).toEqual({ uri: RECORTE }));

    await adicionarPrato('Salada de grão', '6,50');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));
    expect(publicarMenu).toHaveBeenCalledWith('r1', expect.objectContaining({ pratos: [expect.objectContaining({ foto_url: RECORTE })] }));
  });

  test('se o recorte falhar, fica a fotografia normal e aparece a explicação', async () => {
    escolherDaGaleria.mockResolvedValue('file:///galeria/salada.jpg');
    enviarFotoDoPrato.mockResolvedValue(LINK);
    recortarFotoDoPrato.mockRejectedValue(new Error('Os recortes grátis deste mês acabaram. Fica a fotografia normal.'));
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher fotografia do prato da galeria' }));
    expect(await screen.findByText('Os recortes grátis deste mês acabaram. Fica a fotografia normal.')).toBeTruthy();
    expect(screen.getByLabelText('Fotografia do prato').props.source).toEqual({ uri: LINK });
  });

  test('se a fotografia não puder ser enviada, explica; o prato pode entrar sem ela', async () => {
    escolherDaGaleria.mockResolvedValue('file:///galeria/enorme.jpg');
    enviarFotoDoPrato.mockRejectedValue(new Error('Não foi possível reduzir a fotografia para menos de 500 KB. Escolhe outra imagem.'));
    await render(<Publicar />);
    await screen.findByText('Pratos de hoje');
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher fotografia do prato da galeria' }));
    expect(await screen.findByText(/menos de 500 KB/)).toBeTruthy();

    await adicionarPrato('Salada de grão', '6,50');
    expect(screen.getByText('Salada de grão')).toBeTruthy();
  });

  test('ao alterar um prato, as etiquetas dele voltam ao formulário', async () => {
    buscarMenuDeHoje.mockResolvedValue({ id: 'm1', preco_menu_completo: null, pratos: [{ ...SOPA, etiquetas: ['vegano'], foto_url: null }] });
    await render(<Publicar />);
    expect(await screen.findByText('Sopa · Vegano')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Alterar Sopa de legumes, 1,50 €'));
    expect(etiqueta('Vegano').props.accessibilityState.checked).toBe(true);
    expect(etiqueta('Picante').props.accessibilityState.checked).toBe(false);
  });

  test('repetir o menu anterior traz também as etiquetas e a fotografia', async () => {
    buscarUltimoMenuAnterior.mockResolvedValue({
      dia: '2026-11-17',
      precoMenuCompleto: null,
      pratos: [{ nome: 'Chili vegano', categoria: 'vegetariano', preco: 7, etiquetas: ['vegano', 'picante'], foto_url: LINK }],
    });
    await render(<Publicar />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Usar este prato' }));
    expect(screen.getByText('Vegetariano · Vegano · Picante')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar menu' }));
    expect(publicarMenu).toHaveBeenCalledWith('r1', {
      precoMenuCompleto: null,
      pratos: [expect.objectContaining({ nome: 'Chili vegano', etiquetas: ['vegano', 'picante'], foto_url: LINK })],
    });
  });
});

describe('Publicar menu — revisão do código', () => {
  test('uma fotografia que acaba de ser enviada depois de se mudar de prato não vai para o prato errado', async () => {
    let acabarEnvio;
    escolherDaGaleria.mockResolvedValue('file:///galeria/arroz.jpg');
    enviarFotoDoPrato.mockImplementation(
      () =>
        new Promise((resolver) => {
          acabarEnvio = resolver;
        })
    );
    buscarMenuDeHoje.mockResolvedValue({ id: 'm1', preco_menu_completo: null, pratos: [SOPA] });
    await render(<Publicar />);
    await screen.findByText('Sopa de legumes');

    // começa a enviar a fotografia de um prato novo e, antes de acabar, toca na sopa para a alterar
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher fotografia do prato da galeria' }));
    await fireEvent.press(screen.getByLabelText('Alterar Sopa de legumes, 1,50 €'));
    await act(async () => acabarEnvio('https://fotos/u1/pratos/arroz.jpg'));

    // a sopa continua sem fotografia
    expect(screen.queryByLabelText('Fotografia do prato')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar prato' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar alterações' }));
    const [sopa] = publicarMenu.mock.calls[0][1].pratos;
    expect(sopa.foto_url ?? null).toBeNull(); // antes da correção, a sopa ficava com a fotografia do arroz
  });
});
