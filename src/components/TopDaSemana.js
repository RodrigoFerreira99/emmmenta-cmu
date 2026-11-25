import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ImagemDoPrato } from '@/components/ImagemDoPrato';
import { corDoCalor } from '@/lib/cores';
import { descreverIdasDaSemana } from '@/services/idas';
import { formatarDistancia } from '@/services/pratos';
import { cores, espaco, fontes, raio, texto } from '@/theme';

// "Top da semana entre estudantes" (ranking dos estudantes): no Início, os restaurantes com menu hoje,
// perto, onde mais estudantes disseram "Vou almoçar aqui" nos últimos 7 dias (src/services/idas.js → topDaSemana).
// O número do lugar tem a cor do calor: o 1.º é o mais quente.
//
// Propriedades: lista (de topDaSemana()), aoAbrir(restaurante).
export function TopDaSemana({ lista, aoAbrir }) {
  if (!lista?.length) return null;
  return (
    <View style={estilos.caixa}>
      <Text style={estilos.titulo}>TOP DA SEMANA ENTRE ESTUDANTES</Text>
      {lista.map((restaurante, i) => {
        const daSemana = descreverIdasDaSemana(restaurante.semana);
        const deHoje = restaurante.hoje > 0 ? `${restaurante.hoje} hoje` : null;
        return (
          <Pressable
            key={restaurante.id}
            onPress={() => aoAbrir(restaurante)}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}.º ${restaurante.nome}, ${daSemana}${deHoje ? `, ${deHoje}` : ''}, a ${formatarDistancia(restaurante.distanciaKm)}`}
            style={({ pressed }) => [estilos.linha, i > 0 && estilos.comLinha, pressed && estilos.premido]}
          >
            <Text style={[estilos.lugar, { color: corDoCalor(0.9 - i * 0.14) }]}>{i + 1}</Text>
            {restaurante.prato ? (
              <ImagemDoPrato prato={{ nome: restaurante.prato.prato, categoria: restaurante.prato.categoria, foto_url: restaurante.prato.foto_url, distancia_km: restaurante.distanciaKm }} tamanho={48} />
            ) : null}
            <View style={estilos.textos}>
              <Text style={estilos.nome} numberOfLines={1}>
                {restaurante.nome}
              </Text>
              <Text style={texto.pequeno} numberOfLines={1}>
                {[daSemana, deHoje, formatarDistancia(restaurante.distanciaKm)].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { borderRadius: raio.xl, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie, paddingHorizontal: espaco.l, paddingVertical: espaco.s },
  titulo: { ...texto.rotulo, paddingVertical: espaco.s },
  // minHeight 56: cada linha é um botão (área de toque mínima de 44, RNF06)
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, minHeight: 56, paddingVertical: espaco.xs },
  comLinha: { borderTopWidth: 1, borderTopColor: cores.linha },
  premido: { opacity: 0.7 },
  lugar: { fontFamily: fontes.grossa, fontSize: 28, width: 24, textAlign: 'center' },
  textos: { flex: 1, gap: 2 },
  nome: { fontFamily: fontes.semi, fontSize: 16, color: cores.texto },
});
