import { createContext, useContext, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// RF01: registo, login, terminar sessão e recuperar a palavra-passe.
// Qualquer ecrã pode fazer: const { sessao, perfil, sair } = useAuth();

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(null);
  const [perfil, setPerfil] = useState(null); // { id, nome, tipo: 'cliente' | 'restaurante' }
  const [aCarregar, setACarregar] = useState(true);

  async function carregarPerfil(utilizadorId) {
    const { data, error } = await supabase.from('perfis').select('id, nome, tipo').eq('id', utilizadorId).single();
    if (error) console.warn('Não foi possível carregar o perfil:', error.message);
    setPerfil(data ?? null);
  }

  useEffect(() => {
    // 1) sessão guardada no telemóvel (se a pessoa já tinha entrado antes)
    supabase.auth.getSession().then(async ({ data }) => {
      setSessao(data.session);
      if (data.session) await carregarPerfil(data.session.user.id);
      setACarregar(false);
    });

    // 2) mudanças de sessão: entrar, sair, token renovado
    const { data: escuta } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao);
      if (novaSessao) {
        // não chamar o Supabase diretamente dentro deste callback (recomendação do supabase-js)
        setTimeout(() => carregarPerfil(novaSessao.user.id), 0);
      } else {
        setPerfil(null);
      }
    });
    return () => escuta.subscription.unsubscribe();
  }, []);

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

  async function recuperarPalavraPasse(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return traduzirErro(error);
  }

  async function sair() {
    await supabase.auth.signOut();
  }

  // enquanto há sessão mas o perfil ainda não chegou, continua "a carregar"
  const valor = {
    sessao,
    perfil,
    aCarregar: aCarregar || (!!sessao && !perfil),
    entrar,
    criarConta,
    recuperarPalavraPasse,
    sair,
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth tem de estar dentro de <AuthProvider>');
  return contexto;
}

function traduzirErro(error) {
  if (!error) return null;
  const m = error.message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email ou palavra-passe errados.';
  if (m.includes('email not confirmed')) return 'Ainda não confirmaste o teu email.';
  if (m.includes('already registered')) return 'Já existe uma conta com este email.';
  if (m.includes('password should be at least')) return 'A palavra-passe tem de ter pelo menos 6 caracteres.';
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'O email não é válido.';
  if (m.includes('rate limit')) return 'Demasiadas tentativas. Espera um pouco e tenta outra vez.';
  if (m.includes('network')) return 'Sem ligação à internet.';
  return error.message;
}
