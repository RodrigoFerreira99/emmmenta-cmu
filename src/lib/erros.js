// Erros do Supabase (base de dados e Storage) → mensagens em português para o utilizador.
// É usado pelos serviços (src/services/restaurantes.js e src/services/menus.js):
//   try { ... if (error) throw error; ... } catch (erro) { throw traduzirErro(erro); }
// Assim os ecrãs só têm de mostrar erro.message — nunca aparece uma mensagem técnica em inglês.

/** Recebe o erro do Supabase (ou da rede) e devolve um Error com uma mensagem clara. */
export function traduzirErro(erro) {
  // a mensagem técnica fica só na consola, para quem está a programar
  console.warn('Erro técnico (Supabase):', erro?.message ?? erro);

  const mensagem = String(erro?.message ?? '').toLowerCase();
  const codigo = String(erro?.code ?? erro?.statusCode ?? '');
  const estadoHttp = Number(erro?.status ?? 0);

  if (mensagem.includes('network request failed') || mensagem.includes('failed to fetch') || mensagem.includes('timeout')) {
    return new Error('Sem ligação à internet. Verifica a rede e tenta outra vez.');
  }
  if (estadoHttp === 401 || mensagem.includes('jwt')) {
    return new Error('A tua sessão expirou. Termina a sessão e entra outra vez.');
  }
  // 42501 = a base de dados recusou por causa das regras de segurança (RLS); 403 = o mesmo no Storage
  if (codigo === '42501' || codigo === '403' || estadoHttp === 403 || mensagem.includes('row-level security')) {
    return new Error('Não tens permissão para fazer esta alteração. Só a conta de restaurante dona destes dados os pode alterar.');
  }
  if (codigo === '413' || estadoHttp === 413 || mensagem.includes('exceeded the maximum allowed size')) {
    return new Error('A fotografia é grande demais (o máximo são 500 KB).');
  }
  return new Error('Ocorreu um erro inesperado. Tenta outra vez.');
}
