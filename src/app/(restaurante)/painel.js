import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { EcraDeErro } from '@/components/EcraDeErro';
import { Icone } from '@/components/Icone';
import { EscolherLotacao } from '@/components/Lotacao';
import { QrDoRestaurante } from '@/components/QrDoRestaurante';
import { Botao, Carregar, Ecra } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { diaPorExtenso, horaCurta, saudacao } from '@/lib/datas';
import { partilhar, textoDoMenuDeHoje } from '@/lib/partilhar';
import { vibrarLeve } from '@/lib/vibrar';
import { buscarMenuDeHoje, marcarEsgotado, marcarLotacao, marcarUltimasDoses } from '@/services/menus';
import { formatarPreco, ouvirAlteracoesPratos } from '@/services/pratos';
import { buscarMeuRestaurante } from '@/services/restaurantes';
import { cores, espaco, fontes, raio, texto } from '@/theme';

// Ecrã 5 · Painel (RF04) — responsável: José
//
// Como funciona:
//  1. Sempre que o ecrã fica à frente, vai buscar o restaurante da conta e o menu de hoje.
//  2. Mostra uma de três situações: ainda não há perfil, ainda não há menu hoje, ou o menu publicado.
//  3. Com menu publicado, cada prato tem um interruptor "Esgotado". Ao mexer, o ecrã muda logo
//     e a alteração é gravada (marcarEsgotado); se a gravação falhar, o interruptor volta atrás.
//  4. A tabela pratos está no tempo real do Supabase: os clientes veem a mudança logo, e este
//     ecrã também acompanha as mudanças feitas noutro telemóvel do restaurante.
//  5. "Últimas doses" avisa que um prato está quase a acabar, e "Como está a sala agora?" diz aos
//     clientes se há mesa ou se está cheio (o aviso desaparece sozinho ao fim de 45 minutos).
//  6. "QR code e cartaz para a porta" mostra o QR do restaurante e imprime um cartaz com o menu de hoje.
// O acesso aos dados é todo feito pelas funções de src/services/ (RNF09).
export default function Painel() {
  const { sessao, perfil } = useAuth();
  const donoId = sessao?.user?.id;

  const [estado, setEstado] = useState('aCarregar'); // 'aCarregar' | 'erro' | 'pronto'
  const [erroAoCarregar, setErroAoCarregar] = useState(null);
  const [restaurante, setRestaurante] = useState(null); // null = a conta ainda não preencheu o perfil
  const [menu, setMenu] = useState(null); // null = hoje ainda não há menu publicado
  const [aAtualizar, setAAtualizar] = useState(false); // "puxar para atualizar" em curso
  const [aMudar, setAMudar] = useState([]); // ids dos pratos cujo "esgotado" ou "últimas doses" está a ser gravado
  const [aGravarLotacao, setAGravarLotacao] = useState(false);
  const [qrAberto, setQrAberto] = useState(false);
  const [aviso, setAviso] = useState(null); // erro a mostrar sem esconder o que já está no ecrã

  // Fica a false quando o ecrã é desmontado; confirmamos antes de mexer no estado depois de um "await".
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // 1) Ler o restaurante e o menu de hoje.
  const carregar = useCallback(async () => {
    try {
      const meuRestaurante = await buscarMeuRestaurante(donoId);
      const menuDeHoje = meuRestaurante ? await buscarMenuDeHoje(meuRestaurante.id) : null;
      if (!montado.current) return;
      setRestaurante(meuRestaurante);
      setMenu(menuDeHoje);
      setAviso(null);
      setEstado('pronto');
    } catch (erro) {
      if (!montado.current) return;
      setErroAoCarregar(erro.message);
      setAviso(erro.message);
      // Se já havia dados no ecrã, ficam lá (só aparece o aviso). Se não havia nada, mostra o ecrã de erro.
      setEstado((atual) => (atual === 'pronto' ? 'pronto' : 'erro'));
    }
  }, [donoId]);

  // Recarrega sempre que o Painel volta a ficar à frente: depois de publicar, ao mudar de separador
  // e também depois da meia-noite, quando o menu de ontem deixa de valer (RN01).
  useFocusEffect(
    useCallback(() => {
      if (donoId) carregar();
    }, [donoId, carregar])
  );

  function tentarOutraVez() {
    setEstado('aCarregar');
    carregar();
  }

  async function atualizar() {
    setAAtualizar(true);
    await carregar();
    if (montado.current) setAAtualizar(false);
  }

  // Muda um prato só no ecrã (o menu fica igual, com esse prato alterado).
  function mudarPratoNoEcra(pratoId, alteracoes) {
    setMenu((atual) => atual && { ...atual, pratos: atual.pratos.map((prato) => (prato.id === pratoId ? { ...prato, ...alteracoes } : prato)) });
  }

  // 4) Tempo real: quando um prato muda na base de dados (por exemplo, noutro telemóvel do
  // restaurante), o Supabase avisa e o prato é atualizado aqui. A função devolvida pára de ouvir.
  useEffect(() => {
    return ouvirAlteracoesPratos((pratoNovo) => {
      setMenu((atual) => atual && { ...atual, pratos: atual.pratos.map((prato) => (prato.id === pratoNovo.id ? { ...prato, ...pratoNovo } : prato)) });
    });
  }, []);

  // 3) Interruptor "Esgotado" e botão "Últimas doses". As duas coisas funcionam da mesma maneira:
  // o ecrã muda logo, a alteração é gravada e, se a gravação falhar, o prato volta ao que estava.
  async function mudarPrato(prato, alteracoes, gravar) {
    setAviso(null);
    vibrarLeve(); // o telemóvel confirma o toque
    const antes = { esgotado: prato.esgotado, ultimas_doses: prato.ultimas_doses };
    mudarPratoNoEcra(prato.id, alteracoes); // o ecrã responde logo...
    setAMudar((ids) => [...ids, prato.id]); // ...e os botões do prato ficam bloqueados até a gravação acabar
    try {
      await gravar();
    } catch (erro) {
      if (!montado.current) return;
      mudarPratoNoEcra(prato.id, antes); // não ficou gravado: volta atrás
      setAviso(erro.message);
    } finally {
      if (montado.current) setAMudar((ids) => ids.filter((id) => id !== prato.id));
    }
  }

  // um prato esgotado deixa de estar nas "últimas doses" (a base de dados faz o mesmo: marcarEsgotado)
  function alternarEsgotado(prato, esgotado) {
    const alteracoes = esgotado ? { esgotado: true, ultimas_doses: false } : { esgotado: false };
    mudarPrato(prato, alteracoes, () => marcarEsgotado(prato.id, esgotado));
  }

  function alternarUltimasDoses(prato) {
    const ultimas = !prato.ultimas_doses;
    const alteracoes = ultimas ? { ultimas_doses: true, esgotado: false } : { ultimas_doses: false };
    mudarPrato(prato, alteracoes, () => marcarUltimasDoses(prato.id, ultimas));
  }

  // 5) "Há mesa" / "Cheio" (ou null, para apagar o aviso). A hora certa é posta pela base de dados.
  async function escolherLotacao(lotacao) {
    setAviso(null);
    vibrarLeve();
    const antes = { lotacao: menu.lotacao, lotacao_em: menu.lotacao_em };
    setMenu((atual) => atual && { ...atual, lotacao, lotacao_em: lotacao ? new Date().toISOString() : null });
    setAGravarLotacao(true);
    try {
      const guardada = await marcarLotacao(menu.id, lotacao);
      if (montado.current) setMenu((atual) => atual && { ...atual, lotacao: guardada.lotacao, lotacao_em: guardada.lotacao_em });
    } catch (erro) {
      if (!montado.current) return;
      setMenu((atual) => atual && { ...atual, ...antes }); // não ficou gravado: volta atrás
      setAviso(erro.message);
    } finally {
      if (montado.current) setAGravarLotacao(false);
    }
  }

  // Partilhar o menu de hoje (WhatsApp, Instagram…): o telemóvel abre a janela de partilha com o texto pronto.
  async function partilharMenu() {
    setAviso(null);
    try {
      await partilhar(textoDoMenuDeHoje({ restaurante, menu }));
    } catch (erro) {
      if (montado.current) setAviso(erro.message);
    }
  }

  if (estado === 'aCarregar') return <Carregar />;
  if (estado === 'erro') return <EcraDeErro mensagem={erroAoCarregar} aoTentar={tentarOutraVez} />;

  const numeroDePratos = menu ? menu.pratos.length : 0;

  return (
    <Ecra>
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        refreshControl={<RefreshControl refreshing={aAtualizar} onRefresh={atualizar} tintColor={cores.acento} colors={[cores.acento]} />}
      >
        <View style={estilos.cabecalho}>
          <View style={estilos.ocuparTudo}>
            <Text style={texto.pequeno}>
              {saudacao()}, {perfil?.nome || 'restaurante'}
            </Text>
            <Text style={texto.titulo} accessibilityRole="header">
              {restaurante ? restaurante.nome : 'Painel'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.navigate('/perfil')}
            accessibilityRole="button"
            accessibilityLabel="Abrir o perfil do restaurante"
            style={estilos.botaoDoPerfil}
          >
            <Icone name="storefront-outline" size={22} color={cores.acento} />
          </Pressable>
        </View>

        {aviso && (
          <Text style={estilos.aviso} accessibilityRole="alert">
            {aviso}
          </Text>
        )}

        {/* Situação A: a conta ainda não tem perfil de restaurante */}
        {!restaurante && (
          <>
            <View style={[estilos.estadoDoMenu, estilos.estadoNeutro]}>
              <View style={[estilos.bola, estilos.bolaNeutra]}>
                <Icone name="storefront-outline" size={20} color={cores.acento} />
              </View>
              <View style={estilos.ocuparTudo}>
                <Text style={estilos.estadoTitulo}>Primeiro, o perfil do restaurante</Text>
                <Text style={texto.pequeno}>Os clientes precisam de saber o nome e onde fica o restaurante antes de verem o menu.</Text>
              </View>
            </View>
            <Botao titulo="Preencher o perfil" icone="storefront-outline" onPress={() => router.navigate('/perfil')} />
          </>
        )}

        {/* Situação B: há restaurante, mas hoje ainda não há menu */}
        {restaurante && !menu && (
          <>
            <View style={[estilos.estadoDoMenu, estilos.estadoNeutro]}>
              <View style={[estilos.bola, estilos.bolaNeutra]}>
                <Icone name="time-outline" size={20} color={cores.acento} />
              </View>
              <View style={estilos.ocuparTudo}>
                <Text style={estilos.estadoTitulo}>Ainda não publicaste o menu de hoje</Text>
                <Text style={texto.pequeno}>{diaPorExtenso()}</Text>
              </View>
            </View>
            <Botao titulo="Publicar menu de hoje" icone="add" onPress={() => router.push('/publicar')} />
          </>
        )}

        {/* Situação C: menu de hoje publicado */}
        {restaurante && menu && (
          <>
            <View style={[estilos.estadoDoMenu, estilos.estadoPublicado]}>
              <View style={[estilos.bola, estilos.bolaPublicado]}>
                <Icone name="checkmark" size={20} color={cores.textoInverso} />
              </View>
              <View style={estilos.ocuparTudo}>
                <Text style={estilos.estadoTitulo}>Menu de hoje publicado</Text>
                <Text style={texto.pequeno}>Às {horaCurta(menu.publicado_em)} · visível até à meia-noite</Text>
              </View>
            </View>

            <EscolherLotacao menu={menu} aoEscolher={escolherLotacao} aGravar={aGravarLotacao} />

            <View style={estilos.cabecalhoDaLista}>
              <Text style={[texto.subtitulo, estilos.ocuparTudo]} accessibilityRole="header">
                Pratos de hoje
              </Text>
              <Text style={texto.pequeno}>
                {numeroDePratos} {numeroDePratos === 1 ? 'prato' : 'pratos'}
              </Text>
            </View>

            {numeroDePratos === 0 ? (
              <Text style={texto.pequeno}>O menu de hoje ficou sem pratos. Carrega em &quot;Editar menu de hoje&quot; para os adicionar.</Text>
            ) : (
              <Text style={texto.pequeno}>
                Quando um prato estiver quase a acabar, toca em &quot;Últimas doses&quot;. Quando acabar, liga o interruptor. Os clientes
                veem logo.
              </Text>
            )}

            {menu.pratos.map((prato) => (
              <View key={prato.id} style={estilos.prato}>
                <View style={[estilos.ocuparTudo, estilos.pratoTextos]}>
                  <Text style={[estilos.pratoNome, prato.esgotado && estilos.pratoNomeEsgotado]}>{prato.nome}</Text>
                  <Text style={texto.pequeno}>{formatarPreco(prato.preco)}</Text>
                  {!prato.esgotado ? (
                    <Pressable
                      onPress={() => alternarUltimasDoses(prato)}
                      disabled={aMudar.includes(prato.id)}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: Boolean(prato.ultimas_doses), disabled: aMudar.includes(prato.id) }}
                      accessibilityLabel={`${prato.nome}: últimas doses`}
                      // 30 px de altura + hitSlop de 8 em cima e em baixo = 46 px de área de toque (RNF06)
                      hitSlop={8}
                      style={[estilos.ultimas, prato.ultimas_doses && estilos.ultimasLigado]}
                    >
                      <Icone name="hourglass-outline" size={14} color={prato.ultimas_doses ? cores.textoInverso : cores.acentoTexto} />
                      <Text style={[estilos.ultimasTexto, prato.ultimas_doses && estilos.ultimasTextoLigado]}>Últimas doses</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={[estilos.rotuloEsgotado, prato.esgotado && estilos.rotuloEsgotadoLigado]}>Esgotado</Text>
                <Switch
                  value={prato.esgotado}
                  onValueChange={(valor) => alternarEsgotado(prato, valor)}
                  disabled={aMudar.includes(prato.id)}
                  trackColor={{ false: cores.linha, true: cores.acento }}
                  thumbColor={cores.superficie}
                  ios_backgroundColor={cores.linha}
                  accessibilityLabel={`${prato.nome}: esgotado`}
                />
              </View>
            ))}

            {menu.preco_menu_completo !== null && (
              <Text style={texto.pequeno}>Menu completo: {formatarPreco(menu.preco_menu_completo)}</Text>
            )}

            <Botao titulo="Editar menu de hoje" icone="create-outline" onPress={() => router.push('/publicar')} />
            {numeroDePratos > 0 ? (
              <Botao tipo="secundario" titulo="Partilhar o menu de hoje" icone="share-social-outline" onPress={partilharMenu} />
            ) : null}
          </>
        )}

        {restaurante ? (
          <>
            <Botao tipo="secundario" titulo="QR code e cartaz para a porta" icone="qr-code-outline" onPress={() => setQrAberto(true)} />
            <QrDoRestaurante restaurante={restaurante} menu={menu} visivel={qrAberto} aoFechar={() => setQrAberto(false)} />
          </>
        ) : null}
      </ScrollView>
    </Ecra>
  );
}

const estilos = StyleSheet.create({
  ocuparTudo: { flex: 1 },
  conteudo: { padding: espaco.xl, paddingTop: espaco.s, gap: espaco.l },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  // 44 x 44: área de toque mínima (RNF06)
  botaoDoPerfil: { width: 44, height: 44, borderRadius: raio.pilula, backgroundColor: cores.acentoSuave, alignItems: 'center', justifyContent: 'center' },
  aviso: { ...texto.corpo, color: cores.erro },
  estadoDoMenu: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, padding: espaco.l, borderRadius: raio.l },
  estadoPublicado: { backgroundColor: cores.sucessoSuave },
  estadoNeutro: { backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.linha },
  estadoTitulo: { ...texto.corpo, fontFamily: fontes.semi },
  bola: { width: 36, height: 36, borderRadius: raio.pilula, alignItems: 'center', justifyContent: 'center' },
  bolaPublicado: { backgroundColor: cores.sucesso },
  bolaNeutra: { backgroundColor: cores.acentoSuave },
  cabecalhoDaLista: { flexDirection: 'row', alignItems: 'center', paddingTop: espaco.xs },
  prato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.l,
    paddingVertical: espaco.m,
    minHeight: 68,
    borderRadius: raio.l,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  pratoNome: { fontSize: 16, fontFamily: fontes.semi, color: cores.texto },
  // Esgotado = texto cinzento riscado (regra de design do projeto)
  pratoNomeEsgotado: { color: cores.textoTerciario, textDecorationLine: 'line-through' },
  rotuloEsgotado: { fontSize: 13, fontFamily: fontes.media, color: cores.textoSecundario },
  rotuloEsgotadoLigado: { color: cores.acento },
  pratoTextos: { gap: 2 },
  ultimas: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.xs,
    height: 30,
    marginTop: espaco.xs,
    paddingHorizontal: espaco.m,
    borderRadius: raio.pilula,
    borderWidth: 1.5,
    borderColor: cores.acentoSuave,
    backgroundColor: cores.superficie,
  },
  ultimasLigado: { backgroundColor: cores.acento, borderColor: cores.acento },
  ultimasTexto: { fontSize: 13, fontFamily: fontes.semi, color: cores.acentoTexto },
  ultimasTextoLigado: { color: cores.textoInverso },
});
