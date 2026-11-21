import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icone } from '@/components/Icone';
import { hojeEmLisboa } from '@/lib/datas';
import { useFavoritos } from '@/lib/favoritos';
import { vibrarLeve } from '@/lib/vibrar';
import { buscarRestauranteDoMenu } from '@/services/menus';
import { ouvirPratosNovos } from '@/services/pratos';
import { cores, espaco, fontes, raio, texto } from '@/theme';

// Aviso em tempo real: com a app aberta, quando um restaurante FAVORITO publica o menu de hoje,
// aparece no topo "A Tasca do Sancho acabou de publicar o menu de hoje", com o botão "Ver".
//
// Como funciona: a tabela pratos está no tempo real do Supabase, que avisa a app de cada prato novo.
// O prato traz o id do menu; a app pergunta de que restaurante é esse menu e, se for um favorito
// e o menu for de hoje, mostra o aviso (uma só vez por menu). Fica 8 segundos e desaparece.
// Não precisa de notificações do sistema nem de guardar nada: só funciona com a app aberta.

const MOSTRAR_DURANTE_MS = 8000;
const ACABADO_DE_PUBLICAR_MS = 5 * 60 * 1000; // até 5 minutos depois, "acabou de publicar"

/** O texto do aviso: "acabou de publicar" se o menu é recente; senão, "acrescentou pratos". */
export function textoDoAvisoDeFavorito({ restaurante, publicadoEm }, agora = new Date()) {
  const recente = publicadoEm && agora - new Date(publicadoEm) < ACABADO_DE_PUBLICAR_MS;
  return recente ? `${restaurante} acabou de publicar o menu de hoje` : `${restaurante} acrescentou pratos ao menu de hoje`;
}

export function AvisoDeFavoritos() {
  const { favoritos } = useFavoritos();
  const [aviso, setAviso] = useState(null); // { restauranteId, texto } ou null

  // o "ouvinte" do tempo real é criado uma só vez; lê os favoritos mais recentes através desta referência
  const favoritosAtuais = useRef(favoritos);
  useEffect(() => {
    favoritosAtuais.current = favoritos;
  }, [favoritos]);

  useEffect(() => {
    let ativo = true;
    const menusJaVistos = new Set(); // cada menu só dá aviso uma vez (um menu com 5 pratos chega em 5 avisos)

    const pararDeOuvir = ouvirPratosNovos(async (prato) => {
      if (!prato?.menu_id || menusJaVistos.has(prato.menu_id)) return;
      menusJaVistos.add(prato.menu_id);
      try {
        const menu = await buscarRestauranteDoMenu(prato.menu_id);
        if (!ativo || !menu || menu.dia !== hojeEmLisboa()) return;
        if (!favoritosAtuais.current.has(menu.restauranteId)) return;
        vibrarLeve();
        setAviso({ restauranteId: menu.restauranteId, texto: textoDoAvisoDeFavorito(menu) });
      } catch {
        // sem rede: não há aviso, e a app continua igual
      }
    });

    return () => {
      ativo = false;
      pararDeOuvir();
    };
  }, []);

  // o aviso desaparece sozinho ao fim de 8 segundos
  useEffect(() => {
    if (!aviso) return;
    const relogio = setTimeout(() => setAviso(null), MOSTRAR_DURANTE_MS);
    return () => clearTimeout(relogio);
  }, [aviso]);

  if (!aviso) return null;

  function ver() {
    const { restauranteId } = aviso;
    setAviso(null);
    router.push({ pathname: '/restaurante/[id]', params: { id: restauranteId } });
  }

  return (
    // "box-none": só o cartão recebe toques; o resto do ecrã por baixo continua a funcionar
    <SafeAreaView edges={['top']} pointerEvents="box-none" style={estilos.posicao}>
      <View style={estilos.cartao} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Icone name="heart" size={20} color={cores.acento} />
        <Text style={[texto.corpo, estilos.ocuparTudo]}>{aviso.texto}</Text>
        <Pressable onPress={ver} accessibilityRole="button" accessibilityLabel="Ver o menu" style={estilos.botao}>
          <Text style={estilos.botaoTexto}>Ver</Text>
        </Pressable>
        <Pressable onPress={() => setAviso(null)} accessibilityRole="button" accessibilityLabel="Fechar o aviso" style={estilos.fechar}>
          <Icone name="close" size={18} color={cores.textoSecundario} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  posicao: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: espaco.l, paddingTop: espaco.s },
  ocuparTudo: { flex: 1 },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingLeft: espaco.l,
    paddingVertical: espaco.s,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
    // sombra leve para o aviso se destacar do ecrã por baixo
    shadowColor: cores.sombra,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  // minHeight 44: área de toque mínima (RNF06)
  botao: { minHeight: 44, justifyContent: 'center', paddingHorizontal: espaco.s },
  botaoTexto: { ...texto.corpo, fontFamily: fontes.negrito, color: cores.acento },
  fechar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
