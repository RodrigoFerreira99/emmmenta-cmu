import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/components/ui';
import { vibrarSelecao, vibrarSucesso } from '@/lib/vibrar';
import { escolherAoAcaso, formatarDistancia, formatarPreco, pratosParaSortear } from '@/services/pratos';
import { cores, espaco, raio, texto } from '@/theme';

// "Abana para decidir": não sabes o que almoçar? A app baralha os pratos perto de ti durante pouco
// mais de um segundo (como uma roleta) e escolhe um. Abre-se com o botão "Escolhe por mim" ou
// abanando o telemóvel no Início (src/lib/abanar.js).
//
// Propriedades:
//   pratos              os pratos da lista do Início (os mesmos filtros: só escolhe entre o que lá está)
//   aoAbrirRestaurante  função chamada com o prato escolhido, para abrir a página do restaurante
//   aoFechar            função chamada para fechar
//
// Uso:  {aberto ? <AbanaParaDecidir ... /> : null}  — cada vez que abre, começa um sorteio novo.

export const DURACAO_DO_SORTEIO_MS = 1300;
const PASSO_DO_SORTEIO_MS = 90;

export function AbanaParaDecidir({ pratos, aoAbrirRestaurante, aoFechar }) {
  // "Outra vez" volta a montar o sorteio (key nova), que começa do zero
  const [rodada, setRodada] = useState(0);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={aoFechar}>
      <View style={estilos.fundo}>
        <View style={estilos.cartao}>
          <Sorteio
            key={rodada}
            pratos={pratos}
            aoAbrirRestaurante={aoAbrirRestaurante}
            aoRepetir={() => setRodada((n) => n + 1)}
            aoFechar={aoFechar}
          />
        </View>
      </View>
    </Modal>
  );
}

function Sorteio({ pratos, aoAbrirRestaurante, aoRepetir, aoFechar }) {
  const candidatos = useMemo(() => pratosParaSortear(pratos), [pratos]);
  const [mostrado, setMostrado] = useState(() => candidatos[0] ?? null); // o prato que está a passar no ecrã
  const [escolhido, setEscolhido] = useState(null); // o prato final (null enquanto baralha)

  useEffect(() => {
    if (candidatos.length === 0) return;
    let passos = 0;
    // de 90 em 90 ms mostra um prato diferente, como uma roleta…
    const roleta = setInterval(() => {
      passos += 1;
      setMostrado(candidatos[Math.floor(Math.random() * candidatos.length)]);
      if (passos % 3 === 0) vibrarSelecao();
    }, PASSO_DO_SORTEIO_MS);
    // …e ao fim de 1,3 s pára no prato escolhido
    const fim = setTimeout(() => {
      clearInterval(roleta);
      const final = escolherAoAcaso(candidatos);
      setMostrado(final);
      setEscolhido(final);
      vibrarSucesso();
    }, DURACAO_DO_SORTEIO_MS);
    return () => {
      clearInterval(roleta);
      clearTimeout(fim);
    };
  }, [candidatos]);

  if (candidatos.length === 0) {
    return (
      <>
        <Ionicons name="sad-outline" size={36} color={cores.textoTerciario} style={estilos.icone} />
        <Text style={[texto.corpo, estilos.centro]}>Não há pratos disponíveis para escolher. Experimenta aumentar a distância nos filtros.</Text>
        <Botao tipo="secundario" titulo="Fechar" onPress={aoFechar} />
      </>
    );
  }

  return (
    <>
      <Ionicons name={escolhido ? 'sparkles' : 'dice-outline'} size={36} color={cores.acento} style={estilos.icone} />
      <Text style={[texto.etiqueta, estilos.centro]} accessibilityLiveRegion="polite">
        {escolhido ? 'Hoje almoças…' : 'A escolher por ti…'}
      </Text>

      <View style={[estilos.prato, escolhido && estilos.pratoEscolhido]} accessible accessibilityLabel={escolhido ? descrever(escolhido) : 'A escolher'}>
        <Text style={estilos.nome} numberOfLines={2}>
          {mostrado.prato}
        </Text>
        <Text style={[texto.pequeno, estilos.centro]} numberOfLines={1}>
          {mostrado.restaurante} · {formatarDistancia(mostrado.distancia_km)}
        </Text>
        <Text style={estilos.preco}>{formatarPreco(mostrado.preco)}</Text>
      </View>

      {escolhido ? (
        <>
          <Botao titulo="Ver o restaurante" icone="restaurant-outline" onPress={() => aoAbrirRestaurante(escolhido)} />
          <View style={estilos.linha}>
            <Pressable onPress={aoRepetir} accessibilityRole="button" style={estilos.ligacao}>
              <Text style={estilos.ligacaoTexto}>Outra vez</Text>
            </Pressable>
            <Pressable onPress={aoFechar} accessibilityRole="button" style={estilos.ligacao}>
              <Text style={[estilos.ligacaoTexto, estilos.ligacaoNeutra]}>Fechar</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </>
  );
}

// o que o leitor de ecrã diz do prato escolhido
const descrever = (prato) =>
  `Hoje almoças: ${prato.prato}, ${prato.restaurante}, a ${formatarDistancia(prato.distancia_km)}, ${formatarPreco(prato.preco)}`;

const estilos = StyleSheet.create({
  // fundo escuro meio transparente por trás do cartão ("99" = 60% de opacidade)
  fundo: { flex: 1, justifyContent: 'center', padding: espaco.xl, backgroundColor: `${cores.texto}99` },
  cartao: { gap: espaco.m, padding: espaco.xl, borderRadius: raio.xl, backgroundColor: cores.superficie },
  icone: { alignSelf: 'center' },
  centro: { textAlign: 'center' },
  prato: {
    alignItems: 'center',
    gap: espaco.xs,
    paddingVertical: espaco.l,
    paddingHorizontal: espaco.m,
    borderRadius: raio.l,
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: cores.fundo,
  },
  pratoEscolhido: { borderColor: cores.acento, backgroundColor: cores.acentoSuave },
  nome: { fontSize: 20, fontWeight: '700', color: cores.texto, textAlign: 'center' },
  preco: { fontSize: 18, fontWeight: '700', color: cores.acento },
  linha: { flexDirection: 'row', justifyContent: 'center', gap: espaco.xl },
  // minHeight 44: área de toque mínima (RNF06)
  ligacao: { minHeight: 44, justifyContent: 'center', paddingHorizontal: espaco.s },
  ligacaoTexto: { ...texto.corpo, fontWeight: '600', color: cores.acento },
  ligacaoNeutra: { color: cores.textoSecundario },
});
