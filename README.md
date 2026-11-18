# Emmmenta

**O prato do dia perto de ti.** App móvel que mostra os pratos do dia dos restaurantes próximos, com preço, atualizados todos os dias. Os restaurantes publicam o menu na app e marcam os pratos esgotados em tempo real.

Projeto da unidade curricular de **Computação Móvel e Ubíqua** (Licenciatura em Tecnologias e Desenvolvimento Web, ESMAD / UTPorto, 2026/27).

Grupo: Rodrigo Ferreira · José Guimarães · André Lemos

---

## Tecnologias

- [React Native](https://reactnative.dev/) com [Expo](https://docs.expo.dev/) (SDK 58) e Expo Router
- [Supabase](https://supabase.com/docs): autenticação, base de dados PostgreSQL, tempo real e fotografias
- react-native-maps e expo-location para o mapa e a localização
- Mock-ups em [Figma](https://www.figma.com/design/TpDXtsdeNOmMZfTgOCPvMd)

## Como correr a app

Precisas de: [Node.js LTS](https://nodejs.org/), [Git](https://git-scm.com/) e a app **Expo Go** no telemóvel (Play Store ou App Store).

```bash
# 1. descarregar o projeto
git clone https://github.com/RodrigoFerreira99/emmmenta-cmu.git
cd emmmenta-cmu

# 2. instalar as dependências
npm install

# 3. criar o ficheiro com as chaves do Supabase
cp .env.example .env        # no Windows: copy .env.example .env

# 4. arrancar
npx expo start
```

Lê o código QR com a câmara (iPhone) ou com a app Expo Go (Android). O telemóvel e o computador têm de estar na mesma rede Wi-Fi. Se a rede da escola bloquear, usa `npx expo start --tunnel`.

## Estrutura

```
src/
  app/                     ecrãs (cada ficheiro é uma rota do Expo Router)
    _layout.js             navegação: login / cliente / restaurante
    login.js               1 · Login / Registo           RF01
    (cliente)/index.js     2 · Início                    RF05, RF07
    (cliente)/mapa.js      3 · Mapa                      RF06, RF07
    (cliente)/conta.js     conta do cliente e sair       RF01
    restaurante/[id].js    4 · Página do restaurante     RF06
    (restaurante)/painel.js 5 · Painel                   RF04
    publicar.js            6 · Publicar menu             RF03
    (restaurante)/perfil.js 7 · Perfil do restaurante    RF02
  components/ui.js         botões, campos, logo… (iguais ao Figma)
  context/AuthContext.js   sessão e perfil (useAuth)
  lib/supabase.js          ligação ao Supabase (sessão no SecureStore)
  services/pratos.js       pesquisa de pratos perto, tempo real, formatação
  theme.js                 cores e medidas do Figma
```

## Quem faz o quê

| Pessoa | Parte | Requisitos |
|---|---|---|
| Rodrigo | Login e registo, perfil do restaurante | RF01, RF02 |
| José | Painel, publicar menu, esgotados | RF03, RF04 |
| André | Início, mapa, página do restaurante, filtros | RF05, RF06, RF07 |

Cada ecrã por fazer mostra uma caixa "Por fazer" com a lista do que falta.

## Regras do grupo

- Trabalhar em ramos (`git checkout -b rf03-publicar-menu`) e juntar ao `main` quando estiver a funcionar.
- Commits pequenos e frequentes, com mensagem clara: `RF03: adicionar pratos ao menu de hoje`.
- Antes de fazer push: `npx expo lint` sem erros, `npm test` a passar e testar no telemóvel.
- Os testes automáticos estão na pasta `tests/` (Jest). Correm no computador, sem rede e sem mexer na base de dados.
- A chave `service_role` do Supabase **nunca** entra no código.

## Notas sobre o Supabase

- Para testar, cria duas contas: uma de **cliente** e uma de **restaurante**.
- Em desenvolvimento, desliga a confirmação por email no painel do Supabase: **Authentication → Sign In / Providers → Email → Confirm email (desligar)**. O serviço de email gratuito do Supabase só envia para os membros da equipa, por isso, com a confirmação ligada, as contas novas ficam bloqueadas.
- **Recuperar a palavra-passe (RF01):** a app pede um **código** que chega por email. Para o email trazer o código, é preciso mudar o modelo uma vez no painel do Supabase: **Authentication → Emails → Reset Password** e pôr `{{ .Token }}` no texto, por exemplo `<p>O teu código da Emmmenta é: <b>{{ .Token }}</b></p>`. Tal como na confirmação, o email gratuito só chega a membros da equipa.
- No plano gratuito o projeto é pausado ao fim de 7 dias sem uso. Antes da defesa, abre o painel do Supabase e, se for preciso, carrega em "Restore".
