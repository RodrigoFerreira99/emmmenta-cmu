import { describe, expect, test } from '@jest/globals';

import { descreverDia, diaPorExtenso, hojeEmLisboa, horaCurta, saudacao } from '@/lib/datas';

// RN01 — o "hoje" da app é sempre o dia em Lisboa, seja qual for a hora do telemóvel.
// Os instantes abaixo estão em UTC (o "Z" no fim). No inverno Lisboa = UTC; no verão Lisboa = UTC+1.
// Correr com: npm test

describe('hojeEmLisboa', () => {
  test('devolve o dia no formato da base de dados (AAAA-MM-DD)', () => {
    expect(hojeEmLisboa()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hojeEmLisboa(new Date('2026-11-15T12:00:00Z'))).toBe('2026-11-15');
  });

  test('no inverno, às 23h30 em Lisboa ainda é o mesmo dia', () => {
    expect(hojeEmLisboa(new Date('2026-11-15T23:30:00Z'))).toBe('2026-11-15');
  });

  test('no verão, 23h30 UTC já são 00h30 do dia seguinte em Lisboa', () => {
    expect(hojeEmLisboa(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02');
  });

  test('o dia muda exatamente à meia-noite de Lisboa', () => {
    expect(hojeEmLisboa(new Date('2026-11-15T23:59:59Z'))).toBe('2026-11-15');
    expect(hojeEmLisboa(new Date('2026-11-16T00:00:00Z'))).toBe('2026-11-16');
  });

  test('passagem de ano', () => {
    expect(hojeEmLisboa(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-31');
    expect(hojeEmLisboa(new Date('2027-01-01T00:00:00Z'))).toBe('2027-01-01');
  });
});

describe('diaPorExtenso', () => {
  test('escreve o dia da semana, o dia e o mês em português', () => {
    expect(diaPorExtenso(new Date('2026-11-15T12:00:00Z'))).toBe('domingo, 15 de novembro');
    expect(diaPorExtenso(new Date('2026-11-03T12:00:00Z'))).toBe('terça-feira, 3 de novembro');
  });
});

describe('horaCurta', () => {
  test('mostra a hora de Lisboa no formato 10h12', () => {
    expect(horaCurta('2026-11-15T10:12:00+00:00')).toBe('10h12'); // inverno: igual a UTC
    expect(horaCurta('2026-07-01T10:12:00Z')).toBe('11h12'); // verão: mais uma hora
  });

  test('depois da meia-noite mostra 00 e não 24', () => {
    expect(horaCurta('2026-11-15T00:05:00Z')).toBe('00h05');
  });
});

describe('saudacao', () => {
  test.each([
    ['2026-11-15T08:00:00Z', 'Bom dia'],
    ['2026-11-15T11:59:00Z', 'Bom dia'],
    ['2026-11-15T12:00:00Z', 'Boa tarde'],
    ['2026-11-15T19:59:00Z', 'Boa tarde'],
    ['2026-11-15T20:00:00Z', 'Boa noite'],
    ['2026-11-15T03:00:00Z', 'Boa noite'],
  ])('%s → %s', (instante, esperado) => {
    expect(saudacao(new Date(instante))).toBe(esperado);
  });
});

describe('descreverDia', () => {
  const AGORA = new Date('2026-11-17T12:00:00Z'); // terça-feira, 17 de novembro

  test('hoje e ontem dizem-se assim mesmo', () => {
    expect(descreverDia('2026-11-17', AGORA)).toBe('hoje');
    expect(descreverDia('2026-11-16', AGORA)).toBe('ontem');
  });

  test('os outros dias vêm por extenso', () => {
    expect(descreverDia('2026-11-13', AGORA)).toBe('sexta-feira, 13 de novembro');
    expect(descreverDia('2026-10-31', AGORA)).toBe('sábado, 31 de outubro');
  });

  test('"ontem" conta pelo dia de Lisboa, não pela hora do telemóvel', () => {
    // 14 de julho às 23h30 em UTC já é 15 de julho às 00h30 em Lisboa (no verão Lisboa = UTC+1)
    expect(descreverDia('2026-07-14', new Date('2026-07-14T23:30:00Z'))).toBe('ontem');
  });

  test('a passagem de mês e de ano também conta como "ontem"', () => {
    expect(descreverDia('2026-11-30', new Date('2026-12-01T12:00:00Z'))).toBe('ontem');
    expect(descreverDia('2026-12-31', new Date('2027-01-01T12:00:00Z'))).toBe('ontem');
  });
});
