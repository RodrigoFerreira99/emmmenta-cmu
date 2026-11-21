import { describe, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { CapaQuente } from '@/components/CapaQuente';
import { ImagemDoPrato } from '@/components/ImagemDoPrato';
import { chaveDaImagem, imagemDoPrato, pratoDeDestaque } from '@/lib/imagensDosPratos';

// Imagens 3D dos pratos (design térmico) — testes a src/lib/imagensDosPratos.js, ImagemDoPrato e CapaQuente.
// Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('que imagem tem cada prato', () => {
  test.each([
    ['Bitoque', 'carne', 'bitoque'],
    ['Frango assado', 'carne', 'frango'],
    ['Rojões à minhota', 'carne', 'entrecosto'],
    ['Francesinha', 'carne', 'sandes'],
    ['Arroz de pato', 'carne', 'arroz'],
    ['Feijoada à transmontana', 'carne', 'estufado'],
    ['Bacalhau à Brás', 'peixe', 'peixe'],
    ['Caril de grão', 'vegetariano', 'caril'],
    ['Omelete de cogumelos', 'vegetariano', 'ovos'],
    ['Caldo verde', 'sopa', 'caldo'],
    ['Sopa de legumes', 'sopa', 'sopa'],
    ['Leite-creme', 'sobremesa', 'pudim'],
    ['Arroz doce', 'sobremesa', 'pudim'],
    ['Tarte de maçã', 'sobremesa', 'tarte'],
  ])('%s (%s) → %s', (nome, categoria, chave) => {
    expect(chaveDaImagem({ nome, categoria })).toBe(chave);
  });

  test('sem palavra conhecida, vale a categoria', () => {
    expect(chaveDaImagem({ nome: 'Prato do chef', categoria: 'carne' })).toBe('bife');
    expect(chaveDaImagem({ nome: 'Especial do dia', categoria: 'vegetariano' })).toBe('salada');
    expect(chaveDaImagem({ nome: 'Surpresa', categoria: 'sobremesa' })).toBe('bolo');
    expect(chaveDaImagem({})).toBe('bife');
  });

  test('a imagem existe para todas as escolhas', () => {
    for (const categoria of ['sopa', 'carne', 'peixe', 'vegetariano', 'sobremesa']) {
      expect(imagemDoPrato({ nome: 'x', categoria })).toBeTruthy();
    }
  });
});

describe('o prato da capa', () => {
  const PRATOS = [
    { nome: 'Caldo verde', categoria: 'sopa', esgotado: false },
    { nome: 'Feijoada', categoria: 'carne', esgotado: true },
    { nome: 'Pescada cozida', categoria: 'peixe', esgotado: false },
  ];

  test('o primeiro prato principal que ainda há', () => {
    expect(pratoDeDestaque(PRATOS)).toEqual({ nome: 'Pescada cozida', categoria: 'peixe' });
  });

  test('se só houver sopa, a sopa; se estiver tudo esgotado, o primeiro; sem menu, o tipo de cozinha', () => {
    expect(pratoDeDestaque([PRATOS[0]])).toEqual({ nome: 'Caldo verde', categoria: 'sopa' });
    expect(pratoDeDestaque([PRATOS[1]])).toEqual({ nome: 'Feijoada', categoria: 'carne' });
    expect(pratoDeDestaque([], { tipo_cozinha: 'Grelhados' })).toEqual({ nome: 'Grelhados', categoria: 'carne' });
  });
});

describe('componentes', () => {
  test('ImagemDoPrato mostra a fotografia quando existe', async () => {
    await render(<ImagemDoPrato prato={{ nome: 'Bitoque', categoria: 'carne', foto_url: 'https://exemplo.pt/bitoque.jpg' }} />);
    expect(screen.getByTestId('foto-do-prato').props.source).toEqual({ uri: 'https://exemplo.pt/bitoque.jpg' });
  });

  test('ImagemDoPrato sem fotografia usa a imagem 3D', async () => {
    await render(<ImagemDoPrato prato={{ nome: 'Bitoque', categoria: 'carne' }} />);
    expect(screen.getByTestId('imagem-3d-do-prato').props.source).toBe(imagemDoPrato({ nome: 'Bitoque', categoria: 'carne' }));
  });

  test('a capa diz "Hoje almoças aqui" só quando calhou ao abanar', async () => {
    await render(<CapaQuente prato={{ nome: 'Frango assado', categoria: 'carne' }} calhou />);
    expect(screen.getByText('HOJE ALMOÇAS AQUI')).toBeTruthy();
    expect(screen.getByLabelText('Prato de hoje: Frango assado')).toBeTruthy();

    await render(<CapaQuente prato={{ nome: 'Frango assado', categoria: 'carne' }} />);
    expect(screen.queryByText('HOJE ALMOÇAS AQUI')).toBeNull();
  });
});
