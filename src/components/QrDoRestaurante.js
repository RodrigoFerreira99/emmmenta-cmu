import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { Botao } from '@/components/ui';
import { enderecoDoRestaurante, htmlDoCartaz, imprimirCartaz, partilharCartazEmPdf, svgDoQr } from '@/lib/qr';
import { cores, espaco, raio, texto } from '@/theme';

// Painel do restaurante → "QR code e cartaz para a porta": mostra o QR do restaurante e deixa imprimir
// (ou guardar em PDF) um cartaz com o nome, o menu de hoje e o QR. Os clientes leem o QR com a Emmmenta
// e vão logo para a página do restaurante (ver LerQr e src/lib/qr.js).
//
// Propriedades:
//   restaurante  { id, nome }
//   menu         o menu de hoje (ou null): entra no cartaz
//   visivel      true para mostrar
//   aoFechar     função chamada ao fechar
export function QrDoRestaurante({ restaurante, menu, visivel, aoFechar }) {
  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar}>
      {visivel ? (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <Conteudo restaurante={restaurante} menu={menu} aoFechar={aoFechar} />
        </SafeAreaProvider>
      ) : null}
    </Modal>
  );
}

function Conteudo({ restaurante, menu, aoFechar }) {
  const svg = useMemo(() => svgDoQr(enderecoDoRestaurante(restaurante.id)), [restaurante.id]);
  const [aTrabalhar, setATrabalhar] = useState(null); // 'imprimir' | 'pdf' enquanto está a preparar
  const [erro, setErro] = useState(null);

  async function fazer(qual, acao) {
    setErro(null);
    setATrabalhar(qual);
    try {
      await acao(htmlDoCartaz({ restaurante, menu }));
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setATrabalhar(null);
    }
  }

  return (
    <SafeAreaView style={estilos.ecra} edges={['top', 'bottom']}>
      <View style={estilos.cabecalho}>
        <Text style={[texto.titulo, estilos.ocuparTudo]} accessibilityRole="header">
          QR code do restaurante
        </Text>
        <Pressable onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar o QR code" style={estilos.fechar}>
          <Ionicons name="close" size={28} color={cores.texto} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={estilos.conteudo}>
        <View style={estilos.cartao} accessible accessibilityLabel={`QR code de ${restaurante.nome}`}>
          <SvgXml xml={svg} width={240} height={240} />
          <Text style={texto.subtitulo}>{restaurante.nome}</Text>
        </View>

        <Text style={[texto.corpo, estilos.textoCentro]}>
          Imprime o cartaz e põe-no na porta ou nas mesas. Quem passar lê o QR com a Emmmenta e vê logo o menu do dia, os preços e
          se há mesa.
        </Text>
        <Text style={[texto.pequeno, estilos.textoCentro]}>
          {menu?.pratos?.length ? 'O cartaz leva também o menu de hoje.' : 'Ainda não publicaste o menu de hoje: o cartaz leva só o QR.'}
        </Text>

        {erro ? (
          <Text style={estilos.erro} accessibilityRole="alert">
            {erro}
          </Text>
        ) : null}

        <Botao icone="print-outline" titulo="Imprimir o cartaz" onPress={() => fazer('imprimir', imprimirCartaz)} aCarregar={aTrabalhar === 'imprimir'} />
        <Botao
          tipo="secundario"
          icone="document-outline"
          titulo="Guardar ou enviar em PDF"
          onPress={() => fazer('pdf', partilharCartazEmPdf)}
          aCarregar={aTrabalhar === 'pdf'}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  ecra: { flex: 1, backgroundColor: cores.fundo },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, paddingHorizontal: espaco.xl, paddingTop: espaco.l },
  ocuparTudo: { flex: 1 },
  // 48 x 48: área de toque confortável (RNF06)
  fechar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: raio.pilula, backgroundColor: cores.superficie },
  conteudo: { padding: espaco.xl, gap: espaco.l },
  cartao: {
    alignItems: 'center',
    gap: espaco.m,
    padding: espaco.xl,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  textoCentro: { textAlign: 'center' },
  erro: { ...texto.pequeno, color: cores.erro, textAlign: 'center' },
});
