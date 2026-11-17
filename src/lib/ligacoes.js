import { Linking, Platform } from 'react-native';

// RF06 — botões "Ligar" e "Direções" da página do restaurante.
// A app não faz chamadas nem mostra percursos: pede ao telemóvel para abrir a app certa
// (telefone ou mapas) já com os dados preenchidos. É isso que faz o Linking.openURL.

/**
 * O endereço que abre a app de mapas com o percurso até ao restaurante.
 *  - iPhone: Apple Maps (vem com o telemóvel).
 *  - Android e browser: Google Maps (abre a app se estiver instalada, senão abre no browser).
 */
export function enderecoDasDirecoes(plataforma, { latitude, longitude }) {
  const destino = `${latitude},${longitude}`;
  if (plataforma === 'ios') return `http://maps.apple.com/?daddr=${destino}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destino}`;
}

/** Abre a app de mapas com o percurso até ao ponto { latitude, longitude }. */
export async function abrirDirecoes(destino) {
  try {
    await Linking.openURL(enderecoDasDirecoes(Platform.OS, destino));
  } catch (erro) {
    console.warn('Erro técnico (abrir mapas):', erro?.message ?? erro);
    throw new Error('Não foi possível abrir a app de mapas.');
  }
}

/** Abre a app do telefone com o número já marcado. "telefone" vem da base de dados como +351XXXXXXXXX. */
export async function ligar(telefone) {
  try {
    await Linking.openURL(`tel:${telefone}`);
  } catch (erro) {
    console.warn('Erro técnico (ligar):', erro?.message ?? erro);
    throw new Error(`Não foi possível abrir a app do telefone. O número é ${telefone}.`);
  }
}
