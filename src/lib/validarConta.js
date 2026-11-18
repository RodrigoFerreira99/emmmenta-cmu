// RF01 — validação do formulário de login / registo / recuperação, antes de falar com o servidor.
// É uma função simples (sem rede), por isso é fácil de testar: ver tests/validarConta.test.js.

// Formato mínimo de um email: algo@algo.algo, sem espaços.
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// O Supabase recusa palavras-passe mais curtas do que isto.
export const TAMANHO_MINIMO_PALAVRA_PASSE = 6;

/**
 * Devolve um objeto com uma mensagem por cada campo errado (objeto vazio = tudo certo).
 * "modo" diz que campos existem no ecrã:
 *   'entrar'           → email, palavraPasse
 *   'criar'            → nome, email, palavraPasse
 *   'pedirCodigo'      → email
 *   'novaPalavraPasse' → email, codigo, palavraPasse (a nova)
 */
export function validarConta({ modo, nome, email, palavraPasse, codigo }) {
  const erros = {};

  if (modo === 'criar' && !(nome ?? '').trim()) erros.nome = 'Escreve o teu nome.';

  const emailLimpo = (email ?? '').trim();
  if (!emailLimpo) erros.email = 'Escreve o teu email.';
  else if (!EMAIL_VALIDO.test(emailLimpo)) erros.email = 'Este email não parece válido.';

  // O código que chega por email só tem números (6 por omissão).
  if (modo === 'novaPalavraPasse' && !/^\d{6,10}$/.test((codigo ?? '').trim())) {
    erros.codigo = 'Escreve o código que recebeste por email (só números).';
  }

  if (modo !== 'pedirCodigo') {
    if (!palavraPasse) {
      erros.palavraPasse = 'Escreve a palavra-passe.';
    } else if (modo !== 'entrar' && palavraPasse.length < TAMANHO_MINIMO_PALAVRA_PASSE) {
      // Ao entrar não verificamos o tamanho: quem decide se está certa é o servidor.
      erros.palavraPasse = `A palavra-passe tem de ter pelo menos ${TAMANHO_MINIMO_PALAVRA_PASSE} caracteres.`;
    }
  }

  return erros;
}
