// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions: código que corre no servidor (Deno), com imports que o ESLint da app não conhece
    ignores: ['dist/*', 'supabase/functions/*'],
    settings: {
      // para o ESLint perceber os imports "@/..." (definidos em jsconfig.json)
      'import/resolver': { typescript: { project: './jsconfig.json' } },
    },
  },
]);
