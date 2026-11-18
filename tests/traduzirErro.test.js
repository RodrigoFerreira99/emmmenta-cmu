import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { traduzirErro } from '@/context/AuthContext';

// RF01 — as mensagens de erro do Supabase (em inglês) têm de chegar ao utilizador em português.
// Correr com: npm test

// O contexto importa o cliente do Supabase; aqui não é preciso, por isso fica uma imitação vazia.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('traduzirErro (autenticação)', () => {
  test('sem erro devolve null', () => {
    expect(traduzirErro(null)).toBeNull();
    expect(traduzirErro(undefined)).toBeNull();
  });

  test.each([
    ['Invalid login credentials', 'Email ou palavra-passe errados.'],
    ['Email not confirmed', 'Ainda não confirmaste o teu email.'],
    ['User already registered', 'Já existe uma conta com este email.'],
    ['Password should be at least 6 characters.', 'A palavra-passe tem de ter pelo menos 6 caracteres.'],
    ['New password should be different from the old password.', 'A nova palavra-passe tem de ser diferente da anterior.'],
    ['Token has expired or is invalid', 'O código não está certo ou já expirou.'],
    ['Email address "a@b" is invalid', 'O email não é válido.'],
    ['Unable to validate email address: invalid format', 'O email não é válido.'],
    ['Email rate limit exceeded', 'Demasiadas tentativas. Espera um minuto e tenta outra vez.'],
    ['For security purposes, you can only request this after 43 seconds.', 'Demasiadas tentativas. Espera um minuto e tenta outra vez.'],
    ['Network request failed', 'Sem ligação à internet. Verifica a rede e tenta outra vez.'],
  ])('"%s"', (mensagemDoSupabase, mensagemParaOUtilizador) => {
    expect(traduzirErro({ message: mensagemDoSupabase })).toBe(mensagemParaOUtilizador);
  });

  test('uma mensagem desconhecida nunca aparece em inglês', () => {
    expect(traduzirErro({ message: 'Database error saving new user' })).toBe('Ocorreu um erro inesperado. Tenta outra vez.');
    expect(traduzirErro({})).toBe('Ocorreu um erro inesperado. Tenta outra vez.');
  });
});
