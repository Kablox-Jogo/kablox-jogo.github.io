/* v1.26 (dono, 09/11): partes que só entram depois que o dono aprovar o desenho.
 * false = desligado no site (o código fica, nada é apagado; o progresso guardado continua).
 * natal (v1.28): evento de Natal (presentes, neve, Noite Feliz) — sem a chave, fica "em breve" mesmo em dezembro.
 * hype (v1.30): falas animadas ("INCRÍVEL!", "INSANO!"…) letra por letra, com som de apresentador e vozes gravadas (se existirem).
 * juice (v1.30): acabamento de animação — peça inclina ao arrastar, botão Jogar com brilho, fim de partida em cascata, efeitos leves mais cedo em celular fraco.
 * febre (v1.30): Modo Febre — combo ×5 no Clássico dá 3 jogadas com pontos em dobro (muda a pontuação: só com aprovação do dono).
 * mascote (v1.30): Kabloquinho, bloquinho original em cima do tabuleiro que reage às jogadas (desenho novo: só com aprovação do dono).
 * Para ver ligado na prévia/testes: ?feat=all (só em localhost) ou trocar aqui para true. */
(function (root) {
  'use strict';
  var F = { helpers: false, legends: false, zenNew: false, ranked: false, gallery: false, styles: false, natal: false, hype: false, juice: false, febre: false, mascote: false };
  try {
    if (/[?&]feat=all\b/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) F = { helpers: true, legends: true, zenNew: true, ranked: true, gallery: true, styles: true, natal: true, hype: true, juice: true, febre: true, mascote: true };
    // v1.27: versão de LABORATÓRIO (prévia só do dono) liga tudo que ainda espera aprovação. O site dos amigos não tem MZ_LAB.
    if (root.MZ_LAB === true) F = { helpers: true, legends: true, zenNew: true, ranked: true, gallery: true, styles: true, natal: true, hype: true, juice: true, febre: true, mascote: true };
  } catch (e) {}
  root.MZFlags = F;
})(this);
