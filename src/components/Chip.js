import { Pressable, StyleSheet, Text } from 'react-native';

import { cores, raio } from '@/theme';

// Etiqueta arredondada para escolher uma opção entre várias (por exemplo, a categoria de um prato).
// Igual ao componente "Chip" do Figma: a opção escolhida fica escura, as outras ficam brancas.
//
// Propriedades:
//   titulo    texto da etiqueta
//   ativo     true se for a opção escolhida
//   onPress   função chamada ao tocar
//   multipla  true quando se podem escolher várias ao mesmo tempo (por exemplo, as etiquetas de um prato):
//             o leitor de ecrã diz "caixa de verificação" em vez de "botão de opção"
export function Chip({ titulo, ativo = false, onPress, multipla = false }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multipla ? 'checkbox' : 'radio'}
      accessibilityState={multipla ? { checked: ativo } : { selected: ativo }}
      accessibilityLabel={titulo}
      // a etiqueta tem 36 px de altura; o hitSlop aumenta a área de toque para 44 px (RNF06)
      hitSlop={4}
      style={[estilos.chip, ativo ? estilos.ativo : estilos.inativo]}
    >
      <Text style={[estilos.texto, ativo && estilos.textoAtivo]}>{titulo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  chip: { height: 36, paddingHorizontal: 14, borderRadius: raio.pilula, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  ativo: { backgroundColor: cores.texto, borderColor: cores.texto },
  inativo: { backgroundColor: cores.superficie, borderColor: cores.linha },
  texto: { fontSize: 14, fontWeight: '500', color: cores.texto },
  textoAtivo: { color: cores.textoInverso },
});
