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
  services/                acesso aos dados: restaurantes, menus, pratos, localização, ler menu, assistente
  theme.js                 cores e medidas do Figma
supabase/functions/        código que corre no servidor do Supabase (ler-menu, assistente)
scripts/                   restaurantes de demonstração e cópia de segurança (correm no computador)
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

Além do Supabase, a app usa os serviços abaixo. Só o de caminhos recebe a localização do cliente, e só quando ele pede o caminho a pé (arredondada a cerca de 100 m, sem ficar guardada pela app).

- **Encontrar a morada no mapa (RF02):** o botão do perfil do restaurante envia o texto da morada ao [Nominatim](https://nominatim.org/), o serviço público do OpenStreetMap, e recebe as coordenadas. É gratuito e não precisa de chave. A morada de um restaurante é um dado público do negócio. Se o serviço falhar, o pin põe-se à mão.
- **Ler o menu por fotografia (extra do RF03):** no ecrã Publicar menu, o dono fotografa o menu e a app preenche os pratos, que ele confirma antes de publicar. A fotografia é enviada à função `ler-menu` do Supabase (`supabase/functions/ler-menu/index.js`), que a lê com um modelo de IA no serviço Groq (plano gratuito). A fotografia não fica guardada.
- **Assistente (pesquisa por frase e menu em inglês):** o texto que o cliente escreve em "Diz o que te apetece" e os nomes dos pratos do menu são enviados à função `assistente` do Supabase (`supabase/functions/assistente/index.js`), que usa o mesmo serviço Groq. Não vai a localização nem nenhum dado da conta. Se o serviço falhar, a pesquisa por frase usa regras simples no próprio telemóvel e o botão "English" avisa que não foi possível traduzir.
- **Caminho a pé até ao restaurante:** o botão "Ver o caminho a pé" da página do restaurante mostra, num mapa dentro da app, o percurso pelas ruas, com o tempo e a distância ("12 min a pé · 870 m"). O percurso é pedido ao serviço de caminhos do OpenStreetMap ([routing.openstreetmap.de](https://routing.openstreetmap.de/about.html), gratuito e sem chave), com a localização do cliente arredondada a cerca de 100 m. As regras desse serviço pedem no máximo um pedido por segundo (a app faz um por toque), que a app se identifique e que se mostre a atribuição ao OpenStreetMap com a ligação "Corrigir o mapa". Se o serviço falhar, aparece uma linha reta com uma estimativa. Para ser guiado passo a passo, continua a haver o botão "Direções" (abre a app de mapas).
- **Mapa de calor 3D no Início (design):** as ruas e os prédios em 3D vêm do [OpenFreeMap](https://openfreemap.org/) (mosaicos gratuitos, sem chave nem conta, com dados do OpenStreetMap) e são desenhados pelo [MapLibre GL](https://maplibre.org/) numa WebView (a biblioteca é descarregada do unpkg.com). Só são pedidos os mosaicos da zona que aparece; a localização do cliente não é enviada nem guardada. Sem rede, o cartão do mapa mostra uma mensagem e a lista continua.

### Créditos do design

- Pratos em 3D (`assets/pratos`): imagens feitas a partir do [Food Kit](https://kenney.nl/assets/food-kit) do Kenney (licença CC0), com cores novas.
- Ícones: [Phosphor Icons](https://phosphoricons.com) (licença MIT), gerados por `scripts/gerar-icones.mjs`.
- Letras: Bricolage Grotesque e JetBrains Mono (Google Fonts, licença SIL Open Font License).
- Mapa: © colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright), mosaicos OpenFreeMap, MapLibre GL (BSD). Física da queda ao abanar: [Matter.js](https://brm.io/matter-js/) (MIT).

### Ativar a IA (leitura por fotografia e assistente)

Já está ativada (funções `ler-menu` e `assistente` publicadas e segredo `GROQ_API_KEY` criado; as duas usam a mesma chave). Se um dia a chave for apagada, a app diz "A leitura por fotografia ainda não está configurada" e os pratos escrevem-se à mão. Para a voltar a ativar:

1. Criar uma conta gratuita em https://console.groq.com (não pede cartão) e, em **API Keys**, criar uma chave.
2. No painel do Supabase: **Edge Functions → Secrets** e criar o segredo `GROQ_API_KEY` com essa chave. A chave **nunca** entra na app nem no repositório.

O que convém saber:

- O plano gratuito do Groq tem um limite de pedidos por minuto e por dia. Quando é atingido, a app avisa e os pratos escrevem-se à mão.
- O modelo usado, `qwen/qwen3.8-27b`, está em fase "Preview" no Groq, que avisa que estes modelos podem ser retirados. Se a leitura deixar de funcionar, escolher outro modelo que aceite imagens em https://console.groq.com/docs/vision e pôr o nome dele no segredo `MODELO_LER_MENU` (não é preciso mexer no código).
- Só as contas de restaurante conseguem usar a leitura por fotografia. O assistente aceita qualquer conta com sessão iniciada (a chave pública sozinha é recusada, para ninguém gastar a quota de fora da app).
- O assistente usa o mesmo modelo; para usar outro só no assistente, criar o segredo `MODELO_ASSISTENTE` com o nome de um modelo de texto do Groq (https://console.groq.com/docs/models).
- Se o código de uma das funções (`supabase/functions/ler-menu/index.js` ou `supabase/functions/assistente/index.js`) mudar, essa função tem de ser publicada outra vez no Supabase (com "Verify JWT" ligado).

## Antes da defesa

**Para estudar:** o [guia da defesa](docs/guia-da-defesa.md) tem as perguntas prováveis de cada um, com a resposta curta e o ficheiro onde está o código, o guião da demonstração e o que fazer se algo correr mal.

A demonstração é ao vivo, por isso há três coisas que não podem falhar: o Supabase tem de estar acordado, tem de haver menus publicados nesse dia e o telemóvel tem de chegar ao computador. Os pontos 4 a 6 são cuidados para os telemóveis, para os dados e para as contas.

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

publica o menu de hoje em todos. **Já não é preciso fazer isto todos os dias:** a tarefa automática "Publicar os menus de demonstração" (`.github/workflows/publicar-menus-de-demonstracao.yml`) corre-o todas as manhãs às 6h30 (UTC), a partir do `main`. À mão continua a servir, por exemplo se a tarefa falhar;

```bash
node scripts/demonstracao.mjs estado
```

mostra quais têm menu hoje, sem mudar nada. `retirar` apaga o menu de hoje de todos.

```bash
node scripts/demonstracao.mjs sala
```

mesmo antes de mostrar a lista ao júri: põe "Há mesa" ou "Cheio agora" nos restaurantes de demonstração (o aviso só aparece durante 45 minutos). Os pratos de demonstração já têm etiquetas (Vegano, Sem glúten…), para o filtro "Dieta e sabor" ter resultados.

**Segredo para a tarefa automática (só uma vez).** A tarefa precisa da palavra-passe das contas de demonstração, que só existe no `.env.local` de quem correu `criar`:

1. No computador, na pasta do projeto, copiar a palavra-passe sem a mostrar no ecrã (PowerShell):

```powershell
(Select-String -Path .env.local -Pattern '^EMMMENTA_DEMO_PALAVRA_PASSE=').Line.Split('=', 2)[1].Trim() | Set-Clipboard
```

2. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**, com o nome `EMMMENTA_DEMO_PALAVRA_PASSE`; no campo **Secret**, colar (Ctrl+V) e carregar em **Add secret**. Os outros dois segredos (`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`) já existem.
3. Experimentar: separador **Actions → Publicar os menus de demonstração → Run workflow**. Fica a verde e mostra ✔ nos 6 restaurantes.

### 3. O telemóvel tem de chegar ao computador

O Expo Go carrega a app a partir do computador. Na rede da escola isso pode estar bloqueado, por isso convém experimentar antes, por esta ordem:

1. **Rede da escola:** `npx expo start`, como sempre.
2. **Hotspot do telemóvel:** ligar o computador ao hotspot de um dos telemóveis e voltar a fazer `npx expo start`.
3. **Túnel:** `npx expo start --tunnel`. A app chega ao telemóvel pela internet, seja qual for a rede (até com dados móveis). É mais lento a arrancar.

Porque não uma app instalável (APK)? Fora do Expo Go, o mapa do Android (`react-native-maps`) precisa de uma chave da Google Maps, que exige uma conta na Google Cloud com faturação. No Expo Go o mapa funciona sem chave.

### 4. Os telemóveis da demonstração

- **Expo Go da versão certa (SDK 58).** O Expo Go da loja só abre projetos da versão mais recente do Expo. Se sair uma versão nova (SDK 59) antes da defesa, o Expo Go atualiza-se sozinho e deixa de abrir a Emmmenta. Por isso, nos telemóveis da demonstração, desliguem as atualizações automáticas do Expo Go:
  - **Android:** Play Store → página do Expo Go → menu ⋮ (canto superior direito) → desligar "Ativar atualização automática". Se já tiver atualizado, em https://expo.dev/go escolhe-se "SDK 58" e instala-se essa versão.
  - **iPhone:** Definições → App Store → desligar "Atualizações de apps". No iPhone não dá para voltar a uma versão antiga do Expo Go.
- **iPhone:** entrar com a mesma conta Expo no computador (`npx expo login`) e no Expo Go. Assim o projeto aparece no Expo Go mesmo que o QR code dê problemas.
- **Permissões dadas antes:** abrir a app uma vez em cada telemóvel e aceitar a localização (cliente) e a câmara (restaurante), para a pergunta do sistema não aparecer a meio da demonstração.
- **Bateria e ecrã:** telemóveis carregados, poupança de energia desligada (pode atrasar o tempo real e a localização) e "Não incomodar" ligado.
- **Plano B:** ter no computador o vídeo da app a funcionar (faz parte da entrega), para o caso de a rede falhar no dia.

### 5. Cópia de segurança dos dados

No plano gratuito o Supabase não guarda cópias diárias que se possam descarregar (só a partir do plano Pro). Antes de mexer em dados e na semana da defesa:

```bash
node scripts/copia-de-seguranca.mjs
```

Guarda os restaurantes, os menus e os pratos em `copias/emmmenta-AAAA-MM-DD.json` (a pasta `copias` não vai para o GitHub). Usa só a chave pública e não leva contas, palavras-passe nem perfis. Se alguém apagar um restaurante por engano, a cópia mostra o que lá estava para o voltar a pôr.

### 6. Segurança das contas

Os avisos do Supabase (**Advisors**) dizem que a proteção contra palavras-passe divulgadas na internet está desligada: essa proteção só existe a partir do plano Pro. Em vez disso, a app pede pelo menos **8 caracteres** nas palavras-passe novas (criar conta e recuperar), como o Supabase recomenda; as contas antigas continuam a entrar. Para o servidor exigir o mesmo, o grupo pode subir o mínimo em **Authentication → Sign In / Providers → Email → Minimum password length** para 8.

### Guião curto para a demonstração

Dois telemóveis: um com uma conta de restaurante e outro com uma conta de cliente (localização na escola, ou a zona "Vila do Conde"). O restaurante usado na demonstração tem de ter o pin perto da escola (no Perfil), senão o cliente não o vê no raio de 2 km.

1. **Restaurante:** Publicar menu → Fotografar um menu (por exemplo, impresso numa folha) → confirmar → Publicar.
2. **Cliente:** o prato aparece na lista e no mapa; abrir o restaurante (Ligar, Direções, horário).
3. **Restaurante:** marcar um prato como esgotado. No telemóvel do cliente fica logo riscado (tempo real).
4. **Cliente:** botão com estrelas → "Diz o que te apetece" → por exemplo "peixe até 8 euros aqui perto": a app põe os filtros sozinha.
5. **Cliente:** "Escolhe por mim" (ou abanar o telemóvel): a app sorteia o almoço.
6. **Cliente (turista):** na página do restaurante, o botão "English" mostra o menu em inglês.
7. **Restaurante:** no Painel, "Últimas doses" num prato e "Cheio" em "Como está a sala agora?". No telemóvel do cliente aparecem logo a etiqueta laranja e "Cheio agora".
8. **Cliente:** filtros → "Dieta e sabor" → "Vegano" (ou dizer "sou celíaco, quero peixe" ao assistente). Tocar na fotografia de um prato mostra-a em grande.
9. **Cliente:** na página do restaurante, "Ver o caminho a pé": o percurso aparece no mapa com o tempo a pé.
