// Design final da Emmmenta: "visão térmica" (nov 2026).
// A app vê o calor: o que está perto e acabado de fazer fica quente (laranja, amarelo); o que está longe
// ou esgotado fica frio (roxo). Usar sempre estas constantes em vez de escrever cores à mão nos ecrãs:
// para mudar a paleta da app inteira basta mudar este ficheiro.
// Os contrastes (RNF06: texto com pelo menos 4,5:1) são verificados em tests/tema.test.js.

// A paleta das câmaras térmicas ("ironbow"): do frio (0) ao quente (1).
// Usada no título "almoçamos", no mapa de calor e no aviso de quando se abana o telemóvel.
export const paletaDoCalor = [
  [0, '#07040F'],
  [0.14, '#1C0C45'],
  [0.3, '#56107A'],
  [0.46, '#A81E6C'],
  [0.6, '#E2402F'],
  [0.74, '#F98B1F'],
  [0.87, '#FBD64C'],
  [1, '#FFFBEA'],
];

export const cores = {
  acento: '#FF8A1F', // laranja "quente": botões, preços, separador ativo
  acentoSuave: '#2B1324', // fundo de destaque (cartões em destaque, fotos ainda a carregar)
  acentoTexto: '#FFB36B', // laranja para texto por cima de acentoSuave ("Últimas doses")
  texto: '#FFF6EA',
  textoSecundario: '#C3B8D3',
  textoTerciario: '#9A8EAE',
  textoInverso: '#1A0A05', // texto e ícones por cima do laranja (botões, etiquetas ligadas)
  textoSobreImagem: '#FFFFFF', // texto e ícones por cima da câmara ou de fotografias
  linha: '#2A2140',
  fundo: '#07040F',
  superficie: '#130C1F',
  sucesso: '#4ADE9A',
  sucessoSuave: '#0E2A1F',
  erro: '#FF7468',
  erroSuave: '#30111A',
  sombra: '#000000',
};

// O cartaz com o QR code (src/lib/qr.js) é impresso em papel branco: usa sempre cores claras.
export const coresDeImpressao = {
  acento: '#C2410C',
  texto: '#1A1718',
  textoSecundario: '#5C5C5C',
  textoTerciario: '#707070',
  linha: '#E6E4E1',
  superficie: '#FFFFFF',
};

// Letras: Bricolage Grotesque (títulos e texto) e JetBrains Mono (preços, distâncias e rótulos).
// No Expo Go cada peso é uma letra à parte (o "fontWeight" não escolhe o peso), por isso há um nome por peso.
// São carregadas em src/app/_layout.js.
export const fontes = {
  normal: 'BricolageGrotesque_400Regular',
  media: 'BricolageGrotesque_500Medium',
  semi: 'BricolageGrotesque_600SemiBold',
  negrito: 'BricolageGrotesque_700Bold',
  grossa: 'BricolageGrotesque_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoForte: 'JetBrainsMono_600SemiBold',
};

export const espaco = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

export const raio = { s: 10, m: 14, l: 18, xl: 22, pilula: 999 };

export const texto = {
  titulo: { fontSize: 26, fontFamily: fontes.grossa, letterSpacing: -0.6, color: cores.texto },
  subtitulo: { fontSize: 17, fontFamily: fontes.negrito, color: cores.texto },
  corpo: { fontSize: 15, fontFamily: fontes.normal, color: cores.texto },
  pequeno: { fontSize: 13, fontFamily: fontes.normal, color: cores.textoSecundario },
  etiqueta: { fontSize: 13, fontFamily: fontes.media, color: cores.textoSecundario },
  // preços, distâncias e números
  numero: { fontSize: 14, fontFamily: fontes.monoForte, color: cores.texto },
  // rótulos pequenos em maiúsculas ("O MAIS PERTO", "SOPA")
  rotulo: { fontSize: 10, fontFamily: fontes.mono, letterSpacing: 0.6, color: cores.textoSecundario },
};

// Cores do mapa 3D do Início (src/components/MapaDeCalor.js): prédios, ruas e água no mesmo tom escuro da app.
export const coresDoMapa3d = {
  fundo: '#07040F',
  verde: '#0D0C1C',
  agua: '#0B1033',
  rua: '#2C2245',
  ruaGrande: '#3D2F5C',
  predio: '#1C1432',
};

// Estilo escuro para o mapa do Google (Android). No iPhone usa-se o modo escuro do Apple Maps.
export const estiloDoMapaEscuro = [
  { elementType: 'geometry', stylers: [{ color: '#140d22' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9a8eae' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#07040f' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2245' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#3d2f5c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4a3970' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1033' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#1c1432' }] },
];
