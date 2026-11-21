import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/components/Icone';
import { useAgora } from '@/lib/relogio';
import { descreverLotacao, LOTACAO_VALIDA_MINUTOS, lotacaoAtual } from '@/services/menus';
import { cores, espaco, fontes, raio, texto } from '@/theme';

// "Há mesa" / "Cheio agora" — o restaurante diz como está a sala e os clientes veem em tempo real.
// O aviso só vale 45 minutos (lotacaoAtual): depois disso desaparece sozinho, para não enganar ninguém.
// useAgora() faz estes componentes voltarem a desenhar-se uma vez por minuto, por isso o "há 12 min"
// avança e o aviso desaparece mesmo com o ecrã aberto.

/**
 * Para os clientes (página do restaurante, cartões da lista): uma etiqueta verde ou vermelha.
 * Não mostra nada se o restaurante não disse nada ou se o aviso já tem mais de 45 minutos.
 *   menu      { lotacao, lotacao_em } (um menu, ou uma linha de pratos_perto)
 *   emIngles  true no menu em inglês
 */
export function EtiquetaDeLotacao({ menu, emIngles = false }) {
  const atual = lotacaoAtual(menu, useAgora());
  if (!atual) return null;
  const cheio = atual.valor === 'cheio';
  const frase = descreverLotacao(atual, { emIngles });
  return (
    <View style={[estilos.etiqueta, cheio ? estilos.etiquetaCheio : estilos.etiquetaComMesa]} accessible accessibilityLabel={frase}>
      <View style={[estilos.bolinha, { backgroundColor: cheio ? cores.erro : cores.sucesso }]} />
      <Text style={[estilos.etiquetaTexto, { color: cheio ? cores.erro : cores.sucesso }]}>{frase}</Text>
    </View>
  );
}

/**
 * Para o restaurante (Painel): dois botões, "Há mesa" e "Cheio". Tocar no que está escolhido apaga o aviso.
 *   menu        o menu de hoje ({ lotacao, lotacao_em })
 *   aoEscolher  função chamada com 'ha-mesa', 'cheio' ou null
 *   aGravar     true enquanto a escolha está a ser gravada (os botões ficam bloqueados)
 */
export function EscolherLotacao({ menu, aoEscolher, aGravar = false }) {
  const atual = lotacaoAtual(menu, useAgora());
  const explicacao = atual
    ? `Os clientes veem: ${descreverLotacao(atual)}. Desaparece sozinho ao fim de ${LOTACAO_VALIDA_MINUTOS} minutos.`
    : `Diz aos clientes se há mesa. O aviso desaparece sozinho ao fim de ${LOTACAO_VALIDA_MINUTOS} minutos.`;

  return (
    <View style={estilos.cartao}>
      <Text style={estilos.titulo} accessibilityRole="header">
        Como está a sala agora?
      </Text>
      <Text style={texto.pequeno}>{explicacao}</Text>
      <View style={estilos.botoes}>
        <BotaoDaLotacao
          titulo="Há mesa"
          icone="checkmark-circle-outline"
          corEscolhida={cores.sucesso}
          escolhido={atual?.valor === 'ha-mesa'}
          desativado={aGravar}
          onPress={() => aoEscolher(atual?.valor === 'ha-mesa' ? null : 'ha-mesa')}
        />
        <BotaoDaLotacao
          titulo="Cheio"
          icone="people-outline"
          corEscolhida={cores.erro}
          escolhido={atual?.valor === 'cheio'}
          desativado={aGravar}
          onPress={() => aoEscolher(atual?.valor === 'cheio' ? null : 'cheio')}
        />
      </View>
    </View>
  );
}

function BotaoDaLotacao({ titulo, icone, corEscolhida, escolhido, desativado, onPress }) {
  const corDoTexto = escolhido ? cores.textoInverso : cores.texto;
  return (
    <Pressable
      onPress={onPress}
      disabled={desativado}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ selected: escolhido, disabled: desativado }}
      style={({ pressed }) => [
        estilos.botao,
        escolhido && { backgroundColor: corEscolhida, borderColor: corEscolhida },
        (pressed || desativado) && estilos.premido,
      ]}
    >
      <Icone name={icone} size={18} color={corDoTexto} />
      <Text style={[estilos.botaoTexto, { color: corDoTexto }]}>{titulo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  etiqueta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.xs,
    paddingHorizontal: espaco.s,
    paddingVertical: 3,
    borderRadius: raio.pilula,
  },
  etiquetaCheio: { backgroundColor: cores.erroSuave },
  etiquetaComMesa: { backgroundColor: cores.sucessoSuave },
  bolinha: { width: 8, height: 8, borderRadius: raio.pilula },
  etiquetaTexto: { fontSize: 12, fontFamily: fontes.negrito },
  cartao: {
    gap: espaco.s,
    padding: espaco.l,
    borderRadius: raio.l,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  titulo: { ...texto.corpo, fontFamily: fontes.semi },
  botoes: { flexDirection: 'row', gap: espaco.m, paddingTop: espaco.xs },
  // minHeight 48: área de toque confortável (RNF06)
  botao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.s,
    minHeight: 48,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  botaoTexto: { fontSize: 15, fontFamily: fontes.semi },
  premido: { opacity: 0.6 },
});
