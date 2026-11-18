import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  arredondarPonto,
  calcularCaminhoAPe,
  caminhoEmLinhaReta,
  descreverCaminho,
  descreverDistancia,
  descreverDuracao,
  distanciaEmMetros,
  lerRespostaDoCaminho,
  regiaoParaOsPontos,
} from '@/services/caminho';

// Caminho a pé até ao restaurante — testes a src/services/caminho.js.
// O serviço de caminhos do OpenStreetMap é simulado (fetch): aqui só se confirma o que a app envia
// (a localização arredondada) e o que faz com a resposta, incluindo o plano B. Correr com: npm test

const ESMAD = { latitude: 41.36662, longitude: -8.73871 };
const TASCA = { latitude: 41.3643, longitude: -8.7375 };

// Uma resposta como a do serviço (OSRM): a linha vem em GeoJSON, com [longitude, latitude].
const RESPOSTA = {
  code: 'Ok',
  routes: [
    {
      distance: 872.4,
      duration: 718,
      geometry: {
        coordinates: [
          [-8.738338, 41.366502],
          [-8.7379, 41.3655],
          [-8.7375, 41.3643],
        ],
      },
    },
  ],
};

const respostaHttp = (corpo, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {}); // os avisos técnicos são esperados nos testes de erro
});
afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

describe('contas e textos', () => {
  test('arredondarPonto: 3 casas decimais (cerca de 100 m)', () => {
    expect(arredondarPonto(ESMAD)).toEqual({ latitude: 41.367, longitude: -8.739 });
    expect(arredondarPonto(ESMAD, 4)).toEqual({ latitude: 41.3666, longitude: -8.7387 });
  });

  test('distanciaEmMetros: da ESMAD à Tasca são cerca de 270 m em linha reta', () => {
    expect(distanciaEmMetros(ESMAD, TASCA)).toBeGreaterThan(250);
    expect(distanciaEmMetros(ESMAD, TASCA)).toBeLessThan(290);
    expect(distanciaEmMetros(ESMAD, ESMAD)).toBe(0);
  });

  test('caminhoEmLinhaReta: estimativa com mais 30 % pelas ruas e pelo menos 1 minuto', () => {
    const caminho = caminhoEmLinhaReta(ESMAD, TASCA);
    expect(caminho.emLinhaReta).toBe(true);
    expect(caminho.pontos).toEqual([ESMAD, TASCA]);
    expect(caminho.distanciaM).toBe(Math.round(distanciaEmMetros(ESMAD, TASCA) * 1.3));
    expect(caminho.duracaoMin).toBe(5);
    expect(caminhoEmLinhaReta(ESMAD, ESMAD).duracaoMin).toBe(1);
  });

  test('descreverDistancia, descreverDuracao e descreverCaminho', () => {
    expect(descreverDistancia(872)).toBe('870 m');
    expect(descreverDistancia(3)).toBe('10 m');
    expect(descreverDistancia(1234)).toBe('1,2 km');
    expect(descreverDuracao(12)).toBe('12 min');
    expect(descreverDuracao(60)).toBe('1 h');
    expect(descreverDuracao(75)).toBe('1 h 15 min');
    expect(descreverCaminho({ distanciaM: 872, duracaoMin: 12, emLinhaReta: false })).toBe('12 min a pé · 870 m');
    expect(descreverCaminho({ distanciaM: 780, duracaoMin: 10, emLinhaReta: true })).toBe('cerca de 10 min a pé · 780 m');
  });
});

describe('regiaoParaOsPontos (a parte do mapa que se vê)', () => {
  test('centra o mapa no caminho e deixa margem à volta', () => {
    const longe = { latitude: 41.35662, longitude: -8.72871 }; // cerca de 1,4 km da ESMAD
    const regiao = regiaoParaOsPontos([ESMAD, longe]);
    expect(regiao.latitude).toBeCloseTo((ESMAD.latitude + longe.latitude) / 2, 6);
    expect(regiao.longitude).toBeCloseTo((ESMAD.longitude + longe.longitude) / 2, 6);
    expect(regiao.latitudeDelta).toBeCloseTo(0.01 * 1.6, 6); // 60 % de margem
    expect(regiao.longitudeDelta).toBeCloseTo(0.01 * 1.6, 6);
  });

  test('com os pontos muito juntos, o mapa não fica colado (mínimo de 0,004 graus)', () => {
    expect(regiaoParaOsPontos([ESMAD, ESMAD])).toEqual({ ...ESMAD, latitudeDelta: 0.004, longitudeDelta: 0.004 });
  });
});

describe('lerRespostaDoCaminho', () => {
  test('converte a linha para { latitude, longitude } e arredonda os números', () => {
    expect(lerRespostaDoCaminho(RESPOSTA)).toEqual({
      pontos: [
        { latitude: 41.366502, longitude: -8.738338 },
        { latitude: 41.3655, longitude: -8.7379 },
        { latitude: 41.3643, longitude: -8.7375 },
      ],
      distanciaM: 872,
      duracaoMin: 12,
      emLinhaReta: false,
    });
  });

  test('respostas sem caminho ou estragadas não servem (devolve null)', () => {
    expect(lerRespostaDoCaminho({ code: 'NoRoute', routes: [] })).toBeNull();
    expect(lerRespostaDoCaminho({ code: 'Ok', routes: [{ distance: 10, duration: 10, geometry: { coordinates: [[-8.7, 41.3]] } }] })).toBeNull();
    expect(lerRespostaDoCaminho({ code: 'Ok', routes: [{ distance: 10, duration: 10, geometry: { coordinates: [['a', 41.3], [-8.7, 41.3]] } }] })).toBeNull();
    expect(lerRespostaDoCaminho(null)).toBeNull();
  });
});

describe('calcularCaminhoAPe', () => {
  test('pede o caminho a pé com a localização arredondada e começa no sítio verdadeiro do cliente', async () => {
    global.fetch = jest.fn(async () => respostaHttp(RESPOSTA));
    const caminho = await calcularCaminhoAPe(ESMAD, TASCA);

    const [endereco, opcoes] = global.fetch.mock.calls[0];
    // só sai do telemóvel a localização arredondada (41.367, -8.739), nunca a exata (RNF04)
    expect(endereco).toBe(
      'https://routing.openstreetmap.de/routed-foot/route/v1/driving/-8.739,41.367;-8.7375,41.3643?overview=full&geometries=geojson'
    );
    expect(endereco).not.toContain('41.36662');
    expect(opcoes.headers).toEqual({ 'User-Agent': 'Emmmenta/1.0' }); // a app identifica-se, como pedem as regras

    expect(caminho.emLinhaReta).toBe(false);
    expect(caminho.pontos[0]).toEqual(ESMAD); // a linha liga ao ponto azul do mapa
    expect(caminho.pontos).toHaveLength(4);
    expect(caminho.duracaoMin).toBe(12);
  });

  test('sem rede, o caminho é em linha reta (a app não fica parada — RNF08)', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(calcularCaminhoAPe(ESMAD, TASCA)).resolves.toEqual(caminhoEmLinhaReta(ESMAD, TASCA));
  });

  test('serviço ocupado (429) ou sem caminho: também linha reta', async () => {
    global.fetch = jest.fn(async () => respostaHttp({}, 429));
    expect((await calcularCaminhoAPe(ESMAD, TASCA)).emLinhaReta).toBe(true);

    global.fetch = jest.fn(async () => respostaHttp({ code: 'NoRoute', routes: [] }));
    expect((await calcularCaminhoAPe(ESMAD, TASCA)).emLinhaReta).toBe(true);
  });
});
