import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SeletorFoto } from '@/components/SeletorFoto';
import { SeletorLocal } from '@/components/SeletorLocal';
import { Botao, Campo, Carregar, Ecra } from '@/components/ui';
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

// Ecrã 7 · Perfil do restaurante (RF02) — responsável: Rodrigo
//
// Como funciona:
//  1. Ao abrir, vai buscar o restaurante desta conta (pode ainda não existir).
//  2. O que a pessoa escreve fica no estado "dados" (um objeto com todos os campos).
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
        setDados(restauranteParaFormulario(restaurante));
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

  // Fotografia escolhida na galeria: fica só no telemóvel até se carregar em Guardar.
  function escolherFoto(uriLocal) {
    if (!montado.current) return;
    setFotoLocal(uriLocal);
    setMensagem(null);
  }

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

      // b) Grava o restaurante (com o link da fotografia).
      await guardarRestaurante(donoId, { ...dados, fotoUrl });
      if (!montado.current) return;
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

  // null enquanto o restaurante não tiver ponto marcado (o mapa abre centrado no Porto, sem pin)
  const temPonto = dados.latitude !== null && dados.longitude !== null;
  const ponto = temPonto ? { latitude: dados.latitude, longitude: dados.longitude } : null;

  if (estado === 'aCarregar') return <Carregar />;

  if (estado === 'erro') {
    return (
      <Ecra>
        <View style={estilos.centro}>
          <Ionicons name="cloud-offline-outline" size={40} color={cores.textoTerciario} style={estilos.iconeCentro} />
          <Text style={[texto.corpo, estilos.textoCentro]}>{erroAoCarregar}</Text>
          <Botao titulo="Tentar outra vez" icone="refresh-outline" onPress={tentarOutraVez} />
          <Botao tipo="secundario" icone="log-out-outline" titulo="Terminar sessão" onPress={sair} />
        </View>
      </Ecra>
    );
  }

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
              <SeletorFoto uri={fotoLocal ?? dados.fotoUrl} aoEscolher={escolherFoto} aEnviar={aEnviarFoto} />
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

          <Botao titulo={jaExiste ? 'Guardar alterações' : 'Guardar perfil'} onPress={guardar} aCarregar={aGuardar} />

          <Text style={[texto.pequeno, estilos.textoCentro]}>{sessao?.user?.email}</Text>
          <Botao tipo="secundario" icone="log-out-outline" titulo="Terminar sessão" onPress={sair} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Ecra>
  );
}

// Um campo do formulário com a mensagem de erro por baixo (a vermelho), quando existe.
// Recebe as mesmas propriedades do <Campo> de ui.js, mais "erro".
function CampoComErro({ erro, ...props }) {
  return (
    <View style={estilos.grupoPequeno}>
      {/* accessibilityLabel: o leitor de ecrã diz o nome do campo */}
      <Campo accessibilityLabel={props.etiqueta} {...props} />
      {erro ? <Text style={estilos.erroCampo}>{erro}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  ocuparTudo: { flex: 1 },
  conteudo: { padding: espaco.xl, gap: espaco.l },
  campos: { gap: espaco.l },
  centro: { flex: 1, justifyContent: 'center', padding: espaco.xl, gap: espaco.l },
  iconeCentro: { alignSelf: 'center' },
  textoCentro: { textAlign: 'center' },
  grupo: { gap: espaco.s },
  grupoPequeno: { gap: espaco.xs },
  linha: { flexDirection: 'row', gap: espaco.m },
  metade: { flex: 1 },
  erroCampo: { ...texto.pequeno, color: cores.erro },
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
