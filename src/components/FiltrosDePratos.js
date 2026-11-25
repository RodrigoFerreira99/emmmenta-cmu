import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Icone } from '@/components/Icone';
import { PesquisaComIa } from '@/components/PesquisaComIa';
import { usePerto } from '@/context/PertoContext';
import { CATEGORIAS, ETIQUETAS, OPCOES_DE_PRECO_MAXIMO, OPCOES_DE_RAIO_KM, RAIO_POR_OMISSAO_KM } from '@/services/pratos';
import { cores, espaco, fontes, raio, texto } from '@/theme';

// RF07 — pesquisa pelo nome do prato e filtros: categoria, preço máximo, raio e dieta (etiquetas).
// É usado na lista (Início) e no mapa. Os filtros vivem no PertoContext, por isso
// o que se escolhe num separador fica igual no outro.
//
// A categoria está sempre à vista (é o filtro mais usado). O preço máximo, o raio e a dieta
// ficam num painel que abre com o botão dos filtros, para não ocupar o ecrã todo.
// O botão com estrelas abre a pesquisa por frase (PesquisaComIa): "peixe até 8 € aqui perto".
export function FiltrosDePratos() {
  const { filtros, filtrosAtivos, mudarFiltros, limparFiltros, aplicarFiltros } = usePerto();
  const [painelAberto, setPainelAberto] = useState(false);
  const [assistenteAberto, setAssistenteAberto] = useState(false);

  // quantos filtros do painel estão a ser usados (aparece numa bolinha no botão)
  const filtrosDoPainel =
    (filtros.precoMax !== null ? 1 : 0) +
    (filtros.raioKm !== RAIO_POR_OMISSAO_KM ? 1 : 0) +
    (filtros.etiqueta !== null ? 1 : 0) +
    (filtros.soFavoritos ? 1 : 0) +
    (filtros.ordem !== 'distancia' ? 1 : 0);

  return (
    <View style={estilos.grupo}>
      <View style={estilos.linha}>
        <View style={estilos.pesquisa}>
          <Icone name="search-outline" size={18} color={cores.textoTerciario} />
          <TextInput
            value={filtros.pesquisa}
            onChangeText={(pesquisa) => mudarFiltros({ pesquisa })}
            placeholder="Procurar um prato"
            placeholderTextColor={cores.textoTerciario}
            accessibilityLabel="Procurar pelo nome do prato"
            returnKeyType="search"
            autoCorrect={false}
            maxLength={40}
            style={estilos.campoDaPesquisa}
          />
          {filtros.pesquisa ? (
            <Pressable
              onPress={() => mudarFiltros({ pesquisa: '' })}
              accessibilityRole="button"
              accessibilityLabel="Apagar a pesquisa"
              hitSlop={12}
            >
              <Icone name="close-circle" size={18} color={cores.textoTerciario} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => setAssistenteAberto((aberto) => !aberto)}
          accessibilityRole="button"
          accessibilityLabel={assistenteAberto ? 'Fechar a pesquisa por frase' : 'Pesquisa por frase com o assistente'}
          accessibilityState={{ expanded: assistenteAberto }}
          style={[estilos.botaoDosFiltros, assistenteAberto && estilos.botaoDoAssistenteAberto]}
        >
          <Icone name="sparkles" size={20} color={assistenteAberto ? cores.textoInverso : cores.acento} />
        </Pressable>

        <Pressable
          onPress={() => setPainelAberto((aberto) => !aberto)}
          accessibilityRole="button"
          accessibilityLabel={painelAberto ? 'Esconder a ordem e os filtros de preço, distância, dieta e favoritos' : 'Mostrar a ordem e os filtros de preço, distância, dieta e favoritos'}
          accessibilityState={{ expanded: painelAberto }}
          style={[estilos.botaoDosFiltros, painelAberto && estilos.botaoDosFiltrosAberto]}
        >
          <Icone name="options-outline" size={20} color={painelAberto ? cores.textoInverso : cores.texto} />
          {filtrosDoPainel > 0 ? (
            <View style={estilos.bolinha}>
              <Text style={estilos.bolinhaTexto}>{filtrosDoPainel}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {assistenteAberto ? <PesquisaComIa aoAplicar={aplicarFiltros} /> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips} accessibilityRole="radiogroup">
        <Chip titulo="Tudo" ativo={filtros.categoria === null} onPress={() => mudarFiltros({ categoria: null })} />
        {CATEGORIAS.map((categoria) => (
          <Chip
            key={categoria.valor}
            titulo={categoria.nome}
            ativo={filtros.categoria === categoria.valor}
            onPress={() => mudarFiltros({ categoria: categoria.valor })}
          />
        ))}
      </ScrollView>

      {painelAberto ? (
        <View style={estilos.painel}>
          <Text style={texto.etiqueta}>Ordenar</Text>
          <View style={estilos.chipsDoPainel} accessibilityRole="radiogroup">
            <Chip titulo="Mais perto primeiro" ativo={filtros.ordem === 'distancia'} onPress={() => mudarFiltros({ ordem: 'distancia' })} />
            <Chip titulo="Mais barato primeiro" ativo={filtros.ordem === 'preco'} onPress={() => mudarFiltros({ ordem: 'preco' })} />
            {/* ranking dos estudantes: os restaurantes onde vão mais estudantes primeiro */}
            <Chip titulo="Mais populares" ativo={filtros.ordem === 'popular'} onPress={() => mudarFiltros({ ordem: 'popular' })} />
          </View>

          <Text style={texto.etiqueta}>Preço máximo</Text>
          <View style={estilos.chipsDoPainel} accessibilityRole="radiogroup">
            <Chip titulo="Qualquer preço" ativo={filtros.precoMax === null} onPress={() => mudarFiltros({ precoMax: null })} />
            {OPCOES_DE_PRECO_MAXIMO.map((preco) => (
              <Chip key={preco} titulo={`Até ${preco} €`} ativo={filtros.precoMax === preco} onPress={() => mudarFiltros({ precoMax: preco })} />
            ))}
          </View>

          <Text style={texto.etiqueta}>Distância</Text>
          <View style={estilos.chipsDoPainel} accessibilityRole="radiogroup">
            {OPCOES_DE_RAIO_KM.map((km) => (
              <Chip key={km} titulo={`Até ${km} km`} ativo={filtros.raioKm === km} onPress={() => mudarFiltros({ raioKm: km })} />
            ))}
          </View>

          <Text style={texto.etiqueta}>Dieta e sabor</Text>
          <View style={estilos.chipsDoPainel} accessibilityRole="radiogroup">
            <Chip titulo="Qualquer prato" ativo={filtros.etiqueta === null} onPress={() => mudarFiltros({ etiqueta: null })} />
            {ETIQUETAS.map((etiqueta) => (
              <Chip
                key={etiqueta.valor}
                titulo={etiqueta.nome}
                ativo={filtros.etiqueta === etiqueta.valor}
                onPress={() => mudarFiltros({ etiqueta: etiqueta.valor })}
              />
            ))}
          </View>

          <Text style={texto.etiqueta}>Restaurantes</Text>
          <View style={estilos.chipsDoPainel} accessibilityRole="radiogroup">
            <Chip titulo="Todos" ativo={!filtros.soFavoritos} onPress={() => mudarFiltros({ soFavoritos: false })} />
            <Chip titulo="Só os meus favoritos" ativo={filtros.soFavoritos} onPress={() => mudarFiltros({ soFavoritos: true })} />
          </View>

          {filtrosAtivos > 0 ? (
            <Pressable onPress={limparFiltros} accessibilityRole="button" style={estilos.ligacao}>
              <Text style={estilos.ligacaoTexto}>Limpar filtros</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco.m },
  linha: { flexDirection: 'row', gap: espaco.s },
  pesquisa: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.s,
    height: 48,
    paddingHorizontal: espaco.m,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  campoDaPesquisa: { flex: 1, fontSize: 16, color: cores.texto, paddingVertical: 0 },
  botaoDosFiltros: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  botaoDosFiltrosAberto: { backgroundColor: cores.texto, borderColor: cores.texto },
  botaoDoAssistenteAberto: { backgroundColor: cores.acento, borderColor: cores.acento },
  bolinha: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: raio.pilula,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.acento,
  },
  bolinhaTexto: { fontSize: 11, fontFamily: fontes.negrito, color: cores.textoInverso },
  // paddingVertical: espaço para o hitSlop das etiquetas não ser cortado
  chips: { gap: espaco.s, paddingVertical: 2 },
  painel: {
    gap: espaco.s,
    padding: espaco.l,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  chipsDoPainel: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s, marginBottom: espaco.s },
  ligacao: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 },
  ligacaoTexto: { ...texto.pequeno, color: cores.acento, fontFamily: fontes.semi },
});
