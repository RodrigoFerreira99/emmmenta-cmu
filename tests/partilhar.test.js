import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Share } from 'react-native';

import { partilhar, textoDoConvite, textoDoMenuDeHoje } from '@/lib/partilhar';

// Partilhar o menu de hoje (src/lib/partilhar.js). Correr com: npm test
// A janela de partilha do telemóvel é substituída por uma imitação.

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const TASCA = {
  id: 'r1',
  nome: 'Tasca do Sancho',
  tipo_cozinha: 'Portuguesa',
  morada: 'Rua Dom Sancho I, 120, Vila do Conde',
  latitude: 41.3643,
  longitude: -8.7375,
};
const MENU = {
  id: 'm1',
  preco_menu_completo: 9,
  pratos: [
    { id: 'p1', nome: 'Sopa de legumes', categoria: 'sopa', preco: 1.5, esgotado: false },
    { id: 'p2', nome: 'Frango assado', categoria: 'carne', preco: 7.5, esgotado: true },
    { id: 'p3', nome: 'Pescada cozida', categoria: 'peixe', preco: 8.5, esgotado: false },
  ],
};
const TERCA = new Date('2026-11-17T12:00:00Z');

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('textoDoMenuDeHoje (restaurante)', () => {
  test('tem o nome, o dia, os pratos disponíveis com preço, o menu completo e a morada', () => {
    expect(textoDoMenuDeHoje({ restaurante: TASCA, menu: MENU, agora: TERCA })).toBe(
      [
        '🍽️ Menu de hoje — Tasca do Sancho',
        'Terça-feira, 17 de novembro',
        '',
        '• Sopa de legumes — 1,50 €',
        '• Pescada cozida — 8,50 €',
        '',
        'Menu completo: 9,00 €',
        '',
        '📍 Rua Dom Sancho I, 120, Vila do Conde',
        '',
        'Vê os pratos do dia perto de ti na Emmmenta.',
      ].join('\n')
    );
  });

  test('os esgotados ficam de fora e, sem menu completo nem morada, essas linhas não aparecem', () => {
    const texto = textoDoMenuDeHoje({ restaurante: { nome: 'Tasca' }, menu: { ...MENU, preco_menu_completo: null }, agora: TERCA });
    expect(texto).not.toContain('Frango assado');
    expect(texto).not.toContain('Menu completo');
    expect(texto).not.toContain('📍');
  });
});

describe('textoDoConvite (cliente)', () => {
  test('convida, diz os pratos de hoje e leva o link das direções', () => {
    expect(textoDoConvite({ restaurante: TASCA, menu: MENU })).toBe(
      [
        'Almoçamos aqui? Tasca do Sancho (Portuguesa)',
        'Hoje: Sopa de legumes (1,50 €), Pescada cozida (8,50 €)',
        '📍 Rua Dom Sancho I, 120, Vila do Conde',
        'Direções: https://www.google.com/maps/dir/?api=1&destination=41.3643,-8.7375',
      ].join('\n')
    );
  });

  test('sem menu hoje, convida na mesma (sem a linha dos pratos)', () => {
    const texto = textoDoConvite({ restaurante: { ...TASCA, tipo_cozinha: null }, menu: null });
    expect(texto.split('\n')[0]).toBe('Almoçamos aqui? Tasca do Sancho');
    expect(texto).not.toContain('Hoje:');
    expect(texto).toContain('Direções: ');
  });
});

describe('partilhar', () => {
  test('abre a janela de partilha do telemóvel com o texto', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await partilhar('Olá');
    expect(share).toHaveBeenCalledWith({ message: 'Olá' });
  });

  test('se o telemóvel não conseguir, a mensagem vem em português', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('User did not share'));
    await expect(partilhar('Olá')).rejects.toThrow('Não foi possível abrir a partilha neste telemóvel.');
  });
});
