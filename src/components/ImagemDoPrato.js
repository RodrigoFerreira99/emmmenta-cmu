import { Image, StyleSheet, View } from 'react-native';
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';

import { calorDoPrato, corDoCalor } from '@/lib/cores';
import { imagemDoPrato } from '@/lib/imagensDosPratos';
import { cores, raio as raios } from '@/theme';

// Imagem de um prato (design térmico): a fotografia do restaurante, se existir; senão, a imagem 3D
// do tipo de prato (src/lib/imagensDosPratos.js). Por trás há um brilho na cor do "calor":
// um prato perto brilha laranja e amarelo, um longe brilha menos, e um esgotado fica frio (roxo e apagado).
//
// Propriedades: prato ({ nome, categoria, foto_url, esgotado, distancia_km }), tamanho (px), arredondar.
export function ImagemDoPrato({ prato, tamanho = 64, arredondar = true }) {
  const esgotado = !!prato.esgotado;
  const calor = calorDoPrato({ distanciaKm: prato.distancia_km ?? 0.3, esgotado });
  const cor = corDoCalor(calor * 0.85);
  const raio = arredondar ? Math.round(tamanho * 0.24) : raios.m;

  if (prato.foto_url) {
    return (
      <Image
        testID="foto-do-prato"
        source={{ uri: prato.foto_url }}
        style={[{ width: tamanho, height: tamanho, borderRadius: raio }, estilos.foto, esgotado && estilos.apagado]}
        accessibilityIgnoresInvertColors
      />
    );
  }

  const idDoBrilho = `brilho-${Math.round(calor * 100)}`;
  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <Svg width={tamanho} height={tamanho} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id={idDoBrilho} cx="50%" cy="62%" r="55%">
            <Stop offset="0" stopColor={cor} stopOpacity={esgotado ? 0.18 : 0.38} />
            <Stop offset="1" stopColor={cor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={tamanho} height={tamanho} rx={raio} fill={`url(#${idDoBrilho})`} />
      </Svg>
      <Image
        testID="imagem-3d-do-prato"
        source={imagemDoPrato({ nome: prato.nome, categoria: prato.categoria })}
        style={[{ width: tamanho * 1.08, height: tamanho * 1.08, margin: -tamanho * 0.04 }, esgotado && estilos.apagado]}
        resizeMode="contain"
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  foto: { backgroundColor: cores.acentoSuave },
  apagado: { opacity: 0.4 },
});
