import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Carregar } from '@/components/ui';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { cores } from '@/theme';

// Navegação principal: o tipo de conta decide o percurso (Figura 2 do relatório).
//  - sem sessão        → login
//  - conta cliente     → separadores Início / Mapa / Conta + página do restaurante
//  - conta restaurante → separadores Painel / Perfil + publicar menu
function Navegacao() {
  const { sessao, perfil, aCarregar } = useAuth();
  if (aCarregar) return <Carregar />;

  const entrou = !!sessao;
  const eRestaurante = entrou && perfil?.tipo === 'restaurante';
  const eCliente = entrou && !eRestaurante;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }}>
      <Stack.Protected guard={!entrou}>
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={eCliente}>
        <Stack.Screen name="(cliente)" />
        <Stack.Screen name="restaurante/[id]" options={{ headerShown: true, title: '', headerTintColor: cores.texto }} />
      </Stack.Protected>

      <Stack.Protected guard={eRestaurante}>
        <Stack.Screen name="(restaurante)" />
        <Stack.Screen name="publicar" options={{ headerShown: true, title: 'Publicar menu de hoje', headerTintColor: cores.texto }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Navegacao />
    </AuthProvider>
  );
}
