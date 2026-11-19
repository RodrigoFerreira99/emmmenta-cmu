import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Botao } from '@/components/ui';
import { vibrarSucesso } from '@/lib/vibrar';
import { anguloDaSeta, CHEGOU_A_METROS, descreverDirecao, descreverDistancia, distanciaEmMetros, rumoEmGraus } from '@/services/caminho';
import { estadoDaPermissao, pedirPermissao, seguirDirecao, seguirPosicao } from '@/services/localizacao';
import { cores, espaco, raio, texto } from '@/theme';

// Bússola até ao restaurante: uma seta grande que aponta sempre para o restaurante, enquanto o cliente anda,
// com a distância a diminuir. Quando chega (a menos de 25 m), o telemóvel vibra e diz "Chegaste!".
//
// Como funciona: o telemóvel sabe onde está (GPS) e para onde está virado (a bússola dele). Com a posição
// calcula-se o rumo do restaurante (rumoEmGraus: 0 = norte); a seta roda esse rumo menos a direção do
// telemóvel (anguloDaSeta). Não usa internet nem nenhum serviço: só os sensores do telemóvel.
// A localização só é lida com a bússola aberta e fica só em memória (RNF04).
//
// Propriedades:
//   restaurante  { nome, latitude, longitude }
//   visivel      true para mostrar a bússola (ecrã inteiro)
//   aoFechar     função chamada no botão "Fechar" (ou no "voltar" do Android)
export function Bussola({ restaurante, visivel, aoFechar }) {
  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar}>
      {/* o conteúdo só existe com a bússola aberta: ao fechar, os sensores param de ser lidos.
          O Modal é uma janela à parte: precisa do seu SafeAreaProvider (como a CameraNaApp). */}
      {visivel ? (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <ConteudoDaBussola restaurante={restaurante} aoFechar={aoFechar} />
        </SafeAreaProvider>
      ) : null}
    </Modal>
  );
}

function ConteudoDaBussola({ restaurante, aoFechar }) {
  // 'aVerificar' | 'porPedir' | 'negada' | 'pronta'
  const [estado, setEstado] = useState('aVerificar');
  const [posicao, setPosicao] = useState(null); // { latitude, longitude }
  const [direcao, setDirecao] = useState(null); // { graus, precisao }
  const [erro, setErro] = useState(null);
  const jaVibrou = useRef(false);

  // 1) Permissão de localização: se já foi dada, começa logo; senão explica antes de pedir (RNF04).
  useEffect(() => {
    let ativo = true;
    estadoDaPermissao().then((permissao) => {
      if (ativo) setEstado(permissao === 'concedida' ? 'pronta' : permissao);
    });
    return () => {
      ativo = false;
    };
  }, []);

  async function usarLocalizacao() {
    setEstado((await pedirPermissao()) ? 'pronta' : 'negada');
  }

  // 2) Com a permissão: seguir a posição e a direção do telemóvel, até a bússola fechar.
  useEffect(() => {
    if (estado !== 'pronta') return;
    let ativo = true;
    const paragens = [];
    const guardar = (parar) => (ativo ? paragens.push(parar) : parar());
    seguirPosicao(setPosicao)
      .then(guardar)
      .catch(() => ativo && setErro('Não foi possível saber onde estás. Confirma que a localização está ligada.'));
    seguirDirecao(setDirecao)
      .then(guardar)
      .catch(() => ativo && setErro('Este telemóvel não tem bússola. Usa "Ver o caminho a pé".'));
    return () => {
      ativo = false;
      paragens.forEach((parar) => parar());
    };
  }, [estado]);

  const destino = { latitude: restaurante.latitude, longitude: restaurante.longitude };
  const distancia = posicao ? distanciaEmMetros(posicao, destino) : null;
  const chegou = distancia !== null && distancia <= CHEGOU_A_METROS;
  const angulo = posicao && direcao ? anguloDaSeta(rumoEmGraus(posicao, destino), direcao.graus) : null;

  // 3) Ao chegar, o telemóvel vibra uma vez.
  useEffect(() => {
    if (chegou && !jaVibrou.current) {
      jaVibrou.current = true;
      vibrarSucesso();
    }
  }, [chegou]);

  function centro() {
    if (estado === 'aVerificar') return <ActivityIndicator color={cores.acento} />;
    if (estado === 'porPedir') {
      return (
        <View style={estilos.explicacao}>
          <Text style={[texto.corpo, estilos.textoCentro]}>
            A bússola precisa de saber onde estás para apontar para o restaurante. A localização só é usada enquanto a bússola está
            aberta e não é guardada.
          </Text>
          <Botao icone="locate-outline" titulo="Usar a minha localização" onPress={usarLocalizacao} />
        </View>
      );
    }
    if (estado === 'negada') {
      return (
        <Text style={[texto.corpo, estilos.textoCentro]} accessibilityRole="alert">
          A permissão de localização está desligada. Podes ligá-la nas definições do telemóvel.
        </Text>
      );
    }
    if (erro) {
      return (
        <Text style={[texto.corpo, estilos.textoCentro]} accessibilityRole="alert">
          {erro}
        </Text>
      );
    }
    if (chegou) {
      return (
        <View style={estilos.explicacao} accessible accessibilityLabel={`Chegaste a ${restaurante.nome}. Bom almoço!`}>
          <Ionicons name="checkmark-circle" size={120} color={cores.sucesso} />
          <Text style={estilos.distancia}>Chegaste!</Text>
          <Text style={[texto.corpo, estilos.textoCentro]}>Bom almoço.</Text>
        </View>
      );
    }
    if (angulo === null) {
      return (
        <View style={estilos.explicacao}>
          <ActivityIndicator color={cores.acento} />
          <Text style={texto.pequeno}>A ler a bússola…</Text>
        </View>
      );
    }
    const frase = descreverDirecao(angulo);
    return (
      <View style={estilos.explicacao}>
        <View style={estilos.circulo} accessible accessibilityLabel={`O restaurante está ${frase}, a ${descreverDistancia(distancia)}`}>
          <Ionicons name="arrow-up" size={150} color={cores.acento} style={{ transform: [{ rotate: `${Math.round(angulo)}deg` }] }} />
        </View>
        <Text style={estilos.distancia} accessibilityLiveRegion="polite">
          Faltam {descreverDistancia(distancia)}
        </Text>
        <Text style={[texto.corpo, estilos.textoCentro]}>O restaurante está {frase}.</Text>
        {direcao.precisao <= 1 ? (
          <Text style={[texto.pequeno, estilos.textoCentro]}>A bússola está pouco certa: mexe o telemóvel no ar, em forma de 8.</Text>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={estilos.ecra} edges={['top', 'bottom']}>
      <View style={estilos.cabecalho}>
        <View style={estilos.ocuparTudo}>
          <Text style={texto.pequeno}>A caminho de</Text>
          <Text style={texto.titulo} numberOfLines={1}>
            {restaurante.nome}
          </Text>
        </View>
        <Pressable onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar a bússola" style={estilos.fechar}>
          <Ionicons name="close" size={28} color={cores.texto} />
        </Pressable>
      </View>

      <View style={estilos.centro}>{centro()}</View>

      <Text style={[texto.pequeno, estilos.textoCentro]}>Segura o telemóvel deitado, com o ecrã virado para cima.</Text>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  ecra: { flex: 1, padding: espaco.xl, gap: espaco.l, backgroundColor: cores.fundo },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  ocuparTudo: { flex: 1 },
  // 48 x 48: área de toque confortável (RNF06)
  fechar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: raio.pilula, backgroundColor: cores.superficie },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  explicacao: { alignItems: 'center', gap: espaco.l },
  circulo: {
    width: 240,
    height: 240,
    borderRadius: raio.pilula,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  distancia: { fontSize: 32, fontWeight: '700', color: cores.texto },
  textoCentro: { textAlign: 'center' },
});
