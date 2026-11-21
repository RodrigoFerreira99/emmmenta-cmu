import { paletaDoCalor } from '@/theme';

// Contas com cores (sem rede): a cor de uma "temperatura" e o contraste entre duas cores.

function paraRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function paraHex(rgb) {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Cor de uma temperatura entre 0 (frio) e 1 (quente), misturando as cores vizinhas da paleta.
// Ex.: corDoCalor(1) é quase branco, corDoCalor(0.74) é laranja, corDoCalor(0.3) é roxo.
export function corDoCalor(t, paleta = paletaDoCalor) {
  const x = Math.min(1, Math.max(0, Number(t) || 0));
  let i = 0;
  while (i < paleta.length - 2 && x > paleta[i + 1][0]) i++;
  const [p0, c0] = paleta[i];
  const [p1, c1] = paleta[i + 1];
  const f = (x - p0) / (p1 - p0);
  const a = paraRgb(c0);
  const b = paraRgb(c1);
  return paraHex(a.map((v, k) => v + (b[k] - v) * f));
}

// Temperatura de um prato pela distância: até 300 m é quase "a escaldar" (1), a 2 km já está morno (~0,55).
// Um prato esgotado está sempre frio.
export function calorDoPrato({ distanciaKm, esgotado = false }) {
  if (esgotado) return 0.3;
  const km = Math.max(0, Number(distanciaKm) || 0);
  return Math.max(0.5, Math.min(1, 1.05 - km * 0.25));
}

// Contraste entre duas cores, como nas regras de acessibilidade (WCAG): de 1 (igual) a 21 (preto e branco).
export function contraste(corA, corB) {
  const luz = (hex) => {
    const [r, g, b] = paraRgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [claro, escuro] = [luz(corA), luz(corB)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}
