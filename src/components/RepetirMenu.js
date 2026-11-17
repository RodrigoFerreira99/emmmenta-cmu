import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/components/ui';
import { descreverDia } from '@/lib/datas';
import { cores, espaco, raio, texto } from '@/theme';

// Cartão "Repetir o menu de ontem" do ecrã Publicar menu (reutilizar pratos de dias anteriores).
// Muitos restaurantes repetem pratos de um dia para o outro: com um toque, os pratos do último menu
// entram na lista de hoje e o dono só muda o que for diferente (RNF06: publicar em menos de 1 minuto).
//
// Propriedades:
//   menu       o último menu antes de hoje, como vem de buscarUltimoMenuAnterior(): { dia, pratos }
//   aoRepetir  função chamada ao carregar no botão; devolve a frase a mostrar por baixo
export function RepetirMenu({ menu, aoRepetir }) {
  const [aviso, setAviso] = useState(null);
  const quantos = menu.pratos.length;

  return (
    <View style={estilos.cartao}>
      <View style={estilos.cabecalho}>
        <Ionicons name="repeat-outline" size={20} color={cores.acento} />
        <Text style={[texto.subtitulo, estilos.ocuparTudo]}>Repetir o menu de {descreverDia(menu.dia)}</Text>
      </View>
      <Text style={texto.pequeno} numberOfLines={2}>
        {menu.pratos.map((prato) => prato.nome).join(' · ')}
      </Text>
      <Botao
        tipo="secundario"
        icone="copy-outline"
        titulo={quantos === 1 ? 'Usar este prato' : `Usar estes ${quantos} pratos`}
        onPress={() => setAviso(aoRepetir())}
      />
      {aviso ? (
        <Text style={estilos.sucesso} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  ocuparTudo: { flex: 1 },
  cartao: {
    gap: espaco.m,
    padding: espaco.l,
    borderRadius: raio.xl,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
  sucesso: { ...texto.pequeno, color: cores.sucesso },
});
