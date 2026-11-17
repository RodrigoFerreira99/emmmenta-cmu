import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { CartaoDePrato } from '@/components/CartaoDePrato';
import { BotaoDoLocal, EscolherLocal } from '@/components/EscolherLocal';
import { FiltrosDePratos } from '@/components/FiltrosDePratos';
import { Botao, Carregar, Ecra } from '@/components/ui';
import { usePerto } from '@/context/PertoContext';
import { OPCOES_DE_RAIO_KM } from '@/services/pratos';
import { cores, espaco, texto } from '@/theme';

// Ecrã 2 · Início (RF05, RF07) — responsável: André
//
// Mostra os pratos do dia perto do cliente, do mais perto para o mais longe, com os esgotados no fim.
// Como funciona:
//  1. O PertoContext sabe onde procurar (localização ou zona escolhida), os filtros e os pratos.
//  2. Este ecrã só desenha: cabeçalho com o sítio, pesquisa e filtros (RF07) e a lista (RF05).
//  3. Tocar num prato abre a página do restaurante: chega-se a um menu com 1 toque (RNF06).
export default function Inicio() {
  const { local, estadoDoLocal, pratos, aCarregar, erro, recarregar, filtros, filtrosAtivos, mudarFiltros, limparFiltros } =
    usePerto();
  const [aMudarLocal, setAMudarLocal] = useState(false);

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

  // "a menos de 2 km de ti" ou "a menos de 2 km do centro de Braga"
  const perto = `a menos de ${filtros.raioKm} km ${local.origem === 'gps' ? 'de ti' : `do centro de ${local.nome}`}`;

  // O que aparece quando a lista está vazia: a carregar, um erro, ou a explicação de não haver pratos (RNF08).
  function listaVazia() {
    if (aCarregar) return <ActivityIndicator size="large" color={cores.acento} style={estilos.aCarregar} />;

    if (erro) {
      return (
        <View style={estilos.vazio}>
          <Ionicons name="cloud-offline-outline" size={36} color={cores.textoTerciario} style={estilos.icone} />
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
    return (
      <View style={estilos.vazio}>
        <Ionicons name="restaurant-outline" size={36} color={cores.textoTerciario} style={estilos.icone} />
        <Text style={[texto.corpo, estilos.textoCentro]}>
          {haOutrosFiltros ? `Nenhum prato de hoje corresponde ao que procuras ${perto}.` : `Ainda não há pratos publicados hoje ${perto}.`}
        </Text>
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
        <Text style={texto.titulo} accessibilityRole="header">
          Pratos de hoje
        </Text>
        <BotaoDoLocal onPress={() => setAMudarLocal(true)} />
        <FiltrosDePratos />
      </View>

      <FlatList
        data={pratos}
        keyExtractor={(prato) => prato.prato_id}
        renderItem={({ item }) => <CartaoDePrato prato={item} onPress={() => abrirRestaurante(item)} />}
        contentContainerStyle={estilos.lista}
        ItemSeparatorComponent={Separador}
        ListHeaderComponent={
          pratos.length > 0 ? (
            <Text style={[texto.pequeno, estilos.contagem]}>
              {pratos.length === 1 ? '1 prato' : `${pratos.length} pratos`} {perto}
            </Text>
          ) : null
        }
        ListEmptyComponent={listaVazia()}
        // puxar a lista para baixo volta a procurar (por exemplo, para ver menus acabados de publicar)
        refreshControl={<RefreshControl refreshing={aCarregar && pratos.length > 0} onRefresh={recarregar} tintColor={cores.acento} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </Ecra>
  );
}

function Separador() {
  return <View style={estilos.separador} />;
}

const estilos = StyleSheet.create({
  cabecalho: { paddingHorizontal: espaco.xl, paddingTop: espaco.l, paddingBottom: espaco.m, gap: espaco.s },
  lista: { paddingHorizontal: espaco.xl, paddingBottom: espaco.xl, flexGrow: 1 },
  contagem: { marginBottom: espaco.m },
  separador: { height: espaco.m },
  aCarregar: { marginTop: espaco.xxl },
  vazio: { gap: espaco.l, paddingTop: espaco.xxl },
  icone: { alignSelf: 'center' },
  textoCentro: { textAlign: 'center' },
});
