import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { cores, espaco, raio, texto } from '@/theme';

// RF02 — fotografia do restaurante: pré-visualização e botões para tirar, escolher ou remover.
//
// Propriedades:
//   uri         imagem a mostrar: o link público (foto já guardada) ou o ficheiro local
//               (foto acabada de escolher). null = não há fotografia.
//   aoEscolher  função chamada com o caminho local da imagem tirada ou escolhida
//   aoRemover   função chamada quando se carrega em "Remover"
//   aEnviar     true enquanto a fotografia está a ser enviada (mostra o indicador e esconde os botões)
//
// Este componente só obtém a imagem. Comprimir e enviar é trabalho do serviço
// (enviarFotoRestaurante), chamado pelo ecrã quando se carrega em Guardar.

const TAMANHO = 72; // lado do quadrado da pré-visualização, como no mock-up

// As mesmas opções para a câmara e para a galeria.
const OPCOES = {
  mediaTypes: 'images',
  allowsEditing: true, // deixa recortar a imagem antes de a aceitar
  aspect: [4, 3], // proporção do recorte (só no Android; no iPhone o recorte é sempre quadrado)
  quality: 1, // sem compressão aqui: a compressão é feita uma só vez, no serviço
};

export function SeletorFoto({ uri, aoEscolher, aoRemover, aEnviar = false }) {
  // origem: 'camara' ou 'galeria'
  async function obterImagem(origem) {
    try {
      let resultado;
      if (origem === 'camara') {
        // A câmara precisa de permissão. Só é pedida aqui, quando a pessoa carrega em "Tirar".
        const { granted } = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted) {
          Alert.alert('Câmara', 'Sem acesso à câmara não é possível tirar a fotografia. Podes escolher uma imagem da galeria.');
          return;
        }
        resultado = await ImagePicker.launchCameraAsync(OPCOES);
      } else {
        // A galeria não precisa de permissão: o seletor é do próprio sistema
        // e a app só recebe a imagem que a pessoa escolher.
        resultado = await ImagePicker.launchImageLibraryAsync(OPCOES);
      }
      if (resultado.canceled) return;
      aoEscolher(resultado.assets[0].uri);
    } catch (erro) {
      console.warn('Erro técnico (obter fotografia):', erro?.message ?? erro);
      Alert.alert('Fotografia', 'Não foi possível obter a fotografia. Tenta outra vez.');
    }
  }

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
          <View style={estilos.botoes}>
            <BotaoDeTexto icone="camera-outline" titulo="Tirar" rotulo="Tirar fotografia" onPress={() => obterImagem('camara')} />
            <BotaoDeTexto icone="images-outline" titulo="Galeria" rotulo="Escolher fotografia da galeria" onPress={() => obterImagem('galeria')} />
            {uri && aoRemover ? (
              <BotaoDeTexto icone="trash-outline" titulo="Remover" rotulo="Remover fotografia" cor={cores.textoSecundario} onPress={aoRemover} />
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

// Botão pequeno só com ícone e texto. "rotulo" é o que o leitor de ecrã diz.
function BotaoDeTexto({ icone, titulo, rotulo, onPress, cor = cores.acento }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={rotulo} style={estilos.botao}>
      <Ionicons name={icone} size={16} color={cor} />
      <Text style={[estilos.botaoTexto, { color: cor }]}>{titulo}</Text>
    </Pressable>
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
  botoes: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco.l },
  // minHeight 44: área de toque mínima recomendada (RNF06)
  botao: { flexDirection: 'row', alignItems: 'center', gap: espaco.xs, minHeight: 44 },
  botaoTexto: { ...texto.corpo, fontWeight: '600' },
});
