import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { CameraNaApp } from '@/components/CameraNaApp';
import { Botao } from '@/components/ui';
import { escolherDaGaleria, pedirAcessoACamara } from '@/lib/fotografias';
import { lerMenuDaFoto } from '@/services/lerMenu';
import { cores, espaco, raio, texto } from '@/theme';

// Cartão "Tens o menu escrito num quadro ou numa folha?" do ecrã Publicar menu.
// O dono fotografa o menu e a app preenche os pratos por ele (RNF06: publicar em menos de 1 minuto).
//
// Propriedades:
//   aoLer  função chamada com o resultado da leitura, { pratos, precoMenuCompleto }.
//          Devolve a frase a mostrar por baixo dos botões (por exemplo "Foram lidos 6 pratos...").
//
// Este componente só obtém a fotografia (câmara dentro da app ou galeria) e chama o serviço
// (lerMenuDaFoto). Quem decide o que fazer com os pratos lidos é o ecrã.
export function LerMenuDaFoto({ aoLer }) {
  const [cameraAberta, setCameraAberta] = useState(false);
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

  function mostrarErro(mensagem) {
    setCorreuMal(true);
    setAviso(mensagem);
  }

  // Envia a fotografia para ser lida e mostra o resultado.
  async function ler(caminho) {
    setALer(true);
    try {
      const resultado = await lerMenuDaFoto(caminho);
      if (!montado.current) return;
      setCorreuMal(false);
      setAviso(aoLer(resultado));
    } catch (erro) {
      // RNF08: se a leitura falhar, a app continua a funcionar — os pratos escrevem-se à mão
      if (montado.current) mostrarErro(erro.message);
    } finally {
      if (montado.current) setALer(false);
    }
  }

  // "Fotografar": pede a permissão e abre a câmara dentro da app.
  async function fotografar() {
    if (aLer) return;
    setAviso(null);
    try {
      await pedirAcessoACamara();
      if (montado.current) setCameraAberta(true);
    } catch (erro) {
      if (montado.current) mostrarErro(erro.message);
    }
  }

  // "Galeria": escolher uma fotografia que já esteja no telemóvel.
  async function daGaleria() {
    if (aLer) return;
    setAviso(null);
    try {
      const caminho = await escolherDaGaleria();
      if (caminho && montado.current) await ler(caminho); // null = a pessoa desistiu de escolher
    } catch (erro) {
      if (montado.current) mostrarErro(erro.message);
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
            <Botao tipo="secundario" icone="camera-outline" titulo="Fotografar" onPress={fotografar} />
          </View>
          <View style={estilos.ocuparTudo}>
            <Botao tipo="secundario" icone="images-outline" titulo="Galeria" onPress={daGaleria} />
          </View>
        </View>
      )}

      {aviso ? (
        <Text style={correuMal ? estilos.erro : estilos.sucesso} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}

      {cameraAberta ? (
        <CameraNaApp
          dica="Enquadra o menu todo, com boa luz"
          aoTirar={(caminho) => {
            setCameraAberta(false);
            ler(caminho);
          }}
          aoFechar={() => setCameraAberta(false)}
        />
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
