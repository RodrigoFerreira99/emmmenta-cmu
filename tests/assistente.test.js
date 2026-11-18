import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PesquisaComIa } from '@/components/PesquisaComIa';
import {
  descreverFiltros,
  interpretarPesquisa,
  interpretarPesquisaSemIa,
  limparFiltrosDaIa,
  temAlgumFiltro,
  traduzirPratos,
} from '@/services/assistente';

// O assistente de IA (pesquisa por frase e menu em inglês) — testes a src/services/assistente.js
// e ao painel PesquisaComIa. A função "assistente" do Supabase é simulada: aqui só se confirma o que
// a app envia e o que faz com a resposta (incluindo quando a IA falha). Correr com: npm test

const mockEstado = {
  resposta: { data: null, error: null }, // o que a função "assistente" responde
  pedidos: [], // o que a app enviou
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: async (nome, opcoes) => {
        mockEstado.pedidos.push({ nome, opcoes });
        return mockEstado.resposta;
      },
    },
  },
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@/lib/vibrar', () => ({ vibrarLeve: jest.fn(), vibrarSucesso: jest.fn(), vibrarSelecao: jest.fn() }));

// Erros como os que o supabase-js devolve
const semRede = () => new FunctionsFetchError(new TypeError('Network request failed'));
const erroDaFuncao = (status, corpo) => new FunctionsHttpError({ status, json: async () => corpo });

const PEIXE_PERTO = { categoria: 'peixe', etiqueta: null, precoMax: 8, raioKm: 1, pesquisa: null };
const NADA = { categoria: null, etiqueta: null, precoMax: null, raioKm: null, pesquisa: null };

beforeEach(() => {
  mockEstado.resposta = { data: null, error: null };
  mockEstado.pedidos = [];
  // os avisos técnicos na consola são esperados nos testes de erro
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('limparFiltrosDaIa — só passa o que a app conhece', () => {
  test('uma resposta normal passa como está', () => {
    expect(limparFiltrosDaIa(PEIXE_PERTO)).toEqual(PEIXE_PERTO);
  });

  test('valores desconhecidos ou absurdos passam a null (a IA pode enganar-se)', () => {
    expect(limparFiltrosDaIa({ categoria: 'pizza', etiqueta: 'sem-sal', precoMax: 1000, raioKm: -2, pesquisa: '   ' })).toEqual(NADA);
    expect(limparFiltrosDaIa({ precoMax: 'barato', raioKm: 'perto' })).toEqual(NADA);
    expect(limparFiltrosDaIa(null)).toEqual(NADA);
  });

  test('preço com 2 casas decimais e raio arredondado para a distância seguinte dos filtros', () => {
    expect(limparFiltrosDaIa({ precoMax: '7.499', raioKm: 3 })).toEqual({ ...NADA, precoMax: 7.5, raioKm: 5 });
    expect(limparFiltrosDaIa({ raioKm: 50 })).toEqual({ ...NADA, raioKm: 10 });
  });

  test('a pesquisa fica com 40 letras no máximo', () => {
    expect(limparFiltrosDaIa({ pesquisa: 'a'.repeat(100) }).pesquisa).toHaveLength(40);
  });

  test('temAlgumFiltro diz se a IA percebeu alguma coisa', () => {
    expect(temAlgumFiltro(PEIXE_PERTO)).toBe(true);
    expect(temAlgumFiltro(NADA)).toBe(false);
  });
});

describe('interpretarPesquisaSemIa — o plano B, com regras simples', () => {
  test('categoria, preço e "aqui perto"', () => {
    expect(interpretarPesquisaSemIa('peixe até 8 € aqui perto')).toEqual(PEIXE_PERTO);
  });

  test('um prato concreto vai para a pesquisa; "barato" quer dizer até 8 €', () => {
    expect(interpretarPesquisaSemIa('Apetece-me uma francesinha barata')).toEqual({ ...NADA, precoMax: 8, pesquisa: 'francesinha' });
  });

  test('"até 3 km" é uma distância, não um preço; "sem carne" é vegetariano', () => {
    expect(interpretarPesquisaSemIa('algo sem carne até 3 km')).toEqual({ ...NADA, categoria: 'vegetariano', raioKm: 5 });
  });

  test('"vegano", "sem glúten", "sem lactose" e "picante" são etiquetas dos pratos', () => {
    expect(interpretarPesquisaSemIa('algo vegano até 3 km')).toEqual({ ...NADA, etiqueta: 'vegano', raioKm: 5 });
    expect(interpretarPesquisaSemIa('uma francesinha sem glúten')).toEqual({ ...NADA, etiqueta: 'sem-gluten', pesquisa: 'francesinha' });
    expect(interpretarPesquisaSemIa('sobremesa sem lactose')).toEqual({ ...NADA, categoria: 'sobremesa', etiqueta: 'sem-lactose' });
    expect(interpretarPesquisaSemIa('carne picante')).toEqual({ ...NADA, categoria: 'carne', etiqueta: 'picante' });
  });

  test('preço com vírgula e "euros" por extenso', () => {
    expect(interpretarPesquisaSemIa('sopa por menos de 4,50 euros')).toEqual({ ...NADA, categoria: 'sopa', precoMax: 4.5 });
  });

  test('percebe sem acentos, mas pesquisa como está escrito nos menus (com acentos)', () => {
    expect(interpretarPesquisaSemIa('SALMAO grelhado').pesquisa).toBe('salmão');
    expect(interpretarPesquisaSemIa('rojões à minhota').pesquisa).toBe('rojões');
  });

  test('"longe" alarga a procura para 10 km', () => {
    expect(interpretarPesquisaSemIa('uma sobremesa, mesmo que seja longe')).toEqual({ ...NADA, categoria: 'sobremesa', raioKm: 10 });
  });

  test('não percebeu nada: devolve null', () => {
    expect(interpretarPesquisaSemIa('olá, bom dia')).toBeNull();
    expect(interpretarPesquisaSemIa('')).toBeNull();
  });
});

describe('descreverFiltros — o que se mostra ao cliente', () => {
  test('categoria, preço e distância', () => {
    expect(descreverFiltros(PEIXE_PERTO)).toBe('Peixe · até 8,00 € · até 1 km');
  });

  test('pesquisa por um prato', () => {
    expect(descreverFiltros({ ...NADA, pesquisa: 'francesinha', precoMax: 8 })).toBe('«francesinha» · até 8,00 €');
  });

  test('etiqueta', () => {
    expect(descreverFiltros({ ...NADA, etiqueta: 'sem-gluten', raioKm: 2 })).toBe('Sem glúten · até 2 km');
  });
});

describe('interpretarPesquisa — pergunta à IA e, se falhar, usa o plano B', () => {
  test('com a IA: envia a frase e devolve os filtros confirmados', async () => {
    mockEstado.resposta = { data: { ...PEIXE_PERTO, extra: 'ignorado' }, error: null };
    await expect(interpretarPesquisa('  peixe até 8 euros aqui perto ')).resolves.toEqual({ filtros: PEIXE_PERTO, comIa: true });
    expect(mockEstado.pedidos).toEqual([
      { nome: 'assistente', opcoes: { body: { tarefa: 'interpretar-pesquisa', texto: 'peixe até 8 euros aqui perto' } } },
    ]);
  });

  test('sem rede: percebe na mesma, com as regras do telemóvel', async () => {
    mockEstado.resposta = { data: null, error: semRede() };
    await expect(interpretarPesquisa('peixe até 8 € aqui perto')).resolves.toEqual({ filtros: PEIXE_PERTO, comIa: false });
  });

  test('limite gratuito da IA atingido: também usa o plano B', async () => {
    mockEstado.resposta = { data: null, error: erroDaFuncao(429, { erro: 'O limite gratuito do assistente foi atingido.' }) };
    const { filtros, comIa } = await interpretarPesquisa('francesinha barata');
    expect(comIa).toBe(false);
    expect(filtros.pesquisa).toBe('francesinha');
  });

  test('ninguém percebeu: explica com um exemplo', async () => {
    mockEstado.resposta = { data: NADA, error: null };
    await expect(interpretarPesquisa('olá, bom dia')).rejects.toThrow('Não percebi. Experimenta, por exemplo: "peixe até 8 € aqui perto".');
  });

  test('frase vazia: nem chega a perguntar à IA', async () => {
    await expect(interpretarPesquisa('  ')).rejects.toThrow(/Escreve o que te apetece/);
    expect(mockEstado.pedidos).toHaveLength(0);
  });
});

describe('traduzirPratos — o menu em inglês', () => {
  test('envia os nomes e devolve as traduções pela mesma ordem', async () => {
    mockEstado.resposta = { data: { traducoes: [' Caldo verde (kale and potato soup) ', 'Cod'] }, error: null };
    await expect(traduzirPratos(['Caldo verde', 'Bacalhau'])).resolves.toEqual(['Caldo verde (kale and potato soup)', 'Cod']);
    expect(mockEstado.pedidos[0]).toEqual({
      nome: 'assistente',
      opcoes: { body: { tarefa: 'traduzir-pratos', pratos: ['Caldo verde', 'Bacalhau'] } },
    });
  });

  test('resposta com outro número de pratos: não mostra traduções trocadas', async () => {
    mockEstado.resposta = { data: { traducoes: ['Kale soup'] }, error: null };
    await expect(traduzirPratos(['Caldo verde', 'Bacalhau'])).rejects.toThrow('Não foi possível traduzir o menu. Tenta outra vez.');
  });

  test('função ainda não publicada', async () => {
    mockEstado.resposta = { data: null, error: erroDaFuncao(404, { code: 'NOT_FOUND' }) };
    await expect(traduzirPratos(['Caldo verde'])).rejects.toThrow('A tradução ainda não está ativada.');
  });

  test('a mensagem da função chega ao cliente (por exemplo, o limite gratuito)', async () => {
    const erro = 'O limite gratuito do assistente foi atingido. Tenta daqui a um minuto.';
    mockEstado.resposta = { data: null, error: erroDaFuncao(429, { erro }) };
    await expect(traduzirPratos(['Caldo verde'])).rejects.toThrow(erro);
  });

  test('sem rede', async () => {
    mockEstado.resposta = { data: null, error: semRede() };
    await expect(traduzirPratos(['Caldo verde'])).rejects.toThrow('Sem ligação à internet. Verifica a rede e tenta outra vez.');
  });
});

describe('PesquisaComIa — o painel "Diz o que te apetece"', () => {
  async function procurar(frase) {
    await fireEvent.changeText(screen.getByLabelText('Diz o que te apetece'), frase);
    await fireEvent.press(screen.getByRole('button', { name: 'Procurar com o assistente' }));
  }

  test('aplica os filtros que percebeu e mostra-os ao cliente', async () => {
    mockEstado.resposta = { data: PEIXE_PERTO, error: null };
    const aoAplicar = jest.fn();
    await render(<PesquisaComIa aoAplicar={aoAplicar} />);
    await procurar('peixe até 8 euros aqui perto');
    expect(await screen.findByText('Percebi: Peixe · até 8,00 € · até 1 km')).toBeTruthy();
    expect(aoAplicar).toHaveBeenCalledWith(PEIXE_PERTO);
  });

  test('sem IA: diz que percebeu sem a IA', async () => {
    mockEstado.resposta = { data: null, error: semRede() };
    const aoAplicar = jest.fn();
    await render(<PesquisaComIa aoAplicar={aoAplicar} />);
    await procurar('francesinha barata');
    expect(await screen.findByText('Percebi: «francesinha» · até 8,00 € (sem IA)')).toBeTruthy();
    expect(aoAplicar).toHaveBeenCalledWith({ ...NADA, precoMax: 8, pesquisa: 'francesinha' });
  });

  test('não percebeu: mostra um exemplo e não mexe nos filtros', async () => {
    mockEstado.resposta = { data: NADA, error: null };
    const aoAplicar = jest.fn();
    await render(<PesquisaComIa aoAplicar={aoAplicar} />);
    await procurar('olá');
    expect(await screen.findByText(/Não percebi/)).toBeTruthy();
    expect(aoAplicar).not.toHaveBeenCalled();
  });

  test('explica que o texto é enviado para a IA (transparência)', async () => {
    await render(<PesquisaComIa aoAplicar={jest.fn()} />);
    expect(screen.getByText(/Usa inteligência artificial/)).toBeTruthy();
  });
});
