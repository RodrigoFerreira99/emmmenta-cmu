import BricolageGrotesque_400Regular from '@expo-google-fonts/bricolage-grotesque/400Regular/BricolageGrotesque_400Regular.ttf';
import BricolageGrotesque_500Medium from '@expo-google-fonts/bricolage-grotesque/500Medium/BricolageGrotesque_500Medium.ttf';
import BricolageGrotesque_600SemiBold from '@expo-google-fonts/bricolage-grotesque/600SemiBold/BricolageGrotesque_600SemiBold.ttf';
import BricolageGrotesque_700Bold from '@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf';
import BricolageGrotesque_800ExtraBold from '@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf';
import JetBrainsMono_400Regular from '@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf';
import JetBrainsMono_600SemiBold from '@expo-google-fonts/jetbrains-mono/600SemiBold/JetBrainsMono_600SemiBold.ttf';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { EcraDeErro } from '@/components/EcraDeErro';
import { Carregar } from '@/components/ui';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { prepararNotificacoes } from '@/lib/lembretes';
import { rotaInicial } from '@/lib/navegacao';
import { cores, fontes } from '@/theme';

// As letras do design (src/theme.js → fontes). Vêm dentro da app: só se carrega cada peso que é usado.
const LETRAS = {
  [fontes.normal]: BricolageGrotesque_400Regular,
  [fontes.media]: BricolageGrotesque_500Medium,
  [fontes.semi]: BricolageGrotesque_600SemiBold,
  [fontes.negrito]: BricolageGrotesque_700Bold,
  [fontes.grossa]: BricolageGrotesque_800ExtraBold,
  [fontes.mono]: JetBrainsMono_400Regular,
  [fontes.monoForte]: JetBrainsMono_600SemiBold,
};

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
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: cores.fundo },
        // cabeçalhos (página do restaurante, publicar) escuros como o resto da app
        headerStyle: { backgroundColor: cores.fundo },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fontes.negrito, color: cores.texto },
      }}
    >
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
  const [letrasProntas, erroDasLetras] = useFonts(LETRAS);
  // os lembretes diários (src/lib/lembretes.js) também aparecem quando a app está aberta
  useEffect(() => prepararNotificacoes(), []);

  // As letras carregam num instante (estão dentro da app). Até lá mostra-se só o fundo escuro;
  // se alguma falhar, a app continua com a letra do sistema em vez de ficar parada.
  if (!letrasProntas && !erroDasLetras) return <View style={{ flex: 1, backgroundColor: cores.fundo }} />;

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Navegacao />
    </AuthProvider>
  );
}
