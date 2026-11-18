import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';

import { cores, espaco, raio } from '@/theme';

// Esqueletos de carregamento: enquanto os dados não chegam, aparecem cartões cinzentos com a forma
// do que vai aparecer, a "pulsar" devagar. A pessoa percebe logo o que vem a caminho, e a espera
// parece mais curta do que com um círculo a rodar.
//
// Quem tem a opção "reduzir movimento" ligada no telemóvel vê os cartões parados (acessibilidade).

function usePulsar() {
  // o valor animado é criado uma só vez (useState com uma função) e depois anima sozinho
  const [opacidade] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    let animacao = null;
    let ativo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduzir) => {
        if (!ativo || reduzir) return;
        animacao = Animated.loop(
          Animated.sequence([
            Animated.timing(opacidade, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(opacidade, { toValue: 0.55, duration: 700, useNativeDriver: true }),
          ])
        );
        animacao.start();
      });
    return () => {
      ativo = false;
      animacao?.stop();
    };
  }, [opacidade]);

  return opacidade;
}

// Um bloco cinzento (uma linha de texto, um preço, uma fotografia…).
function Bloco({ largura = '100%', altura = 14, estilo }) {
  return <View style={[estilos.bloco, { width: largura, height: altura }, estilo]} />;
}

/** Cartões com a forma dos cartões de prato da lista do Início. */
export function ListaFantasma({ quantos = 4 }) {
  const opacidade = usePulsar();
  return (
    <Animated.View style={[estilos.lista, { opacity: opacidade }]} accessible accessibilityLabel="A carregar os pratos">
      {Array.from({ length: quantos }, (_vazio, indice) => (
        <View key={indice} style={estilos.cartao}>
          <View style={estilos.textos}>
            <Bloco largura="70%" altura={16} />
            <Bloco largura="45%" altura={12} />
            <Bloco largura="25%" altura={10} />
          </View>
          <Bloco largura={56} altura={18} />
        </View>
      ))}
    </Animated.View>
  );
}

/** A página de um restaurante a carregar: fotografia, nome, informações e pratos. */
export function PaginaFantasma() {
  const opacidade = usePulsar();
  return (
    <Animated.View style={[estilos.pagina, { opacity: opacidade }]} accessible accessibilityLabel="A carregar o restaurante">
      <Bloco altura={180} estilo={estilos.fotografia} />
      <Bloco largura="60%" altura={24} />
      <Bloco largura="35%" altura={12} />
      <View style={estilos.cartao}>
        <View style={estilos.textos}>
          <Bloco largura="50%" altura={12} />
          <Bloco largura="80%" altura={14} />
        </View>
      </View>
      <Bloco largura="40%" altura={18} />
      {[0, 1, 2].map((indice) => (
        <View key={indice} style={estilos.cartao}>
          <View style={estilos.textos}>
            <Bloco largura="65%" altura={14} />
            <Bloco largura="30%" altura={10} />
          </View>
          <Bloco largura={48} altura={14} />
        </View>
      ))}
    </Animated.View>
  );
}

/** Algumas linhas simples (por exemplo, a lista de favoritos). */
export function LinhasFantasma({ quantas = 2 }) {
  const opacidade = usePulsar();
  return (
    <Animated.View style={[estilos.lista, { opacity: opacidade }]} accessible accessibilityLabel="A carregar">
      {Array.from({ length: quantas }, (_vazio, indice) => (
        <View key={indice} style={estilos.cartao}>
          <View style={estilos.textos}>
            <Bloco largura="55%" altura={14} />
            <Bloco largura="35%" altura={10} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  bloco: { borderRadius: raio.s, backgroundColor: cores.linha },
  lista: { gap: espaco.m },
  pagina: { padding: espaco.xl, gap: espaco.l },
  fotografia: { borderRadius: raio.xl },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    padding: espaco.l,
    minHeight: 72,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  textos: { flex: 1, gap: espaco.s },
});
