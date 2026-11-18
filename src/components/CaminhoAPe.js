import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Botao } from '@/components/ui';
import {
  calcularCaminhoAPe,
  descreverCaminho,
  LIGACAO_CORRIGIR_O_MAPA,
  LONGE_PARA_IR_A_PE_MIN,
  regiaoParaOsPontos,
} from '@/services/caminho';
import { estadoDaPermissao, lerLocalizacao, pedirPermissao } from '@/services/localizacao';
import { cores, espaco, raio, texto } from '@/theme';

// "Caminho a pé" na página do restaurante: mostra no mapa o percurso pelas ruas desde onde o cliente está
// até ao restaurante, com o tempo e a distância ("12 min a pé · 870 m").
//
// Passos: 1) ver se há permissão de localização (se não houver, explica porque se pede — RNF04);
// 2) ler a localização (só em memória); 3) pedir o caminho ao serviço do OpenStreetMap (calcularCaminhoAPe).
// Se o serviço falhar, aparece uma linha reta com uma estimativa (RNF08). Para ser guiado passo a passo,
// o botão de baixo abre a app de mapas (como o botão "Direções").
//
// Propriedades:
//   restaurante      { nome, latitude, longitude }
//   aoAbrirDirecoes  função que abre a app de mapas com o percurso
export function CaminhoAPe({ restaurante, aoAbrirDirecoes }) {
  // 'aVerificar' | 'porPedir' | 'negada' | 'aCalcular' | 'pronto' | 'semLocalizacao'
  const [estado, setEstado] = useState('aVerificar');
  const [caminho, setCaminho] = useState(null);
  const { nome, latitude, longitude } = restaurante;

  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Lê a localização e pede o caminho. calcularCaminhoAPe nunca falha (no pior caso dá a linha reta);
  // o que pode falhar é saber onde o cliente está.
  const calcular = useCallback(async () => {
    setEstado('aCalcular');
    try {
      const origem = await lerLocalizacao();
      const novo = await calcularCaminhoAPe(origem, { latitude, longitude });
      if (!montado.current) return;
      setCaminho(novo);
      setEstado('pronto');
    } catch {
      if (montado.current) setEstado('semLocalizacao');
    }
  }, [latitude, longitude]);

  // Ao abrir: com a permissão já dada calcula logo; senão espera que o cliente decida.
  useEffect(() => {
    let ativo = true;
    estadoDaPermissao().then((permissao) => {
      if (!ativo) return;
      if (permissao === 'concedida') calcular();
      else setEstado(permissao); // 'porPedir' ou 'negada'
    });
    return () => {
      ativo = false;
    };
  }, [calcular]);

  async function usarLocalizacao() {
    const aceite = await pedirPermissao();
    if (!montado.current) return;
    if (aceite) calcular();
    else setEstado('negada');
  }

  async function corrigirOMapa() {
    try {
      await Linking.openURL(LIGACAO_CORRIGIR_O_MAPA);
    } catch (erro) {
      console.warn('Erro técnico (abrir o OpenStreetMap):', erro?.message ?? erro);
    }
  }

  if (estado === 'aVerificar' || estado === 'aCalcular') {
    return (
      <View style={[estilos.cartao, estilos.linha]}>
        <ActivityIndicator color={cores.acento} />
        <Text style={texto.pequeno}>A calcular o caminho…</Text>
      </View>
    );
  }

  if (estado === 'porPedir') {
    return (
      <View style={estilos.cartao}>
        <Text style={texto.corpo}>
          Para mostrar o caminho, a app precisa de saber onde estás. A localização só é usada para isto, com a app aberta, e não é
          guardada.
        </Text>
        <Botao icone="locate-outline" titulo="Usar a minha localização" onPress={usarLocalizacao} />
      </View>
    );
  }

  if (estado === 'negada' || estado === 'semLocalizacao') {
    return (
      <View style={estilos.cartao}>
        <Text style={texto.corpo} accessibilityRole="alert">
          {estado === 'negada'
            ? 'A permissão de localização está desligada. Podes ligá-la nas definições do telemóvel, ou usar "Direções" para abrir a app de mapas.'
            : 'Não foi possível saber onde estás. Confirma que a localização do telemóvel está ligada e tenta outra vez.'}
        </Text>
        {estado === 'semLocalizacao' ? (
          <Pressable onPress={calcular} accessibilityRole="button" style={estilos.ligacao}>
            <Text style={estilos.ligacaoTexto}>Tentar outra vez</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // estado === 'pronto'
  const longe = caminho.duracaoMin > LONGE_PARA_IR_A_PE_MIN;
  return (
    <View style={estilos.cartao}>
      <View style={estilos.linha}>
        <Ionicons name="walk-outline" size={22} color={cores.acento} />
        <Text style={estilos.resumo} accessibilityRole="header">
          {descreverCaminho(caminho)}
        </Text>
      </View>
      {caminho.emLinhaReta ? (
        <Text style={texto.pequeno}>Não foi possível calcular o caminho pelas ruas: a linha no mapa é em linha reta.</Text>
      ) : null}
      {longe ? <Text style={texto.pequeno}>É longe para ir a pé. Para ir de carro ou de transportes, usa &quot;Direções&quot;.</Text> : null}

      <View style={estilos.moldura}>
        <MapView
          style={estilos.mapa}
          initialRegion={regiaoParaOsPontos(caminho.pontos)}
          showsUserLocation
          toolbarEnabled={false}
          accessibilityLabel={`Mapa com o caminho a pé até ${nome}`}
        >
          <Polyline
            coordinates={caminho.pontos}
            strokeColor={cores.acento}
            strokeWidth={5}
            // em linha reta a linha é tracejada, para não parecer um caminho verdadeiro
            lineDashPattern={caminho.emLinhaReta ? [8, 8] : undefined}
          />
          <Marker coordinate={{ latitude, longitude }} title={nome} pinColor={cores.acento} />
        </MapView>
      </View>

      {/* atribuição pedida pelas regras do serviço de caminhos do OpenStreetMap */}
      {!caminho.emLinhaReta ? (
        <View style={estilos.linhaDaAtribuicao}>
          <Text style={estilos.atribuicao}>Caminho: © colaboradores do OpenStreetMap ·</Text>
          <Pressable onPress={corrigirOMapa} accessibilityRole="link" style={estilos.ligacao}>
            <Text style={estilos.atribuicaoLigacao}>Corrigir o mapa</Text>
          </Pressable>
        </View>
      ) : null}

      <Botao tipo="secundario" icone="navigate-outline" titulo="Ser guiado pela app de mapas" onPress={aoAbrirDirecoes} />
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: espaco.m,
    padding: espaco.l,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
  resumo: { ...texto.subtitulo, flex: 1 },
  moldura: { height: 260, borderRadius: raio.l, overflow: 'hidden', backgroundColor: cores.acentoSuave },
  mapa: { flex: 1 },
  linhaDaAtribuicao: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco.xs },
  atribuicao: { fontSize: 12, color: cores.textoSecundario },
  atribuicaoLigacao: { fontSize: 12, color: cores.acento, fontWeight: '600', textDecorationLine: 'underline' },
  // minHeight 44: área de toque mínima (RNF06)
  ligacao: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 },
  ligacaoTexto: { ...texto.pequeno, color: cores.acento, fontWeight: '600' },
});
