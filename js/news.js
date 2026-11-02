/* "O que há de novo" (v1.23, pedido do dono): depois de uma atualização aparece um aviso pequeno
 * "Versão nova! Ver novidades / Agora não". A lista completa fica sempre em Ajuda → Novidades.
 * Para cada versão nova com mudança visível, acrescente uma entrada NO TOPO (pt e en). */
(function (root) {
  'use strict';
  var LIST = [
    { v: '1.24.0', date: '2026-11-04',
      pt: ['🏆 Temporada 1: recordes começam do zero (o antigo fica como Recorde lendário)', '🪵⚙️🥉🥈🥇💎 Medalhas de recorde: 5 mil, 20 mil, 50 mil, 200 mil, 500 mil e 1 milhão', '✨ Blocos raros: Vidro doce (10 mil), Brasa (25 mil) e Pérola (50 mil)', '🎁 Baú do dia na primeira partida', '🎃 Semana do Terror até domingo 8/11: abóboras, morcegos e um desafio que dá a Abóbora para sempre', 'Escolha o modo (Clássico, Zen, Semana) embaixo do JOGAR; o jogo lembra o último', 'Tabuleiro sempre bem visível em todos os visuais', 'Tela de Modos nova, com recorde e progresso de cada modo', 'Primeira partida mais tranquila, com a meta da primeira medalha', 'Som de encaixar mais firme, combo que sobe de tom e música que muda a cada minuto', 'Arrastar mais preciso: a peça não escorrega na hora de soltar', 'Tela inicial cabe inteira, sem rolar',
        '⭐ Nível do jogador com XP (XP em dobro no fim de semana) e títulos', '🔥 Sequência de dias com escudo semanal e prêmio no 7º dia',
        '🏁 Desafio da Semana: mesmas peças para todos, código de prova e Placar da galera conferido', '1 milhão ficou bem mais difícil: o multiplicador para de disparar no nível 9',
        'Efeitos novos: câmera lenta na jogada épica, fogo no combo ×10, reflexo de vidro, carinhas na Gelatina, Pelúcia, Doce, Bolha e Queijo',
        'Fim de partida e imagem do resultado com medalha e nível'],
      en: ['🏆 Season 1: records start from zero (your old one becomes a Legendary record)', '🪵⚙️🥉🥈🥇💎 Record medals: 5K, 20K, 50K, 200K, 500K and 1M', '✨ Rare blocks: Candy glass (10K), Ember (25K) and Pearl (50K)', '🎁 Daily chest on your first game', '🎃 Spooky Week until Sunday Nov 8: pumpkins, bats and a challenge that gives you the Pumpkin forever', 'Pick the mode (Classic, Zen, Week) below PLAY; the game remembers the last one', 'Board always clearly visible in every look', 'New Modes screen with each mode’s record and progress', 'Calmer first game with a first-medal goal', 'Firmer place sound, combos that rise in pitch and music that changes every minute', 'More precise dragging: pieces no longer slip when you let go', 'Home screen fits without scrolling',
        '⭐ Player level with XP (double XP on weekends) and titles', '🔥 Daily streak with a weekly shield and a day-7 reward',
        '🏁 Weekly Challenge: same pieces for everyone, proof code and a verified crew leaderboard', '1 million is much harder now: the multiplier stops exploding at level 9',
        'New effects: slow motion on epic plays, fire at combo ×10, glass glints, faces on Jelly, Plush, Candy, Bubble and Cheese',
        'Game-over screen and result image with medal and level'] },
    { v: '1.23.0', date: '2026-11-01',
      pt: ['Configurações mais simples, em grupos (Som, Vibração, Visual, Jogo)', 'Uma escolha só para os efeitos: Completos, Leves ou Mínimos',
        'Menos texto em cima do tabuleiro: uma mensagem por vez', 'Topo da partida mais limpo; o recorde acende quando você chega perto',
        'Aviso "Faltam X para o seu recorde!"', 'Sons mais limpos e música um pouco mais baixa', 'Celular travando? O jogo deixa os efeitos mais leves sozinho'],
      en: ['Simpler settings, in groups (Sound, Vibration, Visuals, Game)', 'One choice for effects: Full, Light or Minimal',
        'Less text over the board: one message at a time', 'Cleaner top bar; your record lights up when you get close',
        '"X points to your record!" alert', 'Cleaner sounds and slightly quieter music', 'Phone lagging? The game lightens effects by itself'] },
    { v: '1.22.0', date: '2026-11-01',
      pt: ['Vibração diferente para cada momento, com força Leve, Normal ou Forte', 'Botão "Testar vibração"', 'Jogo mais desafiador',
        'Copiar e restaurar o progresso por código (para trocar de celular)', 'Imagem do resultado para postar no story', 'Casas do tabuleiro com contorno mais visível'],
      en: ['A different vibration for each moment, with Light, Normal or Strong', '"Test vibration" button', 'More challenging game',
        'Copy and restore your progress with a code (to change phones)', 'Result image to post on your story', 'Board cells with clearer outlines'] },
    { v: '1.21.0', date: '2026-11-01',
      pt: ['Blocos especiais: ⭐ Estrela (pontos extras) e 💣 Bomba (explode os vizinhos)', 'Peças na diagonal', 'Sons novos de pegar, encaixar e limpar',
        'Feixe de luz nas linhas limpas', 'Subir de nível troca o visual inteiro'],
      en: ['Special blocks: ⭐ Star (bonus points) and 💣 Bomb (blasts its neighbours)', 'Diagonal pieces', 'New pick, place and clear sounds',
        'Light beam on cleared lines', 'Levelling up changes the whole look'] }
  ];
  function cmp(a, b) { // compara versões "1.22.0"
    var x = String(a).split('.'), y = String(b).split('.');
    for (var i = 0; i < 3; i++) { var d = (+x[i] || 0) - (+y[i] || 0); if (d) return d; }
    return 0;
  }
  /** Entradas mais novas que `seen` (até `current`). Sem `seen` (primeira vez) → nada. */
  function since(seen, current) {
    if (!seen) return [];
    return LIST.filter(function (e) { return cmp(e.v, seen) > 0 && cmp(e.v, current) <= 0; });
  }
  function lines(e, lang) { return lang === 'pt' ? e.pt : e.en; }
  var api = { LIST: LIST, since: since, lines: lines, cmp: cmp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZNews = api;
})(this);
