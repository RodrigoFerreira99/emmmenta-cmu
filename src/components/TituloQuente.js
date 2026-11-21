import { StyleSheet, Text, View } from 'react-native';
import { Defs, LinearGradient, Stop, Svg, Text as TextoSvg } from 'react-native-svg';

import { corDoCalor } from '@/lib/cores';
import { cores, fontes } from '@/theme';

// Título do Início (design térmico): "O que / almoçamos / hoje?", com "almoçamos" pintado com as
// cores do calor (do magenta ao amarelo). O leitor de ecrã lê a frase inteira de uma vez.
const TAMANHO = 46;

export function TituloQuente() {
  const largura = TAMANHO * 5.6; // chega para "almoçamos" nesta letra
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="O que almoçamos hoje?">
      <Text style={estilos.linha}>O que</Text>
      <Svg width={largura} height={TAMANHO * 1.02}>
        <Defs>
          <LinearGradient id="calor-do-titulo" x1="0" y1="0" x2="1" y2="0">
            {[0.6, 0.74, 0.87, 0.74, 0.46].map((t, i) => (
              <Stop key={i} offset={i / 4} stopColor={corDoCalor(t)} />
            ))}
          </LinearGradient>
        </Defs>
        <TextoSvg x={0} y={TAMANHO * 0.8} fontSize={TAMANHO} fontFamily={fontes.grossa} letterSpacing={-1.8} fill="url(#calor-do-titulo)">
          almoçamos
        </TextoSvg>
      </Svg>
      <Text style={estilos.linha}>hoje?</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { fontFamily: fontes.grossa, fontSize: TAMANHO, lineHeight: TAMANHO * 1.02, letterSpacing: -1.8, color: cores.texto },
});
