import { ScrollView } from 'react-native';

import { Ecra, PorFazer } from '@/components/ui';
import { espaco } from '@/theme';

// Ecrã 6 · Publicar menu (RF03) — responsável: José
export default function Publicar() {
  return (
    <Ecra bordas={[]}>
      <ScrollView contentContainerStyle={{ padding: espaco.xl, gap: espaco.l }}>
        <PorFazer
          requisitos="RF03"
          responsavel="José"
          itens={[
            'Obter (ou criar) o menu de hoje do restaurante: tabela menus, um por dia',
            'Adicionar prato: nome, categoria (CATEGORIAS em services/pratos.js) e preço',
            'Lista dos pratos de hoje, com botão para remover',
            'Botão "Publicar menu": grava tudo e volta ao Painel',
            'Objetivo de usabilidade: publicar em menos de 1 minuto (RNF06)',
          ]}
        />
      </ScrollView>
    </Ecra>
  );
}
