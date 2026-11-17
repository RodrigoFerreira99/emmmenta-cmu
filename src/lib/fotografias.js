import * as ImagePicker from 'expo-image-picker';

// Tirar ou escolher fotografias. É usado em dois sítios: na fotografia do restaurante (RF02, SeletorFoto)
// e na leitura do menu por fotografia (LerMenuDaFoto).
//
// Para TIRAR uma fotografia usamos a câmara dentro da própria app (componente CameraNaApp), e não a app da
// câmara do telemóvel: no Android, enquanto a outra app está aberta, o sistema pode fechar a Emmmenta para
// libertar memória, e a fotografia perdia-se. Aqui fica só o pedido de permissão.

/**
 * Pede a permissão da câmara (o sistema só mostra o pedido da primeira vez).
 * Não devolve nada se ficar concedida; senão lança um Error com mensagem em português (RNF08).
 * A permissão da câmara é uma só no telemóvel: serve tanto para o expo-image-picker como para o expo-camera.
 */
export async function pedirAcessoACamara() {
  let concedida = false;
  try {
    ({ granted: concedida } = await ImagePicker.requestCameraPermissionsAsync());
  } catch (erro) {
    console.warn('Erro técnico (permissão da câmara):', erro?.message ?? erro);
  }
  if (!concedida) {
    throw new Error('Sem acesso à câmara não é possível tirar a fotografia. Podes escolher uma imagem da galeria.');
  }
}

/**
 * Escolher uma imagem da galeria. A galeria não precisa de permissão: o seletor é do próprio sistema
 * e a app só recebe a imagem que a pessoa escolher.
 * opcoes: opções do expo-image-picker, por exemplo { allowsEditing: true, aspect: [4, 3] }.
 *
 * Devolve o caminho local da imagem, ou null se a pessoa desistiu.
 * Lança um Error com mensagem em português se algo falhar.
 */
export async function escolherDaGaleria(opcoes = {}) {
  let resultado;
  try {
    // quality 1: sem compressão aqui — quem usa a imagem comprime-a uma só vez, no serviço
    resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1, ...opcoes });
  } catch (erro) {
    console.warn('Erro técnico (escolher fotografia):', erro?.message ?? erro);
    throw new Error('Não foi possível abrir a galeria. Tenta outra vez.');
  }
  if (!resultado || resultado.canceled) return null;
  return resultado.assets[0].uri;
}
