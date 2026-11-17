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
  components/              botões, campos, filtros, cartões… (ui.js tem os do Figma)
  context/AuthContext.js   sessão e perfil (useAuth)
  context/PertoContext.js  onde se procura, filtros e pratos perto (usePerto)
  lib/                     ligação ao Supabase, datas, erros, zonas, ligações a outras apps
  services/                acesso aos dados: restaurantes, menus, pratos, localização, ler menu
  theme.js                 cores e medidas do Figma
supabase/functions/        código que corre no servidor do Supabase (ler o menu por fotografia)
tests/                     testes automáticos (npm test)
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

## Serviços externos

Além do Supabase, a app usa dois serviços. Nenhum recebe dados pessoais dos utilizadores.

- **Encontrar a morada no mapa (RF02):** o botão do perfil do restaurante envia o texto da morada ao [Nominatim](https://nominatim.org/), o serviço público do OpenStreetMap, e recebe as coordenadas. É gratuito e não precisa de chave. A morada de um restaurante é um dado público do negócio. Se o serviço falhar, o pin põe-se à mão.
- **Ler o menu por fotografia (extra do RF03):** no ecrã Publicar menu, o dono fotografa o menu e a app preenche os pratos, que ele confirma antes de publicar. A fotografia é enviada à função `ler-menu` do Supabase (`supabase/functions/ler-menu/index.js`), que a lê com um modelo de IA (Claude, da Anthropic). A fotografia não fica guardada.

### Ativar a leitura por fotografia

Enquanto isto não for feito, a app diz "A leitura por fotografia ainda não está ativada" e os pratos escrevem-se à mão.

1. Criar uma chave em https://platform.claude.com (é um serviço pago ao uso; convém definir lá um limite de gastos).
2. No painel do Supabase: **Edge Functions → Secrets** e criar o segredo `ANTHROPIC_API_KEY` com essa chave. A chave **nunca** entra na app nem no repositório.
3. Publicar a função `ler-menu` no projeto Supabase, com a verificação da sessão ligada ("Verify JWT").
4. (Opcional) O segredo `MODELO_LER_MENU` escolhe outro modelo, por exemplo `claude-haiku-5-5`, que é mais barato.

Só as contas de restaurante conseguem usar a função.
