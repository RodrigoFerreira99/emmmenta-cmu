import { ScrollView, Text } from 'react-native';

import { Ecra, PorFazer } from '@/components/ui';
import { espaco, texto } from '@/theme';

// Ecrã 3 · Mapa (RF06, RF07) — responsável: André
// Usar react-native-maps (funciona no Expo Go sem configuração).
export default function Mapa() {
  return (
    <Ecra>
      <ScrollView contentContainerStyle={{ padding: espaco.xl, gap: espaco.l }}>
        <Text style={texto.titulo}>Mapa</Text>
        <PorFazer
          requisitos="RF06 · RF07"
          responsavel="André"
          itens={[
            'MapView centrado na localização do cliente',
            'Um marcador por restaurante com menu hoje, com o preço mais baixo',
            'Tocar num marcador mostra o cartão do restaurante em baixo',
            'Botão "Ver menu de hoje" abre /restaurante/[id]',
            'Os mesmos filtros e pesquisa do Início',
          ]}
        />
      </ScrollView>
    </Ecra>
  );
}
