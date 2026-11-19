import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { LerQr } from '@/components/LerQr';
import { pedirAcessoACamara } from '@/lib/fotografias';
import {
  enderecoDoRestaurante,
  escaparHtml,
  htmlDoCartaz,
  imprimirCartaz,
  lerQrDoRestaurante,
  partilharCartazEmPdf,
  svgDoQr,
} from '@/lib/qr';

// QR code do restaurante — testes a src/lib/qr.js e ao leitor LerQr.
// A câmara, a impressão e a partilha são simuladas. Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/vibrar', () => ({ vibrarLeve: jest.fn(), vibrarSucesso: jest.fn(), vibrarSelecao: jest.fn() }));
jest.mock('@/lib/fotografias', () => ({ pedirAcessoACamara: jest.fn() }));
jest.mock('expo-print', () => ({ printAsync: jest.fn(), printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
// A câmara só existe no telemóvel: aqui é uma caixa que guarda a função que recebe os QR lidos.
jest.mock('expo-camera', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return { CameraView: (props) => mockReact.createElement(View, { testID: 'camara', ...props }) };
});

const ID = '11111111-2222-3333-4444-555555555555';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('o texto do QR', () => {
  test('o QR guarda o endereço do restaurante e a app sabe lê-lo', () => {
    expect(enderecoDoRestaurante(ID)).toBe(`emmmenta://restaurante/${ID}`);
    expect(lerQrDoRestaurante(`emmmenta://restaurante/${ID}`)).toBe(ID);
    expect(lerQrDoRestaurante(`  EMMMENTA://restaurante/${ID.toUpperCase()} `)).toBe(ID);
  });

  test('outros QR (sites, ids estragados) não abrem nada', () => {
    expect(lerQrDoRestaurante('https://www.esmad.ipp.pt')).toBeNull();
    expect(lerQrDoRestaurante('emmmenta://restaurante/nao-e-um-id')).toBeNull();
    expect(lerQrDoRestaurante(`emmmenta://restaurante/${ID}/extra`)).toBeNull();
    expect(lerQrDoRestaurante(null)).toBeNull();
  });

  test('svgDoQr desenha um SVG com as cores da app', () => {
    const svg = svgDoQr(enderecoDoRestaurante(ID));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('fill="#1A1718"');
    expect(svg).not.toContain('fill="black"');
  });
});

describe('o cartaz', () => {
  const RESTAURANTE = { id: ID, nome: 'Tasca <do> Sancho & Filhos' };
  const MENU = {
    preco_menu_completo: 9.5,
    pratos: [
      { nome: 'Caldo verde', preco: 1.8, esgotado: false },
      { nome: 'Bacalhau à Brás', preco: 9, esgotado: true },
    ],
  };

  test('escaparHtml: um nome com < > & " não estraga o cartaz', () => {
    expect(escaparHtml('<b>"A" & \'B\'</b>')).toBe('&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;');
  });

  test('leva o nome (escapado), o menu de hoje, o esgotado, o menu completo e o QR', () => {
    const html = htmlDoCartaz({ restaurante: RESTAURANTE, menu: MENU });
    expect(html).toContain('<h1>Tasca &lt;do&gt; Sancho &amp; Filhos</h1>');
    expect(html).toContain('Caldo verde');
    expect(html).toContain('1,80 €');
    expect(html).toContain('<td class="nome esgotado">Bacalhau à Brás</td><td class="preco">Esgotado</td>');
    expect(html).toContain('Menu completo: 9,50 €');
    expect(html).toContain('<svg');
  });

  test('sem menu hoje, o cartaz leva só o QR', () => {
    const html = htmlDoCartaz({ restaurante: RESTAURANTE, menu: null });
    expect(html).not.toContain('Menu de hoje');
    expect(html).toContain('<svg');
  });

  test('imprimir e guardar em PDF (A4)', async () => {
    await imprimirCartaz('<p>cartaz</p>');
    expect(Print.printAsync).toHaveBeenCalledWith({ html: '<p>cartaz</p>' });

    Print.printToFileAsync.mockResolvedValue({ uri: 'file:///cache/cartaz.pdf' });
    Sharing.isAvailableAsync.mockResolvedValue(true);
    await partilharCartazEmPdf('<p>cartaz</p>');
    expect(Print.printToFileAsync).toHaveBeenCalledWith({ html: '<p>cartaz</p>', width: 595, height: 842 });
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/cartaz.pdf', expect.objectContaining({ mimeType: 'application/pdf' }));
  });

  test('se a impressão falhar, a mensagem é em português', async () => {
    Print.printAsync.mockRejectedValue(new Error('Printing did not complete'));
    await expect(imprimirCartaz('<p></p>')).rejects.toThrow('Não foi possível abrir a impressão');
  });
});

describe('LerQr (o leitor no Início)', () => {
  test('lê o QR de um restaurante, abre-o e deixa de procurar', async () => {
    pedirAcessoACamara.mockResolvedValue();
    const aoLer = jest.fn();
    await render(<LerQr visivel aoFechar={jest.fn()} aoLer={aoLer} />);
    const camara = await screen.findByTestId('camara');
    expect(camara.props.barcodeScannerSettings).toEqual({ barcodeTypes: ['qr'] });

    await fireEvent(camara, 'barcodeScanned', { type: 'qr', data: `emmmenta://restaurante/${ID}` });
    expect(aoLer).toHaveBeenCalledWith(ID);
    expect(screen.getByTestId('camara').props.onBarcodeScanned).toBeUndefined(); // não lê o mesmo QR duas vezes
  });

  test('um QR que não é da Emmmenta: explica e continua a procurar', async () => {
    pedirAcessoACamara.mockResolvedValue();
    const aoLer = jest.fn();
    await render(<LerQr visivel aoFechar={jest.fn()} aoLer={aoLer} />);
    await fireEvent(await screen.findByTestId('camara'), 'barcodeScanned', { type: 'qr', data: 'https://exemplo.pt' });
    expect(screen.getByText('Este QR code não é de um restaurante da Emmmenta.')).toBeTruthy();
    expect(aoLer).not.toHaveBeenCalled();
    expect(screen.getByTestId('camara').props.onBarcodeScanned).toEqual(expect.any(Function));
  });

  test('sem permissão da câmara, explica (e a câmara não abre)', async () => {
    pedirAcessoACamara.mockRejectedValue(new Error('sem permissão'));
    await render(<LerQr visivel aoFechar={jest.fn()} aoLer={jest.fn()} />);
    expect(await screen.findByText(/Sem acesso à câmara não é possível ler o QR code/)).toBeTruthy();
    expect(screen.queryByTestId('camara')).toBeNull();
  });
});
