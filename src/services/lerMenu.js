import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { traduzirErroDeFuncao } from '@/lib/erros';
import { supabase } from '@/lib/supabase';
import { limparNome } from '@/services/menus';
import { CATEGORIAS } from '@/services/pratos';

// Ler o menu a partir de uma fotografia (extra do RF03, para publicar mais depressa — RNF06).
//
// Como funciona:
//  1. A app reduz a fotografia (para ser rápida de enviar) e passa-a a texto (base64).
//  2. Envia-a à função "ler-menu", que corre nos servidores do Supabase
//     (o código está em supabase/functions/ler-menu/index.js).
//  3. Essa função pede a um modelo de IA para ler os pratos e devolve
//     { pratos: [{ nome, categoria, preco }], preco_menu_completo }.
//  4. A app confirma a resposta (limparPratosLidos) e o ecrã junta os pratos à lista.
//     Nada é publicado sozinho: o dono confirma e corrige antes de carregar em "Publicar menu".
//
// A chave secreta do serviço de IA fica guardada no Supabase, nunca na app.
// A fotografia não é guardada em lado nenhum: serve só para esta leitura.

// Tamanho e qualidade da imagem enviada: chega para se ler o texto e fica com poucas centenas de KB.
const LADO_MAXIMO = 1600; // píxeis do lado maior
const QUALIDADE = 0.6;
const MAXIMO_DE_PRATOS = 40;
const VALORES_DE_CATEGORIA = CATEGORIAS.map((categoria) => categoria.valor);

// Um preço lido da fotografia só serve se for um número maior do que zero (RN03: 2 casas decimais).
function precoLido(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || valor >= 10000) return null;
  return Math.round(valor * 100) / 100;
}

/**
 * Confirma a resposta da função "ler-menu" antes de a mostrar no ecrã (função simples, sem rede).
 * Nunca confiamos às cegas no que vem de fora: nomes vazios ou repetidos ficam de fora,
 * uma categoria desconhecida passa a 'carne' e um preço que não seja um número fica null
 * (o ecrã mostra "Falta o preço" e não deixa publicar enquanto não for escrito).
 *
 * Devolve { pratos: [{ nome, categoria, preco }], precoMenuCompleto }.
 */
export function limparPratosLidos(resposta) {
  const lidos = Array.isArray(resposta?.pratos) ? resposta.pratos : [];
  const pratos = [];
  const nomesVistos = new Set();

  for (const lido of lidos) {
    if (pratos.length >= MAXIMO_DE_PRATOS) break;

    const nome = limparNome(typeof lido?.nome === 'string' ? lido.nome : '').slice(0, 60).trim();
    if (nome.length < 2) continue;

    const nomeEmMinusculas = nome.toLowerCase();
    if (nomesVistos.has(nomeEmMinusculas)) continue;
    nomesVistos.add(nomeEmMinusculas);

    pratos.push({
      nome,
      categoria: VALORES_DE_CATEGORIA.includes(lido.categoria) ? lido.categoria : 'carne',
      preco: precoLido(lido.preco),
    });
  }

  return { pratos, precoMenuCompleto: precoLido(resposta?.preco_menu_completo) };
}

// Reduz a fotografia e devolve-a em base64 (o formato em que uma imagem viaja dentro de um pedido JSON).
async function prepararFotografia(uriLocal) {
  try {
    // maxWidth/maxHeight: a imagem é reduzida ao ser lida, mantendo as proporções (nunca é aumentada)
    const contexto = ImageManipulator.manipulate(uriLocal, { maxWidth: LADO_MAXIMO, maxHeight: LADO_MAXIMO });
    const imagem = await contexto.renderAsync();
    const resultado = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: QUALIDADE, base64: true });
    // libertar a memória da imagem (as fotografias do telemóvel são grandes)
    contexto.release();
    imagem.release();
    if (!resultado.base64) throw new Error('imagem sem conteúdo');
    return resultado.base64;
  } catch (erro) {
    console.warn('Erro técnico (preparar fotografia do menu):', erro?.message ?? erro);
    throw new Error('Não foi possível preparar a fotografia. Escolhe outra imagem.');
  }
}

/**
 * Lê os pratos de uma fotografia do menu. "uriLocal" é o caminho da imagem no telemóvel.
 * Devolve { pratos: [{ nome, categoria, preco }], precoMenuCompleto } — o preço de um prato
 * é null quando não se conseguiu ler. Em caso de falha lança um Error com mensagem em português.
 */
export async function lerMenuDaFoto(uriLocal) {
  const imagem = await prepararFotografia(uriLocal);

  // functions.invoke envia a sessão do utilizador: a função só aceita contas de restaurante
  const { data, error } = await supabase.functions.invoke('ler-menu', { body: { imagem } });
  if (error) {
    throw await traduzirErroDeFuncao(error, {
      quandoNaoExiste: 'A leitura por fotografia ainda não está ativada. Escreve os pratos à mão.',
      geral: 'Não foi possível ler a fotografia. Tenta outra vez ou escreve os pratos à mão.',
    });
  }

  return limparPratosLidos(data);
}
