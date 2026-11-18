import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CameraNaApp } from '@/components/CameraNaApp';
import { escolherDaGaleria, pedirAcessoACamara } from '@/lib/fotografias';
import { cores, espaco, raio, texto } from '@/theme';

// RF02 — fotografia do restaurante: pré-visualização e botões para tirar, escolher ou remover.
// Também é usado no Publicar, para a fotografia de cada prato (com outro título, ícone e dica).
//
// Propriedades:
//   uri         imagem a mostrar: o link público (foto já guardada) ou o ficheiro local
//               (foto acabada de escolher). null = não há fotografia.
//   aoEscolher  função chamada com o caminho local da imagem tirada ou escolhida
//   aoRemover   função chamada quando se carrega em "Remover"
//   aEnviar     true enquanto a fotografia está a ser enviada (mostra o indicador e esconde os botões)
//   titulo, rotulo, icone, dica   textos e ícone (por omissão, os da fotografia do restaurante)
//   doQue       acrescento aos rótulos dos botões, por exemplo " do prato" → "Tirar fotografia do prato"
//               (assim o leitor de ecrã distingue estes botões dos da leitura do menu por fotografia)
//
// Este componente só obtém a imagem. Comprimir e enviar é trabalho do serviço
// (enviarFotoRestaurante ou enviarFotoDoPrato), chamado pelo ecrã.

const TAMANHO = 72; // lado do quadrado da pré-visualização, como no mock-up

// Opções da galeria.
const OPCOES_DA_GALERIA = {
  allowsEditing: true, // deixa recortar a imagem antes de a aceitar
  aspect: [4, 3], // proporção do recorte (só no Android; no iPhone o recorte é sempre quadrado)
};

export function SeletorFoto({
  uri,
  aoEscolher,
  aoRemover,
  aEnviar = false,
  titulo = 'Fotografia (opcional)',
  rotulo = 'Fotografia do restaurante',
  icone = 'storefront-outline',
  dica = 'Fotografa a fachada ou a sala do restaurante',
  doQue = '',
}) {
  const [cameraAberta, setCameraAberta] = useState(false);

  // "Tirar": pede a permissão e abre a câmara dentro da app (ver CameraNaApp: porque não a app da câmara do telemóvel).
  async function tirar() {
    try {
      await pedirAcessoACamara();
      setCameraAberta(true);
    } catch (erro) {
      Alert.alert('Fotografia', erro.message);
    }
  }

  async function daGaleria() {
    try {
      const caminho = await escolherDaGaleria(OPCOES_DA_GALERIA);
      if (caminho) aoEscolher(caminho); // null = a pessoa desistiu
    } catch (erro) {
      Alert.alert('Fotografia', erro.message);
    }
  }

  return (
    <View style={estilos.linha}>
      <View style={estilos.moldura}>
        {uri ? (
          <Image
            source={{ uri }}
            style={[estilos.imagem, aEnviar && estilos.imagemAEnviar]}
            accessibilityLabel={rotulo}
          />
        ) : (
          <Ionicons name={icone} size={30} color={cores.acento} />
        )}
        {aEnviar && <ActivityIndicator style={StyleSheet.absoluteFill} color={cores.acento} />}
      </View>

      <View style={estilos.textos}>
        <Text style={estilos.titulo}>{titulo}</Text>
        {aEnviar ? (
          <View style={estilos.botao}>
            <Text style={texto.pequeno}>A enviar fotografia…</Text>
          </View>
        ) : (
          <View style={estilos.botoes}>
            <BotaoDeTexto icone="camera-outline" titulo="Tirar" rotulo={`Tirar fotografia${doQue}`} onPress={tirar} />
            <BotaoDeTexto icone="images-outline" titulo="Galeria" rotulo={`Escolher fotografia${doQue} da galeria`} onPress={daGaleria} />
            {uri && aoRemover ? (
              <BotaoDeTexto icone="trash-outline" titulo="Remover" rotulo={`Remover fotografia${doQue}`} cor={cores.textoSecundario} onPress={aoRemover} />
            ) : null}
          </View>
        )}
      </View>

      {cameraAberta ? (
        <CameraNaApp
          dica={dica}
          aoTirar={(caminho) => {
            setCameraAberta(false);
            aoEscolher(caminho);
          }}
          aoFechar={() => setCameraAberta(false)}
        />
      ) : null}
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
