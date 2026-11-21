import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AbanaParaDecidir } from '@/components/AbanaParaDecidir';
import { CartaoDePrato } from '@/components/CartaoDePrato';
import { DestaqueMaisBarato } from '@/components/DestaqueMaisBarato';
import { BotaoDoLocal, EscolherLocal } from '@/components/EscolherLocal';
import { ListaFantasma } from '@/components/Esqueleto';
import { FiltrosDePratos } from '@/components/FiltrosDePratos';
import { Icone } from '@/components/Icone';
import { LerQr } from '@/components/LerQr';
import { MapaDeCalor } from '@/components/MapaDeCalor';
import { TituloQuente } from '@/components/TituloQuente';
import { Botao, Carregar, Ecra } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { usePerto } from '@/context/PertoContext';
import { ouvirAbanoes } from '@/lib/abanar';
import { saudacao } from '@/lib/datas';
import { almocoMaisBarato, OPCOES_DE_RAIO_KM, pratosParaSortear } from '@/services/pratos';
import { cores, espaco, fontes, raio, texto } from '@/theme';

// Ecrã 2 · Início (RF05, RF07) — responsável: André
//
// Mostra os pratos do dia perto do cliente, do mais perto para o mais longe, com os esgotados no fim.
// Como funciona:
//  1. O PertoContext sabe onde procurar (localização ou zona escolhida), os filtros e os pratos.
//  2. Este ecrã só desenha: cabeçalho com o sítio, pesquisa e filtros (RF07) e a lista (RF05).
//  3. Tocar num prato abre a página do restaurante: chega-se a um menu com 1 toque (RNF06).
//  4. Extras: o destaque "o almoço mais barato perto de ti" e o "Abana para decidir" (botão
//     "Escolhe por mim" ou abanar o telemóvel com este ecrã à frente).
export default function Inicio() {
  const {
    local,
    estadoDoLocal,
    pratos,
    favoritos,
    aCarregar,
    erro,
    recarregar,
    filtros,
    filtrosAtivos,
    mudarFiltros,
    limparFiltros,
  } = usePerto();
  const { perfil } = useAuth();
  const [aMudarLocal, setAMudarLocal] = useState(false);
  const [aDecidir, setADecidir] = useState(false); // o "Abana para decidir" está aberto?
  const [aLerQr, setALerQr] = useState(false); // o leitor do QR code de um restaurante está aberto?

  // Abanar o telemóvel abre o "Abana para decidir", mas só com este ecrã à frente e se houver
  // pratos para escolher. Ao sair do ecrã o acelerómetro deixa de ser ouvido (poupa bateria).
  const haPratosParaSortear = pratosParaSortear(pratos).length > 0;
  useFocusEffect(
    useCallback(() => {
      if (!haPratosParaSortear || aDecidir) return;
      return ouvirAbanoes(() => setADecidir(true));
    }, [haPratosParaSortear, aDecidir])
  );

  // Ainda não se sabe onde procurar: ou a app está a ver se já tem permissão, ou o cliente tem de escolher.
  if (!local) {
    if (estadoDoLocal === 'aVerificar') return <Carregar />;
    return (
      <Ecra>
        <EscolherLocal />
      </Ecra>
    );
  }

  // O cliente tocou em "Perto de: ..." para mudar o sítio.
  if (aMudarLocal) {
    return (
      <Ecra>
        <EscolherLocal aoEscolher={() => setAMudarLocal(false)} aoCancelar={() => setAMudarLocal(false)} />
      </Ecra>
    );
  }

  function abrirRestaurante(prato) {
    // a distância vai junta para a página do restaurante a poder mostrar sem a calcular outra vez
    router.push({ pathname: '/restaurante/[id]', params: { id: prato.restaurante_id, distancia: String(prato.distancia_km) } });
  }

  // o destaque não aparece com "Mais barato primeiro": aí o mais barato já é o primeiro da lista
  const maisBarato = filtros.ordem === 'preco' ? null : almocoMaisBarato(pratos);

  // "a menos de 2 km de ti" ou "a menos de 2 km do centro de Braga"
  const perto = `a menos de ${filtros.raioKm} km ${local.origem === 'gps' ? 'de ti' : `do centro de ${local.nome}`}`;

  // O que aparece quando a lista está vazia: a carregar, um erro, ou a explicação de não haver pratos (RNF08).
  function listaVazia() {
    // enquanto procura: cartões cinzentos com a forma dos cartões de prato (em vez de um círculo a rodar)
    if (aCarregar) return <ListaFantasma />;

    if (erro) {
      return (
        <View style={estilos.vazio}>
          <Icone name="cloud-offline-outline" size={36} color={cores.textoTerciario} style={estilos.icone} />
          <Text style={[texto.corpo, estilos.textoCentro]} accessibilityRole="alert">
            {erro}
          </Text>
          <Botao titulo="Tentar outra vez" icone="refresh-outline" onPress={recarregar} />
        </View>
      );
    }

    // o raio a seguir ao atual (por exemplo, de 2 km para 5 km), se ainda houver um maior
    const raioMaior = OPCOES_DE_RAIO_KM.find((km) => km > filtros.raioKm);
    const haOutrosFiltros = filtros.precoMax !== null || filtros.categoria !== null || filtros.pesquisa.trim() !== '';
    let mensagem = haOutrosFiltros ? `Nenhum prato de hoje corresponde ao que procuras ${perto}.` : `Ainda não há pratos publicados hoje ${perto}.`;
    if (filtros.soFavoritos) {
      mensagem =
        favoritos.size === 0
          ? 'Ainda não tens restaurantes favoritos. Abre um restaurante e toca no coração para o guardar.'
          : `Nenhum dos teus restaurantes favoritos tem pratos de hoje ${perto}${haOutrosFiltros ? ' com estes filtros' : ''}.`;
    }
    return (
      <View style={estilos.vazio}>
        <Icone name="restaurant-outline" size={36} color={cores.textoTerciario} style={estilos.icone} />
        <Text style={[texto.corpo, estilos.textoCentro]}>{mensagem}</Text>
        {raioMaior ? (
          <Botao tipo="secundario" icone="resize-outline" titulo={`Procurar até ${raioMaior} km`} onPress={() => mudarFiltros({ raioKm: raioMaior })} />
        ) : null}
        {filtrosAtivos > 0 ? <Botao tipo="secundario" icone="close-outline" titulo="Limpar filtros" onPress={limparFiltros} /> : null}
      </View>
    );
  }

  // Cabeçalho do design térmico (vai dentro da lista, para fazer scroll com ela):
  // o sítio e o QR code, a saudação, o título, o mapa de calor 3D e a pesquisa com os filtros (RF07).
  const primeiroNome = perfil?.nome?.trim().split(/\s+/)[0];
  const cabecalho = (
    <View style={estilos.cabecalho}>
      <View style={estilos.linhaDoTitulo}>
        <View style={estilos.ocuparTudo}>
          <BotaoDoLocal onPress={() => setAMudarLocal(true)} />
        </View>
        {/* ler o QR code que um restaurante tem na porta: abre logo a página dele */}
        <Pressable
          onPress={() => setALerQr(true)}
          accessibilityRole="button"
          accessibilityLabel="Ler o QR code de um restaurante"
          style={estilos.botaoRedondo}
        >
          <Icone name="qr-code-outline" size={22} color={cores.texto} />
        </Pressable>
      </View>
      <Text style={estilos.saudacao}>{primeiroNome ? `${saudacao()}, ${primeiroNome}` : saudacao()}</Text>
      <TituloQuente />
      <MapaDeCalor local={local} pratos={pratos} onPress={() => router.navigate('/mapa')} />
      <FiltrosDePratos />
      {haPratosParaSortear ? (
        // "Indeciso? Abana o telemóvel": diz que se pode abanar (e também funciona com um toque)
        <Pressable
          onPress={() => setADecidir(true)}
          accessibilityRole="button"
          accessibilityLabel="Escolhe por mim (também podes abanar o telemóvel)"
          style={estilos.abana}
        >
          <Icone name="vibrar" size={20} color={cores.acento} />
          <Text style={estilos.abanaTexto}>Indeciso? Abana o telemóvel</Text>
        </Pressable>
      ) : null}
      {pratos.length > 0 ? (
        <View style={estilos.cabecalhoDaLista}>
          {maisBarato ? <DestaqueMaisBarato prato={maisBarato} onPress={() => abrirRestaurante(maisBarato)} /> : null}
          <Text style={estilos.contagem}>
            {pratos.length === 1 ? '1 prato' : `${pratos.length} pratos`} {perto}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Ecra>
      <LerQr
        visivel={aLerQr}
        aoFechar={() => setALerQr(false)}
        aoLer={(id) => {
          setALerQr(false);
          router.push({ pathname: '/restaurante/[id]', params: { id } });
        }}
      />

      <FlatList
        data={pratos}
        keyExtractor={(prato) => prato.prato_id}
        renderItem={({ item }) => (
          <CartaoDePrato prato={item} favorito={favoritos.has(item.restaurante_id)} onPress={() => abrirRestaurante(item)} />
        )}
        contentContainerStyle={estilos.lista}
        ItemSeparatorComponent={Separador}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={listaVazia()}
        // puxar a lista para baixo volta a procurar (por exemplo, para ver menus acabados de publicar)
        refreshControl={<RefreshControl refreshing={aCarregar && pratos.length > 0} onRefresh={recarregar} tintColor={cores.acento} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />

      {aDecidir ? (
        <AbanaParaDecidir
          pratos={pratos}
          aoFechar={() => setADecidir(false)}
          aoAbrirRestaurante={(prato) => {
            setADecidir(false);
            abrirRestaurante(prato);
          }}
        />
      ) : null}
    </Ecra>
  );
}

function Separador() {
  return <View style={estilos.separador} />;
}

const estilos = StyleSheet.create({
  cabecalho: { paddingTop: espaco.s, paddingBottom: espaco.m, gap: espaco.m },
  linhaDoTitulo: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  // 44 x 44: área de toque mínima (RNF06)
  botaoRedondo: {
    width: 44,
    height: 44,
    borderRadius: raio.pilula,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  saudacao: { ...texto.pequeno, fontSize: 14, marginTop: espaco.s, marginBottom: -espaco.s },
  lista: { paddingHorizontal: espaco.xl, paddingBottom: espaco.xl, flexGrow: 1 },
  cabecalhoDaLista: { gap: espaco.m, marginTop: espaco.s },
  // em maiúsculas só no ecrã (o leitor de ecrã lê a frase normal)
  contagem: { ...texto.rotulo, textTransform: 'uppercase' },
  ocuparTudo: { flex: 1 },
  // "Indeciso? Abana o telemóvel" (minHeight 44: área de toque mínima, RNF06)
  abana: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: espaco.s,
    minHeight: 44,
    paddingHorizontal: espaco.l,
    borderRadius: raio.pilula,
    borderWidth: 1,
    borderColor: cores.acento,
    backgroundColor: cores.acentoSuave,
  },
  abanaTexto: { fontFamily: fontes.semi, fontSize: 14, color: cores.texto },
  separador: { height: espaco.m },
  vazio: { gap: espaco.l, paddingTop: espaco.xxl },
  icone: { alignSelf: 'center' },
  textoCentro: { textAlign: 'center' },
});
