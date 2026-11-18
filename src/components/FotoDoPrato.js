import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { cores, espaco, raio } from '@/theme';

// Fotografia de um prato na página do restaurante: uma miniatura que, ao tocar, abre a fotografia
// em grande (tocar outra vez, ou no botão "voltar" do Android, fecha).
//
// Propriedades:
//   uri      link público da fotografia (coluna pratos.foto_url)
//   nome     nome do prato (para o leitor de ecrã e para a legenda)
//   tamanho  lado da miniatura em pixels (56 por omissão; mais de 44 = área de toque mínima, RNF06)
export function FotoDoPrato({ uri, nome, tamanho = 56 }) {
  const [aberta, setAberta] = useState(false);

  return (
    <>
      <Pressable onPress={() => setAberta(true)} accessibilityRole="imagebutton" accessibilityLabel={`Ver a fotografia de ${nome}`}>
        <Image source={{ uri }} style={[estilos.miniatura, { width: tamanho, height: tamanho }]} />
      </Pressable>

      <Modal visible={aberta} transparent animationType="fade" onRequestClose={() => setAberta(false)}>
        <Pressable
          style={estilos.fundo}
          onPress={() => setAberta(false)}
          accessibilityRole="button"
          accessibilityLabel="Fechar a fotografia"
        >
          <Image source={{ uri }} style={estilos.grande} resizeMode="contain" accessibilityLabel={`Fotografia de ${nome}`} />
          <View style={estilos.legenda}>
            <Text style={estilos.legendaTexto}>{nome}</Text>
            <Ionicons name="close" size={22} color={cores.textoInverso} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const estilos = StyleSheet.create({
  miniatura: { borderRadius: raio.m, backgroundColor: cores.acentoSuave },
  // a cor do texto com 90 % de opacidade ("E6" no fim): um fundo quase preto por trás da fotografia
  fundo: { flex: 1, backgroundColor: `${cores.texto}E6`, alignItems: 'center', justifyContent: 'center', padding: espaco.xl, gap: espaco.l },
  grande: { width: '100%', height: '70%' },
  legenda: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  legendaTexto: { fontSize: 17, fontWeight: '600', color: cores.textoInverso },
});
