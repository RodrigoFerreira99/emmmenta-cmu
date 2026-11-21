import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, Modal, StyleSheet } from 'react-native';
import { Circle, Defs, RadialGradient, Stop, Svg } from 'react-native-svg';

import { corDoCalor } from '@/lib/cores';
import { criarQueda } from '@/lib/queda';
import { vibrarSucesso } from '@/lib/vibrar';

// O "abanar" do design térmico, em três tempos:
//  1. tudo cai: as peças do Início (PecaQueCai) soltam-se e caem com física a sério (src/lib/queda.js);
//  2. passado pouco mais de um segundo, o prato que calhou "aquece" até o calor encher o ecrã;
//  3. abre-se a página do restaurante ("Hoje almoças aqui") e as peças voltam ao sítio, escondidas por trás.
// Com "reduzir movimento" ligado no telemóvel não há queda nem calor: abre logo o restaurante.
//
// Uso no ecrã:
//   const { registar, cair, camada } = useTudoACair();
//   <PecaQueCai id="titulo" registar={registar}>…</PecaQueCai>      (cada peça que pode cair)
//   cair({ idEscolhido, aoAcabar: () => abrirORestaurante() });   (ao abanar)
//   {camada}                                                      (o calor, por cima de tudo)

const ESPERA_ATE_AO_CALOR_MS = 1200;
const DURACAO_DO_CALOR_MS = 700;
const ALTURA_DA_BARRA_DE_BAIXO = 90; // o chão fica por cima da barra dos separadores

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

// Mede onde está uma peça no ecrã. Devolve null se não der (por exemplo, nos testes, onde não há ecrã)
// ou se a resposta não chegar a tempo: nesse caso a peça simplesmente não cai.
function medir(vista) {
  return new Promise((resolver) => {
    const elemento = vista.current;
    if (!elemento || typeof elemento.measureInWindow !== 'function') return resolver(null);
    const desistir = setTimeout(() => resolver(null), 300);
    elemento.measureInWindow((x, y, largura, altura) => {
      clearTimeout(desistir);
      resolver(largura > 0 && altura > 0 ? { x, y, largura, altura } : null);
    });
  });
}

export function PecaQueCai({ id, registar, style, children }) {
  const vista = useRef(null);
  const [posicao] = useState(() => new Animated.ValueXY());
  const [rotacao] = useState(() => new Animated.Value(0));
  useEffect(() => registar?.(id, { vista, posicao, rotacao }), [id, registar, posicao, rotacao]);
  const rodar = rotacao.interpolate({ inputRange: [-20, 20], outputRange: ['-20rad', '20rad'] });
  return (
    <Animated.View
      ref={vista}
      collapsable={false}
      style={[style, { transform: [{ translateX: posicao.x }, { translateY: posicao.y }, { rotate: rodar }] }]}
    >
      {children}
    </Animated.View>
  );
}

export function useTudoACair() {
  const pecas = useRef(new Map());
  const [calor, setCalor] = useState(null); // { x, y }: de onde nasce o calor (o prato escolhido)

  const registar = useCallback((id, peca) => {
    pecas.current.set(id, peca);
    return () => pecas.current.delete(id);
  }, []);

  const cair = useCallback(async ({ idEscolhido, aoAcabar }) => {
    const reduzir = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
    if (reduzir) {
      aoAcabar();
      return;
    }
    const { width: largura, height: altura } = Dimensions.get('window');
    const chao = altura - ALTURA_DA_BARRA_DE_BAIXO;

    // só caem as peças que se veem inteiras acima do chão (as outras ficam onde estão, tapadas pelo calor)
    const medidas = await Promise.all([...pecas.current.entries()].map(async ([id, peca]) => ({ id, peca, medida: await medir(peca.vista) })));
    const soltas = medidas.filter(({ medida }) => medida && medida.y + medida.altura > 0 && medida.y + medida.altura <= chao);
    const queda = criarQueda({ pecas: soltas.map(({ medida }) => medida), largura, chao });

    let estado = soltas.map(() => ({ dx: 0, dy: 0, angulo: 0 }));
    let ativa = true;
    let anterior = Date.now();
    const passo = () => {
      if (!ativa) return;
      const agora = Date.now();
      estado = queda.avancar(agora - anterior);
      anterior = agora;
      estado.forEach(({ dx, dy, angulo }, i) => {
        soltas[i].peca.posicao.setValue({ x: dx, y: dy });
        soltas[i].peca.rotacao.setValue(angulo);
      });
      requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);

    // 2. o calor nasce do prato escolhido (onde ele estiver agora, a meio da queda)
    await esperar(ESPERA_ATE_AO_CALOR_MS);
    const i = soltas.findIndex((s) => s.id === idEscolhido);
    const origem =
      i >= 0
        ? { x: soltas[i].medida.x + soltas[i].medida.largura / 2 + estado[i].dx, y: soltas[i].medida.y + soltas[i].medida.altura / 2 + estado[i].dy }
        : { x: largura / 2, y: altura / 2 };
    vibrarSucesso();
    setCalor(origem);

    // 3. com o ecrã cheio de calor, abre o restaurante e arruma as peças por trás
    await esperar(DURACAO_DO_CALOR_MS + 50);
    aoAcabar();
    await esperar(250);
    ativa = false;
    queda.parar();
    pecas.current.forEach(({ posicao, rotacao }) => {
      posicao.setValue({ x: 0, y: 0 });
      rotacao.setValue(0);
    });
    setCalor(null);
  }, []);

  return { registar, cair, camada: <FlorDeCalor origem={calor} /> };
}

const CirculoAnimado = Animated.createAnimatedComponent(Circle);

// O calor que enche o ecrã: um círculo com as cores da câmara térmica (branco no centro, depois
// amarelo, laranja, vermelho, magenta e roxo na ponta), a crescer a partir do prato escolhido.
function FlorDeCalor({ origem }) {
  const [crescer] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!origem) return;
    crescer.setValue(0);
    Animated.timing(crescer, { toValue: 1, duration: DURACAO_DO_CALOR_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [origem, crescer]);

  if (!origem) return null;
  const { width: largura, height: altura } = Dimensions.get('window');
  const maximo = Math.hypot(Math.max(origem.x, largura - origem.x), Math.max(origem.y, altura - origem.y)) / 0.78;
  const raio = crescer.interpolate({ inputRange: [0, 1], outputRange: [1, maximo] });
  const paragens = [
    [0, 1],
    [0.22, 0.9],
    [0.4, 0.78],
    [0.56, 0.64],
    [0.7, 0.5],
    [0.84, 0.34],
    [0.95, 0.16],
  ];
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <Svg width={largura} height={altura} style={StyleSheet.absoluteFill} accessibilityLabel="A escolher o teu almoço">
        <Defs>
          <RadialGradient id="calor-que-enche" cx="50%" cy="50%" r="50%">
            {paragens.map(([onde, temperatura]) => (
              <Stop key={onde} offset={onde} stopColor={corDoCalor(temperatura)} />
            ))}
            <Stop offset={1} stopColor={corDoCalor(0.16)} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <CirculoAnimado cx={origem.x} cy={origem.y} r={raio} fill="url(#calor-que-enche)" />
      </Svg>
    </Modal>
  );
}
