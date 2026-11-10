import { StyleSheet, Text, View } from 'react-native';

import { Campo } from '@/components/ui';
import { cores, espaco, texto } from '@/theme';

// Um campo de formulário com a mensagem de erro por baixo (a vermelho), quando existe.
// Recebe as mesmas propriedades do <Campo> de ui.js (etiqueta, value, onChangeText, ...) e mais "erro".
// A propriedade "ref" também passa para o campo, para se poder fazer .focus() (tecla "Seguinte").
export function CampoComErro({ erro, ...props }) {
  return (
    <View style={estilos.grupo}>
      {/* accessibilityLabel: o leitor de ecrã diz o nome do campo */}
      <Campo accessibilityLabel={props.etiqueta} {...props} />
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco.xs },
  erro: { ...texto.pequeno, color: cores.erro },
});
