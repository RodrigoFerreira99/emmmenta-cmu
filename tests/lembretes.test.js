import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { LembreteDiario } from '@/components/LembreteDiario';
import { desligarLembrete, horaParaTexto, lerHoraDoGatilho, lerLembrete, ligarLembrete } from '@/lib/lembretes';

// Lembretes diários (notificações locais) — testes a src/lib/lembretes.js e ao cartão LembreteDiario.
// As notificações do telemóvel são simuladas: mockNotificacoes guarda o que ficou agendado. Correr com: npm test

const mockNotificacoes = { agendadas: [], permissao: { granted: true }, pedida: { granted: true } };

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => mockNotificacoes.permissao),
  requestPermissionsAsync: jest.fn(async () => mockNotificacoes.pedida),
  getAllScheduledNotificationsAsync: jest.fn(async () => mockNotificacoes.agendadas),
  scheduleNotificationAsync: jest.fn(async ({ identifier, content, trigger }) => {
    mockNotificacoes.agendadas = [...mockNotificacoes.agendadas.filter((a) => a.identifier !== identifier), { identifier, content, trigger }];
    return identifier;
  }),
  cancelScheduledNotificationAsync: jest.fn(async (identifier) => {
    mockNotificacoes.agendadas = mockNotificacoes.agendadas.filter((a) => a.identifier !== identifier);
  }),
}));
jest.mock('@/lib/vibrar', () => ({ vibrarLeve: jest.fn(), vibrarSucesso: jest.fn(), vibrarSelecao: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockNotificacoes.agendadas = [];
  mockNotificacoes.permissao = { granted: true };
  mockNotificacoes.pedida = { granted: true };
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('contas e textos', () => {
  test('horaParaTexto', () => {
    expect(horaParaTexto({ hora: 12, minuto: 0 })).toBe('12h00');
    expect(horaParaTexto({ hora: 9, minuto: 30 })).toBe('9h30');
  });

  test('lerHoraDoGatilho percebe o Android e o iPhone', () => {
    expect(lerHoraDoGatilho({ type: 'daily', hour: 12, minute: 30 })).toEqual({ hora: 12, minuto: 30 });
    expect(lerHoraDoGatilho({ type: 'calendar', dateComponents: { hour: 11, minute: 0 } })).toEqual({ hora: 11, minuto: 0 });
    expect(lerHoraDoGatilho({ type: 'timeInterval', seconds: 60 })).toBeNull();
    expect(lerHoraDoGatilho(null)).toBeNull();
  });
});

describe('ligar e desligar', () => {
  test('agenda um lembrete diário à hora escolhida, e lerLembrete encontra-o', async () => {
    await ligarLembrete('almoco', { hora: 12, minuto: 30 });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'lembrete-do-almoco',
      content: expect.objectContaining({ title: 'Hora de almoçar' }),
      trigger: { type: 'daily', hour: 12, minute: 30, channelId: 'lembretes' },
    });
    await expect(lerLembrete('almoco')).resolves.toEqual({ hora: 12, minuto: 30 });
    await expect(lerLembrete('publicar')).resolves.toBeNull(); // o outro lembrete continua desligado
  });

  test('mudar a hora não deixa dois lembretes do mesmo tipo', async () => {
    await ligarLembrete('almoco', { hora: 12, minuto: 0 });
    await ligarLembrete('almoco', { hora: 13, minuto: 0 });
    expect(mockNotificacoes.agendadas).toHaveLength(1);
    await expect(lerLembrete('almoco')).resolves.toEqual({ hora: 13, minuto: 0 });
  });

  test('sem permissão, explica e não agenda nada', async () => {
    mockNotificacoes.permissao = { granted: false };
    mockNotificacoes.pedida = { granted: false };
    await expect(ligarLembrete('almoco', { hora: 12, minuto: 0 })).rejects.toThrow('Sem a permissão das notificações');
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('no Android cria primeiro o canal (sem canal, o Android 13 nem mostra o pedido de permissão)', async () => {
    const original = Platform.OS;
    Platform.OS = 'android';
    try {
      await ligarLembrete('publicar', { hora: 10, minuto: 0 });
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('lembretes', expect.objectContaining({ name: 'Lembretes' }));
    } finally {
      Platform.OS = original;
    }
  });

  test('desligar cancela o lembrete', async () => {
    await ligarLembrete('almoco', { hora: 12, minuto: 0 });
    await desligarLembrete('almoco');
    await expect(lerLembrete('almoco')).resolves.toBeNull();
  });
});

describe('LembreteDiario (o cartão na Conta e no Perfil)', () => {
  const abrir = () => render(<LembreteDiario tipo="almoco" titulo="Lembrete do almoço" descricao="Um aviso todos os dias." />);

  test('ligar, mudar a hora e desligar', async () => {
    await abrir();
    const interruptor = screen.getByLabelText('Lembrete do almoço');
    expect(screen.getByText('Um aviso todos os dias.')).toBeTruthy();

    await fireEvent(interruptor, 'valueChange', true);
    expect(await screen.findByText('Todos os dias às 12h00.')).toBeTruthy();
    expect(mockNotificacoes.agendadas).toHaveLength(1);

    await fireEvent.press(screen.getByRole('radio', { name: '12h30' }));
    expect(await screen.findByText('Todos os dias às 12h30.')).toBeTruthy();
    expect(mockNotificacoes.agendadas[0].trigger).toMatchObject({ hour: 12, minute: 30 });

    await fireEvent(screen.getByLabelText('Lembrete do almoço'), 'valueChange', false);
    expect(await screen.findByText('Um aviso todos os dias.')).toBeTruthy();
    expect(mockNotificacoes.agendadas).toHaveLength(0);
  });

  test('ao abrir, mostra o lembrete que já estava ligado', async () => {
    mockNotificacoes.agendadas = [{ identifier: 'lembrete-do-almoco', trigger: { type: 'daily', hour: 13, minute: 0 } }];
    await abrir();
    expect(await screen.findByText('Todos os dias às 13h00.')).toBeTruthy();
  });

  test('sem permissão, a mensagem aparece no cartão e o interruptor continua desligado', async () => {
    mockNotificacoes.permissao = { granted: false };
    mockNotificacoes.pedida = { granted: false };
    await abrir();
    await fireEvent(screen.getByLabelText('Lembrete do almoço'), 'valueChange', true);
    expect(await screen.findByText(/Sem a permissão das notificações/)).toBeTruthy();
    expect(screen.getByLabelText('Lembrete do almoço').props.value).toBe(false);
  });
});
