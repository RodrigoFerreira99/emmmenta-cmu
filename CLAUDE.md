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
| RF02 | Perfil do restaurante: nome, tipo de cozinha, morada com ponto ajustável no mapa, horário de almoço, telefone, fotografia | `(restaurante)/perfil.js` | Rodrigo | **feito** (o perfil já foi guardado a partir da app; falta testar a fotografia com a câmara nova) |
| RF03 | Publicar o menu do dia: pratos com nome, categoria e preço; o menu fica associado à data e desaparece à meia-noite; pode ser editado | `publicar.js` | José | **feito** (publicar e ler o menu por fotografia já testados no telemóvel) |
| RF04 | Marcar prato esgotado; os clientes veem logo (tempo real) | `(restaurante)/painel.js` | José | **feito** (falta testar no telemóvel, de preferência com um segundo telemóvel como cliente) |
| RF05 | Pratos do dia perto de mim: lista num raio de 2 km por omissão, ordenada por distância, com preço, restaurante e distância | `(cliente)/index.js` | André | **feito** (falta testar no telemóvel) |
| RF06 | Mapa com os restaurantes com menu hoje; página do restaurante com menu, horário, morada e botões Ligar e Direções (abre a app de mapas) | `(cliente)/mapa.js`, `restaurante/[id].js` | André | **feito** (falta testar no telemóvel) |
| RF07 | Filtros e pesquisa: preço máximo, raio, categoria e pesquisa pelo nome do prato | `(cliente)/index.js`, `(cliente)/mapa.js` | André | **feito** (falta testar no telemóvel) |

Os sete requisitos estão no `main` desde 18 nov 2026 (PR #1, #2 e #3). Os ramos de cada parte já foram apagados: o trabalho novo começa num ramo novo a partir do `main`.

Trabalho futuro (só depois dos 7 estarem a funcionar): notificações remotas ("push", não funcionam no Expo Go para Android); **os lembretes diários locais já estão feitos** (ver em baixo). **Favoritos: feito**, guardados só no telemóvel (`src/lib/favoritos.js`, ficheiro `favoritos.json`; não vão para a base de dados) — coração na página do restaurante, coração nos cartões da lista e filtro "Só os meus favoritos" no painel dos filtros (filtra no telemóvel, sem novo pedido). **Reutilizar pratos de dias anteriores: feito** — cartão "Repetir o menu de ontem" no Publicar (`src/components/RepetirMenu.js`), com `buscarUltimoMenuAnterior()` em `src/services/menus.js` (o último menu antes de hoje; os pratos vêm sem id, por isso são publicados como pratos novos de hoje) e `descreverDia()` em `src/lib/datas.js`.

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
- `menus` — `id`, `restaurante_id`, `dia` (date, por omissão = hoje em Lisboa), `preco_menu_completo`, `publicado_em`, `lotacao` ('ha-mesa' | 'cheio' | null) e `lotacao_em` (posta pelo trigger `lotacao_com_hora` com a hora do servidor). **Único por (restaurante_id, dia)**. Todos leem; só o dono do restaurante escreve. **Está na publicação Realtime** (para a lotação em tempo real).
- `pratos` — `id`, `menu_id`, `nome`, `categoria` ('sopa' | 'carne' | 'peixe' | 'vegetariano' | 'sobremesa'), `preco` (numeric ≥ 0), `esgotado` (bool), `ultimas_doses` (bool), `etiquetas` (text[]: 'vegano' | 'sem-gluten' | 'sem-lactose' | 'picante'), `foto_url`, `criado_em`. Todos leem; só o dono do restaurante do menu escreve. **Está na publicação Realtime** (para o esgotado em tempo real).
- Função `pratos_perto(lat, lng, raio_km = 5, preco_max = null, categoria_filtro = null, pesquisa = null, etiqueta_filtro = null)` → pratos **de hoje** com `prato_id, prato, categoria, preco, esgotado, ultimas_doses, etiquetas, foto_url, menu_id, lotacao, lotacao_em, restaurante_id, restaurante, latitude, longitude, distancia_km`, ordenados com os esgotados no fim e depois por distância. A pesquisa pelo nome não liga a acentos (função `sem_acentos`). Já embrulhada em `buscarPratosPerto()` (`src/services/pratos.js`, raio 2 km por omissão).
- Storage: bucket público `fotos` (máx. 500 KB, jpeg/png/webp). Cada conta só escreve na pasta com o seu id: `<user_id>/ficheiro.jpg`.

Notas: "menus de ontem" não se apagam — a app só pede os de hoje. Para testar como cliente e como restaurante, criar duas contas. Restaurantes de demonstração (6, perto da ESMAD, sem telefone): `scripts/demonstracao.mjs` (`criar` uma vez, `publicar` no dia, `estado`, `retirar`); usa só a chave pública e a RLS normal, e guarda a palavra-passe das contas em `.env.local`. A tarefa `.github/workflows/publicar-menus-de-demonstracao.yml` corre `publicar` todas as manhãs às 6h30 UTC (o script também lê as chaves das variáveis de ambiente; precisa do segredo `EMMMENTA_DEMO_PALAVRA_PASSE` no GitHub, além dos dois de baixo) e termina com erro se algum restaurante falhar. A tarefa `.github/workflows/manter-supabase-acordado.yml` lê a base de dados todos os dias para o plano gratuito não pausar o projeto (precisa dos segredos `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no GitHub). Ver "Antes da defesa" no README.

## Design

Mock-ups no Figma (primeira versão): https://www.figma.com/design/TpDXtsdeNOmMZfTgOCPvMd (7 ecrãs + componentes). Esgotado = texto cinzento riscado + etiqueta "Esgotado".

**Design final "visão térmica" (ramo `design-termico`, 21 nov 2026, escolhido pelo Rodrigo a partir de protótipos no browser):** a app "vê o calor": perto = quente (laranja/amarelo), longe = morno, esgotado = frio (roxo). Tema escuro; as cores estão todas em `src/theme.js` (mudar a paleta = mudar esse ficheiro; o Rodrigo disse que as cores ainda podem mudar e achou o modo claro "estranho" — falta decidir o modo claro e a transição com a mancha de tinta). Pontos-chave:
- Cores com os mesmos nomes de antes (`cores.acento`, `cores.fundo`…); novas: `acentoTexto` (era `acentoEscuro`), `textoSobreImagem` (câmara/fotos), `coresDeImpressao` (o cartaz do QR continua claro), `paletaDoCalor`, `coresDoMapa3d`, `estiloDoMapaEscuro`. Contraste verificado em `tests/tema.test.js` (RNF06). `src/lib/cores.js`: `corDoCalor(t)`, `calorDoPrato()`, `contraste()`.
- Letras Bricolage Grotesque e JetBrains Mono (`@expo-google-fonts`), carregadas no `_layout`; usar `fontes.*` em `fontFamily` (no Expo Go o `fontWeight` não escolhe o peso).
- Ícones: `Icone` (`src/components/Icone.js`), desenhos Phosphor (MIT) com os nomes antigos dos Ionicons; `src/components/caminhosDosIcones.js` é gerado por `scripts/gerar-icones.mjs` (só os 60 usados). Não usar `@expo/vector-icons` em ecrãs novos.
- Pratos em 3D: `assets/pratos/*.png` (21 imagens feitas a partir dos modelos de comida do Kenney, CC0); `imagemDoPrato()`/`chaveDaImagem()` em `src/lib/imagensDosPratos.js` (pelo nome do prato e pela categoria); `ImagemDoPrato` (a fotografia do restaurante tem prioridade); `CapaQuente` na página do restaurante sem fotografia (prato principal em 3D, `pratoDeDestaque()`).
- Início: saudação, `TituloQuente` ("O que almoçamos hoje?"), `MapaDeCalor` (mapa 3D real numa WebView com MapLibre GL 4.7.1 + mosaicos OpenFreeMap, sem chave; contas em `src/lib/mapaDeCalor.js`, página em `src/lib/htmlDoMapaDeCalor.js`; só para ver, tocar abre o separador Mapa; sem rede mostra uma mensagem).
- Abanar: `useTudoACair`/`PecaQueCai` (`src/components/TudoACai.js`) + física em `src/lib/queda.js` (Matter.js): tudo cai, o calor enche o ecrã e abre o restaurante com `calhou=1` ("Hoje almoças aqui", o prato cai do céu na capa). O `AbanaParaDecidir` (sorteio) foi apagado.
- Nos testes que abrem o Início é preciso simular `react-native-webview` e o `useAuth` (ver `tests/inicio.test.js`).

Navegação (`src/app/_layout.js`, com `Stack.Protected`): sem sessão → `login`; cliente → separadores Início / Mapa / Conta + `restaurante/[id]`; restaurante → separadores Painel / Perfil + `publicar`. Cada `Stack.Protected` tem `redirectTo` com o primeiro ecrã do percurso (`rotaInicial()` em `src/lib/navegacao.js`): sem isso, as contas de restaurante iam parar a "Unmatched Route", porque o grupo `(restaurante)` não tem ecrã `index`. Quem mudar o nome a um ecrã inicial tem de atualizar essa função (o teste `tests/navegacao.test.js` avisa).

Dados do restaurante (RF02): `src/services/restaurantes.js` — `buscarMeuRestaurante(donoId)` devolve o restaurante da conta ou `null` (o Painel e o Publicar precisam disto), `guardarRestaurante`, `enviarFotoRestaurante`, `validarRestaurante`. O telefone é guardado como `+351XXXXXXXXX` (pronto para `tel:`) e as horas como `HH:MM:SS`.

Menu do dia (RF03/RF04): `src/services/menus.js` — `buscarMenuDeHoje(restauranteId)` devolve o menu de hoje com os pratos ordenados (ou `null`), `publicarMenu(restauranteId, { precoMenuCompleto, pratos })` cria o menu ou guarda as alterações mexendo só nos pratos que mudaram (os outros mantêm o id e o `esgotado`), `marcarEsgotado(pratoId, esgotado)`. O dia do menu nunca é enviado pela app: é a base de dados que o preenche no fuso de Lisboa (RN01). Para ler "hoje" usa-se `hojeEmLisboa()` de `src/lib/datas.js`, nunca a data do telemóvel. Os erros do Supabase são traduzidos por `traduzirErro()` em `src/lib/erros.js`. Outros componentes: `Chip` (escolha de categoria, igual ao Figma) e `confirmar()` em `src/lib/confirmar.js` (pergunta antes de perder alterações; também funciona no browser).

Ler o menu por fotografia (extra do RF03): no Publicar, o cartão `LerMenuDaFoto` fotografa o menu e `lerMenuDaFoto()` (`src/services/lerMenu.js`) envia a imagem à função `ler-menu` do Supabase (`supabase/functions/ler-menu/index.js`, corre no servidor em Deno), que a lê com um modelo de IA no serviço Groq (plano gratuito, pedido HTTP no formato da API da OpenAI) e devolve os pratos. Os pratos entram na lista para o dono confirmar; um prato sem preço legível fica com "Falta o preço" e não deixa publicar. A chave do serviço de IA é um segredo do Supabase (`GROQ_API_KEY`), nunca está na app. Está ativa: a função foi publicada (17 nov 2026) e o segredo `GROQ_API_KEY` criado; já foi testada no telemóvel. O modelo (`qwen/qwen3.8-27b`) está em "Preview" no Groq e pode ser trocado com o segredo `MODELO_LER_MENU`; se o serviço falhar, a app avisa e os pratos escrevem-se à mão. Se o código da função mudar, tem de ser publicada outra vez.

Fotografias (perfil e menu): para **tirar** uma fotografia usa-se `CameraNaApp` (`src/components/CameraNaApp.js`, câmara dentro da app com `expo-camera`), e não a app da câmara do telemóvel: no Android o sistema fechava a Emmmenta enquanto a outra app estava aberta e a fotografia perdia-se. A permissão pede-se antes com `pedirAcessoACamara()` e a galeria abre com `escolherDaGaleria()` (`src/lib/fotografias.js`).

Morada no mapa (RF02): `procurarMoradaNoMapa()` usa o serviço público Nominatim (OpenStreetMap), com `fetch`. Não usa o localizador do telemóvel (falhava mesmo com rede) nem pede permissão de localização.

Lado do cliente (RF05–RF07): `src/context/PertoContext.js` (`usePerto()`) guarda o sítio onde se procura, os filtros e os pratos encontrados, e é partilhado pelo Início e pelo Mapa — os dois mostram sempre o mesmo e a pesquisa é feita uma só vez. A localização vem de `src/services/localizacao.js` (só com a app aberta, só em memória — RNF04); sem GPS ou sem permissão o cliente escolhe uma zona de `src/lib/zonas.js` (RNF08). Componentes: `EscolherLocal` (explica porque se pede a localização antes do pedido do sistema), `FiltrosDePratos` (pesquisa com espera de 400 ms, categoria, preço máximo, raio), `CartaoDePrato`. Em `src/services/pratos.js`: `ordenarPratosDaLista()` (esgotados no fim, depois distância e, no mesmo restaurante, os pratos principais antes da sopa e da sobremesa), `agruparPorRestaurante()` (um marcador por restaurante), `aplicarAlteracaoDePrato()` (esgotado em tempo real na lista) e `ouvirAlteracoesPratos(aoAlterar, { menuId })`, que cria um canal com nome único por ecrã (dois canais com o mesmo nome dão erro no Supabase). Painel do filtro: além da categoria, preço máximo, raio e favoritos, "Ordenar" escolhe "Mais perto primeiro" (por omissão) ou "Mais barato primeiro" (`filtros.ordem`, ordena no telemóvel com `ordenarPorPreco()`, sem novo pedido). Separador Conta: "Os meus favoritos" com `buscarRestaurantesPorIds(ids)` (`src/services/restaurantes.js`), que diz também se cada um já publicou o menu de hoje. Partilhar (`src/lib/partilhar.js`, `Share` do React Native): no Painel, "Partilhar o menu de hoje" (`textoDoMenuDeHoje`); na página do restaurante, o ícone de partilhar convida alguém para almoçar (`textoDoConvite`, com o link das direções). Página do restaurante: "Aberto agora · fecha às 15:00" com `estadoDoHorario()` (`src/services/restaurantes.js`, hora de Lisboa por `horaEmLisboa()`); `buscarRestaurante(id)` e `src/lib/ligacoes.js` (`ligar`, `abrirDirecoes`).

Funcionalidades do telemóvel (todas incluídas no Expo Go, sem mexer na base de dados; ramo `extras-expo-go`, 19 nov 2026):
- **Lembretes diários** (`src/lib/lembretes.js`, `expo-notifications`): notificações LOCAIS agendadas pelo telemóvel; cartão `LembreteDiario` na Conta do cliente ("Lembrete do almoço", 11h30–13h00) e no Perfil do restaurante ("Lembrete para publicar o menu", 9h30–11h00). `prepararNotificacoes()` no `_layout`.
- **Ouvir o menu** (`src/lib/ouvirMenu.js`, `expo-speech`): botão do altifalante na página do restaurante; `textoDoMenuParaOuvir` e `precoParaFala` ("8 euros e 50"); em inglês no menu em inglês.
- **Bússola até ao restaurante** (`src/components/Bussola.js`): `seguirPosicao` e `seguirDirecao` (`src/services/localizacao.js`), `rumoEmGraus`, `anguloDaSeta`, `descreverDirecao`, `CHEGOU_A_METROS` (`src/services/caminho.js`); vibra ao chegar.
- **QR code do restaurante** (`src/lib/qr.js`): o QR guarda `emmmenta://restaurante/<id>` (`lerQrDoRestaurante` só aceita esse formato); Painel → `QrDoRestaurante` (cartaz A4 com o menu de hoje: `expo-print`, PDF com `expo-sharing`); Início → ícone do QR → `LerQr` (leitor da `expo-camera`). Desenho com `qrcode-generator` + `react-native-svg`; os nomes são escapados no HTML (`escaparHtml`).
- **Menu em inglês automático** (`src/lib/lingua.js`, `expo-localization`): num telemóvel noutra língua a página do restaurante abre em inglês; a tradução que falta é pedida por um efeito (o botão só muda de língua).
- **Guia da defesa:** `docs/guia-da-defesa.md` (perguntas por pessoa, guião da demonstração, plano B, comandos).
- Nos testes, componentes com `SafeAreaView` dentro de um `Modal` precisam do mock oficial (`react-native-safe-area-context/jest/mock`); o `testTimeout` do Jest é 20 s (testes de ecrã lentos com o computador ocupado).

Caminho a pé (extra do RF06, ideia do Rodrigo): na página do restaurante, "Ver o caminho a pé" abre `CaminhoAPe` (`src/components/CaminhoAPe.js`). Vê a permissão (se faltar, explica porque se pede antes do pedido do sistema — RNF04), lê a localização (só em memória) e chama `calcularCaminhoAPe(origem, destino)` (`src/services/caminho.js`), que pede o percurso a pé ao OSRM do FOSSGIS (`routing.openstreetmap.de/routed-foot`, sem chave; regras: no máximo 1 pedido por segundo, User-Agent, atribuição com a ligação "Corrigir o mapa"). A origem vai arredondada a 3 casas decimais (cerca de 100 m). O mapa desenha a linha (`Polyline`) e mostra "12 min a pé · 870 m" (`descreverCaminho`). Plano B sem rede: linha reta tracejada com estimativa (`caminhoEmLinhaReta`). O botão "Direções" continua a abrir a app de mapas, como pede o RF06.

Assistente de IA (extra): a função `assistente` (`supabase/functions/assistente/index.js`, publicada a 18 nov 2026, com "Verify JWT") usa a mesma chave `GROQ_API_KEY`, só aceita contas com sessão iniciada (confirma o token em `/auth/v1/user`) e tem duas tarefas: `interpretar-pesquisa` (frase → filtros) e `traduzir-pratos` (nomes dos pratos em inglês); o modelo pode trocar-se com o segredo `MODELO_ASSISTENTE`. Na app, `src/services/assistente.js`: `interpretarPesquisa(texto)` devolve `{ filtros, comIa }` e, se a IA falhar, usa o plano B `interpretarPesquisaSemIa()` (regras simples, sem rede); `limparFiltrosDaIa()` só deixa passar categorias, preços e raios que a app conhece; `descreverFiltros()`; `traduzirPratos(nomes)` e `CATEGORIAS_EM_INGLES`. O botão com estrelas do `FiltrosDePratos` abre `PesquisaComIa` ("Diz o que te apetece"), que aplica os filtros com `aplicarFiltros()` do `PertoContext`. Na página do restaurante, o botão "English" mostra o menu em inglês (a tradução fica guardada enquanto a página está aberta). Os erros das funções do Supabase são traduzidos por `traduzirErroDeFuncao()` em `src/lib/erros.js` (também usada pela leitura por fotografia).

Outras novidades (ramo `wow`, 18 nov 2026): no mapa, cada marcador é uma etiqueta com o preço mais baixo do restaurante (`EtiquetaDoMapa`); esqueletos de carregamento (`src/components/Esqueleto.js`, respeitam "reduzir movimento"); vibração (`src/lib/vibrar.js`, `expo-haptics`) e animação das mudanças de ordem (`src/lib/animacoes.js`). "O almoço mais barato perto de ti" (`DestaqueMaisBarato`, `almocoMaisBarato()`); abanar o telemóvel para decidir (`src/lib/abanar.js` com `expo-sensors`, `escolherAoAcaso()`; desde o design térmico é a queda de `TudoACai`); aviso quando um restaurante favorito publica o menu (`AvisoDeFavoritos` no layout do cliente, com `ouvirPratosNovos()` e `buscarRestauranteDoMenu()`). Precauções: palavras-passe novas com pelo menos 8 caracteres (`TAMANHO_MINIMO_PALAVRA_PASSE` em `src/lib/validarConta.js`; ao entrar não se verifica, as contas antigas continuam), `scripts/copia-de-seguranca.mjs` (restaurantes, menus e pratos em `copias/`, fora do git) e o guia dos telemóveis da demonstração no README.

Ideias com base de dados (aplicadas a 18 nov 2026 com o OK do Rodrigo; SQL e como desfazer em `supabase/migracoes/2026-11-18-ideias-novas.sql`; as regras de segurança ficaram iguais):
- **Últimas doses:** botão em cada prato do Painel (`marcarUltimasDoses`; esgotar tira-as, `marcarEsgotado`); etiqueta laranja `EtiquetaUltimasDoses` no cartão e na página; em tempo real como o esgotado.
- **"Há mesa" / "Cheio agora":** cartão "Como está a sala agora?" no Painel (`EscolherLotacao`, `marcarLotacao`); para os clientes `EtiquetaDeLotacao` (página e mapa) e texto no cartão da lista. Só vale 45 minutos (`lotacaoAtual`, `LOTACAO_VALIDA_MINUTOS`); em tempo real com `ouvirLotacao` (página e `PertoContext`, `aplicarAlteracaoDeMenu`). Componentes em `src/components/Lotacao.js`.
- **Etiquetas:** `ETIQUETAS` e `descreverEtiquetas()` em `src/services/pratos.js`; no Publicar, chips de escolha múltipla (`Chip multipla`); filtro "Dieta e sabor" no painel dos filtros (`filtros.etiqueta` → `etiqueta_filtro`); o assistente também as percebe ("sou celíaco" → sem glúten).
- **Fotografia de cada prato:** no Publicar, `SeletorFoto` (com `doQue=" do prato"`) e `enviarFotoDoPrato` (pasta `<conta>/pratos/`, enviada logo); miniatura no cartão da lista e `FotoDoPrato` na página do restaurante (tocar abre em grande).
- **Demonstração:** os pratos de `scripts/demonstracao.mjs` têm etiquetas, e `node scripts/demonstracao.mjs sala` põe "Há mesa"/"Cheio agora" nos menus de hoje (vale 45 minutos: correr mesmo antes de mostrar).

## Planeamento

| Período | Trabalho |
|---|---|
| 10–16 nov | Repositório, projeto Expo, ligação ao Supabase ✅ |
| 17–29 nov | RF01 ✅, RF02 ✅ |
| 30 nov – 13 dez | RF03 ✅, RF04 ✅ (feitos mais cedo, a 15–17 nov) |
| 14–27 dez | RF05 ✅, RF06 ✅, RF07 ✅ (feitos mais cedo, a 16–18 nov) |
| 28 dez – 3 jan | Restaurantes de teste, testes em Android e iPhone, correções |
| 4–10 jan | Relatório final, poster, vídeo, preparar demo |
| 14–15 jan | Defesa com a app a funcionar ao vivo |
