import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { eUmAbanao, LIMITE_DO_ABANAO_G, ouvirAbanoes } from '@/lib/abanar';

// "Abana para decidir": perceber um abanão com o acelerómetro (src/lib/abanar.js). Correr com: npm test
// O acelerómetro é simulado: o teste "manda" medições com mockAcelerometro.ouvinte.

const mockAcelerometro = { existe: true, ouvinte: null, intervalo: null, removido: false };
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: async () => mockAcelerometro.existe,
    setUpdateInterval: (ms) => (mockAcelerometro.intervalo = ms),
    addListener: (ouvinte) => {
      mockAcelerometro.ouvinte = ouvinte;
      return { remove: () => (mockAcelerometro.removido = true) };
    },
  },
}));

// espera que a promessa do isAvailableAsync se resolva
const esperarUmPouco = () => new Promise((resolver) => setTimeout(resolver, 0));

beforeEach(() => {
  Object.assign(mockAcelerometro, { existe: true, ouvinte: null, intervalo: null, removido: false });
});
afterEach(() => jest.restoreAllMocks());

describe('eUmAbanao', () => {
  test('pousado (só a gravidade, ~1 g) não é abanão', () => {
    expect(eUmAbanao({ x: 0, y: 0, z: 1 })).toBe(false);
    expect(eUmAbanao({ x: 0.6, y: 0.7, z: 0.9 })).toBe(false); // a andar com o telemóvel na mão
  });

  test(`acima de ${LIMITE_DO_ABANAO_G} g é abanão (em qualquer direção)`, () => {
    expect(eUmAbanao({ x: 2.5, y: 0, z: 0 })).toBe(true);
    expect(eUmAbanao({ x: -1.5, y: 1.5, z: 1 })).toBe(true); // √(2,25 + 2,25 + 1) ≈ 2,35 g
  });
});

describe('ouvirAbanoes', () => {
  test('ouve 10 vezes por segundo e avisa em cada abanão', async () => {
    const aoAbanar = jest.fn();
    ouvirAbanoes(aoAbanar);
    await esperarUmPouco();
    expect(mockAcelerometro.intervalo).toBe(100);

    mockAcelerometro.ouvinte({ x: 0, y: 0, z: 1 });
    expect(aoAbanar).not.toHaveBeenCalled();
    mockAcelerometro.ouvinte({ x: 3, y: 0, z: 1 });
    expect(aoAbanar).toHaveBeenCalledTimes(1);
  });

  test('um abanão longo (várias medições seguidas) conta só uma vez', async () => {
    let agora = 10_000;
    jest.spyOn(Date, 'now').mockImplementation(() => agora);
    const aoAbanar = jest.fn();
    ouvirAbanoes(aoAbanar);
    await esperarUmPouco();

    mockAcelerometro.ouvinte({ x: 3, y: 0, z: 1 });
    agora += 300;
    mockAcelerometro.ouvinte({ x: 3, y: 0, z: 1 });
    expect(aoAbanar).toHaveBeenCalledTimes(1);

    agora += 2000; // passou a pausa: um abanão novo já conta
    mockAcelerometro.ouvinte({ x: 3, y: 0, z: 1 });
    expect(aoAbanar).toHaveBeenCalledTimes(2);
  });

  test('a função devolvida pára de ouvir', async () => {
    const parar = ouvirAbanoes(jest.fn());
    await esperarUmPouco();
    parar();
    expect(mockAcelerometro.removido).toBe(true);
  });

  test('sem acelerómetro não faz nada (e não dá erro)', async () => {
    mockAcelerometro.existe = false;
    const parar = ouvirAbanoes(jest.fn());
    await esperarUmPouco();
    expect(mockAcelerometro.ouvinte).toBeNull();
    expect(() => parar()).not.toThrow();
  });

  test('se parar antes de o acelerómetro responder, nunca chega a ouvir', async () => {
    const parar = ouvirAbanoes(jest.fn());
    parar();
    await esperarUmPouco();
    expect(mockAcelerometro.ouvinte).toBeNull();
  });
});
