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
import { Botao, Carregar, Ecra } from '@/components/ui';
import { usePerto } from '@/context/PertoContext';
import { ouvirAbanoes } from '@/lib/abanar';
import { almocoMaisBarato, OPCOES_DE_RAIO_KM, pratosParaSortear } from '@/services/pratos';
import { cores, espaco, fontes, texto } from '@/theme';

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

  return (
    <Ecra>
      <View style={estilos.cabecalho}>
        <View style={estilos.linhaDoTitulo}>
          <Text style={[texto.titulo, estilos.ocuparTudo]} accessibilityRole="header">
            Pratos de hoje
          </Text>
          {/* ler o QR code que um restaurante tem na porta: abre logo a página dele */}
          <Pressable
            onPress={() => setALerQr(true)}
            accessibilityRole="button"
            accessibilityLabel="Ler o QR code de um restaurante"
            style={estilos.botaoDoQr}
          >
            <Icone name="qr-code-outline" size={24} color={cores.acento} />
          </Pressable>
        </View>
        <BotaoDoLocal onPress={() => setAMudarLocal(true)} />
        <FiltrosDePratos />
      </View>
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
        ListHeaderComponent={
          pratos.length > 0 ? (
            <View style={estilos.cabecalhoDaLista}>
              {maisBarato ? <DestaqueMaisBarato prato={maisBarato} onPress={() => abrirRestaurante(maisBarato)} /> : null}
              <View style={estilos.linha}>
                <Text style={[texto.pequeno, estilos.ocuparTudo]}>
                  {pratos.length === 1 ? '1 prato' : `${pratos.length} pratos`} {perto}
                </Text>
                {haPratosParaSortear ? (
                  <Pressable
                    onPress={() => setADecidir(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Escolhe por mim (também podes abanar o telemóvel)"
                    style={estilos.escolhePorMim}
                  >
                    <Icone name="dice-outline" size={18} color={cores.acento} />
                    <Text style={estilos.escolhePorMimTexto}>Escolhe por mim</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null
        }
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
  cabecalho: { paddingHorizontal: espaco.xl, paddingTop: espaco.l, paddingBottom: espaco.m, gap: espaco.s },
  linhaDoTitulo: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  // 44 x 44: área de toque mínima (RNF06)
  botaoDoQr: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  lista: { paddingHorizontal: espaco.xl, paddingBottom: espaco.xl, flexGrow: 1 },
  cabecalhoDaLista: { gap: espaco.m, marginBottom: espaco.m },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
  ocuparTudo: { flex: 1 },
  // minHeight 44: área de toque mínima (RNF06)
  escolhePorMim: { flexDirection: 'row', alignItems: 'center', gap: espaco.xs, minHeight: 44 },
  escolhePorMimTexto: { ...texto.pequeno, fontFamily: fontes.negrito, color: cores.acento },
  separador: { height: espaco.m },
  vazio: { gap: espaco.l, paddingTop: espaco.xxl },
  icone: { alignSelf: 'center' },
  textoCentro: { textAlign: 'center' },
});
