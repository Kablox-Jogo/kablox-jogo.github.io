/* Kablox — progresso local: estatísticas, conquistas, missões diárias, desafios e desbloqueios.
 * Sem DOM e sem rede: tudo fica no aparelho. Testável em Node (tests/progress.test.js).
 */
(function (root) {
  'use strict';
  // textos: chaves em português, traduzidas por js/i18n.js na hora de mostrar
  var I18n = root.MZI18n || (typeof require === 'function' ? require('./i18n.js') : null);
  function T(k, v) { return I18n ? I18n.t(k, v) : k.replace(/\{(\w+)\}/g, function (m, x) { return v && v[x] != null ? v[x] : m; }); }

  /* ---------------- modos ---------------- */
  var MODES = {
    classic: {
      id: 'classic', name: 'Clássico', icon: 'grid',
      desc: 'Partida livre. Faça o máximo de pontos.',
      rules: ['Encaixe as peças e limpe linhas e colunas.', 'A partida acaba quando nenhuma peça cabe.', 'Você pode desfazer 1 jogada por partida.']
    },
    zen: {
      id: 'zen', name: 'Zen', icon: 'leaf',
      desc: 'Sem fim de partida. Jogue no seu ritmo.',
      rules: ['Quando nada couber, você escolhe: limpar as 3 linhas mais cheias e seguir, ou recomeçar.', '1 desfazer por partida.', 'Recorde Zen separado do Clássico.']
    },
    challenge: {
      id: 'challenge', name: 'Desafio', icon: 'flag',
      desc: 'Um objetivo por vez, com regras mostradas antes de começar.',
      rules: ['Cumpra o objetivo antes de acabarem as peças ou as jogadas.', 'Ganhe até 3 estrelas usando menos peças.', 'Desafio do dia: mesmas peças para todo mundo.']
    }
  };

  /* ---------------- desafios ----------------
   * goal: lines (linhas no total) | score | combo (combo máximo) | multi2 (jogadas com 2+ linhas) |
   *       multi3 (jogadas com 3+ linhas) | clears (tabuleiros limpos)
   * pieces: limite de peças (0 = sem limite); par: peças para 3 estrelas
   * board: tabuleiro inicial (8 linhas; '.' vazio, 0-6 cor)
   */
  var CHALLENGES = [
    { id: 'c1', name: 'Primeiros passos', goal: 'lines', target: 3, pieces: 20, par: 15, seed: 3587128388 },
    { id: 'c2', name: 'Dois de uma vez', goal: 'multi2', target: 1, pieces: 24, par: 16, seed: 61390130 },
    { id: 'c3', name: 'Em sequência', goal: 'combo', target: 3, pieces: 30, par: 22, seed: 4153048382 },
    { id: 'c4', name: 'Arranque', goal: 'score', target: 4000, pieces: 25, par: 19, seed: 4054788807 },
    { id: 'c5', name: 'Faxina', goal: 'clears', target: 1, pieces: 15, par: 2, seed: 2262780906,
      board: ['........', '........', '........', '........', '........', '........', '11111...', '11111...'] },
    { id: 'c6', name: 'Corredor', goal: 'lines', target: 6, pieces: 30, par: 14, seed: 2953344729,
      board: ['........', '........', '........', '22222.22', '33.33333', '........', '........', '........'] },
    { id: 'c7', name: 'Maratona', goal: 'lines', target: 15, pieces: 45, par: 38, seed: 1194103671 },
    { id: 'c8', name: 'Trinca', goal: 'multi3', target: 1, pieces: 45, par: 31, seed: 2422198483 },
    { id: 'c9', name: 'Combo ×5', goal: 'combo', target: 5, pieces: 50, par: 30, seed: 2894979820 },
    { id: 'c10', name: 'Grande final', goal: 'score', target: 8500, pieces: 60, par: 45, seed: 3849445969 },
    // v1.17 — Capítulo 2 "Mina de gemas": letras a–g no tabuleiro = bloco com gema (cor 0–6). Gema é coletada quando
    // a linha ou coluna do bloco é limpa. Sementes conferidas pelo robô (tools/challenge_check.js).
    { id: 'c11', name: 'Primeira gema', goal: 'gems', target: 1, pieces: 12, par: 4, seed: 2095928616,
      board: ['........', '........', '........', '........', '........', '........', '........', '111a111.'] },
    { id: 'c12', name: 'Par de gemas', goal: 'gems', target: 2, pieces: 16, par: 7, seed: 902036223,
      board: ['........', '........', '........', '........', '........', '........', '2b222.22', '333.3c33'] },
    { id: 'c13', name: 'Coluna brilhante', goal: 'gems', target: 2, pieces: 18, par: 7, seed: 4201114630,
      board: ['.......4', '.......d', '.......4', '.......4', '.......4', '........', '.......4', '.......d'] },
    { id: 'c14', name: 'Encruzilhada', goal: 'gems', target: 3, pieces: 16, par: 8, seed: 605838061,
      board: ['...5....', '...5....', '...e....', '5e5.555e', '...5....', '...5....', '...5....', '...5....'] },
    { id: 'c15', name: 'Veios', goal: 'gems', target: 4, pieces: 30, par: 19, seed: 792369486,
      board: ['f6666...', '........', '..6f66..', '........', '........', '66666f..', '........', '....66f6'] },
    { id: 'c16', name: 'Desabamento', goal: 'gems', target: 3, pieces: 16, par: 5, seed: 1629677971,
      board: ['........', '........', '........', '........', '........', '1a11.111', '2222.2b2', '33c3.333'] },
    { id: 'c17', name: 'Muralha', goal: 'gems', target: 4, pieces: 32, par: 8, seed: 4233466460,
      board: ['77.7777g', '........', 'g7777.77', '........', '.7g77777', '........', '777.7g77', '........'] },
    { id: 'c18', name: 'Chefe: o Cofre', goal: 'gems', target: 6, pieces: 45, par: 22, seed: 2210437642, boss: true,
      board: ['a3333.3b', '3......3', '3......3', 'c......d', '........', '3......3', '3......3', 'e3.3333f'] },
    // v1.17 — Capítulo 3 "Fenda": objetivos misturados com tabuleiros cheios
    { id: 'c19', name: 'Fenda', goal: 'gems', target: 3, pieces: 20, par: 16, seed: 2279525734,
      board: ['........', '....4...', '....4...', '4d44.444', '....4...', '....d...', '....4...', '44d4.444'] },
    { id: 'c20', name: 'Entulho', goal: 'lines', target: 8, pieces: 30, par: 25, seed: 295708777,
      board: ['........', '........', '5.5.5.5.', '.5.5.5.5', '........', '........', '55..55..', '..55..55'] },
    { id: 'c21', name: 'Garimpo', goal: 'gems', target: 5, pieces: 34, par: 19, seed: 2300610414,
      board: ['g......g', '........', '..2222..', '..2bb2..', '..2..2..', '........', '........', 'g......g'] },
    { id: 'c22', name: 'Reação em cadeia', goal: 'combo', target: 4, pieces: 34, par: 10, seed: 3858259817,
      board: ['........', '........', '........', '........', '666.6666', '6666.666', '66666.66', '666666.6'] },
    { id: 'c23', name: 'Pressão', goal: 'score', target: 3500, pieces: 34, par: 28, seed: 3353791562,
      board: ['7.7.7.7.', '........', '.7.7.7.7', '........', '7.7.7.7.', '........', '.7.7.7.7', '........'] },
    { id: 'c24', name: 'Chefe: Núcleo', goal: 'gems', target: 6, pieces: 50, par: 40, seed: 1205030145, boss: true,
      board: ['1.2.3.4.', '.a.....b', '5.6.7.1.', '........', '.2.3.4.5', 'c......d', '.6.7.1.2', 'e.....f.'] }
  ];
  /** v1.17 — Aventura: os desafios agrupados em capítulos. O Capítulo 1 são os 10 desafios originais (livres, como antes).
   *  Capítulos novos: fases em sequência; o capítulo abre quando a fase-chefe (última) do anterior é vencida.
   *  Recompensa: concluir todas as fases do capítulo libera um estilo raro na Coleção. */
  var CHAPTERS = [
    { id: 'ch1', name: 'Fundamentos', levels: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'], free: true },
    { id: 'ch2', name: 'Mina de gemas', levels: ['c11', 'c12', 'c13', 'c14', 'c15', 'c16', 'c17', 'c18'], reward: 'gold' },
    { id: 'ch3', name: 'Fenda', levels: ['c19', 'c20', 'c21', 'c22', 'c23', 'c24'], reward: 'holo' }
  ];
  function chapterOf(id) { return CHAPTERS.filter(function (ch) { return ch.levels.indexOf(id) !== -1; })[0] || CHAPTERS[0]; }
  function levelDone(s, id) { var r = s.challenges && s.challenges[id]; return !!(r && r.stars); }
  function chapterOpen(s, ch) {
    var i = CHAPTERS.indexOf(ch);
    if (i <= 0) return true;
    var prev = CHAPTERS[i - 1];
    return levelDone(s, prev.levels[prev.levels.length - 1]);
  }
  /** Fase liberada? Capítulo aberto e (capítulo livre ou fase anterior vencida). */
  function levelOpen(s, id) {
    var ch = chapterOf(id), k = ch.levels.indexOf(id);
    return chapterOpen(s, ch) && (ch.free || k === 0 || levelDone(s, ch.levels[k - 1]));
  }
  function chapterProgress(s, ch) {
    var stars = 0, done = 0;
    ch.levels.forEach(function (id) { var r = s.challenges && s.challenges[id]; if (r && r.stars) { done++; stars += r.stars; } });
    return { done: done, total: ch.levels.length, stars: stars, maxStars: ch.levels.length * 3, complete: done === ch.levels.length };
  }
  /** Concede recompensas de capítulo ainda não dadas. Devolve [{ chapter, skin }] (cada uma só uma vez). */
  function grantChapterRewards(s) {
    var out = [];
    s.chapterRewards = s.chapterRewards && typeof s.chapterRewards === 'object' ? s.chapterRewards : {};
    s.surpriseSeen = s.surpriseSeen || {};
    CHAPTERS.forEach(function (ch) {
      if (!ch.reward || s.chapterRewards[ch.id] || !chapterProgress(s, ch).complete) return;
      s.chapterRewards[ch.id] = 1; s.surpriseSeen[ch.reward] = 1; out.push({ chapter: ch, skin: ch.reward });
    });
    return out;
  }
  /** Casas com gema (letras a–g) de um tabuleiro inicial. */
  function gemsFromRows(rows, size) {
    var g = [];
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) { var ch = rows && rows[r] ? rows[r][c] : '.'; if (ch >= 'a' && ch <= 'g') g.push(r * size + c); }
    return g;
  }
  var GOAL_TEXT = {
    lines: function (n) { return T(n > 1 ? 'Limpe {n} linhas ou colunas' : 'Limpe {n} linha ou coluna', { n: n }); },
    score: function (n) { return T('Faça {n} pontos', { n: fmt(n) }); },
    combo: function (n) { return T('Chegue a um combo ×{n}', { n: n }); },
    multi2: function (n) { return n > 1 ? T('Limpe 2 linhas de uma vez, {n} vezes', { n: n }) : T('Limpe 2 linhas de uma só vez'); },
    multi3: function () { return T('Limpe 3 linhas de uma só vez'); },
    clears: function () { return T('Deixe o tabuleiro vazio'); },
    gems: function (n) { return T(n > 1 ? 'Colete {n} gemas' : 'Colete {n} gema', { n: n }); }
  };
  var GOAL_UNIT = { lines: 'linhas', score: 'pontos', combo: 'combo', multi2: 'duplas', multi3: 'triplas', clears: 'vazio', gems: 'gemas' };

  function fmt(n) { return I18n ? I18n.fmt(n) : String(Math.round(n)); }

  function goalValue(goal, st) {
    switch (goal) {
      case 'lines': return st.lines || 0;
      case 'score': return st.score || 0;
      case 'combo': return st.maxCombo || 0;
      case 'multi2': return st.multi2 || 0;
      case 'multi3': return st.multi3 || 0;
      case 'clears': return st.clears || 0;
      case 'gems': return st.gemsGot || 0;
    }
    return 0;
  }

  function describeChallenge(def) {
    var lines = [GOAL_TEXT[def.goal](def.target) + '.'];
    lines.push(T('Você tem {n} peças, sempre as mesmas neste desafio.', { n: def.pieces }));
    if (def.board) lines.push(def.goal === 'gems' || gemsFromRows(def.board, 8).length ? T('Gemas saem quando a linha ou a coluna do bloco é limpa.') : T('O tabuleiro começa com alguns blocos.'));
    if (def.boss) lines.push(T('Fase-chefe: tabuleiro especial e mais difícil.'));
    lines.push(T('3 estrelas: até {n} peças.', { n: def.par }));
    return lines;
  }

  /** Situação do desafio para o estado atual da partida. */
  function challengeStatus(def, st) {
    var cur = goalValue(def.goal, st), done = cur >= def.target;
    var outOfPieces = def.pieces > 0 && (st.placed || 0) >= def.pieces;
    return { cur: Math.min(cur, def.target), target: def.target, done: done, failed: !done && (outOfPieces || !!st.over),
      piecesLeft: def.pieces ? Math.max(0, def.pieces - (st.placed || 0)) : null, unit: GOAL_UNIT[def.goal] };
  }

  /** 3★ até o par; 2★ até a metade do caminho entre o par e o limite; 1★ depois. */
  function starsFor(def, placed) {
    if (placed <= def.par) return 3;
    if (placed <= def.par + Math.ceil((def.pieces - def.par) / 2)) return 2;
    return 1;
  }

  function boardFromRows(rows, size) {
    var b = [];
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
      var ch = rows && rows[r] ? rows[r][c] : '.';
      b.push(ch >= 'a' && ch <= 'g' ? ch.charCodeAt(0) - 97 : ch && ch !== '.' ? +ch : -1); // letra = bloco com gema
    }
    return b;
  }

  /* ---------------- desafio do dia ---------------- */
  var DAILY_PIECES = 30;
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function daily(day) {
    return { id: 'daily', day: day, seed: hash('gridbloom-' + day), pieces: DAILY_PIECES, goal: 'score',
      name: T('Desafio do dia'), text: T('Faça o máximo de pontos com {n} peças.', { n: DAILY_PIECES }) };
  }

  /* ---------------- missões diárias (opcionais, sem punição) ---------------- */
  var MISSION_POOL = [
    { id: 'lines15', stat: 'lines', target: 15, text: 'Limpe 15 linhas' },
    { id: 'lines30', stat: 'lines', target: 30, text: 'Limpe 30 linhas' },
    { id: 'placed50', stat: 'placed', target: 50, text: 'Coloque 50 peças' },
    { id: 'games2', stat: 'games', target: 2, text: 'Jogue 2 partidas' },
    { id: 'combo3', stat: 'combo', target: 3, text: 'Faça um combo ×3' },
    { id: 'multi2', stat: 'multi2', target: 2, text: 'Limpe 2 linhas de uma vez, 2 vezes' },
    { id: 'score800', stat: 'gameScore', target: 5000, text: 'Faça 5.000 pontos numa partida' },
    { id: 'challenge1', stat: 'challenges', target: 1, text: 'Complete 1 desafio' }
  ];
  function missionsFor(day) {
    var rng = seeded(hash('missoes-' + day)), pool = MISSION_POOL.slice(), out = [];
    while (out.length < 3) {
      var m = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      if (out.some(function (o) { return o.stat === m.stat; })) continue;
      out.push(m);
    }
    return out;
  }
  function seeded(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------------- conquistas ---------------- */
  var ACHIEVEMENTS = [
    { id: 'first_line', name: 'Primeira linha', desc: 'Limpe sua primeira linha', of: function (s) { return [s.lines, 1]; } },
    { id: 'lines_100', name: 'Construtor', desc: 'Limpe 100 linhas no total', of: function (s) { return [s.lines, 100]; } },
    { id: 'lines_500', name: 'Arquiteto', desc: 'Limpe 500 linhas no total', of: function (s) { return [s.lines, 500]; } },
    { id: 'combo_5', name: 'Embalado', desc: 'Faça um combo ×5', of: function (s) { return [s.bestCombo, 5]; } },
    { id: 'multi_3', name: 'Trinca', desc: 'Limpe 3 linhas de uma vez', of: function (s) { return [s.bestMulti, 3]; } },
    { id: 'clear_1', name: 'Tábula rasa', desc: 'Deixe o tabuleiro vazio', of: function (s) { return [s.clears, 1]; } },
    { id: 'score_1000', name: 'Dez mil', desc: 'Faça 10.000 pontos numa partida', of: function (s) { return [s.bestGame, 10000]; } },
    { id: 'score_3000', name: 'Cristalino', desc: 'Faça 30.000 pontos numa partida', of: function (s) { return [s.bestGame, 30000]; } },
    { id: 'score_5000', name: 'Aurora', desc: 'Faça 75.000 pontos numa partida', of: function (s) { return [s.bestGame, 75000]; } },
    { id: 'score_100k', name: 'Cem mil', desc: 'Faça 100.000 pontos numa partida', of: function (s) { return [s.bestGame, 100000]; } },
    { id: 'score_250k', name: 'Supernova', desc: 'Faça 250.000 pontos numa partida', of: function (s) { return [s.bestGame, 250000]; } },
    { id: 'score_1m', name: 'Lenda', desc: 'Faça 1.000.000 de pontos numa partida', of: function (s) { return [s.bestGame, 1000000]; } },
    { id: 'themes_all', name: 'Colecionador de visuais', desc: 'Veja 5 visuais', of: function (s) { return [Object.keys(s.themesSeen).length, 5]; } },
    { id: 'games_10', name: 'Hábito bom', desc: 'Jogue 10 partidas', of: function (s) { return [s.games, 10]; } },
    { id: 'challenges_5', name: 'Desafiante', desc: 'Complete 5 desafios', of: function (s) { return [doneChallenges(s), 5]; } },
    { id: 'challenges_all', name: 'Mestre dos desafios', desc: 'Complete todos os desafios', of: function (s) { return [doneChallenges(s), CHALLENGES.length]; } },
    { id: 'missions_10', name: 'Constante', desc: 'Complete 10 missões diárias', of: function (s) { return [s.missionsDone, 10]; } }
  ];

  /* ---------------- desbloqueios (só cosméticos, obtidos jogando) ---------------- */
  var UNLOCKS = [
    { id: 'candy', kind: 'skin', name: 'Doce', need: 'Ganhe 6 estrelas', of: function (s) { return [stars(s), 6]; } },
    { id: 'pixel', kind: 'skin', name: 'Pixel', need: 'Complete 3 desafios', of: function (s) { return [doneChallenges(s), 3]; } },
    { id: 'galaxy', kind: 'skin', name: 'Galáxia', need: 'Faça 30.000 pontos numa partida', of: function (s) { return [s.bestGame, 30000]; } },
    // estilos raros: liberados ao aparecerem pela primeira vez numa transformação surpresa
    { id: 'energy', kind: 'skin', name: 'Energia', need: 'Descubra numa transformação surpresa', of: function (s) { return [s.surpriseSeen.energy ? 1 : 0, 1]; } },
    { id: 'rainbow', kind: 'skin', name: 'Arco-íris', need: 'Descubra numa transformação surpresa', of: function (s) { return [s.surpriseSeen.rainbow ? 1 : 0, 1]; } },
    { id: 'holo', kind: 'skin', name: 'Holográfico', need: 'Descubra numa transformação surpresa', of: function (s) { return [s.surpriseSeen.holo ? 1 : 0, 1]; } },
    { id: 'lava', kind: 'skin', name: 'Lava', need: 'Descubra numa transformação surpresa', of: function (s) { return [s.surpriseSeen.lava ? 1 : 0, 1]; } },
    { id: 'gold', kind: 'skin', name: 'Ouro', need: 'Descubra numa transformação surpresa', of: function (s) { return [s.surpriseSeen.gold ? 1 : 0, 1]; } },
    { id: 'marble', kind: 'skin', name: 'Mármore', need: 'Descubra numa transformação surpresa', of: function (s) { return [s.surpriseSeen.marble ? 1 : 0, 1]; } },
    { id: 'circuit', kind: 'skin', name: 'Circuito', need: 'Descubra numa transformação surpresa', of: function (s) { return [s.surpriseSeen.circuit ? 1 : 0, 1]; } },
    { id: 'bubble', kind: 'skin', name: 'Bolha', need: 'Descubra numa transformação surpresa', of: function (s) { return [s.surpriseSeen.bubble ? 1 : 0, 1]; } },
    { id: 'stained', kind: 'skin', name: 'Vitral', need: 'Descubra numa transformação surpresa', of: function (s) { return [s.surpriseSeen.stained ? 1 : 0, 1]; } }
  ];

  /* ---------------- estatísticas ---------------- */
  function newStats() {
    return { v: 1, games: 0, placed: 0, lines: 0, clears: 0, bestCombo: 0, bestMulti: 0, bestGame: 0, timeMs: 0,
      best: { classic: 0, zen: 0 }, gamesByMode: { classic: 0, zen: 0, challenge: 0, daily: 0 },
      themesSeen: { jardim: 1 }, challenges: {}, daily: { day: '', best: 0, played: 0 },
      missionsDay: '', missions: [], missionsDone: 0, missionStars: 0, achievements: {}, surpriseSeen: {}, chapterRewards: {}, surprises: 0, scale: 2 }; // scale 2 = pontuação com níveis (v1.11+)
  }

  /** Aceita só valores com o mesmo tipo do modelo (dados corrompidos voltam ao padrão). */
  function normalize(raw) {
    var s = newStats();
    if (!raw || typeof raw !== 'object') return s;
    function fix(model, val) {
      if (Array.isArray(model)) return Array.isArray(val) ? val : model;
      if (model && typeof model === 'object') {
        if (!val || typeof val !== 'object' || Array.isArray(val)) return model;
        var out = Object.assign({}, model);
        Object.keys(val).forEach(function (k) {
          out[k] = k in model ? fix(model[k], val[k]) : val[k];
        });
        return out;
      }
      if (typeof model === 'number') return typeof val === 'number' && isFinite(val) ? val : model;
      if (typeof model === 'string') return typeof val === 'string' ? val : model;
      return val;
    }
    Object.keys(s).forEach(function (k) { if (raw[k] !== undefined) s[k] = fix(s[k], raw[k]); });
    s.missions = s.missions.filter(function (m) { return m && typeof m === 'object' && missionDef(m.id) && isFinite(m.cur); });
    ['challenges', 'achievements', 'themesSeen', 'surpriseSeen', 'chapterRewards'].forEach(function (k) {
      Object.keys(s[k]).forEach(function (id) { if (s[k][id] == null) delete s[k][id]; });
    });
    Object.keys(s.challenges).forEach(function (id) {
      var c = s.challenges[id];
      if (typeof c !== 'object' || !isFinite(c.stars)) delete s.challenges[id];
    });
    return s;
  }

  function doneChallenges(s) { return Object.keys(s.challenges).filter(function (k) { return s.challenges[k] && s.challenges[k].stars > 0; }).length; }
  function stars(s) {
    var n = s.missionStars || 0;
    Object.keys(s.challenges).forEach(function (k) { n += (s.challenges[k] && s.challenges[k].stars) || 0; });
    return n;
  }

  function ensureMissions(s, day) {
    if (s.missionsDay === day && s.missions.length === 3) return false;
    s.missionsDay = day;
    s.missions = missionsFor(day).map(function (m) { return { id: m.id, cur: 0, done: false }; });
    return true;
  }
  function missionDef(id) { for (var i = 0; i < MISSION_POOL.length; i++) if (MISSION_POOL[i].id === id) return MISSION_POOL[i]; return null; }

  /** Avança missões; retorna as que acabaram de ser concluídas. */
  function bumpMissions(s, stat, value, mode) {
    var done = [];
    s.missions.forEach(function (m) {
      var d = missionDef(m.id);
      if (!d || m.done || d.stat !== stat) return;
      m.cur = mode === 'max' ? Math.max(m.cur, value) : m.cur + value;
      if (m.cur >= d.target) { m.cur = d.target; m.done = true; s.missionsDone++; s.missionStars++; done.push(d); }
    });
    return done;
  }

  /** Registra uma jogada (resultado de MZLogic.place). Retorna missões concluídas agora. */
  function onMove(s, res, st) {
    var done = [];
    s.placed++;
    done = done.concat(bumpMissions(s, 'placed', 1));
    if (res.lineCount > 0) {
      s.lines += res.lineCount;
      s.bestCombo = Math.max(s.bestCombo, res.combo);
      s.bestMulti = Math.max(s.bestMulti, res.lineCount);
      done = done.concat(bumpMissions(s, 'lines', res.lineCount));
      done = done.concat(bumpMissions(s, 'combo', res.combo, 'max'));
      if (res.lineCount >= 2) done = done.concat(bumpMissions(s, 'multi2', 1));
      if (res.boardClear) s.clears++;
    }
    if (st) {
      s.bestGame = Math.max(s.bestGame, st.score);
      done = done.concat(bumpMissions(s, 'gameScore', st.score, 'max'));
    }
    return done;
  }

  function onGameStart(s, mode) {
    s.games++;
    s.gamesByMode[mode] = (s.gamesByMode[mode] || 0) + 1;
    return bumpMissions(s, 'games', 1);
  }

  function onChallengeDone(s, id, placed, def) {
    var prev = s.challenges[id] || { stars: 0, bestPieces: 0 };
    var st = starsFor(def, placed), first = !prev.stars;
    s.challenges[id] = { stars: Math.max(prev.stars, st), bestPieces: prev.bestPieces ? Math.min(prev.bestPieces, placed) : placed };
    return { stars: st, first: first, missions: bumpMissions(s, 'challenges', 1) };
  }

  function achievements(s) {
    return ACHIEVEMENTS.map(function (a) {
      var v = a.of(s), cur = Math.min(v[0] || 0, v[1]);
      return { id: a.id, name: T(a.name), desc: T(a.desc), cur: cur, target: v[1], done: cur >= v[1] };
    });
  }
  /** Marca conquistas novas; retorna as recém-conquistadas. */
  function checkAchievements(s, now) {
    var fresh = [];
    achievements(s).forEach(function (a) {
      if (a.done && !s.achievements[a.id]) { s.achievements[a.id] = now || dateKey(); fresh.push(a); }
    });
    return fresh;
  }

  function unlocks(s) {
    return UNLOCKS.map(function (u) { var v = u.of(s); return { id: u.id, kind: u.kind, name: T(u.name), need: T(u.need), cur: Math.min(v[0], v[1]), target: v[1], done: v[0] >= v[1] }; });
  }
  function isUnlocked(s, skinId) {
    var u = unlocks(s).filter(function (x) { return x.id === skinId; })[0];
    return !u || u.done;
  }
  /** Próximo cosmético ou conquista para mostrar na tela inicial. */
  function nextGoal(s) {
    var u = unlocks(s).filter(function (x) { return !x.done; })[0];
    if (u) return { kind: 'unlock', text: T('Estilo {name}: {need}', { name: u.name, need: u.need.toLowerCase() }), cur: u.cur, target: u.target };
    var a = achievements(s).filter(function (x) { return !x.done; }).sort(function (x, y) { return y.cur / y.target - x.cur / x.target; })[0];
    if (a) return { kind: 'achievement', text: T('{name}: {desc}', { name: a.name, desc: a.desc.toLowerCase() }), cur: a.cur, target: a.target };
    return null;
  }

  var api = {
    MODES: MODES, CHALLENGES: CHALLENGES, CHAPTERS: CHAPTERS, chapterOf: chapterOf, levelOpen: levelOpen, chapterOpen: chapterOpen,
    chapterProgress: chapterProgress, grantChapterRewards: grantChapterRewards, gemsFromRows: gemsFromRows, ACHIEVEMENTS: ACHIEVEMENTS, MISSION_POOL: MISSION_POOL, UNLOCKS: UNLOCKS,
    DAILY_PIECES: DAILY_PIECES,
    newStats: newStats, normalize: normalize, dateKey: dateKey, daily: daily, hash: hash,
    describeChallenge: describeChallenge, challengeStatus: challengeStatus, starsFor: starsFor, boardFromRows: boardFromRows,
    goalText: function (def) { return GOAL_TEXT[def.goal](def.target); },
    missionsFor: missionsFor, missionDef: missionDef, ensureMissions: ensureMissions,
    onMove: onMove, onGameStart: onGameStart, onChallengeDone: onChallengeDone,
    achievements: achievements, checkAchievements: checkAchievements,
    unlocks: unlocks, isUnlocked: isUnlocked, nextGoal: nextGoal, stars: stars, doneChallenges: doneChallenges
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZProgress = api;
})(this);
