import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Circle, Defs, RadialGradient, Stop, Svg } from 'react-native-svg';

import { corDoCalor } from '@/lib/cores';
import { eFotoRecortada, imagemDoPrato } from '@/lib/imagensDosPratos';
import { cores, espaco, fontes, raio } from '@/theme';

// Capa da página do restaurante (design térmico), quando o restaurante não tem fotografia:
// o prato principal de hoje em 3D, a flutuar devagar por cima de um "foco de calor" com anéis
// (as linhas isotérmicas das câmaras térmicas).
// Quando o cliente chega aqui por ter abanado o telemóvel (calhou = true), o prato cai do céu,
// salta até assentar e aparece o aviso "Hoje almoças aqui".
//
// Propriedades: prato ({ nome, categoria, foto_url }), calhou (true/false), altura (px).
export function CapaQuente({ prato, calhou = false, altura = 230 }) {
  // valores das animações (criados uma vez, como em src/components/Esqueleto.js)
  const [flutuar] = useState(() => new Animated.Value(0));
  const [cair] = useState(() => new Animated.Value(calhou ? 1 : 0));

  useEffect(() => {
    let parado = false;
    let animacao = null;
    // "reduzir movimento" ligado no telemóvel: a capa fica parada (como os esqueletos de carregamento)
    AccessibilityInfo.isReduceMotionEnabled().then((reduzir) => {
      if (parado) return;
      if (reduzir) {
        cair.setValue(0);
        return;
      }
      animacao = Animated.loop(
        Animated.sequence([
          Animated.timing(flutuar, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(flutuar, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      animacao.start();
      if (calhou) Animated.spring(cair, { toValue: 0, friction: 4, tension: 50, useNativeDriver: true }).start();
    });
    return () => {
      parado = true;
      animacao?.stop();
    };
  }, [calhou, cair, flutuar]);

  const lado = altura * 0.95;
  const subir = flutuar.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const doCeu = cair.interpolate({ inputRange: [0, 1], outputRange: [0, -altura * 1.4] });

  return (
    <View style={[estilos.capa, { height: altura }]} accessible accessibilityLabel={`Prato de hoje: ${prato.nome}`}>
      <Svg width={altura * 1.8} height={altura * 1.8} style={estilos.foco} pointerEvents="none">
        <Defs>
          <RadialGradient id="foco" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={corDoCalor(0.74)} stopOpacity={0.55} />
            <Stop offset="0.32" stopColor={corDoCalor(0.46)} stopOpacity={0.32} />
            <Stop offset="0.6" stopColor={corDoCalor(0.3)} stopOpacity={0.14} />
            <Stop offset="1" stopColor={corDoCalor(0.14)} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={altura * 0.9} cy={altura * 0.9} r={altura * 0.9} fill="url(#foco)" />
        {/* anéis de calor (isotérmicas), cada vez mais apagados para fora */}
        {[0.22, 0.34, 0.46, 0.58, 0.7].map((r, i) => (
          <Circle key={r} cx={altura * 0.9} cy={altura * 0.9} r={altura * r} stroke={cores.texto} strokeOpacity={0.1 - i * 0.016} fill="none" />
        ))}
      </Svg>
      <Animated.Image
        // a fotografia recortada do prato (sem fundo), se o restaurante a tirou; senão, a imagem 3D
        source={eFotoRecortada(prato.foto_url) ? { uri: prato.foto_url } : imagemDoPrato(prato)}
        resizeMode="contain"
        style={{ width: lado, height: lado, transform: [{ translateY: Animated.add(subir, doCeu) }] }}
      />
      {calhou ? (
        <View style={estilos.calhou}>
          <Text style={estilos.calhouTexto}>HOJE ALMOÇAS AQUI</Text>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  capa: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: raio.xl },
  foco: { position: 'absolute' },
  calhou: {
    position: 'absolute',
    top: espaco.m,
    alignSelf: 'center',
    backgroundColor: cores.acento,
    paddingHorizontal: espaco.m,
    paddingVertical: espaco.xs + 2,
    borderRadius: raio.pilula,
  },
  calhouTexto: { fontFamily: fontes.monoForte, fontSize: 11, letterSpacing: 0.8, color: cores.textoInverso },
});
