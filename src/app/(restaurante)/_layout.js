import { Tabs } from 'expo-router';

import { Icone } from '@/components/Icone';
import { cores, fontes } from '@/theme';

// Separadores do restaurante: Painel e Perfil.
export default function LayoutRestaurante() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.acento,
        tabBarInactiveTintColor: cores.textoTerciario,
        tabBarStyle: { backgroundColor: cores.superficie, borderTopColor: cores.linha },
        tabBarLabelStyle: { fontFamily: fontes.media, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="painel" options={{ title: 'Painel', tabBarIcon: ({ color, size }) => <Icone name="grid-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <Icone name="storefront-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
