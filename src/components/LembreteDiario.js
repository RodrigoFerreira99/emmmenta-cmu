import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { desligarLembrete, horaParaTexto, LEMBRETES, lerLembrete, ligarLembrete } from '@/lib/lembretes';
import { vibrarLeve } from '@/lib/vibrar';
import { cores, espaco, fontes, raio, texto } from '@/theme';

// Cartão para ligar um lembrete diário e escolher a hora (ver src/lib/lembretes.js).
//
// Propriedades:
//   tipo       'almoco' (Conta do cliente) ou 'publicar' (Perfil do restaurante)
//   titulo     por exemplo "Lembrete do almoço"
//   descricao  o que o lembrete faz, numa frase
export function LembreteDiario({ tipo, titulo, descricao }) {
  const horas = LEMBRETES[tipo].horas;
  const [ligado, setLigado] = useState(false);
  const [escolhida, setEscolhida] = useState(horas[1]); // por omissão, a segunda hora (12h00 ou 10h00)
  const [aMudar, setAMudar] = useState(false);
  const [erro, setErro] = useState(null);

  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Ao abrir: o lembrete já estava ligado? (fica agendado no telemóvel, mesmo com a app fechada)
  useEffect(() => {
    lerLembrete(tipo).then((agendado) => {
      if (!montado.current || !agendado) return;
      setLigado(true);
      setEscolhida(agendado);
    });
  }, [tipo]);

  async function mudar(novoLigado, novaHora) {
    setErro(null);
    vibrarLeve();
    setAMudar(true);
    try {
      if (novoLigado) await ligarLembrete(tipo, novaHora);
      else await desligarLembrete(tipo);
      if (!montado.current) return;
      setLigado(novoLigado);
      setEscolhida(novaHora);
    } catch (falha) {
      if (montado.current) setErro(falha.message);
    } finally {
      if (montado.current) setAMudar(false);
    }
  }

  const mesmaHora = (a, b) => a.hora === b.hora && a.minuto === b.minuto;

  return (
    <View style={estilos.cartao}>
      <View style={estilos.linha}>
        <View style={estilos.ocuparTudo}>
          <Text style={estilos.titulo}>{titulo}</Text>
          <Text style={texto.pequeno}>{ligado ? `Todos os dias às ${horaParaTexto(escolhida)}.` : descricao}</Text>
        </View>
        <Switch
          value={ligado}
          onValueChange={(valor) => mudar(valor, escolhida)}
          disabled={aMudar}
          trackColor={{ false: cores.linha, true: cores.acento }}
          thumbColor={cores.superficie}
          ios_backgroundColor={cores.linha}
          accessibilityLabel={titulo}
        />
      </View>

      {ligado ? (
        <View style={estilos.chips} accessibilityRole="radiogroup">
          {horas.map((hora) => (
            <Chip
              key={horaParaTexto(hora)}
              titulo={horaParaTexto(hora)}
              ativo={mesmaHora(hora, escolhida)}
              onPress={() => (aMudar || mesmaHora(hora, escolhida) ? null : mudar(true, hora))}
            />
          ))}
        </View>
      ) : null}

      {erro ? (
        <Text style={estilos.erro} accessibilityRole="alert">
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: espaco.m,
    padding: espaco.l,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  ocuparTudo: { flex: 1, gap: 2 },
  titulo: { ...texto.corpo, fontFamily: fontes.semi },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s },
  erro: { ...texto.pequeno, color: cores.erro },
});
