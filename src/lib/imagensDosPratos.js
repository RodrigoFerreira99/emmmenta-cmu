// Imagens 3D dos pratos (design térmico). São desenhos 3D feitos a partir dos modelos de comida do
// Kenney (licença CC0, kenney.nl), com cores novas, e vêm dentro da app (assets/pratos): aparecem
// mesmo sem rede. Quando o restaurante tira uma fotografia ao prato, a fotografia tem prioridade.
//
// imagemDoPrato({ nome, categoria }) escolhe a imagem pelo nome do prato ("Bitoque" → bitoque,
// "Caldo verde" → caldo…) e, se nenhuma palavra servir, pela categoria (carne → bife…).

const IMAGENS = {
  arroz: require('../../assets/pratos/arroz.png'),
  bife: require('../../assets/pratos/bife.png'),
  bitoque: require('../../assets/pratos/bitoque.png'),
  bolo: require('../../assets/pratos/bolo.png'),
  caldo: require('../../assets/pratos/caldo.png'),
  caril: require('../../assets/pratos/caril.png'),
  entrecosto: require('../../assets/pratos/entrecosto.png'),
  estufado: require('../../assets/pratos/estufado.png'),
  frango: require('../../assets/pratos/frango.png'),
  gelado: require('../../assets/pratos/gelado.png'),
  hamburguer: require('../../assets/pratos/hamburguer.png'),
  legumes: require('../../assets/pratos/legumes.png'),
  ovos: require('../../assets/pratos/ovos.png'),
  peixe: require('../../assets/pratos/peixe.png'),
  pizza: require('../../assets/pratos/pizza.png'),
  pudim: require('../../assets/pratos/pudim.png'),
  salada: require('../../assets/pratos/salada.png'),
  salsichas: require('../../assets/pratos/salsichas.png'),
  sandes: require('../../assets/pratos/sandes.png'),
  sopa: require('../../assets/pratos/sopa.png'),
  tarte: require('../../assets/pratos/tarte.png'),
};

// Palavras do nome (sem acentos) → imagem. A ordem conta: a primeira que servir ganha.
const PALAVRAS_DE_SOBREMESA = [
  [/pudim|leite creme|flan|creme brule|natas do ceu|arroz doce|aletria/, 'pudim'],
  [/tarte|cheesecake|pastel de nata/, 'tarte'],
  [/gelado|sorvete|sundae/, 'gelado'],
];
const PALAVRAS_DE_SOPA = [[/caldo|canja/, 'caldo']];
const PALAVRAS_DE_PRATO = [
  [/^arroz|paelha|risoto/, 'arroz'],
  [/bitoque/, 'bitoque'],
  [/francesinha|tosta|prego|bifana|sandes|sanduiche|cachorro|wrap/, 'sandes'],
  [/hamburguer|burger/, 'hamburguer'],
  [/frango|galinha|peru|pato|aves/, 'frango'],
  [/salsicha|chourico|alheira|farinheira|linguica/, 'salsichas'],
  [/entrecosto|costeleta|costelinha|rojoes|febras|secretos|ribs/, 'entrecosto'],
  [/bife|vitela|novilho|picanha|naco|lombo|maminha/, 'bife'],
  [/caril|grao|tikka|dahl/, 'caril'],
  [/feijoada|cozido|guisado|estufado|chanfana|dobrada|tripas|rancho|jardineira|chili/, 'estufado'],
  [/bacalhau|pescada|robalo|dourada|sardinha|salmao|atum|peixe|polvo|lulas|choco|carapau|cavala|marisco|camarao/, 'peixe'],
  [/pizza/, 'pizza'],
  [/omelete|ovos|ovo /, 'ovos'],
  [/salada|bowl|poke/, 'salada'],
  [/legumes|tofu|seitan|cogumelos|vegetais|beringela|curgete/, 'legumes'],
];
const POR_CATEGORIA = { sopa: 'sopa', carne: 'bife', peixe: 'peixe', vegetariano: 'salada', sobremesa: 'bolo' };

function semAcentos(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/-/g, ' ')
    .toLowerCase();
}

// Devolve o nome da imagem (ex.: 'bitoque'). Exportado à parte para se poder testar.
export function chaveDaImagem({ nome, categoria } = {}) {
  const texto = ` ${semAcentos(nome)} `.replace(/^ /, '');
  const listas =
    categoria === 'sobremesa' ? [PALAVRAS_DE_SOBREMESA] : categoria === 'sopa' ? [PALAVRAS_DE_SOPA] : [PALAVRAS_DE_PRATO, PALAVRAS_DE_SOPA];
  for (const lista of listas) {
    const encontrada = lista.find(([palavras]) => palavras.test(texto));
    if (encontrada) return encontrada[1];
  }
  return POR_CATEGORIA[categoria] || 'bife';
}

export function imagemDoPrato(prato) {
  return IMAGENS[chaveDaImagem(prato)];
}

// O prato que aparece em grande na capa da página do restaurante: o primeiro prato principal
// (carne, peixe ou vegetariano) que ainda não esgotou; senão, o primeiro que houver.
// Sem menu hoje, escolhe-se uma imagem pelo tipo de cozinha.
export function pratoDeDestaque(pratos = [], restaurante = null) {
  const disponiveis = pratos.filter((p) => !p.esgotado);
  const principal = disponiveis.find((p) => ['carne', 'peixe', 'vegetariano'].includes(p.categoria)) ?? disponiveis[0] ?? pratos[0];
  if (principal) return { nome: principal.nome, categoria: principal.categoria, foto_url: principal.foto_url ?? null };
  return { nome: restaurante?.tipo_cozinha ?? '', categoria: 'carne' };
}

// true se o link for de uma fotografia já recortada (sem fundo) pela função "recortar-prato":
// <conta>/pratos/recorte-<nome>.png. Essas aparecem a flutuar sobre o calor, como as imagens 3D.
export function eFotoRecortada(link) {
  return typeof link === 'string' && /\/pratos\/recorte-[\w-]+\.png(\?.*)?$/.test(link);
}
