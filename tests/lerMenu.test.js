import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { lerMenuDaFoto, limparPratosLidos } from '@/services/lerMenu';

// Ler o menu a partir de uma fotografia — testes ao serviço src/services/lerMenu.js.
// A função do Supabase ("ler-menu") e o tratamento da imagem são simulados: aqui só se confirma
// o que a app envia e o que faz com a resposta. Correr com: npm test

const mockEstado = {
  resposta: { data: null, error: null }, // o que a função "ler-menu" responde
  pedido: null, // o que a app enviou
  imagemFalha: false,
  opcoesDaImagem: null,
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: async (nome, opcoes) => {
        mockEstado.pedido = { nome, opcoes };
        return mockEstado.resposta;
      },
    },
  },
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate(uri, opcoes) {
      if (mockEstado.imagemFalha) throw new Error('Could not decode image');
      mockEstado.opcoesDaImagem = { uri, ...opcoes };
      return {
        release() {},
        async renderAsync() {
          return {
            release() {},
            async saveAsync(opcoesDeGravar) {
              Object.assign(mockEstado.opcoesDaImagem, opcoesDeGravar);
              return { uri: 'file:///cache/menu.jpg', base64: 'IMAGEM-EM-BASE64' };
            },
          };
        },
      };
    },
  },
}));

beforeEach(() => {
  Object.assign(mockEstado, { resposta: { data: null, error: null }, pedido: null, imagemFalha: false, opcoesDaImagem: null });
  // os avisos técnicos na consola são esperados nos testes de erro
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('limparPratosLidos — confirmar a resposta antes de a mostrar', () => {
  test('uma resposta normal passa como está', () => {
    const resposta = {
      pratos: [
        { nome: 'Caldo verde', categoria: 'sopa', preco: 1.8 },
        { nome: 'Bacalhau à Brás', categoria: 'peixe', preco: 8.5 },
      ],
      preco_menu_completo: 9.5,
    };
    expect(limparPratosLidos(resposta)).toEqual({
      pratos: [
        { nome: 'Caldo verde', categoria: 'sopa', preco: 1.8 },
        { nome: 'Bacalhau à Brás', categoria: 'peixe', preco: 8.5 },
      ],
      precoMenuCompleto: 9.5,
    });
  });

  test('limpa os nomes e deixa de fora os vazios e os repetidos', () => {
    const { pratos } = limparPratosLidos({
      pratos: [
        { nome: '  Arroz   de pato ', categoria: 'carne', preco: 9 },
        { nome: 'ARROZ DE PATO', categoria: 'carne', preco: 9 }, // o mesmo prato, escrito de outra maneira
        { nome: ' ', categoria: 'carne', preco: 5 },
        { nome: 'X', categoria: 'carne', preco: 5 }, // um nome tem pelo menos 2 letras
        { categoria: 'carne', preco: 5 }, // sem nome
        null,
      ],
    });
    expect(pratos).toEqual([{ nome: 'Arroz de pato', categoria: 'carne', preco: 9 }]);
  });

  test('um nome comprido demais é cortado aos 60 caracteres', () => {
    const { pratos } = limparPratosLidos({ pratos: [{ nome: 'a'.repeat(80), categoria: 'carne', preco: 5 }] });
    expect(pratos[0].nome).toHaveLength(60);
  });

  test('categoria desconhecida passa a carne (o dono corrige no ecrã)', () => {
    const { pratos } = limparPratosLidos({ pratos: [{ nome: 'Francesinha', categoria: 'sandes', preco: 9 }] });
    expect(pratos[0].categoria).toBe('carne');
  });

  test.each([
    ['sem preço', null, null],
    ['texto em vez de número', '8,50', null],
    ['zero', 0, null],
    ['negativo', -3, null],
    ['absurdo', 123456, null],
    ['com casas a mais', 8.499, 8.5], // RN03: duas casas decimais
    ['normal', 7, 7],
  ])('preço %s', (_nome, lido, esperado) => {
    const { pratos } = limparPratosLidos({ pratos: [{ nome: 'Prato do dia', categoria: 'carne', preco: lido }] });
    expect(pratos[0].preco).toBe(esperado);
  });

  test('resposta estranha ou vazia dá uma lista vazia, nunca um erro', () => {
    const vazio = { pratos: [], precoMenuCompleto: null };
    expect(limparPratosLidos(null)).toEqual(vazio);
    expect(limparPratosLidos({})).toEqual(vazio);
    expect(limparPratosLidos({ pratos: 'nada', preco_menu_completo: 'dez' })).toEqual(vazio);
  });

  test('não aceita mais de 40 pratos', () => {
    const muitos = Array.from({ length: 60 }, (_item, indice) => ({ nome: `Prato ${indice}`, categoria: 'carne', preco: 5 }));
    expect(limparPratosLidos({ pratos: muitos }).pratos).toHaveLength(40);
  });
});

describe('lerMenuDaFoto — enviar a fotografia à função "ler-menu"', () => {
  test('reduz a imagem, envia-a em base64 e devolve os pratos confirmados', async () => {
    mockEstado.resposta = {
      data: { pratos: [{ nome: ' Caldo verde ', categoria: 'sopa', preco: 1.8 }], preco_menu_completo: null },
      error: null,
    };

    await expect(lerMenuDaFoto('file:///fotos/quadro.jpg')).resolves.toEqual({
      pratos: [{ nome: 'Caldo verde', categoria: 'sopa', preco: 1.8 }],
      precoMenuCompleto: null,
    });

    expect(mockEstado.opcoesDaImagem).toMatchObject({ uri: 'file:///fotos/quadro.jpg', maxWidth: 1600, maxHeight: 1600, format: 'jpeg', base64: true });
    expect(mockEstado.pedido).toEqual({ nome: 'ler-menu', opcoes: { body: { imagem: 'IMAGEM-EM-BASE64' } } });
  });

  test('fotografia que não se consegue abrir: avisa e não envia nada', async () => {
    mockEstado.imagemFalha = true;
    await expect(lerMenuDaFoto('file:///estragada.jpg')).rejects.toThrow('Não foi possível preparar a fotografia');
    expect(mockEstado.pedido).toBeNull();
  });

  test('sem rede', async () => {
    mockEstado.resposta = { data: null, error: new FunctionsFetchError(new TypeError('Network request failed')) };
    await expect(lerMenuDaFoto('file:///menu.jpg')).rejects.toThrow('Sem ligação à internet');
  });

  test('a função ainda não foi posta no Supabase (404)', async () => {
    mockEstado.resposta = { data: null, error: new FunctionsHttpError({ status: 404, json: async () => ({ code: 'NOT_FOUND' }) }) };
    await expect(lerMenuDaFoto('file:///menu.jpg')).rejects.toThrow('ainda não está ativada');
  });

  test('a função explica o problema em português e a app mostra essa mensagem', async () => {
    const erro = 'Só as contas de restaurante podem ler menus por fotografia.';
    mockEstado.resposta = { data: null, error: new FunctionsHttpError({ status: 403, json: async () => ({ erro }) }) };
    await expect(lerMenuDaFoto('file:///menu.jpg')).rejects.toThrow(erro);
  });

  test('resposta de erro sem explicação dá a mensagem geral, nunca uma mensagem técnica', async () => {
    mockEstado.resposta = {
      data: null,
      error: new FunctionsHttpError({
        status: 500,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      }),
    };
    const promessa = lerMenuDaFoto('file:///menu.jpg');
    await expect(promessa).rejects.toThrow('Não foi possível ler a fotografia');
    await expect(promessa).rejects.not.toThrow(/unexpected|non-2xx|edge function/i);
  });
});
