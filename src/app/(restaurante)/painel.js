import { router } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { Botao, Ecra, PorFazer } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { espaco, texto } from '@/theme';

// Ecrã 5 · Painel (RF04) — responsável: José
export default function Painel() {
  const { perfil } = useAuth();
  return (
    <Ecra>
      <ScrollView contentContainerStyle={{ padding: espaco.xl, gap: espaco.l }}>
        <Text style={texto.pequeno}>Bom dia, {perfil?.nome || 'restaurante'}</Text>
        <Text style={texto.titulo}>Painel</Text>
        <PorFazer
          requisitos="RF04"
          responsavel="José"
          itens={[
            'Se ainda não há perfil do restaurante: pedir para o criar primeiro (separador Perfil)',
            'Estado do menu de hoje: publicado às X ou ainda por publicar',
            'Lista dos pratos de hoje com interruptor "Esgotado" (update em pratos.esgotado)',
            'Botão para publicar / editar o menu de hoje',
          ]}
        />
        <Botao titulo="Publicar menu de hoje" icone="add" onPress={() => router.push('/publicar')} />
      </ScrollView>
    </Ecra>
  );
}
