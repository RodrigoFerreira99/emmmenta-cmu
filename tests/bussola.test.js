import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { Bussola } from '@/components/Bussola';
import { vibrarSucesso } from '@/lib/vibrar';
import { estadoDaPermissao, pedirPermissao, seguirDirecao, seguirPosicao } from '@/services/localizacao';

// Bússola até ao restaurante — testes ao componente Bussola.
// O GPS e a bússola do telemóvel são simulados: os testes "mexem" o telemóvel chamando os callbacks.
// Correr com: npm test

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
// sem isto, as margens do ecrã (SafeAreaView) não aparecem nos testes
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/vibrar', () => ({ vibrarLeve: jest.fn(), vibrarSucesso: jest.fn(), vibrarSelecao: jest.fn() }));
jest.mock('@/services/localizacao', () => ({
  estadoDaPermissao: jest.fn(),
  pedirPermissao: jest.fn(),
  seguirPosicao: jest.fn(),
  seguirDirecao: jest.fn(),
}));

const RESTAURANTE = { nome: 'Tasca do Sancho', latitude: 41.0, longitude: -8.0 };
// cerca de 250 m a oeste do restaurante: o restaurante fica a este (rumo 90)
const A_OESTE = { latitude: 41.0, longitude: -8.003 };

const sensores = { posicao: null, direcao: null };
const pararPosicao = jest.fn();
const pararDirecao = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  estadoDaPermissao.mockResolvedValue('concedida');
  pedirPermissao.mockResolvedValue(true);
  seguirPosicao.mockImplementation(async (aoMudar) => {
    sensores.posicao = aoMudar;
    return pararPosicao;
  });
  seguirDirecao.mockImplementation(async (aoMudar) => {
    sensores.direcao = aoMudar;
    return pararDirecao;
  });
});

const abrir = (aoFechar = jest.fn()) =>
  render(
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Bussola restaurante={RESTAURANTE} visivel aoFechar={aoFechar} />
    </SafeAreaProvider>
  );

describe('Bussola', () => {
  test('a seta aponta para o restaurante e a distância diminui; ao chegar vibra uma vez', async () => {
    await abrir();
    expect(await screen.findByText('A ler a bússola…')).toBeTruthy();

    // o cliente está a oeste e com o telemóvel virado a norte: o restaurante fica à direita
    await act(async () => {
      sensores.posicao(A_OESTE);
      sensores.direcao({ graus: 0, precisao: 3 });
    });
    expect(screen.getByLabelText(/^O restaurante está à tua direita, a 2\d0 m$/)).toBeTruthy();
    expect(screen.getByText(/^Faltam 2\d0 m$/)).toBeTruthy();

    // vira-se para este: agora o restaurante está em frente
    await act(async () => sensores.direcao({ graus: 90, precisao: 3 }));
    expect(screen.getByText('O restaurante está em frente.')).toBeTruthy();

    // chega à porta
    await act(async () => sensores.posicao({ latitude: 41.0, longitude: -8.0001 }));
    expect(screen.getByText('Chegaste!')).toBeTruthy();
    expect(vibrarSucesso).toHaveBeenCalledTimes(1);
    await act(async () => sensores.posicao({ latitude: 41.0, longitude: -8.00005 }));
    expect(vibrarSucesso).toHaveBeenCalledTimes(1); // só vibra uma vez
  });

  test('com a bússola pouco certa, ensina a acertá-la', async () => {
    await abrir();
    await screen.findByText('A ler a bússola…');
    await act(async () => {
      sensores.posicao(A_OESTE);
      sensores.direcao({ graus: 0, precisao: 1 });
    });
    expect(screen.getByText(/em forma de 8/)).toBeTruthy();
  });

  test('sem permissão, explica e só pede quando o cliente carrega (RNF04)', async () => {
    estadoDaPermissao.mockResolvedValue('porPedir');
    await abrir();
    expect(await screen.findByText(/precisa de saber onde estás/)).toBeTruthy();
    expect(seguirPosicao).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Usar a minha localização' }));
    expect(pedirPermissao).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('A ler a bússola…')).toBeTruthy();
    expect(seguirPosicao).toHaveBeenCalledTimes(1);
  });

  test('ao fechar, deixa de ler o GPS e a bússola', async () => {
    const aoFechar = jest.fn();
    const { rerender } = await abrir(aoFechar);
    await screen.findByText('A ler a bússola…');
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar a bússola' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);

    await rerender(
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <Bussola restaurante={RESTAURANTE} visivel={false} aoFechar={aoFechar} />
      </SafeAreaProvider>
    );
    expect(pararPosicao).toHaveBeenCalled();
    expect(pararDirecao).toHaveBeenCalled();
  });
});
