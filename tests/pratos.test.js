import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import * as p from '@/services/pratos';

// RF05 / RF06 / RF07 — testes ao serviço src/services/pratos.js. Correr com: npm test
// O Supabase é substituído por uma imitação que regista o que lhe foi pedido.

const mockBd = {
  resposta: { data: [], error: null }, // o que a função pratos_perto responde
  pedido: null, // o último pedido feito à função
  canais: [], // os canais de tempo real criados
  removidos: [],
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async (nome, parametros) => {
      mockBd.pedido = { nome, parametros };
      return mockBd.resposta;
    },
    channel: (nome) => {
      const canal = { nome, oQueOuve: null, aoMudar: null };
      canal.on = (_tipo, oQueOuve, aoMudar) => {
        canal.oQueOuve = oQueOuve;
        canal.aoMudar = aoMudar;
        return canal;
      };
      canal.subscribe = () => canal;
      mockBd.canais.push(canal);
      return canal;
    },
    removeChannel: (canal) => mockBd.removidos.push(canal.nome),
  },
}));

const TASCA = { restaurante_id: 'r1', restaurante: 'Tasca do Manuel', latitude: 41.15, longitude: -8.61, distancia_km: 0.35 };
const CAFE = { restaurante_id: 'r2', restaurante: 'Café Central', latitude: 41.16, longitude: -8.62, distancia_km: 1.4 };
const BACALHAU = { ...TASCA, prato_id: 'p1', prato: 'Bacalhau à Brás', categoria: 'peixe', preco: 8.5, esgotado: false };
const SOPA = { ...TASCA, prato_id: 'p2', prato: 'Caldo verde', categoria: 'sopa', preco: 1.8, esgotado: false };
const FRANCESINHA = { ...CAFE, prato_id: 'p3', prato: 'Francesinha', categoria: 'carne', preco: 9.5, esgotado: false };

beforeEach(() => {
  Object.assign(mockBd, { resposta: { data: [], error: null }, pedido: null, canais: [], removidos: [] });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('buscarPratosPerto (RF05, RF07)', () => {
  test('por omissão procura num raio de 2 km e sem filtros', async () => {
    mockBd.resposta = { data: [BACALHAU], error: null };
    await expect(p.buscarPratosPerto({ latitude: 41.15, longitude: -8.61 })).resolves.toEqual([BACALHAU]);
    expect(mockBd.pedido).toEqual({
      nome: 'pratos_perto',
      parametros: { lat: 41.15, lng: -8.61, raio_km: 2, preco_max: null, categoria_filtro: null, pesquisa: null },
    });
  });

  test('os filtros vão para a base de dados, que é quem filtra (RNF05)', async () => {
    await p.buscarPratosPerto({ latitude: 41.15, longitude: -8.61, raioKm: 5, precoMax: 8, categoria: 'peixe', pesquisa: '  bacalhau ' });
    expect(mockBd.pedido.parametros).toEqual({ lat: 41.15, lng: -8.61, raio_km: 5, preco_max: 8, categoria_filtro: 'peixe', pesquisa: 'bacalhau' });
  });

  test('pesquisa só com espaços conta como não haver pesquisa', async () => {
    await p.buscarPratosPerto({ latitude: 41.15, longitude: -8.61, pesquisa: '   ' });
    expect(mockBd.pedido.parametros.pesquisa).toBeNull();
  });

  test('sem pratos devolve uma lista vazia, nunca null', async () => {
    mockBd.resposta = { data: null, error: null };
    await expect(p.buscarPratosPerto({ latitude: 41.15, longitude: -8.61 })).resolves.toEqual([]);
  });

  test('sem rede, a mensagem vem em português', async () => {
    mockBd.resposta = { data: null, error: { message: 'TypeError: Network request failed' } };
    await expect(p.buscarPratosPerto({ latitude: 41.15, longitude: -8.61 })).rejects.toThrow('Sem ligação à internet');
  });
});

describe('agruparPorRestaurante (RF06: um marcador por restaurante)', () => {
  test('junta os pratos do mesmo restaurante e ordena do mais perto para o mais longe', () => {
    const grupos = p.agruparPorRestaurante([FRANCESINHA, BACALHAU, SOPA]);
    expect(grupos.map((grupo) => grupo.nome)).toEqual(['Tasca do Manuel', 'Café Central']);
    expect(grupos[0]).toMatchObject({ id: 'r1', latitude: 41.15, longitude: -8.61, distanciaKm: 0.35, disponiveis: 2, precoMinimo: 1.8 });
    expect(grupos[0].pratos).toEqual([BACALHAU, SOPA]);
  });

  test('os pratos esgotados não contam para o preço mais baixo', () => {
    const [tasca] = p.agruparPorRestaurante([BACALHAU, { ...SOPA, esgotado: true }]);
    expect(tasca).toMatchObject({ disponiveis: 1, precoMinimo: 8.5 });
    expect(tasca.pratos).toHaveLength(2); // continuam a aparecer na lista do restaurante
  });

  test('com tudo esgotado não há preço mais baixo', () => {
    const [cafe] = p.agruparPorRestaurante([{ ...FRANCESINHA, esgotado: true }]);
    expect(cafe).toMatchObject({ disponiveis: 0, precoMinimo: null });
  });

  test('o preço pode vir da base de dados como texto', () => {
    const [tasca] = p.agruparPorRestaurante([{ ...BACALHAU, preco: '8.50' }, { ...SOPA, preco: '10.00' }]);
    expect(tasca.precoMinimo).toBe(8.5); // compara números: "10.00" não é menor do que "8.50"
  });

  test('sem pratos não há restaurantes', () => {
    expect(p.agruparPorRestaurante([])).toEqual([]);
    expect(p.agruparPorRestaurante(null)).toEqual([]);
  });
});

describe('aplicarAlteracaoDePrato (RF04 visto pelo cliente)', () => {
  const lista = [SOPA, BACALHAU, FRANCESINHA];

  test('um prato que fica esgotado muda e vai para o fim da lista', () => {
    const nova = p.aplicarAlteracaoDePrato(lista, { id: 'p2', nome: 'Caldo verde', categoria: 'sopa', preco: 1.8, esgotado: true });
    expect(nova.map((prato) => prato.prato_id)).toEqual(['p1', 'p3', 'p2']);
    expect(nova[2].esgotado).toBe(true);
    expect(lista[0].esgotado).toBe(false); // a lista original não é alterada
  });

  test('um prato que volta a estar disponível regressa ao seu lugar, por distância', () => {
    const comEsgotado = [BACALHAU, FRANCESINHA, { ...SOPA, esgotado: true }];
    const nova = p.aplicarAlteracaoDePrato(comEsgotado, { id: 'p2', esgotado: false });
    expect(nova.map((prato) => prato.prato_id)).toEqual(['p1', 'p2', 'p3']);
  });

  test('também acompanha uma mudança de nome ou de preço', () => {
    const nova = p.aplicarAlteracaoDePrato(lista, { id: 'p1', nome: 'Bacalhau com natas', categoria: 'peixe', preco: 9, esgotado: false });
    expect(nova.find((prato) => prato.prato_id === 'p1')).toMatchObject({ prato: 'Bacalhau com natas', preco: 9, restaurante: 'Tasca do Manuel' });
  });

  test('um prato que não está na lista devolve a mesma lista (o ecrã nem é redesenhado)', () => {
    expect(p.aplicarAlteracaoDePrato(lista, { id: 'outro', esgotado: true })).toBe(lista);
    expect(p.aplicarAlteracaoDePrato(lista, null)).toBe(lista);
  });
});

describe('ouvirAlteracoesPratos (tempo real)', () => {
  test('cada ecrã fica com um canal só seu e recebe a linha alterada', () => {
    const recebidos = [];
    const pararPrimeiro = p.ouvirAlteracoesPratos((prato) => recebidos.push(prato));
    p.ouvirAlteracoesPratos(() => {});

    const [primeiro, segundo] = mockBd.canais;
    expect(primeiro.nome).not.toBe(segundo.nome); // dois canais com o mesmo nome davam erro no Supabase
    expect(primeiro.oQueOuve).toEqual({ event: 'UPDATE', schema: 'public', table: 'pratos' });

    primeiro.aoMudar({ new: { id: 'p1', esgotado: true } });
    expect(recebidos).toEqual([{ id: 'p1', esgotado: true }]);

    pararPrimeiro();
    expect(mockBd.removidos).toEqual([primeiro.nome]);
  });

  test('com menuId só ouve os pratos desse menu', () => {
    p.ouvirAlteracoesPratos(() => {}, { menuId: 'm1' });
    expect(mockBd.canais[0].oQueOuve.filter).toBe('menu_id=eq.m1');
  });
});

describe('textos para o ecrã', () => {
  test('formatarPreco usa vírgula e duas casas decimais (RN03)', () => {
    expect(p.formatarPreco(8.5)).toBe('8,50 €');
    expect(p.formatarPreco('7')).toBe('7,00 €');
  });

  test('formatarDistancia usa metros abaixo de 1 km', () => {
    expect(p.formatarDistancia(0.35)).toBe('350 m');
    expect(p.formatarDistancia(1.44)).toBe('1,4 km');
  });
});
