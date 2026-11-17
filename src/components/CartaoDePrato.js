import { Pressable, StyleSheet, Text, View } from 'react-native';

import { nomeDaCategoria } from '@/services/menus';
import { formatarDistancia, formatarPreco } from '@/services/pratos';
import { cores, espaco, raio, texto } from '@/theme';

// RF05 — cartão de um prato na lista "pratos perto de mim": nome, restaurante, distância,
// categoria e preço. Um prato esgotado aparece a cinzento e riscado, com a etiqueta "Esgotado".
//
// Propriedades:
//   prato    uma linha devolvida por buscarPratosPerto()
//   onPress  função chamada ao tocar (abre a página do restaurante)
export function CartaoDePrato({ prato, onPress }) {
  const esgotado = prato.esgotado;
  const distancia = formatarDistancia(prato.distancia_km);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${prato.prato}, ${prato.restaurante}, a ${distancia}, ${esgotado ? 'esgotado' : formatarPreco(prato.preco)}`}
      style={({ pressed }) => [estilos.cartao, pressed && estilos.premido]}
    >
      <View style={estilos.textos}>
        <Text style={[estilos.nome, esgotado && estilos.riscado]} numberOfLines={2}>
          {prato.prato}
        </Text>
        <Text style={texto.pequeno} numberOfLines={1}>
          {prato.restaurante} · {distancia}
        </Text>
        <Text style={estilos.categoria}>{nomeDaCategoria(prato.categoria)}</Text>
      </View>

      <View style={estilos.direita}>
        <Text style={[estilos.preco, esgotado && estilos.precoEsgotado]}>{formatarPreco(prato.preco)}</Text>
        {esgotado ? <EtiquetaEsgotado /> : null}
      </View>
    </Pressable>
  );
}

// Etiqueta "Esgotado", igual à do Figma. Também é usada na página do restaurante.
export function EtiquetaEsgotado() {
  return (
    <View style={estilos.etiqueta}>
      <Text style={estilos.etiquetaTexto}>Esgotado</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    padding: espaco.l,
    minHeight: 72,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  premido: { opacity: 0.7 },
  textos: { flex: 1, gap: 2 },
  nome: { ...texto.corpo, fontSize: 16, fontWeight: '600' },
  riscado: { color: cores.textoTerciario, textDecorationLine: 'line-through' },
  categoria: { fontSize: 12, color: cores.textoTerciario },
  direita: { alignItems: 'flex-end', gap: espaco.xs },
  preco: { fontSize: 17, fontWeight: '700', color: cores.acento },
  precoEsgotado: { color: cores.textoTerciario, textDecorationLine: 'line-through' },
  etiqueta: { paddingHorizontal: espaco.s, paddingVertical: 2, borderRadius: raio.s, backgroundColor: cores.linha },
  etiquetaTexto: { fontSize: 11, fontWeight: '600', color: cores.textoSecundario },
});
