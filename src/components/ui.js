import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cores, espaco, raio, texto } from '@/theme';

// Componentes base, iguais aos do Figma (secção "Componentes").

export function Ecra({ children, style, bordas = ['top'] }) {
  return (
    <SafeAreaView edges={bordas} style={[estilos.ecra, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Botao({ titulo, onPress, tipo = 'primario', aCarregar = false, desativado = false, icone }) {
  const primario = tipo === 'primario';
  return (
    <Pressable
      onPress={onPress}
      disabled={desativado || aCarregar}
      accessibilityRole="button"
      style={({ pressed }) => [
        estilos.botao,
        primario ? estilos.botaoPrimario : estilos.botaoSecundario,
        (pressed || desativado) && { opacity: 0.7 },
      ]}
    >
      {aCarregar ? (
        <ActivityIndicator color={primario ? cores.textoInverso : cores.acento} />
      ) : (
        <View style={estilos.linha}>
          {icone ? <Ionicons name={icone} size={20} color={primario ? cores.textoInverso : cores.acento} /> : null}
          <Text style={[estilos.botaoTexto, { color: primario ? cores.textoInverso : cores.texto }]}>{titulo}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Campo({ etiqueta, ...props }) {
  return (
    <View style={{ gap: espaco.s }}>
      <Text style={texto.etiqueta}>{etiqueta}</Text>
      <TextInput placeholderTextColor={cores.textoTerciario} style={estilos.campo} {...props} />
    </View>
  );
}

export function Logo({ tamanho = 44 }) {
  return (
    <View style={estilos.linha}>
      <View style={[estilos.marca, { width: tamanho, height: tamanho }]}>
        <Ionicons name="restaurant-outline" size={tamanho * 0.55} color={cores.textoInverso} />
      </View>
      <Text style={estilos.logoTexto}>Emmmenta</Text>
    </View>
  );
}

export function Carregar() {
  return (
    <View style={[estilos.ecra, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator size="large" color={cores.acento} />
    </View>
  );
}

// Caixa usada nos ecrãs que ainda estão por fazer: diz o que falta e quem trata.
export function PorFazer({ requisitos, responsavel, itens }) {
  return (
    <View style={estilos.porFazer}>
      <Text style={estilos.porFazerTitulo}>
        Por fazer · {requisitos} · {responsavel}
      </Text>
      {itens.map((item) => (
        <Text key={item} style={texto.pequeno}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  ecra: { flex: 1, backgroundColor: cores.fundo },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
  botao: { height: 52, borderRadius: raio.l, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espaco.l },
  botaoPrimario: { backgroundColor: cores.acento },
  botaoSecundario: { backgroundColor: cores.superficie, borderWidth: 1.5, borderColor: cores.linha },
  botaoTexto: { fontSize: 16, fontWeight: '600' },
  campo: {
    height: 52,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
    paddingHorizontal: espaco.l,
    fontSize: 16,
    color: cores.texto,
  },
  marca: { borderRadius: raio.m, backgroundColor: cores.acento, alignItems: 'center', justifyContent: 'center' },
  logoTexto: { fontSize: 24, fontWeight: '700', color: cores.texto },
  porFazer: {
    gap: espaco.xs,
    padding: espaco.l,
    borderRadius: raio.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: cores.acento,
    backgroundColor: cores.superficie,
  },
  porFazerTitulo: { fontSize: 14, fontWeight: '700', color: cores.acento, marginBottom: espaco.xs },
});
