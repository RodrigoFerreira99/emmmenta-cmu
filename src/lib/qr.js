import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import criarQr from 'qrcode-generator';

import { diaPorExtenso } from '@/lib/datas';
import { formatarPreco } from '@/services/pratos';
import { coresDeImpressao as cores } from '@/theme'; // o cartaz é impresso em papel branco: cores claras

// QR code do restaurante: o dono imprime um cartaz com o QR (e o menu de hoje) para a porta ou para as mesas;
// o cliente lê o QR com a Emmmenta (Início → ícone do QR) e vai logo para a página do restaurante.
//
// O QR guarda um endereço da app: "emmmenta://restaurante/<id>". Numa app instalada (com o esquema
// "emmmenta" do app.json) a câmara normal do telemóvel também o abriria; no Expo Go lê-se com o leitor
// da própria app. O QR é gerado no telemóvel (biblioteca qrcode-generator): não usa internet.

const ID_DE_RESTAURANTE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIXO = 'emmmenta://restaurante/';

/** O texto que vai dentro do QR de um restaurante. */
export function enderecoDoRestaurante(restauranteId) {
  return `${PREFIXO}${restauranteId}`;
}

/** Lê o texto de um QR: devolve o id do restaurante, ou null se não for um QR de restaurante da Emmmenta. */
export function lerQrDoRestaurante(texto) {
  const limpo = String(texto ?? '').trim();
  if (!limpo.toLowerCase().startsWith(PREFIXO)) return null;
  const id = limpo.slice(PREFIXO.length);
  return ID_DE_RESTAURANTE.test(id) ? id.toLowerCase() : null;
}

/** O desenho do QR em SVG (texto), com a cor do texto da app sobre fundo branco. */
export function svgDoQr(texto) {
  const qr = criarQr(0, 'M'); // 0 = o tamanho mais pequeno que chegue; 'M' = recupera 15 % se o papel se estragar
  qr.addData(texto);
  qr.make();
  return qr
    .createSvgTag({ cellSize: 8, margin: 2, scalable: true })
    .replace(/fill="black"/g, `fill="${cores.texto}"`)
    .replace(/fill="white"/g, `fill="${cores.superficie}"`);
}

// Os nomes vêm dos donos dos restaurantes: escapam-se antes de entrar no HTML do cartaz.
export function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * O HTML do cartaz para imprimir (folha A4): o nome do restaurante, o menu de hoje (se já foi publicado)
 * e o QR grande. "menu" é o de buscarMenuDeHoje (ou null).
 */
export function htmlDoCartaz({ restaurante, menu }) {
  const pratos = menu?.pratos ?? [];
  const linhas = pratos
    .map(
      (prato) =>
        `<tr><td class="nome${prato.esgotado ? ' esgotado' : ''}">${escaparHtml(prato.nome)}</td>` +
        `<td class="preco">${prato.esgotado ? 'Esgotado' : formatarPreco(prato.preco)}</td></tr>`
    )
    .join('');
  const menuDeHoje = pratos.length
    ? `<h2>Menu de hoje</h2><table>${linhas}</table>` +
      (menu?.preco_menu_completo ? `<p class="completo">Menu completo: ${formatarPreco(menu.preco_menu_completo)}</p>` : '')
    : '';

  return `<!DOCTYPE html>
<html lang="pt-PT"><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: ${cores.texto}; margin: 48px; text-align: center; }
  .marca { color: ${cores.acento}; font-weight: 800; letter-spacing: 2px; margin: 0; }
  h1 { font-size: 40px; margin: 8px 0 0; }
  .dia { color: ${cores.textoSecundario}; margin: 4px 0 24px; }
  h2 { font-size: 22px; margin: 0 0 8px; }
  table { margin: 0 auto 8px; border-collapse: collapse; min-width: 60%; font-size: 18px; }
  td { padding: 6px 12px; border-bottom: 1px solid ${cores.linha}; text-align: left; }
  td.preco { text-align: right; font-weight: 700; color: ${cores.acento}; white-space: nowrap; }
  td.esgotado { text-decoration: line-through; color: ${cores.textoTerciario}; }
  .completo { font-size: 18px; }
  .qr { width: 260px; height: 260px; margin: 24px auto 8px; }
  .qr svg { width: 100%; height: 100%; }
  .chamada { font-size: 18px; font-weight: 700; margin: 0; }
  .nota { color: ${cores.textoSecundario}; margin: 4px 0 0; }
</style></head>
<body>
  <p class="marca">EMMMENTA</p>
  <h1>${escaparHtml(restaurante.nome)}</h1>
  <p class="dia">${diaPorExtenso()}</p>
  ${menuDeHoje}
  <div class="qr">${svgDoQr(enderecoDoRestaurante(restaurante.id))}</div>
  <p class="chamada">Lê este código com a app Emmmenta</p>
  <p class="nota">e vê o menu do dia, os preços e se há mesa — todos os dias.</p>
</body></html>`;
}

/** Abre a janela de imprimir do telemóvel com o cartaz. */
export async function imprimirCartaz(html) {
  try {
    await Print.printAsync({ html });
  } catch (erro) {
    console.warn('Erro técnico (imprimir cartaz):', erro?.message ?? erro);
    throw new Error('Não foi possível abrir a impressão. Experimenta guardar em PDF.');
  }
}

/** Cria um PDF A4 com o cartaz e abre a janela de partilha (WhatsApp, email, guardar…). */
export async function partilharCartazEmPdf(html) {
  try {
    // A4 a 72 pontos por polegada: 595 x 842
    const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
    if (!(await Sharing.isAvailableAsync())) throw new Error('partilha indisponível');
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf', dialogTitle: 'Cartaz do restaurante' });
  } catch (erro) {
    console.warn('Erro técnico (PDF do cartaz):', erro?.message ?? erro);
    throw new Error('Não foi possível criar o PDF. Tenta outra vez.');
  }
}
