// Zonas que o cliente pode escolher à mão quando não quer (ou não consegue) dar a localização (RNF08).
// As coordenadas são o centro de cada cidade (fonte: OpenStreetMap).
// Para acrescentar uma zona basta juntar uma linha a esta lista.

export const ZONAS = [
  { id: 'porto', nome: 'Porto', latitude: 41.1502, longitude: -8.6103 },
  { id: 'gaia', nome: 'Vila Nova de Gaia', latitude: 41.1292, longitude: -8.6057 },
  { id: 'matosinhos', nome: 'Matosinhos', latitude: 41.1807, longitude: -8.6822 },
  { id: 'maia', nome: 'Maia', latitude: 41.2373, longitude: -8.63 },
  { id: 'gondomar', nome: 'Gondomar', latitude: 41.1398, longitude: -8.5326 },
  { id: 'vila-do-conde', nome: 'Vila do Conde', latitude: 41.354, longitude: -8.7435 },
  { id: 'povoa-de-varzim', nome: 'Póvoa de Varzim', latitude: 41.3794, longitude: -8.7599 },
  { id: 'braga', nome: 'Braga', latitude: 41.5511, longitude: -8.428 },
  { id: 'guimaraes', nome: 'Guimarães', latitude: 41.4418, longitude: -8.2956 },
  { id: 'aveiro', nome: 'Aveiro', latitude: 40.6405, longitude: -8.6538 },
  { id: 'coimbra', nome: 'Coimbra', latitude: 40.2112, longitude: -8.4291 },
  { id: 'lisboa', nome: 'Lisboa', latitude: 38.7078, longitude: -9.1366 },
];

// Onde ficam os restaurantes de demonstração (scripts/demonstracao.mjs): à volta da ESMAD, em Vila do Conde.
// Quando não há pratos perto do cliente (por exemplo, quem experimenta a app em casa), o Início oferece
// "Ver os restaurantes de demonstração", que passa a procurar aqui (como escolher uma zona à mão).
export const ZONA_DA_DEMONSTRACAO = { id: 'demonstracao', nome: 'ESMAD (demonstração)', latitude: 41.36662, longitude: -8.73871 };
