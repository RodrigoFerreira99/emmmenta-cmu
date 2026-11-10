import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Botao, Campo, Ecra, Logo } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { cores, espaco, raio, texto } from '@/theme';

// Ecrã 1 · Login / Registo (RF01) — igual ao mock-up do Figma.
export default function Login() {
  const { entrar, criarConta, recuperarPalavraPasse } = useAuth();
  const [modo, setModo] = useState('entrar'); // 'entrar' | 'criar'
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [palavraPasse, setPalavraPasse] = useState('');
  const [tipo, setTipo] = useState('cliente');
  const [aCarregar, setACarregar] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const criar = modo === 'criar';

  async function submeter() {
    setMensagem(null);
    if (!email || !palavraPasse || (criar && !nome)) {
      setMensagem('Preenche todos os campos.');
      return;
    }
    setACarregar(true);
    const erro = criar ? await criarConta({ nome, email, palavraPasse, tipo }) : await entrar(email, palavraPasse);
    setACarregar(false);
    // se correu bem, a navegação muda sozinha (ver src/app/_layout.js)
    if (erro) setMensagem(erro);
  }

  async function esqueciPalavraPasse() {
    if (!email) {
      setMensagem('Escreve o teu email primeiro.');
      return;
    }
    const erro = await recuperarPalavraPasse(email);
    Alert.alert(erro ? 'Não foi possível enviar' : 'Email enviado', erro ?? 'Vê o teu email para definir uma nova palavra-passe.');
  }

  return (
    <Ecra bordas={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <View style={{ gap: espaco.s, marginBottom: espaco.s }}>
            <Logo />
            <Text style={texto.pequeno}>O prato do dia perto de ti</Text>
          </View>

          <View style={estilos.segmento}>
            {[
              ['entrar', 'Entrar'],
              ['criar', 'Criar conta'],
            ].map(([valor, rotulo]) => (
              <Pressable
                key={valor}
                onPress={() => {
                  setModo(valor);
                  setMensagem(null);
                }}
                style={[estilos.segmentoOpcao, modo === valor && estilos.segmentoAtivo]}
              >
                <Text style={[estilos.segmentoTexto, modo === valor && { color: cores.texto, fontWeight: '600' }]}>{rotulo}</Text>
              </Pressable>
            ))}
          </View>

          {criar && <Campo etiqueta="Nome" value={nome} onChangeText={setNome} placeholder="O teu nome" autoComplete="name" />}
          <Campo
            etiqueta="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="nome@email.pt"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Campo
            etiqueta="Palavra-passe"
            value={palavraPasse}
            onChangeText={setPalavraPasse}
            placeholder="Pelo menos 6 caracteres"
            secureTextEntry
            autoComplete={criar ? 'new-password' : 'current-password'}
          />

          {criar && (
            <View style={{ gap: espaco.s }}>
              <Text style={texto.etiqueta}>Tipo de conta</Text>
              <View style={{ flexDirection: 'row', gap: espaco.m }}>
                <OpcaoTipo icone="person-outline" titulo="Cliente" descricao="Procuro onde almoçar" ativa={tipo === 'cliente'} onPress={() => setTipo('cliente')} />
                <OpcaoTipo icone="storefront-outline" titulo="Restaurante" descricao="Quero publicar o menu" ativa={tipo === 'restaurante'} onPress={() => setTipo('restaurante')} />
              </View>
            </View>
          )}

          {mensagem && <Text style={estilos.mensagem}>{mensagem}</Text>}

          <Botao titulo={criar ? 'Criar conta' : 'Entrar'} onPress={submeter} aCarregar={aCarregar} />

          {!criar && (
            <Pressable onPress={esqueciPalavraPasse} style={{ alignSelf: 'center', padding: espaco.s }}>
              <Text style={[texto.pequeno, { color: cores.acento, fontWeight: '600' }]}>Esqueci-me da palavra-passe</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Ecra>
  );
}

function OpcaoTipo({ icone, titulo, descricao, ativa, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: ativa }} style={[estilos.opcao, ativa && estilos.opcaoAtiva]}>
      <Ionicons name={icone} size={22} color={ativa ? cores.acento : cores.textoSecundario} />
      <Text style={{ fontSize: 15, fontWeight: '600', color: cores.texto }}>{titulo}</Text>
      <Text style={{ fontSize: 12, color: cores.textoSecundario }}>{descricao}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.xl, gap: espaco.l, paddingTop: espaco.xxl },
  segmento: { flexDirection: 'row', backgroundColor: cores.linha, borderRadius: raio.m, padding: 4, gap: 4 },
  segmentoOpcao: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentoAtivo: { backgroundColor: cores.superficie },
  segmentoTexto: { fontSize: 15, fontWeight: '500', color: cores.textoSecundario },
  opcao: { flex: 1, gap: 6, padding: 14, borderRadius: raio.l, backgroundColor: cores.superficie, borderWidth: 1.5, borderColor: cores.linha },
  opcaoAtiva: { backgroundColor: cores.acentoSuave, borderColor: cores.acento, borderWidth: 2 },
  mensagem: { color: cores.erro, fontSize: 14 },
});
