import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { cores, espaco, raio, texto } from '@/theme';

// RF02 — fotografia do restaurante: pré-visualização e botão para escolher uma imagem da galeria.
//
// Propriedades:
//   uri         imagem a mostrar: o link público (foto já guardada) ou o ficheiro local
//               (foto acabada de escolher). null = ainda não há fotografia.
//   aoEscolher  função chamada com o caminho local da imagem escolhida
//   aEnviar     true enquanto a fotografia está a ser enviada (mostra o indicador e esconde o botão)
//
// Este componente só escolhe a imagem. Comprimir e enviar é trabalho do serviço
// (enviarFotoRestaurante), chamado pelo ecrã quando se carrega em Guardar.

const TAMANHO = 72; // lado do quadrado da pré-visualização, como no mock-up

export function SeletorFoto({ uri, aoEscolher, aEnviar = false }) {
  async function escolher() {
    try {
      // Não é preciso pedir permissão: o seletor de fotografias é do próprio sistema
      // e a app só recebe a imagem que a pessoa escolher.
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true, // deixa recortar a imagem antes de a aceitar
        aspect: [4, 3], // proporção do recorte (só no Android; no iPhone o recorte é sempre quadrado)
        quality: 1, // sem compressão aqui: a compressão é feita uma só vez, no serviço
      });
      if (resultado.canceled) return;
      aoEscolher(resultado.assets[0].uri);
    } catch (erro) {
      console.warn('Erro técnico (escolher fotografia):', erro?.message ?? erro);
      Alert.alert('Fotografia', 'Não foi possível abrir as fotografias do telemóvel. Tenta outra vez.');
    }
  }

  const rotulo = uri ? 'Alterar fotografia' : 'Escolher fotografia';

  return (
    <View style={estilos.linha}>
      <View style={estilos.moldura}>
        {uri ? (
          <Image
            source={{ uri }}
            style={[estilos.imagem, aEnviar && estilos.imagemAEnviar]}
            accessibilityLabel="Fotografia do restaurante"
          />
        ) : (
          <Ionicons name="storefront-outline" size={30} color={cores.acento} />
        )}
        {aEnviar && <ActivityIndicator style={StyleSheet.absoluteFill} color={cores.acento} />}
      </View>

      <View style={estilos.textos}>
        <Text style={estilos.titulo}>Fotografia (opcional)</Text>
        {aEnviar ? (
          <View style={estilos.botao}>
            <Text style={texto.pequeno}>A enviar fotografia…</Text>
          </View>
        ) : (
          <Pressable onPress={escolher} accessibilityRole="button" accessibilityLabel={rotulo} style={estilos.botao}>
            <Ionicons name="camera-outline" size={16} color={cores.acento} />
            <Text style={estilos.botaoTexto}>{rotulo}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.l },
  moldura: {
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: raio.xl,
    backgroundColor: cores.acentoSuave,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagem: { width: TAMANHO, height: TAMANHO },
  imagemAEnviar: { opacity: 0.4 },
  textos: { flex: 1 },
  titulo: { ...texto.corpo, fontWeight: '600' },
  // minHeight 44: área de toque mínima recomendada (RNF06)
  botao: { flexDirection: 'row', alignItems: 'center', gap: espaco.s, minHeight: 44, alignSelf: 'flex-start' },
  botaoTexto: { ...texto.corpo, fontWeight: '600', color: cores.acento },
});
