import { ScrollView, Text } from 'react-native';

import { Botao, Ecra, PorFazer } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { espaco, texto } from '@/theme';

// Ecrã 7 · Perfil do restaurante (RF02) — responsável: Rodrigo
export default function PerfilRestaurante() {
  const { sessao, sair } = useAuth();
  return (
    <Ecra>
      <ScrollView contentContainerStyle={{ padding: espaco.xl, gap: espaco.l }}>
        <Text style={texto.titulo}>Perfil do restaurante</Text>
        <Text style={texto.pequeno}>{sessao?.user?.email}</Text>
        <PorFazer
          requisitos="RF02"
          responsavel="Rodrigo"
          itens={[
            'Formulário: nome, tipo de cozinha, morada, horário de almoço, telefone',
            'Ponto no mapa ajustável (guarda latitude e longitude)',
            'Fotografia com expo-image-picker, enviada para o Storage (pasta <id do utilizador>/)',
            'Guardar: insert na primeira vez, update depois (tabela restaurantes, dono_id = utilizador)',
          ]}
        />
        <Botao tipo="secundario" icone="log-out-outline" titulo="Terminar sessão" onPress={sair} />
      </ScrollView>
    </Ecra>
  );
}
