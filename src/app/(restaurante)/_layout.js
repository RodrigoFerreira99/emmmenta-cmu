import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { cores } from '@/theme';

// Separadores do restaurante: Painel e Perfil.
export default function LayoutRestaurante() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.acento,
        tabBarInactiveTintColor: cores.textoTerciario,
        tabBarStyle: { backgroundColor: cores.superficie, borderTopColor: cores.linha },
      }}
    >
      <Tabs.Screen name="painel" options={{ title: 'Painel', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
