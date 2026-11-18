import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { ListaFantasma, PaginaFantasma } from '@/components/Esqueleto';
import { EtiquetaDoMapa } from '@/components/EtiquetaDoMapa';
import { vibrarLeve, vibrarSucesso } from '@/lib/vibrar';

// Peças de design: vibração, esqueletos de carregamento e etiquetas do mapa. Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('vibrar', () => {
  test('pede ao telemóvel a vibração certa', () => {
    vibrarLeve();
    vibrarSucesso();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  test('no browser não faz nada', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    vibrarLeve();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  test('uma vibração que falhe nunca estraga a ação que a pediu', () => {
    Haptics.impactAsync.mockImplementationOnce(() => {
      throw new Error('sem motor de vibração');
    });
    Haptics.notificationAsync.mockImplementationOnce(async () => {
      throw new Error('falhou');
    });
    expect(() => vibrarLeve()).not.toThrow();
    expect(() => vibrarSucesso()).not.toThrow();
  });
});

describe('esqueletos de carregamento', () => {
  test('a lista fantasma diz ao leitor de ecrã que está a carregar', async () => {
    await render(<ListaFantasma quantos={3} />);
    expect(screen.getByLabelText('A carregar os pratos')).toBeTruthy();
  });

  test('a página fantasma do restaurante também', async () => {
    await render(<PaginaFantasma />);
    expect(screen.getByLabelText('A carregar o restaurante')).toBeTruthy();
  });
});

describe('etiqueta do mapa', () => {
  test('mostra o preço mais baixo, ou "Esgotado" quando já não há nada', async () => {
    await render(<EtiquetaDoMapa restaurante={{ disponiveis: 2, precoMinimo: 6.5 }} />);
    expect(screen.getByText('6,50 €')).toBeTruthy();

    await render(<EtiquetaDoMapa restaurante={{ disponiveis: 0, precoMinimo: null }} />);
    expect(screen.getByText('Esgotado')).toBeTruthy();
  });
});

describe('EtiquetaDeLotacao com o ecrã aberto', () => {
  test('o "há X min" avança e o aviso desaparece ao fim de 45 minutos, sem fechar o ecrã', async () => {
    // só os temporizadores e o relógio são falsos: as promessas (usadas pelo render) continuam normais
    jest.useFakeTimers({ now: new Date('2026-11-18T12:00:30Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    const { EtiquetaDeLotacao } = require('@/components/Lotacao');
    const menu = { lotacao: 'cheio', lotacao_em: '2026-11-18T11:16:00Z' }; // dito há 44 minutos
    await render(<EtiquetaDeLotacao menu={menu} />);
    expect(screen.getByLabelText('Cheio agora · há 44 min')).toBeTruthy();

    await act(async () => jest.advanceTimersByTime(2 * 60 * 1000));
    expect(screen.queryByLabelText(/Cheio agora/)).toBeNull();
    jest.useRealTimers();
  });
});
