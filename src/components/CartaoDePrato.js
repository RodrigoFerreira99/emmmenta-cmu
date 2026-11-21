import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/components/Icone';
import { ImagemDoPrato } from '@/components/ImagemDoPrato';
import { useAgora } from '@/lib/relogio';
import { descreverLotacao, lotacaoAtual, nomeDaCategoria } from '@/services/menus';
import { descreverEtiquetas, formatarDistancia, formatarPreco } from '@/services/pratos';
import { cores, espaco, fontes, raio, texto } from '@/theme';

// RF05 — cartão de um prato na lista "pratos perto de mim": nome, restaurante, distância,
// categoria e preço. Um prato esgotado aparece a cinzento e riscado, com a etiqueta "Esgotado".
// Se o restaurante as tiver posto, aparecem também a fotografia do prato, as etiquetas (Vegano,
// Sem glúten…), o aviso "Últimas doses" e a lotação ("Há mesa" / "Cheio agora", só nos últimos 45 min).
//
// Propriedades:
//   prato     uma linha devolvida por buscarPratosPerto()
//   onPress   função chamada ao tocar (abre a página do restaurante)
//   favorito  true se o restaurante estiver nos favoritos (aparece um coração ao lado do nome)
export function CartaoDePrato({ prato, onPress, favorito = false }) {
  const esgotado = prato.esgotado;
  const ultimasDoses = prato.ultimas_doses && !esgotado;
  const distancia = formatarDistancia(prato.distancia_km);
  const etiquetas = descreverEtiquetas(prato.etiquetas);
  const lotacao = lotacaoAtual(prato, useAgora()); // volta a ser calculada a cada minuto (o aviso só vale 45 min)

  // o que o leitor de ecrã diz (as partes novas vão no fim, para o início ser sempre igual)
  const rotulo = [
    `${prato.prato}, ${prato.restaurante}${favorito ? ' (favorito)' : ''}, a ${distancia}, ${esgotado ? 'esgotado' : formatarPreco(prato.preco)}`,
    ultimasDoses ? 'últimas doses' : null,
    etiquetas || null,
    lotacao ? descreverLotacao(lotacao) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={rotulo} style={({ pressed }) => [estilos.cartao, pressed && estilos.premido]}>
      {/* a fotografia do prato, se o restaurante a tirou; senão, a imagem 3D do tipo de prato */}
      <ImagemDoPrato
        prato={{ nome: prato.prato, categoria: prato.categoria, foto_url: prato.foto_url, esgotado, distancia_km: prato.distancia_km }}
        tamanho={64}
      />

      <View style={estilos.textos}>
        <Text style={[estilos.nome, esgotado && estilos.riscado]} numberOfLines={2}>
          {prato.prato}
        </Text>
        <View style={estilos.linhaDoRestaurante}>
          {favorito ? <Icone name="heart" size={12} color={cores.acento} /> : null}
          <Text style={[texto.pequeno, estilos.encolher]} numberOfLines={1}>
            {prato.restaurante} · {distancia}
            {lotacao ? (
              <Text style={lotacao.valor === 'cheio' ? estilos.cheio : estilos.haMesa}>
                {' · '}
                {lotacao.valor === 'cheio' ? 'Cheio agora' : 'Há mesa'}
              </Text>
            ) : null}
          </Text>
        </View>
        <Text style={estilos.categoria} numberOfLines={1}>
          {[nomeDaCategoria(prato.categoria), etiquetas].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <View style={estilos.direita}>
        <Text style={[estilos.preco, esgotado && estilos.precoEsgotado]}>{formatarPreco(prato.preco)}</Text>
        {esgotado ? <EtiquetaEsgotado /> : null}
        {ultimasDoses ? <EtiquetaUltimasDoses /> : null}
      </View>
    </Pressable>
  );
}

// Etiqueta "Esgotado". Também é usada na página do restaurante (com texto "Sold out" no menu em inglês).
export function EtiquetaEsgotado({ texto: textoDaEtiqueta = 'Esgotado' }) {
  return (
    <View style={estilos.etiqueta}>
      <Text style={estilos.etiquetaTexto}>{textoDaEtiqueta}</Text>
    </View>
  );
}

// Etiqueta "Últimas doses" (laranja): o prato está quase a acabar. Também é usada na página do restaurante.
export function EtiquetaUltimasDoses({ texto: textoDaEtiqueta = 'Últimas doses' }) {
  return (
    <View style={[estilos.etiqueta, estilos.etiquetaUltimas]}>
      <Text style={[estilos.etiquetaTexto, estilos.etiquetaUltimasTexto]}>{textoDaEtiqueta}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingVertical: espaco.s,
    paddingLeft: espaco.s,
    paddingRight: espaco.l,
    minHeight: 80,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  premido: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  textos: { flex: 1, gap: 2 },
  nome: { ...texto.corpo, fontSize: 16, fontFamily: fontes.semi },
  riscado: { color: cores.textoTerciario, textDecorationLine: 'line-through' },
  categoria: { fontSize: 12, color: cores.textoTerciario },
  linhaDoRestaurante: { flexDirection: 'row', alignItems: 'center', gap: espaco.xs },
  encolher: { flexShrink: 1 },
  cheio: { color: cores.erro, fontFamily: fontes.semi },
  haMesa: { color: cores.sucesso, fontFamily: fontes.semi },
  direita: { alignItems: 'flex-end', gap: espaco.xs },
  preco: { fontSize: 15, fontFamily: fontes.monoForte, color: cores.acento },
  precoEsgotado: { color: cores.textoTerciario, textDecorationLine: 'line-through' },
  etiqueta: { paddingHorizontal: espaco.s, paddingVertical: 2, borderRadius: raio.s, backgroundColor: cores.linha },
  etiquetaTexto: { fontSize: 11, fontFamily: fontes.semi, color: cores.textoSecundario },
  etiquetaUltimas: { backgroundColor: cores.acentoSuave },
  etiquetaUltimasTexto: { color: cores.acentoTexto },
});
