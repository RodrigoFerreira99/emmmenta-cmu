import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as Speech from 'expo-speech';

import { lerEmVozAlta, pararDeLer, precoParaFala, textoDoMenuParaOuvir } from '@/lib/ouvirMenu';

// Ouvir o menu em voz alta — testes a src/lib/ouvirMenu.js. A voz do telemóvel (expo-speech) é simulada.
// Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

const CALDO = { nome: 'Caldo verde', categoria: 'sopa', preco: 1.8, esgotado: false, etiquetas: ['sem-gluten'] };
const ROJOES = { nome: 'Rojões', categoria: 'carne', preco: 8.5, esgotado: false, ultimas_doses: true };
const BACALHAU = { nome: 'Bacalhau à Brás', categoria: 'peixe', preco: 9, esgotado: true };

beforeEach(() => jest.clearAllMocks());

describe('precoParaFala', () => {
  test('os preços dizem-se como uma pessoa os diria', () => {
    expect(precoParaFala(8.5)).toBe('8 euros e 50');
    expect(precoParaFala(1)).toBe('1 euro');
    expect(precoParaFala('9.00')).toBe('9 euros');
    expect(precoParaFala(1.05)).toBe('1 euro e 5');
    expect(precoParaFala(8.5, { emIngles: true })).toBe('8 euros 50');
  });
});

describe('textoDoMenuParaOuvir', () => {
  test('em português: restaurante, pratos, etiquetas, últimas doses, esgotado e menu completo', () => {
    expect(textoDoMenuParaOuvir({ nomeDoRestaurante: 'Tasca do Sancho', pratos: [CALDO, ROJOES, BACALHAU], precoMenuCompleto: 9.5 })).toBe(
      'Menu de hoje: Tasca do Sancho. Caldo verde, Sopa, Sem glúten, 1 euro e 80. Rojões, Carne, 8 euros e 50, últimas doses. ' +
        'Bacalhau à Brás, Peixe, esgotado. Menu completo: 9 euros e 50.'
    );
  });

  test('em inglês usa as traduções (e o nome português se faltar alguma)', () => {
    const texto = textoDoMenuParaOuvir({
      nomeDoRestaurante: 'Tasca do Sancho',
      pratos: [CALDO, BACALHAU],
      emIngles: true,
      traducoes: { 'Caldo verde': 'Caldo verde (kale and potato soup)' },
    });
    expect(texto).toBe(
      "Today's menu at Tasca do Sancho. Caldo verde (kale and potato soup), Soup, Gluten-free, 1 euro 80. Bacalhau à Brás, Fish, sold out."
    );
  });
});

describe('lerEmVozAlta', () => {
  test('pára o que estava a ler e lê na língua certa; "aoAcabar" serve para acabar, parar ou erro', () => {
    const aoAcabar = jest.fn();
    lerEmVozAlta('Olá', { aoAcabar });
    expect(Speech.stop).toHaveBeenCalled();
    expect(Speech.speak).toHaveBeenCalledWith(
      'Olá',
      expect.objectContaining({ language: 'pt-PT', onDone: aoAcabar, onStopped: aoAcabar, onError: aoAcabar })
    );

    lerEmVozAlta('Hello', { emIngles: true, aoAcabar });
    expect(Speech.speak).toHaveBeenLastCalledWith('Hello', expect.objectContaining({ language: 'en-GB' }));

    pararDeLer();
    expect(Speech.stop).toHaveBeenCalledTimes(3);
  });
});
