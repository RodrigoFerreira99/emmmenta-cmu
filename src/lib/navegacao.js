// Primeiro ecrã de cada percurso da app (Figura 2 do relatório).
// É usado em src/app/_layout.js para dizer ao router para onde mandar quem está num ecrã
// que deixou de poder ver (por exemplo, acabou de entrar e ainda está no login).
//
// Tem de ser indicado à mão: sozinho, o router mandava as contas de restaurante para
// "/(restaurante)", que não existe (o grupo não tem ecrã "index") e dava "Unmatched Route".
// O teste tests/navegacao.test.js confirma que estes três caminhos existem em src/app.

/** tipoDeConta: 'cliente', 'restaurante' ou null (sem sessão). */
export function rotaInicial(tipoDeConta) {
  if (!tipoDeConta) return '/login';
  return tipoDeConta === 'restaurante' ? '/painel' : '/';
}
