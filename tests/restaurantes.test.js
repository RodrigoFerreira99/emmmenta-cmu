import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Platform } from 'react-native';

import * as s from '@/services/restaurantes';

// RF02 — testes ao serviço src/services/restaurantes.js. Correr com: npm test
//
// O Supabase e os módulos do telemóvel (ficheiros, imagens, localização) são substituídos por
// imitações ("mocks") controladas pelo objeto mockEstado. Assim os testes correm no computador,
// sem rede e sem mexer na base de dados verdadeira.

const mockEstado = {
  resposta: { data: null, error: null }, // o que o "Supabase" responde
  ultimoUpsert: null, // o que foi enviado para guardar
  ultimoUpload: null, // o que foi enviado para o Storage
  tamanhos: [], // tamanho (em bytes) do ficheiro em cada tentativa de compressão
  tentativas: [], // opções usadas em cada tentativa de compressão
  permissao: false, // permissão de localização concedida?
  geocode: [], // resultado da procura da morada
  geocodeFalha: false,
  ultimaPesquisa: null,
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

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: async () => ({ granted: mockEstado.permissao }),
  requestForegroundPermissionsAsync: async () => ({ granted: mockEstado.permissao }),
  geocodeAsync: async (pesquisa) => {
    mockEstado.ultimaPesquisa = pesquisa;
    if (mockEstado.geocodeFalha) throw new Error('Not authorized to use location services');
    return mockEstado.geocode;
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
    permissao: false,
    geocode: [],
    geocodeFalha: false,
    ultimaPesquisa: null,
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
  test('a permissão só é precisa no Android (RNF04)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await expect(s.faltaPermissaoParaProcurarMorada()).resolves.toBe(true);
    mockEstado.permissao = true;
    await expect(s.faltaPermissaoParaProcurarMorada()).resolves.toBe(false);

    mockEstado.permissao = false;
    jest.replaceProperty(Platform, 'OS', 'ios');
    await expect(s.faltaPermissaoParaProcurarMorada()).resolves.toBe(false);
    jest.restoreAllMocks();
  });

  test('pedirPermissaoDeLocalizacao devolve o que o utilizador respondeu', async () => {
    await expect(s.pedirPermissaoDeLocalizacao()).resolves.toBe(false);
    mockEstado.permissao = true;
    await expect(s.pedirPermissaoDeLocalizacao()).resolves.toBe(true);
  });

  test('devolve só a latitude e a longitude, e acrescenta o país à pesquisa', async () => {
    mockEstado.geocode = [{ latitude: 41.15, longitude: -8.61, altitude: 0, accuracy: 10 }];
    await expect(s.procurarMoradaNoMapa(' Rua de Cedofeita,  123, Porto ')).resolves.toEqual({ latitude: 41.15, longitude: -8.61 });
    expect(mockEstado.ultimaPesquisa).toBe('Rua de Cedofeita, 123, Porto, Portugal');

    await s.procurarMoradaNoMapa('Rua X, Porto, Portugal');
    expect(mockEstado.ultimaPesquisa).toBe('Rua X, Porto, Portugal'); // não repete o país
  });

  test('morada que não existe devolve null (o pin põe-se à mão)', async () => {
    await expect(s.procurarMoradaNoMapa('Rua que não existe')).resolves.toBeNull();
  });

  test('morada vazia ou falha do telemóvel dão mensagens claras', async () => {
    await esperarErro(s.procurarMoradaNoMapa('   '), 'Escreve primeiro a morada');
    mockEstado.geocodeFalha = true;
    await esperarErro(s.procurarMoradaNoMapa('Rua X'), 'Não foi possível procurar a morada');
  });
});
