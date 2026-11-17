import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Platform } from 'react-native';

import * as s from '@/services/restaurantes';

// RF02 — testes ao serviço src/services/restaurantes.js. Correr com: npm test
//
// O Supabase, os módulos do telemóvel (ficheiros, imagens) e o serviço de moradas são substituídos por
// imitações ("mocks") controladas pelo objeto mockEstado. Assim os testes correm no computador,
// sem rede e sem mexer na base de dados verdadeira.

const mockEstado = {
  resposta: { data: null, error: null }, // o que o "Supabase" responde
  ultimoUpsert: null, // o que foi enviado para guardar
  ultimoUpload: null, // o que foi enviado para o Storage
  tamanhos: [], // tamanho (em bytes) do ficheiro em cada tentativa de compressão
  tentativas: [], // opções usadas em cada tentativa de compressão
};

jest.mock('@/lib/supabase', () => {
  // imita as chamadas em cadeia: supabase.from(...).select().eq().maybeSingle()
  const cadeia = () => {
    const c = {
      select: () => c,
      eq: () => c,
      upsert: (linha, opcoes) => {
        mockEstado.ultimoUpsert = { linha, opcoes };
        return c;
      },
      maybeSingle: async () => mockEstado.resposta,
      single: async () => mockEstado.resposta,
    };
    return c;
  };
  return {
    supabase: {
      from: () => cadeia(),
      storage: {
        from: (bucket) => ({
          upload: async (caminho, corpo, opcoes) => {
            mockEstado.ultimoUpload = { bucket, caminho, corpo, opcoes };
            return mockEstado.resposta;
          },
          getPublicUrl: (caminho) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${caminho}` } }),
        }),
      },
    },
  };
});

jest.mock('expo-file-system', () => ({
  File: class {
    constructor(uri) {
      this.uri = uri;
      this.size = mockEstado.tamanhos.shift();
    }
    async arrayBuffer() {
      return new ArrayBuffer(8);
    }
  },
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate(uri, opcoes) {
      const registo = { uri, ...opcoes };
      mockEstado.tentativas.push(registo);
      return {
        release() {},
        async renderAsync() {
          return {
            release() {},
            async saveAsync(opcoesDeGravar) {
              Object.assign(registo, opcoesDeGravar);
              return { uri: `file:///cache/${mockEstado.tentativas.length}.jpg` };
            },
          };
        },
      };
    },
  },
}));

const VALIDO = {
  nome: 'Tasca do Manuel',
  tipoCozinha: 'Portuguesa',
  morada: 'Rua de Cedofeita, 123, Porto',
  latitude: 41.1496,
  longitude: -8.611,
  horaAbertura: '12:00',
  horaFecho: '15:00',
  telefone: '222 000 000',
  fotoUrl: null,
};

// Confirma que a promessa falha com uma mensagem em português que contém "pedaco".
async function esperarErro(promessa, pedaco) {
  await expect(promessa).rejects.toThrow(pedaco);
  // nunca pode chegar ao utilizador uma mensagem técnica em inglês
  await expect(promessa).rejects.not.toThrow(/failed|violates|exceeded|unauthorized/i);
}

beforeEach(() => {
  Object.assign(mockEstado, {
    resposta: { data: null, error: null },
    ultimoUpsert: null,
    ultimoUpload: null,
    tamanhos: [],
    tentativas: [],
  });
  // os avisos técnicos na consola são esperados nos testes de erro
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('horas', () => {
  test('horaParaEcra: tira os segundos', () => {
    expect(s.horaParaEcra('12:00:00')).toBe('12:00');
    expect(s.horaParaEcra('09:30:00')).toBe('09:30');
    expect(s.horaParaEcra(null)).toBe('');
    expect(s.horaParaEcra(undefined)).toBe('');
  });

  test('horaParaBd: acrescenta os segundos; vazio dá null', () => {
    expect(s.horaParaBd('12:00')).toBe('12:00:00');
    expect(s.horaParaBd('')).toBeNull();
    expect(s.horaParaBd('  ')).toBeNull();
    expect(s.horaParaBd(undefined)).toBeNull();
  });

  test('mascararHora: põe os dois pontos enquanto se escreve', () => {
    expect(s.mascararHora('1')).toBe('1');
    expect(s.mascararHora('12')).toBe('12');
    expect(s.mascararHora('123')).toBe('12:3');
    expect(s.mascararHora('1230')).toBe('12:30');
    expect(s.mascararHora('12:30')).toBe('12:30');
    expect(s.mascararHora('12:')).toBe('12'); // apagar o 3.º dígito tira os dois pontos
    expect(s.mascararHora('123099')).toBe('12:30');
    expect(s.mascararHora('12h30')).toBe('12:30');
    expect(s.mascararHora('')).toBe('');
    expect(s.mascararHora(undefined)).toBe('');
  });

  test('mascararHora: põe o zero quando a hora só tem um dígito', () => {
    expect(s.mascararHora('9')).toBe('09');
    expect(s.mascararHora('93')).toBe('09:3');
    expect(s.mascararHora('930')).toBe('09:30');
    expect(s.mascararHora('09:30')).toBe('09:30');
    // 0, 1 e 2 podem ser o início de 0x, 1x e 2x: não se mexe
    expect(s.mascararHora('2')).toBe('2');
    expect(s.mascararHora('0')).toBe('0');
  });

  test('o que a máscara produz passa na validação', () => {
    const dados = { ...VALIDO, horaAbertura: s.mascararHora('930'), horaFecho: s.mascararHora('1500') };
    expect(s.validarRestaurante(dados)).toEqual({});
  });
});

describe('telefone', () => {
  test('normalizarTelefone: aceita os formatos habituais', () => {
    for (const escrito of ['912345678', '912 345 678', '+351 912 345 678', '00351912345678', '(912) 345-678']) {
      expect(s.normalizarTelefone(escrito)).toBe('+351912345678');
    }
    expect(s.normalizarTelefone('222 000 000')).toBe('+351222000000');
  });

  test('normalizarTelefone: recusa o que não é um número português', () => {
    for (const escrito of ['91234567', '9123456789', '812345678', '+34912345678', 'abc', '', undefined]) {
      expect(s.normalizarTelefone(escrito)).toBeNull();
    }
  });

  test('telefoneParaEcra: mostra em grupos de três', () => {
    expect(s.telefoneParaEcra('+351912345678')).toBe('912 345 678');
    expect(s.telefoneParaEcra(null)).toBe('');
    expect(s.telefoneParaEcra('12345')).toBe('12345'); // valor antigo estranho: mostra como está
  });

  test('ida e volta: o que se mostra volta a dar o que estava guardado', () => {
    expect(s.normalizarTelefone(s.telefoneParaEcra('+351222000000'))).toBe('+351222000000');
  });
});

describe('restauranteParaFormulario', () => {
  const VAZIO = {
    nome: '',
    tipoCozinha: '',
    morada: '',
    latitude: null,
    longitude: null,
    horaAbertura: '',
    horaFecho: '',
    telefone: '',
    fotoUrl: null,
  };

  test('sem restaurante devolve o formulário vazio', () => {
    expect(s.restauranteParaFormulario(null)).toEqual(VAZIO);
  });

  test('cada chamada devolve um objeto novo (o vazio não é partilhado)', () => {
    s.restauranteParaFormulario(null).nome = 'x';
    expect(s.restauranteParaFormulario(null).nome).toBe('');
  });

  test('converte a linha da base de dados', () => {
    const linha = {
      id: 'r1',
      dono_id: 'u1',
      nome: 'Tasca',
      tipo_cozinha: null,
      morada: null,
      latitude: 41.1,
      longitude: -8.6,
      hora_abertura: '12:00:00',
      hora_fecho: '15:30:00',
      telefone: '+351912345678',
      foto_url: 'https://f/x.jpg',
    };
    expect(s.restauranteParaFormulario(linha)).toEqual({
      nome: 'Tasca',
      tipoCozinha: '',
      morada: '',
      latitude: 41.1,
      longitude: -8.6,
      horaAbertura: '12:00',
      horaFecho: '15:30',
      telefone: '912 345 678',
      fotoUrl: 'https://f/x.jpg',
    });
  });

  test('guardar e voltar a ler dá o mesmo formulário (não aparecem alterações falsas)', async () => {
    mockEstado.resposta = { data: { id: 'r1' }, error: null };
    await s.guardarRestaurante('u1', VALIDO);
    // a base de dados devolve exatamente a linha que recebeu
    const lido = s.restauranteParaFormulario(mockEstado.ultimoUpsert.linha);
    expect(lido).toEqual(VALIDO);
  });
});

describe('validarRestaurante', () => {
  test('tudo certo não dá erros', () => {
    expect(s.validarRestaurante(VALIDO)).toEqual({});
  });

  test('os campos opcionais podem ficar vazios', () => {
    expect(s.validarRestaurante({ ...VALIDO, tipoCozinha: '', horaAbertura: '', horaFecho: '', telefone: '' })).toEqual({});
  });

  test('formulário vazio: faltam o nome, a morada e o ponto no mapa', () => {
    expect(Object.keys(s.validarRestaurante(s.restauranteParaFormulario(null))).sort()).toEqual(['local', 'morada', 'nome']);
  });

  test('nome: obrigatório, entre 2 e 80 caracteres, sem contar espaços a mais', () => {
    for (const nome of ['', '   ', 'A', 'a'.repeat(81)]) {
      expect(s.validarRestaurante({ ...VALIDO, nome }).nome).toBeTruthy();
    }
    expect(s.validarRestaurante({ ...VALIDO, nome: 'a'.repeat(80) })).toEqual({});
    expect(s.validarRestaurante({ ...VALIDO, nome: '  Zé  ' })).toEqual({});
  });

  test('morada obrigatória; tipo de cozinha até 40 caracteres', () => {
    expect(s.validarRestaurante({ ...VALIDO, morada: ' ' }).morada).toBeTruthy();
    expect(s.validarRestaurante({ ...VALIDO, tipoCozinha: 'x'.repeat(41) }).tipoCozinha).toBeTruthy();
  });

  test('ponto no mapa: obrigatório e dentro dos limites', () => {
    expect(s.validarRestaurante({ ...VALIDO, latitude: null, longitude: null }).local).toBeTruthy();
    expect(s.validarRestaurante({ ...VALIDO, latitude: 91 }).local).toBeTruthy();
    expect(s.validarRestaurante({ ...VALIDO, longitude: -181 }).local).toBeTruthy();
    expect(s.validarRestaurante({ ...VALIDO, latitude: NaN }).local).toBeTruthy();
    expect(s.validarRestaurante({ ...VALIDO, latitude: '41.1' }).local).toBeTruthy(); // texto não é coordenada
    expect(s.validarRestaurante({ ...VALIDO, latitude: 0, longitude: 0 })).toEqual({}); // zero é válido
  });

  test('horário: os dois campos ou nenhum, no formato HH:MM, fecho depois da abertura', () => {
    expect(s.validarRestaurante({ ...VALIDO, horaFecho: '' }).horaFecho).toBeTruthy();
    expect(s.validarRestaurante({ ...VALIDO, horaAbertura: '' }).horaAbertura).toBeTruthy();
    for (const hora of ['12', '24:00', '12:60', '9:00']) {
      expect(s.validarRestaurante({ ...VALIDO, horaAbertura: hora }).horaAbertura).toBeTruthy();
    }
    expect(s.validarRestaurante({ ...VALIDO, horaAbertura: '15:00', horaFecho: '12:00' }).horaFecho).toMatch(/depois/);
    expect(s.validarRestaurante({ ...VALIDO, horaAbertura: '12:00', horaFecho: '12:00' }).horaFecho).toMatch(/depois/);
    expect(s.validarRestaurante({ ...VALIDO, horaAbertura: '00:00', horaFecho: '23:59' })).toEqual({});
  });

  test('telefone: se estiver preenchido tem de ser válido', () => {
    expect(s.validarRestaurante({ ...VALIDO, telefone: '123' }).telefone).toBeTruthy();
    expect(s.validarRestaurante({ ...VALIDO, telefone: '+351 912 345 678' })).toEqual({});
  });
});

describe('buscarMeuRestaurante', () => {
  test('devolve null quando a conta ainda não tem restaurante', async () => {
    await expect(s.buscarMeuRestaurante('u1')).resolves.toBeNull();
  });

  test('devolve a linha quando existe', async () => {
    mockEstado.resposta = { data: { id: 'r1' }, error: null };
    await expect(s.buscarMeuRestaurante('u1')).resolves.toEqual({ id: 'r1' });
  });

  test('sem rede dá uma mensagem clara', async () => {
    mockEstado.resposta = { data: null, error: { message: 'TypeError: Network request failed', code: '' } };
    await esperarErro(s.buscarMeuRestaurante('u1'), 'Sem ligação');
  });
});

describe('guardarRestaurante', () => {
  test('envia a linha com os nomes das colunas e os valores limpos', async () => {
    mockEstado.resposta = { data: { id: 'r1' }, error: null };
    const guardado = await s.guardarRestaurante('u1', { ...VALIDO, nome: '  Tasca   do Manuel ', fotoUrl: 'https://f/x.jpg' });

    expect(guardado).toEqual({ id: 'r1' });
    // onConflict 'dono_id' é o que impede um segundo restaurante para a mesma conta
    expect(mockEstado.ultimoUpsert.opcoes).toEqual({ onConflict: 'dono_id' });
    expect(mockEstado.ultimoUpsert.linha).toEqual({
      dono_id: 'u1',
      nome: 'Tasca do Manuel',
      tipo_cozinha: 'Portuguesa',
      morada: 'Rua de Cedofeita, 123, Porto',
      latitude: 41.1496,
      longitude: -8.611,
      hora_abertura: '12:00:00',
      hora_fecho: '15:00:00',
      telefone: '+351222000000',
      foto_url: 'https://f/x.jpg',
    });
  });

  test('campos opcionais vazios vão como null', async () => {
    mockEstado.resposta = { data: { id: 'r1' }, error: null };
    await s.guardarRestaurante('u1', { ...VALIDO, tipoCozinha: ' ', horaAbertura: '', horaFecho: '', telefone: '', fotoUrl: null });
    expect(mockEstado.ultimoUpsert.linha).toMatchObject({
      tipo_cozinha: null,
      hora_abertura: null,
      hora_fecho: null,
      telefone: null,
      foto_url: null,
    });
  });

  test('dados inválidos nunca chegam à base de dados', async () => {
    await esperarErro(s.guardarRestaurante('u1', { ...VALIDO, nome: '' }), 'campos por corrigir');
    expect(mockEstado.ultimoUpsert).toBeNull();
  });

  test.each([
    ['regras de segurança (RLS)', { message: 'new row violates row-level security policy for table "restaurantes"', code: '42501' }, 'Não tens permissão'],
    ['sem rede', { message: 'TypeError: Network request failed', code: '' }, 'Sem ligação'],
    ['sessão expirada', { message: 'JWT expired', code: 'PGRST301' }, 'sessão expirou'],
    ['erro desconhecido', { message: 'something odd', code: 'XX000' }, 'erro inesperado'],
  ])('erro traduzido: %s', async (_nome, error, pedaco) => {
    mockEstado.resposta = { data: null, error };
    await esperarErro(s.guardarRestaurante('u1', VALIDO), pedaco);
  });
});

describe('enviarFotoRestaurante', () => {
  test('se couber à primeira, envia logo (JPEG, pasta do utilizador, sem upsert)', async () => {
    mockEstado.tamanhos = [300000];
    mockEstado.resposta = { data: { path: 'x' }, error: null };
    const url = await s.enviarFotoRestaurante('u1', 'file:///foto.jpg');

    expect(mockEstado.tentativas).toEqual([{ uri: 'file:///foto.jpg', maxWidth: 1200, maxHeight: 1200, format: 'jpeg', compress: 0.7 }]);
    expect(mockEstado.ultimoUpload.bucket).toBe('fotos');
    expect(mockEstado.ultimoUpload.caminho).toMatch(/^u1\/restaurante-\d+\.jpg$/);
    expect(mockEstado.ultimoUpload.opcoes).toEqual({ contentType: 'image/jpeg', upsert: false });
    expect(mockEstado.ultimoUpload.corpo).toBeInstanceOf(ArrayBuffer);
    expect(url).toBe(`https://x.supabase.co/storage/v1/object/public/fotos/${mockEstado.ultimoUpload.caminho}`);
  });

  test('comprime mais até ficar com 500 000 bytes ou menos', async () => {
    mockEstado.tamanhos = [900000, 500001, 500000];
    mockEstado.resposta = { data: { path: 'x' }, error: null };
    await s.enviarFotoRestaurante('u1', 'file:///foto.jpg');
    expect(mockEstado.tentativas).toHaveLength(3);
    expect(mockEstado.tentativas[2]).toMatchObject({ maxWidth: 900, compress: 0.5 });
  });

  test('se nunca couber, dá erro e não envia nada', async () => {
    mockEstado.tamanhos = [900000, 800000, 700000, 600000];
    await esperarErro(s.enviarFotoRestaurante('u1', 'file:///foto.jpg'), 'menos de 500 KB');
    expect(mockEstado.tentativas).toHaveLength(4);
    expect(mockEstado.ultimoUpload).toBeNull();
  });

  test('ficheiro ilegível (tamanho 0) dá erro e não envia nada', async () => {
    mockEstado.tamanhos = [0, 0, 0, 0];
    await esperarErro(s.enviarFotoRestaurante('u1', 'file:///foto.jpg'), 'Escolhe outra imagem');
    expect(mockEstado.ultimoUpload).toBeNull();
  });

  test.each([
    ['ficheiro grande demais', { message: 'The object exceeded the maximum allowed size', status: 400, statusCode: '413' }, 'grande demais'],
    ['regras de segurança', { message: 'new row violates row-level security policy', status: 400, statusCode: '403' }, 'Não tens permissão'],
    ['sem rede', { message: 'Network request failed' }, 'Sem ligação'],
  ])('erro do Storage traduzido: %s', async (_nome, error, pedaco) => {
    mockEstado.tamanhos = [1000];
    mockEstado.resposta = { data: null, error };
    await esperarErro(s.enviarFotoRestaurante('u1', 'file:///foto.jpg'), pedaco);
  });
});

describe('procurar a morada no mapa', () => {
  // O serviço de moradas é pedido com fetch(); aqui trocamos o fetch por uma imitação.
  const fetchVerdadeiro = global.fetch;
  afterEach(() => {
    global.fetch = fetchVerdadeiro;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function servicoResponde(resultados, { ok = true, status = 200 } = {}) {
    global.fetch = jest.fn(async () => ({ ok, status, json: async () => resultados }));
  }
  // o endereço completo do último pedido, já separado em partes
  const ultimoPedido = () => new URL(global.fetch.mock.calls.at(-1)[0]);

  test('devolve a latitude e a longitude em número e procura só em Portugal', async () => {
    servicoResponde([{ lat: '41.15', lon: '-8.61', display_name: 'Rua de Cedofeita, Porto' }]);
    await expect(s.procurarMoradaNoMapa(' Rua de Cedofeita,  123, Porto ')).resolves.toEqual({ latitude: 41.15, longitude: -8.61 });

    const pedido = ultimoPedido();
    expect(pedido.origin + pedido.pathname).toBe('https://nominatim.openstreetmap.org/search');
    expect(pedido.searchParams.get('q')).toBe('Rua de Cedofeita, 123, Porto, Portugal');
    expect(pedido.searchParams.get('countrycodes')).toBe('pt');
    expect(pedido.searchParams.get('limit')).toBe('1');

    await s.procurarMoradaNoMapa('Rua X, Porto, Portugal');
    expect(ultimoPedido().searchParams.get('q')).toBe('Rua X, Porto, Portugal'); // não repete o país
  });

  test('no telemóvel a app identifica-se; no browser é o browser que o faz', async () => {
    servicoResponde([]);
    await s.procurarMoradaNoMapa('Rua X');
    expect(global.fetch.mock.calls[0][1].headers).toEqual({ 'User-Agent': 'Emmmenta/1.0' });

    jest.replaceProperty(Platform, 'OS', 'web');
    await s.procurarMoradaNoMapa('Rua X');
    expect(global.fetch.mock.calls[1][1].headers).toEqual({});
  });

  test('morada que não existe devolve null (o pin põe-se à mão)', async () => {
    servicoResponde([]);
    await expect(s.procurarMoradaNoMapa('Rua que não existe')).resolves.toBeNull();
    servicoResponde([{ lat: 'abc', lon: '' }]); // resposta estranha: também não serve
    await expect(s.procurarMoradaNoMapa('Rua X')).resolves.toBeNull();
  });

  test('morada vazia: avisa e nem chega a fazer o pedido', async () => {
    servicoResponde([]);
    await esperarErro(s.procurarMoradaNoMapa('   '), 'Escreve primeiro a morada');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('sem rede diz que não há ligação', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await esperarErro(s.procurarMoradaNoMapa('Rua X'), 'Sem ligação à internet');
  });

  test('serviço em baixo NÃO culpa a rede do utilizador', async () => {
    servicoResponde(null, { ok: false, status: 503 });
    const promessa = s.procurarMoradaNoMapa('Rua X');
    await esperarErro(promessa, 'O serviço de moradas não está a responder');
    await expect(promessa).rejects.not.toThrow(/ligação à internet/);
  });

  test('desiste ao fim de 10 segundos se a rede estiver muito lenta', async () => {
    jest.useFakeTimers();
    // um pedido que nunca responde: só termina quando a app o cancela
    global.fetch = jest.fn(
      (_endereco, { signal }) =>
        new Promise((_resolver, rejeitar) => signal.addEventListener('abort', () => rejeitar(new Error('Aborted'))))
    );
    const verificacao = expect(s.procurarMoradaNoMapa('Rua X')).rejects.toThrow('demorou demasiado');
    await jest.advanceTimersByTimeAsync(10 * 1000);
    await verificacao;
  });
});

describe('estadoDoHorario (RF06: aberto agora?)', () => {
  // em novembro Lisboa = UTC, por isso estas horas são as de Lisboa
  const as = (hora) => new Date(`2026-11-17T${hora}:00Z`);

  test('antes de abrir, durante o almoço e depois de fechar', () => {
    expect(s.estadoDoHorario('12:00:00', '15:00:00', as('11:30'))).toEqual({ aberto: false, texto: 'Fechado agora · abre às 12:00' });
    expect(s.estadoDoHorario('12:00:00', '15:00:00', as('12:00'))).toEqual({ aberto: true, texto: 'Aberto agora · fecha às 15:00' });
    expect(s.estadoDoHorario('12:00:00', '15:00:00', as('14:59'))).toEqual({ aberto: true, texto: 'Aberto agora · fecha às 15:00' });
    expect(s.estadoDoHorario('12:00:00', '15:00:00', as('15:00'))).toEqual({
      aberto: false,
      texto: 'Fechado agora · o almoço de hoje já terminou',
    });
  });

  test('conta pela hora de Lisboa, também no verão', () => {
    // 11h30 UTC em julho são 12h30 em Lisboa
    expect(s.estadoDoHorario('12:00:00', '15:00:00', new Date('2026-07-14T11:30:00Z')).aberto).toBe(true);
  });

  test('sem horário não diz nada', () => {
    expect(s.estadoDoHorario(null, null)).toBeNull();
    expect(s.estadoDoHorario('12:00:00', null)).toBeNull();
  });
});
