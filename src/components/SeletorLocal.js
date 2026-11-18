import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Botao } from '@/components/ui';
import {
  faltaPermissaoParaProcurarMorada,
  pedirPermissaoDeLocalizacao,
  procurarMoradaNoMapa,
} from '@/services/restaurantes';
import { cores, espaco, raio, texto } from '@/theme';

// RF02 — escolher no mapa o ponto exato do restaurante.
//
// Propriedades:
//   ponto         { latitude, longitude } ou null (ainda não marcado)
//   aoMudarPonto  função chamada com o novo { latitude, longitude }
//   morada        texto do campo Morada (para o botão "Encontrar a morada no mapa")
//   erro          mensagem de validação a mostrar (ou undefined)
//
// Privacidade (RNF04): este componente nunca lê a localização do telemóvel.
// Só se guarda o ponto escolhido para o restaurante, que é um dado do negócio.

// Centro do Porto: onde o mapa abre quando o restaurante ainda não tem ponto marcado.
const PORTO = { latitude: 41.1496, longitude: -8.611 };
// "Delta" = quantos graus o mapa mostra. Quanto mais pequeno, mais aproximado.
const ZOOM_CIDADE = { latitudeDelta: 0.05, longitudeDelta: 0.05 };
const ZOOM_RUA = { latitudeDelta: 0.005, longitudeDelta: 0.005 };
const ALTURA_DO_MAPA = 200;

export function SeletorLocal({ ponto, aoMudarPonto, morada, erro }) {
  const mapa = useRef(null);
  const [aProcurar, setAProcurar] = useState(false);
  const [aviso, setAviso] = useState(null);

  // Onde o mapa abre. É calculado uma só vez: depois disso quem manda no mapa é o utilizador.
  const [regiaoInicial] = useState(() => (ponto ? { ...ponto, ...ZOOM_RUA } : { ...PORTO, ...ZOOM_CIDADE }));

  // Fica a false quando o componente sai do ecrã, para não mexer no estado depois de um "await".
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Tocar no mapa ou largar o pin depois de o arrastar: os dois dão a nova coordenada.
  function moverPin(evento) {
    const coordenada = evento.nativeEvent.coordinate;
    if (!coordenada) return;
    setAviso(null);
    aoMudarPonto({ latitude: coordenada.latitude, longitude: coordenada.longitude });
  }

  async function encontrarMorada() {
    if (aProcurar) return;
    Keyboard.dismiss();
    setAviso(null);
    setAProcurar(true);
    try {
      // No Android esta procura exige a permissão de localização.
      // Só a pedimos aqui, quando o utilizador carrega no botão, e explicamos primeiro porquê (RNF04).
      if (await faltaPermissaoParaProcurarMorada()) {
        const aceitou = (await explicarPermissao()) && (await pedirPermissaoDeLocalizacao());
        if (!aceitou) {
          // RNF08: sem permissão a app continua a funcionar — o pin põe-se à mão
          if (montado.current) setAviso('Sem a permissão não é possível procurar a morada. Toca no mapa para pôr o pin à mão.');
          return;
        }
      }

      const encontrado = await procurarMoradaNoMapa(morada);
      if (!montado.current) return;
      if (!encontrado) {
        setAviso('Não encontrámos essa morada. Toca no mapa para pôr o pin à mão.');
        return;
      }
      aoMudarPonto(encontrado);
      mapa.current?.animateToRegion({ ...encontrado, ...ZOOM_RUA }, 500);
      setAviso('Morada encontrada. Confirma se o pin está no sítio certo e ajusta-o se for preciso.');
    } catch (erroAoProcurar) {
      if (montado.current) setAviso(erroAoProcurar.message);
    } finally {
      if (montado.current) setAProcurar(false);
    }
  }

  return (
    <View style={estilos.grupo}>
      <Text style={texto.etiqueta}>Localização no mapa</Text>

      {/* A moldura dá os cantos redondos ao mapa (o mapa nativo não aceita borderRadius). */}
      <View style={[estilos.moldura, erro ? estilos.molduraComErro : null]}>
        <MapView
          ref={mapa}
          style={estilos.mapa}
          initialRegion={regiaoInicial}
          onPress={moverPin}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          accessibilityLabel="Mapa para marcar o local do restaurante"
        >
          {ponto ? <Marker coordinate={ponto} draggable onDragEnd={moverPin} pinColor={cores.acento} /> : null}
        </MapView>
      </View>

      <Text style={texto.pequeno}>Toca no mapa para pôr o pin. Para o arrastar, mantém-no premido primeiro.</Text>
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}

      <Botao
        tipo="secundario"
        icone="search-outline"
        titulo="Encontrar a morada no mapa"
        onPress={encontrarMorada}
        aCarregar={aProcurar}
      />
      {aviso ? <Text style={texto.pequeno}>{aviso}</Text> : null}
    </View>
  );
}

// Explica porque é precisa a permissão ANTES de aparecer o pedido do sistema (RNF04).
// Devolve uma Promise com true ("Continuar") ou false ("Agora não" ou fechar o aviso).
function explicarPermissao() {
  return new Promise((resolver) => {
    Alert.alert(
      'Permissão de localização',
      'Para encontrar a morada no mapa, o Android exige a permissão de localização. ' +
        'A Emmmenta não guarda a tua localização: só fica guardado o ponto que escolheres para o restaurante.',
      [
        { text: 'Agora não', style: 'cancel', onPress: () => resolver(false) },
        { text: 'Continuar', onPress: () => resolver(true) },
      ],
      { cancelable: true, onDismiss: () => resolver(false) }
    );
  });
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco.s },
  moldura: {
    height: ALTURA_DO_MAPA,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.linha,
    overflow: 'hidden',
  },
  molduraComErro: { borderColor: cores.erro },
  mapa: { flex: 1 },
  erro: { ...texto.pequeno, color: cores.erro },
});
