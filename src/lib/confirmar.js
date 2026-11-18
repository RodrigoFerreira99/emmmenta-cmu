import { Alert, Platform } from 'react-native';

/**
 * Pergunta "tens a certeza?" antes de uma ação que faz perder alguma coisa
 * (por exemplo, sair de um ecrã com alterações por guardar).
 *
 * No telemóvel usa o aviso do sistema (Alert). No browser o Alert do React Native não mostra
 * botões, por isso aí usa-se a janela de confirmação do próprio browser.
 *
 *   confirmar({ titulo, mensagem, textoConfirmar, textoCancelar, aoConfirmar })
 */
export function confirmar({ titulo, mensagem, textoConfirmar, textoCancelar = 'Cancelar', aoConfirmar }) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensagem}`)) aoConfirmar();
    return;
  }
  Alert.alert(titulo, mensagem, [
    { text: textoCancelar, style: 'cancel' },
    { text: textoConfirmar, style: 'destructive', onPress: aoConfirmar },
  ]);
}
