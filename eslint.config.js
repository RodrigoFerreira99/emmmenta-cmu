// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    settings: {
      // para o ESLint perceber os imports "@/..." (definidos em jsconfig.json)
      'import/resolver': { typescript: { project: './jsconfig.json' } },
    },
  },
]);
