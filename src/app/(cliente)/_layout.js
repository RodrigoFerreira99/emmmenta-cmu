import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { cores } from '@/theme';

// Separadores do cliente: Início, Mapa e Conta.
export default function LayoutCliente() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.acento,
        tabBarInactiveTintColor: cores.textoTerciario,
        tabBarStyle: { backgroundColor: cores.superficie, borderTopColor: cores.linha },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="conta" options={{ title: 'Conta', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
