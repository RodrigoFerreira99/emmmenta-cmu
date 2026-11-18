import { describe, expect, test } from '@jest/globals';
import { getStateFromPath } from 'expo-router/build/fork/getStateFromPath';
import { getReactNavigationConfig } from 'expo-router/build/getReactNavigationConfig';
import { getRoutes } from 'expo-router/build/getRoutes';
import fs from 'fs';
import path from 'path';

import { rotaInicial } from '@/lib/navegacao';

// Navegação — o primeiro ecrã de cada tipo de conta tem de existir em src/app.
//
// Este teste existe por causa de um erro real: ao entrar, as contas de restaurante eram
// enviadas para "/(restaurante)", que não é um ecrã, e aparecia "Unmatched Route".
// Aqui perguntamos ao próprio expo-router para onde vai cada caminho, usando os ficheiros
// que estão mesmo na pasta src/app. Se alguém mudar o nome a um ecrã, o teste avisa.

const PASTA_DAS_ROTAS = path.join(__dirname, '..', 'src', 'app');

// Todos os ficheiros de src/app, no formato que o expo-router espera: "./(cliente)/index.js".
function listarRotas(pasta, prefixo = '.') {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = `${prefixo}/${entrada.name}`;
    return entrada.isDirectory() ? listarRotas(path.join(pasta, entrada.name), caminho) : [caminho];
  });
}

const ficheiros = listarRotas(PASTA_DAS_ROTAS);
// O conteúdo dos ecrãs não interessa aqui, só os nomes dos ficheiros.
const contexto = Object.assign(() => ({ default: () => null }), {
  keys: () => ficheiros,
  resolve: (id) => id,
  id: 'app',
});
const config = getReactNavigationConfig(getRoutes(contexto, { importMode: 'sync' }), true);

// Para um caminho, devolve o ecrã onde o router vai parar, por exemplo "(restaurante) > painel".
function ecraDe(caminho) {
  const nomes = [];
  let estado = getStateFromPath(caminho, config);
  while (estado?.routes?.length) {
    const rota = estado.routes[estado.index ?? estado.routes.length - 1];
    nomes.push(rota.name);
    estado = rota.state;
  }
  return nomes.join(' > ');
}

describe('rotaInicial', () => {
  test('sem sessão vai para o login', () => {
    expect(rotaInicial(null)).toBe('/login');
    expect(ecraDe(rotaInicial(null))).toBe('login');
  });

  test('conta de cliente vai para o separador Início', () => {
    expect(rotaInicial('cliente')).toBe('/');
    expect(ecraDe(rotaInicial('cliente'))).toBe('(cliente) > index');
  });

  test('conta de restaurante vai para o separador Painel', () => {
    expect(rotaInicial('restaurante')).toBe('/painel');
    expect(ecraDe(rotaInicial('restaurante'))).toBe('(restaurante) > painel');
  });

  test('nenhum destino acaba em "Unmatched Route"', () => {
    for (const tipo of [null, 'cliente', 'restaurante']) {
      expect(ecraDe(rotaInicial(tipo))).not.toContain('+not-found');
    }
  });
});

describe('ecrãs que o resto da app usa', () => {
  test.each([
    ['/perfil', '(restaurante) > perfil'],
    ['/publicar', 'publicar'],
    ['/mapa', '(cliente) > mapa'],
    ['/conta', '(cliente) > conta'],
    ['/restaurante/abc', 'restaurante/[id]'],
  ])('%s existe', (caminho, ecra) => {
    expect(ecraDe(caminho)).toBe(ecra);
  });
});
