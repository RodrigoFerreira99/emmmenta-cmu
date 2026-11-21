import { describe, expect, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';

import { CORRESPONDENCIA, desenhoDoIcone } from '@/components/Icone';
import { calorDoPrato, contraste, corDoCalor } from '@/lib/cores';
import { cores, coresDeImpressao } from '@/theme';

// Design térmico: contraste das cores (RNF06), a cor do "calor" e os ícones. Correr com: npm test

describe('contraste das cores (RNF06: pelo menos 4,5:1 para texto)', () => {
  test('a conta do contraste dá os valores conhecidos', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contraste('#C2410C', '#FFFFFF')).toBeCloseTo(5.18, 1);
  });

  test.each([
    ['texto no fundo', cores.texto, cores.fundo],
    ['texto nos cartões', cores.texto, cores.superficie],
    ['texto secundário nos cartões', cores.textoSecundario, cores.superficie],
    ['texto terciário no fundo', cores.textoTerciario, cores.fundo],
    ['texto terciário nos cartões', cores.textoTerciario, cores.superficie],
    ['texto terciário nos destaques', cores.textoTerciario, cores.acentoSuave],
    ['preços (laranja) no fundo', cores.acento, cores.fundo],
    ['preços (laranja) nos cartões', cores.acento, cores.superficie],
    ['texto dos botões laranja', cores.textoInverso, cores.acento],
    ['"Últimas doses"', cores.acentoTexto, cores.acentoSuave],
    ['erros nos cartões', cores.erro, cores.superficie],
    ['"Cheio agora"', cores.erro, cores.erroSuave],
    ['"Há mesa"', cores.sucesso, cores.sucessoSuave],
    ['chip escolhido (texto escuro em fundo claro)', cores.textoInverso, cores.texto],
    ['cartaz impresso: texto', coresDeImpressao.texto, coresDeImpressao.superficie],
    ['cartaz impresso: preços', coresDeImpressao.acento, coresDeImpressao.superficie],
  ])('%s', (_, frente, fundo) => {
    expect(contraste(frente, fundo)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('a cor do calor', () => {
  test('nas pontas e a meio da paleta', () => {
    expect(corDoCalor(0)).toBe('#07040F');
    expect(corDoCalor(1)).toBe('#FFFBEA');
    expect(corDoCalor(0.74)).toBe('#F98B1F');
    expect(corDoCalor(-3)).toBe('#07040F'); // fora da escala fica na ponta
    expect(corDoCalor(0.37)).toMatch(/^#[0-9A-F]{6}$/); // entre duas cores, mistura-as
  });

  test('um prato perto está mais quente do que um longe; esgotado está frio', () => {
    expect(calorDoPrato({ distanciaKm: 0.2 })).toBe(1);
    expect(calorDoPrato({ distanciaKm: 0.8 })).toBeGreaterThan(calorDoPrato({ distanciaKm: 1.6 }));
    expect(calorDoPrato({ distanciaKm: 9 })).toBe(0.5);
    expect(calorDoPrato({ distanciaKm: 0.2, esgotado: true })).toBe(0.3);
  });
});

describe('ícones', () => {
  test('todos os nomes da correspondência têm desenho', () => {
    for (const nome of Object.keys(CORRESPONDENCIA)) expect(desenhoDoIcone(nome)).not.toBeNull();
    expect(desenhoDoIcone('nao-existe')).toBeNull();
  });

  test('todos os ícones escritos nos ecrãs existem (para nenhum ficar em branco)', () => {
    const usados = new Set();
    const andar = (pasta) => {
      for (const f of fs.readdirSync(pasta)) {
        const p = path.join(pasta, f);
        if (fs.statSync(p).isDirectory()) andar(p);
        else if (p.endsWith('.js')) {
          const t = fs.readFileSync(p, 'utf8');
          for (const m of t.matchAll(/<Icone\b[^>]*?name="([a-z0-9-]+)"/g)) usados.add(m[1]);
          for (const m of t.matchAll(/icone="([a-z0-9-]+)"/g)) usados.add(m[1]);
          for (const m of t.matchAll(/icone: '([a-z0-9-]+)'/g)) usados.add(m[1]);
          // nomes escolhidos na hora: name={favorito ? 'heart' : 'heart-outline'}
          for (const m of t.matchAll(/<Icone\b[^>]*?name=\{[^}]*?\?\s*'([a-z0-9-]+)'\s*:\s*'([a-z0-9-]+)'[^}]*\}/g)) {
            usados.add(m[1]);
            usados.add(m[2]);
          }
        }
      }
    };
    andar(path.join(__dirname, '..', 'src'));
    const semDesenho = [...usados].filter((nome) => !desenhoDoIcone(nome));
    expect(semDesenho).toEqual([]);
    expect(usados.size).toBeGreaterThan(30);
  });
});
