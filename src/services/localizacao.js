import * as Location from 'expo-location';

// RF05 — saber onde o cliente está, para procurar os pratos perto dele.
//
// Regras de privacidade (RNF04):
//  - a localização só é lida depois de o utilizador aceitar, e só com a app aberta
//    (permissão "foreground": a app nunca pede a localização em segundo plano);
//  - a localização fica só na memória do telemóvel, enquanto a app está aberta. Vai como
//    parâmetro da pesquisa "pratos_perto", mas NUNCA é guardada na base de dados.

const TEMPO_MAXIMO_MS = 15 * 1000;
const DOIS_MINUTOS_MS = 2 * 60 * 1000;

/**
 * Como está a permissão de localização:
 *  'concedida' — já foi aceite; 'porPedir' — ainda se pode mostrar o pedido do sistema;
 *  'negada'    — foi recusada e o sistema já não deixa perguntar outra vez.
 */
export async function estadoDaPermissao() {
  try {
    const { granted, canAskAgain } = await Location.getForegroundPermissionsAsync();
    if (granted) return 'concedida';
    return canAskAgain ? 'porPedir' : 'negada';
  } catch (erro) {
    console.warn('Erro técnico (ver permissão de localização):', erro?.message ?? erro);
    return 'porPedir';
  }
}

/** Mostra o pedido de permissão do sistema. Devolve true se o utilizador aceitou. */
export async function pedirPermissao() {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    return granted;
  } catch (erro) {
    console.warn('Erro técnico (pedir permissão de localização):', erro?.message ?? erro);
    return false;
  }
}

// Espera pela promessa, mas desiste se ela demorar mais do que "ms" milissegundos.
function comTempoLimite(promessa, ms) {
  let relogio;
  const limite = new Promise((_resolver, rejeitar) => {
    relogio = setTimeout(() => rejeitar(new Error('tempo esgotado')), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(relogio));
}

/**
 * Lê a localização do telemóvel. Devolve { latitude, longitude }.
 * Só deve ser chamada depois de a permissão estar concedida.
 * Em caso de falha lança um Error com mensagem em português (RNF08).
 */
export async function lerLocalizacao() {
  let localizacaoLigada = true;
  try {
    localizacaoLigada = await Location.hasServicesEnabledAsync();
  } catch (erro) {
    console.warn('Erro técnico (ver se a localização está ligada):', erro?.message ?? erro);
  }
  if (!localizacaoLigada) {
    throw new Error('A localização do telemóvel está desligada. Liga-a nas definições ou escolhe a zona à mão.');
  }

  try {
    // 1) Uma posição recente que o telemóvel já conheça: responde logo (RNF05).
    const recente = await Location.getLastKnownPositionAsync({ maxAge: DOIS_MINUTOS_MS });
    // 2) Senão, pede uma posição nova. A precisão "Balanced" (cerca de 100 m) chega para
    //    distâncias a restaurantes e é mais rápida e gasta menos bateria do que a máxima.
    const posicao =
      recente ??
      (await comTempoLimite(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), TEMPO_MAXIMO_MS));
    return { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude };
  } catch (erro) {
    console.warn('Erro técnico (ler localização):', erro?.message ?? erro);
    throw new Error('Não foi possível saber onde estás. Tenta outra vez ou escolhe a zona à mão.');
  }
}
