import { router } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { Botao, Ecra, PorFazer } from '@/components/ui';
import { espaco, texto } from '@/theme';

// Ecrã 2 · Início (RF05, RF07) — responsável: André
// Ver o mock-up "2 · Início" no Figma e a secção "Ecrã Início" no CLAUDE.md.
export default function Inicio() {
  return (
    <Ecra>
      <ScrollView contentContainerStyle={{ padding: espaco.xl, gap: espaco.l }}>
        <Text style={texto.titulo}>Pratos de hoje perto de ti</Text>
        <PorFazer
          requisitos="RF05 · RF07"
          responsavel="André"
          itens={[
            'Pedir a localização (expo-location) e mostrar a zona no topo',
            'Lista de pratos com buscarPratosPerto() de src/services/pratos.js',
            'Cartão de prato: nome, restaurante, distância, preço, categoria',
            'Pratos esgotados em cinzento, no fim da lista',
            'Pesquisa por nome e filtros rápidos: preço, raio e categoria',
            'Sem permissão de localização: escolher a zona à mão (RNF08)',
          ]}
        />
        {/* Exemplo de navegação para a página de um restaurante: */}
        <Botao tipo="secundario" titulo="Abrir um restaurante (exemplo)" onPress={() => router.push('/restaurante/exemplo')} />
      </ScrollView>
    </Ecra>
  );
}
