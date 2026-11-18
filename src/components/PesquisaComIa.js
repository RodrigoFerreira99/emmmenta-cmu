import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { vibrarLeve } from '@/lib/vibrar';
import { descreverFiltros, interpretarPesquisa } from '@/services/assistente';
import { cores, espaco, raio, texto } from '@/theme';

// Pesquisa por frase (com IA): o cliente escreve — ou dita, com o microfone do teclado — o que lhe
// apetece ("peixe até 8 € aqui perto") e a app põe os filtros sozinha. Mostra sempre o que percebeu,
// para o cliente confirmar. Se a IA não responder, as regras simples do telemóvel tentam perceber.
//
// Propriedades:
//   aoAplicar  função chamada com os filtros percebidos ({ categoria, etiqueta, precoMax, raioKm, pesquisa })
export function PesquisaComIa({ aoAplicar }) {
  const [frase, setFrase] = useState('');
  const [aPensar, setAPensar] = useState(false);
  const [percebido, setPercebido] = useState(null); // { descricao, comIa }
  const [erro, setErro] = useState(null);

  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  async function procurar() {
    if (aPensar) return;
    Keyboard.dismiss();
    setErro(null);
    setPercebido(null);
    setAPensar(true);
    try {
      const { filtros, comIa } = await interpretarPesquisa(frase);
      if (!montado.current) return;
      aoAplicar(filtros);
      vibrarLeve();
      setPercebido({ descricao: descreverFiltros(filtros), comIa });
    } catch (falha) {
      if (montado.current) setErro(falha.message);
    } finally {
      if (montado.current) setAPensar(false);
    }
  }

  return (
    <View style={estilos.painel}>
      <View style={estilos.cabecalho}>
        <Ionicons name="sparkles" size={16} color={cores.acento} />
        <Text style={texto.etiqueta}>Diz o que te apetece</Text>
      </View>

      <View style={estilos.linha}>
        <TextInput
          value={frase}
          onChangeText={setFrase}
          placeholder="Ex.: peixe até 8 € aqui perto"
          placeholderTextColor={cores.textoTerciario}
          accessibilityLabel="Diz o que te apetece"
          returnKeyType="search"
          onSubmitEditing={procurar}
          maxLength={200}
          style={estilos.campo}
        />
        <Pressable
          onPress={procurar}
          disabled={aPensar}
          accessibilityRole="button"
          accessibilityLabel="Procurar com o assistente"
          accessibilityState={{ busy: aPensar }}
          style={({ pressed }) => [estilos.botao, pressed && estilos.premido]}
        >
          {aPensar ? <ActivityIndicator color={cores.textoInverso} /> : <Ionicons name="arrow-forward" size={20} color={cores.textoInverso} />}
        </Pressable>
      </View>

      {percebido ? (
        <Text style={estilos.percebido} accessibilityRole="alert">
          Percebi: {percebido.descricao}
          {percebido.comIa ? '' : ' (sem IA)'}
        </Text>
      ) : null}
      {erro ? (
        <Text style={estilos.erro} accessibilityRole="alert">
          {erro}
        </Text>
      ) : null}
      <Text style={estilos.nota}>Usa inteligência artificial (Groq): o que escreves aqui é enviado só para perceber o pedido.</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  painel: {
    gap: espaco.s,
    padding: espaco.l,
    borderRadius: raio.xl,
    borderWidth: 1.5,
    borderColor: cores.acento,
    backgroundColor: cores.superficie,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco.xs },
  linha: { flexDirection: 'row', gap: espaco.s },
  campo: {
    flex: 1,
    height: 48,
    paddingHorizontal: espaco.m,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.linha,
    fontSize: 16,
    color: cores.texto,
  },
  // 48 x 48: área de toque confortável (RNF06)
  botao: { width: 48, height: 48, borderRadius: raio.m, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.acento },
  premido: { opacity: 0.7 },
  percebido: { ...texto.pequeno, color: cores.sucesso, fontWeight: '600' },
  erro: { ...texto.pequeno, color: cores.erro },
  nota: { fontSize: 12, color: cores.textoSecundario },
});
