import * as ImagePicker from 'expo-image-picker';

// Tirar uma fotografia ou escolher uma imagem da galeria.
// É usado em dois sítios: na fotografia do restaurante (RF02, SeletorFoto) e na leitura do menu
// por fotografia (LerMenuDaFoto). Assim a regra da permissão da câmara está escrita uma só vez.

/**
 * origem: 'camara' ou 'galeria'.
 * opcoes: opções do expo-image-picker, por exemplo { allowsEditing: true, aspect: [4, 3] }.
 *
 * Devolve o caminho local da imagem, ou null se a pessoa desistiu.
 * Lança um Error com mensagem em português se não houver acesso à câmara ou se algo falhar.
 */
export async function escolherImagem(origem, opcoes = {}) {
  // quality 1: sem compressão aqui — quem usa a imagem comprime-a uma só vez, no serviço
  const todasAsOpcoes = { mediaTypes: 'images', quality: 1, ...opcoes };

  let semCamara = false;
  let resultado = null;
  try {
    if (origem === 'camara') {
      // A câmara precisa de permissão. Só é pedida aqui, quando a pessoa carrega no botão.
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      semCamara = !granted;
      if (granted) resultado = await ImagePicker.launchCameraAsync(todasAsOpcoes);
    } else {
      // A galeria não precisa de permissão: o seletor é do próprio sistema
      // e a app só recebe a imagem que a pessoa escolher.
      resultado = await ImagePicker.launchImageLibraryAsync(todasAsOpcoes);
    }
  } catch (erro) {
    console.warn('Erro técnico (obter fotografia):', erro?.message ?? erro);
    throw new Error('Não foi possível obter a fotografia. Tenta outra vez.');
  }

  if (semCamara) {
    throw new Error('Sem acesso à câmara não é possível tirar a fotografia. Podes escolher uma imagem da galeria.');
  }
  if (!resultado || resultado.canceled) return null;
  return resultado.assets[0].uri;
}
