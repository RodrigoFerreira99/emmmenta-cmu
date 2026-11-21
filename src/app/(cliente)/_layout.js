import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AvisoDeFavoritos } from '@/components/AvisoDeFavoritos';
import { Icone } from '@/components/Icone';
import { PertoProvider } from '@/context/PertoContext';
import { cores, fontes } from '@/theme';

// Separadores do cliente: Início, Mapa e Conta.
// O PertoProvider guarda o sítio onde se procura, os filtros e os pratos encontrados,
// para a lista (Início) e o mapa mostrarem sempre a mesma coisa.
// O AvisoDeFavoritos fica por cima dos separadores: aparece em qualquer um deles.
export default function LayoutCliente() {
  return (
    <PertoProvider>
      <View style={estilos.ocuparTudo}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: cores.acento,
            tabBarInactiveTintColor: cores.textoTerciario,
            tabBarStyle: { backgroundColor: cores.superficie, borderTopColor: cores.linha },
            tabBarLabelStyle: { fontFamily: fontes.media, fontSize: 11 },
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color, size }) => <Icone name="home-outline" size={size} color={color} /> }} />
          <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarIcon: ({ color, size }) => <Icone name="map-outline" size={size} color={color} /> }} />
          <Tabs.Screen name="conta" options={{ title: 'Conta', tabBarIcon: ({ color, size }) => <Icone name="person-outline" size={size} color={color} /> }} />
        </Tabs>
        <AvisoDeFavoritos />
      </View>
    </PertoProvider>
  );
}

const estilos = StyleSheet.create({
  ocuparTudo: { flex: 1 },
});
