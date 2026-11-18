import { useSyncExternalStore } from 'react';

// Um relógio partilhado que faz o ecrã voltar a desenhar-se uma vez por minuto.
// Serve para textos que dependem da hora e têm de mudar sozinhos com o ecrã aberto, como
// "Cheio agora · há 12 min", que deixa de aparecer ao fim de 45 minutos (lotacaoAtual).
//
// Há um só temporizador para todos os componentes que o usam, e só enquanto houver algum a usá-lo.

const UM_MINUTO_MS = 60 * 1000;

const quemOuve = new Set();
let temporizador = null;

function subscrever(aoMudar) {
  quemOuve.add(aoMudar);
  if (!temporizador) {
    temporizador = setInterval(() => quemOuve.forEach((avisar) => avisar()), UM_MINUTO_MS);
  }
  return () => {
    quemOuve.delete(aoMudar);
    if (quemOuve.size === 0) {
      clearInterval(temporizador);
      temporizador = null;
    }
  };
}

// O minuto atual (muda uma vez por minuto): é isto que diz ao React se tem de voltar a desenhar.
const minutoAtual = () => Math.floor(Date.now() / UM_MINUTO_MS);

/** A hora atual, certa ao minuto. O componente que a usa volta a desenhar-se quando o minuto muda. */
export function useAgora() {
  const minuto = useSyncExternalStore(subscrever, minutoAtual);
  return new Date(minuto * UM_MINUTO_MS);
}
