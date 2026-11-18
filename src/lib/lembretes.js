import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Lembretes diários (o "trabalho futuro: notificações" do relatório).
//
// São notificações LOCAIS: é o próprio telemóvel que as agenda e mostra, todos os dias à hora
// escolhida. Não passam por nenhum servidor, por isso funcionam no Expo Go (no Expo Go para Android
// só as notificações remotas, "push", é que deixaram de funcionar) e não há nada para guardar na
// base de dados. Há dois lembretes:
//   - almoço   (clientes):     "Hora de almoçar: já viste os pratos do dia perto de ti?"
//   - publicar (restaurantes): "Já publicaste o menu de hoje?"

export const LEMBRETES = {
  almoco: {
    id: 'lembrete-do-almoco',
    horas: [
      { hora: 11, minuto: 30 },
      { hora: 12, minuto: 0 },
      { hora: 12, minuto: 30 },
      { hora: 13, minuto: 0 },
    ],
    conteudo: { title: 'Hora de almoçar', body: 'Já viste os pratos do dia perto de ti? Abre a Emmmenta e escolhe.' },
  },
  publicar: {
    id: 'lembrete-de-publicar',
    horas: [
      { hora: 9, minuto: 30 },
      { hora: 10, minuto: 0 },
      { hora: 10, minuto: 30 },
      { hora: 11, minuto: 0 },
    ],
    conteudo: { title: 'Menu do dia', body: 'Já publicaste o menu de hoje? Os clientes perto de ti estão a escolher onde almoçar.' },
  },
};

// No Android, cada notificação pertence a um "canal" (o utilizador pode desligar cada canal nas definições).
const CANAL = 'lembretes';

/** { hora: 12, minuto: 0 } → "12h00". */
export function horaParaTexto({ hora, minuto }) {
  return `${hora}h${String(minuto).padStart(2, '0')}`;
}

/**
 * Lê a hora de um lembrete agendado (a forma muda conforme o sistema: no Android vem { hour, minute },
 * no iPhone pode vir dentro de "dateComponents"). Devolve { hora, minuto } ou null.
 */
export function lerHoraDoGatilho(gatilho) {
  const hora = gatilho?.hour ?? gatilho?.dateComponents?.hour;
  const minuto = gatilho?.minute ?? gatilho?.dateComponents?.minute ?? 0;
  return Number.isInteger(hora) ? { hora, minuto } : null;
}

/** Como aparecem as notificações com a app aberta: com o aviso no topo, sem som. Chamado uma vez, ao abrir. */
export function prepararNotificacoes() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

/** A hora do lembrete ("almoco" ou "publicar") se estiver ligado, ou null. */
export async function lerLembrete(tipo) {
  if (Platform.OS === 'web') return null;
  try {
    const agendados = await Notifications.getAllScheduledNotificationsAsync();
    const meu = agendados.find((pedido) => pedido.identifier === LEMBRETES[tipo].id);
    return meu ? lerHoraDoGatilho(meu.trigger) : null;
  } catch (erro) {
    console.warn('Erro técnico (ler lembrete):', erro?.message ?? erro);
    return null;
  }
}

/**
 * Liga (ou muda a hora de) um lembrete diário. Pede a permissão das notificações se ainda não foi dada.
 * Lança um Error em português se não for possível (por exemplo, sem permissão).
 */
export async function ligarLembrete(tipo, { hora, minuto }) {
  if (Platform.OS === 'web') throw new Error('Os lembretes só funcionam na app do telemóvel.');
  const lembrete = LEMBRETES[tipo];

  // no Android 13 ou mais recente o pedido de permissão só aparece depois de existir um canal
  if (Platform.OS === 'android') {
    // o eslint não encontra o AndroidImportance (vem de um ficheiro de tipos reexportado), mas ele existe
    // eslint-disable-next-line import/namespace
    await Notifications.setNotificationChannelAsync(CANAL, { name: 'Lembretes', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const atual = await Notifications.getPermissionsAsync();
  const permissao = atual.granted ? atual : await Notifications.requestPermissionsAsync();
  if (!permissao.granted) {
    throw new Error('Sem a permissão das notificações não te podemos lembrar. Podes ligá-la nas definições do telemóvel.');
  }

  try {
    await desligarLembrete(tipo); // só pode haver um lembrete de cada tipo
    await Notifications.scheduleNotificationAsync({
      identifier: lembrete.id,
      content: lembrete.conteudo,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hora, minute: minuto, channelId: CANAL },
    });
  } catch (erro) {
    console.warn('Erro técnico (agendar lembrete):', erro?.message ?? erro);
    throw new Error('Não foi possível ligar o lembrete. Tenta outra vez.');
  }
}

/** Desliga um lembrete. Se não estava ligado, não faz nada. */
export async function desligarLembrete(tipo) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(LEMBRETES[tipo].id);
  } catch (erro) {
    console.warn('Erro técnico (desligar lembrete):', erro?.message ?? erro);
  }
}
