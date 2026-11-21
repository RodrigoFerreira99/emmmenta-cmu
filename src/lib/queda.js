import Matter from 'matter-js';

// Física do "abanar" no Início (design térmico): ao abanar o telemóvel, as peças do ecrã (o título,
// o mapa, os cartões dos pratos…) soltam-se e caem com a gravidade, chocam umas com as outras, rodam
// e amontoam-se no fundo do ecrã. Usa o Matter.js, um motor de física em JavaScript (sem código
// nativo, por isso funciona no Expo Go).
//
// Cada peça é { x, y, largura, altura } (a posição no ecrã, em pontos). A função devolve um objeto com:
//   avancar(ms) → avança a simulação e devolve, para cada peça, { dx, dy, angulo } (quanto se mexeu e rodou)
//   parar()     → liberta o motor de física
// "aleatorio" é Math.random por omissão; nos testes passa-se uma função fixa para dar sempre o mesmo.

const PASSO_MS = 1000 / 60;

export function criarQueda({ pecas, largura, chao, aleatorio = Math.random }) {
  const motor = Matter.Engine.create();
  motor.gravity.y = 1.5; // um pouco mais forte do que o normal: a queda é rápida e dá mais vontade de ver

  const fixo = { isStatic: true, friction: 0.8 };
  const paredes = [
    Matter.Bodies.rectangle(largura / 2, chao + 50, largura * 3, 100, fixo), // o chão (por cima da barra dos separadores)
    Matter.Bodies.rectangle(-50, chao / 2, 100, chao * 4, fixo), // parede da esquerda
    Matter.Bodies.rectangle(largura + 50, chao / 2, 100, chao * 4, fixo), // parede da direita
  ];

  const corpos = pecas.map((peca) => {
    const cantos = Math.max(0, Math.min(18, peca.altura / 2 - 1, peca.largura / 2 - 1));
    const corpo = Matter.Bodies.rectangle(peca.x + peca.largura / 2, peca.y + peca.altura / 2, peca.largura, peca.altura, {
      chamfer: { radius: cantos },
      restitution: 0.32, // saltam um bocadinho
      friction: 0.5,
      frictionAir: 0.008,
    });
    // um empurrão inicial ao acaso, como se o abanão as tivesse soltado
    Matter.Body.setVelocity(corpo, { x: (aleatorio() - 0.5) * 5, y: -1.5 - aleatorio() * 3.5 });
    Matter.Body.setAngularVelocity(corpo, (aleatorio() - 0.5) * 0.14);
    return corpo;
  });
  Matter.Composite.add(motor.world, [...paredes, ...corpos]);

  let sobra = 0;
  return {
    avancar(ms) {
      sobra += Math.min(ms, 100);
      while (sobra >= PASSO_MS) {
        Matter.Engine.update(motor, PASSO_MS);
        sobra -= PASSO_MS;
      }
      return corpos.map((corpo, i) => ({
        dx: corpo.position.x - (pecas[i].x + pecas[i].largura / 2),
        dy: corpo.position.y - (pecas[i].y + pecas[i].altura / 2),
        angulo: corpo.angle,
      }));
    },
    parar() {
      Matter.Composite.clear(motor.world, false);
      Matter.Engine.clear(motor);
    },
  };
}
