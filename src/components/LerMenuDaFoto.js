import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/components/ui';
import { escolherImagem } from '@/lib/fotografias';
import { lerMenuDaFoto } from '@/services/lerMenu';
import { cores, espaco, raio, texto } from '@/theme';

// Cartão "Tens o menu escrito num quadro ou numa folha?" do ecrã Publicar menu.
// O dono fotografa o menu e a app preenche os pratos por ele (RNF06: publicar em menos de 1 minuto).
//
// Propriedades:
//   aoLer  função chamada com o resultado da leitura, { pratos, precoMenuCompleto }.
//          Devolve a frase a mostrar por baixo dos botões (por exemplo "Foram lidos 6 pratos...").
//
// Este componente só obtém a fotografia e chama o serviço (lerMenuDaFoto).
// Quem decide o que fazer com os pratos lidos é o ecrã.
export function LerMenuDaFoto({ aoLer }) {
  const [aLer, setALer] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [correuMal, setCorreuMal] = useState(false);

  // Fica a false quando o componente sai do ecrã, para não mexer no estado depois de um "await".
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // origem: 'camara' ou 'galeria'
  async function ler(origem) {
    if (aLer) return;
    setAviso(null);
    try {
      const caminho = await escolherImagem(origem);
      if (!caminho || !montado.current) return; // a pessoa desistiu de escolher a fotografia

      setALer(true);
      const resultado = await lerMenuDaFoto(caminho);
      if (!montado.current) return;
      setCorreuMal(false);
      setAviso(aoLer(resultado));
    } catch (erro) {
      // RNF08: se a leitura falhar, a app continua a funcionar — os pratos escrevem-se à mão
      if (montado.current) {
        setCorreuMal(true);
        setAviso(erro.message);
      }
    } finally {
      if (montado.current) setALer(false);
    }
  }

  return (
    <View style={estilos.cartao}>
      <View style={estilos.cabecalho}>
        <Ionicons name="sparkles-outline" size={20} color={cores.acento} />
        <Text style={[texto.subtitulo, estilos.ocuparTudo]}>Tens o menu num quadro ou numa folha?</Text>
      </View>
      <Text style={texto.pequeno}>
        Tira-lhe uma fotografia e a app escreve os pratos por ti. Confirmas tudo antes de publicar.
      </Text>

      {aLer ? (
        <View style={estilos.aLer} accessibilityRole="progressbar" accessibilityLabel="A ler o menu">
          <ActivityIndicator color={cores.acento} />
          <Text style={texto.pequeno}>A ler o menu… pode demorar uns segundos.</Text>
        </View>
      ) : (
        <View style={estilos.botoes}>
          <View style={estilos.ocuparTudo}>
            <Botao tipo="secundario" icone="camera-outline" titulo="Fotografar" onPress={() => ler('camara')} />
          </View>
          <View style={estilos.ocuparTudo}>
            <Botao tipo="secundario" icone="images-outline" titulo="Galeria" onPress={() => ler('galeria')} />
          </View>
        </View>
      )}

      {aviso ? (
        <Text style={correuMal ? estilos.erro : estilos.sucesso} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  ocuparTudo: { flex: 1 },
  cartao: {
    gap: espaco.m,
    padding: espaco.l,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
  botoes: { flexDirection: 'row', gap: espaco.m },
  // a mesma altura dos botões, para o cartão não "saltar" quando começa a ler
  aLer: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, minHeight: 52 },
  erro: { ...texto.pequeno, color: cores.erro },
  sucesso: { ...texto.pequeno, color: cores.sucesso },
});
