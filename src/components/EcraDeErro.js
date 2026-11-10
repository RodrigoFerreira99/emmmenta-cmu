import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Botao, Ecra } from '@/components/ui';
import { cores, espaco, texto } from '@/theme';

// Ecrã inteiro para quando não foi possível carregar alguma coisa (RNF08):
// mostra o que aconteceu e deixa tentar outra vez, em vez de a app ficar parada.
//
// Propriedades:
//   mensagem  texto a mostrar (já em português)
//   aoTentar  função do botão "Tentar outra vez"
//   aoSair    (opcional) função do botão "Terminar sessão"
export function EcraDeErro({ mensagem, aoTentar, aoSair }) {
  return (
    <Ecra bordas={['top', 'bottom']}>
      <View style={estilos.centro}>
        <Ionicons name="cloud-offline-outline" size={40} color={cores.textoTerciario} style={estilos.icone} />
        <Text style={[texto.corpo, estilos.mensagem]} accessibilityRole="alert">
          {mensagem}
        </Text>
        <Botao titulo="Tentar outra vez" icone="refresh-outline" onPress={aoTentar} />
        {aoSair ? <Botao tipo="secundario" icone="log-out-outline" titulo="Terminar sessão" onPress={aoSair} /> : null}
      </View>
    </Ecra>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: espaco.xl, gap: espaco.l },
  icone: { alignSelf: 'center' },
  mensagem: { textAlign: 'center' },
});
