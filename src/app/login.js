import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CampoComErro } from '@/components/CampoComErro';
import { Botao, Ecra, Logo } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { validarConta } from '@/lib/validarConta';
import { cores, espaco, raio, texto } from '@/theme';

// Ecrã 1 · Login / Registo (RF01) — igual ao mock-up do Figma, mais a recuperação de palavra-passe.
//
// O ecrã tem quatro "modos" (estado "modo"):
//   'entrar'           email + palavra-passe
//   'criar'            nome + email + palavra-passe + tipo de conta
//   'pedirCodigo'      recuperação, passo 1: pede o email e envia um código
//   'novaPalavraPasse' recuperação, passo 2: código do email + palavra-passe nova
// Antes de falar com o servidor, validarConta() confirma os campos e mostra o erro por baixo de cada um.
export default function Login() {
  const { entrar, criarConta, recuperarPalavraPasse, redefinirPalavraPasse } = useAuth();
  const [modo, setModo] = useState('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [palavraPasse, setPalavraPasse] = useState('');
  const [codigo, setCodigo] = useState('');
  const [tipo, setTipo] = useState('cliente');
  const [verPalavraPasse, setVerPalavraPasse] = useState(false);
  const [erros, setErros] = useState({}); // um erro por campo
  const [aCarregar, setACarregar] = useState(false);
  const [mensagem, setMensagem] = useState(null); // { tipo: 'erro' | 'info', texto }

  // Referências aos campos, para a tecla "Seguinte" do teclado saltar para o campo seguinte.
  const campoEmail = useRef(null);
  const campoCodigo = useRef(null);
  const campoPalavraPasse = useRef(null);

  // Quando o login corre bem a navegação muda e este ecrã é desmontado.
  // "montado" evita mexer no estado depois disso.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const criar = modo === 'criar';
  const aRecuperar = modo === 'pedirCodigo' || modo === 'novaPalavraPasse';

  function mudarModo(novoModo, novaMensagem = null) {
    setModo(novoModo);
    setErros({});
    setMensagem(novaMensagem);
    // ao entrar ou sair da recuperação, a palavra-passe e o código começam vazios
    if (novoModo === 'pedirCodigo' || novoModo === 'novaPalavraPasse' || aRecuperar) {
      setPalavraPasse('');
      setCodigo('');
    }
  }

  // Guarda o valor de um campo e apaga o erro desse campo.
  function alterar(campo, guardar, valor) {
    guardar(valor);
    setErros((atuais) => ({ ...atuais, [campo]: undefined }));
  }

  async function submeter() {
    if (aCarregar) return; // evita enviar duas vezes
    Keyboard.dismiss();
    setMensagem(null);

    const errosEncontrados = validarConta({ modo, nome, email, palavraPasse, codigo });
    setErros(errosEncontrados);
    if (Object.keys(errosEncontrados).length > 0) return;

    setACarregar(true);
    let erro;
    if (modo === 'entrar') erro = await entrar(email, palavraPasse);
    else if (modo === 'criar') erro = await criarConta({ nome, email, palavraPasse, tipo });
    else if (modo === 'pedirCodigo') erro = await recuperarPalavraPasse(email);
    else erro = await redefinirPalavraPasse({ email, codigo, novaPalavraPasse: palavraPasse });

    // se correu bem ao entrar, a navegação muda sozinha (ver src/app/_layout.js) e o ecrã já não existe
    if (!montado.current) return;
    setACarregar(false);

    if (erro) {
      setMensagem({ tipo: 'erro', texto: erro });
    } else if (modo === 'pedirCodigo') {
      mudarModo('novaPalavraPasse', {
        tipo: 'info',
        texto: `Enviámos um código para ${email.trim()}. Escreve-o aqui e escolhe a palavra-passe nova.`,
      });
    }
  }

  // Tecla "Seguinte" no campo do email: o que vem a seguir depende do modo.
  function depoisDoEmail() {
    if (modo === 'pedirCodigo') submeter();
    else if (modo === 'novaPalavraPasse') campoCodigo.current?.focus();
    else campoPalavraPasse.current?.focus();
  }

  const tituloDoBotao = {
    entrar: 'Entrar',
    criar: 'Criar conta',
    pedirCodigo: 'Enviar código',
    novaPalavraPasse: 'Guardar palavra-passe nova',
  }[modo];

  return (
    <Ecra bordas={['top', 'bottom']}>
      {/* behavior="padding" nas duas plataformas: é o que o guia do Expo recomenda,
          porque no Android a janela já não encolhe sozinha quando o teclado abre. */}
      <KeyboardAvoidingView style={estilos.ocuparTudo} behavior="padding">
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <View style={estilos.marca}>
            <Logo />
            <Text style={texto.pequeno}>O prato do dia perto de ti</Text>
          </View>

          {aRecuperar ? (
            <View style={estilos.grupo}>
              <Text style={texto.subtitulo} accessibilityRole="header">
                Recuperar palavra-passe
              </Text>
              {modo === 'pedirCodigo' && (
                <Text style={texto.pequeno}>Escreve o email da tua conta. Enviamos-te um código para escolheres uma palavra-passe nova.</Text>
              )}
            </View>
          ) : (
            <View style={estilos.segmento}>
              {[
                ['entrar', 'Entrar'],
                ['criar', 'Criar conta'],
              ].map(([valor, rotulo]) => (
                <Pressable
                  key={valor}
                  onPress={() => mudarModo(valor)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: modo === valor }}
                  style={[estilos.segmentoOpcao, modo === valor && estilos.segmentoAtivo]}
                >
                  <Text style={[estilos.segmentoTexto, modo === valor && estilos.segmentoTextoAtivo]}>{rotulo}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {criar && (
            <CampoComErro
              etiqueta="Nome"
              value={nome}
              onChangeText={(valor) => alterar('nome', setNome, valor)}
              erro={erros.nome}
              placeholder="O teu nome"
              autoComplete="name"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => campoEmail.current?.focus()}
            />
          )}

          <CampoComErro
            ref={campoEmail}
            etiqueta="Email"
            value={email}
            onChangeText={(valor) => alterar('email', setEmail, valor)}
            erro={erros.email}
            placeholder="nome@email.pt"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType={modo === 'pedirCodigo' ? 'send' : 'next'}
            submitBehavior="submit"
            onSubmitEditing={depoisDoEmail}
          />

          {modo === 'novaPalavraPasse' && (
            <CampoComErro
              ref={campoCodigo}
              etiqueta="Código do email"
              value={codigo}
              onChangeText={(valor) => alterar('codigo', setCodigo, valor.replace(/\D/g, ''))}
              erro={erros.codigo}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={10}
              autoComplete="one-time-code"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => campoPalavraPasse.current?.focus()}
            />
          )}

          {modo !== 'pedirCodigo' && (
            <View style={estilos.grupo}>
              <CampoComErro
                ref={campoPalavraPasse}
                etiqueta={modo === 'novaPalavraPasse' ? 'Palavra-passe nova' : 'Palavra-passe'}
                value={palavraPasse}
                onChangeText={(valor) => alterar('palavraPasse', setPalavraPasse, valor)}
                erro={erros.palavraPasse}
                placeholder="Pelo menos 6 caracteres"
                secureTextEntry={!verPalavraPasse}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                returnKeyType="go"
                onSubmitEditing={submeter}
              />
              {/* Ver o que se escreveu evita erros de digitação (por exemplo, menos de 6 caracteres). */}
              <Pressable
                onPress={() => setVerPalavraPasse((ver) => !ver)}
                accessibilityRole="switch"
                accessibilityState={{ checked: verPalavraPasse }}
                accessibilityLabel="Mostrar palavra-passe"
                style={estilos.ligacao}
              >
                <Ionicons name={verPalavraPasse ? 'eye-off-outline' : 'eye-outline'} size={18} color={cores.textoSecundario} />
                <Text style={texto.pequeno}>{verPalavraPasse ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}</Text>
              </Pressable>
            </View>
          )}

          {criar && (
            <View style={estilos.grupo}>
              <Text style={texto.etiqueta}>Tipo de conta</Text>
              <View style={estilos.opcoes}>
                <OpcaoTipo icone="person-outline" titulo="Cliente" descricao="Procuro onde almoçar" ativa={tipo === 'cliente'} onPress={() => setTipo('cliente')} />
                <OpcaoTipo icone="storefront-outline" titulo="Restaurante" descricao="Quero publicar o menu" ativa={tipo === 'restaurante'} onPress={() => setTipo('restaurante')} />
              </View>
            </View>
          )}

          {mensagem && (
            <Text style={mensagem.tipo === 'erro' ? estilos.mensagemErro : estilos.mensagemInfo} accessibilityRole="alert">
              {mensagem.texto}
            </Text>
          )}

          <Botao titulo={tituloDoBotao} onPress={submeter} aCarregar={aCarregar} />

          {modo === 'entrar' && <Ligacao titulo="Esqueci-me da palavra-passe" onPress={() => mudarModo('pedirCodigo')} />}
          {modo === 'pedirCodigo' && <Ligacao titulo="Já tenho um código" onPress={() => mudarModo('novaPalavraPasse')} />}
          {modo === 'novaPalavraPasse' && <Ligacao titulo="Pedir outro código" onPress={() => mudarModo('pedirCodigo')} />}
          {aRecuperar && <Ligacao titulo="Voltar a entrar" onPress={() => mudarModo('entrar')} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Ecra>
  );
}

// Ligação de texto (laranja) por baixo do botão principal.
function Ligacao({ titulo, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={estilos.ligacaoCentro}>
      <Text style={estilos.ligacaoTexto}>{titulo}</Text>
    </Pressable>
  );
}

function OpcaoTipo({ icone, titulo, descricao, ativa, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: ativa }} style={[estilos.opcao, ativa && estilos.opcaoAtiva]}>
      <Ionicons name={icone} size={22} color={ativa ? cores.acento : cores.textoSecundario} />
      <Text style={estilos.opcaoTitulo}>{titulo}</Text>
      <Text style={estilos.opcaoDescricao}>{descricao}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  ocuparTudo: { flex: 1 },
  conteudo: { padding: espaco.xl, gap: espaco.l, paddingTop: espaco.xxl },
  marca: { gap: espaco.s, marginBottom: espaco.s },
  grupo: { gap: espaco.s },
  segmento: { flexDirection: 'row', backgroundColor: cores.linha, borderRadius: raio.m, padding: 4, gap: 4 },
  segmentoOpcao: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentoAtivo: { backgroundColor: cores.superficie },
  segmentoTexto: { fontSize: 15, fontWeight: '500', color: cores.textoSecundario },
  segmentoTextoAtivo: { color: cores.texto, fontWeight: '600' },
  opcoes: { flexDirection: 'row', gap: espaco.m },
  opcao: { flex: 1, gap: 6, padding: 14, borderRadius: raio.l, backgroundColor: cores.superficie, borderWidth: 1.5, borderColor: cores.linha },
  opcaoAtiva: { backgroundColor: cores.acentoSuave, borderColor: cores.acento, borderWidth: 2 },
  opcaoTitulo: { fontSize: 15, fontWeight: '600', color: cores.texto },
  opcaoDescricao: { fontSize: 12, color: cores.textoSecundario },
  mensagemErro: { ...texto.corpo, color: cores.erro },
  mensagemInfo: { ...texto.corpo, color: cores.sucesso },
  // minHeight 44: área de toque mínima (RNF06)
  ligacao: { flexDirection: 'row', alignItems: 'center', gap: espaco.s, minHeight: 44, alignSelf: 'flex-start' },
  ligacaoCentro: { alignSelf: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: espaco.s },
  ligacaoTexto: { ...texto.pequeno, color: cores.acento, fontWeight: '600' },
});
