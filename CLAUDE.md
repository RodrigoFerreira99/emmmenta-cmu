# Emmmenta — contexto do projeto para o Claude Code

@AGENTS.md

## O que é

App móvel (React Native + Expo SDK 58, **JavaScript**, Expo Router) que mostra **os pratos do dia dos restaurantes perto do utilizador, com preço, atualizados todos os dias**. Dois tipos de conta: **cliente** (procura onde almoçar) e **restaurante** (publica o menu do dia). Projeto da UC Computação Móvel e Ubíqua (ESMAD / UTPorto, 2026/27), docente Prof. António Machado. Grupo: Rodrigo Ferreira, José Guimarães, André Lemos.

## Regras para trabalhar neste projeto

- Escreve **sempre em português de Portugal**: textos da app, comentários, mensagens de commit e explicações.
- **Explica o código que escreves.** O grupo tem de o defender oralmente (defesa a 14–15 jan 2027) e mostrar a app a funcionar ao vivo. No fim de cada tarefa, resume em poucas linhas o que mudou e porquê.
- **JavaScript, não TypeScript.** Ficheiros `.js`. Imports com o alias `@/` (= `src/`).
- Rotas em `src/app/` (Expo Router). Código que não é ecrã fica fora de `src/app/` (`src/components`, `src/services`, `src/context`, `src/lib`).
- Acesso a dados **só através de funções em `src/services/`** — os ecrãs não chamam o Supabase diretamente (RNF09).
- Cores e medidas **só de `src/theme.js`** (vêm do Figma). Componentes base em `src/components/ui.js` (`Ecra`, `Botao`, `Campo`, `Logo`, `Carregar`, `PorFazer`). Para formulários há `CampoComErro` (campo com o erro por baixo) e, para falhas de carregamento, `EcraDeErro` (mensagem + "Tentar outra vez").
- Instalar pacotes com `npx expo install <pacote>`. A app tem de correr no **Expo Go** (não adicionar bibliotecas que exijam development build).
- **Commits pequenos e frequentes**, com mensagens claras em português (ex.: `RF03: adicionar pratos ao menu de hoje`). O histórico de commits de todos é avaliado.
- Nunca pôr a chave `service_role`/`secret` do Supabase na app nem no repositório. Só a `publishable` (está em `.env`).
- Alterações à base de dados: com cuidado, e explicar ao grupo antes. As regras de segurança (RLS) já existem e não devem ser desligadas.
- Antes de dar uma tarefa por terminada: `npx expo lint` sem erros e `npm test` a passar. Os testes (Jest) estão em `tests/`; funções novas sem rede (validações, conversões) devem ter teste.

## Requisitos (o que vai ser avaliado — relatório da entrega intermédia)

São **7 requisitos funcionais, todos obrigatórios**. RF03 e RF05 são o núcleo da app.

| ID | Funcionalidade | Ecrã | Responsável | Estado |
|---|---|---|---|---|
| RF01 | Registo e autenticação (criar conta com perfil Cliente/Restaurante, entrar, sair, recuperar palavra-passe) | `login.js`, `(cliente)/conta.js` | Rodrigo | **feito** (a recuperação é por código enviado por email: falta pôr `{{ .Token }}` no modelo de email do Supabase — ver README — e testar) |
| RF02 | Perfil do restaurante: nome, tipo de cozinha, morada com ponto ajustável no mapa, horário de almoço, telefone, fotografia | `(restaurante)/perfil.js` | Rodrigo | **feito** (falta testar no telemóvel) |
| RF03 | Publicar o menu do dia: pratos com nome, categoria e preço; o menu fica associado à data e desaparece à meia-noite; pode ser editado | `publicar.js` | José | **feito** no ramo `rf03-rf04-menu-do-dia` (falta testar no telemóvel) |
| RF04 | Marcar prato esgotado; os clientes veem logo (tempo real) | `(restaurante)/painel.js` | José | **feito** no ramo `rf03-rf04-menu-do-dia` (falta testar no telemóvel; o lado do cliente é o RF06) |
| RF05 | Pratos do dia perto de mim: lista num raio de 2 km por omissão, ordenada por distância, com preço, restaurante e distância | `(cliente)/index.js` | André | **feito** no ramo `rf05-rf07-cliente` (falta testar no telemóvel) |
| RF06 | Mapa com os restaurantes com menu hoje; página do restaurante com menu, horário, morada e botões Ligar e Direções (abre a app de mapas) | `(cliente)/mapa.js`, `restaurante/[id].js` | André | **feito** no ramo `rf05-rf07-cliente` (falta testar no telemóvel) |
| RF07 | Filtros e pesquisa: preço máximo, raio, categoria e pesquisa pelo nome do prato | `(cliente)/index.js`, `(cliente)/mapa.js` | André | **feito** no ramo `rf05-rf07-cliente` (falta testar no telemóvel) |

Trabalho futuro (só depois dos 7 estarem a funcionar): favoritos, notificações. **Reutilizar pratos de dias anteriores: feito** no ramo `rf05-rf07-cliente` — cartão "Repetir o menu de ontem" no Publicar (`src/components/RepetirMenu.js`), com `buscarUltimoMenuAnterior()` em `src/services/menus.js` (o último menu antes de hoje; os pratos vêm sem id, por isso são publicados como pratos novos de hoje) e `descreverDia()` em `src/lib/datas.js`.

**Regras de negócio:** RN01 — um menu só vale no dia em que é publicado (fuso Europe/Lisbon). RN02 — só contas restaurante publicam, e cada uma só altera os seus menus. RN03 — preços em euros com 2 casas decimais (`formatarPreco`).

**Requisitos não funcionais a respeitar no código:**
- RNF01 sessão guardada no SecureStore (já feito em `src/lib/supabase.js`).
- RNF04 RGPD: localização só com permissão, com a app aberta, **nunca guardada na base de dados**; explicar porque se pede.
- RNF05 lista e mapa carregam em < 2 s em 4G; pesquisa por distância feita na base de dados (`pratos_perto`); fotos comprimidas até 500 KB (`quality` no image-picker).
- RNF06 publicar o menu em < 1 minuto; cliente chega a um menu em ≤ 3 toques; botões com ≥ 44 px de área de toque; contraste adequado.
- RNF07 Android 10+ e iOS 15+, testado no Expo Go.
- RNF08 mensagens claras sem rede, sem permissão de localização ou sem pratos no raio; **sem GPS, o utilizador escolhe a zona à mão**; a app não pode fechar sozinha.

## Base de dados (Supabase, já criada)

Projeto Supabase `xcaxitrxadktycibvxig` (região Frankfurt). URL e chave pública em `.env`.

- `perfis` — `id` (= `auth.users.id`), `nome`, `tipo` ('cliente' | 'restaurante'), `criado_em`. Criado **automaticamente** no registo pelo trigger `ao_criar_utilizador`, com `nome` e `tipo` vindos de `options.data` do `signUp`. Cada um só lê o seu; só pode alterar o `nome`.
- `restaurantes` — `id`, `dono_id` (único, = utilizador), `nome`, `tipo_cozinha`, `morada`, `latitude`, `longitude`, `hora_abertura` (time), `hora_fecho` (time), `telefone`, `foto_url`, `criado_em`. Todos leem; só contas restaurante criam o seu (`dono_id = auth.uid()`); só o dono altera/apaga.
- `menus` — `id`, `restaurante_id`, `dia` (date, por omissão = hoje em Lisboa), `preco_menu_completo`, `publicado_em`. **Único por (restaurante_id, dia)**. Todos leem; só o dono do restaurante escreve.
- `pratos` — `id`, `menu_id`, `nome`, `categoria` ('sopa' | 'carne' | 'peixe' | 'vegetariano' | 'sobremesa'), `preco` (numeric ≥ 0), `esgotado` (bool), `criado_em`. Todos leem; só o dono do restaurante do menu escreve. **Está na publicação Realtime** (para o esgotado em tempo real).
- Função `pratos_perto(lat, lng, raio_km = 5, preco_max = null, categoria_filtro = null, pesquisa = null)` → pratos **de hoje** com `prato_id, prato, categoria, preco, esgotado, restaurante_id, restaurante, latitude, longitude, distancia_km`, ordenados com os esgotados no fim e depois por distância. Já embrulhada em `buscarPratosPerto()` (`src/services/pratos.js`, raio 2 km por omissão).
- Storage: bucket público `fotos` (máx. 500 KB, jpeg/png/webp). Cada conta só escreve na pasta com o seu id: `<user_id>/ficheiro.jpg`.

Notas: "menus de ontem" não se apagam — a app só pede os de hoje. Para testar como cliente e como restaurante, criar duas contas.

## Design

Mock-ups no Figma: https://www.figma.com/design/TpDXtsdeNOmMZfTgOCPvMd (7 ecrãs + componentes). Cor principal laranja `#C2410C`, fundo `#F6F5F3`, cartões brancos com borda `#E6E4E1`, cantos 12–16 px, letra do sistema. Esgotado = texto cinzento riscado + etiqueta "Esgotado".

Navegação (`src/app/_layout.js`, com `Stack.Protected`): sem sessão → `login`; cliente → separadores Início / Mapa / Conta + `restaurante/[id]`; restaurante → separadores Painel / Perfil + `publicar`. Cada `Stack.Protected` tem `redirectTo` com o primeiro ecrã do percurso (`rotaInicial()` em `src/lib/navegacao.js`): sem isso, as contas de restaurante iam parar a "Unmatched Route", porque o grupo `(restaurante)` não tem ecrã `index`. Quem mudar o nome a um ecrã inicial tem de atualizar essa função (o teste `tests/navegacao.test.js` avisa).

Dados do restaurante (RF02): `src/services/restaurantes.js` — `buscarMeuRestaurante(donoId)` devolve o restaurante da conta ou `null` (o Painel e o Publicar precisam disto), `guardarRestaurante`, `enviarFotoRestaurante`, `validarRestaurante`. O telefone é guardado como `+351XXXXXXXXX` (pronto para `tel:`) e as horas como `HH:MM:SS`.

Menu do dia (RF03/RF04): `src/services/menus.js` — `buscarMenuDeHoje(restauranteId)` devolve o menu de hoje com os pratos ordenados (ou `null`), `publicarMenu(restauranteId, { precoMenuCompleto, pratos })` cria o menu ou guarda as alterações mexendo só nos pratos que mudaram (os outros mantêm o id e o `esgotado`), `marcarEsgotado(pratoId, esgotado)`. O dia do menu nunca é enviado pela app: é a base de dados que o preenche no fuso de Lisboa (RN01). Para ler "hoje" usa-se `hojeEmLisboa()` de `src/lib/datas.js`, nunca a data do telemóvel. Os erros do Supabase são traduzidos por `traduzirErro()` em `src/lib/erros.js`. Outros componentes: `Chip` (escolha de categoria, igual ao Figma) e `confirmar()` em `src/lib/confirmar.js` (pergunta antes de perder alterações; também funciona no browser).

Ler o menu por fotografia (extra do RF03): no Publicar, o cartão `LerMenuDaFoto` fotografa o menu e `lerMenuDaFoto()` (`src/services/lerMenu.js`) envia a imagem à função `ler-menu` do Supabase (`supabase/functions/ler-menu/index.js`, corre no servidor em Deno), que a lê com um modelo de IA no serviço Groq (plano gratuito, pedido HTTP no formato da API da OpenAI) e devolve os pratos. Os pratos entram na lista para o dono confirmar; um prato sem preço legível fica com "Falta o preço" e não deixa publicar. A chave do serviço de IA é um segredo do Supabase (`GROQ_API_KEY`), nunca está na app. **A função está publicada no Supabase (17 nov 2026), mas falta criar o segredo `GROQ_API_KEY`** (passos no README); o modelo (`qwen/qwen3.8-27b`) está em "Preview" no Groq e pode ser trocado com o segredo `MODELO_LER_MENU`; até lá a app avisa e os pratos escrevem-se à mão. Se o código da função mudar, tem de ser publicada outra vez.

Morada no mapa (RF02): `procurarMoradaNoMapa()` usa o serviço público Nominatim (OpenStreetMap), com `fetch`. Não usa o localizador do telemóvel (falhava mesmo com rede) nem pede permissão de localização.

Lado do cliente (RF05–RF07): `src/context/PertoContext.js` (`usePerto()`) guarda o sítio onde se procura, os filtros e os pratos encontrados, e é partilhado pelo Início e pelo Mapa — os dois mostram sempre o mesmo e a pesquisa é feita uma só vez. A localização vem de `src/services/localizacao.js` (só com a app aberta, só em memória — RNF04); sem GPS ou sem permissão o cliente escolhe uma zona de `src/lib/zonas.js` (RNF08). Componentes: `EscolherLocal` (explica porque se pede a localização antes do pedido do sistema), `FiltrosDePratos` (pesquisa com espera de 400 ms, categoria, preço máximo, raio), `CartaoDePrato`. Em `src/services/pratos.js`: `agruparPorRestaurante()` (um marcador por restaurante), `aplicarAlteracaoDePrato()` (esgotado em tempo real na lista) e `ouvirAlteracoesPratos(aoAlterar, { menuId })`, que cria um canal com nome único por ecrã (dois canais com o mesmo nome dão erro no Supabase). Página do restaurante: `buscarRestaurante(id)` e `src/lib/ligacoes.js` (`ligar`, `abrirDirecoes`).

## Planeamento

| Período | Trabalho |
|---|---|
| 10–16 nov | Repositório, projeto Expo, ligação ao Supabase ✅ |
| 17–29 nov | RF01 ✅, RF02 |
| 30 nov – 13 dez | RF03, RF04 |
| 14–27 dez | RF05, RF06, RF07 |
| 28 dez – 3 jan | Restaurantes de teste, testes em Android e iPhone, correções |
| 4–10 jan | Relatório final, poster, vídeo, preparar demo |
| 14–15 jan | Defesa com a app a funcionar ao vivo |
