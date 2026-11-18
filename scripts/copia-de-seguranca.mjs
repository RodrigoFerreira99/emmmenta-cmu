// Cópia de segurança dos dados públicos da Emmmenta — restaurantes, menus e pratos.
//
// Porquê: no plano gratuito o Supabase não guarda cópias diárias que se possam descarregar (isso só
// existe a partir do plano Pro). Se alguém apagar um restaurante ou um menu por engano antes da defesa,
// esta cópia mostra exatamente o que lá estava, para o voltar a pôr.
//
// Como usar (no computador, na pasta do projeto):
//   node scripts/copia-de-seguranca.mjs
// Cria o ficheiro copias/emmmenta-AAAA-MM-DD.json (a pasta "copias" não vai para o GitHub).
//
// O que NÃO entra na cópia (de propósito):
//   - as contas e as palavras-passe (ficam só no Supabase, nunca saem de lá);
//   - a tabela "perfis": cada conta só consegue ler o seu perfil (regras de segurança, RLS);
//   - as fotografias: ficam os links (foto_url), que continuam a funcionar enquanto o Storage existir.
//
// Segurança: usa só a chave pública (a mesma da app, do ficheiro .env) e lê só o que qualquer
// cliente da app já pode ler. Não escreve nada na base de dados.

import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

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

const variaveis = lerVariaveis('.env');
const URL_DO_SUPABASE = variaveis.EXPO_PUBLIC_SUPABASE_URL;
const CHAVE_PUBLICA = variaveis.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL_DO_SUPABASE || !CHAVE_PUBLICA) {
  console.error('\n✖ Não encontrei as chaves do Supabase no ficheiro .env. Corre o script na pasta do projeto.\n');
  process.exit(1);
}

const cliente = createClient(URL_DO_SUPABASE, CHAVE_PUBLICA, { auth: { persistSession: false, autoRefreshToken: false } });

// O Supabase devolve no máximo 1000 linhas por pedido: pede-se aos bocados até não vir mais nada.
const POR_PEDIDO = 1000;
async function lerTabela(tabela, ordem) {
  const linhas = [];
  for (let inicio = 0; ; inicio += POR_PEDIDO) {
    const { data, error } = await cliente
      .from(tabela)
      .select('*')
      .order(ordem)
      .range(inicio, inicio + POR_PEDIDO - 1);
    if (error) throw new Error(`não foi possível ler a tabela ${tabela} (${error.message})`);
    linhas.push(...data);
    if (data.length < POR_PEDIDO) return linhas;
  }
}

// O dia de hoje em Lisboa (AAAA-MM-DD), para o nome do ficheiro — a mesma regra da app (RN01).
function hojeEmLisboa() {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date())
    .reduce((acc, parte) => ({ ...acc, [parte.type]: parte.value }), {});
  return `${partes.year}-${partes.month}-${partes.day}`;
}

try {
  const restaurantes = await lerTabela('restaurantes', 'criado_em');
  const menus = await lerTabela('menus', 'dia');
  const pratos = await lerTabela('pratos', 'criado_em');

  const copia = {
    feitaEm: new Date().toISOString(),
    nota: 'Cópia dos dados públicos da Emmmenta (scripts/copia-de-seguranca.mjs). Sem contas, palavras-passe nem perfis.',
    totais: { restaurantes: restaurantes.length, menus: menus.length, pratos: pratos.length },
    restaurantes,
    menus,
    pratos,
  };

  mkdirSync('copias', { recursive: true });
  const ficheiro = `copias/emmmenta-${hojeEmLisboa()}.json`;
  writeFileSync(ficheiro, `${JSON.stringify(copia, null, 2)}\n`);
  console.log(`\n✔ Cópia guardada em ${ficheiro}`);
  console.log(`  ${restaurantes.length} restaurantes, ${menus.length} menus e ${pratos.length} pratos.\n`);
} catch (erro) {
  console.error(`\n✖ ${erro.message}\n`);
  process.exit(1);
}
