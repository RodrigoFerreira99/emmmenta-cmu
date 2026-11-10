import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// RF02 — Perfil do restaurante.
// Tudo o que o ecrã precisa para ler, validar e guardar o restaurante está aqui.
// O ecrã (src/app/(restaurante)/perfil.js) nunca fala diretamente com o Supabase (RNF09).
//
// No ecrã trabalhamos com um objeto "dados", com o que está escrito nos campos:
//   { nome, tipoCozinha, morada, latitude, longitude, horaAbertura, horaFecho, telefone, fotoUrl }
// Na base de dados as colunas são: nome, tipo_cozinha, morada, latitude, longitude,
// hora_abertura, hora_fecho, telefone, foto_url. As funções abaixo fazem a conversão.

// ---------------------------------------------------------------------------
// Conversões e validação (funções simples, sem rede)
// ---------------------------------------------------------------------------

// Formulário de um restaurante que ainda não existe.
const FORMULARIO_VAZIO = {
  nome: '',
  tipoCozinha: '',
  morada: '',
  latitude: null,
  longitude: null,
  horaAbertura: '',
  horaFecho: '',
  telefone: '',
  fotoUrl: null,
};

// Aceita 00:00 até 23:59, sempre com dois dígitos de cada lado.
const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Tira os espaços do início e do fim e junta espaços repetidos: "  Tasca   do Zé " → "Tasca do Zé".
function limparEspacos(texto) {
  return (texto ?? '').trim().replace(/\s+/g, ' ');
}

/** Hora da base de dados ("12:00:00") → hora do ecrã ("12:00"). */
export function horaParaEcra(horaBd) {
  return horaBd ? horaBd.slice(0, 5) : '';
}

/** Hora do ecrã ("12:00") → hora da base de dados ("12:00:00"). Campo vazio → null. */
export function horaParaBd(horaEcra) {
  const hora = (horaEcra ?? '').trim();
  return hora ? `${hora}:00` : null;
}

/**
 * Põe os dois pontos sozinho enquanto a pessoa escreve a hora: "1230" → "12:30".
 * É preciso porque o teclado numérico do iPhone não tem a tecla ":".
 * Também põe o zero à esquerda quando a hora só pode ter um dígito: "930" → "09:30".
 */
export function mascararHora(textoEscrito) {
  let digitos = (textoEscrito ?? '').replace(/\D/g, '').slice(0, 4);
  // Nenhuma hora começa por 3 a 9 (não existe "30h"), por isso "9" só pode querer dizer "09".
  if (digitos.length > 0 && digitos[0] > '2') digitos = `0${digitos}`.slice(0, 4);
  return digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos;
}

/**
 * Telefone escrito pelo utilizador → formato guardado na base de dados.
 * "912 345 678", "+351 912 345 678" e "00351912345678" dão todos "+351912345678".
 * Devolve null se não for um número português válido.
 * Guardamos sempre com +351 porque o RF06 vai usar o número num link "tel:".
 */
export function normalizarTelefone(texto) {
  let digitos = (texto ?? '').replace(/[\s().-]/g, '');
  if (digitos.startsWith('+351')) digitos = digitos.slice(4);
  else if (digitos.startsWith('00351')) digitos = digitos.slice(5);
  // 9 dígitos, a começar por 2 (fixo), 3 (número nómada) ou 9 (telemóvel)
  return /^[239]\d{8}$/.test(digitos) ? `+351${digitos}` : null;
}

/** Telefone da base de dados ("+351912345678") → como aparece no campo ("912 345 678"). */
export function telefoneParaEcra(telefoneBd) {
  if (!telefoneBd) return '';
  const digitos = telefoneBd.replace('+351', '');
  if (digitos.length !== 9) return telefoneBd;
  return `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}`;
}

/** Linha da tabela "restaurantes" (ou null) → objeto "dados" para preencher o formulário. */
export function restauranteParaFormulario(linha) {
  if (!linha) return { ...FORMULARIO_VAZIO };
  return {
    nome: linha.nome ?? '',
    tipoCozinha: linha.tipo_cozinha ?? '',
    morada: linha.morada ?? '',
    latitude: linha.latitude ?? null,
    longitude: linha.longitude ?? null,
    horaAbertura: horaParaEcra(linha.hora_abertura),
    horaFecho: horaParaEcra(linha.hora_fecho),
    telefone: telefoneParaEcra(linha.telefone),
    fotoUrl: linha.foto_url ?? null,
  };
}

function coordenadasValidas(latitude, longitude) {
  return (
    Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
  );
}

/**
 * Valida o formulário. Devolve um objeto com uma mensagem por cada campo errado,
 * por exemplo { nome: 'Escreve o nome do restaurante.' }. Objeto vazio = tudo certo.
 * As chaves são: nome, tipoCozinha, morada, local, horaAbertura, horaFecho, telefone.
 */
export function validarRestaurante(dados) {
  const erros = {};

  const nome = limparEspacos(dados.nome);
  if (!nome) erros.nome = 'Escreve o nome do restaurante.';
  else if (nome.length < 2 || nome.length > 80) erros.nome = 'O nome tem de ter entre 2 e 80 caracteres.';

  if (limparEspacos(dados.tipoCozinha).length > 40) erros.tipoCozinha = 'Usa no máximo 40 caracteres.';

  if (!limparEspacos(dados.morada)) erros.morada = 'Escreve a morada do restaurante.';

  // Sem coordenadas o restaurante não aparece na pesquisa por distância (RF05).
  if (!coordenadasValidas(dados.latitude, dados.longitude)) erros.local = 'Marca o restaurante no mapa.';

  // Horário: é opcional, mas se um dos campos estiver preenchido o outro também tem de estar.
  const abre = (dados.horaAbertura ?? '').trim();
  const fecha = (dados.horaFecho ?? '').trim();
  if (abre || fecha) {
    if (!abre) erros.horaAbertura = 'Falta a hora de abertura.';
    else if (!HORA_VALIDA.test(abre)) erros.horaAbertura = 'Usa o formato HH:MM, por exemplo 12:00.';

    if (!fecha) erros.horaFecho = 'Falta a hora de fecho.';
    else if (!HORA_VALIDA.test(fecha)) erros.horaFecho = 'Usa o formato HH:MM, por exemplo 15:00.';

    // "12:00" < "15:00" funciona como texto porque as horas têm sempre dois dígitos.
    if (!erros.horaAbertura && !erros.horaFecho && fecha <= abre) {
      erros.horaFecho = 'O fecho tem de ser depois da abertura.';
    }
  }

  if ((dados.telefone ?? '').trim() && !normalizarTelefone(dados.telefone)) {
    erros.telefone = 'Escreve um número português com 9 dígitos.';
  }

  return erros;
}

// ---------------------------------------------------------------------------
// Erros: o utilizador nunca vê mensagens técnicas em inglês
// ---------------------------------------------------------------------------

// Recebe o erro do Supabase (ou da rede) e devolve um Error com uma mensagem em português.
function traduzirErro(erro) {
  // a mensagem técnica fica só na consola, para quem está a programar
  console.warn('Erro técnico (restaurantes):', erro?.message ?? erro);

  const mensagem = String(erro?.message ?? '').toLowerCase();
  const codigo = String(erro?.code ?? erro?.statusCode ?? '');
  const estadoHttp = Number(erro?.status ?? 0);

  if (mensagem.includes('network request failed') || mensagem.includes('failed to fetch') || mensagem.includes('timeout')) {
    return new Error('Sem ligação à internet. Verifica a rede e tenta outra vez.');
  }
  if (estadoHttp === 401 || mensagem.includes('jwt')) {
    return new Error('A tua sessão expirou. Termina a sessão e entra outra vez.');
  }
  // 42501 = a base de dados recusou por causa das regras de segurança (RLS); 403 = o mesmo no Storage
  if (codigo === '42501' || codigo === '403' || estadoHttp === 403 || mensagem.includes('row-level security')) {
    return new Error('Não tens permissão para fazer esta alteração. Só uma conta de restaurante pode guardar o seu perfil.');
  }
  if (codigo === '413' || estadoHttp === 413 || mensagem.includes('exceeded the maximum allowed size')) {
    return new Error('A fotografia é grande demais (o máximo são 500 KB).');
  }
  return new Error('Ocorreu um erro inesperado. Tenta outra vez.');
}

// ---------------------------------------------------------------------------
// Ler e guardar o restaurante (tabela "restaurantes")
// ---------------------------------------------------------------------------

/**
 * RF02 — o restaurante do utilizador que tem a sessão iniciada.
 * Devolve a linha da tabela "restaurantes" ou null se a conta ainda não criou o perfil.
 * (.maybeSingle() devolve null em vez de dar erro quando não há nenhuma linha.)
 */
export async function buscarMeuRestaurante(donoId) {
  try {
    const { data, error } = await supabase.from('restaurantes').select('*').eq('dono_id', donoId).maybeSingle();
    if (error) throw error;
    return data;
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

/**
 * RF02 — cria o restaurante na primeira vez e atualiza-o nas seguintes. Devolve a linha guardada.
 *
 * Usa "upsert": a base de dados tenta inserir e, se já existir uma linha com o mesmo dono_id
 * (a coluna é UNIQUE), atualiza essa linha. É um só pedido e nunca cria um segundo restaurante.
 * As regras de segurança (RLS) garantem que cada conta só mexe no seu (RN02).
 */
export async function guardarRestaurante(donoId, dados) {
  // defesa extra: mesmo que um ecrã se esqueça de validar, nada inválido chega à base de dados
  if (Object.keys(validarRestaurante(dados)).length > 0) {
    throw new Error('Há campos por corrigir antes de guardar.');
  }

  const linha = {
    dono_id: donoId,
    nome: limparEspacos(dados.nome),
    tipo_cozinha: limparEspacos(dados.tipoCozinha) || null,
    morada: limparEspacos(dados.morada),
    latitude: dados.latitude,
    longitude: dados.longitude,
    hora_abertura: horaParaBd(dados.horaAbertura),
    hora_fecho: horaParaBd(dados.horaFecho),
    telefone: normalizarTelefone(dados.telefone), // null se o campo estiver vazio
    foto_url: dados.fotoUrl ?? null,
  };

  try {
    const { data, error } = await supabase.from('restaurantes').upsert(linha, { onConflict: 'dono_id' }).select().single();
    if (error) throw error;
    return data;
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

// ---------------------------------------------------------------------------
// Fotografia (Storage, bucket "fotos")
// ---------------------------------------------------------------------------

// O bucket aceita no máximo 512 000 bytes; apontamos para 500 000 para ficar com folga (RNF05).
const LIMITE_FOTO_BYTES = 500 * 1000;

// Tentativas de compressão, da melhor qualidade para a pior. Paramos na primeira que couber no limite.
// "lado" é o tamanho máximo (em píxeis) do lado maior da imagem.
const TENTATIVAS_DE_COMPRESSAO = [
  { lado: 1200, qualidade: 0.7 },
  { lado: 1200, qualidade: 0.5 },
  { lado: 900, qualidade: 0.5 },
  { lado: 700, qualidade: 0.4 },
];

// Reduz e comprime a fotografia até ficar abaixo do limite. Devolve o ficheiro JPEG pronto a enviar.
async function comprimirFoto(uriLocal) {
  try {
    for (const { lado, qualidade } of TENTATIVAS_DE_COMPRESSAO) {
      // maxWidth/maxHeight: a imagem é reduzida logo ao ser lida, mantendo as proporções.
      // Uma imagem que já seja mais pequena fica como está (nunca é aumentada).
      const contexto = ImageManipulator.manipulate(uriLocal, { maxWidth: lado, maxHeight: lado });
      const imagem = await contexto.renderAsync();
      const resultado = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: qualidade });
      // libertar a memória da imagem (as fotografias do telemóvel são grandes)
      contexto.release();
      imagem.release();

      const ficheiro = new File(resultado.uri);
      if (ficheiro.size > 0 && ficheiro.size <= LIMITE_FOTO_BYTES) return ficheiro;
    }
  } catch (erro) {
    console.warn('Erro técnico (comprimir fotografia):', erro?.message ?? erro);
    throw new Error('Não foi possível preparar a fotografia. Escolhe outra imagem.');
  }
  throw new Error('Não foi possível reduzir a fotografia para menos de 500 KB. Escolhe outra imagem.');
}

/**
 * RF02 — comprime a fotografia escolhida no telemóvel, envia-a para o Storage e devolve o link público.
 * "uriLocal" é o caminho do ficheiro no telemóvel (vem do expo-image-picker).
 *
 * - O ficheiro vai para a pasta do próprio utilizador ("<id>/..."), a única onde as regras o deixam escrever.
 * - Cada envio tem um nome novo (com a data em milissegundos), por isso não é preciso "upsert".
 * - Em React Native o ficheiro é enviado como ArrayBuffer (os bytes), como recomenda a documentação do Supabase.
 */
export async function enviarFotoRestaurante(donoId, uriLocal) {
  const ficheiro = await comprimirFoto(uriLocal);
  const caminho = `${donoId}/restaurante-${Date.now()}.jpg`;

  try {
    const bytes = await ficheiro.arrayBuffer();
    const { error } = await supabase.storage.from('fotos').upload(caminho, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (error) throw error;
  } catch (erro) {
    throw traduzirErro(erro);
  }

  // O bucket é público: o link constrói-se a partir do caminho, sem mais nenhum pedido à rede.
  const { data } = supabase.storage.from('fotos').getPublicUrl(caminho);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Encontrar a morada no mapa (geocoding do telemóvel, não usa o Supabase)
// ---------------------------------------------------------------------------

/**
 * No Android, transformar uma morada em coordenadas só funciona com a permissão de localização
 * (é uma regra do expo-location). No iPhone não é precisa, por isso lá nunca a pedimos (RNF04).
 * Devolve true se ainda for preciso pedir a permissão.
 */
export async function faltaPermissaoParaProcurarMorada() {
  if (Platform.OS !== 'android') return false;
  try {
    const { granted } = await Location.getForegroundPermissionsAsync();
    return !granted;
  } catch (erro) {
    console.warn('Erro técnico (ver permissão):', erro?.message ?? erro);
    return true; // na dúvida, assumimos que falta e pedimos
  }
}

/** Mostra o pedido de permissão do sistema. Devolve true se o utilizador aceitou. */
export async function pedirPermissaoDeLocalizacao() {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    return granted;
  } catch (erro) {
    console.warn('Erro técnico (pedir permissão):', erro?.message ?? erro);
    return false;
  }
}

/**
 * Procura as coordenadas de uma morada. Devolve { latitude, longitude } ou null se não encontrar.
 * Nota (RNF04): isto NÃO lê a localização do telemóvel — só converte o texto da morada num ponto.
 */
export async function procurarMoradaNoMapa(morada) {
  const texto = limparEspacos(morada);
  if (!texto) throw new Error('Escreve primeiro a morada.');

  // acrescentar o país evita resultados com o mesmo nome de rua noutro sítio do mundo
  const pesquisa = /portugal/i.test(texto) ? texto : `${texto}, Portugal`;

  let resultados;
  try {
    resultados = await Location.geocodeAsync(pesquisa);
  } catch (erro) {
    console.warn('Erro técnico (procurar morada):', erro?.message ?? erro);
    throw new Error('Não foi possível procurar a morada. Verifica a ligação à internet ou põe o pin à mão.');
  }

  if (resultados.length === 0) return null;
  return { latitude: resultados[0].latitude, longitude: resultados[0].longitude };
}
