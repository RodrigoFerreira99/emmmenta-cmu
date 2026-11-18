import * as Speech from 'expo-speech';

import { CATEGORIAS_EM_INGLES } from '@/services/assistente';
import { nomeDaCategoria } from '@/services/menus';
import { descreverEtiquetas } from '@/services/pratos';

// Ouvir o menu em voz alta (página do restaurante): o telemóvel lê os pratos e os preços, em português
// ou em inglês. Ajuda quem vê mal (acessibilidade) e quem não pode olhar para o ecrã.
// Usa a voz do próprio telemóvel (expo-speech): não precisa de internet nem de nenhum serviço.
// Nota: no iPhone, com o botão do silêncio ligado, não se ouve nada.

/** 8.5 → "8 euros e 50"; 1 → "1 euro"; em inglês "8 euros 50". Assim a voz lê o preço com naturalidade. */
export function precoParaFala(valor, { emIngles = false } = {}) {
  const centimos = Math.round(Number(valor) * 100);
  const euros = Math.floor(centimos / 100);
  const resto = centimos % 100;
  const palavraEuro = euros === 1 ? 'euro' : 'euros';
  if (resto === 0) return `${euros} ${palavraEuro}`;
  return emIngles ? `${euros} ${palavraEuro} ${resto}` : `${euros} ${palavraEuro} e ${resto}`;
}

/**
 * O texto que a voz lê: o nome do restaurante e, para cada prato, o nome, a categoria, as etiquetas
 * e o preço (ou "esgotado"). "traducoes" (nome em português → em inglês) vem do botão "English".
 */
export function textoDoMenuParaOuvir({ nomeDoRestaurante, pratos, precoMenuCompleto = null, emIngles = false, traducoes = {} }) {
  const frases = [emIngles ? `Today's menu at ${nomeDoRestaurante}.` : `Menu de hoje: ${nomeDoRestaurante}.`];
  for (const prato of pratos) {
    const nome = (emIngles && traducoes[prato.nome]) || prato.nome;
    const categoria = emIngles ? CATEGORIAS_EM_INGLES[prato.categoria] : nomeDaCategoria(prato.categoria);
    const etiquetas = descreverEtiquetas(prato.etiquetas, { emIngles }).split(' · ').join(', ');
    let estado = precoParaFala(prato.preco, { emIngles });
    if (prato.esgotado) estado = emIngles ? 'sold out' : 'esgotado';
    else if (prato.ultimas_doses) estado += emIngles ? ', last portions' : ', últimas doses';
    frases.push(`${[nome, categoria, etiquetas, estado].filter(Boolean).join(', ')}.`);
  }
  if (precoMenuCompleto) {
    frases.push(emIngles ? `Set menu: ${precoParaFala(precoMenuCompleto, { emIngles })}.` : `Menu completo: ${precoParaFala(precoMenuCompleto)}.`);
  }
  return frases.join(' ');
}

/**
 * Lê o texto em voz alta (pára o que estivesse a ler antes). "aoAcabar" é chamado quando acaba,
 * quando é interrompido ou se der erro — para o botão voltar a "Ouvir".
 */
export function lerEmVozAlta(texto, { emIngles = false, aoAcabar } = {}) {
  Speech.stop();
  Speech.speak(texto, {
    language: emIngles ? 'en-GB' : 'pt-PT',
    rate: 0.95, // um pouco mais devagar do que o normal: os nomes dos pratos percebem-se melhor
    onDone: aoAcabar,
    onStopped: aoAcabar,
    onError: aoAcabar,
  });
}

/** Pára de ler (por exemplo, ao sair da página). */
export function pararDeLer() {
  Speech.stop();
}
