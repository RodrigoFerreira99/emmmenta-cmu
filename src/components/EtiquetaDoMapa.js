import { StyleSheet, Text, View } from 'react-native';

import { formatarPreco } from '@/services/pratos';
import { cores, espaco, raio } from '@/theme';

// O marcador de um restaurante no mapa: em vez do alfinete genérico, uma etiqueta com o preço do
// prato mais barato ("6,50 €"), como nas apps de alojamento. Assim compara-se preços só a olhar
// para o mapa, sem tocar em nada.
//
// Propriedades:
//   restaurante  um grupo devolvido por agruparPorRestaurante() ({ disponiveis, precoMinimo, ... })
//   escolhido    true para o restaurante em que se tocou (fica escuro e maior)
export function EtiquetaDoMapa({ restaurante, escolhido = false }) {
  const esgotado = restaurante.disponiveis === 0;
  const textoDaEtiqueta = esgotado ? 'Esgotado' : formatarPreco(restaurante.precoMinimo);

  return (
    <View style={estilos.conjunto}>
      <View style={[estilos.etiqueta, esgotado && estilos.etiquetaEsgotada, escolhido && estilos.etiquetaEscolhida]}>
        <Text style={[estilos.texto, esgotado && estilos.textoEsgotado]}>{textoDaEtiqueta}</Text>
      </View>
      {/* o "bico" da etiqueta: um quadrado rodado 45º, metade escondido por baixo */}
      <View style={[estilos.bico, esgotado && estilos.bicoEsgotado, escolhido && estilos.bicoEscolhido]} />
    </View>
  );
}

const estilos = StyleSheet.create({
  conjunto: { alignItems: 'center' },
  etiqueta: {
    paddingHorizontal: espaco.s,
    paddingVertical: 4,
    borderRadius: raio.pilula,
    borderWidth: 1.5,
    borderColor: cores.superficie,
    backgroundColor: cores.acento,
  },
  etiquetaEsgotada: { backgroundColor: cores.textoTerciario },
  etiquetaEscolhida: { backgroundColor: cores.texto, transform: [{ scale: 1.1 }] },
  texto: { fontSize: 13, fontWeight: '700', color: cores.textoInverso },
  textoEsgotado: { fontWeight: '600' },
  bico: {
    width: 10,
    height: 10,
    marginTop: -6,
    transform: [{ rotate: '45deg' }],
    backgroundColor: cores.acento,
  },
  // só a cor muda: o bico tem de continuar rodado
  bicoEsgotado: { backgroundColor: cores.textoTerciario },
  bicoEscolhido: { backgroundColor: cores.texto },
});
