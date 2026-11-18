import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePreventRemove } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CampoComErro } from '@/components/CampoComErro';
import { Chip } from '@/components/Chip';
import { EcraDeErro } from '@/components/EcraDeErro';
import { LerMenuDaFoto } from '@/components/LerMenuDaFoto';
import { RepetirMenu } from '@/components/RepetirMenu';
import { SeletorFoto } from '@/components/SeletorFoto';
import { Botao, Campo, Carregar, Ecra } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { confirmar } from '@/lib/confirmar';
import { diaPorExtenso } from '@/lib/datas';
import { vibrarSucesso } from '@/lib/vibrar';
import {
  buscarMenuDeHoje,
  buscarUltimoMenuAnterior,
  haAlteracoesNosPratos,
  lerPreco,
  limparNome,
  nomeDaCategoria,
  precoParaCampo,
  publicarMenu,
  validarPrato,
} from '@/services/menus';
import { CATEGORIAS, descreverEtiquetas, ETIQUETAS, formatarPreco } from '@/services/pratos';
import { buscarMeuRestaurante, enviarFotoDoPrato } from '@/services/restaurantes';
import { cores, espaco, raio, texto } from '@/theme';

// Ecrã 6 · Publicar menu (RF03) — responsável: José
//
// Como funciona:
//  1. Ao abrir, vai buscar o restaurante da conta e o menu de hoje (se já foi publicado, é para editar).
//  2. Os pratos ficam numa lista no ecrã (estado "pratos"). Adicionar, alterar e remover só mexe
//     nessa lista — nada vai para a base de dados até se carregar em "Publicar menu".
//  3. "Publicar menu" grava tudo de uma vez (publicarMenu) e volta ao Painel.
// Em vez de escrever os pratos um a um, o dono pode repetir o último menu (cartão RepetirMenu)
// ou fotografar o menu (cartão LerMenuDaFoto): esses pratos entram na mesma lista, para serem
// confirmados e alterados antes de publicar.
// Cada prato pode ter etiquetas (Vegano, Sem glúten, Sem lactose, Picante) e uma fotografia, as duas
// opcionais. A fotografia é enviada logo que é tirada (enviarFotoDoPrato) e o prato guarda só o link.
// O acesso aos dados é todo feito pelas funções de src/services/ (RNF09).

// Um prato lido de uma fotografia pode vir sem preço (preco: null) quando não se conseguiu ler.
const semPreco = (prato) => !(prato.preco > 0);

export default function Publicar() {
  const { sessao } = useAuth();
  const donoId = sessao?.user?.id;
  const alturaDoCabecalho = useHeaderHeight();

  const [estado, setEstado] = useState('aCarregar'); // 'aCarregar' | 'erro' | 'semRestaurante' | 'pronto'
  const [erroAoCarregar, setErroAoCarregar] = useState(null);
  const [tentativa, setTentativa] = useState(0); // aumenta quando se carrega em "Tentar outra vez"
  const [restauranteId, setRestauranteId] = useState(null);
  const [jaPublicado, setJaPublicado] = useState(false); // hoje já havia menu?
  const [menuAnterior, setMenuAnterior] = useState(null); // o último menu antes de hoje, para o repetir

  // O menu como está guardado na base de dados (serve para saber se há alterações por publicar)...
  const [pratosGuardados, setPratosGuardados] = useState([]);
  const [precoMenuGuardado, setPrecoMenuGuardado] = useState('');
  // ...e o menu como está no ecrã. Cada prato: { chave, id (se já existia), nome, categoria, preco, etiquetas, foto_url }.
  const [pratos, setPratos] = useState([]);
  const [precoMenu, setPrecoMenu] = useState(''); // texto do campo "Preço do menu completo"
  const [erroDoPrecoMenu, setErroDoPrecoMenu] = useState(null);

  // Formulário "Adicionar prato" (ou "Alterar prato", quando chaveAEditar não é null).
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [categoria, setCategoria] = useState('carne');
  const [chaveAEditar, setChaveAEditar] = useState(null);
  const [errosDoPrato, setErrosDoPrato] = useState({});
  const [etiquetas, setEtiquetas] = useState([]); // por exemplo ['vegano', 'sem-gluten']
  const [foto, setFoto] = useState(null); // link da fotografia do prato, depois de enviada
  const [aEnviarFoto, setAEnviarFoto] = useState(false);

  const [aPublicar, setAPublicar] = useState(false);
  const [mensagem, setMensagem] = useState(null); // erro junto ao botão Publicar
  const [podeSair, setPodeSair] = useState(false); // true depois de publicar ou de escolher "Sair sem publicar"
  const [publicado, setPublicado] = useState(false);

  const deslizar = useRef(null); // o ScrollView, para voltar ao topo ao alterar um prato
  const campoNome = useRef(null);
  const campoPreco = useRef(null);
  const proximaChave = useRef(1); // para dar uma chave única aos pratos novos (ainda sem id)
  // Muda sempre que o formulário passa a ser de outro prato (limpar ou tocar noutro prato). Uma fotografia
  // que acabe de ser enviada depois disso já não é deste formulário, e é ignorada.
  const versaoDoFormulario = useRef(0);

  // Fica a false quando o ecrã é desmontado; confirmamos antes de mexer no estado depois de um "await".
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // 1) Carregar o restaurante e o menu de hoje.
  useEffect(() => {
    if (!donoId) return;
    let ativo = true; // se o ecrã for desmontado a meio, a resposta é ignorada

    async function carregar() {
      try {
        const restaurante = await buscarMeuRestaurante(donoId);
        if (!ativo) return;
        if (!restaurante) {
          setEstado('semRestaurante');
          return;
        }
        // Os dois pedidos ao mesmo tempo, para o ecrã abrir mais depressa. O menu anterior é só uma ajuda:
        // se falhar, o ecrã abre na mesma, sem o cartão "Repetir o menu".
        const [menu, anterior] = await Promise.all([
          buscarMenuDeHoje(restaurante.id),
          buscarUltimoMenuAnterior(restaurante.id).catch(() => null),
        ]);
        if (!ativo) return;

        const lista = (menu?.pratos ?? []).map((prato) => ({ ...prato, chave: prato.id }));
        const precoDoMenu = precoParaCampo(menu?.preco_menu_completo);
        setRestauranteId(restaurante.id);
        setJaPublicado(menu !== null);
        setMenuAnterior(anterior);
        setPratosGuardados(lista);
        setPratos(lista);
        setPrecoMenuGuardado(precoDoMenu);
        setPrecoMenu(precoDoMenu);
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
  }, [donoId, tentativa]);

  function tentarOutraVez() {
    setEstado('aCarregar');
    setTentativa((n) => n + 1);
  }

  // 2) Formulário do prato ---------------------------------------------------

  function limparFormulario() {
    versaoDoFormulario.current += 1;
    setNome('');
    setPreco('');
    setChaveAEditar(null);
    setErrosDoPrato({});
    setEtiquetas([]);
    setFoto(null);
  }

  // Tocar numa etiqueta liga-a ou desliga-a (podem escolher-se várias).
  function alternarEtiqueta(valor) {
    setEtiquetas((atuais) => (atuais.includes(valor) ? atuais.filter((etiqueta) => etiqueta !== valor) : [...atuais, valor]));
  }

  // Fotografia do prato: é comprimida e enviada logo (pode demorar uns segundos); o prato fica só com o link.
  async function escolherFotoDoPrato(caminho) {
    const versao = versaoDoFormulario.current;
    const aindaEOMesmoPrato = () => montado.current && versaoDoFormulario.current === versao;
    setErrosDoPrato((atuais) => ({ ...atuais, foto: undefined }));
    setAEnviarFoto(true);
    try {
      const link = await enviarFotoDoPrato(donoId, caminho);
      if (aindaEOMesmoPrato()) setFoto(link);
    } catch (erro) {
      if (aindaEOMesmoPrato()) setErrosDoPrato((atuais) => ({ ...atuais, foto: erro.message }));
    } finally {
      if (montado.current) setAEnviarFoto(false);
    }
  }

  // Botão "Adicionar prato" / "Guardar prato": valida e põe o prato na lista do ecrã.
  function guardarPrato() {
    setMensagem(null);
    if (aEnviarFoto) {
      setErrosDoPrato((atuais) => ({ ...atuais, foto: 'Espera que a fotografia acabe de ser enviada.' }));
      return;
    }
    const erros = validarPrato({ nome, preco, categoria });
    const nomeLimpo = limparNome(nome);
    // o mesmo prato duas vezes é quase sempre um engano de quem escreve depressa
    const repetido = pratos.some((prato) => prato.chave !== chaveAEditar && prato.nome.toLowerCase() === nomeLimpo.toLowerCase());
    if (!erros.nome && repetido) erros.nome = 'Este prato já está no menu.';
    setErrosDoPrato(erros);
    if (Object.keys(erros).length > 0) return;

    const prato = { nome: nomeLimpo, categoria, preco: lerPreco(preco), etiquetas, foto_url: foto };
    if (chaveAEditar) {
      // alterar: o prato fica no mesmo sítio da lista e mantém o id (a base de dados atualiza-o)
      setPratos((lista) => lista.map((item) => (item.chave === chaveAEditar ? { ...item, ...prato } : item)));
    } else {
      const chave = `novo-${proximaChave.current}`;
      proximaChave.current += 1;
      setPratos((lista) => [...lista, { ...prato, chave }]);
    }
    limparFormulario();
    // fica logo pronto para escrever o prato seguinte (RNF06: publicar em menos de 1 minuto)
    campoNome.current?.focus();
  }

  // Tocar num prato da lista: os dados sobem para o formulário, para serem alterados.
  function editarPrato(prato) {
    versaoDoFormulario.current += 1;
    setNome(prato.nome);
    setPreco(precoParaCampo(prato.preco));
    setCategoria(prato.categoria);
    setEtiquetas(prato.etiquetas ?? []);
    setFoto(prato.foto_url ?? null);
    setChaveAEditar(prato.chave);
    setErrosDoPrato({});
    setMensagem(null);
    deslizar.current?.scrollTo({ y: 0, animated: true });
    // se só falta o preço (prato lido de uma fotografia), o cursor vai logo para lá
    if (semPreco(prato)) campoPreco.current?.focus();
  }

  function removerPrato(chave) {
    setPratos((lista) => lista.filter((prato) => prato.chave !== chave));
    if (chave === chaveAEditar) limparFormulario();
    setMensagem(null);
  }

  // Junta à lista do ecrã pratos que vêm de fora (de uma fotografia ou de um menu anterior), como se
  // tivessem sido escritos à mão. Devolve os pratos que entraram.
  function juntarAoMenu(vindos, precoMenuCompleto) {
    setMensagem(null);

    // um prato que já está no menu não entra outra vez (por exemplo, ao fotografar o mesmo quadro duas vezes)
    const jaNoMenu = new Set(pratos.map((prato) => prato.nome.toLowerCase()));
    const novos = vindos
      .filter((vindo) => !jaNoMenu.has(vindo.nome.toLowerCase()))
      .map((vindo) => {
        const chave = `novo-${proximaChave.current}`;
        proximaChave.current += 1;
        // nunca um id de outro menu (seria tratado como um prato a alterar); as etiquetas e a fotografia
        // vêm do menu anterior (um prato lido de uma fotografia do menu não as tem)
        return {
          nome: vindo.nome,
          categoria: vindo.categoria,
          preco: vindo.preco,
          etiquetas: vindo.etiquetas ?? [],
          foto_url: vindo.foto_url ?? null,
          chave,
        };
      });
    if (novos.length > 0) setPratos((lista) => [...lista, ...novos]);

    // o preço do menu completo só é preenchido se o campo estiver vazio: não apaga o que o dono escreveu
    if (precoMenuCompleto && !precoMenu.trim()) setPrecoMenu(precoParaCampo(precoMenuCompleto));
    return novos;
  }

  // Botão "Usar estes pratos" do cartão "Repetir o menu". Devolve a frase que o cartão mostra a seguir.
  function repetirMenuAnterior() {
    const novos = juntarAoMenu(menuAnterior.pratos, menuAnterior.precoMenuCompleto);
    if (novos.length === 0) return 'Esses pratos já estão no menu de hoje.';
    const frase = novos.length === 1 ? 'Foi copiado 1 prato.' : `Foram copiados ${novos.length} pratos.`;
    return `${frase} Muda o que for diferente hoje e confirma os preços antes de publicar.`;
  }

  // Pratos lidos de uma fotografia. Devolve a frase que o cartão da fotografia mostra a seguir.
  function juntarPratosLidos({ pratos: lidos, precoMenuCompleto }) {
    const novos = juntarAoMenu(lidos, precoMenuCompleto);

    if (lidos.length === 0) {
      return 'Não foi possível ler nenhum prato nesta fotografia. Tenta com mais luz e com o menu a ocupar a imagem toda.';
    }
    if (novos.length === 0) return 'Os pratos desta fotografia já estavam no menu.';

    let frase = novos.length === 1 ? 'Foi lido 1 prato.' : `Foram lidos ${novos.length} pratos.`;
    frase += ' Confirma os nomes, as categorias e os preços antes de publicar.';
    const quantosSemPreco = novos.filter(semPreco).length;
    if (quantosSemPreco === 1) frase += ' Falta o preço de 1 prato: toca nele para o escrever.';
    if (quantosSemPreco > 1) frase += ` Falta o preço de ${quantosSemPreco} pratos: toca neles para o escrever.`;
    return frase;
  }

  // 3) Publicar ----------------------------------------------------------------

  // Há alguma coisa escrita no formulário que ainda não entrou na lista?
  const pratoPorAdicionar = nome.trim() !== '' || preco.trim() !== '';
  // O menu do ecrã é diferente do que está guardado?
  const temAlteracoes = haAlteracoesNosPratos(pratosGuardados, pratos) || lerPreco(precoMenu) !== lerPreco(precoMenuGuardado);

  async function publicar() {
    if (aPublicar) return; // evita enviar duas vezes (o botão também fica desativado)
    Keyboard.dismiss();
    setMensagem(null);
    setErroDoPrecoMenu(null);

    if (pratoPorAdicionar) {
      setMensagem('Tens um prato por adicionar. Carrega em "Adicionar prato" ou apaga o que escreveste.');
      return;
    }
    if (pratos.length === 0) {
      setMensagem('Adiciona pelo menos um prato antes de publicar.');
      return;
    }
    const quantosSemPreco = pratos.filter(semPreco).length;
    if (quantosSemPreco > 0) {
      setMensagem(
        quantosSemPreco === 1
          ? 'Falta o preço de 1 prato. Toca nele para o escrever.'
          : `Falta o preço de ${quantosSemPreco} pratos. Toca neles para o escrever.`
      );
      return;
    }
    // o preço do menu completo é opcional, mas se estiver escrito tem de ser um preço
    const precoMenuCompleto = precoMenu.trim() ? lerPreco(precoMenu) : null;
    if (precoMenu.trim() && !(precoMenuCompleto > 0)) {
      setErroDoPrecoMenu('O preço não é válido. Exemplo: 10,00');
      setMensagem('Falta corrigir o preço do menu completo.');
      return;
    }

    setAPublicar(true);
    try {
      await publicarMenu(restauranteId, { precoMenuCompleto, pratos });
      vibrarSucesso(); // o telemóvel confirma que ficou publicado
      if (!montado.current) return;
      setPodeSair(true);
      setPublicado(true); // o efeito abaixo volta ao Painel
    } catch (erro) {
      // a lista do ecrã mantém-se: pode tentar-se outra vez
      if (montado.current) setMensagem(erro.message);
    } finally {
      if (montado.current) setAPublicar(false);
    }
  }

  // Depois de publicar, volta ao Painel (que recarrega o menu ao ficar à frente).
  useEffect(() => {
    if (!publicado) return;
    if (router.canGoBack()) router.back();
    else router.replace('/painel');
  }, [publicado]);

  // Sair com alterações por publicar: pergunta primeiro, para não se perder o menu que foi escrito.
  // "repeat" continua a saída que tinha sido travada (botão voltar do cabeçalho ou do telemóvel).
  usePreventRemove(estado === 'pronto' && !podeSair && (temAlteracoes || pratoPorAdicionar), ({ repeat }) => {
    confirmar({
      titulo: 'Sair sem publicar?',
      mensagem: 'As alterações ao menu de hoje ainda não foram publicadas.',
      textoCancelar: 'Continuar a editar',
      textoConfirmar: 'Sair sem publicar',
      aoConfirmar: () => {
        setPodeSair(true);
        repeat();
      },
    });
  });

  if (estado === 'aCarregar') return <Carregar />;
  if (estado === 'erro') return <EcraDeErro mensagem={erroAoCarregar} aoTentar={tentarOutraVez} />;

  if (estado === 'semRestaurante') {
    return (
      <Ecra bordas={['bottom']}>
        <View style={estilos.centro}>
          <Ionicons name="storefront-outline" size={40} color={cores.textoTerciario} style={estilos.iconeCentro} />
          <Text style={[texto.corpo, estilos.textoCentro]}>Antes de publicares o menu, preenche o perfil do restaurante.</Text>
          {/* dismissTo: fecha este ecrã e volta aos separadores, já no Perfil */}
          <Botao titulo="Preencher o perfil" icone="storefront-outline" onPress={() => router.dismissTo('/perfil')} />
        </View>
      </Ecra>
    );
  }

  const errosDoFormulario = [errosDoPrato.nome, errosDoPrato.preco, errosDoPrato.categoria, errosDoPrato.foto].filter(Boolean);

  return (
    <Ecra bordas={['bottom']}>
      {/* keyboardVerticalOffset: este ecrã tem cabeçalho, e o teclado tem de contar com a altura dele */}
      <KeyboardAvoidingView style={estilos.ocuparTudo} behavior="padding" keyboardVerticalOffset={alturaDoCabecalho}>
        <ScrollView ref={deslizar} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          {/* Enquanto está a publicar, nada aceita toques: o que é gravado é o que está no ecrã. */}
          <View style={estilos.campos} pointerEvents={aPublicar ? 'none' : 'auto'}>
            <Text style={texto.pequeno}>{diaPorExtenso()}</Text>

            {/* só na primeira publicação do dia: ao editar um menu já publicado, já há pratos */}
            {!jaPublicado && menuAnterior ? <RepetirMenu menu={menuAnterior} aoRepetir={repetirMenuAnterior} /> : null}

            <LerMenuDaFoto aoLer={juntarPratosLidos} />

            <View style={estilos.cartao}>
              <Text style={texto.subtitulo} accessibilityRole="header">
                {chaveAEditar ? 'Alterar prato' : 'Adicionar prato'}
              </Text>

              <View style={estilos.linha}>
                <View style={estilos.ocuparTudo}>
                  <Campo
                    ref={campoNome}
                    etiqueta="Nome do prato"
                    accessibilityLabel="Nome do prato"
                    value={nome}
                    onChangeText={(valor) => {
                      setNome(valor);
                      setErrosDoPrato((atuais) => ({ ...atuais, nome: undefined }));
                    }}
                    placeholder="Arroz de pato"
                    maxLength={60}
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => campoPreco.current?.focus()}
                  />
                </View>
                <View style={estilos.campoDoPreco}>
                  <Campo
                    ref={campoPreco}
                    etiqueta="Preço (€)"
                    accessibilityLabel="Preço do prato em euros"
                    value={preco}
                    onChangeText={(valor) => {
                      setPreco(valor);
                      setErrosDoPrato((atuais) => ({ ...atuais, preco: undefined }));
                    }}
                    placeholder="9,50"
                    keyboardType="decimal-pad"
                    maxLength={7}
                    returnKeyType="done"
                    onSubmitEditing={guardarPrato}
                  />
                </View>
              </View>

              <View style={estilos.grupo}>
                <Text style={texto.etiqueta}>Categoria</Text>
                <View style={estilos.chips} accessibilityRole="radiogroup">
                  {CATEGORIAS.map((opcao) => (
                    <Chip key={opcao.valor} titulo={opcao.nome} ativo={categoria === opcao.valor} onPress={() => setCategoria(opcao.valor)} />
                  ))}
                </View>
              </View>

              <View style={estilos.grupo}>
                <Text style={texto.etiqueta}>Etiquetas (opcional)</Text>
                <View style={estilos.chips}>
                  {ETIQUETAS.map((opcao) => (
                    <Chip
                      key={opcao.valor}
                      titulo={opcao.nome}
                      multipla
                      ativo={etiquetas.includes(opcao.valor)}
                      onPress={() => alternarEtiqueta(opcao.valor)}
                    />
                  ))}
                </View>
              </View>

              <SeletorFoto
                titulo="Fotografia do prato (opcional)"
                rotulo="Fotografia do prato"
                icone="restaurant-outline"
                dica="Fotografa o prato de cima, com boa luz"
                doQue=" do prato"
                uri={foto}
                aEnviar={aEnviarFoto}
                aoEscolher={escolherFotoDoPrato}
                aoRemover={() => setFoto(null)}
              />

              {errosDoFormulario.length > 0 && (
                <Text style={estilos.erro} accessibilityRole="alert">
                  {errosDoFormulario.join(' ')}
                </Text>
              )}

              <Botao
                tipo="secundario"
                icone={chaveAEditar ? 'checkmark' : 'add'}
                titulo={chaveAEditar ? 'Guardar prato' : 'Adicionar prato'}
                onPress={guardarPrato}
              />
              {chaveAEditar && (
                <Pressable onPress={limparFormulario} accessibilityRole="button" style={estilos.ligacao}>
                  <Text style={estilos.ligacaoTexto}>Cancelar alteração</Text>
                </Pressable>
              )}
            </View>

            <View style={estilos.cabecalhoDaLista}>
              <Text style={[texto.subtitulo, estilos.ocuparTudo]} accessibilityRole="header">
                Pratos de hoje
              </Text>
              <Text style={texto.pequeno}>{pratos.length}</Text>
            </View>

            {pratos.length === 0 ? (
              <Text style={texto.pequeno}>Ainda não há pratos. Adiciona o primeiro em cima.</Text>
            ) : (
              <View style={estilos.grupo}>
                <View style={estilos.lista}>
                  {pratos.map((prato, indice) => (
                    <View
                      key={prato.chave}
                      style={[estilos.prato, indice > 0 && estilos.pratoComLinha, prato.chave === chaveAEditar && estilos.pratoAEditar]}
                    >
                      <Pressable
                        onPress={() => editarPrato(prato)}
                        accessibilityRole="button"
                        accessibilityLabel={`Alterar ${prato.nome}, ${semPreco(prato) ? 'falta o preço' : formatarPreco(prato.preco)}`}
                        style={estilos.pratoInfo}
                      >
                        {prato.foto_url ? <Image source={{ uri: prato.foto_url }} style={estilos.miniatura} /> : null}
                        <View style={estilos.ocuparTudo}>
                          <Text style={estilos.pratoNome}>{prato.nome}</Text>
                          <Text style={estilos.pratoCategoria}>
                            {[nomeDaCategoria(prato.categoria), descreverEtiquetas(prato.etiquetas)].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        {semPreco(prato) ? (
                          <Text style={estilos.pratoSemPreco}>Falta o preço</Text>
                        ) : (
                          <Text style={estilos.pratoPreco}>{formatarPreco(prato.preco)}</Text>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => removerPrato(prato.chave)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remover ${prato.nome}`}
                        style={estilos.remover}
                      >
                        <Ionicons name="close" size={18} color={cores.textoSecundario} />
                      </Pressable>
                    </View>
                  ))}
                </View>
                <Text style={texto.pequeno}>Toca num prato para o alterar, ou no X para o tirar do menu.</Text>
              </View>
            )}

            <View style={estilos.grupo}>
              <CampoComErro
                etiqueta="Preço do menu completo (opcional)"
                value={precoMenu}
                onChangeText={(valor) => {
                  setPrecoMenu(valor);
                  setErroDoPrecoMenu(null);
                  setMensagem(null);
                }}
                erro={erroDoPrecoMenu}
                placeholder="10,00"
                keyboardType="decimal-pad"
                maxLength={7}
                returnKeyType="done"
              />
              <Text style={texto.pequeno}>Um preço único para sopa, prato, bebida e café, se o restaurante tiver.</Text>
            </View>
          </View>
        </ScrollView>

        <View style={estilos.barra}>
          {mensagem && (
            <Text style={estilos.erro} accessibilityRole="alert">
              {mensagem}
            </Text>
          )}
          <Botao titulo={jaPublicado ? 'Guardar alterações' : 'Publicar menu'} onPress={publicar} aCarregar={aPublicar} />
          <Text style={estilos.notaDaBarra}>Fica visível até à meia-noite</Text>
        </View>
      </KeyboardAvoidingView>
    </Ecra>
  );
}

const estilos = StyleSheet.create({
  ocuparTudo: { flex: 1 },
  conteudo: { padding: espaco.xl, paddingTop: espaco.l },
  campos: { gap: espaco.l },
  centro: { flex: 1, justifyContent: 'center', padding: espaco.xl, gap: espaco.l },
  iconeCentro: { alignSelf: 'center' },
  textoCentro: { textAlign: 'center' },
  grupo: { gap: espaco.s },
  linha: { flexDirection: 'row', gap: espaco.m },
  campoDoPreco: { width: 100 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s },
  cartao: {
    gap: espaco.l,
    padding: espaco.l,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  erro: { ...texto.pequeno, color: cores.erro },
  // minHeight 44: área de toque mínima (RNF06)
  ligacao: { alignSelf: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: espaco.s },
  ligacaoTexto: { ...texto.pequeno, color: cores.acento, fontWeight: '600' },
  cabecalhoDaLista: { flexDirection: 'row', alignItems: 'center', paddingTop: espaco.xs },
  lista: { borderRadius: raio.xl, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie, overflow: 'hidden' },
  prato: { flexDirection: 'row', alignItems: 'center' },
  pratoComLinha: { borderTopWidth: 1, borderTopColor: cores.linha },
  pratoAEditar: { backgroundColor: cores.acentoSuave },
  pratoInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco.m, paddingLeft: espaco.l, paddingVertical: espaco.m, minHeight: 56 },
  pratoNome: { ...texto.corpo, fontWeight: '500' },
  pratoCategoria: { fontSize: 12, color: cores.textoSecundario },
  miniatura: { width: 40, height: 40, borderRadius: raio.s, backgroundColor: cores.acentoSuave },
  pratoPreco: { ...texto.corpo, fontWeight: '600' },
  pratoSemPreco: { ...texto.pequeno, color: cores.erro, fontWeight: '600' },
  remover: { width: 48, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  barra: {
    gap: espaco.s,
    paddingHorizontal: espaco.xl,
    paddingTop: espaco.m,
    paddingBottom: espaco.s,
    borderTopWidth: 1,
    borderTopColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  notaDaBarra: { fontSize: 12, color: cores.textoSecundario, textAlign: 'center' },
});
