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
      parametros: { lat: 41.15, lng: -8.61, raio_km: 2, preco_max: null, categoria_filtro: null, pesquisa: null, etiqueta_filtro: null },
    });
  });

  test('os filtros vão para a base de dados, que é quem filtra (RNF05)', async () => {
    await p.buscarPratosPerto({ latitude: 41.15, longitude: -8.61, raioKm: 5, precoMax: 8, categoria: 'peixe', pesquisa: '  bacalhau ', etiqueta: 'sem-gluten' });
    expect(mockBd.pedido.parametros).toEqual({
      lat: 41.15,
      lng: -8.61,
      raio_km: 5,
      preco_max: 8,
      categoria_filtro: 'peixe',
      pesquisa: 'bacalhau',
      etiqueta_filtro: 'sem-gluten',
    });
  });

  test('os pratos chegam já pela ordem da lista (principais antes da sopa e da sobremesa)', async () => {
    const PUDIM = { ...TASCA, prato_id: 'p9', prato: 'Pudim', categoria: 'sobremesa', preco: 2, esgotado: false };
    mockBd.resposta = { data: [PUDIM, SOPA, BACALHAU], error: null }; // a base de dados ordena só por distância
    const pratos = await p.buscarPratosPerto({ latitude: 41.15, longitude: -8.61 });
    expect(pratos.map((prato) => prato.prato)).toEqual(['Bacalhau à Brás', 'Caldo verde', 'Pudim']);
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

describe('ordenarPratosDaLista (RF05: a ordem da lista)', () => {
  const nomes = (lista) => lista.map((prato) => prato.prato);
  const PUDIM = { ...TASCA, prato_id: 'p4', prato: 'Pudim', categoria: 'sobremesa', preco: 1, esgotado: false };
  const COGUMELOS = { ...TASCA, prato_id: 'p5', prato: 'Risotto de cogumelos', categoria: 'vegetariano', preco: 9, esgotado: false };

  test('no mesmo restaurante: principais (do mais barato ao mais caro), depois a sopa e por fim a sobremesa', () => {
    expect(nomes(p.ordenarPratosDaLista([PUDIM, SOPA, COGUMELOS, BACALHAU]))).toEqual([
      'Bacalhau à Brás',
      'Risotto de cogumelos',
      'Caldo verde',
      'Pudim',
    ]);
  });

  test('a distância vem antes da categoria: uma sobremesa mais perto aparece antes de um prato mais longe', () => {
    expect(nomes(p.ordenarPratosDaLista([FRANCESINHA, PUDIM].map((prato) => ({ ...prato, esgotado: false }))))).toEqual([
      'Pudim',
      'Francesinha',
    ]);
  });

  test('os esgotados vão sempre para o fim', () => {
    const bacalhauEsgotado = { ...BACALHAU, esgotado: true };
    expect(nomes(p.ordenarPratosDaLista([bacalhauEsgotado, PUDIM, SOPA]))).toEqual(['Caldo verde', 'Pudim', 'Bacalhau à Brás']);
  });

  test('não altera a lista que recebe', () => {
    const lista = [PUDIM, BACALHAU];
    p.ordenarPratosDaLista(lista);
    expect(nomes(lista)).toEqual(['Pudim', 'Bacalhau à Brás']);
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

describe('ordenarPorPreco (RF07: mais barato primeiro)', () => {
  test('do mais barato para o mais caro, com os esgotados no fim', () => {
    const francesinhaDisponivel = { ...FRANCESINHA, esgotado: false };
    const sopaEsgotada = { ...SOPA, esgotado: true };
    const lista = [francesinhaDisponivel, BACALHAU, sopaEsgotada];
    expect(p.ordenarPorPreco(lista).map((prato) => prato.prato)).toEqual(['Bacalhau à Brás', 'Francesinha', 'Caldo verde']);
    expect(lista[0]).toBe(francesinhaDisponivel); // a lista original não muda
  });

  test('a preço igual, o mais perto primeiro', () => {
    const longe = { ...FRANCESINHA, esgotado: false, preco: 8.5 };
    expect(p.ordenarPorPreco([longe, BACALHAU]).map((prato) => prato.prato)).toEqual(['Bacalhau à Brás', 'Francesinha']);
  });
});

describe('almocoMaisBarato (destaque no Início)', () => {
  const FRANCESINHA_ESGOTADA = { ...FRANCESINHA, esgotado: true };
  test('o prato principal disponível mais barato; a sopa e os esgotados não contam', () => {
    const barato = { ...CAFE, prato_id: 'p7', prato: 'Feijoada', categoria: 'carne', preco: 6.5, esgotado: false };
    const sobremesa = { ...TASCA, prato_id: 'p8', prato: 'Pudim', categoria: 'sobremesa', preco: 1, esgotado: false };
    const esgotadoBarato = { ...TASCA, prato_id: 'p9', prato: 'Bitoque', categoria: 'carne', preco: 5, esgotado: true };
    expect(p.almocoMaisBarato([SOPA, BACALHAU, barato, sobremesa, esgotadoBarato]).prato).toBe('Feijoada');
  });

  test('sem pratos principais disponíveis devolve null', () => {
    expect(p.almocoMaisBarato([SOPA, FRANCESINHA_ESGOTADA])).toBeNull();
    expect(p.almocoMaisBarato([])).toBeNull();
  });
});

describe('Abana para decidir: pratosParaSortear e escolherAoAcaso', () => {
  const FRANCESINHA_ESGOTADA = { ...FRANCESINHA, esgotado: true };
  test('sorteia só entre os pratos principais disponíveis', () => {
    expect(p.pratosParaSortear([SOPA, BACALHAU, FRANCESINHA_ESGOTADA]).map((prato) => prato.prato)).toEqual(['Bacalhau à Brás']);
  });

  test('se não houver principais, serve qualquer prato disponível', () => {
    expect(p.pratosParaSortear([SOPA, FRANCESINHA_ESGOTADA]).map((prato) => prato.prato)).toEqual(['Caldo verde']);
  });

  test('escolherAoAcaso usa o número aleatório para escolher a posição', () => {
    const outro = { ...CAFE, prato_id: 'p7', prato: 'Feijoada', categoria: 'carne', preco: 6.5, esgotado: false };
    const lista = [BACALHAU, outro];
    expect(p.escolherAoAcaso(lista, () => 0).prato).toBe('Bacalhau à Brás');
    expect(p.escolherAoAcaso(lista, () => 0.99).prato).toBe('Feijoada');
    expect(p.escolherAoAcaso(lista, () => 1).prato).toBe('Feijoada'); // nunca passa do fim da lista
  });

  test('sem pratos disponíveis devolve null', () => {
    expect(p.escolherAoAcaso([FRANCESINHA_ESGOTADA])).toBeNull();
  });
});

describe('ouvirPratosNovos (aviso dos favoritos)', () => {
  test('ouve os pratos novos (INSERT) num canal só seu e entrega a linha nova', () => {
    const recebidos = [];
    const parar = p.ouvirPratosNovos((prato) => recebidos.push(prato));
    const canal = mockBd.canais.at(-1);
    expect(canal.oQueOuve).toEqual({ event: 'INSERT', schema: 'public', table: 'pratos' });
    expect(canal.nome).toMatch(/^pratos-novos-/);

    canal.aoMudar({ new: { id: 'p1', menu_id: 'm1' } });
    expect(recebidos).toEqual([{ id: 'p1', menu_id: 'm1' }]);
    parar();
    expect(mockBd.removidos).toContain(canal.nome);
  });
});

describe('etiquetas dos pratos', () => {
  test('descreverEtiquetas: pela ordem de ETIQUETAS, em português ou em inglês', () => {
    expect(p.descreverEtiquetas(['picante', 'vegano'])).toBe('Vegano · Picante');
    expect(p.descreverEtiquetas(['sem-gluten', 'sem-lactose'], { emIngles: true })).toBe('Gluten-free · Lactose-free');
    expect(p.descreverEtiquetas(['desconhecida'])).toBe('');
    expect(p.descreverEtiquetas(null)).toBe('');
  });

  test('as etiquetas da app são as mesmas que a base de dados aceita', () => {
    expect(p.ETIQUETAS.map((etiqueta) => etiqueta.valor)).toEqual(['vegano', 'sem-gluten', 'sem-lactose', 'picante']);
  });
});

describe('tempo real: últimas doses e lotação', () => {
  const DA_TASCA = { prato_id: 'x1', prato: 'Rojões', categoria: 'carne', preco: 8, esgotado: false, ultimas_doses: false, menu_id: 'm1', distancia_km: 0.3 };
  const DO_CAFE = { prato_id: 'x2', prato: 'Tosta mista', categoria: 'carne', preco: 4, esgotado: false, ultimas_doses: false, menu_id: 'm2', distancia_km: 1 };

  test('aplicarAlteracaoDePrato também muda as últimas doses, as etiquetas e a fotografia', () => {
    const [rojoes] = p.aplicarAlteracaoDePrato([DA_TASCA], { id: 'x1', ultimas_doses: true, etiquetas: ['picante'], foto_url: 'https://fotos/r.jpg' });
    expect(rojoes).toMatchObject({ ultimas_doses: true, etiquetas: ['picante'], foto_url: 'https://fotos/r.jpg' });
    const [semFoto] = p.aplicarAlteracaoDePrato([{ ...DA_TASCA, foto_url: 'https://fotos/r.jpg' }], { id: 'x1', foto_url: null });
    expect(semFoto.foto_url).toBeNull(); // a fotografia foi tirada
  });

  test('aplicarAlteracaoDeMenu muda a lotação de todos os pratos desse menu, e só desse', () => {
    const lista = [DA_TASCA, { ...DA_TASCA, prato_id: 'x3' }, DO_CAFE];
    const nova = p.aplicarAlteracaoDeMenu(lista, { id: 'm1', lotacao: 'cheio', lotacao_em: '2026-11-18T12:30:00Z' });
    expect(nova.map((prato) => prato.lotacao ?? null)).toEqual(['cheio', 'cheio', null]);
    expect(nova[0].lotacao_em).toBe('2026-11-18T12:30:00Z');
  });

  test('aplicarAlteracaoDeMenu: um menu que não está na lista devolve a MESMA lista (o ecrã nem se redesenha)', () => {
    const lista = [DA_TASCA];
    expect(p.aplicarAlteracaoDeMenu(lista, { id: 'm9', lotacao: 'cheio' })).toBe(lista);
    expect(p.aplicarAlteracaoDeMenu(lista, null)).toBe(lista);
  });

  test('agruparPorRestaurante leva a lotação para o marcador do mapa', () => {
    const comLotacao = { ...DA_TASCA, restaurante_id: 'r1', restaurante: 'Tasca', lotacao: 'ha-mesa', lotacao_em: '2026-11-18T12:30:00Z' };
    const [grupo] = p.agruparPorRestaurante([comLotacao]);
    expect(grupo).toMatchObject({ lotacao: 'ha-mesa', lotacao_em: '2026-11-18T12:30:00Z' });
  });
});

describe('filtroDeTempoReal', () => {
  test('um id, vários ids, nenhum ou demasiados', () => {
    expect(p.filtroDeTempoReal('menu_id', ['m1'])).toBe('menu_id=eq.m1');
    expect(p.filtroDeTempoReal('menu_id', ['m1', 'm2'])).toBe('menu_id=in.(m1,m2)');
    expect(p.filtroDeTempoReal('menu_id', [])).toBeNull();
    expect(p.filtroDeTempoReal('menu_id', null)).toBeNull();
    const muitos = Array.from({ length: 101 }, (_item, indice) => `m${indice}`);
    expect(p.filtroDeTempoReal('menu_id', muitos)).toBeNull(); // o Supabase só aceita 100: ouve-se tudo
  });
});
