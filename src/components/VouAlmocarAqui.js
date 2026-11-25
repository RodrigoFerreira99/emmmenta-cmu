import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/components/Icone';
import { vibrarSucesso } from '@/lib/vibrar';
import { buscarMinhaIdaDeHoje, buscarPopularidade, descreverIdasDaSemana, descreverIdasDeHoje, desmarcarIda, marcarIda } from '@/services/idas';
import { cores, espaco, fontes, raio } from '@/theme';

// "Vou almoçar aqui" (ranking dos estudantes): na página do restaurante, o estudante diz que vai lá
// almoçar hoje e vê quantos vão (hoje e na última semana). Um restaurante por dia: marcar outro muda a ida.
// Tocar outra vez desmarca. A app nunca mostra quem vai, só quantos (src/services/idas.js).
//
// Propriedades: restauranteId.
export function VouAlmocarAqui({ restauranteId }) {
  const [contas, setContas] = useState({ hoje: 0, semana: 0 });
  const [minhaIda, setMinhaIda] = useState(null); // id do restaurante onde vou hoje (ou null)
  const [aGuardar, setAGuardar] = useState(false);
  const [aviso, setAviso] = useState(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    Promise.all([buscarPopularidade([restauranteId]), buscarMinhaIdaDeHoje()])
      .then(([popularidade, ida]) => {
        if (!montado.current) return;
        setContas(popularidade.get(restauranteId) ?? { hoje: 0, semana: 0 });
        setMinhaIda(ida);
      })
      .catch(() => {
        // sem os números, o botão continua a funcionar
      });
    return () => {
      montado.current = false;
    };
  }, [restauranteId]);

  const vou = minhaIda === restauranteId;

  async function alternar() {
    setAviso(null);
    setAGuardar(true);
    // muda já no ecrã (fica mais rápido); se a base de dados recusar, volta atrás
    const antes = { contas, minhaIda };
    setMinhaIda(vou ? null : restauranteId);
    setContas((atuais) => ({ hoje: Math.max(0, atuais.hoje + (vou ? -1 : 1)), semana: Math.max(0, atuais.semana + (vou ? -1 : 1)) }));
    try {
      if (vou) await desmarcarIda();
      else {
        await marcarIda(restauranteId);
        vibrarSucesso();
      }
    } catch (erro) {
      if (montado.current) {
        setMinhaIda(antes.minhaIda);
        setContas(antes.contas);
        setAviso(erro.message);
      }
    } finally {
      if (montado.current) setAGuardar(false);
    }
  }

  const textoDeHoje = descreverIdasDeHoje(contas.hoje);
  const textoDaSemana = descreverIdasDaSemana(contas.semana);

  return (
    <View style={estilos.caixa}>
      <View style={estilos.contas} accessible accessibilityLabel={[textoDeHoje, textoDaSemana].filter(Boolean).join(', ') || 'Ainda ninguém disse que vem cá almoçar hoje'}>
        <Icone name="calor" size={18} color={contas.hoje > 0 ? cores.acento : cores.textoTerciario} />
        <Text style={estilos.contasTexto}>
          {textoDeHoje ?? 'Ainda ninguém disse que vem cá almoçar hoje'}
          {textoDaSemana ? <Text style={estilos.semana}>{`  ·  ${textoDaSemana}`}</Text> : null}
        </Text>
      </View>
      <Pressable
        onPress={alternar}
        disabled={aGuardar}
        accessibilityRole="button"
        accessibilityState={{ selected: vou, busy: aGuardar }}
        accessibilityLabel={vou ? 'Vais almoçar aqui hoje. Tocar para desmarcar' : 'Vou almoçar aqui hoje'}
        style={({ pressed }) => [estilos.botao, vou && estilos.botaoMarcado, pressed && estilos.premido]}
      >
        {aGuardar ? (
          <ActivityIndicator color={vou ? cores.textoInverso : cores.acento} />
        ) : (
          <>
            <Icone name={vou ? 'checkmark-circle' : 'walk-outline'} size={20} color={vou ? cores.textoInverso : cores.acento} />
            <Text style={[estilos.botaoTexto, vou && estilos.botaoTextoMarcado]}>{vou ? 'Vais almoçar aqui hoje' : 'Vou almoçar aqui'}</Text>
          </>
        )}
      </Pressable>
      {minhaIda && !vou ? <Text style={estilos.nota}>Hoje já disseste que ias a outro sítio: se tocares, mudas para aqui.</Text> : null}
      {aviso ? (
        <Text style={estilos.aviso} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { gap: espaco.s },
  contas: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
  contasTexto: { flex: 1, fontFamily: fontes.semi, fontSize: 14, color: cores.texto },
  semana: { fontFamily: fontes.normal, color: cores.textoSecundario },
  // minHeight 48: área de toque confortável (RNF06)
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.s,
    minHeight: 48,
    borderRadius: raio.l,
    borderWidth: 1.5,
    borderColor: cores.acento,
    backgroundColor: cores.acentoSuave,
  },
  botaoMarcado: { backgroundColor: cores.acento },
  premido: { opacity: 0.8 },
  botaoTexto: { fontFamily: fontes.semi, fontSize: 16, color: cores.texto },
  botaoTextoMarcado: { color: cores.textoInverso },
  nota: { fontFamily: fontes.normal, fontSize: 12, color: cores.textoSecundario },
  aviso: { fontFamily: fontes.normal, fontSize: 13, color: cores.erro },
});
