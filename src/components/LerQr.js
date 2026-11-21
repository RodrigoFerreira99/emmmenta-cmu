import { CameraView } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Icone } from '@/components/Icone';
import { pedirAcessoACamara } from '@/lib/fotografias';
import { lerQrDoRestaurante } from '@/lib/qr';
import { vibrarSucesso } from '@/lib/vibrar';
import { cores, espaco, raio, texto } from '@/theme';

// Início → ícone do QR: lê com a câmara o QR code que um restaurante tem na porta (ver QrDoRestaurante)
// e abre a página desse restaurante. A câmara é a da própria app (expo-camera), como na CameraNaApp.
//
// Propriedades:
//   visivel   true para abrir o leitor
//   aoFechar  função chamada ao fechar
//   aoLer     função chamada com o id do restaurante quando se lê um QR válido
export function LerQr({ visivel, aoFechar, aoLer }) {
  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar}>
      {visivel ? (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <Leitor aoFechar={aoFechar} aoLer={aoLer} />
        </SafeAreaProvider>
      ) : null}
    </Modal>
  );
}

function Leitor({ aoFechar, aoLer }) {
  const [estado, setEstado] = useState('aVerificar'); // 'aVerificar' | 'pronto' | 'semPermissao'
  const [aviso, setAviso] = useState(null);
  const [lido, setLido] = useState(false); // depois de ler um QR válido, a câmara deixa de procurar

  useEffect(() => {
    let ativo = true;
    pedirAcessoACamara()
      .then(() => ativo && setEstado('pronto'))
      .catch(() => ativo && setEstado('semPermissao'));
    return () => {
      ativo = false;
    };
  }, []);

  function aoDetetar({ data }) {
    const id = lerQrDoRestaurante(data);
    if (!id) {
      setAviso('Este QR code não é de um restaurante da Emmmenta.');
      return;
    }
    setLido(true);
    vibrarSucesso();
    aoLer(id);
  }

  return (
    <View style={estilos.fundo}>
      {estado === 'pronto' ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          // sem função, a câmara não volta a avisar: assim um QR só é lido uma vez
          onBarcodeScanned={lido ? undefined : aoDetetar}
        />
      ) : null}

      <SafeAreaView style={estilos.camada} edges={['top', 'bottom']}>
        <View style={estilos.topo}>
          <Text style={estilos.titulo}>Ler o QR do restaurante</Text>
          <Pressable onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar o leitor de QR" style={estilos.fechar}>
            <Icone name="close" size={28} color={cores.textoSobreImagem} />
          </Pressable>
        </View>

        {estado === 'semPermissao' ? (
          <Text style={estilos.mensagem} accessibilityRole="alert">
            Sem acesso à câmara não é possível ler o QR code. Podes dar a permissão nas definições do telemóvel.
          </Text>
        ) : (
          <View style={estilos.moldura} accessible accessibilityLabel="Aponta a câmara para o QR code do restaurante" />
        )}

        <Text style={estilos.mensagem} accessibilityRole={aviso ? 'alert' : undefined}>
          {aviso ?? 'Aponta para o QR code que está na porta ou na mesa do restaurante.'}
        </Text>
      </SafeAreaView>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  camada: { flex: 1, justifyContent: 'space-between', alignItems: 'center', padding: espaco.xl },
  topo: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  titulo: { ...texto.subtitulo, color: cores.textoSobreImagem, flex: 1 },
  // 48 x 48: área de toque confortável (RNF06)
  fechar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  moldura: { width: 240, height: 240, borderRadius: raio.xl, borderWidth: 3, borderColor: cores.textoSobreImagem },
  mensagem: { ...texto.corpo, color: cores.textoSobreImagem, textAlign: 'center' },
});
