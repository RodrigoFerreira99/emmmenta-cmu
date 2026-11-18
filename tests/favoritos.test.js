import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable, Text } from 'react-native';

// Favoritos guardados no telemóvel (src/lib/favoritos.js). Correr com: npm test
// O ficheiro do telemóvel é substituído por uma imitação em memória (mockDisco).

const mockDisco = { conteudo: null, falharAEscrever: false, escritas: 0 };

jest.mock('expo-file-system', () => ({
  Paths: { document: 'documentos' },
  File: class {
    get exists() {
      return mockDisco.conteudo !== null;
    }
    create() {
      mockDisco.conteudo = '';
    }
    async text() {
      return mockDisco.conteudo;
    }
    async write(texto) {
      if (mockDisco.falharAEscrever) throw new Error('No space left on device');
      mockDisco.escritas += 1;
      mockDisco.conteudo = texto;
    }
  },
}));

// O módulo guarda os favoritos em memória: em cada teste carrega-se um módulo novo, como se a app abrisse.
let favoritos;
beforeEach(() => {
  Object.assign(mockDisco, { conteudo: null, falharAEscrever: false, escritas: 0 });
  jest.resetModules();
  jest.doMock('react', () => React); // o módulo novo tem de usar a mesma cópia do React que desenha o ecrã do teste
  favoritos = require('@/lib/favoritos');
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

// Um ecrã mínimo que mostra os favoritos e tem um botão para mudar o restaurante "r1".
function EcraDeTeste() {
  const { favoritos: ids, eFavorito, alternarFavorito } = favoritos.useFavoritos();
  return (
    <>
      <Text>{`favoritos: ${[...ids].join(',') || 'nenhum'}`}</Text>
      <Text>{eFavorito('r1') ? 'r1 é favorito' : 'r1 não é favorito'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="mudar r1" onPress={() => alternarFavorito('r1').catch(() => {})} />
    </>
  );
}

describe('favoritos guardados no telemóvel', () => {
  test('ao abrir, lê os favoritos que estavam guardados', async () => {
    mockDisco.conteudo = JSON.stringify(['r1', 'r2']);
    await render(<EcraDeTeste />);
    expect(await screen.findByText('favoritos: r1,r2')).toBeTruthy();
    expect(screen.getByText('r1 é favorito')).toBeTruthy();
  });

  test('sem ficheiro, começa sem favoritos', async () => {
    await render(<EcraDeTeste />);
    expect(await screen.findByText('favoritos: nenhum')).toBeTruthy();
  });

  test('um ficheiro estragado não faz a app parar: começa sem favoritos', async () => {
    mockDisco.conteudo = '{isto não é json';
    await render(<EcraDeTeste />);
    expect(await screen.findByText('favoritos: nenhum')).toBeTruthy();
  });

  test('tocar no coração guarda e volta a tirar; fica gravado no ficheiro', async () => {
    await render(<EcraDeTeste />);
    await screen.findByText('favoritos: nenhum');

    await fireEvent.press(screen.getByRole('button', { name: 'mudar r1' }));
    expect(await screen.findByText('r1 é favorito')).toBeTruthy();
    expect(JSON.parse(mockDisco.conteudo)).toEqual(['r1']);

    await fireEvent.press(screen.getByRole('button', { name: 'mudar r1' }));
    expect(await screen.findByText('r1 não é favorito')).toBeTruthy();
    expect(JSON.parse(mockDisco.conteudo)).toEqual([]);
  });

  test('todos os ecrãs abertos veem a mudança ao mesmo tempo', async () => {
    await render(
      <>
        <EcraDeTeste />
        <EcraDeTeste />
      </>
    );
    await act(async () => favoritos.alternarFavorito('r1'));
    expect(screen.getAllByText('r1 é favorito')).toHaveLength(2);
  });

  test('se não for possível gravar, volta atrás e explica', async () => {
    mockDisco.conteudo = JSON.stringify(['r2']);
    mockDisco.falharAEscrever = true;
    await render(<EcraDeTeste />);
    await screen.findByText('favoritos: r2');

    await act(async () => {
      await expect(favoritos.alternarFavorito('r1')).rejects.toThrow('Não foi possível guardar os favoritos neste telemóvel.');
    });
    expect(screen.getByText('favoritos: r2')).toBeTruthy(); // o r1 não ficou marcado
  });

  test('um favorito marcado antes de o ficheiro ser lido não apaga os que lá estavam', async () => {
    mockDisco.conteudo = JSON.stringify(['r2']);
    await act(async () => favoritos.alternarFavorito('r1')); // nenhum ecrã pediu ainda os favoritos
    expect(JSON.parse(mockDisco.conteudo).sort()).toEqual(['r1', 'r2']);
  });
});
