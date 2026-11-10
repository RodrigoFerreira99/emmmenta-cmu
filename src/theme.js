// Cores e medidas tiradas dos mock-ups do Figma ("Mock-ups — App do prato do dia").
// Usar sempre estas constantes em vez de escrever cores à mão nos ecrãs.

export const cores = {
  acento: '#C2410C', // laranja principal (botões, preços, separador ativo)
  acentoSuave: '#FBE5D6', // fundo laranja claro (cartões em destaque, fotos)
  texto: '#1A1718',
  textoSecundario: '#5C5C5C',
  textoTerciario: '#8F8F8F',
  textoInverso: '#FFFFFF',
  linha: '#E6E4E1',
  fundo: '#F6F5F3',
  superficie: '#FFFFFF',
  sucesso: '#15803D',
  sucessoSuave: '#DCFCE7',
  erro: '#B91C1C',
};

export const espaco = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

export const raio = { s: 8, m: 12, l: 14, xl: 16, pilula: 999 };

export const texto = {
  titulo: { fontSize: 24, fontWeight: '700', color: cores.texto },
  subtitulo: { fontSize: 17, fontWeight: '600', color: cores.texto },
  corpo: { fontSize: 15, color: cores.texto },
  pequeno: { fontSize: 13, color: cores.textoSecundario },
  etiqueta: { fontSize: 13, fontWeight: '500', color: cores.textoSecundario },
};
