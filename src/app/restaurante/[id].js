import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { Ecra, PorFazer } from '@/components/ui';
import { espaco, texto } from '@/theme';

// Ecrã 4 · Página do restaurante (RF06) — responsável: André
// Abre-se com router.push(`/restaurante/${restaurante_id}`).
export default function PaginaRestaurante() {
  const { id } = useLocalSearchParams();
  return (
    <Ecra bordas={[]}>
      <ScrollView contentContainerStyle={{ padding: espaco.xl, gap: espaco.l }}>
        <Text style={texto.titulo}>Restaurante</Text>
        <Text style={texto.pequeno}>id: {id}</Text>
        <PorFazer
          requisitos="RF06"
          responsavel="André"
          itens={[
            'Ler o restaurante (tabela restaurantes) e o menu de hoje (menus + pratos)',
            'Fotografia, nome, tipo de cozinha, distância, horário',
            'Lista do menu de hoje com preços; esgotados riscados',
            'Botão Ligar: Linking.openURL(`tel:${telefone}`)',
            'Botão Direções: abre a app de mapas com as coordenadas',
            'Ouvir os esgotados em tempo real com ouvirAlteracoesPratos()',
          ]}
        />
      </ScrollView>
    </Ecra>
  );
}
