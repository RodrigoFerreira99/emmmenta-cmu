import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LinhasFantasma } from '@/components/Esqueleto';
import { Icone } from '@/components/Icone';
import { LembreteDiario } from '@/components/LembreteDiario';
import { Botao, Ecra } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useFavoritos } from '@/lib/favoritos';
import { buscarRestaurantesPorIds } from '@/services/restaurantes';
import { cores, espaco, fontes, raio, texto } from '@/theme';

// Conta do cliente: quem está a usar a app, os restaurantes favoritos, o lembrete do almoço e terminar sessão (RF01).
//
// Os favoritos estão guardados no telemóvel (src/lib/favoritos.js): aqui só se vão buscar os nomes
// e se cada um já publicou o menu de hoje. Tocar num favorito abre a página do restaurante.
export default function Conta() {
  const { sessao, perfil, sair } = useAuth();
  const { favoritos } = useFavoritos();

  const ids = [...favoritos].sort().join(','); // os favoritos num texto, por exemplo "id1,id2"
  const [tentativa, setTentativa] = useState(0); // aumenta em "Tentar outra vez"
  // "pedido" identifica a leitura que queremos agora: muda com os favoritos e com "Tentar outra vez".
  // O resultado guarda o pedido que o produziu; se forem diferentes, a resposta ainda não chegou.
  const pedido = `${tentativa}|${ids}`;
  const [resultado, setResultado] = useState({ pedido: null, restaurantes: [], erro: null });

  // Sempre que o separador fica à frente (por exemplo, depois de guardar um favorito), volta a ler:
  // o menu de hoje de cada favorito pode ter sido publicado entretanto.
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      buscarRestaurantesPorIds(ids ? ids.split(',') : [])
        .then((restaurantes) => {
          if (ativo) setResultado({ pedido, restaurantes, erro: null });
        })
        .catch((erro) => {
          if (ativo) setResultado({ pedido, restaurantes: [], erro: erro.message });
        });
      return () => {
        ativo = false;
      };
    }, [ids, pedido])
  );

  const aCarregar = resultado.pedido !== pedido;

  function listaDeFavoritos() {
    if (favoritos.size === 0) {
      return <Text style={texto.pequeno}>Ainda não tens favoritos. Abre um restaurante e toca no coração para o guardar.</Text>;
    }
    if (aCarregar) return <LinhasFantasma quantas={Math.min(favoritos.size, 3)} />;
    if (resultado.erro) {
      return (
        <View style={estilos.grupo}>
          <Text style={estilos.erro} accessibilityRole="alert">
            {resultado.erro}
          </Text>
          <Botao tipo="secundario" icone="refresh-outline" titulo="Tentar outra vez" onPress={() => setTentativa((n) => n + 1)} />
        </View>
      );
    }
    return (
      <View style={estilos.lista}>
        {resultado.restaurantes.map((restaurante, indice) => (
          <Pressable
            key={restaurante.id}
            onPress={() => router.push({ pathname: '/restaurante/[id]', params: { id: restaurante.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${restaurante.nome}, ${restaurante.temMenuHoje ? 'com menu hoje' : 'sem menu hoje'}`}
            style={({ pressed }) => [estilos.favorito, indice > 0 && estilos.favoritoComLinha, pressed && estilos.premido]}
          >
            <Icone name="heart" size={18} color={cores.acento} />
            <View style={estilos.ocuparTudo}>
              <Text style={estilos.nome}>{restaurante.nome}</Text>
              <Text style={[texto.pequeno, restaurante.temMenuHoje && estilos.comMenu]}>
                {[restaurante.tipoCozinha, restaurante.temMenuHoje ? 'Menu de hoje publicado' : 'Ainda sem menu hoje']
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Icone name="chevron-forward" size={18} color={cores.textoTerciario} />
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <Ecra>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Text style={texto.titulo}>Conta</Text>
        <View style={estilos.cartao}>
          <Text style={texto.subtitulo}>{perfil?.nome || 'Sem nome'}</Text>
          <Text style={texto.pequeno}>{sessao?.user?.email}</Text>
          <Text style={texto.pequeno}>Conta de cliente</Text>
        </View>

        <View style={estilos.grupo}>
          <Text style={texto.subtitulo} accessibilityRole="header">
            Os meus favoritos
          </Text>
          {listaDeFavoritos()}
          <Text style={estilos.nota}>Os favoritos ficam guardados só neste telemóvel.</Text>
        </View>

        <LembreteDiario
          tipo="almoco"
          titulo="Lembrete do almoço"
          descricao="Um aviso todos os dias à hora de almoço, para veres os pratos do dia perto de ti."
        />

        <Botao tipo="secundario" icone="log-out-outline" titulo="Terminar sessão" onPress={sair} />
      </ScrollView>
    </Ecra>
  );
}

const estilos = StyleSheet.create({
  ocuparTudo: { flex: 1 },
  conteudo: { padding: espaco.xl, gap: espaco.l },
  grupo: { gap: espaco.s },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: raio.xl,
    padding: espaco.l,
    gap: espaco.xs,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  erro: { ...texto.pequeno, color: cores.erro },
  lista: { borderRadius: raio.xl, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie, overflow: 'hidden' },
  // minHeight 56: área de toque confortável (RNF06)
  favorito: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, paddingHorizontal: espaco.l, minHeight: 56 },
  favoritoComLinha: { borderTopWidth: 1, borderTopColor: cores.linha },
  premido: { backgroundColor: cores.acentoSuave },
  nome: { ...texto.corpo, fontFamily: fontes.semi },
  comMenu: { color: cores.sucesso },
  nota: { fontSize: 12, color: cores.textoSecundario },
});
