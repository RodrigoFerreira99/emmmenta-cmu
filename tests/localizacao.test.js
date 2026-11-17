import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Linking, Platform } from 'react-native';

import { abrirDirecoes, enderecoDasDirecoes, ligar } from '@/lib/ligacoes';
import { ZONAS } from '@/lib/zonas';
import { estadoDaPermissao, lerLocalizacao, pedirPermissao } from '@/services/localizacao';

// RF05 / RF06 — testes à localização do cliente (src/services/localizacao.js), às zonas escolhidas
// à mão (src/lib/zonas.js) e aos botões Ligar e Direções (src/lib/ligacoes.js). Correr com: npm test
// O módulo de localização do telemóvel é substituído por uma imitação.

const mockGps = {
  permissao: { granted: false, canAskAgain: true },
  ligado: true,
  recente: null, // posição que o telemóvel já conhecia
  atual: { coords: { latitude: 41.15, longitude: -8.61, accuracy: 20 } },
  falha: false,
  opcoes: null,
};

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: async () => mockGps.permissao,
  requestForegroundPermissionsAsync: async () => mockGps.permissao,
  hasServicesEnabledAsync: async () => mockGps.ligado,
  getLastKnownPositionAsync: async () => mockGps.recente,
  getCurrentPositionAsync: async (opcoes) => {
    mockGps.opcoes = opcoes;
    if (mockGps.falha) throw new Error('Location request failed due to unsatisfied device settings');
    return mockGps.atual;
  },
}));

beforeEach(() => {
  Object.assign(mockGps, {
    permissao: { granted: false, canAskAgain: true },
    ligado: true,
    recente: null,
    atual: { coords: { latitude: 41.15, longitude: -8.61, accuracy: 20 } },
    falha: false,
    opcoes: null,
  });
  jest.restoreAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('permissão de localização (RNF04)', () => {
  test('distingue concedida, por pedir e negada de vez', async () => {
    await expect(estadoDaPermissao()).resolves.toBe('porPedir');
    mockGps.permissao = { granted: true, canAskAgain: true };
    await expect(estadoDaPermissao()).resolves.toBe('concedida');
    mockGps.permissao = { granted: false, canAskAgain: false };
    await expect(estadoDaPermissao()).resolves.toBe('negada');
  });

  test('pedirPermissao devolve o que o utilizador respondeu', async () => {
    await expect(pedirPermissao()).resolves.toBe(false);
    mockGps.permissao = { granted: true, canAskAgain: true };
    await expect(pedirPermissao()).resolves.toBe(true);
  });
});

describe('lerLocalizacao', () => {
  test('devolve só a latitude e a longitude', async () => {
    await expect(lerLocalizacao()).resolves.toEqual({ latitude: 41.15, longitude: -8.61 });
    expect(mockGps.opcoes).toEqual({ accuracy: 3 }); // precisão "Balanced": chega e é mais rápida
  });

  test('se o telemóvel já conhece uma posição recente, usa-a e nem pede outra (RNF05)', async () => {
    mockGps.recente = { coords: { latitude: 41.2, longitude: -8.7 } };
    await expect(lerLocalizacao()).resolves.toEqual({ latitude: 41.2, longitude: -8.7 });
    expect(mockGps.opcoes).toBeNull();
  });

  test('com a localização do telemóvel desligada, diz o que fazer (RNF08)', async () => {
    mockGps.ligado = false;
    await expect(lerLocalizacao()).rejects.toThrow('A localização do telemóvel está desligada');
  });

  test('se a leitura falhar, a mensagem vem em português e sugere escolher a zona', async () => {
    mockGps.falha = true;
    const promessa = lerLocalizacao();
    await expect(promessa).rejects.toThrow('Não foi possível saber onde estás');
    await expect(promessa).rejects.toThrow('escolhe a zona à mão');
    await expect(promessa).rejects.not.toThrow(/failed|unsatisfied/i);
  });
});

describe('zonas para escolher à mão (RNF08)', () => {
  test('todas têm nome, id único e coordenadas em Portugal continental', () => {
    expect(ZONAS.length).toBeGreaterThan(5);
    expect(new Set(ZONAS.map((zona) => zona.id)).size).toBe(ZONAS.length);
    for (const zona of ZONAS) {
      expect(zona.nome).toBeTruthy();
      expect(zona.latitude).toBeGreaterThan(36.9);
      expect(zona.latitude).toBeLessThan(42.2);
      expect(zona.longitude).toBeGreaterThan(-9.6);
      expect(zona.longitude).toBeLessThan(-6.1);
    }
  });
});

describe('botões Ligar e Direções (RF06)', () => {
  const RESTAURANTE = { latitude: 41.1496, longitude: -8.611, nome: 'Tasca do Manuel' };

  test('no iPhone as direções abrem o Apple Maps; no Android e no browser, o Google Maps', () => {
    expect(enderecoDasDirecoes('ios', RESTAURANTE)).toBe('http://maps.apple.com/?daddr=41.1496,-8.611');
    expect(enderecoDasDirecoes('android', RESTAURANTE)).toBe('https://www.google.com/maps/dir/?api=1&destination=41.1496,-8.611');
    expect(enderecoDasDirecoes('web', RESTAURANTE)).toBe('https://www.google.com/maps/dir/?api=1&destination=41.1496,-8.611');
  });

  test('abrirDirecoes pede ao telemóvel para abrir esse endereço', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    jest.replaceProperty(Platform, 'OS', 'android');
    await abrirDirecoes(RESTAURANTE);
    expect(abrir).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=41.1496,-8.611');
  });

  test('ligar abre a app do telefone com o número', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await ligar('+351222000000');
    expect(abrir).toHaveBeenCalledWith('tel:+351222000000');
  });

  test('se o telemóvel não conseguir abrir a outra app, a mensagem explica (e mostra o número)', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No Activity found to handle Intent'));
    await expect(abrirDirecoes(RESTAURANTE)).rejects.toThrow('Não foi possível abrir a app de mapas');
    await expect(ligar('+351222000000')).rejects.toThrow('O número é +351222000000');
  });
});
