import { createContext, useContext, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

// RF01: registo, login, terminar sessão e recuperar a palavra-passe.
// Qualquer ecrã pode fazer: const { sessao, perfil, sair } = useAuth();
//
// O que este contexto guarda:
//   sessao      a sessão do Supabase (null = ninguém entrou)
//   perfil      { id, nome, tipo: 'cliente' | 'restaurante' } do utilizador com sessão
//   aCarregar   true enquanto ainda não sabemos se há sessão / qual é o perfil
//   erroPerfil  mensagem quando há sessão mas não foi possível ler o perfil (ex.: sem rede)

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(null);
  const [aVerSessao, setAVerSessao] = useState(true); // a ler a sessão guardada no telemóvel
  const [perfilGuardado, setPerfilGuardado] = useState(null);
  const [erroGuardado, setErroGuardado] = useState(null); // { utilizadorId, mensagem }
  const [tentativa, setTentativa] = useState(0); // aumenta em "Tentar outra vez"

  // Fica a true enquanto a palavra-passe está a ser redefinida (ver redefinirPalavraPasse).
  const aRedefinir = useRef(false);

  const utilizadorId = sessao?.user?.id ?? null;
  // O perfil e o erro só contam se forem do utilizador que tem a sessão agora.
  // Assim, depois de sair (ou de entrar com outra conta) não fica nada da conta anterior.
  const perfil = perfilGuardado?.id === utilizadorId ? perfilGuardado : null;
  const erroPerfil = erroGuardado?.utilizadorId === utilizadorId ? erroGuardado.mensagem : null;

  // 1) Sessão: a que ficou guardada no telemóvel e as mudanças seguintes (entrar, sair, token renovado).
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSessao(data.session))
      .catch((erro) => console.warn('Não foi possível ler a sessão guardada:', erro?.message ?? erro))
      .finally(() => setAVerSessao(false));

    const { data: escuta } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      if (aRedefinir.current) return;
      setSessao(novaSessao);
      if (!novaSessao) setErroGuardado(null); // ao sair, esquece um erro antigo
    });
    return () => escuta.subscription.unsubscribe();
  }, []);

  // 2) Perfil: é lido quando muda o utilizador (e outra vez em "Tentar outra vez").
  // Não é lido de novo quando o token é renovado: o utilizador é o mesmo, por isso o perfil
  // que já temos continua válido. Isto evita que uma falha de rede a meio "feche" os ecrãs.
  useEffect(() => {
    if (!utilizadorId) return;
    let ativo = true; // ignora a resposta se entretanto o utilizador mudou

    async function carregarPerfil() {
      let resposta;
      try {
        resposta = await supabase.from('perfis').select('id, nome, tipo').eq('id', utilizadorId).maybeSingle();
      } catch (erro) {
        resposta = { data: null, error: erro };
      }
      if (!ativo) return;

      if (resposta.error) {
        console.warn('Não foi possível carregar o perfil:', resposta.error.message ?? resposta.error);
        setErroGuardado({ utilizadorId, mensagem: 'Não foi possível carregar a tua conta. Verifica a ligação à internet.' });
      } else if (!resposta.data) {
        setErroGuardado({ utilizadorId, mensagem: 'Não encontrámos o perfil desta conta. Termina a sessão e cria a conta outra vez.' });
      } else {
        setPerfilGuardado(resposta.data);
        setErroGuardado(null);
      }
    }

    carregarPerfil();
    return () => {
      ativo = false;
    };
  }, [utilizadorId, tentativa]);

  function tentarCarregarPerfil() {
    setErroGuardado(null); // volta a mostrar o indicador de carregamento
    setTentativa((n) => n + 1);
  }

  async function entrar(email, palavraPasse) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: palavraPasse });
    return traduzirErro(error);
  }

  // tipo: 'cliente' ou 'restaurante'. O perfil é criado automaticamente na base de dados
  // (trigger "ao_criar_utilizador") com o nome e o tipo enviados aqui.
  async function criarConta({ nome, email, palavraPasse, tipo }) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: palavraPasse,
      options: { data: { nome: nome.trim(), tipo } },
    });
    if (error) return traduzirErro(error);
    // Se o Supabase estiver a pedir confirmação por email, ainda não há sessão.
    if (!data.session) return 'Conta criada. Confirma o teu email e depois entra.';
    return null;
  }

  // Recuperação, passo 1: o Supabase envia um email com um código.
  async function recuperarPalavraPasse(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return traduzirErro(error);
  }

  // Recuperação, passo 2: o código que chegou por email + a palavra-passe nova.
  // Usamos um código (e não uma ligação) porque no Expo Go uma ligação do email não consegue
  // abrir a app no ecrã certo; um código funciona em qualquer telemóvel e rede.
  async function redefinirPalavraPasse({ email, codigo, novaPalavraPasse }) {
    // Verificar o código já inicia a sessão. Enquanto a palavra-passe nova não estiver gravada
    // ignoramos as mudanças de sessão, para a app não sair do ecrã de login a meio do processo.
    aRedefinir.current = true;
    try {
      const { error: erroDoCodigo } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: codigo.trim(),
        type: 'recovery',
      });
      if (erroDoCodigo) return traduzirErro(erroDoCodigo);

      const { error: erroDaPalavraPasse } = await supabase.auth.updateUser({ password: novaPalavraPasse });
      if (erroDaPalavraPasse) {
        // O código só serve uma vez e já foi gasto: fecha-se a sessão e pede-se outro.
        await supabase.auth.signOut({ scope: 'local' });
        return `${traduzirErro(erroDaPalavraPasse)} Pede um código novo e tenta outra vez.`;
      }

      // Tudo certo: agora sim, a app fica com a sessão e entra.
      const { data } = await supabase.auth.getSession();
      setSessao(data.session);
      return null;
    } catch (erro) {
      return traduzirErro(erro);
    } finally {
      aRedefinir.current = false;
    }
  }

  // scope 'local' = termina a sessão só neste telemóvel. Com este modo a sessão guardada é
  // apagada antes de falar com o servidor, por isso também funciona sem rede (RNF08).
  async function sair() {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (erro) {
      console.warn('Erro ao terminar sessão:', erro?.message ?? erro);
    }
  }

  const valor = {
    sessao,
    perfil,
    // "a carregar" = ainda a ler a sessão, ou há sessão e o perfil ainda não chegou (nem deu erro)
    aCarregar: aVerSessao || (!!sessao && !perfil && !erroPerfil),
    erroPerfil,
    tentarCarregarPerfil,
    entrar,
    criarConta,
    recuperarPalavraPasse,
    redefinirPalavraPasse,
    sair,
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth tem de estar dentro de <AuthProvider>');
  return contexto;
}

// Mensagens do Supabase (em inglês) → mensagens para o utilizador (em português).
// A ordem interessa: as mais específicas vêm primeiro.
export function traduzirErro(error) {
  if (!error) return null;
  const m = String(error.message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email ou palavra-passe errados.';
  if (m.includes('email not confirmed')) return 'Ainda não confirmaste o teu email.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Já existe uma conta com este email.';
  if (m.includes('password should be at least') || m.includes('weak password')) return 'A palavra-passe tem de ter pelo menos 6 caracteres.';
  if (m.includes('should be different')) return 'A nova palavra-passe tem de ser diferente da anterior.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Demasiadas tentativas. Espera um minuto e tenta outra vez.';
  if (m.includes('token') || m.includes('otp') || m.includes('expired')) return 'O código não está certo ou já expirou.';
  if (m.includes('invalid email') || m.includes('unable to validate email') || m.includes('is invalid')) return 'O email não é válido.';
  if (m.includes('network') || m.includes('fetch')) return 'Sem ligação à internet. Verifica a rede e tenta outra vez.';
  // mensagem que ainda não conhecemos: fica na consola para quem programa; o utilizador vê uma frase clara
  console.warn('Erro de autenticação por traduzir:', error.message ?? error);
  return 'Ocorreu um erro inesperado. Tenta outra vez.';
}
