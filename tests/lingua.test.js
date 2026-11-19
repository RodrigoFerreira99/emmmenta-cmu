import { describe, expect, jest, test } from '@jest/globals';

import { linguaDoTelemovel, telemovelEmPortugues } from '@/lib/lingua';

// A língua do telemóvel (src/lib/lingua.js). A expo-localization é simulada. Correr com: npm test

const mockLocais = { lista: [{ languageCode: 'pt' }], falhar: false };
jest.mock('expo-localization', () => ({
  getLocales: () => {
    if (mockLocais.falhar) throw new Error('sem módulo');
    return mockLocais.lista;
  },
}));

describe('lingua', () => {
  test('a primeira língua do telemóvel decide', () => {
    mockLocais.lista = [{ languageCode: 'en' }, { languageCode: 'pt' }];
    expect(linguaDoTelemovel()).toBe('en');
    expect(telemovelEmPortugues()).toBe(false);
    mockLocais.lista = [{ languageCode: 'pt' }];
    expect(telemovelEmPortugues()).toBe(true);
  });

  test('se não for possível saber a língua, fica em português', () => {
    mockLocais.falhar = true;
    expect(linguaDoTelemovel()).toBe('pt');
    mockLocais.falhar = false;
  });
});
