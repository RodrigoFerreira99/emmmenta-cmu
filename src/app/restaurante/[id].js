import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EtiquetaEsgotado } from '@/components/CartaoDePrato';
import { EcraDeErro } from '@/components/EcraDeErro';
import { Botao, Carregar, Ecra } from '@/components/ui';
import { useFavoritos } from '@/lib/favoritos';
import { abrirDirecoes, ligar } from '@/lib/ligacoes';
import { buscarMenuDeHoje, nomeDaCategoria } from '@/services/menus';
import { formatarDistancia, formatarPreco, ouvirAlteracoesPratos } from '@/services/pratos';
import { buscarRestaurante, estadoDoHorario, horaParaEcra, telefoneParaEcra } from '@/services/restaurantes';
import { cores, espaco, raio, texto } from '@/theme';

// Ecrã 4 · Página do restaurante (RF06) — responsável: André
// Abre-se a partir da lista ou do mapa, com o id do restaurante no endereço e a distância como parâmetro.
//
// Mostra a fotografia, o nome, o tipo de cozinha, o horário e a morada, os botões Ligar e Direções
// e o menu de hoje. Os pratos esgotados aparecem riscados e mudam em tempo real (RF04).
export default function PaginaRestaurante() {
  const { id, distancia } = useLocalSearchParams();

  const [estado, setEstado] = useState('aCarregar'); // 'aCarregar' | 'erro' | 'naoExiste' | 'pronto'
  const [erroAoCarregar, setErroAoCarregar] = useState(null);
  const [tentativa, setTentativa] = useState(0); // aumenta quando se carrega em "Tentar outra vez"
  const [restaurante, setRestaurante] = useState(null);
  const [menu, setMenu] = useState(null); // null = hoje ainda não publicou
  const [aviso, setAviso] = useState(null); // quando Ligar, Direções ou os favoritos não resultam
  const { eFavorito, alternarFavorito } = useFavoritos();

  // 1) Ler o restaurante e, se existir, o menu de hoje.
  useEffect(() => {
    let ativo = true; // se o ecrã for fechado a meio, a resposta é ignorada

    async function carregar() {
      try {
        const dadosDoRestaurante = await buscarRestaurante(id);
        if (!ativo) return;
        if (!dadosDoRestaurante) {
          setEstado('naoExiste');
          return;
        }
        const menuDeHoje = await buscarMenuDeHoje(dadosDoRestaurante.id);
        if (!ativo) return;
        setRestaurante(dadosDoRestaurante);
        setMenu(menuDeHoje);
        setEstado('pronto');
      } catch (erro) {
        if (!ativo) return;
        setErroAoCarregar(erro.message);
        setEstado('erro');
      }
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, [id, tentativa]);

  // 2) RF04: ouvir os pratos deste menu. Quando o restaurante marca um prato como esgotado, muda aqui logo.
  const menuId = menu?.id ?? null;
  useEffect(() => {
    if (!menuId) return;
    return ouvirAlteracoesPratos(
      (alterado) => {
        setMenu((atual) =>
          atual ? { ...atual, pratos: atual.pratos.map((prato) => (prato.id === alterado.id ? { ...prato, ...alterado } : prato)) } : atual
        );
      },
      { menuId }
    );
  }, [menuId]);

  function tentarOutraVez() {
    setEstado('aCarregar');
    setTentativa((n) => n + 1);
  }

  // Os botões abrem outra app (telefone ou mapas). Se não for possível, explica-se em vez de não acontecer nada.
  async function abrirOutraApp(acao) {
    setAviso(null);
    try {
      await acao();
    } catch (erro) {
      setAviso(erro.message);
    }
  }

  // Coração: guardar ou tirar dos favoritos (ficam só neste telemóvel — src/lib/favoritos.js).
  async function mudarFavorito() {
    setAviso(null);
    try {
      await alternarFavorito(restaurante.id);
    } catch (erro) {
      setAviso(erro.message);
    }
  }

  if (estado === 'aCarregar') return <Carregar />;
  if (estado === 'erro') return <EcraDeErro mensagem={erroAoCarregar} aoTentar={tentarOutraVez} />;
  if (estado === 'naoExiste') {
    return (
      <Ecra bordas={['bottom']}>
        <View style={estilos.centro}>
          <Ionicons name="storefront-outline" size={40} color={cores.textoTerciario} style={estilos.iconeCentro} />
          <Text style={[texto.corpo, estilos.textoCentro]}>Este restaurante já não está disponível.</Text>
        </View>
      </Ecra>
    );
  }

  const horario =
    restaurante.hora_abertura && restaurante.hora_fecho
      ? `${horaParaEcra(restaurante.hora_abertura)} – ${horaParaEcra(restaurante.hora_fecho)}`
      : null;
  // a distância vem do ecrã anterior; se a página for aberta de outra maneira, simplesmente não aparece
  const distanciaKm = Number(distancia);
  const subtitulo = [restaurante.tipo_cozinha, Number.isFinite(distanciaKm) && distancia ? `a ${formatarDistancia(distanciaKm)}` : null]
    .filter(Boolean)
    .join(' · ');
  const pratos = menu?.pratos ?? [];
  const agora = estadoDoHorario(restaurante.hora_abertura, restaurante.hora_fecho);
  const favorito = eFavorito(restaurante.id);

  return (
    <Ecra bordas={['bottom']}>
      {/* o nome do restaurante passa para a barra do cabeçalho */}
      <Stack.Screen options={{ title: restaurante.nome }} />

      <ScrollView contentContainerStyle={estilos.conteudo}>
        {restaurante.foto_url ? (
          <Image source={{ uri: restaurante.foto_url }} style={estilos.foto} accessibilityLabel={`Fotografia de ${restaurante.nome}`} />
        ) : (
          <View style={[estilos.foto, estilos.semFoto]}>
            <Ionicons name="storefront-outline" size={48} color={cores.acento} />
          </View>
        )}

        <View style={estilos.linhaDoTitulo}>
          <View style={[estilos.grupo, estilos.ocuparTudo]}>
            <Text style={texto.titulo} accessibilityRole="header">
              {restaurante.nome}
            </Text>
            {subtitulo ? <Text style={texto.pequeno}>{subtitulo}</Text> : null}
          </View>
          <Pressable
            onPress={mudarFavorito}
            accessibilityRole="button"
            accessibilityLabel={favorito ? 'Tirar dos favoritos' : 'Guardar nos favoritos'}
            accessibilityState={{ selected: favorito }}
            style={estilos.coracao}
          >
            <Ionicons name={favorito ? 'heart' : 'heart-outline'} size={26} color={cores.acento} />
          </Pressable>
        </View>

        <View style={estilos.cartao}>
          {horario ? <Linha icone="time-outline" titulo="Horário de almoço" valor={horario} nota={agora?.texto} notaBoa={agora?.aberto} /> : null}
          <Linha icone="location-outline" titulo="Morada" valor={restaurante.morada} />
          {restaurante.telefone ? <Linha icone="call-outline" titulo="Telefone" valor={telefoneParaEcra(restaurante.telefone)} /> : null}
        </View>

        <View style={estilos.botoes}>
          {restaurante.telefone ? (
            <View style={estilos.ocuparTudo}>
              <Botao tipo="secundario" icone="call-outline" titulo="Ligar" onPress={() => abrirOutraApp(() => ligar(restaurante.telefone))} />
            </View>
          ) : null}
          <View style={estilos.ocuparTudo}>
            <Botao icone="navigate-outline" titulo="Direções" onPress={() => abrirOutraApp(() => abrirDirecoes(restaurante))} />
          </View>
        </View>
        {aviso ? (
          <Text style={estilos.aviso} accessibilityRole="alert">
            {aviso}
          </Text>
        ) : null}

        <Text style={texto.subtitulo} accessibilityRole="header">
          Menu de hoje
        </Text>

        {pratos.length === 0 ? (
          <Text style={texto.pequeno}>Este restaurante ainda não publicou o menu de hoje.</Text>
        ) : (
          <View style={estilos.lista}>
            {pratos.map((prato, indice) => (
              <View
                key={prato.id}
                style={[estilos.prato, indice > 0 && estilos.pratoComLinha]}
                accessible
                accessibilityLabel={`${prato.nome}, ${nomeDaCategoria(prato.categoria)}, ${prato.esgotado ? 'esgotado' : formatarPreco(prato.preco)}`}
              >
                <View style={estilos.ocuparTudo}>
                  <Text style={[estilos.pratoNome, prato.esgotado && estilos.riscado]}>{prato.nome}</Text>
                  <Text style={estilos.pratoCategoria}>{nomeDaCategoria(prato.categoria)}</Text>
                </View>
                {prato.esgotado ? <EtiquetaEsgotado /> : null}
                <Text style={[estilos.pratoPreco, prato.esgotado && estilos.riscado]}>{formatarPreco(prato.preco)}</Text>
              </View>
            ))}
          </View>
        )}

        {menu?.preco_menu_completo ? (
          <Text style={texto.corpo}>
            Menu completo: <Text style={estilos.destaque}>{formatarPreco(menu.preco_menu_completo)}</Text>
          </Text>
        ) : null}
      </ScrollView>
    </Ecra>
  );
}

// Uma linha de informação: ícone, título pequeno e valor. "nota" aparece por baixo, a verde se "notaBoa".
function Linha({ icone, titulo, valor, nota, notaBoa = false }) {
  return (
    <View style={estilos.linha}>
      <Ionicons name={icone} size={20} color={cores.acento} />
      <View style={estilos.ocuparTudo}>
        <Text style={estilos.linhaTitulo}>{titulo}</Text>
        <Text style={texto.corpo}>{valor}</Text>
        {nota ? <Text style={[estilos.nota, notaBoa && estilos.notaBoa]}>{nota}</Text> : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  ocuparTudo: { flex: 1 },
  conteudo: { padding: espaco.xl, gap: espaco.l },
  centro: { flex: 1, justifyContent: 'center', padding: espaco.xl, gap: espaco.l },
  iconeCentro: { alignSelf: 'center' },
  textoCentro: { textAlign: 'center' },
  grupo: { gap: espaco.xs },
  foto: { width: '100%', height: 180, borderRadius: raio.xl, backgroundColor: cores.acentoSuave },
  semFoto: { alignItems: 'center', justifyContent: 'center' },
  cartao: {
    gap: espaco.m,
    padding: espaco.l,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco.m },
  linhaTitulo: { fontSize: 12, color: cores.textoSecundario },
  nota: { ...texto.pequeno, fontWeight: '600' },
  notaBoa: { color: cores.sucesso },
  linhaDoTitulo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco.m },
  // 48 x 48: área de toque confortável (RNF06)
  coracao: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  botoes: { flexDirection: 'row', gap: espaco.m },
  aviso: { ...texto.pequeno, color: cores.erro },
  lista: { borderRadius: raio.xl, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie, overflow: 'hidden' },
  prato: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, paddingHorizontal: espaco.l, paddingVertical: espaco.m, minHeight: 56 },
  pratoComLinha: { borderTopWidth: 1, borderTopColor: cores.linha },
  pratoNome: { ...texto.corpo, fontWeight: '500' },
  pratoCategoria: { fontSize: 12, color: cores.textoSecundario },
  pratoPreco: { ...texto.corpo, fontWeight: '600' },
  riscado: { color: cores.textoTerciario, textDecorationLine: 'line-through' },
  destaque: { fontWeight: '700', color: cores.acento },
});
