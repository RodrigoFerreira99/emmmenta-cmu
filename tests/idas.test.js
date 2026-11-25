import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { TopDaSemana } from '@/components/TopDaSemana';
import { VouAlmocarAqui } from '@/components/VouAlmocarAqui';
import { restaurantesDoMapa } from '@/lib/mapaDeCalor';
import {
  buscarMinhaIdaDeHoje,
  buscarPopularidade,
  descreverIdasDaSemana,
  descreverIdasDeHoje,
  desmarcarIda,
  marcarIda,
  ordenarPorPopularidade,
  topDaSemana,
} from '@/services/idas';

// Ranking dos restaurantes entre os estudantes ("Vou almoçar aqui") — testes a src/services/idas.js,
// ao botão VouAlmocarAqui, ao TopDaSemana e ao calor do mapa. A base de dados é simulada. Correr com: npm test

const mockBase = { rpc: [], respostaRpc: { data: null, error: null }, minhaIda: null, filtros: {} };
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async (nome, argumentos) => {
      mockBase.rpc.push({ nome, argumentos });
      return typeof mockBase.respostaRpc === 'function' ? mockBase.respostaRpc(nome, argumentos) : mockBase.respostaRpc;
    },
    from: () => ({
      select: () => ({
        eq: (coluna, valor) => {
          mockBase.filtros[coluna] = valor;
          return { maybeSingle: async () => ({ data: mockBase.minhaIda ? { restaurante_id: mockBase.minhaIda } : null, error: null }) };
        },
      }),
    }),
  },
}));
jest.mock('@/lib/vibrar', () => ({ vibrarSucesso: jest.fn(), vibrarLeve: jest.fn(), vibrarSelecao: jest.fn() }));

const prato = (restaurante, distancia, extra = {}) => ({
  prato_id: `${restaurante}-${extra.prato ?? 'x'}`,
  prato: extra.prato ?? 'Bitoque',
  categoria: 'carne',
  restaurante_id: restaurante,
  restaurante: `Restaurante ${restaurante}`,
  latitude: 41.36,
  longitude: -8.73,
  distancia_km: distancia,
  esgotado: false,
  preco: 8,
  ...extra,
});
const POPULARIDADE = new Map([
  ['longe', { hoje: 6, semana: 30 }],
  ['perto', { hoje: 1, semana: 4 }],
]);

beforeEach(() => {
  mockBase.rpc = [];
  mockBase.respostaRpc = { data: null, error: null };
  mockBase.minhaIda = null;
  mockBase.filtros = {};
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('textos', () => {
  test('hoje e semana, no singular e no plural; com 0 não se diz nada', () => {
    expect(descreverIdasDeHoje(1)).toBe('1 estudante vai almoçar aqui hoje');
    expect(descreverIdasDeHoje(12)).toBe('12 estudantes vão almoçar aqui hoje');
    expect(descreverIdasDeHoje(0)).toBeNull();
    expect(descreverIdasDaSemana(1)).toBe('1 estudante esta semana');
    expect(descreverIdasDaSemana(34)).toBe('34 estudantes esta semana');
    expect(descreverIdasDaSemana(undefined)).toBeNull();
  });
});

describe('ordem "Mais populares" e Top da semana', () => {
  const PRATOS = [prato('perto', 0.2), prato('longe', 1.5), prato('sem-idas', 0.4), prato('esgotado', 0.1, { esgotado: true })];

  test('mais estudantes primeiro; sem idas, pela distância; esgotados no fim', () => {
    expect(ordenarPorPopularidade(PRATOS, POPULARIDADE).map((p) => p.restaurante_id)).toEqual(['longe', 'perto', 'sem-idas', 'esgotado']);
  });

  test('o Top da semana só tem restaurantes com idas e algum prato disponível, do mais procurado para o menos', () => {
    const top = topDaSemana(PRATOS, new Map([...POPULARIDADE, ['esgotado', { hoje: 9, semana: 99 }]]));
    expect(top.map((r) => [r.id, r.semana, r.hoje])).toEqual([
      ['longe', 30, 6],
      ['perto', 4, 1],
    ]);
    expect(top[0].prato.prato).toBe('Bitoque'); // o prato que dá a imagem
    expect(topDaSemana(PRATOS, new Map())).toEqual([]);
  });
});

describe('base de dados', () => {
  test('buscarPopularidade pede os números de cada restaurante (sem repetir ids) e devolve um Map', async () => {
    mockBase.respostaRpc = { data: [{ restaurante_id: 'r1', hoje: 2, semana: 9 }], error: null };
    const mapa = await buscarPopularidade(['r1', 'r1', 'r2', null]);
    expect(mockBase.rpc).toEqual([{ nome: 'popularidade_dos_restaurantes', argumentos: { ids: ['r1', 'r2'] } }]);
    expect(mapa.get('r1')).toEqual({ hoje: 2, semana: 9 });
    expect(mapa.has('r2')).toBe(false);
    await expect(buscarPopularidade([])).resolves.toEqual(new Map()); // sem restaurantes, nem pergunta
    expect(mockBase.rpc).toHaveLength(1);
  });

  test('marcar, desmarcar e ler a minha ida de hoje (o dia é o de hoje em Lisboa)', async () => {
    await marcarIda('r1');
    await desmarcarIda();
    expect(mockBase.rpc.map((c) => c.nome)).toEqual(['marcar_ida', 'desmarcar_ida']);
    expect(mockBase.rpc[0].argumentos).toEqual({ restaurante: 'r1' });
    mockBase.minhaIda = 'r1';
    await expect(buscarMinhaIdaDeHoje()).resolves.toBe('r1');
    expect(mockBase.filtros.dia).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('um erro da base de dados chega em português', async () => {
    mockBase.respostaRpc = { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } };
    await expect(marcarIda('r1')).rejects.toThrow(Error);
  });
});

describe('VouAlmocarAqui (página do restaurante)', () => {
  test('mostra quantos vão, marca com um toque (o número sobe) e desmarca com outro', async () => {
    mockBase.respostaRpc = (nome) => (nome === 'popularidade_dos_restaurantes' ? { data: [{ restaurante_id: 'r1', hoje: 5, semana: 25 }], error: null } : { data: null, error: null });
    await render(<VouAlmocarAqui restauranteId="r1" />);
    expect(await screen.findByText(/^5 estudantes vão almoçar aqui hoje/)).toBeTruthy();
    expect(screen.getByText(/25 estudantes esta semana/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Vou almoçar aqui hoje' }));
    expect(await screen.findByText(/^6 estudantes vão almoçar aqui hoje/)).toBeTruthy();
    expect(mockBase.rpc.at(-1)).toEqual({ nome: 'marcar_ida', argumentos: { restaurante: 'r1' } });

    await fireEvent.press(screen.getByRole('button', { name: 'Vais almoçar aqui hoje. Tocar para desmarcar' }));
    expect(await screen.findByText(/^5 estudantes vão almoçar aqui hoje/)).toBeTruthy();
    expect(mockBase.rpc.at(-1).nome).toBe('desmarcar_ida');
  });

  test('se a base de dados recusar, volta atrás e explica', async () => {
    mockBase.respostaRpc = (nome) =>
      nome === 'marcar_ida' ? { data: null, error: { message: 'Failed to fetch' } } : { data: [], error: null };
    await render(<VouAlmocarAqui restauranteId="r1" />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Vou almoçar aqui hoje' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Ainda ninguém disse que vem cá almoçar hoje')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vou almoçar aqui hoje' })).toBeTruthy();
  });

  test('se hoje já ia a outro restaurante, avisa que tocar muda a ida', async () => {
    mockBase.minhaIda = 'outro';
    mockBase.respostaRpc = { data: [], error: null };
    await render(<VouAlmocarAqui restauranteId="r1" />);
    expect(await screen.findByText(/Hoje já disseste que ias a outro sítio/)).toBeTruthy();
  });
});

describe('TopDaSemana e o calor do mapa', () => {
  test('o Top mostra o lugar, o nome e os números, e abre o restaurante ao tocar', async () => {
    const aoAbrir = jest.fn();
    const top = topDaSemana([prato('perto', 0.2), prato('longe', 1.5)], POPULARIDADE);
    await render(<TopDaSemana lista={top} aoAbrir={aoAbrir} />);
    expect(screen.getByText('TOP DA SEMANA ENTRE ESTUDANTES')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^1\.º Restaurante longe, 30 estudantes esta semana, 6 hoje/ }));
    expect(aoAbrir).toHaveBeenCalledWith(expect.objectContaining({ id: 'longe' }));
  });

  test('com o ranking, o restaurante mais procurado é o mais quente do mapa (mesmo mais longe)', () => {
    const pratos = [prato('perto', 0.2), prato('longe', 1.5)];
    const semRanking = restaurantesDoMapa(pratos);
    expect(semRanking.find((r) => r.id === 'perto').calor).toBeGreaterThan(semRanking.find((r) => r.id === 'longe').calor);
    const comRanking = restaurantesDoMapa(pratos, POPULARIDADE);
    expect(comRanking.find((r) => r.id === 'longe').calor).toBe(1);
    expect(comRanking.find((r) => r.id === 'perto').calor).toBeLessThan(1);
  });
});
