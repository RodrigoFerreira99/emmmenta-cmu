import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

// RNF01: a sessão (token) fica guardada com segurança no telemóvel, no SecureStore.
// O SecureStore só aceita valores pequenos (~2 KB) e a sessão do Supabase é maior,
// por isso o valor é dividido em partes ("chunks") e guardado em várias chaves.
const TAMANHO_PARTE = 1800;

const armazenamentoSeguro = {
  async getItem(chave) {
    const total = await SecureStore.getItemAsync(`${chave}_n`);
    if (!total) return null;
    let valor = '';
    for (let i = 0; i < Number(total); i++) {
      valor += (await SecureStore.getItemAsync(`${chave}_${i}`)) ?? '';
    }
    return valor;
  },
  async setItem(chave, valor) {
    await armazenamentoSeguro.removeItem(chave);
    const partes = [];
    for (let i = 0; i < valor.length; i += TAMANHO_PARTE) {
      partes.push(valor.slice(i, i + TAMANHO_PARTE));
    }
    for (let i = 0; i < partes.length; i++) {
      await SecureStore.setItemAsync(`${chave}_${i}`, partes[i]);
    }
    await SecureStore.setItemAsync(`${chave}_n`, String(partes.length));
  },
  async removeItem(chave) {
    const total = await SecureStore.getItemAsync(`${chave}_n`);
    if (!total) return;
    for (let i = 0; i < Number(total); i++) {
      await SecureStore.deleteItemAsync(`${chave}_${i}`);
    }
    await SecureStore.deleteItemAsync(`${chave}_n`);
  },
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chave = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !chave) {
  throw new Error('Falta o ficheiro .env. Corre: cp .env.example .env e reinicia o "npx expo start".');
}

export const supabase = createClient(url, chave, {
  auth: {
    // no browser (web) o SecureStore não existe: usa o armazenamento normal do browser
    storage: Platform.OS === 'web' ? undefined : armazenamentoSeguro,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// O Supabase recomenda renovar o token só com a app aberta (Android e iOS).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
