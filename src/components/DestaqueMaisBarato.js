import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/components/Icone';
import { formatarDistancia, formatarPreco } from '@/services/pratos';
import { cores, espaco, fontes, raio, texto } from '@/theme';

// Destaque no topo da lista do Início: "O almoço mais barato perto de ti". É o prato principal
// disponível mais barato entre os que estão na lista (almocoMaisBarato em src/services/pratos.js),
// por isso respeita os filtros escolhidos. Tocar abre a página do restaurante.
//
// Propriedades:
//   prato    uma linha devolvida por buscarPratosPerto()
//   onPress  função chamada ao tocar
export function DestaqueMaisBarato({ prato, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`O almoço mais barato perto de ti: ${prato.prato}, ${prato.restaurante}, ${formatarPreco(prato.preco)}`}
      style={({ pressed }) => [estilos.cartao, pressed && estilos.premido]}
    >
      <View style={estilos.icone}>
        <Icone name="pricetag" size={18} color={cores.textoInverso} />
      </View>
      <View style={estilos.textos}>
        <Text style={estilos.titulo}>O almoço mais barato perto de ti</Text>
        <Text style={estilos.nome} numberOfLines={1}>
          {prato.prato}
        </Text>
        <Text style={texto.pequeno} numberOfLines={1}>
          {prato.restaurante} · {formatarDistancia(prato.distancia_km)}
        </Text>
      </View>
      <Text style={estilos.preco}>{formatarPreco(prato.preco)}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    padding: espaco.l,
    borderRadius: raio.xl,
    borderWidth: 1.5,
    borderColor: cores.acento,
    backgroundColor: cores.acentoSuave,
  },
  premido: { opacity: 0.7 },
  icone: { width: 36, height: 36, borderRadius: raio.pilula, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.acento },
  textos: { flex: 1, gap: 2 },
  titulo: { fontSize: 12, fontFamily: fontes.negrito, color: cores.acento, textTransform: 'uppercase', letterSpacing: 0.5 },
  nome: { ...texto.corpo, fontSize: 16, fontFamily: fontes.negrito },
  preco: { fontSize: 20, fontFamily: fontes.grossa, color: cores.acento },
});
