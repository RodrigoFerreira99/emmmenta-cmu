import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { estadoDaPermissao, lerLocalizacao, pedirPermissao } from '@/services/localizacao';
import { aplicarAlteracaoDePrato, buscarPratosPerto, ouvirAlteracoesPratos, RAIO_POR_OMISSAO_KM } from '@/services/pratos';

// RF05 / RF06 / RF07 — "pratos perto de mim", partilhado pelos separadores Início e Mapa.
//
// Os dois separadores mostram a mesma coisa de maneiras diferentes (lista e mapa). Por isso o sítio
// onde se procura, os filtros e os pratos encontrados vivem aqui, num só sítio: quem muda um filtro
// na lista vê o mesmo no mapa, e a pesquisa à base de dados é feita uma só vez (RNF05).
//
// Uso num ecrã:  const { local, pratos, filtros, mudarFiltros } = usePerto();
//
// Privacidade (RNF04): a localização fica só neste estado, na memória do telemóvel. Quando a app
// fecha, desaparece. Nunca é guardada na base de dados nem em ficheiros.

const PertoContext = createContext(null);

const FILTROS_INICIAIS = { raioKm: RAIO_POR_OMISSAO_KM, precoMax: null, categoria: null, pesquisa: '' };
// Espera-se um pouco depois da última letra antes de procurar, para não fazer um pedido por cada tecla.
const ESPERA_DA_PESQUISA_MS = 400;

export function PertoProvider({ children }) {
  // --- Onde procurar -------------------------------------------------------
  // local: { latitude, longitude, nome, origem } — origem é 'gps' (localização do telemóvel) ou 'zona' (escolhida à mão)
  const [local, setLocal] = useState(null);
  // 'aVerificar' (a ver se já há permissão) | 'porEscolher' | 'aLocalizar' | 'pronto'
  const [estadoDoLocal, setEstadoDoLocal] = useState('aVerificar');
  const [avisoDoLocal, setAvisoDoLocal] = useState(null);

  // Para saber, depois de um "await", se o cliente entretanto já escolheu um sítio.
  const localAtual = useRef(null);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const guardarLocal = useCallback((novoLocal) => {
    localAtual.current = novoLocal;
    setLocal(novoLocal);
    setAvisoDoLocal(null);
    setEstadoDoLocal('pronto');
  }, []);

  // Quando a leitura da localização não resulta: explica porquê e volta ao que havia antes
  // (o sítio já escolhido, ou o ecrã de escolher a zona — RNF08).
  const desistirDeLocalizar = useCallback((aviso) => {
    setAvisoDoLocal(aviso);
    setEstadoDoLocal(localAtual.current ? 'pronto' : 'porEscolher');
  }, []);

  // Lê a localização do telemóvel (a permissão já tem de estar dada). Devolve true se resultou.
  const localizar = useCallback(async () => {
    try {
      const ponto = await lerLocalizacao();
      if (montado.current) guardarLocal({ ...ponto, nome: 'A minha localização', origem: 'gps' });
      return true;
    } catch (erro) {
      if (montado.current) desistirDeLocalizar(erro.message);
      return false;
    }
  }, [desistirDeLocalizar, guardarLocal]);

  /**
   * Botão "Usar a minha localização": pede a permissão ao sistema (se ainda não foi dada) e lê a localização.
   * O ecrã só chama isto depois de explicar ao utilizador porque se pede (RNF04).
   * Devolve true se ficou a saber onde o cliente está.
   */
  const usarLocalizacao = useCallback(async () => {
    setAvisoDoLocal(null);
    setEstadoDoLocal('aLocalizar');

    const antes = await estadoDaPermissao();
    const aceite = antes === 'concedida' || (antes === 'porPedir' && (await pedirPermissao()));
    if (!montado.current) return false;

    if (!aceite) {
      // Sem permissão a app continua a funcionar: o cliente escolhe a zona à mão (RNF08).
      desistirDeLocalizar(
        antes === 'negada'
          ? 'A permissão de localização está desligada. Podes ligá-la nas definições do telemóvel ou escolher a zona à mão.'
          : 'Sem a permissão de localização, escolhe a zona onde queres procurar.'
      );
      return false;
    }
    return localizar();
  }, [desistirDeLocalizar, localizar]);

  /** Escolher à mão uma zona de src/lib/zonas.js (sem GPS ou sem permissão — RNF08). */
  const escolherZona = useCallback(
    (zona) => guardarLocal({ latitude: zona.latitude, longitude: zona.longitude, nome: zona.nome, origem: 'zona' }),
    [guardarLocal]
  );

  // Ao abrir: se a permissão já tinha sido dada noutra altura, usa logo a localização, sem perguntar nada.
  // Se não, fica à espera de que o cliente escolha no ecrã: usar a localização ou uma zona.
  useEffect(() => {
    async function aoAbrir() {
      const permissao = await estadoDaPermissao();
      if (!montado.current) return;
      if (permissao === 'concedida') await localizar();
      else setEstadoDoLocal('porEscolher');
    }
    aoAbrir();
  }, [localizar]);

  // --- Filtros (RF07) ------------------------------------------------------
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const mudarFiltros = useCallback((alteracoes) => setFiltros((atuais) => ({ ...atuais, ...alteracoes })), []);
  const limparFiltros = useCallback(() => setFiltros(FILTROS_INICIAIS), []);

  // O texto da pesquisa só é "aplicado" quando o cliente pára de escrever.
  const [pesquisaAplicada, setPesquisaAplicada] = useState('');
  useEffect(() => {
    const relogio = setTimeout(() => setPesquisaAplicada(filtros.pesquisa.trim()), ESPERA_DA_PESQUISA_MS);
    return () => clearTimeout(relogio);
  }, [filtros.pesquisa]);

  // Quantos filtros estão a mudar o resultado (para o botão "Filtros" e para "Limpar filtros").
  const filtrosAtivos =
    (filtros.raioKm !== RAIO_POR_OMISSAO_KM ? 1 : 0) +
    (filtros.precoMax !== null ? 1 : 0) +
    (filtros.categoria !== null ? 1 : 0) +
    (filtros.pesquisa.trim() !== '' ? 1 : 0);

  // --- Pratos perto (RF05) -------------------------------------------------
  const [recarregamentos, setRecarregamentos] = useState(0); // aumenta em "Tentar outra vez" e ao puxar a lista

  // Voltar a procurar. Quem está a usar a localização do telemóvel pode ter andado entretanto,
  // por isso a localização também é lida outra vez (continua só em memória — RNF04).
  const recarregar = useCallback(() => {
    setRecarregamentos((n) => n + 1);
    if (localAtual.current?.origem === 'gps') localizar();
  }, [localizar]);

  // "chave" identifica a pesquisa que queremos neste momento. O resultado guarda a chave da pesquisa
  // que o produziu: se forem diferentes, é porque a resposta da pesquisa atual ainda não chegou.
  const latitude = local?.latitude ?? null;
  const longitude = local?.longitude ?? null;
  const { raioKm, precoMax, categoria } = filtros;
  const chave = local ? [latitude, longitude, raioKm, precoMax, categoria, pesquisaAplicada, recarregamentos].join('|') : null;
  const [resultado, setResultado] = useState({ chave: null, pratos: [], erro: null });

  // Corre sempre que a chave muda, ou seja, quando muda o sítio, um filtro ou se pede para recarregar.
  useEffect(() => {
    if (chave === null) return;
    let ativo = true; // se os filtros mudarem a meio, a resposta antiga é ignorada

    buscarPratosPerto({ latitude, longitude, raioKm, precoMax, categoria, pesquisa: pesquisaAplicada })
      .then((pratos) => {
        if (ativo) setResultado({ chave, pratos, erro: null });
      })
      .catch((erro) => {
        if (ativo) setResultado({ chave, pratos: [], erro: erro.message });
      });

    return () => {
      ativo = false;
    };
  }, [chave, latitude, longitude, raioKm, precoMax, categoria, pesquisaAplicada]);

  // RF04 visto pelo cliente: quando um restaurante marca um prato como esgotado, a lista muda logo.
  useEffect(() => {
    return ouvirAlteracoesPratos((alterado) => {
      setResultado((atual) => {
        const pratos = aplicarAlteracaoDePrato(atual.pratos, alterado);
        return pratos === atual.pratos ? atual : { ...atual, pratos };
      });
    });
  }, []);

  const aCarregar = chave !== null && resultado.chave !== chave;

  const valor = useMemo(
    () => ({
      local,
      estadoDoLocal,
      avisoDoLocal,
      usarLocalizacao,
      escolherZona,
      filtros,
      filtrosAtivos,
      mudarFiltros,
      limparFiltros,
      pratos: resultado.pratos,
      // enquanto chega a resposta nova continua a ver-se a lista anterior, mas não um erro antigo
      erro: aCarregar ? null : resultado.erro,
      aCarregar,
      recarregar,
    }),
    [
      local,
      estadoDoLocal,
      avisoDoLocal,
      usarLocalizacao,
      escolherZona,
      filtros,
      filtrosAtivos,
      mudarFiltros,
      limparFiltros,
      resultado,
      aCarregar,
      recarregar,
    ]
  );

  return <PertoContext.Provider value={valor}>{children}</PertoContext.Provider>;
}

export function usePerto() {
  const contexto = useContext(PertoContext);
  if (!contexto) throw new Error('usePerto() só pode ser usado dentro dos separadores do cliente (PertoProvider).');
  return contexto;
}
