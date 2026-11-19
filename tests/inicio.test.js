import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import Inicio from '@/app/(cliente)/index';
import { PertoProvider } from '@/context/PertoContext';
import { estadoDaPermissao, lerLocalizacao, pedirPermissao } from '@/services/localizacao';
import { buscarPratosPerto, ouvirAlteracoesPratos } from '@/services/pratos';

// RF05 / RF07 — testes ao ecrã Início, a usar a app como um cliente faria.
// A localização do telemóvel e a base de dados são simuladas; o PertoContext é o verdadeiro.
// Correr com: npm test

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// O leitor de QR: a câmara é uma caixa que guarda a função que recebe os QR lidos; a permissão é simulada.
jest.mock('expo-camera', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return { CameraView: (props) => mockReact.createElement(View, { testID: 'camara', ...props }) };
});
jest.mock('@/lib/fotografias', () => ({ pedirAcessoACamara: jest.fn(async () => {}) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  // no teste, "ficar à frente" acontece quando o ecrã aparece e sempre que a função muda
  useFocusEffect: (efeito) => jest.requireActual('react').useEffect(efeito, [efeito]),
}));
// O acelerómetro é simulado: mockAcelerometro.ouvinte é a função que a app pôs à escuta.
const mockAcelerometro = { ouvinte: null };
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: async () => true,
    setUpdateInterval: () => {},
    addListener: (ouvinte) => {
      mockAcelerometro.ouvinte = ouvinte;
      return { remove: () => (mockAcelerometro.ouvinte = null) };
    },
  },
}));
// Os favoritos do telemóvel são simulados: mockFavoritos diz quais são.
const mockFavoritos = { ids: new Set() };
jest.mock('@/lib/favoritos', () => ({
  useFavoritos: () => ({ favoritos: mockFavoritos.ids, eFavorito: (id) => mockFavoritos.ids.has(id), alternarFavorito: jest.fn() }),
}));
jest.mock('@/services/localizacao', () => ({ estadoDaPermissao: jest.fn(), pedirPermissao: jest.fn(), lerLocalizacao: jest.fn() }));
// a lotação em tempo real ("Há mesa" / "Cheio agora") também é simulada: aoMudarLotacao guarda quem está a ouvir
const mockLotacao = { aoMudar: null };
jest.mock('@/services/menus', () => ({
  ...jest.requireActual('@/services/menus'),
  ouvirLotacao: (aoMudar) => {
    mockLotacao.aoMudar = aoMudar;
    return () => {};
  },
}));
jest.mock('@/services/pratos', () => ({
  ...jest.requireActual('@/services/pratos'),
  buscarPratosPerto: jest.fn(),
  ouvirAlteracoesPratos: jest.fn(),
}));

const TASCA = { menu_id: 'm1', restaurante_id: 'r1', restaurante: 'Tasca do Manuel', latitude: 41.15, longitude: -8.61, distancia_km: 0.35 };
const CAFE = { menu_id: 'm2', restaurante_id: 'r2', restaurante: 'Café Central', latitude: 41.16, longitude: -8.62, distancia_km: 1.4 };
const SOPA = { ...TASCA, prato_id: 'p2', prato: 'Caldo verde', categoria: 'sopa', preco: 1.8, esgotado: false };
const BACALHAU = { ...TASCA, prato_id: 'p1', prato: 'Bacalhau à Brás', categoria: 'peixe', preco: 8.5, esgotado: false };
// o cartão do bacalhau na lista (o texto que o leitor de ecrã diz começa assim)
const CARTAO_DO_BACALHAU = /^Bacalhau à Brás, Tasca do Manuel/;
const FRANCESINHA = { ...CAFE, prato_id: 'p3', prato: 'Francesinha', categoria: 'carne', preco: 9.5, esgotado: true };

const AQUI = { latitude: 41.15, longitude: -8.61 };
const SEM_FILTROS = { raioKm: 2, precoMax: null, categoria: null, etiqueta: null, pesquisa: '' };

const abrir = () =>
  render(
    <PertoProvider>
      <Inicio />
    </PertoProvider>
  );

// os filtros do último pedido feito à base de dados
const ultimoPedido = () => buscarPratosPerto.mock.calls.at(-1)[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockFavoritos.ids = new Set();
  estadoDaPermissao.mockResolvedValue('concedida');
  pedirPermissao.mockResolvedValue(true);
  lerLocalizacao.mockResolvedValue(AQUI);
  buscarPratosPerto.mockResolvedValue([SOPA, BACALHAU, FRANCESINHA]);
  ouvirAlteracoesPratos.mockReturnValue(jest.fn());
});

describe('Início — onde procurar (RF05, RNF04, RNF08)', () => {
  test('com a permissão já dada, mostra logo os pratos perto, sem perguntar nada', async () => {
    await abrir();
    expect(await screen.findByLabelText(CARTAO_DO_BACALHAU)).toBeTruthy();
    expect(pedirPermissao).not.toHaveBeenCalled();
    expect(buscarPratosPerto).toHaveBeenCalledWith({ ...AQUI, ...SEM_FILTROS }); // raio de 2 km por omissão
    expect(screen.getByText('Perto de: A minha localização')).toBeTruthy();
    expect(screen.getByText('3 pratos a menos de 2 km de ti')).toBeTruthy();
  });

  test('sem permissão: explica porque pede a localização e não pede nada sozinha', async () => {
    estadoDaPermissao.mockResolvedValue('porPedir');
    await abrir();
    expect(await screen.findByText('Onde queres almoçar?')).toBeTruthy();
    expect(screen.getByText(/A localização não fica guardada em lado nenhum/)).toBeTruthy();
    expect(pedirPermissao).not.toHaveBeenCalled(); // o pedido do sistema só aparece se o cliente carregar no botão
    expect(lerLocalizacao).not.toHaveBeenCalled();
    expect(buscarPratosPerto).not.toHaveBeenCalled();
  });

  test('"Usar a minha localização" pede a permissão ao sistema e mostra os pratos', async () => {
    estadoDaPermissao.mockResolvedValue('porPedir');
    await abrir();
    await fireEvent.press(await screen.findByRole('button', { name: 'Usar a minha localização' }));

    expect(await screen.findByText('Perto de: A minha localização')).toBeTruthy();
    expect(pedirPermissao).toHaveBeenCalledTimes(1);
    expect(ultimoPedido()).toMatchObject(AQUI);
  });

  test('se o cliente recusar a permissão, a app continua: escolhe-se a zona à mão', async () => {
    estadoDaPermissao.mockResolvedValue('porPedir');
    pedirPermissao.mockResolvedValue(false);
    await abrir();
    await fireEvent.press(await screen.findByRole('button', { name: 'Usar a minha localização' }));

    expect(await screen.findByText('Sem a permissão de localização, escolhe a zona onde queres procurar.')).toBeTruthy();
    expect(lerLocalizacao).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Procurar em Braga' }));
    expect(await screen.findByText('Perto de: Braga')).toBeTruthy();
    expect(ultimoPedido()).toMatchObject({ latitude: 41.5511, longitude: -8.428, raioKm: 2 });
    expect(await screen.findByText('3 pratos a menos de 2 km do centro de Braga')).toBeTruthy();
  });

  test('com a localização do telemóvel desligada, diz porquê e deixa escolher a zona', async () => {
    lerLocalizacao.mockRejectedValue(new Error('A localização do telemóvel está desligada. Liga-a nas definições ou escolhe a zona à mão.'));
    await abrir();
    expect(await screen.findByText(/A localização do telemóvel está desligada/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Procurar em Porto' })).toBeTruthy();
  });

  test('tocar em "Perto de" deixa mudar o sítio, ou cancelar', async () => {
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);

    await fireEvent.press(screen.getByLabelText(/Mudar o sítio/));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Perto de: A minha localização')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(/Mudar o sítio/));
    await fireEvent.press(screen.getByRole('button', { name: 'Procurar em Vila do Conde' }));
    expect(await screen.findByText('Perto de: Vila do Conde')).toBeTruthy();
    expect(ultimoPedido()).toMatchObject({ latitude: 41.354, longitude: -8.7435 });
  });
});

describe('Início — lista de pratos (RF05)', () => {
  test('cada prato mostra o preço, o restaurante e a distância; o esgotado vem marcado', async () => {
    await abrir();
    expect(await screen.findByText('Caldo verde')).toBeTruthy();
    expect(screen.getByText('1,80 €')).toBeTruthy(); // RN03
    // 2 cartões da Tasca e o destaque "o almoço mais barato" (o bacalhau é o prato principal mais barato)
    expect(screen.getAllByText('Tasca do Manuel · 350 m')).toHaveLength(3);
    expect(screen.getByText('Café Central · 1,4 km')).toBeTruthy();
    expect(screen.getAllByText('Esgotado')).toHaveLength(1);
    expect(screen.getByLabelText('Francesinha, Café Central, a 1,4 km, esgotado')).toBeTruthy();
  });

  test('tocar num prato abre a página do restaurante: 1 toque até ao menu (RNF06)', async () => {
    await abrir();
    await fireEvent.press(await screen.findByLabelText('Bacalhau à Brás, Tasca do Manuel, a 350 m, 8,50 €'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/restaurante/[id]', params: { id: 'r1', distancia: '0.35' } });
  });

  test('quando um restaurante marca um prato como esgotado, a lista muda logo (RF04)', async () => {
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);

    // o Supabase chama esta função quando um prato muda na base de dados
    const aoAlterar = ouvirAlteracoesPratos.mock.calls[0][0];
    await act(async () => aoAlterar({ id: 'p1', nome: 'Bacalhau à Brás', categoria: 'peixe', preco: 8.5, esgotado: true }));

    expect(screen.getAllByText('Esgotado')).toHaveLength(2);
    expect(screen.getByLabelText('Bacalhau à Brás, Tasca do Manuel, a 350 m, esgotado')).toBeTruthy();
  });

  test('sem pratos no raio: explica e oferece procurar mais longe (RNF08)', async () => {
    buscarPratosPerto.mockResolvedValue([]);
    await abrir();
    expect(await screen.findByText('Ainda não há pratos publicados hoje a menos de 2 km de ti.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Procurar até 5 km' }));
    await waitFor(() => expect(ultimoPedido().raioKm).toBe(5));
    expect(await screen.findByText('Ainda não há pratos publicados hoje a menos de 5 km de ti.')).toBeTruthy();
  });

  test('sem rede: mostra a mensagem e deixa tentar outra vez (RNF08)', async () => {
    buscarPratosPerto.mockRejectedValueOnce(new Error('Sem ligação à internet. Verifica a rede e tenta outra vez.'));
    await abrir();
    expect(await screen.findByText('Sem ligação à internet. Verifica a rede e tenta outra vez.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByLabelText(CARTAO_DO_BACALHAU)).toBeTruthy();
    // voltar a procurar também volta a ler a localização: o cliente pode ter andado entretanto
    expect(lerLocalizacao).toHaveBeenCalledTimes(2);
  });
});

describe('Início — filtros e pesquisa (RF07)', () => {
  test('escolher uma categoria volta a procurar só essa categoria', async () => {
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);

    await fireEvent.press(screen.getByRole('radio', { name: 'Peixe' }));
    await waitFor(() => expect(ultimoPedido()).toEqual({ ...AQUI, ...SEM_FILTROS, categoria: 'peixe' }));

    await fireEvent.press(screen.getByRole('radio', { name: 'Tudo' }));
    await waitFor(() => expect(ultimoPedido().categoria).toBeNull());
  });

  test('o painel dos filtros tem o preço máximo e o raio, e "Limpar filtros" repõe tudo', async () => {
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);
    expect(screen.queryByText('Preço máximo')).toBeNull(); // o painel começa fechado

    await fireEvent.press(screen.getByLabelText('Mostrar a ordem e os filtros de preço, distância, dieta e favoritos'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Até 8 €' }));
    await waitFor(() => expect(ultimoPedido().precoMax).toBe(8));

    await fireEvent.press(screen.getByRole('radio', { name: 'Até 5 km' }));
    await waitFor(() => expect(ultimoPedido()).toEqual({ ...AQUI, ...SEM_FILTROS, precoMax: 8, raioKm: 5 }));

    await fireEvent.press(screen.getByRole('button', { name: 'Limpar filtros' }));
    await waitFor(() => expect(ultimoPedido()).toEqual({ ...AQUI, ...SEM_FILTROS }));
  });

  test('a pesquisa pelo nome espera que se pare de escrever antes de procurar', async () => {
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);
    const pedidosAntes = buscarPratosPerto.mock.calls.length;

    await fireEvent.changeText(screen.getByLabelText('Procurar pelo nome do prato'), 'bac');
    await fireEvent.changeText(screen.getByLabelText('Procurar pelo nome do prato'), 'bacalhau');
    expect(buscarPratosPerto.mock.calls.length).toBe(pedidosAntes); // ainda não procurou: está à espera

    await waitFor(() => expect(ultimoPedido().pesquisa).toBe('bacalhau'));
    expect(buscarPratosPerto.mock.calls.length).toBe(pedidosAntes + 1); // um só pedido, não um por letra
  });

  test('sem resultados com filtros: diz que nada corresponde e deixa limpar os filtros', async () => {
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);
    buscarPratosPerto.mockResolvedValue([]);

    await fireEvent.press(screen.getByRole('radio', { name: 'Vegetariano' }));
    expect(await screen.findByText('Nenhum prato de hoje corresponde ao que procuras a menos de 2 km de ti.')).toBeTruthy();

    buscarPratosPerto.mockResolvedValue([SOPA]);
    await fireEvent.press(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(await screen.findByText('1 prato a menos de 2 km de ti')).toBeTruthy();
  });
});

describe('Início — favoritos', () => {
  test('os pratos dos restaurantes favoritos têm um coração', async () => {
    mockFavoritos.ids = new Set(['r2']);
    await abrir();
    expect(await screen.findByLabelText('Francesinha, Café Central (favorito), a 1,4 km, esgotado')).toBeTruthy();
    expect(screen.getByLabelText('Bacalhau à Brás, Tasca do Manuel, a 350 m, 8,50 €')).toBeTruthy();
  });

  test('"Só os meus favoritos" mostra só esses restaurantes, sem voltar à base de dados', async () => {
    mockFavoritos.ids = new Set(['r1']);
    await abrir();
    await screen.findByText('Francesinha');
    const pedidosAntes = buscarPratosPerto.mock.calls.length;

    await fireEvent.press(screen.getByLabelText('Mostrar a ordem e os filtros de preço, distância, dieta e favoritos'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Só os meus favoritos' }));

    expect(screen.queryByText('Francesinha')).toBeNull(); // o Café Central não é favorito
    expect(screen.getByLabelText(CARTAO_DO_BACALHAU)).toBeTruthy();
    expect(screen.getByText('2 pratos a menos de 2 km de ti')).toBeTruthy();
    expect(buscarPratosPerto.mock.calls.length).toBe(pedidosAntes); // filtrou o que já tinha

    await fireEvent.press(screen.getByRole('radio', { name: 'Todos' }));
    expect(screen.getByText('Francesinha')).toBeTruthy();
  });

  test('sem favoritos, explica como os guardar', async () => {
    await abrir();
    await screen.findByText('Francesinha');
    await fireEvent.press(screen.getByLabelText('Mostrar a ordem e os filtros de preço, distância, dieta e favoritos'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Só os meus favoritos' }));
    expect(screen.getByText('Ainda não tens restaurantes favoritos. Abre um restaurante e toca no coração para o guardar.')).toBeTruthy();
  });

  test('favoritos sem pratos de hoje por perto', async () => {
    mockFavoritos.ids = new Set(['outro-restaurante']);
    await abrir();
    await screen.findByText('Francesinha');
    await fireEvent.press(screen.getByLabelText('Mostrar a ordem e os filtros de preço, distância, dieta e favoritos'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Só os meus favoritos' }));
    expect(screen.getByText('Nenhum dos teus restaurantes favoritos tem pratos de hoje a menos de 2 km de ti.')).toBeTruthy();
  });
});

describe('Início — ordenar por preço (RF07)', () => {
  // os nomes dos pratos pela ordem em que aparecem na lista
  const ordemNaLista = () =>
    screen
      .getAllByRole('button')
      .map((botao) => botao.props.accessibilityLabel)
      .filter((nome) => /, a \d/.test(nome ?? ''))
      .map((nome) => nome.split(',')[0]);

  test('"Mais barato primeiro" muda a ordem logo, sem voltar à base de dados', async () => {
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);
    expect(ordemNaLista()).toEqual(['Caldo verde', 'Bacalhau à Brás', 'Francesinha']); // por distância
    const pedidosAntes = buscarPratosPerto.mock.calls.length;

    await fireEvent.press(screen.getByLabelText('Mostrar a ordem e os filtros de preço, distância, dieta e favoritos'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Mais barato primeiro' }));
    expect(ordemNaLista()).toEqual(['Caldo verde', 'Bacalhau à Brás', 'Francesinha']); // a francesinha está esgotada: fica no fim
    expect(buscarPratosPerto.mock.calls.length).toBe(pedidosAntes);

    await fireEvent.press(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByRole('radio', { name: 'Mais perto primeiro' }).props.accessibilityState.selected).toBe(true);
  });

  test('com pratos mais baratos longe, esses passam para cima', async () => {
    const BARATO_LONGE = { ...CAFE, prato_id: 'p4', prato: 'Sopa da casa', categoria: 'sopa', preco: 1, esgotado: false };
    buscarPratosPerto.mockResolvedValue([SOPA, BACALHAU, BARATO_LONGE]);
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);

    await fireEvent.press(screen.getByLabelText('Mostrar a ordem e os filtros de preço, distância, dieta e favoritos'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Mais barato primeiro' }));
    expect(ordemNaLista()).toEqual(['Sopa da casa', 'Caldo verde', 'Bacalhau à Brás']);
  });
});

describe('Início — o almoço mais barato perto de ti', () => {
  test('destaca o prato principal disponível mais barato (a sopa e o esgotado não contam)', async () => {
    await abrir();
    const destaque = await screen.findByLabelText('O almoço mais barato perto de ti: Bacalhau à Brás, Tasca do Manuel, 8,50 €');
    await fireEvent.press(destaque);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/restaurante/[id]', params: { id: 'r1', distancia: '0.35' } });
  });

  test('com "Mais barato primeiro" o destaque sai (o mais barato já está no topo)', async () => {
    await abrir();
    await screen.findByLabelText(/^O almoço mais barato/);
    await fireEvent.press(screen.getByLabelText('Mostrar a ordem e os filtros de preço, distância, dieta e favoritos'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Mais barato primeiro' }));
    expect(screen.queryByLabelText(/^O almoço mais barato/)).toBeNull();
  });

  test('sem pratos principais disponíveis não há destaque', async () => {
    buscarPratosPerto.mockResolvedValue([SOPA, FRANCESINHA]);
    await abrir();
    await screen.findByText('Caldo verde');
    expect(screen.queryByLabelText(/^O almoço mais barato/)).toBeNull();
  });
});

describe('Início — Abana para decidir', () => {
  test('"Escolhe por mim" baralha e escolhe um prato principal disponível; "Ver o restaurante" abre-o', async () => {
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);

    await fireEvent.press(screen.getByRole('button', { name: 'Escolhe por mim (também podes abanar o telemóvel)' }));
    expect(screen.getByText('A escolher por ti…')).toBeTruthy();

    // ao fim de 1,3 s pára: o único prato principal disponível é o bacalhau
    expect(await screen.findByText('Hoje almoças…', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByLabelText('Hoje almoças: Bacalhau à Brás, Tasca do Manuel, a 350 m, 8,50 €')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver o restaurante' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/restaurante/[id]', params: { id: 'r1', distancia: '0.35' } });
    expect(screen.queryByText('Hoje almoças…')).toBeNull();
  });

  test('abanar o telemóvel também abre (e um movimento normal não)', async () => {
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);
    await waitFor(() => expect(mockAcelerometro.ouvinte).toBeTruthy());

    await act(async () => mockAcelerometro.ouvinte({ x: 0.1, y: 0.2, z: 1 })); // pousado na mesa: ~1 g
    expect(screen.queryByText('A escolher por ti…')).toBeNull();

    await act(async () => mockAcelerometro.ouvinte({ x: 2.4, y: 0.8, z: 1.1 })); // abanão: mais de 2 g
    expect(screen.getByText('A escolher por ti…')).toBeTruthy();
    expect(mockAcelerometro.ouvinte).toBeNull(); // enquanto está aberto deixa de ouvir
  });

  test('sem pratos disponíveis não há botão nem se ouve o acelerómetro', async () => {
    buscarPratosPerto.mockResolvedValue([FRANCESINHA]); // esgotado
    await abrir();
    await screen.findByText('Francesinha');
    expect(screen.queryByRole('button', { name: /Escolhe por mim/ })).toBeNull();
    expect(mockAcelerometro.ouvinte).toBeNull();
  });
});

describe('Início — pesquisa por frase (assistente)', () => {
  test('"peixe até 8 € aqui perto" põe os filtros sozinha (aqui sem IA: as regras do telemóvel)', async () => {
    // nos testes não há função "assistente": a app usa o plano B e avisa na consola
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);

    await fireEvent.press(screen.getByRole('button', { name: 'Pesquisa por frase com o assistente' }));
    await fireEvent.changeText(screen.getByLabelText('Diz o que te apetece'), 'peixe até 8 € aqui perto');
    await fireEvent.press(screen.getByRole('button', { name: 'Procurar com o assistente' }));

    expect(await screen.findByText('Percebi: Peixe · até 8,00 € · até 1 km (sem IA)')).toBeTruthy();
    await waitFor(() => expect(ultimoPedido()).toEqual({ ...AQUI, ...SEM_FILTROS, categoria: 'peixe', precoMax: 8, raioKm: 1 }));

    // o botão volta a fechar o painel
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar a pesquisa por frase' }));
    expect(screen.queryByLabelText('Diz o que te apetece')).toBeNull();
    aviso.mockRestore();
  });
});

describe('Início — etiquetas, últimas doses e lotação', () => {
  test('o cartão mostra as etiquetas, as últimas doses e "Cheio agora"', async () => {
    const agora = new Date().toISOString();
    const bacalhau = { ...BACALHAU, menu_id: 'm1', etiquetas: ['sem-gluten'], ultimas_doses: true, lotacao: 'cheio', lotacao_em: agora };
    buscarPratosPerto.mockResolvedValue([bacalhau]);
    await abrir();
    const cartao = await screen.findByLabelText(CARTAO_DO_BACALHAU);
    expect(cartao.props.accessibilityLabel).toMatch(/últimas doses, Sem glúten, Cheio agora · agora mesmo$/);
    expect(screen.getByText('Peixe · Sem glúten')).toBeTruthy();
    expect(screen.getByText('Últimas doses')).toBeTruthy();
  });

  test('quando um restaurante diz que está cheio, os cartões dele mudam logo (tempo real)', async () => {
    buscarPratosPerto.mockResolvedValue([{ ...BACALHAU, menu_id: 'm1' }]);
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);
    expect(screen.queryByText(/Cheio agora/)).toBeNull();

    await act(async () => mockLotacao.aoMudar({ id: 'm1', lotacao: 'cheio', lotacao_em: new Date().toISOString() }));
    expect(await screen.findByText(/Cheio agora/)).toBeTruthy();
  });

  test('o filtro "Vegano" do painel vai à base de dados (só pratos com essa etiqueta)', async () => {
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);
    await fireEvent.press(screen.getByLabelText('Mostrar a ordem e os filtros de preço, distância, dieta e favoritos'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Vegano' }));
    await waitFor(() => expect(ultimoPedido()).toEqual({ ...AQUI, ...SEM_FILTROS, etiqueta: 'vegano' }));

    await fireEvent.press(screen.getByRole('radio', { name: 'Qualquer prato' }));
    await waitFor(() => expect(ultimoPedido().etiqueta).toBeNull());
  });
});

describe('Início — tempo real só dos menus da lista', () => {
  test('ouve os pratos e a lotação só dos menus que estão na lista', async () => {
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);
    expect(ouvirAlteracoesPratos).toHaveBeenLastCalledWith(expect.any(Function), { menuIds: ['m1', 'm2'] });
  });
});

describe('Início — ler o QR code de um restaurante', () => {
  test('o ícone do QR abre o leitor; um QR da Emmmenta abre a página do restaurante', async () => {
    await abrir();
    await screen.findByLabelText(CARTAO_DO_BACALHAU);
    await fireEvent.press(screen.getByRole('button', { name: 'Ler o QR code de um restaurante' }));
    const id = '11111111-2222-3333-4444-555555555555';
    await fireEvent(await screen.findByTestId('camara'), 'barcodeScanned', { type: 'qr', data: `emmmenta://restaurante/${id}` });
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/restaurante/[id]', params: { id } });
    expect(screen.queryByTestId('camara')).toBeNull(); // o leitor fechou
  });
});
