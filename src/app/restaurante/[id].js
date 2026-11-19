import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Bussola } from '@/components/Bussola';
import { CaminhoAPe } from '@/components/CaminhoAPe';
import { EtiquetaEsgotado, EtiquetaUltimasDoses } from '@/components/CartaoDePrato';
import { EcraDeErro } from '@/components/EcraDeErro';
import { PaginaFantasma } from '@/components/Esqueleto';
import { FotoDoPrato } from '@/components/FotoDoPrato';
import { EtiquetaDeLotacao } from '@/components/Lotacao';
import { Botao, Ecra } from '@/components/ui';
import { useFavoritos } from '@/lib/favoritos';
import { abrirDirecoes, ligar } from '@/lib/ligacoes';
import { lerEmVozAlta, pararDeLer, textoDoMenuParaOuvir } from '@/lib/ouvirMenu';
import { partilhar, textoDoConvite } from '@/lib/partilhar';
import { vibrarLeve } from '@/lib/vibrar';
import { CATEGORIAS_EM_INGLES, traduzirPratos } from '@/services/assistente';
import { buscarMenuDeHoje, nomeDaCategoria, ouvirLotacao } from '@/services/menus';
import { descreverEtiquetas, formatarDistancia, formatarPreco, ouvirAlteracoesPratos } from '@/services/pratos';
import { buscarRestaurante, estadoDoHorario, horaParaEcra, telefoneParaEcra } from '@/services/restaurantes';
import { cores, espaco, raio, texto } from '@/theme';

// Ecrã 4 · Página do restaurante (RF06) — responsável: André
// Abre-se a partir da lista ou do mapa, com o id do restaurante no endereço e a distância como parâmetro.
//
// Mostra a fotografia, o nome, o tipo de cozinha, o horário e a morada, os botões Ligar e Direções
// e o menu de hoje. Os pratos esgotados aparecem riscados e mudam em tempo real (RF04).
// O botão "English" mostra o menu em inglês para turistas (traduzido pelo assistente de IA).
// Também em tempo real: "Há mesa" / "Cheio agora" e as "Últimas doses". Tocar na fotografia de um
// prato mostra-a em grande. "Ver o caminho a pé" mostra no mapa o percurso até ao restaurante (CaminhoAPe).
// O botão do altifalante lê o menu em voz alta (em português ou, no menu em inglês, em inglês).
// "Seguir a bússola" abre uma seta que aponta para o restaurante enquanto o cliente anda (Bussola).
export default function PaginaRestaurante() {
  const { id, distancia } = useLocalSearchParams();

  const [estado, setEstado] = useState('aCarregar'); // 'aCarregar' | 'erro' | 'naoExiste' | 'pronto'
  const [erroAoCarregar, setErroAoCarregar] = useState(null);
  const [tentativa, setTentativa] = useState(0); // aumenta quando se carrega em "Tentar outra vez"
  const [restaurante, setRestaurante] = useState(null);
  const [menu, setMenu] = useState(null); // null = hoje ainda não publicou
  const [aviso, setAviso] = useState(null); // quando Ligar, Direções ou os favoritos não resultam
  const { eFavorito, alternarFavorito } = useFavoritos();
  const [emIngles, setEmIngles] = useState(false);
  const [aTraduzir, setATraduzir] = useState(false);
  const [traducoes, setTraducoes] = useState({}); // nome em português → nome em inglês
  const [caminhoAberto, setCaminhoAberto] = useState(false);
  const [aFalar, setAFalar] = useState(false); // o telemóvel está a ler o menu em voz alta
  const [bussolaAberta, setBussolaAberta] = useState(false);

  // ao sair da página, a voz cala-se
  useEffect(() => () => pararDeLer(), []);

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

  // 3) "Há mesa" / "Cheio agora": quando o restaurante muda a lotação no Painel, muda aqui logo.
  useEffect(() => {
    if (!menuId) return;
    return ouvirLotacao(
      (alterado) => setMenu((atual) => (atual ? { ...atual, lotacao: alterado.lotacao, lotacao_em: alterado.lotacao_em } : atual)),
      { menuId }
    );
  }, [menuId]);

  function tentarOutraVez() {
    setEstado('aCarregar');
    setTentativa((n) => n + 1);
  }

  // Os botões abrem outra app (telefone, mapas ou a janela de partilha). Se não for possível, explica-se em vez de não acontecer nada.
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
    vibrarLeve();
    try {
      await alternarFavorito(restaurante.id);
    } catch (erro) {
      setAviso(erro.message);
    }
  }

  // Menu em inglês: traduz só os nomes que ainda não foram traduzidos (a tradução fica guardada no ecrã).
  async function alternarIngles() {
    setAviso(null);
    if (emIngles) {
      setEmIngles(false);
      return;
    }
    const porTraduzir = (menu?.pratos ?? []).map((prato) => prato.nome).filter((nome) => !traducoes[nome]);
    if (porTraduzir.length === 0) {
      setEmIngles(true);
      return;
    }
    setATraduzir(true);
    try {
      const novas = await traduzirPratos(porTraduzir);
      setTraducoes((atuais) => ({ ...atuais, ...Object.fromEntries(porTraduzir.map((nome, indice) => [nome, novas[indice]])) }));
      setEmIngles(true);
    } catch (erro) {
      setAviso(erro.message);
    } finally {
      setATraduzir(false);
    }
  }

  // Ouvir o menu: lê os pratos, os preços e o que está esgotado; tocar outra vez pára.
  function alternarVoz() {
    if (aFalar) {
      pararDeLer();
      setAFalar(false);
      return;
    }
    const texto = textoDoMenuParaOuvir({
      nomeDoRestaurante: restaurante.nome,
      pratos: menu?.pratos ?? [],
      precoMenuCompleto: menu?.preco_menu_completo,
      emIngles,
      traducoes,
    });
    setAFalar(true);
    lerEmVozAlta(texto, { emIngles, aoAcabar: () => setAFalar(false) });
  }

  if (estado === 'aCarregar') {
    return (
      <Ecra bordas={['bottom']}>
        <PaginaFantasma />
      </Ecra>
    );
  }
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
  // o caminho a pé só se pode mostrar se o restaurante tiver o ponto no mapa
  const temPonto = Number.isFinite(restaurante.latitude) && Number.isFinite(restaurante.longitude);

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
            {menu ? <EtiquetaDeLotacao menu={menu} emIngles={emIngles} /> : null}
          </View>
          <Pressable
            onPress={() => abrirOutraApp(() => partilhar(textoDoConvite({ restaurante, menu })))}
            accessibilityRole="button"
            accessibilityLabel="Partilhar este restaurante"
            style={estilos.botaoDeIcone}
          >
            <Ionicons name="share-social-outline" size={24} color={cores.acento} />
          </Pressable>
          <Pressable
            onPress={mudarFavorito}
            accessibilityRole="button"
            accessibilityLabel={favorito ? 'Tirar dos favoritos' : 'Guardar nos favoritos'}
            accessibilityState={{ selected: favorito }}
            style={estilos.botaoDeIcone}
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
        {temPonto ? (
          <Botao
            tipo="secundario"
            icone="walk-outline"
            titulo={caminhoAberto ? 'Esconder o caminho a pé' : 'Ver o caminho a pé'}
            onPress={() => setCaminhoAberto((aberto) => !aberto)}
          />
        ) : null}
        {caminhoAberto ? <CaminhoAPe restaurante={restaurante} aoAbrirDirecoes={() => abrirOutraApp(() => abrirDirecoes(restaurante))} /> : null}
        {temPonto ? <Botao tipo="secundario" icone="compass-outline" titulo="Seguir a bússola" onPress={() => setBussolaAberta(true)} /> : null}
        {temPonto ? <Bussola restaurante={restaurante} visivel={bussolaAberta} aoFechar={() => setBussolaAberta(false)} /> : null}
        {aviso ? (
          <Text style={estilos.aviso} accessibilityRole="alert">
            {aviso}
          </Text>
        ) : null}

        <View style={estilos.linhaDoMenu}>
          <Text style={[texto.subtitulo, estilos.ocuparTudo]} accessibilityRole="header">
            {emIngles ? "Today's menu" : 'Menu de hoje'}
          </Text>
          {pratos.length > 0 ? (
            <Pressable
              onPress={alternarVoz}
              accessibilityRole="button"
              accessibilityLabel={aFalar ? (emIngles ? 'Stop reading the menu' : 'Parar de ler o menu') : emIngles ? 'Listen to the menu' : 'Ouvir o menu em voz alta'}
              style={estilos.botaoDeIdioma}
            >
              <Ionicons name={aFalar ? 'stop-circle-outline' : 'volume-high-outline'} size={24} color={cores.acento} />
            </Pressable>
          ) : null}
          {pratos.length > 0 ? (
            <Pressable
              onPress={alternarIngles}
              disabled={aTraduzir}
              accessibilityRole="button"
              accessibilityLabel={emIngles ? 'Ver o menu em português' : 'Show the menu in English'}
              accessibilityState={{ busy: aTraduzir }}
              style={estilos.botaoDeIdioma}
            >
              {aTraduzir ? (
                <ActivityIndicator color={cores.acento} />
              ) : (
                <Text style={estilos.botaoDeIdiomaTexto}>{emIngles ? '🇵🇹 Português' : '🇬🇧 English'}</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {pratos.length === 0 ? (
          <Text style={texto.pequeno}>Este restaurante ainda não publicou o menu de hoje.</Text>
        ) : (
          <View style={estilos.lista}>
            {pratos.map((prato, indice) => (
              <LinhaDoPrato
                key={prato.id}
                prato={prato}
                comLinha={indice > 0}
                emIngles={emIngles}
                nomeEmIngles={emIngles ? traducoes[prato.nome] : null}
              />
            ))}
          </View>
        )}

        {menu?.preco_menu_completo ? (
          <Text style={texto.corpo}>
            {emIngles ? 'Set menu: ' : 'Menu completo: '}
            <Text style={estilos.destaque}>{formatarPreco(menu.preco_menu_completo)}</Text>
          </Text>
        ) : null}
      </ScrollView>
    </Ecra>
  );
}

// Um prato do menu. No menu em inglês: o nome traduzido em cima e o nome português por baixo, em pequeno.
// A fotografia (se houver) é um botão à parte, fora do bloco que o leitor de ecrã lê de uma vez.
function LinhaDoPrato({ prato, comLinha, emIngles, nomeEmIngles }) {
  const categoria = emIngles ? CATEGORIAS_EM_INGLES[prato.categoria] : nomeDaCategoria(prato.categoria);
  const etiquetas = descreverEtiquetas(prato.etiquetas, { emIngles });
  const ultimasDoses = prato.ultimas_doses && !prato.esgotado;
  let estado = formatarPreco(prato.preco);
  if (prato.esgotado) estado = emIngles ? 'sold out' : 'esgotado';
  else if (ultimasDoses) estado = `${emIngles ? 'last portions' : 'últimas doses'}, ${estado}`;
  const rotulo = [nomeEmIngles ?? prato.nome, categoria, etiquetas || null, estado].filter(Boolean).join(', ');
  const linhaDePequeno = [nomeEmIngles ? prato.nome : null, categoria, etiquetas || null].filter(Boolean).join(' · ');

  return (
    <View style={[estilos.prato, comLinha && estilos.pratoComLinha]}>
      {prato.foto_url ? <FotoDoPrato uri={prato.foto_url} nome={nomeEmIngles ?? prato.nome} /> : null}
      <View style={estilos.pratoTextos} accessible accessibilityLabel={rotulo}>
        <View style={estilos.ocuparTudo}>
          <Text style={[estilos.pratoNome, prato.esgotado && estilos.riscado]}>{nomeEmIngles ?? prato.nome}</Text>
          <Text style={estilos.pratoCategoria}>{linhaDePequeno}</Text>
        </View>
        <View style={estilos.pratoDireita}>
          <Text style={[estilos.pratoPreco, prato.esgotado && estilos.riscado]}>{formatarPreco(prato.preco)}</Text>
          {prato.esgotado ? <EtiquetaEsgotado texto={emIngles ? 'Sold out' : 'Esgotado'} /> : null}
          {ultimasDoses ? <EtiquetaUltimasDoses texto={emIngles ? 'Last portions' : 'Últimas doses'} /> : null}
        </View>
      </View>
    </View>
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
  botaoDeIcone: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  botoes: { flexDirection: 'row', gap: espaco.m },
  linhaDoMenu: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  // minHeight 44: área de toque mínima (RNF06)
  botaoDeIdioma: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: espaco.s },
  botaoDeIdiomaTexto: { ...texto.pequeno, fontWeight: '700', color: cores.acento },
  aviso: { ...texto.pequeno, color: cores.erro },
  lista: { borderRadius: raio.xl, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie, overflow: 'hidden' },
  prato: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, paddingHorizontal: espaco.l, paddingVertical: espaco.m, minHeight: 56 },
  pratoTextos: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  pratoDireita: { alignItems: 'flex-end', gap: espaco.xs },
  pratoComLinha: { borderTopWidth: 1, borderTopColor: cores.linha },
  pratoNome: { ...texto.corpo, fontWeight: '500' },
  pratoCategoria: { fontSize: 12, color: cores.textoSecundario },
  pratoPreco: { ...texto.corpo, fontWeight: '600' },
  riscado: { color: cores.textoTerciario, textDecorationLine: 'line-through' },
  destaque: { fontWeight: '700', color: cores.acento },
});
