/* "O que há de novo" (v1.23, pedido do dono): depois de uma atualização aparece um aviso pequeno
 * "Versão nova! Ver novidades / Agora não". A lista completa fica sempre em Ajuda → Novidades.
 * Para cada versão nova com mudança visível, acrescente uma entrada NO TOPO (pt e en). */
(function (root) {
  'use strict';
  var LIST = [
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
