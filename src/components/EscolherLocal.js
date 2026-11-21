import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/components/Icone';
import { Botao } from '@/components/ui';
import { usePerto } from '@/context/PertoContext';
import { ZONAS } from '@/lib/zonas';
import { cores, espaco, fontes, raio, texto } from '@/theme';

// RF05 — escolher onde procurar: a localização do telemóvel ou uma zona escolhida à mão.
//
// É aqui que se explica porque se pede a localização, ANTES de aparecer o pedido do sistema (RNF04).
// Quem não quiser dar a localização, ou não tiver GPS, escolhe uma zona da lista (RNF08).
//
// Propriedades:
//   aoEscolher  (opcional) função chamada depois de ficar escolhido um sítio
//   aoCancelar  (opcional) mostra a ligação "Cancelar" (quando já havia um sítio e só se quer mudar)
export function EscolherLocal({ aoEscolher, aoCancelar }) {
  const { local, estadoDoLocal, avisoDoLocal, usarLocalizacao, escolherZona } = usePerto();
  const aLocalizar = estadoDoLocal === 'aLocalizar';

  async function usarAMinhaLocalizacao() {
    // é aqui que aparece o pedido de permissão do sistema, já depois da explicação que está no ecrã
    const conseguiu = await usarLocalizacao();
    if (conseguiu) aoEscolher?.();
  }

  function usarZona(zona) {
    escolherZona(zona);
    aoEscolher?.();
  }

  return (
    <ScrollView contentContainerStyle={estilos.conteudo}>
      <Icone name="location-outline" size={36} color={cores.acento} />
      <Text style={texto.titulo} accessibilityRole="header">
        Onde queres almoçar?
      </Text>
      <Text style={texto.corpo}>
        Para mostrar os pratos do dia perto de ti, a Emmmenta usa a localização do telemóvel, só enquanto a app está
        aberta. A localização não fica guardada em lado nenhum.
      </Text>

      <Botao titulo="Usar a minha localização" icone="navigate-outline" onPress={usarAMinhaLocalizacao} aCarregar={aLocalizar} />
      {avisoDoLocal ? (
        <Text style={estilos.aviso} accessibilityRole="alert">
          {avisoDoLocal}
        </Text>
      ) : null}

      <Text style={[texto.etiqueta, estilos.tituloDaLista]}>Ou escolhe a zona à mão</Text>
      <View style={estilos.lista}>
        {ZONAS.map((zona, indice) => {
          const escolhida = local?.origem === 'zona' && local.nome === zona.nome;
          return (
            <Pressable
              key={zona.id}
              onPress={() => usarZona(zona)}
              disabled={aLocalizar}
              accessibilityRole="button"
              accessibilityLabel={`Procurar em ${zona.nome}`}
              style={({ pressed }) => [estilos.zona, indice > 0 && estilos.zonaComLinha, pressed && estilos.premida]}
            >
              <Text style={[texto.corpo, estilos.ocuparTudo]}>{zona.nome}</Text>
              <Icone name={escolhida ? 'checkmark' : 'chevron-forward'} size={18} color={escolhida ? cores.acento : cores.textoTerciario} />
            </Pressable>
          );
        })}
      </View>

      {aoCancelar ? (
        <Pressable onPress={aoCancelar} accessibilityRole="button" style={estilos.ligacao}>
          <Text style={estilos.ligacaoTexto}>Cancelar</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

// Linha "Perto de: ..." que mostra onde se está a procurar. Tocar nela deixa mudar o sítio.
export function BotaoDoLocal({ onPress }) {
  const { local } = usePerto();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`A procurar perto de ${local.nome}. Mudar o sítio`}
      style={estilos.botaoDoLocal}
    >
      <Icone name={local.origem === 'gps' ? 'navigate' : 'location'} size={16} color={cores.acento} />
      <Text style={estilos.botaoDoLocalTexto} numberOfLines={1}>
        Perto de: {local.nome}
      </Text>
      <Icone name="chevron-down" size={16} color={cores.textoSecundario} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  ocuparTudo: { flex: 1 },
  conteudo: { padding: espaco.xl, gap: espaco.l },
  aviso: { ...texto.pequeno, color: cores.erro },
  tituloDaLista: { marginTop: espaco.s },
  lista: { borderRadius: raio.xl, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie, overflow: 'hidden' },
  // minHeight 48: área de toque confortável (RNF06 pede pelo menos 44)
  zona: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: espaco.l },
  zonaComLinha: { borderTopWidth: 1, borderTopColor: cores.linha },
  premida: { backgroundColor: cores.acentoSuave },
  ligacao: { alignSelf: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: espaco.s },
  ligacaoTexto: { ...texto.pequeno, color: cores.acento, fontFamily: fontes.semi },
  botaoDoLocal: { flexDirection: 'row', alignItems: 'center', gap: espaco.xs, minHeight: 44, alignSelf: 'flex-start' },
  botaoDoLocalTexto: { ...texto.corpo, fontFamily: fontes.semi, flexShrink: 1 },
});
