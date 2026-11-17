// Datas e horas no fuso de Portugal continental (RN01: um menu só vale no dia em que é publicado).
//
// Usamos sempre o fuso "Europe/Lisbon", e não a hora do telemóvel, para o "hoje" da app ser o
// mesmo "hoje" da base de dados (a coluna menus.dia também é calculada no fuso de Lisboa).
// Intl.DateTimeFormat faz as contas do fuso e da hora de verão por nós.

const FUSO = 'Europe/Lisbon';

// Devolve os pedaços de uma data já no fuso de Lisboa, por exemplo { year: '2026', month: '11', day: '15' }.
function partes(data, opcoes) {
  const lista = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, ...opcoes }).formatToParts(data);
  return Object.fromEntries(lista.map((parte) => [parte.type, parte.value]));
}

/** O dia de hoje em Lisboa, no formato da base de dados: "2026-11-15". */
export function hojeEmLisboa(agora = new Date()) {
  const { year, month, day } = partes(agora, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${year}-${month}-${day}`;
}

/** O dia por extenso, para mostrar no ecrã: "domingo, 15 de novembro". */
export function diaPorExtenso(agora = new Date()) {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long' }).format(agora);
}

/**
 * Um dia da base de dados ("2026-11-14") dito como se fala: "hoje", "ontem" ou "sexta-feira, 13 de novembro".
 * "agora" só serve para os testes poderem fixar o dia de hoje.
 */
export function descreverDia(diaIso, agora = new Date()) {
  const [ano, mes, dia] = diaIso.split('-').map(Number);
  const [anoHoje, mesHoje, diaHoje] = hojeEmLisboa(agora).split('-').map(Number);
  // diferença em dias inteiros entre as duas datas (contas feitas em UTC, sem horas pelo meio)
  const diferenca = (Date.UTC(anoHoje, mesHoje - 1, diaHoje) - Date.UTC(ano, mes - 1, dia)) / (24 * 60 * 60 * 1000);
  if (diferenca === 0) return 'hoje';
  if (diferenca === 1) return 'ontem';
  // o meio-dia em UTC cai sempre nesse mesmo dia em Lisboa (Lisboa está a 0 ou a +1 hora de UTC)
  return diaPorExtenso(new Date(Date.UTC(ano, mes - 1, dia, 12)));
}

/** A hora (em Lisboa) de um instante guardado na base de dados: "2026-11-15T10:12:00+00:00" → "10h12". */
export function horaCurta(instante) {
  const { hour, minute } = partes(new Date(instante), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${hour}h${minute}`;
}

/** "Bom dia", "Boa tarde" ou "Boa noite", conforme a hora em Lisboa. */
export function saudacao(agora = new Date()) {
  const hora = Number(partes(agora, { hour: '2-digit', hourCycle: 'h23' }).hour);
  if (hora >= 6 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 20) return 'Boa tarde';
  return 'Boa noite';
}
