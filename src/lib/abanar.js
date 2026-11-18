import { Accelerometer } from 'expo-sensors';

// "Abana para decidir": perceber quando o telemóvel é abanado, com o acelerómetro (expo-sensors,
// incluído no Expo Go). O acelerómetro mede a aceleração em "g": em repouso marca cerca de 1 g
// (é a gravidade); um abanão com a mão passa facilmente de 2 g.

export const LIMITE_DO_ABANAO_G = 2;
const MEDICOES_A_CADA_MS = 100; // 10 medições por segundo chegam e gastam pouca bateria
const PAUSA_ENTRE_ABANOES_MS = 1500; // um abanão "longo" conta só uma vez

/** true se esta medição do acelerómetro ({ x, y, z } em g) for um abanão. */
export function eUmAbanao({ x, y, z }, limite = LIMITE_DO_ABANAO_G) {
  return Math.sqrt(x * x + y * y + z * z) > limite;
}

/**
 * Começa a ouvir o acelerómetro e chama aoAbanar() em cada abanão (no máximo um a cada 1,5 s).
 * Devolve a função que pára de ouvir. Num telemóvel sem acelerómetro não faz nada.
 */
export function ouvirAbanoes(aoAbanar) {
  let subscricao = null;
  let parado = false;
  let ultimoAbanao = 0;

  Accelerometer.isAvailableAsync()
    .then((existe) => {
      if (!existe || parado) return;
      Accelerometer.setUpdateInterval(MEDICOES_A_CADA_MS);
      subscricao = Accelerometer.addListener((medicao) => {
        const agora = Date.now();
        if (eUmAbanao(medicao) && agora - ultimoAbanao > PAUSA_ENTRE_ABANOES_MS) {
          ultimoAbanao = agora;
          aoAbanar();
        }
      });
    })
    .catch(() => {
      // sem acelerómetro: o botão "Escolhe por mim" continua a funcionar
    });

  return () => {
    parado = true;
    subscricao?.remove();
  };
}
