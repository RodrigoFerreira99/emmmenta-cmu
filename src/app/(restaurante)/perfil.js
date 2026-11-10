import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CampoComErro } from '@/components/CampoComErro';
import { EcraDeErro } from '@/components/EcraDeErro';
import { SeletorFoto } from '@/components/SeletorFoto';
import { SeletorLocal } from '@/components/SeletorLocal';
import { Botao, Carregar, Ecra } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import {
  buscarMeuRestaurante,
  enviarFotoRestaurante,
  guardarRestaurante,
  mascararHora,
  restauranteParaFormulario,
  validarRestaurante,
} from '@/services/restaurantes';
import { cores, espaco, raio, texto } from '@/theme';

// Nome de cada campo, para a mensagem "Falta corrigir: ..." junto ao botão Guardar.
const NOMES_DOS_CAMPOS = {
  nome: 'nome',
  tipoCozinha: 'tipo de cozinha',
  morada: 'morada',
  local: 'ponto no mapa',
  horaAbertura: 'hora de abertura',
  horaFecho: 'hora de fecho',
  telefone: 'telefone',
};

// true se algum campo do formulário for diferente do que está guardado na base de dados.
function haDiferencas(formulario, guardado) {
  return Object.keys(formulario).some((campo) => formulario[campo] !== guardado[campo]);
}

// Ecrã 7 · Perfil do restaurante (RF02) — responsável: Rodrigo
//
// Como funciona:
//  1. Ao abrir, vai buscar o restaurante desta conta (pode ainda não existir).
//  2. O que a pessoa escreve fica no estado "dados" (um objeto com todos os campos).
//     O estado "guardado" tem a cópia do que está na base de dados, para saber se há alterações.
//  3. "Guardar" valida tudo, envia a fotografia (se houver uma nova) e grava na base de dados
//     (cria o restaurante na 1.ª vez, atualiza-o depois).
// O acesso aos dados é todo feito pelas funções de src/services/restaurantes.js (RNF09).
export default function PerfilRestaurante() {
  const { sessao, sair } = useAuth();
  const donoId = sessao?.user?.id;

  const [estado, setEstado] = useState('aCarregar'); // 'aCarregar' | 'erro' | 'pronto'
  const [erroAoCarregar, setErroAoCarregar] = useState(null);
  const [tentativa, setTentativa] = useState(0); // aumenta quando se carrega em "Tentar outra vez"
  const [jaExiste, setJaExiste] = useState(false); // esta conta já tem restaurante guardado?
  const [dados, setDados] = useState(() => restauranteParaFormulario(null));
  const [guardado, setGuardado] = useState(() => restauranteParaFormulario(null));
  const [erros, setErros] = useState({}); // um erro por campo, ex.: { nome: 'Escreve o nome...' }
  const [fotoLocal, setFotoLocal] = useState(null); // fotografia escolhida no telemóvel que ainda não foi enviada
  const [aGuardar, setAGuardar] = useState(false);
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [mensagem, setMensagem] = useState(null); // { tipo: 'sucesso' | 'erro', texto }

  // Referências aos campos, para a tecla "Seguinte" do teclado saltar para o campo seguinte.
  const campoTipo = useRef(null);
  const campoMorada = useRef(null);
  const campoFecho = useRef(null);
  const campoTelefone = useRef(null);

  // Fica a false quando o ecrã é desmontado (por exemplo, terminar sessão a meio de guardar).
  // Depois de cada "await" confirmamos este valor antes de mexer no estado.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // 1) Carregar o restaurante ao abrir o ecrã (e outra vez em "Tentar outra vez").
  useEffect(() => {
    if (!donoId) return;
    let ativo = true; // se o ecrã for desmontado a meio, a resposta é ignorada
    buscarMeuRestaurante(donoId)
      .then((restaurante) => {
        if (!ativo) return;
        const formulario = restauranteParaFormulario(restaurante);
        setDados(formulario);
        setGuardado(formulario);
        setJaExiste(restaurante !== null);
        setEstado('pronto');
      })
      .catch((erro) => {
        if (!ativo) return;
        setErroAoCarregar(erro.message);
        setEstado('erro');
      });
    return () => {
      ativo = false;
    };
  }, [donoId, tentativa]);

  function tentarOutraVez() {
    setEstado('aCarregar');
    setTentativa((n) => n + 1);
  }

  // 2) Chamado sempre que um campo muda: guarda o valor novo e apaga o erro desse campo.
  function alterar(campo, valor) {
    setDados((atuais) => ({ ...atuais, [campo]: valor }));
    setErros((atuais) => ({ ...atuais, [campo]: undefined }));
    setMensagem(null);
  }

  // As horas levam os dois pontos automaticamente ("1230" → "12:30").
  function alterarHora(campo, valor) {
    alterar(campo, mascararHora(valor));
    // o erro "o fecho tem de ser depois da abertura" depende dos dois campos: limpamos os dois
    setErros((atuais) => ({ ...atuais, horaAbertura: undefined, horaFecho: undefined }));
  }

  // O ponto do restaurante no mapa (tocar no mapa, arrastar o pin ou "Encontrar a morada").
  function mudarPonto({ latitude, longitude }) {
    setDados((atuais) => ({ ...atuais, latitude, longitude }));
    setErros((atuais) => ({ ...atuais, local: undefined }));
    setMensagem(null);
  }

  // Fotografia tirada ou escolhida: fica só no telemóvel até se carregar em Guardar.
  function escolherFoto(uriLocal) {
    if (!montado.current) return;
    setFotoLocal(uriLocal);
    setMensagem(null);
  }

  // Tira a fotografia do perfil (a nova que ainda não foi enviada e a que já estava guardada).
  function removerFoto() {
    setFotoLocal(null);
    alterar('fotoUrl', null);
  }

  // Há alguma coisa por guardar? (um campo diferente ou uma fotografia nova por enviar)
  const temAlteracoes = fotoLocal !== null || haDiferencas(dados, guardado);

  // 3) Guardar: primeiro valida; só fala com o servidor se estiver tudo certo.
  async function guardar() {
    if (aGuardar) return; // evita enviar duas vezes (o botão também fica desativado)
    Keyboard.dismiss();
    setMensagem(null);

    const errosEncontrados = validarRestaurante(dados);
    setErros(errosEncontrados);
    const camposComErro = Object.keys(errosEncontrados);
    if (camposComErro.length > 0) {
      const lista = camposComErro.map((campo) => NOMES_DOS_CAMPOS[campo]).join(', ');
      setMensagem({ tipo: 'erro', texto: `Falta corrigir: ${lista}.` });
      return;
    }

    setAGuardar(true);
    try {
      // a) Se foi escolhida uma fotografia nova, envia-a primeiro e fica com o link público.
      let fotoUrl = dados.fotoUrl;
      if (fotoLocal) {
        setAEnviarFoto(true);
        fotoUrl = await enviarFotoRestaurante(donoId, fotoLocal);
        if (!montado.current) return;
        // O link fica já no formulário: se o passo b) falhar, ao tentar outra vez a foto não é enviada de novo.
        setDados((atuais) => ({ ...atuais, fotoUrl }));
        setFotoLocal(null);
        setAEnviarFoto(false);
      }

      // b) Grava o restaurante (com o link da fotografia) e fica com a linha tal como ficou guardada.
      const linhaGuardada = await guardarRestaurante(donoId, { ...dados, fotoUrl });
      if (!montado.current) return;
      // Os campos passam a mostrar exatamente o que ficou na base de dados
      // (por exemplo, o telefone já formatado e o nome sem espaços a mais).
      const formulario = restauranteParaFormulario(linhaGuardada);
      setDados(formulario);
      setGuardado(formulario);
      setJaExiste(true);
      setMensagem({ tipo: 'sucesso', texto: 'Perfil guardado' });
    } catch (erro) {
      // o que foi escrito continua nos campos: só mostramos a mensagem
      if (montado.current) setMensagem({ tipo: 'erro', texto: erro.message });
    } finally {
      if (montado.current) {
        setAGuardar(false);
        setAEnviarFoto(false);
      }
    }
  }

  // Terminar sessão com alterações por guardar: pergunta primeiro, para não se perder o que foi escrito.
  function terminarSessao() {
    if (!temAlteracoes) {
      sair();
      return;
    }
    Alert.alert('Alterações por guardar', 'Se terminares a sessão agora, perdes o que alteraste no perfil.', [
      { text: 'Continuar a editar', style: 'cancel' },
      { text: 'Terminar sessão', style: 'destructive', onPress: sair },
    ]);
  }

  // null enquanto o restaurante não tiver ponto marcado (o mapa abre centrado no Porto, sem pin)
  const temPonto = dados.latitude !== null && dados.longitude !== null;
  const ponto = temPonto ? { latitude: dados.latitude, longitude: dados.longitude } : null;

  if (estado === 'aCarregar') return <Carregar />;
  if (estado === 'erro') return <EcraDeErro mensagem={erroAoCarregar} aoTentar={tentarOutraVez} aoSair={sair} />;

  return (
    <Ecra>
      {/* behavior="padding" nas duas plataformas: é o que o guia do Expo recomenda,
          porque no Android a janela já não encolhe sozinha quando o teclado abre. */}
      <KeyboardAvoidingView style={estilos.ocuparTudo} behavior="padding">
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <Text style={texto.titulo} accessibilityRole="header">
            Perfil do restaurante
          </Text>
          {!jaExiste && <Text style={texto.pequeno}>Preenche o perfil para poderes publicar o menu do dia</Text>}

          {/* Enquanto está a guardar, os campos não aceitam toques: assim o que é gravado
              é exatamente o que está no ecrã e nada muda a meio. */}
          <View style={estilos.campos} pointerEvents={aGuardar ? 'none' : 'auto'}>
            <View style={estilos.grupo}>
              {/* mostra a fotografia nova (ainda no telemóvel) ou, se não houver, a que já está guardada */}
              <SeletorFoto
                uri={fotoLocal ?? dados.fotoUrl}
                aoEscolher={escolherFoto}
                aoRemover={removerFoto}
                aEnviar={aEnviarFoto}
              />
              {fotoLocal !== null && !aEnviarFoto && (
                <Text style={texto.pequeno}>A fotografia nova é enviada quando carregares em Guardar.</Text>
              )}
            </View>

            <CampoComErro
              etiqueta="Nome do restaurante"
              value={dados.nome}
              onChangeText={(valor) => alterar('nome', valor)}
              erro={erros.nome}
              placeholder="Tasca do Manuel"
              maxLength={80}
              autoCapitalize="words"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => campoTipo.current?.focus()}
            />

            <CampoComErro
              ref={campoTipo}
              etiqueta="Tipo de cozinha (opcional)"
              value={dados.tipoCozinha}
              onChangeText={(valor) => alterar('tipoCozinha', valor)}
              erro={erros.tipoCozinha}
              placeholder="Portuguesa"
              maxLength={40}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => campoMorada.current?.focus()}
            />

            <CampoComErro
              ref={campoMorada}
              etiqueta="Morada"
              value={dados.morada}
              onChangeText={(valor) => alterar('morada', valor)}
              erro={erros.morada}
              placeholder="Rua de Cedofeita, 123, Porto"
              returnKeyType="done"
            />

            <SeletorLocal ponto={ponto} aoMudarPonto={mudarPonto} morada={dados.morada} erro={erros.local} />

            <View style={estilos.grupo}>
              <Text style={texto.etiqueta}>Horário de almoço (opcional)</Text>
              <View style={estilos.linha}>
                <View style={estilos.metade}>
                  <CampoComErro
                    etiqueta="Abre às"
                    value={dados.horaAbertura}
                    onChangeText={(valor) => alterarHora('horaAbertura', valor)}
                    erro={erros.horaAbertura}
                    placeholder="12:00"
                    keyboardType="number-pad"
                    maxLength={5}
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => campoFecho.current?.focus()}
                  />
                </View>
                <View style={estilos.metade}>
                  <CampoComErro
                    ref={campoFecho}
                    etiqueta="Fecha às"
                    value={dados.horaFecho}
                    onChangeText={(valor) => alterarHora('horaFecho', valor)}
                    erro={erros.horaFecho}
                    placeholder="15:00"
                    keyboardType="number-pad"
                    maxLength={5}
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => campoTelefone.current?.focus()}
                  />
                </View>
              </View>
            </View>

            <CampoComErro
              ref={campoTelefone}
              etiqueta="Telefone (opcional)"
              value={dados.telefone}
              onChangeText={(valor) => alterar('telefone', valor)}
              erro={erros.telefone}
              placeholder="222 000 000"
              keyboardType="phone-pad"
              maxLength={20}
              returnKeyType="done"
            />
          </View>

          {mensagem?.tipo === 'erro' && (
            <Text style={estilos.mensagemErro} accessibilityRole="alert">
              {mensagem.texto}
            </Text>
          )}
          {mensagem?.tipo === 'sucesso' && (
            <View style={estilos.sucesso} accessibilityRole="alert">
              <Ionicons name="checkmark-circle" size={20} color={cores.sucesso} />
              <Text style={estilos.sucessoTexto}>{mensagem.texto}</Text>
            </View>
          )}

          {/* Sem alterações não há nada para gravar: o botão fica desativado até se mexer em algum campo. */}
          <Botao
            titulo={jaExiste ? 'Guardar alterações' : 'Guardar perfil'}
            onPress={guardar}
            aCarregar={aGuardar}
            desativado={jaExiste && !temAlteracoes}
          />
          {jaExiste && !temAlteracoes && !mensagem && (
            <Text style={[texto.pequeno, estilos.textoCentro]}>Não há alterações por guardar.</Text>
          )}

          <Text style={[texto.pequeno, estilos.textoCentro]}>{sessao?.user?.email}</Text>
          <Botao tipo="secundario" icone="log-out-outline" titulo="Terminar sessão" onPress={terminarSessao} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Ecra>
  );
}

const estilos = StyleSheet.create({
  ocuparTudo: { flex: 1 },
  conteudo: { padding: espaco.xl, gap: espaco.l },
  campos: { gap: espaco.l },
  textoCentro: { textAlign: 'center' },
  grupo: { gap: espaco.s },
  linha: { flexDirection: 'row', gap: espaco.m },
  metade: { flex: 1 },
  mensagemErro: { ...texto.corpo, color: cores.erro },
  sucesso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.s,
    padding: espaco.m,
    borderRadius: raio.m,
    backgroundColor: cores.sucessoSuave,
  },
  sucessoTexto: { ...texto.corpo, fontWeight: '600', color: cores.sucesso },
});
