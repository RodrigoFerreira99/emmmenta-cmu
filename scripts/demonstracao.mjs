// Restaurantes de demonstração — para a defesa e para testar o lado do cliente.
//
// Porquê: um menu só vale no dia em que é publicado (RN01). No dia da defesa, para a lista e o mapa do
// cliente terem pratos, é preciso haver menus publicados NESSE dia perto da escola. Este script publica-os
// num minuto, em 6 restaurantes de demonstração entre a ESMAD e o centro de Vila do Conde (todos a menos
// de 2 km da escola e do centro da zona "Vila do Conde", por isso aparecem com o raio por omissão).
//
// Os restaurantes, as moradas e os pratos são inventados. Os pontos no mapa ficam em ruas verdadeiras
// (confirmado no OpenStreetMap). Não têm telefone, para não se ligar por engano para um número real.
//
// Como usar (no computador, na pasta do projeto):
//   node scripts/demonstracao.mjs criar      cria as contas e os restaurantes (só da primeira vez)
//   node scripts/demonstracao.mjs publicar   publica o menu de hoje em todos (no próprio dia da demonstração)
//   node scripts/demonstracao.mjs estado     mostra quais têm menu hoje (não muda nada)
//   node scripts/demonstracao.mjs retirar    apaga o menu de hoje de todos (os restaurantes ficam)
//
// Segurança: usa só a chave pública (a mesma da app, do ficheiro .env) e as regras de segurança (RLS)
// normais — cada conta de demonstração só mexe no seu restaurante, como um restaurante verdadeiro.
// A palavra-passe das contas de demonstração fica no ficheiro .env.local, que nunca vai para o GitHub.

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Os restaurantes de demonstração
// ---------------------------------------------------------------------------

// Cada restaurante tem dois menus que alternam de dia para dia, para a demonstração não parecer parada.
// Os campos dos pratos são os da tabela "pratos": nome, categoria ('sopa' | 'carne' | 'peixe' |
// 'vegetariano' | 'sobremesa') e preco (euros).
const RESTAURANTES = [
  {
    conta: 'tasca-do-sancho',
    nome: 'Tasca do Sancho',
    tipo_cozinha: 'Portuguesa',
    morada: 'Rua Dom Sancho I, 120, Vila do Conde',
    latitude: 41.3643,
    longitude: -8.7375,
    hora_abertura: '12:00:00',
    hora_fecho: '15:00:00',
    menus: [
      {
        precoMenuCompleto: 9.5,
        pratos: [
          ['Caldo verde', 'sopa', 1.8],
          ['Rojões à moda do Minho', 'carne', 8.5],
          ['Bacalhau à Brás', 'peixe', 9],
          ['Arroz doce', 'sobremesa', 2],
        ],
      },
      {
        precoMenuCompleto: 9,
        pratos: [
          ['Sopa de legumes', 'sopa', 1.5],
          ['Frango assado', 'carne', 7.5],
          ['Pescada cozida com todos', 'peixe', 8.5],
          ['Leite-creme', 'sobremesa', 2.2],
        ],
      },
    ],
  },
  {
    conta: 'o-pescador',
    nome: 'O Pescador',
    tipo_cozinha: 'Peixe e marisco',
    morada: 'Rua de São Francisco, 45, Vila do Conde',
    latitude: 41.3558,
    longitude: -8.7387,
    hora_abertura: '12:00:00',
    hora_fecho: '15:30:00',
    menus: [
      {
        precoMenuCompleto: null,
        pratos: [
          ['Sopa de peixe', 'sopa', 2.5],
          ['Sardinhas assadas', 'peixe', 9.5],
          ['Polvo à lagareiro', 'peixe', 13.5],
          ['Bolo de bolacha', 'sobremesa', 2.5],
        ],
      },
      {
        precoMenuCompleto: null,
        pratos: [
          ['Sopa de marisco', 'sopa', 3],
          ['Caldeirada de peixe', 'peixe', 11],
          ['Dourada grelhada', 'peixe', 10.5],
          ['Pudim', 'sobremesa', 2.2],
        ],
      },
    ],
  },
  {
    conta: 'grelhados-da-avenida',
    nome: 'Grelhados da Avenida',
    tipo_cozinha: 'Grelhados',
    morada: 'Avenida Alexandre Herculano, 210, Vila do Conde',
    latitude: 41.3612,
    longitude: -8.7327,
    hora_abertura: '11:30:00',
    hora_fecho: '15:00:00',
    menus: [
      {
        precoMenuCompleto: 10,
        pratos: [
          ['Canja', 'sopa', 1.8],
          ['Picanha grelhada', 'carne', 11],
          ['Febras de porco', 'carne', 7],
          ['Espetada mista', 'carne', 9.5],
          ['Salada de fruta', 'sobremesa', 2],
        ],
      },
      {
        precoMenuCompleto: 10,
        pratos: [
          ['Sopa de feijão', 'sopa', 1.8],
          ['Costeleta de novilho', 'carne', 12.5],
          ['Entrecosto grelhado', 'carne', 8],
          ['Mousse de chocolate', 'sobremesa', 2.2],
        ],
      },
    ],
  },
  {
    conta: 'horta-da-luzia',
    nome: 'Horta da Luzia',
    tipo_cozinha: 'Vegetariana',
    morada: 'Rua Morgados de Santa Luzia, 30, Vila do Conde',
    latitude: 41.3576,
    longitude: -8.7459,
    hora_abertura: '12:00:00',
    hora_fecho: '15:00:00',
    menus: [
      {
        precoMenuCompleto: 9.5,
        pratos: [
          ['Creme de abóbora', 'sopa', 2],
          ['Caril de grão e legumes', 'vegetariano', 8],
          ['Lasanha de espinafres', 'vegetariano', 8.5],
          ['Bolo de cenoura', 'sobremesa', 2],
        ],
      },
      {
        precoMenuCompleto: 9.5,
        pratos: [
          ['Sopa de lentilhas', 'sopa', 2],
          ['Hambúrguer de feijão-preto', 'vegetariano', 8.5],
          ['Risotto de cogumelos', 'vegetariano', 9],
          ['Tarte de maçã', 'sobremesa', 2.5],
        ],
      },
    ],
  },
  {
    conta: 'cantinho-do-monte',
    nome: 'Cantinho do Monte',
    tipo_cozinha: 'Comida caseira',
    morada: 'Travessa Casal do Monte, 8, Vila do Conde',
    latitude: 41.3666,
    longitude: -8.7423,
    hora_abertura: '12:00:00',
    hora_fecho: '14:30:00',
    menus: [
      {
        precoMenuCompleto: 7.5,
        pratos: [
          ['Sopa do dia', 'sopa', 1.2],
          ['Arroz de pato', 'carne', 6.5],
          ['Pescada frita com arroz de tomate', 'peixe', 6.5],
          ['Fruta da época', 'sobremesa', 1],
        ],
      },
      {
        precoMenuCompleto: 7.5,
        pratos: [
          ['Sopa de grão', 'sopa', 1.2],
          ['Feijoada', 'carne', 6.5],
          ['Filetes de pescada', 'peixe', 6.5],
          ['Gelatina', 'sobremesa', 1],
        ],
      },
    ],
  },
  {
    conta: 'francesinha-e-companhia',
    nome: 'Francesinha & Companhia',
    tipo_cozinha: 'Petiscos',
    morada: 'Rua José Afonso, 15, Vila do Conde',
    latitude: 41.3621,
    longitude: -8.7471,
    hora_abertura: '12:00:00',
    hora_fecho: '16:00:00',
    menus: [
      {
        precoMenuCompleto: null,
        pratos: [
          ['Francesinha', 'carne', 9.5],
          ['Prego no pão', 'carne', 5.5],
          ['Bacalhau com natas', 'peixe', 8.5],
          ['Natas do céu', 'sobremesa', 2.5],
        ],
      },
      {
        precoMenuCompleto: null,
        pratos: [
          ['Francesinha especial', 'carne', 11],
          ['Cachorro à moda do Porto', 'carne', 6],
          ['Salada de atum', 'peixe', 6.5],
          ['Baba de camelo', 'sobremesa', 2.5],
        ],
      },
    ],
  },
];

// O email de cada conta. O domínio é inventado: o registo do projeto confirma as contas sozinho
// (sem enviar email), por isso nenhum email chega a ser enviado.
const emailDa = (restaurante) => `demo-${restaurante.conta}@emmmenta-demo.pt`;

// ---------------------------------------------------------------------------
// Configuração (ficheiros .env e .env.local)
// ---------------------------------------------------------------------------

// Lê um ficheiro de variáveis ("NOME=valor" por linha). Devolve {} se o ficheiro não existir.
function lerVariaveis(caminho) {
  if (!existsSync(caminho)) return {};
  const variaveis = {};
  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const certa = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (certa) variaveis[certa[1]] = certa[2].replace(/^["']|["']$/g, '');
  }
  return variaveis;
}

const variaveis = { ...lerVariaveis('.env'), ...lerVariaveis('.env.local') };
const URL_DO_SUPABASE = variaveis.EXPO_PUBLIC_SUPABASE_URL;
const CHAVE_PUBLICA = variaveis.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function falhar(mensagem) {
  console.error(`\n✖ ${mensagem}\n`);
  process.exit(1);
}

if (!URL_DO_SUPABASE || !CHAVE_PUBLICA) {
  falhar('Não encontrei as chaves do Supabase no ficheiro .env. Corre o script na pasta do projeto.');
}

// A palavra-passe das contas de demonstração. Só o comando "criar" a pode inventar (e guarda-a no .env.local).
function palavraPasse({ podeCriar }) {
  if (variaveis.EMMMENTA_DEMO_PALAVRA_PASSE) return variaveis.EMMMENTA_DEMO_PALAVRA_PASSE;
  if (!podeCriar) {
    falhar('Falta EMMMENTA_DEMO_PALAVRA_PASSE no ficheiro .env.local. Corre primeiro "node scripts/demonstracao.mjs criar".');
  }
  const nova = randomBytes(18).toString('base64url');
  appendFileSync('.env.local', `\n# contas de demonstração (scripts/demonstracao.mjs) — não vai para o GitHub\nEMMMENTA_DEMO_PALAVRA_PASSE=${nova}\n`);
  console.log('Criei uma palavra-passe para as contas de demonstração e guardei-a no ficheiro .env.local.');
  return nova;
}

// Um cliente do Supabase novo por conta, sem guardar a sessão em lado nenhum.
const novoCliente = () => createClient(URL_DO_SUPABASE, CHAVE_PUBLICA, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------------------------------------------------------------------------
// Datas (as mesmas regras da app: o dia é sempre o de Lisboa — RN01)
// ---------------------------------------------------------------------------

function hojeEmLisboa() {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date())
    .reduce((acc, parte) => ({ ...acc, [parte.type]: parte.value }), {});
  return `${partes.year}-${partes.month}-${partes.day}`;
}

// 0, 1, 0, 1… de dia para dia: escolhe qual dos dois menus de cada restaurante se publica hoje.
function varianteDeHoje() {
  const [ano, mes, dia] = hojeEmLisboa().split('-').map(Number);
  return Math.floor(Date.UTC(ano, mes - 1, dia) / (24 * 60 * 60 * 1000)) % 2;
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

// Entra na conta de demonstração; com "podeRegistar", cria-a se ainda não existir.
async function entrar(cliente, restaurante, senha, { podeRegistar = false } = {}) {
  const email = emailDa(restaurante);
  const { data, error } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (!error) return data.user;
  if (!podeRegistar) throw new Error(`não foi possível entrar na conta ${email} (${error.message})`);

  // ainda não existe: regista-a como conta de restaurante (o perfil é criado pelo trigger da base de dados)
  const registo = await cliente.auth.signUp({
    email,
    password: senha,
    options: { data: { nome: restaurante.nome, tipo: 'restaurante' } },
  });
  if (registo.error) throw new Error(`não foi possível criar a conta ${email} (${registo.error.message})`);
  if (!registo.data.session) throw new Error(`a conta ${email} foi criada mas precisa de confirmação por email`);
  return registo.data.user;
}

async function buscarRestaurante(cliente, donoId) {
  const { data, error } = await cliente.from('restaurantes').select('id, nome').eq('dono_id', donoId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function criar() {
  const senha = palavraPasse({ podeCriar: true });
  for (const restaurante of RESTAURANTES) {
    const cliente = novoCliente();
    try {
      const utilizador = await entrar(cliente, restaurante, senha, { podeRegistar: true });
      const { error } = await cliente.from('restaurantes').upsert(
        {
          dono_id: utilizador.id,
          nome: restaurante.nome,
          tipo_cozinha: restaurante.tipo_cozinha,
          morada: restaurante.morada,
          latitude: restaurante.latitude,
          longitude: restaurante.longitude,
          hora_abertura: restaurante.hora_abertura,
          hora_fecho: restaurante.hora_fecho,
          telefone: null,
          foto_url: null,
        },
        { onConflict: 'dono_id' }
      );
      if (error) throw new Error(error.message);
      console.log(`✔ ${restaurante.nome}`);
    } catch (erro) {
      console.log(`✖ ${restaurante.nome}: ${erro.message}`);
    } finally {
      await cliente.auth.signOut();
    }
  }
}

async function publicar() {
  const senha = palavraPasse({ podeCriar: false });
  const variante = varianteDeHoje();
  console.log(`Menus de hoje (${hojeEmLisboa()}, variante ${variante + 1}):`);

  for (const restaurante of RESTAURANTES) {
    const cliente = novoCliente();
    try {
      const utilizador = await entrar(cliente, restaurante, senha);
      const guardado = await buscarRestaurante(cliente, utilizador.id);
      if (!guardado) throw new Error('o restaurante não existe — corre primeiro "criar"');

      const menuDeHoje = restaurante.menus[variante];
      // como na app: o dia não se envia, a base de dados preenche-o no fuso de Lisboa
      const { data: menu, error: erroDoMenu } = await cliente
        .from('menus')
        .upsert({ restaurante_id: guardado.id, preco_menu_completo: menuDeHoje.precoMenuCompleto }, { onConflict: 'restaurante_id,dia' })
        .select('id')
        .single();
      if (erroDoMenu) throw new Error(erroDoMenu.message);

      // começa sempre do zero: tira os pratos que lá estivessem e põe os do menu de hoje (nenhum esgotado)
      const apagar = await cliente.from('pratos').delete().eq('menu_id', menu.id);
      if (apagar.error) throw new Error(apagar.error.message);
      const pratos = menuDeHoje.pratos.map(([nome, categoria, preco]) => ({ menu_id: menu.id, nome, categoria, preco }));
      const inserir = await cliente.from('pratos').insert(pratos);
      if (inserir.error) throw new Error(inserir.error.message);

      console.log(`✔ ${restaurante.nome}: ${pratos.length} pratos`);
    } catch (erro) {
      console.log(`✖ ${restaurante.nome}: ${erro.message}`);
    } finally {
      await cliente.auth.signOut();
    }
  }
}

async function estado() {
  const hoje = hojeEmLisboa();
  const { data, error } = await novoCliente()
    .from('restaurantes')
    .select('nome, menus(dia, pratos(id))')
    .in('nome', RESTAURANTES.map((restaurante) => restaurante.nome));
  if (error) falhar(error.message);

  console.log(`Restaurantes de demonstração (${hoje}):`);
  for (const restaurante of RESTAURANTES) {
    const guardado = data.find((linha) => linha.nome === restaurante.nome);
    if (!guardado) {
      console.log(`  · ${restaurante.nome}: ainda não foi criado`);
      continue;
    }
    const menuDeHoje = guardado.menus.find((menu) => menu.dia === hoje);
    console.log(`  · ${restaurante.nome}: ${menuDeHoje ? `menu de hoje com ${menuDeHoje.pratos.length} pratos` : 'sem menu hoje'}`);
  }
}

async function retirar() {
  const senha = palavraPasse({ podeCriar: false });
  for (const restaurante of RESTAURANTES) {
    const cliente = novoCliente();
    try {
      const utilizador = await entrar(cliente, restaurante, senha);
      const guardado = await buscarRestaurante(cliente, utilizador.id);
      if (guardado) {
        // os pratos desse menu apagam-se com ele (a base de dados apaga-os em cascata)
        const { error } = await cliente.from('menus').delete().eq('restaurante_id', guardado.id).eq('dia', hojeEmLisboa());
        if (error) throw new Error(error.message);
      }
      console.log(`✔ ${restaurante.nome}: sem menu hoje`);
    } catch (erro) {
      console.log(`✖ ${restaurante.nome}: ${erro.message}`);
    } finally {
      await cliente.auth.signOut();
    }
  }
}

const COMANDOS = { criar, publicar, estado, retirar };
const comando = COMANDOS[process.argv[2]];
if (!comando) {
  falhar('Usa: node scripts/demonstracao.mjs criar | publicar | estado | retirar');
}
await comando();
