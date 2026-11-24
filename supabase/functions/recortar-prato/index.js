// Função "recortar-prato" — corre nos servidores do Supabase (Edge Function, em Deno), NÃO dentro da app.
//
// Design térmico: tira o fundo à fotografia de um prato, para o prato verdadeiro aparecer "a flutuar"
// sobre o calor, como as imagens 3D. Usa o serviço remove.bg (plano gratuito: 50 recortes por mês em
// tamanho pequeno, até 0,25 megapíxeis, que chega para o ecrã do telemóvel). A chave do serviço é um
// segredo do Supabase (REMOVE_BG_API_KEY) e nunca está na app nem no repositório.
//
//   { foto: "https://<projeto>.supabase.co/storage/v1/object/public/fotos/<conta>/pratos/prato-123.jpg" }
//     → { url: "https://<projeto>.supabase.co/storage/v1/object/public/fotos/<conta>/pratos/recorte-prato-123.png" }
//
// Regras: só contas de restaurante, e só fotografias da pasta da própria conta (<id da conta>/pratos/).
// O recorte é guardado no Storage com a sessão de quem pediu, por isso valem as regras de segurança de
// sempre (cada conta só escreve na sua pasta). Se alguma coisa falhar, a app fica com a fotografia normal.

const SERVICO = 'https://api.remove.bg/v1.0/removebg';
const BUCKET = 'fotos';
const TAMANHO_MAXIMO = 500 * 1024; // o limite do bucket "fotos"
const TEMPO_MAXIMO_MS = 15 * 1000;

const CABECALHOS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function responder(estado, corpo) {
  return new Response(JSON.stringify(corpo), { status: estado, headers: CABECALHOS });
}

// Quem fez o pedido: { id, restaurante } a partir da sessão, ou null se a sessão não for válida.
async function quemPede(pedido) {
  const base = Deno.env.get('SUPABASE_URL');
  const cabecalhos = {
    apikey: pedido.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    Authorization: pedido.headers.get('Authorization') ?? '',
  };
  const sessao = await fetch(`${base}/auth/v1/user`, { headers: cabecalhos });
  if (!sessao.ok) return null;
  const { id } = await sessao.json();
  // com a sessão de quem pede, as regras de segurança só deixam ler o próprio perfil
  const resposta = await fetch(`${base}/rest/v1/perfis?select=tipo&id=eq.${encodeURIComponent(id)}`, { headers: cabecalhos });
  const perfis = resposta.ok ? await resposta.json() : [];
  return { id, restaurante: perfis[0]?.tipo === 'restaurante', cabecalhos };
}

// Da ligação pública da fotografia tira o caminho dentro do bucket, e confirma que é uma fotografia
// de prato da pasta da própria conta. Devolve null se não for.
function caminhoDaFoto(foto, base, idDaConta) {
  const prefixo = `${base}/storage/v1/object/public/${BUCKET}/`;
  if (typeof foto !== 'string' || !foto.startsWith(prefixo)) return null;
  const caminho = decodeURIComponent(foto.slice(prefixo.length).split('?')[0]);
  if (!caminho.startsWith(`${idDaConta}/pratos/`) || caminho.includes('..')) return null;
  if (!/^[\w-]+\.(jpe?g|png|webp)$/i.test(caminho.slice(`${idDaConta}/pratos/`.length))) return null;
  return caminho;
}

Deno.serve(async (pedido) => {
  if (pedido.method === 'OPTIONS') return new Response('ok', { headers: CABECALHOS });
  if (pedido.method !== 'POST') return responder(405, { erro: 'Pedido inválido.' });

  const chave = Deno.env.get('REMOVE_BG_API_KEY');
  if (!chave) return responder(503, { erro: 'O recorte das fotografias ainda não está ativado. Fica a fotografia normal.' });

  let conta = null;
  try {
    conta = await quemPede(pedido);
  } catch (erro) {
    console.error('Erro ao ver quem fez o pedido:', erro?.message ?? erro);
  }
  if (!conta) return responder(401, { erro: 'A tua sessão expirou. Termina a sessão e entra outra vez.' });
  if (!conta.restaurante) return responder(403, { erro: 'Só as contas de restaurante podem recortar fotografias.' });

  let corpo = null;
  try {
    corpo = await pedido.json();
  } catch {
    // tratado em baixo como pedido inválido
  }
  const base = Deno.env.get('SUPABASE_URL');
  const caminho = caminhoDaFoto(corpo?.foto, base, conta.id);
  if (!caminho) return responder(400, { erro: 'Fotografia inválida.' });

  try {
    // 1) pedir o recorte: o remove.bg vai buscar a fotografia ao link público
    const formulario = new FormData();
    formulario.append('image_url', corpo.foto);
    formulario.append('size', 'preview'); // pequeno (grátis) e chega para o telemóvel
    formulario.append('format', 'png'); // PNG: o fundo fica transparente
    formulario.append('crop', 'true'); // corta o espaço vazio à volta do prato
    formulario.append('crop_margin', '6%');
    const resposta = await fetch(SERVICO, {
      method: 'POST',
      headers: { 'X-Api-Key': chave },
      body: formulario,
      signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
    });
    if (!resposta.ok) {
      // o motivo técnico fica nos registos da função (painel do Supabase), não vai para a app
      console.error('remove.bg respondeu', resposta.status, (await resposta.text()).slice(0, 300));
      if (resposta.status === 402) return responder(429, { erro: 'Os recortes grátis deste mês acabaram. Fica a fotografia normal.' });
      if (resposta.status === 429) return responder(429, { erro: 'Demasiados recortes seguidos. Tenta daqui a um minuto.' });
      if (resposta.status === 400) return responder(422, { erro: 'Não encontrei o prato na fotografia. Fica a fotografia normal.' });
      if (resposta.status === 401 || resposta.status === 403) return responder(503, { erro: 'O recorte das fotografias não está bem configurado.' });
      return responder(502, { erro: 'O serviço de recorte não respondeu. Fica a fotografia normal.' });
    }
    const png = new Uint8Array(await resposta.arrayBuffer());
    if (png.byteLength > TAMANHO_MAXIMO) return responder(413, { erro: 'O recorte ficou grande demais. Fica a fotografia normal.' });

    // 2) guardar o recorte ao lado da fotografia: <conta>/pratos/recorte-<nome da fotografia>.png
    const nome = caminho.split('/').pop().replace(/\.[^.]+$/, '');
    const destino = `${conta.id}/pratos/recorte-${nome}.png`;
    const envio = await fetch(`${base}/storage/v1/object/${BUCKET}/${destino}`, {
      method: 'POST',
      headers: { ...conta.cabecalhos, 'Content-Type': 'image/png' },
      body: png,
    });
    const url = `${base}/storage/v1/object/public/${BUCKET}/${destino}`;
    if (!envio.ok) {
      const detalhe = await envio.text();
      // a mesma fotografia já tinha sido recortada antes: o recorte já lá está
      if (envio.status === 409 || /already exists|Duplicate/i.test(detalhe)) return responder(200, { url });
      console.error('Storage respondeu', envio.status, detalhe.slice(0, 300));
      return responder(502, { erro: 'Não foi possível guardar o recorte. Fica a fotografia normal.' });
    }
    return responder(200, { url });
  } catch (erro) {
    console.error('Erro ao recortar:', erro?.message ?? erro);
    return responder(502, { erro: 'O serviço de recorte não respondeu. Fica a fotografia normal.' });
  }
});
