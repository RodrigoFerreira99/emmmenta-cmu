import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { CameraNaApp } from '@/components/CameraNaApp';
import { escolherDaGaleria, pedirAcessoACamara } from '@/lib/fotografias';

// Câmara dentro da app (src/components/CameraNaApp.js) e permissões/galeria (src/lib/fotografias.js).
// A câmara verdadeira só existe no telemóvel: aqui o CameraView é trocado por uma imitação que regista
// as fotografias pedidas e deixa o teste dizer quando a câmara "arrancou". Correr com: npm test

const mockCamara = { fotos: [], falhar: false, aoArrancar: null, aoFalharAAbrir: null };

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
// imitação oficial da biblioteca das margens do ecrã (no Jest não há ecrã para medir)
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-camera', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  const CameraView = mockReact.forwardRef(({ onCameraReady, onMountError }, ref) => {
    mockCamara.aoArrancar = onCameraReady;
    mockCamara.aoFalharAAbrir = onMountError;
    mockReact.useImperativeHandle(ref, () => ({
      takePictureAsync: async (opcoes) => {
        mockCamara.fotos.push(opcoes);
        if (mockCamara.falhar) throw new Error('Camera is not running');
        return { uri: 'file:///cache/camera/foto.jpg', width: 3000, height: 4000 };
      },
    }));
    return mockReact.createElement(View, { testID: 'camara' });
  });
  return { CameraView };
});

const mockPicker = { permissao: { granted: true }, resultado: null, falhar: false, opcoes: null };
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => mockPicker.permissao,
  launchImageLibraryAsync: async (opcoes) => {
    mockPicker.opcoes = opcoes;
    if (mockPicker.falhar) throw new Error('Activity not found');
    return mockPicker.resultado;
  },
}));

beforeEach(() => {
  Object.assign(mockCamara, { fotos: [], falhar: false, aoArrancar: null, aoFalharAAbrir: null });
  Object.assign(mockPicker, { permissao: { granted: true }, resultado: null, falhar: false, opcoes: null });
  jest.spyOn(console, 'warn').mockImplementation(() => {}); // os avisos técnicos são esperados nos testes de erro
});

describe('CameraNaApp', () => {
  const abrir = async (props = {}) => {
    const aoTirar = jest.fn();
    const aoFechar = jest.fn();
    await render(<CameraNaApp dica="Enquadra o menu todo" aoTirar={aoTirar} aoFechar={aoFechar} {...props} />);
    return { aoTirar, aoFechar };
  };
  const disparador = () => screen.getByRole('button', { name: 'Tirar fotografia' });

  test('mostra a dica e só deixa tirar a fotografia depois de a câmara arrancar', async () => {
    const { aoTirar } = await abrir();
    expect(screen.getByText('Enquadra o menu todo')).toBeTruthy();
    expect(disparador().props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(disparador());
    expect(mockCamara.fotos).toHaveLength(0); // ainda não arrancou: não faz nada

    await act(async () => mockCamara.aoArrancar());
    expect(disparador().props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(disparador());
    expect(mockCamara.fotos).toEqual([{ quality: 0.7 }]);
    expect(aoTirar).toHaveBeenCalledWith('file:///cache/camera/foto.jpg');
  });

  test('"Cancelar" fecha a câmara', async () => {
    const { aoTirar, aoFechar } = await abrir();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
    expect(aoTirar).not.toHaveBeenCalled();
  });

  test('se a fotografia falhar, explica e deixa tentar outra vez', async () => {
    mockCamara.falhar = true;
    const { aoTirar } = await abrir();
    await act(async () => mockCamara.aoArrancar());
    await fireEvent.press(disparador());

    expect(screen.getByText('Não foi possível tirar a fotografia. Tenta outra vez.')).toBeTruthy();
    expect(aoTirar).not.toHaveBeenCalled();

    mockCamara.falhar = false;
    await fireEvent.press(disparador());
    expect(aoTirar).toHaveBeenCalledTimes(1);
  });

  test('se a câmara não abrir, sugere a galeria', async () => {
    await abrir();
    await act(async () => mockCamara.aoFalharAAbrir({ message: 'Camera not available' }));
    expect(screen.getByText(/Não foi possível abrir a câmara\. Fecha e escolhe uma fotografia da galeria\./)).toBeTruthy();
  });
});

describe('pedirAcessoACamara e escolherDaGaleria', () => {
  test('com a permissão dada, não lança nada', async () => {
    await expect(pedirAcessoACamara()).resolves.toBeUndefined();
  });

  test('sem permissão, a mensagem sugere a galeria (RNF08)', async () => {
    mockPicker.permissao = { granted: false };
    await expect(pedirAcessoACamara()).rejects.toThrow('Podes escolher uma imagem da galeria');
  });

  test('a galeria devolve o caminho da imagem escolhida, com as opções pedidas', async () => {
    mockPicker.resultado = { canceled: false, assets: [{ uri: 'file:///fotos/menu.jpg' }] };
    await expect(escolherDaGaleria({ allowsEditing: true })).resolves.toBe('file:///fotos/menu.jpg');
    expect(mockPicker.opcoes).toEqual({ mediaTypes: 'images', quality: 1, allowsEditing: true });
  });

  test('fechar a galeria sem escolher devolve null', async () => {
    mockPicker.resultado = { canceled: true, assets: null };
    await expect(escolherDaGaleria()).resolves.toBeNull();
  });

  test('se a galeria não abrir, a mensagem vem em português', async () => {
    mockPicker.falhar = true;
    await expect(escolherDaGaleria()).rejects.toThrow('Não foi possível abrir a galeria');
  });
});
