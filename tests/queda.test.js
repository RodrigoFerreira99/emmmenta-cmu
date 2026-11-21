import { describe, expect, test } from '@jest/globals';

import { criarQueda } from '@/lib/queda';

// Física do "abanar" (src/lib/queda.js). O Matter.js corre a sério; só o "acaso" é fixo. Correr com: npm test

const sempreAMeio = () => 0.5; // sem empurrões de lado nem rotação inicial
const ECRA = { largura: 390, chao: 700 };

describe('queda das peças', () => {
  test('caem com a gravidade e ficam pousadas no chão, sem o atravessar', () => {
    const titulo = { x: 20, y: 100, largura: 300, altura: 50 };
    const queda = criarQueda({ pecas: [titulo], ...ECRA, aleatorio: sempreAMeio });

    // primeiro dá um pequeno salto para cima (o abanão solta-a) e depois cai
    expect(queda.avancar(150)[0].dy).toBeLessThan(0);
    let estado;
    for (let i = 0; i < 9; i++) estado = queda.avancar(100); // cada chamada avança no máximo 100 ms
    expect(estado[0].dy).toBeGreaterThan(0);

    let fim;
    for (let i = 0; i < 20; i++) fim = queda.avancar(100)[0]; // mais 2 segundos
    const fundoDaPeca = titulo.y + titulo.altura + fim.dy;
    expect(fundoDaPeca).toBeLessThanOrEqual(ECRA.chao + 2);
    expect(fundoDaPeca).toBeGreaterThan(ECRA.chao - 20); // está mesmo no chão
    queda.parar();
  });

  test('uma peça por cima da outra não a atravessa (amontoam-se)', () => {
    const baixo = { x: 50, y: 500, largura: 280, altura: 80 };
    const cima = { x: 50, y: 300, largura: 280, altura: 80 };
    const queda = criarQueda({ pecas: [baixo, cima], ...ECRA, aleatorio: sempreAMeio });
    let estado;
    for (let i = 0; i < 30; i++) estado = queda.avancar(100);
    const topoDeBaixo = baixo.y + estado[0].dy;
    const fundoDeCima = cima.y + cima.altura + estado[1].dy;
    expect(fundoDeCima).toBeLessThanOrEqual(topoDeBaixo + 3);
    queda.parar();
  });

  test('as paredes não deixam as peças sair do ecrã para os lados', () => {
    const aoAcaso = (() => {
      let n = 0;
      return () => [0.99, 0.01, 0.95][n++ % 3]; // empurrões fortes para o lado
    })();
    const pecas = [{ x: 300, y: 100, largura: 80, altura: 40 }];
    const queda = criarQueda({ pecas, ...ECRA, aleatorio: aoAcaso });
    let estado;
    for (let i = 0; i < 30; i++) estado = queda.avancar(100);
    const centro = pecas[0].x + pecas[0].largura / 2 + estado[0].dx;
    expect(centro).toBeGreaterThan(0);
    expect(centro).toBeLessThan(ECRA.largura);
    queda.parar();
  });
});
