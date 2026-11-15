import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { hojeEmLisboa } from '@/lib/datas';
import * as m from '@/services/menus';

// RF03 e RF04 — testes ao serviço src/services/menus.js. Correr com: npm test
//
// O Supabase é substituído por uma imitação que regista cada pedido em mockBd.chamadas
// (tabela, operação, valores e filtros) e responde com o que estiver em mockBd.respostas.
// Assim confirmamos exatamente o que seria enviado para a base de dados, sem lhe tocar.

const mockBd = {
  chamadas: [],
  respostas: {}, // por exemplo { 'menus.upsert': { data: { id: 'm1' }, error: null } }
};

jest.mock('@/lib/supabase', () => {
  const pedido = (tabela) => {
    const chamada = { tabela, operacao: 'select', valores: undefined, opcoes: undefined, filtros: {} };
    mockBd.chamadas.push(chamada);
    const responder = () => Promise.resolve(mockBd.respostas[`${tabela}.${chamada.operacao}`] ?? { data: null, error: null });
    const mudar = (operacao) => (valores, opcoes) => {
      Object.assign(chamada, { operacao, valores, opcoes });
      return cadeia;
    };
    const filtrar = (coluna, valor) => {
      chamada.filtros[coluna] = valor;
      return cadeia;
    };
    const cadeia = {
      select: () => cadeia,
      insert: mudar('insert'),
      upsert: mudar('upsert'),
      update: mudar('update'),
      delete: mudar('delete'),
      eq: filtrar,
      in: filtrar,
      maybeSingle: responder,
      single: responder,
      // permite fazer "await" diretamente ao pedido, como no supabase-js
      then: (resolver, rejeitar) => responder().then(resolver, rejeitar),
    };
    return cadeia;
  };
  return { supabase: { from: pedido } };
});

// As operações feitas, por ordem, no formato "tabela.operacao" (mais fácil de comparar).
const operacoes = () => mockBd.chamadas.map((chamada) => `${chamada.tabela}.${chamada.operacao}`);
const chamadaDe = (operacao) => mockBd.chamadas.find((chamada) => `${chamada.tabela}.${chamada.operacao}` === operacao);

const SOPA = { id: 'p1', nome: 'Sopa de legumes', categoria: 'sopa', preco: 1.5, esgotado: false, criado_em: '2026-11-15T10:00:00Z' };
const BACALHAU = { id: 'p2', nome: 'Bacalhau à Brás', categoria: 'peixe', preco: 8.5, esgotado: true, criado_em: '2026-11-15T10:01:00Z' };
const PUDIM = { id: 'p3', nome: 'Pudim caseiro', categoria: 'sobremesa', preco: 2, esgotado: false, criado_em: '2026-11-15T10:02:00Z' };

beforeEach(() => {
  mockBd.chamadas = [];
  mockBd.respostas = {};
  jest.spyOn(console, 'warn').mockImplementation(() => {}); // os avisos técnicos são esperados nos testes de erro
});

describe('lerPreco (RN03)', () => {
  test('aceita vírgula, ponto e o símbolo do euro', () => {
    expect(m.lerPreco('8')).toBe(8);
    expect(m.lerPreco('8,5')).toBe(8.5);
    expect(m.lerPreco('8,50')).toBe(8.5);
    expect(m.lerPreco('8.50')).toBe(8.5);
    expect(m.lerPreco(' 8,50 € ')).toBe(8.5);
    expect(m.lerPreco('0')).toBe(0);
    expect(m.lerPreco(12)).toBe(12);
  });

  test('recusa o que não é um preço com até 2 casas decimais', () => {
    for (const texto of ['', '  ', 'abc', '8,555', '-3', '8,', ',5', '1 000', '12345', '8,5,0', null, undefined]) {
      expect(m.lerPreco(texto)).toBeNull();
    }
  });
});

describe('textos para o ecrã', () => {
  test('precoParaCampo escreve com vírgula e duas casas', () => {
    expect(m.precoParaCampo(8.5)).toBe('8,50');
    expect(m.precoParaCampo(10)).toBe('10,00');
    expect(m.precoParaCampo('8.5')).toBe('8,50');
    expect(m.precoParaCampo(null)).toBe('');
    expect(m.precoParaCampo(undefined)).toBe('');
  });

  test('o que precoParaCampo escreve, lerPreco volta a ler', () => {
    expect(m.lerPreco(m.precoParaCampo(8.5))).toBe(8.5);
  });

  test('nomeDaCategoria e limparNome', () => {
    expect(m.nomeDaCategoria('peixe')).toBe('Peixe');
    expect(m.nomeDaCategoria('outra')).toBe('outra');
    expect(m.limparNome('  Arroz   de pato ')).toBe('Arroz de pato');
    expect(m.limparNome(undefined)).toBe('');
  });
});

describe('validarPrato', () => {
  const CERTO = { nome: 'Arroz de pato', preco: '9,50', categoria: 'carne' };

  test('um prato completo não dá erros', () => {
    expect(m.validarPrato(CERTO)).toEqual({});
  });

  test('formulário vazio: faltam o nome, o preço e a categoria', () => {
    expect(Object.keys(m.validarPrato({ nome: '', preco: '', categoria: null })).sort()).toEqual(['categoria', 'nome', 'preco']);
  });

  test('nome: obrigatório, entre 2 e 60 caracteres', () => {
    for (const nome of ['', '   ', 'A', 'a'.repeat(61)]) {
      expect(m.validarPrato({ ...CERTO, nome }).nome).toBeTruthy();
    }
    expect(m.validarPrato({ ...CERTO, nome: 'a'.repeat(60) })).toEqual({});
  });

  test('preço: obrigatório, válido e maior do que zero', () => {
    expect(m.validarPrato({ ...CERTO, preco: '' }).preco).toMatch(/Escreve o preço/);
    expect(m.validarPrato({ ...CERTO, preco: 'abc' }).preco).toMatch(/não é válido/);
    expect(m.validarPrato({ ...CERTO, preco: '0' }).preco).toMatch(/maior do que zero/);
    expect(m.validarPrato({ ...CERTO, preco: '0,01' })).toEqual({});
  });

  test('categoria: tem de ser uma das cinco da base de dados', () => {
    expect(m.validarPrato({ ...CERTO, categoria: 'bebida' }).categoria).toBeTruthy();
    for (const categoria of ['sopa', 'carne', 'peixe', 'vegetariano', 'sobremesa']) {
      expect(m.validarPrato({ ...CERTO, categoria })).toEqual({});
    }
  });
});

describe('ordenarPratos', () => {
  test('põe por ordem de menu (sopa primeiro, sobremesa no fim)', () => {
    expect(m.ordenarPratos([PUDIM, BACALHAU, SOPA]).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  test('na mesma categoria, primeiro o que foi criado primeiro', () => {
    const outroPeixe = { ...BACALHAU, id: 'p9', nome: 'Dourada', criado_em: '2026-11-15T09:00:00Z' };
    expect(m.ordenarPratos([BACALHAU, outroPeixe]).map((p) => p.id)).toEqual(['p9', 'p2']);
  });

  test('não altera a lista original', () => {
    const lista = [PUDIM, SOPA];
    m.ordenarPratos(lista);
    expect(lista.map((p) => p.id)).toEqual(['p3', 'p1']);
  });
});

describe('calcularAlteracoes', () => {
  const guardados = [SOPA, BACALHAU, PUDIM];

  test('sem mexer em nada não há nada para fazer', () => {
    expect(m.calcularAlteracoes(guardados, guardados)).toEqual({ aCriar: [], aAtualizar: [], aApagar: [] });
    expect(m.haAlteracoesNosPratos(guardados, guardados)).toBe(false);
  });

  test('prato novo (sem id) é para criar', () => {
    const novo = { nome: 'Arroz de pato', categoria: 'carne', preco: 9.5 };
    expect(m.calcularAlteracoes(guardados, [...guardados, novo])).toEqual({ aCriar: [novo], aAtualizar: [], aApagar: [] });
  });

  test('prato com nome, categoria ou preço diferente é para atualizar', () => {
    const doEcra = [{ ...SOPA, preco: 2 }, { ...BACALHAU, nome: 'Bacalhau com natas' }, { ...PUDIM, categoria: 'vegetariano' }];
    const { aCriar, aAtualizar, aApagar } = m.calcularAlteracoes(guardados, doEcra);
    expect(aCriar).toEqual([]);
    expect(aApagar).toEqual([]);
    expect(aAtualizar).toEqual([
      { id: 'p1', nome: 'Sopa de legumes', categoria: 'sopa', preco: 2 },
      { id: 'p2', nome: 'Bacalhau com natas', categoria: 'peixe', preco: 8.5 },
      { id: 'p3', nome: 'Pudim caseiro', categoria: 'vegetariano', preco: 2 },
    ]);
  });

  test('atualizar nunca envia o "esgotado" (fica como estava na base de dados)', () => {
    const { aAtualizar } = m.calcularAlteracoes(guardados, [{ ...BACALHAU, preco: 9 }, SOPA, PUDIM]);
    expect(aAtualizar).toEqual([{ id: 'p2', nome: 'Bacalhau à Brás', categoria: 'peixe', preco: 9 }]);
    expect(aAtualizar[0]).not.toHaveProperty('esgotado');
  });

  test('prato retirado do ecrã é para apagar', () => {
    expect(m.calcularAlteracoes(guardados, [SOPA, PUDIM])).toEqual({ aCriar: [], aAtualizar: [], aApagar: ['p2'] });
    expect(m.haAlteracoesNosPratos(guardados, [SOPA, PUDIM])).toBe(true);
  });

  test('o mesmo preço como texto ou número não conta como alteração', () => {
    const daBaseDeDados = [{ ...SOPA, preco: '1.50' }];
    expect(m.haAlteracoesNosPratos(daBaseDeDados, [{ ...SOPA, preco: 1.5 }])).toBe(false);
  });

  test('prato com um id que já não existe na base de dados volta a ser criado', () => {
    const fantasma = { id: 'apagado-noutro-telemovel', nome: 'Dourada', categoria: 'peixe', preco: 11 };
    expect(m.calcularAlteracoes([SOPA], [SOPA, fantasma])).toEqual({
      aCriar: [{ nome: 'Dourada', categoria: 'peixe', preco: 11 }],
      aAtualizar: [],
      aApagar: [],
    });
  });
});

describe('buscarMenuDeHoje', () => {
  test('pede o menu deste restaurante com o dia de hoje em Lisboa (RN01)', async () => {
    await m.buscarMenuDeHoje('r1');
    expect(operacoes()).toEqual(['menus.select']);
    expect(mockBd.chamadas[0].filtros).toEqual({ restaurante_id: 'r1', dia: hojeEmLisboa() });
  });

  test('devolve null quando hoje ainda não há menu', async () => {
    await expect(m.buscarMenuDeHoje('r1')).resolves.toBeNull();
  });

  test('devolve o menu com os pratos ordenados', async () => {
    mockBd.respostas['menus.select'] = { data: { id: 'm1', dia: '2026-11-15', publicado_em: 'x', preco_menu_completo: 10, pratos: [PUDIM, SOPA, BACALHAU] }, error: null };
    const menu = await m.buscarMenuDeHoje('r1');
    expect(menu.id).toBe('m1');
    expect(menu.pratos.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  test('sem rede dá uma mensagem clara em português', async () => {
    mockBd.respostas['menus.select'] = { data: null, error: { message: 'TypeError: Network request failed' } };
    await expect(m.buscarMenuDeHoje('r1')).rejects.toThrow('Sem ligação à internet');
  });
});

describe('publicarMenu', () => {
  const NOVO = { nome: 'Arroz de pato', categoria: 'carne', preco: 9.5 };

  test('sem pratos não publica nem fala com a base de dados', async () => {
    await expect(m.publicarMenu('r1', { pratos: [] })).rejects.toThrow('pelo menos um prato');
    expect(mockBd.chamadas).toEqual([]);
  });

  test('primeira publicação: cria o menu e os pratos', async () => {
    mockBd.respostas['menus.upsert'] = { data: { id: 'm1' }, error: null };
    mockBd.respostas['pratos.select'] = { data: [], error: null };
    mockBd.respostas['menus.select'] = { data: { id: 'm1', pratos: [SOPA] }, error: null };

    const menu = await m.publicarMenu('r1', { precoMenuCompleto: 10, pratos: [NOVO] });

    // menu → pratos guardados → criar → voltar a ler o menu
    expect(operacoes()).toEqual(['menus.upsert', 'pratos.select', 'pratos.insert', 'menus.select']);

    // O dia e a hora NÃO são enviados: é a base de dados que os preenche, no fuso de Lisboa (RN01).
    expect(chamadaDe('menus.upsert').valores).toEqual({ restaurante_id: 'r1', preco_menu_completo: 10 });
    // Um só menu por restaurante e dia: se já existir, é atualizado em vez de duplicado.
    expect(chamadaDe('menus.upsert').opcoes).toEqual({ onConflict: 'restaurante_id,dia' });

    expect(chamadaDe('pratos.insert').valores).toEqual([{ ...NOVO, menu_id: 'm1' }]);
    expect(menu).toEqual({ id: 'm1', pratos: [SOPA] });
  });

  test('sem preço de menu completo vai null', async () => {
    mockBd.respostas['menus.upsert'] = { data: { id: 'm1' }, error: null };
    mockBd.respostas['pratos.select'] = { data: [], error: null };
    await m.publicarMenu('r1', { pratos: [NOVO] });
    expect(chamadaDe('menus.upsert').valores.preco_menu_completo).toBeNull();
  });

  test('editar: cria os novos, altera os que mudaram e apaga os retirados, por esta ordem', async () => {
    mockBd.respostas['menus.upsert'] = { data: { id: 'm1' }, error: null };
    mockBd.respostas['pratos.select'] = { data: [SOPA, BACALHAU, PUDIM], error: null };

    // no ecrã: a sopa ficou igual, o bacalhau mudou de preço, o pudim saiu e entrou o arroz
    await m.publicarMenu('r1', { pratos: [SOPA, { ...BACALHAU, preco: 9 }, NOVO] });

    expect(operacoes()).toEqual(['menus.upsert', 'pratos.select', 'pratos.insert', 'pratos.upsert', 'pratos.delete', 'menus.select']);
    expect(chamadaDe('pratos.insert').valores).toEqual([{ ...NOVO, menu_id: 'm1' }]);
    expect(chamadaDe('pratos.upsert').valores).toEqual([{ id: 'p2', nome: 'Bacalhau à Brás', categoria: 'peixe', preco: 9, menu_id: 'm1' }]);
    expect(chamadaDe('pratos.upsert').opcoes).toEqual({ onConflict: 'id' });
    expect(chamadaDe('pratos.delete').filtros).toEqual({ id: ['p3'] });
  });

  test('editar sem mexer nos pratos não cria, altera nem apaga nada', async () => {
    mockBd.respostas['menus.upsert'] = { data: { id: 'm1' }, error: null };
    mockBd.respostas['pratos.select'] = { data: [SOPA, BACALHAU], error: null };
    await m.publicarMenu('r1', { pratos: [SOPA, BACALHAU] });
    expect(operacoes()).toEqual(['menus.upsert', 'pratos.select', 'menus.select']);
  });

  test('se criar os pratos falhar, nada é apagado', async () => {
    mockBd.respostas['menus.upsert'] = { data: { id: 'm1' }, error: null };
    mockBd.respostas['pratos.select'] = { data: [SOPA, PUDIM], error: null };
    mockBd.respostas['pratos.insert'] = { data: null, error: { message: 'TypeError: Network request failed' } };

    await expect(m.publicarMenu('r1', { pratos: [SOPA, NOVO] })).rejects.toThrow('Sem ligação à internet');
    expect(operacoes()).toEqual(['menus.upsert', 'pratos.select', 'pratos.insert']); // parou aqui: o pudim não foi apagado
  });

  test('outra conta a tentar publicar recebe "sem permissão" (RN02)', async () => {
    mockBd.respostas['menus.upsert'] = { data: null, error: { message: 'new row violates row-level security policy for table "menus"', code: '42501' } };
    await expect(m.publicarMenu('r1', { pratos: [NOVO] })).rejects.toThrow('Não tens permissão');
    expect(operacoes()).toEqual(['menus.upsert']);
  });
});

describe('marcarEsgotado (RF04)', () => {
  test('altera só a coluna "esgotado" do prato indicado', async () => {
    mockBd.respostas['pratos.update'] = { data: { id: 'p2', esgotado: true }, error: null };
    await expect(m.marcarEsgotado('p2', true)).resolves.toEqual({ id: 'p2', esgotado: true });
    expect(operacoes()).toEqual(['pratos.update']);
    expect(mockBd.chamadas[0].valores).toEqual({ esgotado: true });
    expect(mockBd.chamadas[0].filtros).toEqual({ id: 'p2' });
  });

  test('também serve para voltar a pôr disponível', async () => {
    mockBd.respostas['pratos.update'] = { data: { id: 'p2', esgotado: false }, error: null };
    await m.marcarEsgotado('p2', false);
    expect(mockBd.chamadas[0].valores).toEqual({ esgotado: false });
  });

  test('um erro chega em português', async () => {
    mockBd.respostas['pratos.update'] = { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
    await expect(m.marcarEsgotado('p2', true)).rejects.toThrow('Ocorreu um erro inesperado');
  });
});
