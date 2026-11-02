/* Kablox — regras do jogo (sem dependência de DOM; testável em Node) */
(function (root) {
  'use strict';

  var SIZE = 8;
  var COLORS = 7;

  /*
   * Valores de ajuste (tuning knobs). Toda regra numérica do jogo vem daqui.
   * Para equilibrar, rode: node tools/balance_sim.js
   */
  var CONFIG = {
    // Pontos (v1.11): tudo vezes o multiplicador do NÍVEL. Nível = 1 + linhas limpas ÷ levelEvery;
    // multiplicador = levelMult^(nível − 1) → Nv 2 ×1,45 · Nv 5 ×4,4 · Nv 10 ×28 · Nv 15 ×182 · Nv 20 ×1.169.
    // Partidas longas e bem jogadas crescem muito (simulação: 100 mil em ~13% das partidas do robô bom, 0% do casual;
    // 1 milhão em ~1 de cada 300 partidas do robô bom — lendário).
    score: {
      perBlock: 10,         // pontos por bloco colocado
      perLineSquared: 100,  // linhas: 100 × L²  (1 = 100, 2 = 400, 3 = 900...)
      comboBonus: 0.25,     // combo: +25% nas linhas por nível de combo acima de 1
      boardClear: 3000,     // bônus por deixar o tabuleiro vazio (≈ 30 linhas simples, como na escala antiga)
      levelEvery: 10,       // linhas para subir de nível
      levelMult: 1.45,      // quanto o multiplicador cresce a cada nível
      // v1.24 (amigos do dono chegavam a 1 milhão "em bordoada"): o multiplicador cresce rápido só até o nível
      // `capLevel` (×19,6); depois sobe devagar, +`afterCap` por nível (Nv 10 ×21,6 · Nv 15 ×31,6 · Nv 20 ×41,6).
      capLevel: 9, afterCap: 2,
      // escala antiga (interna): usada só para medir o progresso no equilíbrio (dificuldade, peças novas)
      legacy: { perBlock: 1, perLineSquared: 8, comboPerLevel: 16, boardClear: 300 }
    },
    combo: { window: 3 },   // o combo continua se você limpar ao menos 1 vez a cada N peças
    generator: {
      attempts: 30,               // conjuntos sorteados antes de desistir
      requireWholeSet: true,      // exige que as 3 peças caibam em alguma ordem
      searchBudget: 4000,         // limite de posições testadas por conjunto
      smallBoostFill: 0.3, smallBoost: 2.5,  // (usado só nas filas fixas dos desafios — não mexer)
      bigCutFill: 0.35, bigCut: 0.25,
      progress: { perPoints: 1500, step: 0.2, max: 0.8 },
      // DIFICULDADE (0 a 1): sobe suave com os pontos (metade em `halfAt`) e um pouco com o desempenho
      // recente (linhas por jogada nas últimas `recent` jogadas). Nunca muda de repente.
      // v1.22 (dono achou fácil demais): sobe mais rápido (halfAt 2500→1200), peças grandes mais cedo (bigBoost 2,4→3,4)
      // e pesa mais o desempenho (skillWeight 0,3→0,45). Simulação 200 partidas: robô bom mediana 5,7→4,2 min; casual 2,8→2,5 min.
      difficulty: { halfAt: 1200, curve: 2, skillWeight: 0.45, recent: 12, bigBoost: 3.4, awkwardBoost: 1.0, smallCut: 0.6 },
      // AJUDA (0 a 1): cresce quando o tabuleiro aperta (cheio, pouco espaço útil, muitas jogadas sem limpar):
      // mais peças pequenas, menos peças enormes e, às vezes, um conjunto que permita limpar uma linha.
      // Muda só as chances do sorteio; some sozinha quando o jogador recupera espaço; diminui para quem já
      // tem muitos pontos. Nunca remove blocos, nunca mexe em pontos, nunca garante nada.
      // Valores calibrados com tools/balance_sim.js (2 robôs × 200 partidas × 2 sementes) em 01/11/2026.
      assist: { fillStart: 0.22, fillFull: 0.52, mobilityLow: 0.45, drought: 6, smallBoost: 3, bigCut: 0.2,
        recoveryChance: 0.5, extraSets: 10, highScoreFade: 0.85, tripleShare: 1, // v1.22: ajuda some mais para quem tem muitos pontos (0,7→0,85)
        // v1.19 (pedido do dono): peça de salvação disfarçada — com o tabuleiro apertado, às vezes 1 das 3 peças é
        // sorteada entre as que completam uma linha agora (não sempre a melhor; as outras 2 vêm normais).
        rescueFrom: 0.35, rescueChance: 0.45 }, // v1.22: peça salvadora menos frequente (0,6→0,45; ainda × (1 − dificuldade))
      // v1.24: fase "lendária" — de `from` pontos em diante a ajuda vai sumindo e as peças grandes/estranhas aparecem mais,
      // até o máximo em `from + span`. Só no Clássico (os desafios usam filas fixas).
      late: { from: 300000, span: 300000, bigBoost: 1.5, awkwardBoost: 1.0 }
    },
    // v1.21 — blocos especiais (pedido do dono): a partir do nível 3, às vezes 1 bloco de uma peça nova vem especial.
    // Estrela: ao ser limpa dá pontos extras. Bomba: ao ser limpa explode os vizinhos 3×3 (blocos contam pontos).
    special: { fromLevel: 3, chance: 0.14, starPts: 150, bombPerBlock: 15, bombShare: 0.35
    }
  };

  // Peças: '#' = bloco. Peças NÃO giram; cada orientação é uma peça própria.
  // formatos das peças: js/pieces.js (biblioteca validada)
  var PIECES = typeof module !== 'undefined' && module.exports ? require('./pieces.js') : root.MZPieces;
  var bad = PIECES.validate();
  if (bad.length) throw new Error('Peças inválidas: ' + bad.join('; '));
  var SHAPE_DEFS = PIECES.LIST.map(function (p) { return [p.rows, p.weight, p.name, p.cat, p.minScore || 0]; });

  var SHAPES = SHAPE_DEFS.map(function (def, id) {
    var rows = def[0], cells = [];
    for (var r = 0; r < rows.length; r++)
      for (var c = 0; c < rows[r].length; c++)
        if (rows[r][c] === '#') cells.push([r, c]);
    return { id: id, cells: cells, h: rows.length, w: rows[0].length, weight: def[1], name: def[2], cat: def[3], minScore: def[4] };
  });

  function createBoard() {
    var b = new Array(SIZE * SIZE);
    for (var i = 0; i < b.length; i++) b[i] = -1;
    return b;
  }

  function canPlace(board, shape, r, c) {
    if (r < 0 || c < 0 || r + shape.h > SIZE || c + shape.w > SIZE) return false;
    for (var i = 0; i < shape.cells.length; i++) {
      var cell = shape.cells[i];
      if (board[(r + cell[0]) * SIZE + c + cell[1]] !== -1) return false;
    }
    return true;
  }

  function canFitAnywhere(board, shape) {
    for (var r = 0; r <= SIZE - shape.h; r++)
      for (var c = 0; c <= SIZE - shape.w; c++)
        if (canPlace(board, shape, r, c)) return true;
    return false;
  }

  function findFullLines(board) {
    var rows = [], cols = [], r, c, full;
    for (r = 0; r < SIZE; r++) {
      full = true;
      for (c = 0; c < SIZE; c++) if (board[r * SIZE + c] === -1) { full = false; break; }
      if (full) rows.push(r);
    }
    for (c = 0; c < SIZE; c++) {
      full = true;
      for (r = 0; r < SIZE; r++) if (board[r * SIZE + c] === -1) { full = false; break; }
      if (full) cols.push(c);
    }
    return { rows: rows, cols: cols };
  }

  /** Linhas/colunas que seriam limpas se a peça fosse colocada ali (para a prévia). */
  function previewLines(board, shape, r, c) {
    if (!canPlace(board, shape, r, c)) return null;
    var copy = board.slice();
    shape.cells.forEach(function (cell) { copy[(r + cell[0]) * SIZE + c + cell[1]] = 0; });
    return findFullLines(copy);
  }

  function fillRatio(board) {
    var n = 0;
    for (var i = 0; i < board.length; i++) if (board[i] !== -1) n++;
    return n / board.length;
  }

  /** Sorteio antigo: usado só para montar as filas fixas dos desafios (mudá-lo mudaria os desafios). */
  function randomShapeId(rng, fill, score) {
    var pr = CONFIG.generator.progress, boost = 1 + Math.min(pr.max, Math.floor((score || 0) / pr.perPoints) * pr.step);
    var total = 0, weights = SHAPES.map(function (s) {
      var w = (score || 0) >= s.minScore && s.cat !== 'diagonal' ? s.weight : 0, g = CONFIG.generator; // v1.21: sem diagonais, as filas continuam iguais
      if (fill > g.smallBoostFill && s.cells.length <= 3) w *= g.smallBoost;
      if (fill > g.bigCutFill && s.cells.length >= 6) w *= g.bigCut;
      if (fill <= g.bigCutFill && s.cells.length >= 5) w *= boost;
      total += w;
      return w;
    });
    var x = rng() * total;
    for (var i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
    return weights.length - 1;
  }

  function clearFull(b) {
    var f = findFullLines(b);
    f.rows.forEach(function (r) { for (var k = 0; k < SIZE; k++) b[r * SIZE + k] = -1; });
    f.cols.forEach(function (c) { for (var k = 0; k < SIZE; k++) b[k * SIZE + c] = -1; });
  }

  /**
   * As peças cabem todas, em alguma ordem, contando as linhas que vão sumindo?
   * Busca em profundidade com orçamento; se o orçamento acabar, responde false.
   */
  function wholeSetFits(board, shapes, budget) {
    var left = { n: budget || CONFIG.generator.searchBudget };
    function dfs(b, list) {
      if (!list.length) return true;
      var tried = {};
      for (var i = 0; i < list.length; i++) {
        var sh = list[i];
        if (tried[sh.id]) continue;
        tried[sh.id] = 1;
        var rest = list.slice(0, i).concat(list.slice(i + 1));
        for (var r = 0; r <= SIZE - sh.h; r++) {
          for (var c = 0; c <= SIZE - sh.w; c++) {
            if (!canPlace(b, sh, r, c)) continue;
            if (--left.n < 0) return false;
            var nb = b.slice();
            for (var k = 0; k < sh.cells.length; k++) nb[(r + sh.cells[k][0]) * SIZE + c + sh.cells[k][1]] = 0;
            clearFull(nb);
            if (dfs(nb, rest)) return true;
          }
        }
      }
      return false;
    }
    return dfs(board, shapes);
  }

  /* ---------------- diretor de dificuldade ---------------- */
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  var AWKWARD = { 'S/Z': 1, 'escada': 1, 'cruz': 1, 'L longo': 1, 'L grande': 1 };
  // peças de referência para medir quanto espaço útil ainda existe
  var PROBES = null;
  function probes() {
    if (!PROBES) PROBES = SHAPES.filter(function (s) { return ['##|##', '###', '#|#|#', '##|#.', '###|###|###'].indexOf(PIECES.LIST[s.id].rows.join('|')) !== -1; });
    return PROBES;
  }
  /** Espaço útil (0 a 1): fração das posições possíveis para peças comuns, comparada a um tabuleiro vazio. */
  function mobility(board) {
    var got = 0, max = 0;
    probes().forEach(function (sh) {
      max += (SIZE - sh.h + 1) * (SIZE - sh.w + 1);
      for (var r = 0; r <= SIZE - sh.h; r++) for (var c = 0; c <= SIZE - sh.w; c++) if (canPlace(board, sh, r, c)) got++;
    });
    return max ? got / max : 1;
  }
  /** v1.19 — Peça de salvação: sorteia (com peso pelo nº de linhas) uma peça que completa ao menos 1 linha agora.
   *  Sorteio entre todas as opções boas para não ficar óbvio. Devolve o índice da peça ou -1. */
  function rescueShape(board, rng, score) {
    var opts = [];
    SHAPES.forEach(function (sh, i) {
      if (sh.minScore && (score || 0) < sh.minScore) return;
      var best = 0;
      for (var r = 0; r <= SIZE - sh.h; r++) for (var c = 0; c <= SIZE - sh.w; c++) {
        if (!canPlace(board, sh, r, c)) continue;
        var p = previewLines(board, sh, r, c), n = p.rows.length + p.cols.length;
        if (n > best) best = n;
      }
      if (best > 0) opts.push({ i: i, w: Math.min(best, 3) });
    });
    if (!opts.length) return -1;
    var total = opts.reduce(function (a, o) { return a + o.w; }, 0), x = rng() * total;
    for (var k = 0; k < opts.length; k++) { x -= opts[k].w; if (x <= 0) return opts[k].i; }
    return opts[opts.length - 1].i;
  }

  /**
   * Lê a situação da partida e devolve { difficulty, assist } entre 0 e 1.
   * ctx: { score, movesSinceClear, recent: [linhas limpas nas últimas jogadas] }
   */
  function director(board, ctx) {
    ctx = ctx || {};
    var D = CONFIG.generator.difficulty, A = CONFIG.generator.assist, score = ctx.score || 0;
    var byScore = Math.pow(score / (score + D.halfAt), D.curve); // curva suave: devagar no começo, mais firme depois
    var recent = Array.isArray(ctx.recent) ? ctx.recent.slice(-D.recent) : [];
    var rate = recent.length >= 4 ? recent.reduce(function (a, b) { return a + b; }, 0) / recent.length : 0;
    var skill = clamp01((rate - 0.25) / 0.4) * clamp01(score / 800); // jogando bem: um pouco mais de desafio
    var difficulty = clamp01((1 - D.skillWeight) * byScore + D.skillWeight * skill);
    var fill = fillRatio(board), mob = mobility(board);
    var tight = 0.55 * clamp01((fill - A.fillStart) / (A.fillFull - A.fillStart)) +
      0.3 * clamp01((A.mobilityLow - mob) / A.mobilityLow) +
      0.15 * clamp01(((ctx.movesSinceClear || 0) - 2) / A.drought);
    var assist = clamp01(tight) * (1 - A.highScoreFade * byScore); // quem já vai longe recebe menos ajuda
    var late = lateFor(score);
    assist *= 1 - late;
    if (ctx.easy && (ctx.score || 0) < 600) { difficulty *= 0.25; assist = Math.max(assist, 0.35); } // v1.24: primeira partida mais tranquila (até ~5 mil pontos)
    return { difficulty: difficulty, assist: assist, fill: fill, mobility: mob, late: late };
  }
  function lateFor(score) { var T = CONFIG.generator.late; return T ? clamp01(((score || 0) - T.from) / T.span) : 0; }
  function pickShape(rng, score, dir) {
    var D = CONFIG.generator.difficulty, A = CONFIG.generator.assist, d = dir.difficulty, a = dir.assist;
    var T = CONFIG.generator.late, lt = dir.late || 0;
    var total = 0, weights = SHAPES.map(function (s) {
      var w = (score || 0) >= s.minScore ? s.weight : 0, n = s.cells.length;
      if (!w) return 0;
      if (n >= 5) w *= (1 + D.bigBoost * d) * (1 - (1 - A.bigCut) * a) * (1 + T.bigBoost * lt);
      if (AWKWARD[s.cat]) w *= (1 + D.awkwardBoost * d) * (1 + T.awkwardBoost * lt);
      if (n <= 2) w *= (1 - D.smallCut * d) * (1 + (A.smallBoost - 1) * a);
      else if (n === 3) w *= 1 + A.tripleShare * (A.smallBoost - 1) * a;
      total += w;
      return w;
    });
    var x = rng() * total;
    for (var i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
    return weights.length - 1;
  }
  /** Alguma peça do conjunto consegue completar uma linha agora? (chance de recuperação) */
  function canClearNow(board, shapes) {
    for (var k = 0; k < shapes.length; k++) {
      var sh = shapes[k];
      for (var r = 0; r <= SIZE - sh.h; r++) for (var c = 0; c <= SIZE - sh.w; c++) {
        if (!canPlace(board, sh, r, c)) continue;
        var p = previewLines(board, sh, r, c);
        if (p.rows.length + p.cols.length) return true;
      }
    }
    return false;
  }

  /**
   * Gera 3 peças. Exige que o conjunto caiba por inteiro em alguma ordem (justo);
   * a dificuldade e a ajuda só mudam as chances de cada formato.
   * ctx: { score, movesSinceClear, recent } (ou só a pontuação, como número)
   */
  function generatePieces(board, rng, ctx) {
    rng = rng || Math.random;
    if (typeof ctx !== 'object' || !ctx) ctx = { score: ctx || 0 };
    var g = CONFIG.generator, dir = director(board, ctx), set = null, fallback = null;
    // com o tabuleiro apertado, às vezes procura um conjunto que permita limpar uma linha (não é garantido)
    var wantRecovery = dir.assist > 0.05 && rng() < dir.assist * g.assist.recoveryChance, extra = 0, firstFit = null;
    for (var t = 0; t < g.attempts + g.assist.extraSets; t++) {
      var cand = [0, 1, 2].map(function () { return { s: pickShape(rng, ctx.score, dir), c: 0 }; });
      var shapes = cand.map(function (p) { return SHAPES[p.s]; });
      if (!shapes.some(function (sh) { return canFitAnywhere(board, sh); })) continue;
      if (!fallback) fallback = cand;
      if (g.requireWholeSet && !wholeSetFits(board, shapes)) { if (t >= g.attempts && firstFit) break; continue; }
      if (!wantRecovery || canClearNow(board, shapes)) { set = cand; break; }
      if (!firstFit) firstFit = cand;
      if (++extra >= g.assist.extraSets) break;
    }
    if (!set) set = firstFit || fallback;
    // v1.19: tabuleiro apertado e nenhuma peça do trio limpa linha → às vezes troca 1 peça (posição sorteada) por uma de salvação
    if (set && dir.assist >= g.assist.rescueFrom && rng() < g.assist.rescueChance * (1 - dir.difficulty) && // some com a dificuldade (pontos altos seguem difíceis)
        !canClearNow(board, set.map(function (p) { return SHAPES[p.s]; }))) {
      var rs = rescueShape(board, rng, ctx.score);
      if (rs >= 0) set[Math.floor(rng() * 3)] = { s: rs, c: 0 };
    }
    if (!set) { // sempre existe espaço para 1 bloco (linhas cheias são limpas)
      var calm = { difficulty: 0, assist: 1 };
      set = [{ s: 0, c: 0 }, { s: pickShape(rng, 0, calm), c: 0 }, { s: pickShape(rng, 0, calm), c: 0 }];
    }
    // cores diferentes entre as três peças
    var colors = [];
    while (colors.length < 3) {
      var col = Math.floor(rng() * COLORS);
      if (colors.indexOf(col) === -1) colors.push(col);
    }
    set.forEach(function (p, i) { p.c = colors[i]; });
    var SPc = CONFIG.special;
    if ((ctx.level || 1) >= SPc.fromLevel && rng() < SPc.chance) { // v1.21: 1 bloco especial numa das peças
      var pk = set[Math.floor(rng() * 3)];
      if (pk) pk.sp = { k: Math.floor(rng() * SHAPES[pk.s].cells.length), t: rng() < SPc.bombShare ? 'bomb' : 'star' };
    }
    return set;
  }

  function newGame(rng) {
    var board = createBoard();
    return {
      v: 1,
      board: board,
      pieces: generatePieces(board, rng),
      score: 0,
      base: 0,
      combo: 0,
      movesSinceClear: 0,
      maxCombo: 0,
      lines: 0,
      placed: 0,
      over: false
    };
  }

  /** Gerador pseudoaleatório com semente (mesma semente → mesma sequência). */
  function seededRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Sequência fixa de n peças a partir de uma semente (não depende do tabuleiro). */
  function makeQueue(seed, n) {
    var rng = seededRng(seed), q = [];
    for (var i = 0; i < n; i++) {
      var prev = q.length % 3 ? q.slice(q.length - (q.length % 3)).map(function (p) { return p.c; }) : [];
      var col;
      do { col = Math.floor(rng() * COLORS); } while (prev.indexOf(col) !== -1);
      q.push({ s: randomShapeId(rng, 0.5), c: col });
    }
    return q;
  }

  /** Zen: quando nada cabe, remove as 3 linhas mais cheias e traz peças novas. */
  function zenRelief(state, rng) {
    var counts = [];
    for (var r = 0; r < SIZE; r++) {
      var n = 0;
      for (var c = 0; c < SIZE; c++) if (state.board[r * SIZE + c] !== -1) n++;
      counts.push([n, r]);
    }
    counts.sort(function (a, b) { return b[0] - a[0]; });
    var cleared = [];
    counts.slice(0, 3).forEach(function (x) {
      for (var c = 0; c < SIZE; c++) {
        var i = x[1] * SIZE + c;
        if (state.board[i] !== -1) { cleared.push({ r: x[1], c: c, color: state.board[i] }); state.board[i] = -1; if (state.spec) delete state.spec[i]; }
      }
    });
    state.pieces = generatePieces(state.board, rng, ctxOf(state));
    state.over = !hasAnyMove(state);
    state.reliefs = (state.reliefs || 0) + 1;
    return cleared;
  }

  /** Nível e multiplicador de pontos. */
  function levelFor(lines) { return 1 + Math.floor((lines || 0) / CONFIG.score.levelEvery); }
  function multFor(level) {
    var S = CONFIG.score, lv = Math.max(1, level || 1);
    if (!S.capLevel || lv <= S.capLevel) return Math.pow(S.levelMult, lv - 1);
    return Math.pow(S.levelMult, S.capLevel - 1) + S.afterCap * (lv - S.capLevel);
  }

  function ctxOf(state) {
    // o equilíbrio usa a escala antiga (state.base); partidas salvas antigas não têm base → usam a pontuação
    return { score: typeof state.base === 'number' && isFinite(state.base) ? state.base : state.score, movesSinceClear: state.movesSinceClear, level: levelFor(state.lines || 0),
      recent: Array.isArray(state.recent) ? state.recent.filter(function (v) { return typeof v === 'number' && isFinite(v); }) : [], easy: !!state.easy };
  }

  /** v1.17 — Reviver (Clássico, 1× por partida, grátis): troca as peças da bandeja por 3 que cabem no tabuleiro atual.
   *  Não apaga blocos nem muda pontos. Prefere peças pequenas; devolve false se nenhuma peça couber. */
  function revive(state, rng) {
    rng = rng || Math.random;
    var fits = [];
    SHAPES.forEach(function (sh, i) {
      if (sh.minScore && (state.score || 0) < sh.minScore) return;
      for (var r = 0; r <= SIZE - sh.h; r++) for (var c = 0; c <= SIZE - sh.w; c++) if (canPlace(state.board, sh, r, c)) { fits.push(i); return; }
    });
    if (!fits.length) return false;
    var small = fits.filter(function (i) { return SHAPES[i].cells.length <= 4; }), pool = small.length ? small : fits, out = [];
    for (var k = 0; k < 3; k++) out.push({ s: pool[Math.floor(rng() * pool.length)], c: Math.floor(rng() * 7) });
    state.pieces = out; state.over = false; state.revives = (state.revives || 0) + 1;
    return true;
  }
  function hasAnyMove(state) {
    return state.pieces.some(function (p) { return p && canFitAnywhere(state.board, SHAPES[p.s]); });
  }

  function pieceFits(state, slot) {
    var p = state.pieces[slot];
    return !!p && canFitAnywhere(state.board, SHAPES[p.s]);
  }

  /* Pontuação: ver CONFIG.score no topo do arquivo. */

  function place(state, slot, r, c, rng) {
    if (state.over) return null;
    var piece = state.pieces[slot];
    if (!piece) return null;
    var shape = SHAPES[piece.s];
    if (!canPlace(state.board, shape, r, c)) return null;

    var placedCells = shape.cells.map(function (cell) {
      var rr = r + cell[0], cc = c + cell[1];
      state.board[rr * SIZE + cc] = piece.c;
      return [rr, cc];
    });
    if (piece.sp && placedCells[piece.sp.k]) { // v1.21: bloco especial vai para o tabuleiro
      if (!state.spec || typeof state.spec !== 'object') state.spec = {};
      state.spec[placedCells[piece.sp.k][0] * SIZE + placedCells[piece.sp.k][1]] = piece.sp.t;
    }

    var lines = findFullLines(state.board);
    var count = lines.rows.length + lines.cols.length;
    var sc = CONFIG.score, lg = sc.legacy, cleared = [], gemsTaken = [], spx = { stars: [], bombs: [], bombCells: 0, pts: 0, base: 0 };
    var level = levelFor(state.lines || 0), mult = multFor(level);
    var blockPts = shape.cells.length * sc.perBlock, linePts = 0, comboPts = 0, clearPts = 0;
    var baseGained = shape.cells.length * lg.perBlock;

    if (count > 0) {
      state.combo += 1;
      state.movesSinceClear = 0;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      linePts = sc.perLineSquared * count * count;
      comboPts = state.combo > 1 ? linePts * sc.comboBonus * (state.combo - 1) : 0;
      baseGained += lg.perLineSquared * count * count + (state.combo > 1 ? lg.comboPerLevel * (state.combo - 1) * count : 0);
      var seen = {};
      function mark(rr, cc) {
        var i = rr * SIZE + cc;
        if (!seen[i]) { seen[i] = 1; cleared.push({ r: rr, c: cc, color: state.board[i] }); }
      }
      lines.rows.forEach(function (rr) { for (var k = 0; k < SIZE; k++) mark(rr, k); });
      lines.cols.forEach(function (cc) { for (var k = 0; k < SIZE; k++) mark(k, cc); });
      // v1.21: blocos especiais nas linhas limpas (a bomba pode acertar outra bomba/estrela — em cadeia)
      if (state.spec && typeof state.spec === 'object') {
        var SP = CONFIG.special;
        for (var q = 0; q < cleared.length; q++) {
          var qi = cleared[q].r * SIZE + cleared[q].c, kind = state.spec[qi];
          if (kind === 'star') { spx.stars.push([cleared[q].r, cleared[q].c]); spx.pts += SP.starPts; spx.base += SP.starPts; }
          else if (kind === 'bomb') {
            spx.bombs.push([cleared[q].r, cleared[q].c]);
            for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
              var br = cleared[q].r + dr, bc = cleared[q].c + dc, bi = br * SIZE + bc;
              if (br < 0 || bc < 0 || br >= SIZE || bc >= SIZE || seen[bi] || state.board[bi] < 0) continue;
              mark(br, bc); spx.bombCells++; spx.pts += SP.bombPerBlock; spx.base += SP.bombPerBlock;
            }
          }
          if (kind) delete state.spec[qi];
        }
      }
      cleared.forEach(function (o) { state.board[o.r * SIZE + o.c] = -1; });
      // v1.17 — Aventura: gemas presas em blocos saem quando a linha/coluna é limpa
      if (Array.isArray(state.gems) && state.gems.length) {
        cleared.forEach(function (o) {
          var gi = state.gems.indexOf(o.r * SIZE + o.c);
          if (gi !== -1) { state.gems.splice(gi, 1); state.gemsGot = (state.gemsGot || 0) + 1; gemsTaken.push([o.r, o.c]); }
        });
      }
      state.lines += count;
      if (count >= 2) state.multi2 = (state.multi2 || 0) + 1;
      if (count >= 3) state.multi3 = (state.multi3 || 0) + 1;
      state.bestMulti = Math.max(state.bestMulti || 0, count);
      if (state.board.every(function (v) { return v === -1; })) { clearPts = sc.boardClear; baseGained += lg.boardClear; state.clears = (state.clears || 0) + 1; }
    } else {
      state.movesSinceClear += 1;
      if (state.movesSinceClear >= CONFIG.combo.window) state.combo = 0;
    }

    // histórico recente (linhas por jogada) para o diretor de dificuldade
    if (!Array.isArray(state.recent)) state.recent = [];
    state.recent.push(count);
    if (state.recent.length > CONFIG.generator.difficulty.recent) state.recent.splice(0, state.recent.length - CONFIG.generator.difficulty.recent);
    var gained = Math.round((blockPts + linePts + comboPts + clearPts + spx.pts) * mult);
    baseGained += spx.base;
    state.score += gained;
    state.base = (typeof state.base === 'number' && isFinite(state.base) ? state.base : 0) + baseGained;
    var newLevel = levelFor(state.lines || 0);
    state.placed += 1;
    state.pieces[slot] = null;

    var refilled = false;
    if (state.pieces.every(function (p) { return !p; })) {
      if (state.queue) {
        var next = state.queue.splice(0, 3); // a fila pode terminar com 1 ou 2 peças
        while (next.length < 3) next.push(null);
        state.pieces = next;
      } else {
        state.pieces = generatePieces(state.board, rng, ctxOf(state));
      }
      refilled = true;
    }
    state.over = !hasAnyMove(state);

    return {
      placed: placedCells, color: piece.c, gems: gemsTaken, special: spx,
      rows: lines.rows, cols: lines.cols, lineCount: count,
      cleared: cleared, blockPts: blockPts, linePts: linePts, comboPts: comboPts,
      clearPts: Math.round(clearPts * mult), boardClear: clearPts > 0, baseGained: baseGained,
      level: newLevel, mult: multFor(newLevel), levelUp: newLevel > level, multUsed: mult, comboBonus: Math.round(comboPts * mult), movesLeft: count > 0 ? CONFIG.combo.window : CONFIG.combo.window - state.movesSinceClear,
      gained: gained, combo: state.combo, refilled: refilled, over: state.over
    };
  }

  function isPiece(p) {
    return !!p && typeof p === 'object' && Number.isInteger(p.s) && !!SHAPES[p.s] && Number.isInteger(p.c) && p.c >= 0 && p.c < COLORS &&
      (p.sp === undefined || (!!p.sp && Number.isInteger(p.sp.k) && p.sp.k >= 0 && p.sp.k < SHAPES[p.s].cells.length && (p.sp.t === 'star' || p.sp.t === 'bomb')));
  }
  function isCount(v) { return typeof v === 'number' && isFinite(v) && v >= 0; }
  function isValidState(s) {
    return !!s && s.v === 1 && Array.isArray(s.board) && s.board.length === SIZE * SIZE &&
      s.board.every(function (v) { return v === -1 || (Number.isInteger(v) && v >= 0 && v < COLORS); }) &&
      Array.isArray(s.pieces) && s.pieces.length === 3 &&
      s.pieces.every(function (p) { return p === null || isPiece(p); }) &&
      (s.queue === undefined || (Array.isArray(s.queue) && s.queue.every(isPiece))) &&
      ['score', 'combo', 'movesSinceClear', 'maxCombo', 'lines', 'placed'].every(function (k) { return isCount(s[k]); }) &&
      (s.gems === undefined || (Array.isArray(s.gems) && s.gems.every(function (g) { return Number.isInteger(g) && g >= 0 && g < SIZE * SIZE; }))) &&
      (s.spec === undefined || (!!s.spec && typeof s.spec === 'object' && Object.keys(s.spec).every(function (k) { var i = +k; return Number.isInteger(i) && i >= 0 && i < SIZE * SIZE && (s.spec[k] === 'star' || s.spec[k] === 'bomb'); })));
  }

  var api = {
    SIZE: SIZE, COLORS: COLORS, SHAPES: SHAPES, CONFIG: CONFIG, wholeSetFits: wholeSetFits,
    seededRng: seededRng, makeQueue: makeQueue, zenRelief: zenRelief,
    createBoard: createBoard, canPlace: canPlace, canFitAnywhere: canFitAnywhere,
    findFullLines: findFullLines, previewLines: previewLines, generatePieces: generatePieces, director: director, mobility: mobility,
    newGame: newGame, place: place, rescueShape: rescueShape, levelFor: levelFor, multFor: multFor, hasAnyMove: hasAnyMove, pieceFits: pieceFits, isValidState: isValidState, revive: revive
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZLogic = api;
})(this);
