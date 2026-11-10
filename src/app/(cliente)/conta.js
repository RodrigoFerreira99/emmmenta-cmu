import { Text, View } from 'react-native';

import { Botao, Ecra } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { cores, espaco, raio, texto } from '@/theme';

// Conta do cliente: quem está a usar a app e terminar sessão (RF01).
export default function Conta() {
  const { sessao, perfil, sair } = useAuth();
  return (
    <Ecra>
      <View style={{ padding: espaco.xl, gap: espaco.l }}>
        <Text style={texto.titulo}>Conta</Text>
        <View style={{ backgroundColor: cores.superficie, borderRadius: raio.xl, padding: espaco.l, gap: espaco.xs, borderWidth: 1, borderColor: cores.linha }}>
          <Text style={texto.subtitulo}>{perfil?.nome || 'Sem nome'}</Text>
          <Text style={texto.pequeno}>{sessao?.user?.email}</Text>
          <Text style={texto.pequeno}>Conta de cliente</Text>
        </View>
        <Botao tipo="secundario" icone="log-out-outline" titulo="Terminar sessão" onPress={sair} />
      </View>
    </Ecra>
  );
}
