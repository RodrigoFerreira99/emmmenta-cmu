import { File, Paths } from 'expo-file-system';
import { useEffect, useSyncExternalStore } from 'react';

// Favoritos (trabalho futuro do relatório): os restaurantes de que o cliente gosta.
//
// Ficam guardados só neste telemóvel, num pequeno ficheiro (favoritos.json). Não vão para a base de dados:
// não é preciso mudar as tabelas nem as regras de segurança, e mais ninguém os vê (RGPD).
// A contrapartida: noutro telemóvel, ou depois de desinstalar a app, os favoritos não aparecem.
//
// Vários ecrãs mostram os favoritos ao mesmo tempo (página do restaurante, lista e mapa). Para mostrarem
// todos o mesmo, a lista vive aqui, num só sítio, e cada ecrã "ouve" as mudanças — a mesma ideia do tempo
// real do Supabase: quem muda avisa quem está a ouvir. Uso num ecrã:
//   const { eFavorito, alternarFavorito } = useFavoritos();

const NOME_DO_FICHEIRO = 'favoritos.json';

let favoritos = new Set(); // ids dos restaurantes favoritos
let aCarregar = null; // a leitura do ficheiro (só se faz uma vez)
const ouvintes = new Set(); // funções a chamar quando os favoritos mudam

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

function ouvir(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

const lerAtuais = () => favoritos;

const ficheiro = () => new File(Paths.document, NOME_DO_FICHEIRO);

// Lê o ficheiro uma só vez (da primeira vez que um ecrã precisa dos favoritos).
function carregar() {
  if (!aCarregar) {
    aCarregar = (async () => {
      try {
        const guardado = ficheiro();
        if (guardado.exists) {
          const ids = JSON.parse(await guardado.text());
          if (Array.isArray(ids)) favoritos = new Set(ids.filter((id) => typeof id === 'string'));
        }
      } catch (erro) {
        // ficheiro estragado ou ilegível: começa-se sem favoritos, a app não pára por isto
        console.warn('Erro técnico (ler favoritos):', erro?.message ?? erro);
      }
      avisar();
    })();
  }
  return aCarregar;
}

/**
 * Marca o restaurante como favorito ou, se já for, tira-o dos favoritos.
 * O ecrã muda logo; se não for possível gravar, volta atrás e lança um Error em português.
 */
export async function alternarFavorito(restauranteId) {
  await carregar(); // para não se perderem favoritos que ainda estavam a ser lidos

  const antes = favoritos;
  const novos = new Set(favoritos);
  if (novos.has(restauranteId)) novos.delete(restauranteId);
  else novos.add(restauranteId);
  favoritos = novos; // um Set novo, para o React perceber que mudou
  avisar();

  try {
    const guardado = ficheiro();
    if (!guardado.exists) guardado.create();
    await guardado.write(JSON.stringify([...novos]));
  } catch (erro) {
    console.warn('Erro técnico (guardar favoritos):', erro?.message ?? erro);
    favoritos = antes;
    avisar();
    throw new Error('Não foi possível guardar os favoritos neste telemóvel.');
  }
}

/** Os favoritos para um ecrã: o ecrã volta a ser desenhado sempre que mudam. */
export function useFavoritos() {
  const atuais = useSyncExternalStore(ouvir, lerAtuais, lerAtuais);
  useEffect(() => {
    carregar();
  }, []);
  return { favoritos: atuais, eFavorito: (id) => atuais.has(id), alternarFavorito };
}
