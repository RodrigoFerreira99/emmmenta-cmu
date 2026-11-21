import { CameraView } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Icone } from '@/components/Icone';
import { cores, espaco, fontes, raio, texto } from '@/theme';

// Câmara dentro da própria app, em ecrã inteiro.
//
// Porquê: com a app da câmara do telemóvel (expo-image-picker), a Emmmenta fica em segundo plano e,
// no Android, o sistema pode fechá-la para libertar memória. Quando a pessoa volta, a app arranca do zero
// e a fotografia perde-se — foi o que aconteceu no primeiro teste. Com a câmara aqui dentro não há outra
// app aberta, por isso isto deixa de acontecer.
//
// Uso: o ecrã pede primeiro a permissão (pedirAcessoACamara, em src/lib/fotografias.js) e só depois mostra
// este componente:  {aberta ? <CameraNaApp dica="..." aoTirar={...} aoFechar={...} /> : null}
//
// Propriedades:
//   dica      texto curto por cima da imagem, por exemplo "Enquadra o menu todo"
//   aoTirar   função chamada com o caminho local da fotografia tirada
//   aoFechar  função chamada em "Cancelar" ou no botão "voltar" do Android
export function CameraNaApp({ dica, aoTirar, aoFechar }) {
  const camara = useRef(null);
  const [pronta, setPronta] = useState(false); // a câmara só pode tirar fotografias depois de arrancar
  const [aTirar, setATirar] = useState(false);
  const [erro, setErro] = useState(null);

  async function tirar() {
    if (!pronta || aTirar) return;
    setATirar(true);
    setErro(null);
    try {
      // quality 0.7: a fotografia ainda é reduzida antes de ser enviada, não vale a pena gravá-la no máximo
      const foto = await camara.current.takePictureAsync({ quality: 0.7 });
      aoTirar(foto.uri);
    } catch (falha) {
      console.warn('Erro técnico (tirar fotografia):', falha?.message ?? falha);
      setErro('Não foi possível tirar a fotografia. Tenta outra vez.');
    } finally {
      setATirar(false);
    }
  }

  return (
    // onRequestClose: o botão "voltar" do Android fecha a câmara em vez de sair do ecrã
    <Modal visible animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      {/* dentro de um Modal é preciso um SafeAreaProvider próprio para saber onde estão o entalhe e a barra de baixo;
          initialMetrics dá-lhe logo as medidas do ecrã, para não aparecer um instante em branco */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={estilos.fundo}>
          {/* O CameraView não aceita elementos lá dentro: os botões ficam por cima, com posição absoluta. */}
          <CameraView
            ref={camara}
            style={StyleSheet.absoluteFill}
            facing="back"
            onCameraReady={() => setPronta(true)}
            onMountError={({ message }) => {
              console.warn('Erro técnico (abrir câmara):', message);
              setErro('Não foi possível abrir a câmara. Fecha e escolhe uma fotografia da galeria.');
            }}
          />

          <SafeAreaView edges={['top']} style={estilos.topo}>
            <Pressable onPress={aoFechar} accessibilityRole="button" style={estilos.cancelar}>
              <Icone name="close" size={22} color={cores.textoSobreImagem} />
              <Text style={estilos.cancelarTexto}>Cancelar</Text>
            </Pressable>
            {dica ? <Text style={estilos.dica}>{dica}</Text> : null}
          </SafeAreaView>

          <SafeAreaView edges={['bottom']} style={estilos.fundoDoEcra}>
            {erro ? (
              <Text style={estilos.erro} accessibilityRole="alert">
                {erro}
              </Text>
            ) : null}
            <Pressable
              onPress={tirar}
              disabled={!pronta || aTirar}
              accessibilityRole="button"
              accessibilityLabel="Tirar fotografia"
              accessibilityState={{ disabled: !pronta || aTirar, busy: aTirar }}
              style={({ pressed }) => [estilos.disparador, (!pronta || pressed) && estilos.disparadorPremido]}
            >
              {aTirar || !pronta ? <ActivityIndicator color={cores.acento} /> : <View style={estilos.disparadorMiolo} />}
            </Pressable>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const TAMANHO_DO_DISPARADOR = 76; // bem acima dos 44 px de área de toque (RNF06)
// fundo escuro meio transparente por baixo dos textos, para se lerem sobre qualquer imagem ("80" = 50%)
const SOMBRA = `${cores.texto}80`;

const estilos = StyleSheet.create({
  // a cor de texto do tema é quase preta: serve de fundo à câmara
  fundo: { flex: 1, backgroundColor: cores.fundo },
  topo: { position: 'absolute', top: 0, left: 0, right: 0, padding: espaco.l, gap: espaco.m },
  cancelar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: espaco.xs,
    minHeight: 44,
    paddingHorizontal: espaco.m,
    borderRadius: raio.pilula,
    backgroundColor: SOMBRA,
  },
  cancelarTexto: { fontSize: 16, fontFamily: fontes.semi, color: cores.textoSobreImagem },
  dica: {
    ...texto.corpo,
    alignSelf: 'center',
    textAlign: 'center',
    color: cores.textoSobreImagem,
    paddingHorizontal: espaco.m,
    paddingVertical: espaco.s,
    borderRadius: raio.m,
    backgroundColor: SOMBRA,
    overflow: 'hidden',
  },
  fundoDoEcra: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: espaco.m, paddingBottom: espaco.xl },
  erro: {
    ...texto.pequeno,
    color: cores.textoSobreImagem,
    textAlign: 'center',
    marginHorizontal: espaco.xl,
    padding: espaco.s,
    borderRadius: raio.m,
    backgroundColor: cores.erro,
    overflow: 'hidden',
  },
  disparador: {
    width: TAMANHO_DO_DISPARADOR,
    height: TAMANHO_DO_DISPARADOR,
    borderRadius: TAMANHO_DO_DISPARADOR / 2,
    borderWidth: 5,
    borderColor: cores.textoSobreImagem,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disparadorPremido: { opacity: 0.6 },
  disparadorMiolo: {
    width: TAMANHO_DO_DISPARADOR - 18,
    height: TAMANHO_DO_DISPARADOR - 18,
    borderRadius: (TAMANHO_DO_DISPARADOR - 18) / 2,
    backgroundColor: cores.textoSobreImagem,
  },
});
