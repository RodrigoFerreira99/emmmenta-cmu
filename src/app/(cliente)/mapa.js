import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { BotaoDoLocal, EscolherLocal } from '@/components/EscolherLocal';
import { EtiquetaDoMapa } from '@/components/EtiquetaDoMapa';
import { FiltrosDePratos } from '@/components/FiltrosDePratos';
import { EtiquetaDeLotacao } from '@/components/Lotacao';
import { Botao, Carregar, Ecra } from '@/components/ui';
import { usePerto } from '@/context/PertoContext';
import { agruparPorRestaurante, formatarDistancia, formatarPreco } from '@/services/pratos';
import { cores, espaco, raio, texto } from '@/theme';

// Ecrã 3 · Mapa (RF06, RF07) — responsável: André
//
// Mostra no mapa os restaurantes que têm menu hoje, perto do cliente. Usa os mesmos pratos e os mesmos
// filtros da lista do Início (vêm do PertoContext), só que juntos por restaurante: um marcador por
// restaurante, com o preço do prato mais barato (EtiquetaDoMapa). Tocar num marcador mostra um cartão
// em baixo, com o botão "Ver menu de hoje".
// O mapa é o react-native-maps, que funciona no Expo Go sem configuração.

// A parte do mapa que fica à vista, para caber o círculo do raio de pesquisa com alguma folga.
// Um grau de latitude são cerca de 111 km; um grau de longitude encolhe com a latitude (cosseno).
function regiaoDoMapa(local, raioKm) {
  const latitudeDelta = (raioKm * 2.6) / 111;
  const longitudeDelta = latitudeDelta / Math.cos((local.latitude * Math.PI) / 180);
  return { latitude: local.latitude, longitude: local.longitude, latitudeDelta, longitudeDelta };
}

export default function Mapa() {
  const { local, estadoDoLocal, pratos, aCarregar, erro, recarregar, filtros } = usePerto();
  const [aMudarLocal, setAMudarLocal] = useState(false);
  const [escolhidoId, setEscolhidoId] = useState(null); // o restaurante do marcador em que se tocou
  const mapa = useRef(null);

  // um marcador por restaurante (só se volta a calcular quando a lista de pratos muda)
  const restaurantes = useMemo(() => agruparPorRestaurante(pratos), [pratos]);
  // se o restaurante escolhido deixar de aparecer (por causa de um filtro), o cartão fecha-se sozinho
  const escolhido = restaurantes.find((restaurante) => restaurante.id === escolhidoId) ?? null;

  // Quando muda o sítio ou o raio, o mapa desliza para mostrar a nova zona de pesquisa.
  const latitude = local?.latitude;
  const longitude = local?.longitude;
  const { raioKm } = filtros;
  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    mapa.current?.animateToRegion(regiaoDoMapa({ latitude, longitude }, raioKm), 400);
  }, [latitude, longitude, raioKm]);

  if (!local) {
    if (estadoDoLocal === 'aVerificar') return <Carregar />;
    return (
      <Ecra>
        <EscolherLocal />
      </Ecra>
    );
  }
  if (aMudarLocal) {
    return (
      <Ecra>
        <EscolherLocal aoEscolher={() => setAMudarLocal(false)} aoCancelar={() => setAMudarLocal(false)} />
      </Ecra>
    );
  }

  function abrirRestaurante(restaurante) {
    router.push({ pathname: '/restaurante/[id]', params: { id: restaurante.id, distancia: String(restaurante.distanciaKm) } });
  }

  return (
    <Ecra>
      <View style={estilos.cabecalho}>
        <BotaoDoLocal onPress={() => setAMudarLocal(true)} />
        <FiltrosDePratos />
      </View>

      <View style={estilos.ocuparTudo}>
        <MapView
          ref={mapa}
          style={estilos.ocuparTudo}
          initialRegion={regiaoDoMapa(local, raioKm)}
          // o ponto azul só aparece quando o cliente deu a localização (RNF04)
          showsUserLocation={local.origem === 'gps'}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          // tocar no mapa (fora dos marcadores) fecha o cartão do restaurante
          onPress={(evento) => {
            if (evento.nativeEvent.action !== 'marker-press') setEscolhidoId(null);
          }}
          accessibilityLabel="Mapa dos restaurantes com menu hoje"
        >
          {/* o círculo mostra até onde se está a procurar */}
          <Circle
            center={{ latitude: local.latitude, longitude: local.longitude }}
            radius={raioKm * 1000}
            strokeColor={cores.acento}
            strokeWidth={1.5}
            // o laranja do tema, quase transparente ("14" são 8% de opacidade)
            fillColor={`${cores.acento}14`}
          />
          {restaurantes.map((restaurante) => (
            <Marker
              key={restaurante.id}
              coordinate={{ latitude: restaurante.latitude, longitude: restaurante.longitude }}
              // a ponta do "bico" da etiqueta fica em cima do restaurante
              anchor={{ x: 0.5, y: 1 }}
              accessibilityLabel={`${restaurante.nome}: ${resumoDoRestaurante(restaurante)}`}
              onPress={() => setEscolhidoId(restaurante.id)}
            >
              <EtiquetaDoMapa restaurante={restaurante} escolhido={restaurante.id === escolhidoId} />
            </Marker>
          ))}
        </MapView>

        {/* Avisos por cima do mapa: a carregar, erro, ou nenhum restaurante nesta zona (RNF08). */}
        {aCarregar ? (
          <View style={estilos.aviso}>
            <ActivityIndicator color={cores.acento} />
            <Text style={texto.pequeno}>A procurar restaurantes…</Text>
          </View>
        ) : erro ? (
          <View style={[estilos.aviso, estilos.avisoEmColuna]}>
            <Text style={[texto.pequeno, estilos.textoDeErro]} accessibilityRole="alert">
              {erro}
            </Text>
            <Botao tipo="secundario" icone="refresh-outline" titulo="Tentar outra vez" onPress={recarregar} />
          </View>
        ) : restaurantes.length === 0 ? (
          <View style={estilos.aviso}>
            <Text style={texto.pequeno}>
              {filtros.soFavoritos
                ? `Nenhum dos teus restaurantes favoritos tem menu hoje a menos de ${raioKm} km.`
                : `Não há restaurantes com menu hoje a menos de ${raioKm} km. Experimenta aumentar a distância nos filtros.`}
            </Text>
          </View>
        ) : null}

        {escolhido ? (
          <View style={estilos.cartao}>
            <Text style={texto.subtitulo} numberOfLines={1}>
              {escolhido.nome}
            </Text>
            <Text style={texto.pequeno}>
              {formatarDistancia(escolhido.distanciaKm)} · {resumoDoRestaurante(escolhido)}
            </Text>
            <EtiquetaDeLotacao menu={escolhido} />
            <Text style={texto.pequeno} numberOfLines={2}>
              {escolhido.pratos.map((prato) => prato.prato).join(' · ')}
            </Text>
            <Botao titulo="Ver menu de hoje" icone="restaurant-outline" onPress={() => abrirRestaurante(escolhido)} />
          </View>
        ) : null}
      </View>
    </Ecra>
  );
}

// "3 pratos · desde 6,50 €", ou "Tudo esgotado" quando já não há nada disponível.
function resumoDoRestaurante(restaurante) {
  if (restaurante.disponiveis === 0) return 'Tudo esgotado';
  const quantos = restaurante.disponiveis === 1 ? '1 prato' : `${restaurante.disponiveis} pratos`;
  return `${quantos} · desde ${formatarPreco(restaurante.precoMinimo)}`;
}

const estilos = StyleSheet.create({
  ocuparTudo: { flex: 1 },
  cabecalho: { paddingHorizontal: espaco.xl, paddingTop: espaco.s, paddingBottom: espaco.m, gap: espaco.s },
  aviso: {
    position: 'absolute',
    top: espaco.m,
    left: espaco.l,
    right: espaco.l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    padding: espaco.m,
    borderRadius: raio.m,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  avisoEmColuna: { flexDirection: 'column', alignItems: 'stretch' },
  textoDeErro: { color: cores.erro },
  cartao: {
    position: 'absolute',
    left: espaco.l,
    right: espaco.l,
    bottom: espaco.l,
    gap: espaco.s,
    padding: espaco.l,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
});
