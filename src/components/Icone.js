import { Path, Svg } from 'react-native-svg';

import { CAMINHOS } from '@/components/caminhosDosIcones';

// Ícones da app (design final): desenhos do Phosphor Icons, mais claros e com o mesmo traço em todo o lado.
// Recebe os mesmos nomes que os ícones antigos (Ionicons), para os ecrãs não terem de mudar:
// <Icone name="heart-outline" size={20} color={cores.acento} />
// Os nomes "-outline" passam à versão duotone (contorno + fundo suave); os outros à versão cheia.

// nome antigo → [desenho do Phosphor, versão ("d" = duotone, "f" = cheio)]
export const CORRESPONDENCIA = {
  add: ['plus', 'd'],
  'arrow-back': ['arrow-left', 'd'],
  'arrow-forward': ['arrow-right', 'd'],
  'arrow-up': ['arrow-up', 'f'],
  'call-outline': ['phone', 'd'],
  'camera-outline': ['camera', 'd'],
  checkmark: ['check', 'd'],
  'checkmark-circle': ['check-circle', 'f'],
  'checkmark-circle-outline': ['check-circle', 'd'],
  'chevron-down': ['caret-down', 'd'],
  'chevron-forward': ['caret-right', 'd'],
  close: ['x', 'd'],
  'close-circle': ['x-circle', 'f'],
  'close-outline': ['x', 'd'],
  'cloud-offline-outline': ['cloud-slash', 'd'],
  'compass-outline': ['compass', 'd'],
  'copy-outline': ['copy', 'd'],
  'create-outline': ['pencil-simple', 'd'],
  'dice-outline': ['dice-five', 'd'],
  'document-outline': ['file-text', 'd'],
  'eye-off-outline': ['eye-slash', 'd'],
  'eye-outline': ['eye', 'd'],
  'grid-outline': ['squares-four', 'd'],
  heart: ['heart', 'f'],
  'heart-outline': ['heart', 'd'],
  'home-outline': ['house', 'd'],
  'hourglass-outline': ['hourglass', 'd'],
  'images-outline': ['images', 'd'],
  'locate-outline': ['crosshair', 'd'],
  location: ['map-pin', 'f'],
  'location-outline': ['map-pin', 'd'],
  'log-out-outline': ['sign-out', 'd'],
  'map-outline': ['map-trifold', 'd'],
  navigate: ['navigation-arrow', 'f'],
  'navigate-outline': ['navigation-arrow', 'd'],
  'notifications-outline': ['bell', 'd'],
  'options-outline': ['sliders-horizontal', 'd'],
  'people-outline': ['users', 'd'],
  'person-outline': ['user', 'd'],
  pricetag: ['tag', 'f'],
  'print-outline': ['printer', 'd'],
  'qr-code-outline': ['qr-code', 'd'],
  'refresh-outline': ['arrow-clockwise', 'd'],
  repeat: ['repeat', 'd'],
  'repeat-outline': ['repeat', 'd'],
  'resize-outline': ['arrows-out', 'd'],
  'restaurant-outline': ['fork-knife', 'd'],
  'sad-outline': ['smiley-sad', 'd'],
  search: ['magnifying-glass', 'd'],
  'search-outline': ['magnifying-glass', 'd'],
  send: ['paper-plane-right', 'd'],
  'share-social-outline': ['share-network', 'd'],
  sparkles: ['sparkle', 'f'],
  'sparkles-outline': ['sparkle', 'd'],
  'stop-circle-outline': ['stop-circle', 'd'],
  'storefront-outline': ['storefront', 'd'],
  'time-outline': ['clock', 'd'],
  'trash-outline': ['trash', 'd'],
  'volume-high-outline': ['speaker-high', 'd'],
  'walk-outline': ['person-simple-walk', 'd'],
  'globe-outline': ['globe', 'd'],
  link: ['link', 'd'],
  alert: ['warning', 'd'],
  // ícones novos do design térmico
  vibrar: ['vibrate', 'd'],
  calor: ['fire', 'f'],
  sol: ['sun', 'd'],
  lua: ['moon', 'd'],
  termometro: ['thermometer', 'd'],
};

// Devolve os traços a desenhar, ou null se o nome não existir.
export function desenhoDoIcone(nome) {
  const [desenho, versao] = CORRESPONDENCIA[nome] || [];
  return (desenho && CAMINHOS[desenho] && CAMINHOS[desenho][versao]) || null;
}

export function Icone({ name, size = 24, color = '#000', style }) {
  const tracos = desenhoDoIcone(name);
  if (!tracos) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" style={style} pointerEvents="none" accessible={false}>
      {tracos.map((traco, i) => (
        <Path key={i} d={traco.d} fill={color} opacity={traco.o ?? 1} />
      ))}
    </Svg>
  );
}

export default Icone;
