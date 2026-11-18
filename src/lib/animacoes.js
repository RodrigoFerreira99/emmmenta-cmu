import { LayoutAnimation, Platform } from 'react-native';

// Animação suave quando os cartões mudam de lugar na lista (por exemplo, um prato fica esgotado e
// desce para o fim, ou o cliente escolhe "Mais barato primeiro"). Em vez de saltarem, deslizam.
//
// Usa o LayoutAnimation do React Native: chama-se ANTES de mudar o estado, e a próxima mudança
// de posições no ecrã é animada sozinha. No browser não faz nada.
export function animarProximaMudanca() {
  if (Platform.OS === 'web') return;
  try {
    LayoutAnimation.configureNext(LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
  } catch {
    // sem animação não faz mal: a lista muda na mesma
  }
}
