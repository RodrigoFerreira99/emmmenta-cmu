import { describe, expect, test } from '@jest/globals';

import { validarConta } from '@/lib/validarConta';

// RF01 — validação do formulário de login / registo / recuperação.
// Correr com: npm test

const CERTO = { nome: 'Rita', email: 'rita@email.pt', palavraPasse: 'segredo1', codigo: '123456' };

describe('validarConta', () => {
  test('entrar: email e palavra-passe preenchidos passam', () => {
    expect(validarConta({ ...CERTO, modo: 'entrar' })).toEqual({});
  });

  test('entrar: não exige 6 caracteres (quem decide é o servidor)', () => {
    expect(validarConta({ ...CERTO, modo: 'entrar', palavraPasse: 'abc' })).toEqual({});
  });

  test('entrar: campos vazios dão um erro por campo', () => {
    const erros = validarConta({ modo: 'entrar', email: '', palavraPasse: '' });
    expect(Object.keys(erros).sort()).toEqual(['email', 'palavraPasse']);
  });

  test('email: tem de ter o formato algo@algo.algo', () => {
    for (const email of ['rita', 'rita@', 'rita@email', '@email.pt', 'ri ta@email.pt']) {
      expect(validarConta({ ...CERTO, modo: 'entrar', email }).email).toBeTruthy();
    }
    // espaços no início e no fim não contam
    expect(validarConta({ ...CERTO, modo: 'entrar', email: '  rita@email.pt ' })).toEqual({});
  });

  test('criar: pede nome e palavra-passe com 6 ou mais caracteres', () => {
    expect(validarConta({ ...CERTO, modo: 'criar' })).toEqual({});
    expect(validarConta({ ...CERTO, modo: 'criar', nome: '   ' }).nome).toBeTruthy();
    expect(validarConta({ ...CERTO, modo: 'criar', palavraPasse: '12345' }).palavraPasse).toMatch(/pelo menos 6/);
    expect(validarConta({ ...CERTO, modo: 'criar', palavraPasse: '123456' })).toEqual({});
  });

  test('pedirCodigo: só interessa o email', () => {
    expect(validarConta({ modo: 'pedirCodigo', email: 'rita@email.pt' })).toEqual({});
    expect(Object.keys(validarConta({ modo: 'pedirCodigo', email: '' }))).toEqual(['email']);
  });

  test('novaPalavraPasse: pede o código (só números) e a palavra-passe nova', () => {
    expect(validarConta({ ...CERTO, modo: 'novaPalavraPasse' })).toEqual({});
    for (const codigo of ['', '12345', 'abcdef', '12 34 56']) {
      expect(validarConta({ ...CERTO, modo: 'novaPalavraPasse', codigo }).codigo).toBeTruthy();
    }
    expect(validarConta({ ...CERTO, modo: 'novaPalavraPasse', palavraPasse: '123' }).palavraPasse).toBeTruthy();
  });

  test('aguenta campos em falta (undefined) sem rebentar', () => {
    expect(Object.keys(validarConta({ modo: 'criar' })).sort()).toEqual(['email', 'nome', 'palavraPasse']);
  });
});
