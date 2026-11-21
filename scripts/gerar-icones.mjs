// Gera src/components/caminhosDosIcones.js a partir dos SVG do Phosphor Icons (licença MIT, @phosphor-icons/core).
// Só entram os ícones da lista: assim a app não carrega os 1500 ícones do pacote completo.
// Para acrescentar um ícone: juntar o nome (como em phosphoricons.com) a NOMES, correr o script
// e juntar a correspondência em src/components/Icone.js.
// Uso: node scripts/gerar-icones.mjs
import fs from 'node:fs';

const VERSAO = '2.1.1';
const SAIDA = 'src/components/caminhosDosIcones.js';
const NOMES = [
  'plus', 'arrow-right', 'arrow-up', 'arrow-left', 'phone', 'camera', 'check', 'check-circle', 'caret-down', 'caret-right', 'x', 'x-circle',
  'cloud-slash', 'compass', 'copy', 'pencil-simple', 'dice-five', 'file-text', 'eye-slash', 'eye', 'squares-four', 'heart', 'house',
  'hourglass', 'images', 'crosshair', 'map-pin', 'sign-out', 'map-trifold', 'navigation-arrow', 'sliders-horizontal', 'users', 'user',
  'tag', 'printer', 'qr-code', 'arrow-clockwise', 'repeat', 'arrows-out', 'fork-knife', 'smiley-sad', 'magnifying-glass',
  'paper-plane-right', 'share-network', 'sparkle', 'stop-circle', 'storefront', 'clock', 'trash', 'speaker-high', 'person-simple-walk',
  'link', 'warning', 'vibrate', 'fire', 'sun', 'moon', 'bell', 'globe', 'thermometer',
];
const PESOS = { duotone: 'd', fill: 'f' };

// Só aceita <path>: um SVG com outra coisa (ou com <script>) faz o script parar.
function lerTracos(svg) {
  if (svg.includes('<script')) throw new Error('SVG com script');
  return [...svg.matchAll(/<(\w+)\s([^>]*?)\/?>/g)]
    .filter(([, elemento]) => elemento !== 'svg')
    .map(([, elemento, atributos]) => {
      if (elemento !== 'path') throw new Error(`elemento <${elemento}> não suportado`);
      const d = atributos.match(/\sd="([^"]*)"/)?.[1] ?? atributos.match(/^d="([^"]*)"/)?.[1];
      const o = atributos.match(/opacity="([^"]*)"/)?.[1];
      return o ? { d, o: Number(o) } : { d };
    });
}

const caminhos = {};
for (const nome of NOMES) {
  caminhos[nome] = {};
  for (const [peso, letra] of Object.entries(PESOS)) {
    const resposta = await fetch(`https://cdn.jsdelivr.net/npm/@phosphor-icons/core@${VERSAO}/assets/${peso}/${nome}-${peso}.svg`);
    if (!resposta.ok) throw new Error(`${nome} (${peso}): ${resposta.status}`);
    caminhos[nome][letra] = lerTracos(await resposta.text());
  }
}

const cabecalho = `// Desenhos dos ícones (Phosphor Icons, licença MIT — https://phosphoricons.com), gerados por
// scripts/gerar-icones.mjs a partir de @phosphor-icons/core ${VERSAO}. Cada ícone tem duas versões: "d" (duotone:
// contorno + fundo suave a 20 %) e "f" (cheio). Os desenhos estão numa grelha de 256 x 256.
// Não editar à mão: para acrescentar um ícone, juntar o nome ao script e gerar outra vez.
`;
fs.writeFileSync(SAIDA, `${cabecalho}export const CAMINHOS = ${JSON.stringify(caminhos)};\n`);
console.log(`${Object.keys(caminhos).length} ícones em ${SAIDA}`);
