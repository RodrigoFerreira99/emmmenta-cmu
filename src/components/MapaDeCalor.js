import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Defs, LinearGradient, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import { WebView } from 'react-native-webview';

import { corDoCalor } from '@/lib/cores';
import { htmlDoMapaDeCalor } from '@/lib/htmlDoMapaDeCalor';
import { dadosDoMapa, jsonSeguro } from '@/lib/mapaDeCalor';
import { cores, espaco, fontes, raio } from '@/theme';

// Mapa de calor 3D no Início (design térmico): Vila do Conde (ou onde o cliente estiver) com as ruas e
// os prédios em 3D, e o "calor" de cada restaurante com menu hoje. O mapa corre numa WebView com o
// MapLibre (ver src/lib/htmlDoMapaDeCalor.js); é só para ver: tocar abre o separador Mapa.
// Sem rede, ou se o mapa não carregar, fica um cartão com o calor desenhado e uma mensagem (RNF08).
//
// Propriedades: local ({ latitude, longitude }), pratos (os do PertoContext), popularidade (o ranking dos
// estudantes: Map id → { hoje, semana }; com números, o calor mostra onde vão mais estudantes), onPress.
export function MapaDeCalor({ local, pratos, popularidade, onPress, altura = 220 }) {
  const dados = useMemo(() => dadosDoMapa(pratos, local, popularidade), [pratos, local, popularidade]);
  // a página é feita uma vez; depois, as mudanças vão por window.atualizar (sem recarregar o mapa)
  const [html] = useState(() => htmlDoMapaDeCalor(dados));
  const [estado, setEstado] = useState('aCarregar'); // 'aCarregar' | 'pronto' | 'falhou'
  const webview = useRef(null);

  useEffect(() => {
    if (estado === 'pronto') webview.current?.injectJavaScript(`window.atualizar(${jsonSeguro(dados)}); true;`);
  }, [dados, estado]);

  const quantos = dados.restaurantes.length;
  const legenda = quantos === 1 ? '1 SÍTIO COM MENU HOJE' : `${quantos} SÍTIOS COM MENU HOJE`;

  return (
    <View style={[estilos.cartao, { height: altura }]}>
      {estado !== 'falhou' ? (
        <WebView
          ref={webview}
          source={{ html }}
          originWhitelist={['*']}
          style={estilos.mapa}
          scrollEnabled={false}
          javaScriptEnabled
          onMessage={(evento) => setEstado(evento.nativeEvent.data === 'pronto' ? 'pronto' : 'falhou')}
          onError={() => setEstado('falhou')}
          onHttpError={() => setEstado('falhou')}
        />
      ) : null}

      {/* enquanto o mapa não aparece (ou se falhar): o calor desenhado e uma mensagem */}
      {estado !== 'pronto' ? (
        <View style={[StyleSheet.absoluteFill, estilos.semMapa]}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="calor-sem-mapa" cx="50%" cy="65%" r="60%">
                <Stop offset="0" stopColor={corDoCalor(0.74)} stopOpacity={0.4} />
                <Stop offset="0.5" stopColor={corDoCalor(0.4)} stopOpacity={0.2} />
                <Stop offset="1" stopColor={corDoCalor(0.14)} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#calor-sem-mapa)" />
          </Svg>
          <Text style={estilos.semMapaTexto}>
            {estado === 'falhou' ? 'Sem rede, o mapa não aparece. A lista de pratos continua aqui em baixo.' : 'A desenhar o mapa…'}
          </Text>
        </View>
      ) : null}

      {/* por cima de tudo: um botão invisível (o mapa é só para ver; tocar abre o separador Mapa) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Mapa de calor com ${quantos === 1 ? '1 restaurante' : `${quantos} restaurantes`} com menu hoje. Abrir o mapa`}
      />
      <Text style={estilos.legenda} pointerEvents="none">
        {legenda}
      </Text>
      <View style={estilos.escala} pointerEvents="none">
        {/* com o ranking dos estudantes, o calor mostra onde vão mais estudantes; sem ele, a distância */}
        <Text style={estilos.escalaTexto}>{dados.porPopularidade ? 'MENOS' : 'LONGE'}</Text>
        <Svg width={46} height={6}>
          <Defs>
            <LinearGradient id="escala" x1="0" y1="0" x2="1" y2="0">
              {[0.14, 0.3, 0.46, 0.6, 0.74, 0.87, 1].map((t, i) => (
                <Stop key={t} offset={i / 6} stopColor={corDoCalor(t)} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width={46} height={6} rx={3} fill="url(#escala)" />
        </Svg>
        <Text style={estilos.escalaTexto}>{dados.porPopularidade ? 'MAIS ESTUDANTES' : 'PERTO'}</Text>
      </View>
      <Text style={estilos.creditos} pointerEvents="none">
        © OpenStreetMap · OpenFreeMap
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderRadius: raio.xl, overflow: 'hidden', borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.fundo },
  mapa: { flex: 1, backgroundColor: cores.fundo },
  semMapa: { alignItems: 'center', justifyContent: 'flex-end', padding: espaco.l },
  semMapaTexto: { fontFamily: fontes.normal, fontSize: 13, color: cores.textoSecundario, textAlign: 'center' },
  legenda: { position: 'absolute', left: espaco.m, top: espaco.m, fontFamily: fontes.mono, fontSize: 10, letterSpacing: 0.6, color: cores.texto },
  escala: { position: 'absolute', right: espaco.m, top: espaco.m - 1, flexDirection: 'row', alignItems: 'center', gap: espaco.xs + 2 },
  escalaTexto: { fontFamily: fontes.mono, fontSize: 9, color: cores.texto },
  creditos: { position: 'absolute', right: espaco.s + 2, bottom: espaco.s, fontFamily: fontes.mono, fontSize: 8, color: cores.textoSecundario },
});
