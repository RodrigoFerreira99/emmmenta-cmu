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

Os sete requisitos estão feitos e já estão no `main`. O que falta testar em cada um está na tabela de requisitos do `CLAUDE.md`.

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
- No plano gratuito o projeto é pausado quando tem pouco uso durante uma semana. A tarefa automática "Manter o Supabase acordado" evita isso (ver "Antes da defesa"). Se mesmo assim for pausado, abre o painel do Supabase e carrega em "Resume project".

## Serviços externos

Além do Supabase, a app usa dois serviços. Nenhum recebe dados pessoais dos utilizadores.

- **Encontrar a morada no mapa (RF02):** o botão do perfil do restaurante envia o texto da morada ao [Nominatim](https://nominatim.org/), o serviço público do OpenStreetMap, e recebe as coordenadas. É gratuito e não precisa de chave. A morada de um restaurante é um dado público do negócio. Se o serviço falhar, o pin põe-se à mão.
- **Ler o menu por fotografia (extra do RF03):** no ecrã Publicar menu, o dono fotografa o menu e a app preenche os pratos, que ele confirma antes de publicar. A fotografia é enviada à função `ler-menu` do Supabase (`supabase/functions/ler-menu/index.js`), que a lê com um modelo de IA no serviço Groq (plano gratuito). A fotografia não fica guardada.

### Ativar a leitura por fotografia

Já está ativada (função `ler-menu` publicada e segredo `GROQ_API_KEY` criado). Se um dia a chave for apagada, a app diz "A leitura por fotografia ainda não está configurada" e os pratos escrevem-se à mão. Para a voltar a ativar:

1. Criar uma conta gratuita em https://console.groq.com (não pede cartão) e, em **API Keys**, criar uma chave.
2. No painel do Supabase: **Edge Functions → Secrets** e criar o segredo `GROQ_API_KEY` com essa chave. A chave **nunca** entra na app nem no repositório.

O que convém saber:

- O plano gratuito do Groq tem um limite de pedidos por minuto e por dia. Quando é atingido, a app avisa e os pratos escrevem-se à mão.
- O modelo usado, `qwen/qwen3.8-27b`, está em fase "Preview" no Groq, que avisa que estes modelos podem ser retirados. Se a leitura deixar de funcionar, escolher outro modelo que aceite imagens em https://console.groq.com/docs/vision e pôr o nome dele no segredo `MODELO_LER_MENU` (não é preciso mexer no código).
- Só as contas de restaurante conseguem usar a função.
- Se o código em `supabase/functions/ler-menu/index.js` mudar, a função tem de ser publicada outra vez no Supabase (com "Verify JWT" ligado).

## Antes da defesa

A demonstração é ao vivo, por isso há três coisas que não podem falhar: o Supabase tem de estar acordado, tem de haver menus publicados nesse dia e o telemóvel tem de chegar ao computador.

### 1. Supabase acordado

A tarefa automática `.github/workflows/manter-supabase-acordado.yml` faz três leituras pequenas à base de dados todos os dias, para o plano gratuito não pausar o projeto (por exemplo, nas férias). Precisa de dois segredos no GitHub, criados uma só vez em **Settings → Secrets and variables → Actions → New repository secret**:

- `SUPABASE_URL`: o mesmo valor de `EXPO_PUBLIC_SUPABASE_URL` do `.env`;
- `SUPABASE_PUBLISHABLE_KEY`: o mesmo valor de `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` do `.env` (a chave pública da app, nunca a `service_role`).

Para confirmar que funciona: separador **Actions → Manter o Supabase acordado → Run workflow**. Se ficar a vermelho, o GitHub avisa por email. Na semana da defesa, abrir na mesma o painel do Supabase para confirmar.

### 2. Menus publicados nesse dia

Um menu só vale no dia em que é publicado (RN01). O script `scripts/demonstracao.mjs` tem 6 restaurantes de demonstração entre a ESMAD e o centro de Vila do Conde, todos a menos de 2 km da escola e do centro da zona "Vila do Conde":

```bash
node scripts/demonstracao.mjs criar
```

só da primeira vez: cria as contas e os restaurantes (a palavra-passe fica no `.env.local`, que não vai para o GitHub);

```bash
node scripts/demonstracao.mjs publicar
```

na manhã da defesa (e sempre que quiserem testar o lado do cliente): publica o menu de hoje em todos;

```bash
node scripts/demonstracao.mjs estado
```

mostra quais têm menu hoje, sem mudar nada. `retirar` apaga o menu de hoje de todos.

### 3. O telemóvel tem de chegar ao computador

O Expo Go carrega a app a partir do computador. Na rede da escola isso pode estar bloqueado, por isso convém experimentar antes, por esta ordem:

1. **Rede da escola:** `npx expo start`, como sempre.
2. **Hotspot do telemóvel:** ligar o computador ao hotspot de um dos telemóveis e voltar a fazer `npx expo start`.
3. **Túnel:** `npx expo start --tunnel`. A app chega ao telemóvel pela internet, seja qual for a rede (até com dados móveis). É mais lento a arrancar.

Porque não uma app instalável (APK)? Fora do Expo Go, o mapa do Android (`react-native-maps`) precisa de uma chave da Google Maps, que exige uma conta na Google Cloud com faturação. No Expo Go o mapa funciona sem chave.

### Guião curto para a demonstração

Dois telemóveis: um com uma conta de restaurante e outro com uma conta de cliente (localização na escola, ou a zona "Vila do Conde"). O restaurante usado na demonstração tem de ter o pin perto da escola (no Perfil), senão o cliente não o vê no raio de 2 km.

1. **Restaurante:** Publicar menu → Fotografar um menu (por exemplo, impresso numa folha) → confirmar → Publicar.
2. **Cliente:** o prato aparece na lista e no mapa; abrir o restaurante (Ligar, Direções, horário).
3. **Restaurante:** marcar um prato como esgotado. No telemóvel do cliente fica logo riscado (tempo real).
