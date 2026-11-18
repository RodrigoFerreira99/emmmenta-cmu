import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Vibração leve para confirmar uma ação: o telemóvel "responde" ao toque, como um botão a sério.
// Usa o expo-haptics, que vem incluído no Expo Go. No browser não há vibração, por isso não faz nada.
// Uma vibração que falhe nunca pode estragar a ação que a pediu: os erros são ignorados.

function vibrar(pedido) {
  if (Platform.OS === 'web') return;
  try {
    pedido().catch(() => {});
  } catch {
    // telemóvel sem motor de vibração (ou testes no computador): não faz mal
  }
}

/** Um toque curto: marcar esgotado, guardar nos favoritos, mudar uma opção. */
export const vibrarLeve = () => vibrar(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Correu bem: menu publicado, prato escolhido pelo "Abana para decidir". */
export const vibrarSucesso = () => vibrar(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Um "tic" muito leve, por exemplo enquanto o "Abana para decidir" baralha os pratos. */
export const vibrarSelecao = () => vibrar(() => Haptics.selectionAsync());
