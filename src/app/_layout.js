import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { EcraDeErro } from '@/components/EcraDeErro';
import { Carregar } from '@/components/ui';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { rotaInicial } from '@/lib/navegacao';
import { cores } from '@/theme';

// Navegação principal: o tipo de conta decide o percurso (Figura 2 do relatório).
//  - sem sessão        → login
//  - conta cliente     → separadores Início / Mapa / Conta + página do restaurante
//  - conta restaurante → separadores Painel / Perfil + publicar menu
function Navegacao() {
  const { sessao, perfil, aCarregar, erroPerfil, tentarCarregarPerfil, sair } = useAuth();
  if (aCarregar) return <Carregar />;

  const entrou = !!sessao;

  // Há sessão mas não foi possível ler o perfil (por exemplo, a app foi aberta sem rede).
  // Sem o tipo de conta não sabemos que percurso mostrar: em vez de ficar parada a carregar,
  // a app explica o que aconteceu e deixa tentar outra vez ou terminar a sessão (RNF08).
  if (entrou && !perfil) {
    return <EcraDeErro mensagem={erroPerfil} aoTentar={tentarCarregarPerfil} aoSair={sair} />;
  }

  const eRestaurante = entrou && perfil.tipo === 'restaurante';
  const eCliente = entrou && !eRestaurante;

  // Quem estiver num ecrã que deixou de poder ver (ex.: acabou de entrar e ainda está no login)
  // é enviado para o primeiro ecrã do seu percurso. Ver src/lib/navegacao.js.
  const inicio = rotaInicial(entrou ? perfil.tipo : null);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }}>
      <Stack.Protected guard={!entrou} redirectTo={inicio}>
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={eCliente} redirectTo={inicio}>
        <Stack.Screen name="(cliente)" />
        <Stack.Screen name="restaurante/[id]" options={{ headerShown: true, title: '', headerTintColor: cores.texto }} />
      </Stack.Protected>

      <Stack.Protected guard={eRestaurante} redirectTo={inicio}>
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
