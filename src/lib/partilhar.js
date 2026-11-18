import { Share } from 'react-native';

import { diaPorExtenso } from '@/lib/datas';
import { enderecoDasDirecoes } from '@/lib/ligacoes';
import { formatarPreco } from '@/services/pratos';

// Partilhar o menu de hoje: o telemóvel abre a sua própria janela de partilha (WhatsApp, Instagram,
// SMS, email…) já com o texto escrito. A app não envia nada sozinha: é a pessoa que escolhe a quem.
//
// As duas funções de texto não usam a rede, por isso têm testes (tests/partilhar.test.js).

// Os pratos que ainda se podem pedir, na ordem do menu. Os esgotados ficam de fora.
const disponiveis = (menu) => (menu?.pratos ?? []).filter((prato) => !prato.esgotado);

// "terça-feira, 18 de novembro" → "Terça-feira, 18 de novembro"
const comMaiuscula = (frase) => frase.charAt(0).toUpperCase() + frase.slice(1);

/**
 * Restaurante: o texto do menu de hoje para pôr no WhatsApp ou no Instagram.
 * "restaurante" é a linha da tabela restaurantes; "menu" é o que devolve buscarMenuDeHoje().
 */
export function textoDoMenuDeHoje({ restaurante, menu, agora = new Date() }) {
  const linhas = [`🍽️ Menu de hoje — ${restaurante.nome}`, comMaiuscula(diaPorExtenso(agora)), ''];

  for (const prato of disponiveis(menu)) linhas.push(`• ${prato.nome} — ${formatarPreco(prato.preco)}`);
  if (menu.preco_menu_completo) linhas.push('', `Menu completo: ${formatarPreco(menu.preco_menu_completo)}`);

  if (restaurante.morada) linhas.push('', `📍 ${restaurante.morada}`);
  linhas.push('', 'Vê os pratos do dia perto de ti na Emmmenta.');
  return linhas.join('\n');
}

/**
 * Cliente: convidar alguém para almoçar neste restaurante. Leva os pratos de hoje e um link
 * de direções do Google Maps, que abre em qualquer telemóvel (até sem a Emmmenta instalada).
 */
export function textoDoConvite({ restaurante, menu }) {
  const titulo = restaurante.tipo_cozinha ? `${restaurante.nome} (${restaurante.tipo_cozinha})` : restaurante.nome;
  const linhas = [`Almoçamos aqui? ${titulo}`];

  const pratos = disponiveis(menu);
  if (pratos.length > 0) {
    linhas.push(`Hoje: ${pratos.map((prato) => `${prato.nome} (${formatarPreco(prato.preco)})`).join(', ')}`);
  }
  if (restaurante.morada) linhas.push(`📍 ${restaurante.morada}`);
  linhas.push(`Direções: ${enderecoDasDirecoes('android', restaurante)}`);
  return linhas.join('\n');
}

/** Abre a janela de partilha do telemóvel com o texto. Lança um Error em português se não for possível. */
export async function partilhar(texto) {
  try {
    await Share.share({ message: texto });
  } catch (erro) {
    console.warn('Erro técnico (partilhar):', erro?.message ?? erro);
    throw new Error('Não foi possível abrir a partilha neste telemóvel.');
  }
}
