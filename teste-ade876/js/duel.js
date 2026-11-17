/* Kablox — Ranqueada (laboratório, v1.27): duelo por turnos no MESMO tabuleiro 8×8.
 * Parte 1 (este bloco): regras puras, sem tela — usadas pelo jogo, pelos testes (node) e pelo simulador.
 *  - Cada jogador tem a sua bandeja de 3 peças; os dois recebem AS MESMAS peças, na mesma ordem (fila espelhada).
 *  - Na sua vez você coloca 1 peça. Os blocos ficam com a sua cor (dono).
 *  - Quem completa a linha leva os pontos dela; cada bloco do rival na linha vale um bônus de "roubo".
 *  - Travou (nenhuma peça cabe)? Passa a vez, o rival ganha um bônus e você recebe peças novas.
 *  - A partida tem um número fixo de vezes para cada um. Acaba antes se os dois travarem seguidos.
 * Parte 2 (mais abaixo): a tela da Ranqueada, só no navegador.
 */
(function (root) {
  'use strict';
  var Logic = typeof module !== 'undefined' && module.exports ? require('./logic.js') : root.MZLogic;
  var SIZE = Logic.SIZE, SHAPES = Logic.SHAPES;

  var CONFIG = {
    turns: 15,            // vezes de cada jogador (simulador: ~30 jogadas, ~2–3 min)
    block: 10,            // por bloco colocado
    line: 100,            // por linha: line × L²
    steal: 15,            // por bloco do rival dentro de uma linha limpa
    comboStep: 0.5,       // limpou de novo na sua vez seguinte: +50% nas linhas por nível de combo
    boardClear: 1000,     // tabuleiro vazio
    stuckBonus: 150,      // o rival travou: bônus para quem não travou
    queueLen: 240,
    maxCells: 5,          // peças de até 5 blocos (tabuleiro dividido enche rápido)
    secondBonus: 0,       // compensação para quem começa em segundo (ajustada pelo simulador)
    // pontos de ranqueada
    // v1.28: rating no estilo do xadrez (Elo), mais generoso: vitória vale mais do que a derrota tira, e um "piso"
    // (você nunca cai abaixo do começo da maior divisão que já alcançou). Começa em 800.
    elo: { start: 800, kWin: 40, kLoss: 22, kWinPro: 32, kLossPro: 18, proGames: 20, minWin: 6, maxLoss: 26, margin: 5 },
    // cada divisão tem o seu robô (rating = começo da divisão + 60), cada um um pouco mais forte que o anterior
    divisions: [
      { id: 'iron', min: 0 }, { id: 'bronze', min: 900 }, { id: 'silver', min: 1000 }, { id: 'gold', min: 1100 },
      { id: 'platinum', min: 1250 }, { id: 'emerald', min: 1400 }, { id: 'diamond', min: 1550 }, { id: 'master', min: 1700 },
      { id: 'grandmaster', min: 1850 }, { id: 'legend', min: 2000 }
    ]
  };

  function clone(m) {
    return { board: m.board.slice(), queue: m.queue, ptr: m.ptr.slice(), trays: [m.trays[0].slice(), m.trays[1].slice()], turn: m.turn,
      used: m.used.slice(), score: m.score.slice(), combo: m.combo.slice(), clearedLast: m.clearedLast.slice(), passes: m.passes, over: m.over,
      lines: m.lines.slice(), stolen: m.stolen.slice(), stuck: m.stuck.slice(), first: m.first };
  }
  /** Fila espelhada própria do duelo: só peças comuns de até maxCells blocos, menores mais frequentes. */
  var POOL = null;
  function pool() {
    if (POOL) return POOL;
    POOL = [];
    SHAPES.forEach(function (sh, id) {
      if (sh.minScore || sh.cat === 'diagonal' || sh.cells.length > CONFIG.maxCells) return;
      POOL.push({ id: id, w: sh.weight * (sh.cells.length <= 2 ? 1.2 : sh.cells.length >= 5 ? 0.6 : 1) });
    });
    return POOL;
  }
  function makeQueue(seed, n) {
    var rng = Logic.seededRng(seed), P = pool(), tot = P.reduce(function (a, p) { return a + p.w; }, 0), q = [];
    for (var i = 0; i < n; i++) {
      var x = rng() * tot, k = 0;
      while (k < P.length - 1 && (x -= P[k].w) >= 0) k++;
      q.push({ s: P[k].id, c: i % 3 });
    }
    return q;
  }
  /** Travou: some a linha (ou coluna) mais cheia, sem pontos — para o duelo continuar. */
  function relief(m) {
    var best = -1, bi = 0, isRow = true, n, r, c;
    for (r = 0; r < SIZE; r++) { n = 0; for (c = 0; c < SIZE; c++) if (m.board[r * SIZE + c] !== -1) n++; if (n > best) { best = n; bi = r; isRow = true; } }
    for (c = 0; c < SIZE; c++) { n = 0; for (r = 0; r < SIZE; r++) if (m.board[r * SIZE + c] !== -1) n++; if (n > best) { best = n; bi = c; isRow = false; } }
    var gone = [];
    for (var k = 0; k < SIZE; k++) { var i = isRow ? bi * SIZE + k : k * SIZE + bi; if (m.board[i] !== -1) { m.board[i] = -1; gone.push(i); } }
    return gone;
  }
  function draw3(m, who) {
    var t = [];
    for (var i = 0; i < 3; i++) { t.push(m.queue[m.ptr[who] % m.queue.length]); m.ptr[who]++; }
    m.trays[who] = t;
  }
  /** Nova partida. first = quem começa (0 = você, 1 = rival). */
  function newMatch(seed, first) {
    var m = { board: Logic.createBoard(), queue: makeQueue(seed >>> 0, CONFIG.queueLen), ptr: [0, 0], trays: [null, null], turn: first ? 1 : 0,
      used: [0, 0], score: [0, 0], combo: [0, 0], clearedLast: [false, false], passes: 0, over: false, lines: [0, 0], stolen: [0, 0], stuck: [0, 0], first: first ? 1 : 0 };
    draw3(m, 0); draw3(m, 1);
    m.score[first ? 0 : 1] += CONFIG.secondBonus;
    return m;
  }
  function legalMoves(m, who) {
    var out = [], tray = m.trays[who];
    for (var s = 0; s < 3; s++) {
      var p = tray[s]; if (!p) continue;
      var sh = SHAPES[p.s];
      for (var r = 0; r <= SIZE - sh.h; r++) for (var c = 0; c <= SIZE - sh.w; c++)
        if (Logic.canPlace(m.board, sh, r, c)) out.push({ slot: s, r: r, c: c });
    }
    return out;
  }
  function canMove(m, who) {
    var tray = m.trays[who];
    for (var s = 0; s < 3; s++) if (tray[s] && Logic.canFitAnywhere(m.board, SHAPES[tray[s].s])) return true;
    return false;
  }
  /** Coloca a peça (sem trocar a vez). Devolve o que aconteceu. Não confere se a jogada é válida: use canPlace antes. */
  function apply(m, who, slot, r, c) {
    var p = m.trays[who][slot], sh = SHAPES[p.s], cells = [];
    sh.cells.forEach(function (k) { var i = (r + k[0]) * SIZE + c + k[1]; m.board[i] = who; cells.push(i); });
    m.trays[who][slot] = null;
    var f = Logic.findFullLines(m.board), L = f.rows.length + f.cols.length, gone = {}, steal = 0, own = 0;
    f.rows.forEach(function (rr) { for (var k = 0; k < SIZE; k++) gone[rr * SIZE + k] = 1; });
    f.cols.forEach(function (cc) { for (var k = 0; k < SIZE; k++) gone[k * SIZE + cc] = 1; });
    var goneList = Object.keys(gone).map(Number);
    goneList.forEach(function (i) { if (m.board[i] === 1 - who) steal++; else own++; });
    var pts = sh.cells.length * CONFIG.block, linePts = 0, stealPts = 0, comboLvl = 0, clearBonus = 0;
    if (L > 0) {
      comboLvl = m.clearedLast[who] ? m.combo[who] + 1 : 0;
      linePts = Math.round(CONFIG.line * L * L * (1 + CONFIG.comboStep * comboLvl));
      stealPts = steal * CONFIG.steal;
      goneList.forEach(function (i) { m.board[i] = -1; });
      m.combo[who] = comboLvl; m.clearedLast[who] = true; m.lines[who] += L; m.stolen[who] += steal;
      if (m.board.every(function (v) { return v === -1; })) clearBonus = CONFIG.boardClear;
    } else { m.combo[who] = 0; m.clearedLast[who] = false; }
    var gained = pts + linePts + stealPts + clearBonus;
    m.score[who] += gained;
    m.used[who]++;
    if (m.trays[who].every(function (x) { return !x; })) draw3(m, who);
    return { who: who, cells: cells, rows: f.rows, cols: f.cols, lines: L, steal: steal, gone: goneList,
      blockPts: pts, linePts: linePts, stealPts: stealPts, clearBonus: clearBonus, combo: comboLvl, gained: gained };
  }
  /** Passa a vez para o próximo jogador; trata quem travou e o fim da partida. Devolve a lista de passes ocorridos. */
  function advance(m) {
    var events = [];
    m.turn = 1 - m.turn;
    for (var guard = 0; guard < 4 && !m.over; guard++) {
      if (m.used[0] >= CONFIG.turns && m.used[1] >= CONFIG.turns) { m.over = true; break; }
      if (m.used[m.turn] >= CONFIG.turns) { m.turn = 1 - m.turn; continue; }
      if (canMove(m, m.turn)) { m.passes = 0; break; }
      // travou: passa a vez, o rival ganha bônus, peças novas
      var w = m.turn;
      m.stuck[w]++; m.used[w]++; m.passes++; m.score[1 - w] += CONFIG.stuckBonus; m.combo[w] = 0; m.clearedLast[w] = false;
      draw3(m, w);
      events.push({ stuck: w, bonusTo: 1 - w, gone: relief(m) });
      m.turn = 1 - w;
    }
    return events;
  }
  /** Vencedor: mais pontos; empate → mais linhas; depois mais blocos roubados; senão empate (-1). */
  function winner(m) {
    var a = [m.score, m.lines, m.stolen];
    for (var i = 0; i < a.length; i++) if (a[i][0] !== a[i][1]) return a[i][0] > a[i][1] ? 0 : 1;
    return -1;
  }

  /* ---------------- robô ---------------- */
  // níveis: 0 Novato · 1 Esperto · 2 Ninja · 3 Mestre · 4 Lenda
  var BOT = [
    { noise: 260, random: 0.30, threat: 0, block: 0, mob: 10 },
    { noise: 140, random: 0.12, threat: 0.25, block: 0, mob: 25 },
    { noise: 60, random: 0.04, threat: 0.6, block: 15, mob: 35 },
    { noise: 25, random: 0, threat: 0.85, block: 30, mob: 40 },
    { noise: 6, random: 0, threat: 1, block: 45, mob: 45 }
  ];
  function bestGain(m, who) {
    var best = 0, mv = legalMoves(m, who);
    for (var i = 0; i < mv.length; i++) {
      var t = clone(m), res = apply(t, who, mv[i].slot, mv[i].r, mv[i].c);
      if (res.gained > best) best = res.gained;
    }
    return best;
  }
  function fitsCount(m, who) {
    var n = 0, tray = m.trays[who];
    for (var s = 0; s < 3; s++) if (tray[s] && Logic.canFitAnywhere(m.board, SHAPES[tray[s].s])) n++;
    return n;
  }
  /** Perfil do robô para um nível com fração (0 = Novato … 4 = Lenda): mistura os dois perfis vizinhos. */
  function botCfg(level) {
    var L = Math.max(0, Math.min(BOT.length - 1, +level || 0)), i = Math.min(BOT.length - 2, Math.floor(L)), f = L - i, a = BOT[i], b = BOT[i + 1], o = {};
    Object.keys(a).concat(Object.keys(b)).forEach(function (k) { var x = a[k] || 0, y = b[k] || 0; o[k] = x + (y - x) * f; });
    return o;
  }
  /** Nível (0–4, com fração) do robô de cada divisão: 10 robôs do mais fácil ao mais difícil. */
  // Nível do robô de cada divisão (0 Novato … 4 Lenda). Do Diamante para cima o robô já joga perto do máximo,
  // então ele ganha uma VANTAGEM de pontos no começo (como dar vantagem no xadrez) — aparece na tela.
  var DIV_LEVEL = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4];
  var DIV_HANDICAP = [0, 0, 0, 0, 0, 0, 0, 100, 200, 350]; // conferido em tools/duel_sim.js: cada divisão vence a anterior
  function handicapOfDiv(i) { return DIV_HANDICAP[Math.max(0, Math.min(DIV_HANDICAP.length - 1, i | 0))]; }
  function botLevelOfDiv(i) { return DIV_LEVEL[Math.max(0, Math.min(DIV_LEVEL.length - 1, i | 0))]; }
  function botRatingOfDiv(i) { var d = CONFIG.divisions[Math.max(0, Math.min(CONFIG.divisions.length - 1, i | 0))]; return (i === 0 ? 840 : d.min) + 60; }
  /** Escolhe a jogada do robô. rng = função 0..1. level pode ter fração. */
  function botMove(m, who, level, rng) {
    var cfg = botCfg(level), mv = legalMoves(m, who);
    if (!mv.length) return null;
    if (rng() < cfg.random) return mv[Math.floor(rng() * mv.length)];
    var rival = 1 - who, best = null, bestV = -1e9;
    for (var i = 0; i < mv.length; i++) {
      var t = clone(m), res = apply(t, who, mv[i].slot, mv[i].r, mv[i].c), v = res.gained;
      var rivalMoves = m.used[rival] < CONFIG.turns;
      if (cfg.threat && rivalMoves) v -= cfg.threat * bestGain(t, rival);
      if (cfg.block && rivalMoves) { var fit = fitsCount(t, rival); v += (3 - fit) * cfg.block; if (fit === 0) v += CONFIG.stuckBonus; }
      v += cfg.mob * fitsCount(t, who);
      v += (rng() - 0.5) * cfg.noise;
      if (v > bestV) { bestV = v; best = mv[i]; }
    }
    return best;
  }

  /* ---------------- ranqueada (rating estilo xadrez e divisões) ---------------- */
  function divisionOf(elo) {
    var d = CONFIG.divisions, i = d.length - 1, lo;
    while (i > 0 && elo < d[i].min) i--;
    var next = d[i + 1]; lo = i === 0 ? CONFIG.elo.start : d[i].min;
    return { index: i, id: d[i].id, min: d[i].min, next: next ? next.min : null, progress: next ? Math.max(0, (elo - lo) / (next.min - lo)) : 1 };
  }
  /** Chance esperada de vitória (fórmula do Elo do xadrez). */
  function expected(me, rival) { return 1 / (1 + Math.pow(10, (rival - me) / 400)); }
  /** Variação do rating numa partida. result: 1 venceu, 0 empate, -1 perdeu. games = partidas ranqueadas já jogadas. */
  function eloDelta(result, me, rival, games, myScore, rivalScore) {
    var E = CONFIG.elo, ex = expected(me, rival), pro = (games || 0) >= E.proGames;
    if (result > 0) return Math.max(E.minWin, Math.round((pro ? E.kWinPro : E.kWin) * (1 - ex))) + Math.min(E.margin, Math.floor(Math.max(0, myScore - rivalScore) / 300));
    if (result < 0) return -Math.min(E.maxLoss, Math.max(1, Math.round((pro ? E.kLossPro : E.kLoss) * ex)));
    return Math.round((pro ? E.kWinPro : E.kWin) * (0.5 - ex) * 0.6);
  }
  /** Piso: o começo da maior divisão já alcançada (a divisão inicial não tem piso abaixo do começo). */
  function floorFor(top) { var d = divisionOf(top || 0); return d.index === 0 ? 0 : d.min; }
  function botLevelFor(elo) { return botLevelOfDiv(divisionOf(elo).index); }

  var Core = { CONFIG: CONFIG, BOT: BOT, newMatch: newMatch, legalMoves: legalMoves, canMove: canMove, apply: apply, advance: advance,
    winner: winner, makeQueue: makeQueue, relief: relief, botMove: botMove, clone: clone, divisionOf: divisionOf, expected: expected, eloDelta: eloDelta, floorFor: floorFor, botLevelFor: botLevelFor,
    botCfg: botCfg, botLevelOfDiv: botLevelOfDiv, botRatingOfDiv: botRatingOfDiv, handicapOfDiv: handicapOfDiv, DIV_HANDICAP: DIV_HANDICAP };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Core; return; }
  root.MZDuel = Core;
})(this);

/* ===================== Parte 2: a tela da Ranqueada (só no navegador) ===================== */
(function () {
  'use strict';
  if (typeof document === 'undefined' || !window.GB || !window.MZDuel) return;
  var G = window.GB, D = window.MZDuel, Logic = window.MZLogic, T = window.MZI18n.t, SIZE = Logic.SIZE, SHAPES = Logic.SHAPES;
  if (!G.flags || !G.flags.ranked) return;
  var INK = '#05080F';
  var PAL = [['#FFD98A', '#F5B93A', '#C4861A'], ['#7FB2FF', '#3B82F6', '#1E55C2']]; // você = dourado · rival = azul (cores que não se confundem)
  // v1.28: um robô por divisão (do mais fácil ao mais difícil)
  var BOT_NAMES = ['Robô de Ferro', 'Robô de Bronze', 'Robô de Prata', 'Robô de Ouro', 'Robô de Platina', 'Robô de Esmeralda', 'Robô de Diamante', 'Robô Mestre', 'Robô Grão-Mestre', 'Robô Lendário'];
  var DIV_NAMES = { iron: 'Ferro', bronze: 'Bronze', silver: 'Prata', gold: 'Ouro', platinum: 'Platina', emerald: 'Esmeralda', diamond: 'Diamante', master: 'Mestre', grandmaster: 'Grão-Mestre', legend: 'Lendário' };
  var DIV_ICON = { iron: '🔩', bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💠', emerald: '💚', diamond: '💎', master: '🎖️', grandmaster: '🏆', legend: '👑' };
  function $(s) { return document.querySelector(s); }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function num(v, d) { return typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : d; }

  /* ---------- progresso da ranqueada (só no aparelho) ---------- */
  function loadRank() {
    var r = G.store.get('gb.ranked', {}) || {}, S = D.CONFIG.elo.start;
    // v1.28: rating estilo xadrez. Quem tinha os pontos antigos (rp, 0–1.100+) começa em 800 + rp.
    var elo = typeof r.elo === 'number' ? num(r.elo, S) : S + Math.min(1500, num(r.rp, 0));
    elo = Math.max(0, Math.min(3500, elo));
    var top = Math.max(elo, Math.min(3500, num(r.topElo, 0)));
    return { elo: elo, topElo: top, games: num(r.games, num(r.w, 0) + num(r.l, 0) + num(r.d, 0)), w: num(r.w, 0), l: num(r.l, 0), d: num(r.d, 0), best: num(r.best, 0), streak: num(r.streak, 0) };
  }
  function saveRank(r) { G.store.set('gb.ranked', r); }
  var rank = loadRank();

  var screen = $('#screen-duel'), rootEl = $('#duel-root');
  var sofa = false; // v1.27: Duelo no sofá — dois jogadores no mesmo celular, passando o aparelho
  // v1.28: Amistoso online — online = { sess, side (0 = quem criou, 1 = quem entrou), nick, round, againMe, againThem }
  var online = null;
  function mySide() { return online ? online.side : 0; }
  function hp() { return sofa && match ? match.turn : mySide(); } // de quem é a bandeja de baixo
  function humanTurn() { return !!match && !match.over && (sofa || match.turn === mySide()); }
  function flipped() { return !!online && online.side === 1; } // quem entrou vê os próprios blocos dourados
  var match = null, ranked = true, botLevel = 0, busy = false, rng = Math.random, moves = [], anims = [], raf = 0, flashCells = null;
  var drag = null, selected = -1, ghost = null, lastMsgT = 0;
  var bcv, bctx, cell = 40, pad = 8, trayCvs = [], rivalCvs = [], dragCv, dctx;

  /* ---------- desenho dos blocos (estilo quadrinhos: brilho 3D + contorno preto) ---------- */
  function rr(c, x, y, w, hh, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function block(c, x, y, s, who, alpha) {
    if (flipped()) who = 1 - who;
    var p = PAL[who], r = Math.max(3, s * 0.2), g = c.createLinearGradient(x, y, x + s * 0.5, y + s);
    g.addColorStop(0, p[0]); g.addColorStop(0.55, p[1]); g.addColorStop(1, p[2]);
    c.save(); c.globalAlpha = alpha == null ? 1 : alpha;
    rr(c, x + 1, y + 1, s - 2, s - 2, r); c.fillStyle = g; c.fill();
    c.lineWidth = Math.max(1.5, s * 0.06); c.strokeStyle = INK; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; rr(c, x + s * 0.18, y + s * 0.14, s * 0.46, s * 0.12, s * 0.06); c.fill();
    c.fillStyle = 'rgba(0,0,0,.22)'; rr(c, x + s * 0.14, y + s * 0.76, s * 0.72, s * 0.1, s * 0.05); c.fill();
    if (who === 1) { // símbolo além da cor: losango no bloco do rival
      c.fillStyle = 'rgba(5,8,15,.55)'; c.beginPath(); var cx = x + s / 2, cy = y + s / 2, k = s * 0.14;
      c.moveTo(cx, cy - k); c.lineTo(cx + k, cy); c.lineTo(cx, cy + k); c.lineTo(cx - k, cy); c.closePath(); c.fill();
    }
    c.restore();
  }
  function emptyCell(c, x, y, s) { rr(c, x + 1, y + 1, s - 2, s - 2, Math.max(3, s * 0.2)); c.fillStyle = '#162033'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1; c.stroke(); }

  function now() { return performance.now(); }
  function renderBoard() {
    if (!bctx || !match) return;
    var t = now(), W = bcv.width / dpr(), c = bctx;
    c.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    c.clearRect(0, 0, W, W);
    rr(c, 0, 0, W, W, 18); c.fillStyle = '#0B111D'; c.fill();
    var hl = {}, gh = {}, ghWho = 0;
    if (ghost) { ghost.cells.forEach(function (i) { gh[i] = 1; }); ghWho = ghost.who; if (ghost.lines) ghost.lines.forEach(function (i) { hl[i] = 1; }); }
    for (var r = 0; r < SIZE; r++) for (var col = 0; col < SIZE; col++) {
      var i = r * SIZE + col, x = pad + col * cell, y = pad + r * cell, v = match.board[i];
      if (v === -1) emptyCell(c, x, y, cell);
      else block(c, x, y, cell, v);
      if (gh[i] && v === -1) { block(c, x, y, cell, ghWho, ghost.ok ? 0.5 : 0.25); }
      if (hl[i]) { c.save(); c.fillStyle = 'rgba(255,236,170,' + (0.25 + 0.15 * Math.sin(t / 120)) + ')'; rr(c, x + 1, y + 1, cell - 2, cell - 2, cell * 0.2); c.fill(); c.restore(); }
    }
    var live = false;
    anims = anims.filter(function (a) {
      var k = (t - a.t0) / a.dur; if (k >= 1) return false; live = true;
      if (a.type === 'pop') a.cells.forEach(function (i) { var x = pad + (i % SIZE) * cell, y = pad + Math.floor(i / SIZE) * cell, s = 1 + 0.18 * Math.sin(k * Math.PI);
        c.save(); c.translate(x + cell / 2, y + cell / 2); c.scale(s, s); c.translate(-x - cell / 2, -y - cell / 2); if (match.board[i] !== -1) block(c, x, y, cell, match.board[i]); c.restore(); });
      if (a.type === 'clear') a.cells.forEach(function (o) { var x = pad + (o.i % SIZE) * cell, y = pad + Math.floor(o.i / SIZE) * cell, s = 1 - 0.6 * k;
        c.save(); c.globalAlpha = 1 - k; c.translate(x + cell / 2, y + cell / 2); c.rotate(k * (o.i % 2 ? 0.6 : -0.6)); c.scale(s, s); c.translate(-x - cell / 2, -y - cell / 2);
        block(c, x, y, cell, o.who); c.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - k)) + ')'; rr(c, x + 1, y + 1, cell - 2, cell - 2, cell * 0.2); c.fill(); c.restore(); });
      if (a.type === 'spark') a.parts.forEach(function (p) { var e = k * a.dur / 1000; c.fillStyle = p.col; c.globalAlpha = 1 - k;
        c.fillRect(p.x + p.vx * e, p.y + p.vy * e + 300 * e * e, p.s, p.s); c.globalAlpha = 1; });
      return true;
    });
    if (live || (ghost && ghost.lines && ghost.lines.length)) { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderBoard); }
  }
  function kick() { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderBoard); }
  function dpr() { return Math.min(2, window.devicePixelRatio || 1); }
  function anim() { return (G.settings && G.settings.anim) || 'full'; }

  function drawPiece(cv, p, who, size, alpha, maxCell) {
    var c = cv.getContext('2d'), k = dpr();
    if (!p) { cv.width = 1; cv.height = 1; cv.style.width = size + 'px'; cv.style.height = size + 'px'; return; }
    var sh = SHAPES[p.s], s = Math.floor(Math.min(maxCell || size / 3, size / Math.max(sh.w, sh.h)));
    cv.width = sh.w * s * k; cv.height = sh.h * s * k; cv.style.width = sh.w * s + 'px'; cv.style.height = sh.h * s + 'px';
    c.setTransform(k, 0, 0, k, 0, 0);
    sh.cells.forEach(function (q) { block(c, q[1] * s, q[0] * s, s, who, alpha); });
  }

  /* ---------- montagem da tela ---------- */
  function layout() {
    if (!bcv) return;
    var vw = Math.min(window.innerWidth, 520), vh = window.innerHeight;
    var side = Math.max(220, Math.min(vw - 40, vh - 330, 420));
    cell = Math.floor((side - 2 * pad) / SIZE); side = cell * SIZE + 2 * pad;
    bcv.width = side * dpr(); bcv.height = side * dpr(); bcv.style.width = side + 'px'; bcv.style.height = side + 'px';
    renderBoard(); drawTrays();
  }
  function drawTrays() {
    if (!match) return;
    var ts = Math.min(cell * 2.6, 104), tc = Math.min(cell * 0.62, 26);
    var me = hp(), other = 1 - me;
    trayCvs.forEach(function (cv, s) {
      var p = match.trays[me][s], fits = p && Logic.canFitAnywhere(match.board, SHAPES[p.s]);
      drawPiece(cv, drag && drag.slot === s ? null : p, me, ts, p && !fits ? 0.35 : 1, tc);
      var b = cv.parentNode; b.disabled = !p || busy || !humanTurn();
      b.classList.toggle('sel', selected === s); b.classList.toggle('nofit', !!p && !fits);
      b.setAttribute('aria-label', p ? T('Peça {n}', { n: s + 1 }) + (fits ? '' : ' — ' + T('não cabe')) : T('vazio'));
    });
    rivalCvs.forEach(function (cv, s) { drawPiece(cv, match.trays[other][s], other, 52, 0.95, 13); });
    var rl = document.querySelector('.duel-rlabel'); if (rl) rl.textContent = sofa || online ? T('Peças de {name}', { name: pname(other) }) : T('Peças do rival');
  }
  function scoreBox() {
    if (!match) return;
    $('#duel-s0').textContent = G.fmt(match.score[0]); $('#duel-s1').textContent = G.fmt(match.score[1]);
    $('#duel-p0').classList.toggle('turn', match.turn === 0 && !match.over); $('#duel-p1').classList.toggle('turn', match.turn === 1 && !match.over);
    var left0 = Math.max(0, D.CONFIG.turns - match.used[0]), left1 = Math.max(0, D.CONFIG.turns - match.used[1]);
    $('#duel-left0').textContent = T('{n} vezes', { n: left0 }); $('#duel-left1').textContent = T('{n} vezes', { n: left1 });
    var lead = match.score[0] - match.score[1];
    $('#duel-p0').classList.toggle('lead', lead > 0); $('#duel-p1').classList.toggle('lead', lead < 0);
  }
  function say(text, cls) {
    var m = $('#duel-msg'); m.textContent = text; m.className = 'duel-msg' + (cls ? ' ' + cls : ''); lastMsgT = now();
  }
  function floatText(text, i, cls) {
    var fx = $('#duel-fx'), e = h('div', 'duel-pop' + (cls ? ' ' + cls : ''), text);
    var x = pad + (i % SIZE + 0.5) * cell, y = pad + (Math.floor(i / SIZE) + 0.5) * cell;
    e.style.left = x + 'px'; e.style.top = y + 'px'; fx.appendChild(e);
    setTimeout(function () { e.remove(); }, 1300);
  }

  function pname(who) { if (online) return who === online.side ? (G.nick() || T('Você')) : (online.nick || T('Seu amigo')); return sofa ? T('Jogador {n}', { n: who + 1 }) : who === 0 ? (G.nick() || T('Você')) : T(BOT_NAMES[botLevel]); }
  function buildPlay() {
    rootEl.innerHTML = '';
    var top = h('div', 'duel-top');
    function pcard(who, name) {
      var c = h('div', 'duel-pc p' + who); c.id = 'duel-p' + who;
      var sw = h('span', 'duel-sw'); sw.setAttribute('aria-hidden', 'true');
      var nm = h('span', 'duel-name', name), sc = h('strong', 'duel-score', '0'); sc.id = 'duel-s' + who;
      var lf = h('small', 'duel-left'); lf.id = 'duel-left' + who;
      c.appendChild(sw); c.appendChild(nm); c.appendChild(sc); c.appendChild(lf);
      return c;
    }
    var me = mySide();
    top.classList.toggle('flip', flipped());
    top.appendChild(pcard(me, pname(me)));
    top.appendChild(h('span', 'duel-vs', 'VS'));
    top.appendChild(pcard(1 - me, pname(1 - me)));
    rootEl.appendChild(top);
    var rt = h('div', 'duel-rtray'); rt.setAttribute('aria-label', T('Peças do rival')); rivalCvs = [];
    rt.appendChild(h('span', 'duel-rlabel', T('Peças do rival')));
    for (var i = 0; i < 3; i++) { var rc = h('canvas'); rivalCvs.push(rc); rt.appendChild(rc); }
    rootEl.appendChild(rt);
    var bw = h('div', 'duel-board'); bcv = h('canvas'); bcv.id = 'duel-board'; bcv.setAttribute('aria-label', T('Tabuleiro compartilhado 8 por 8')); bctx = bcv.getContext('2d');
    var fx = h('div'); fx.id = 'duel-fx'; bw.appendChild(bcv); bw.appendChild(fx); rootEl.appendChild(bw);
    var msg = h('p', 'duel-msg'); msg.id = 'duel-msg'; msg.setAttribute('aria-live', 'polite'); rootEl.appendChild(msg);
    var tray = h('div', 'duel-tray'); trayCvs = [];
    for (var s = 0; s < 3; s++) { var b = h('button', 'duel-slot'); b.type = 'button'; var cv = h('canvas'); b.appendChild(cv); trayCvs.push(cv); tray.appendChild(b); bindSlot(b, s); }
    rootEl.appendChild(tray);
    dragCv = $('#duel-drag'); dctx = dragCv.getContext('2d');
    bindBoard();
    layout();
  }

  /* ---------- jogada do jogador: arrastar (ou tocar na peça e depois no tabuleiro) ---------- */
  function cellAt(clientX, clientY) {
    var r = bcv.getBoundingClientRect();
    return { x: (clientX - r.left - pad) / cell, y: (clientY - r.top - pad) / cell };
  }
  function bestSpot(slot, fx, fy) { // fx, fy = canto de cima/esquerda desejado, em casas (com fração); ímã até ~0,7 casa
    var p = match.trays[hp()][slot]; if (!p) return null;
    var sh = SHAPES[p.s], r0 = Math.round(fy), c0 = Math.round(fx);
    if (Logic.canPlace(match.board, sh, r0, c0)) return { r: r0, c: c0 };
    var best = null, bd = 0.75 * 0.75;
    for (var r = r0 - 1; r <= r0 + 1; r++) for (var c = c0 - 1; c <= c0 + 1; c++) {
      var d = (r - fy) * (r - fy) + (c - fx) * (c - fx);
      if (d < bd && Logic.canPlace(match.board, sh, r, c)) { bd = d; best = { r: r, c: c }; }
    }
    return best;
  }
  function setGhost(slot, spot, fx, fy) {
    var p = match.trays[hp()][slot], sh = SHAPES[p.s];
    if (!spot) { ghost = null; renderBoard(); return; }
    var cells = sh.cells.map(function (q) { return (spot.r + q[0]) * SIZE + spot.c + q[1]; });
    var pl = Logic.previewLines(match.board, sh, spot.r, spot.c), lines = [];
    if (pl) { pl.rows.forEach(function (rr2) { for (var k = 0; k < SIZE; k++) lines.push(rr2 * SIZE + k); }); pl.cols.forEach(function (cc) { for (var k = 0; k < SIZE; k++) lines.push(k * SIZE + cc); }); }
    ghost = { who: hp(), cells: cells, ok: true, lines: lines, spot: spot };
    kick();
  }
  function bindSlot(b, s) {
    b.addEventListener('pointerdown', function (e) {
      if (b.disabled || !humanTurn() || busy) return;
      var p = match.trays[hp()][s]; if (!p) return;
      G.sound.unlock(); G.sound.pick && G.sound.pick();
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
      var sh = SHAPES[p.s];
      drag = { slot: s, id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, w: sh.w * cell, h: sh.h * cell, lift: Math.max(cell * 1.1, 44) };
      dragCv.width = drag.w * dpr(); dragCv.height = drag.h * dpr(); dragCv.style.width = drag.w + 'px'; dragCv.style.height = drag.h + 'px';
      dctx.setTransform(dpr(), 0, 0, dpr(), 0, 0); dctx.clearRect(0, 0, drag.w, drag.h);
      sh.cells.forEach(function (q) { block(dctx, q[1] * cell, q[0] * cell, cell, hp()); });
      moveDrag(e.clientX, e.clientY);
    });
    b.addEventListener('pointermove', function (e) { if (drag && drag.id === e.pointerId) moveDrag(e.clientX, e.clientY); });
    function finish(e, cancel) {
      if (!drag || drag.id !== e.pointerId) return;
      var d = drag; drag = null; dragCv.hidden = true;
      if (!d.moved && !cancel) { selected = selected === s ? -1 : s; ghost = null; drawTrays(); renderBoard(); if (selected >= 0) say(T('Toque no tabuleiro onde quer colocar a peça.')); return; }
      var g = ghost; ghost = null;
      if (!cancel && g && g.spot) humanPlace(s, g.spot.r, g.spot.c);
      else { if (!cancel) { G.sound.invalid && G.sound.invalid(); } drawTrays(); renderBoard(); }
    }
    b.addEventListener('pointerup', function (e) { finish(e, false); });
    b.addEventListener('pointercancel', function (e) { finish(e, true); });
    b.addEventListener('lostpointercapture', function (e) { if (drag && drag.id === e.pointerId) finish(e, true); });
  }
  function moveDrag(x, y) {
    var d = drag; if (!d) return;
    if (Math.abs(x - d.sx) + Math.abs(y - d.sy) > 8) d.moved = true;
    if (!d.moved) return;
    var k = 1.25, px = d.sx + (x - d.sx) * k, py = d.sy + (y - d.sy) * k; // a peça anda um pouco mais que o dedo, como no jogo principal
    var left = Math.max(0, Math.min(window.innerWidth - d.w, px - d.w / 2)), top = Math.max(0, py - d.h - d.lift);
    dragCv.hidden = false; dragCv.style.transform = 'translate(' + left + 'px,' + top + 'px)';
    drawTrays();
    var at = cellAt(left, top);
    var spot = bestSpot(d.slot, at.x, at.y);
    setGhost(d.slot, spot);
  }
  function bindBoard() {
    bcv.addEventListener('pointerdown', function (e) {
      if (selected < 0 || !humanTurn() || busy) return;
      var p = match.trays[hp()][selected]; if (!p) return;
      var sh = SHAPES[p.s], at = cellAt(e.clientX, e.clientY);
      var spot = bestSpot(selected, at.x - sh.w / 2, at.y - sh.h / 2);
      if (spot) { var s = selected; selected = -1; humanPlace(s, spot.r, spot.c); }
      else { G.sound.invalid && G.sound.invalid(); say(T('Não cabe aí. Tente outro lugar.'), 'bad'); }
    });
  }

  /* ---------- aplicar jogadas ---------- */
  function showResult(res) {
    var colors = res.who === 0 ? PAL[0] : PAL[1];
    anims.push({ type: 'pop', cells: res.cells, t0: now(), dur: 180 });
    if (res.lines) {
      var t0 = now() + 60;
      anims.push({ type: 'clear', cells: res.gone.map(function (i) { return { i: i, who: res.ownerBefore[i] }; }), t0: t0, dur: 420 });
      if (anim() === 'full') {
        var parts = [];
        res.gone.forEach(function (i) { for (var q = 0; q < 2; q++) parts.push({ x: pad + (i % SIZE + 0.5) * cell, y: pad + (Math.floor(i / SIZE) + 0.5) * cell,
          vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 220, s: 3 + Math.random() * 4, col: res.ownerBefore[i] === 1 ? PAL[1][1] : PAL[0][1] }); });
        anims.push({ type: 'spark', parts: parts.slice(0, 120), t0: t0, dur: 700 });
      }
      var mid = res.gone[Math.floor(res.gone.length / 2)];
      floatText('+' + G.fmt(res.linePts), mid, res.who ? 'rival' : 'me');
      if (res.steal) setTimeout(function () { floatText(T('Roubou {n}!', { n: res.steal }) + ' +' + res.stealPts, res.gone[0], 'steal'); }, 260);
      if (G.sound.clear) G.sound.clear(res.lines, res.combo, colors[1]);
      if (sofa || online) say(T('{name}: linha! +{p}', { name: pname(res.who), p: G.fmt(res.linePts + res.stealPts) }) + (res.steal ? ' · ' + T('Roubou {n}!', { n: res.steal }) : '') + (res.combo > 0 ? ' · ' + T('Combo ×{n}!', { n: res.combo + 1 }) : ''), 'good');
      else if (res.combo > 0) say(res.who ? T('Combo do rival ×{n}!', { n: res.combo + 1 }) : T('Combo ×{n}!', { n: res.combo + 1 }), res.who ? 'bad' : 'good');
      else if (res.who === 0) say(res.steal ? T('Linha! Você roubou {n} blocos do rival.', { n: res.steal }) : T('Linha! +{p}', { p: G.fmt(res.linePts) }), 'good');
      else say(res.steal ? T('O rival roubou {n} blocos seus.', { n: res.steal }) : T('O rival limpou uma linha.'), 'bad');
      if (res.clearBonus) say(T('Tabuleiro limpo! +{p}', { p: G.fmt(res.clearBonus) }), 'good');
      if (navigator.vibrate && G.settings && G.settings.vibrate && (res.who === 0 || sofa)) try { navigator.vibrate(18); } catch (e) {}
    } else if (G.sound.place) G.sound.place();
    kick();
  }
  function applyMove(who, slot, r, c) {
    var before = match.board.slice(), t0 = now();
    var res = D.apply(match, who, slot, r, c);
    res.ownerBefore = before; res.cells.forEach(function (i) { res.ownerBefore[i] = who; });
    if (online && who === online.side) online.sess.send({ t: 'move', n: moves.length, slot: slot, r: r, c: c, round: online.round });
    moves.push({ who: who, slot: slot, r: r, c: c });
    showResult(res);
    var evs = D.advance(match);
    evs.forEach(function (ev) {
      if (ev.gone && ev.gone.length) anims.push({ type: 'clear', cells: ev.gone.map(function (i) { return { i: i, who: before[i] === -1 ? 0 : before[i] }; }), t0: now() + 500, dur: 500 });
      setTimeout(function () {
        if (sofa || online) say(T('{name} travou! +{p} para {other}.', { name: pname(ev.stuck), other: pname(1 - ev.stuck), p: D.CONFIG.stuckBonus }), online && ev.stuck !== online.side ? 'good' : 'bad');
        else say(ev.stuck === 0 ? T('Você travou! O rival ganhou +{p}. Uma linha sumiu e chegaram peças novas.', { p: D.CONFIG.stuckBonus })
          : T('O rival travou! +{p} para você.', { p: D.CONFIG.stuckBonus }), ev.stuck === 0 ? 'bad' : 'good');
        kick();
      }, 450);
    });
    scoreBox(); drawTrays(); renderBoard();
    if (match.over) { busy = true; recordEnd(); setTimeout(endMatch, 1100); return; }
    if (sofa) { selected = -1; if (lastMsgT < t0) say(T('Vez de {name}!', { name: pname(match.turn) })); drawTrays(); }
    else if (online) { if (lastMsgT < t0) say(match.turn === online.side ? T('Sua vez!') : T('Vez de {name}!', { name: pname(match.turn) })); }
    else if (match.turn === 1) botTurn();
    else if (lastMsgT < t0) say(T('Sua vez!'));
  }
  function humanPlace(slot, r, c) {
    var me = hp();
    if (!humanTurn() || busy || !match.trays[me][slot] || !Logic.canPlace(match.board, SHAPES[match.trays[me][slot].s], r, c)) return;
    selected = -1; ghost = null;
    applyMove(me, slot, r, c);
  }
  function botTurn() {
    busy = true; drawTrays();
    say(T('{name} está pensando…', { name: T(BOT_NAMES[botLevel]) }));
    var wait = 650 + Math.random() * 600;
    setTimeout(function () {
      if (!match || match.over) { busy = false; return; }
      var mv = D.botMove(match, 1, D.botLevelOfDiv(botLevel), rng); // botLevel = divisão do robô (0–9)
      if (!mv) { busy = false; applyAdvanceOnly(); return; }
      var sh = SHAPES[match.trays[1][mv.slot].s];
      ghost = { who: 1, cells: sh.cells.map(function (q) { return (mv.r + q[0]) * SIZE + mv.c + q[1]; }), ok: true, lines: null };
      rivalCvs[mv.slot].classList.add('pick');
      renderBoard();
      setTimeout(function () {
        rivalCvs.forEach(function (cv) { cv.classList.remove('pick'); });
        ghost = null; busy = false;
        if (!match || match.over) return;
        applyMove(1, mv.slot, mv.r, mv.c);
      }, 380);
    }, wait);
  }
  function applyAdvanceOnly() { D.advance(match); scoreBox(); drawTrays(); renderBoard(); if (match.over) endMatch(); else if (match.turn === 1 && !sofa && !online) botTurn(); }

  /* ---------- começo e fim ---------- */
  function start(isRanked, level, twoPlayers) {
    if (!twoPlayers || twoPlayers !== 'online') endOnline();
    sofa = twoPlayers === true; if (sofa || twoPlayers === 'online') isRanked = false;
    ranked = isRanked; botLevel = level; moves = []; anims = []; selected = -1; ghost = null; busy = false;
    var seed = online && online.seed != null ? online.seed : (Date.now() ^ (Math.random() * 1e9)) >>> 0,
      first = online && online.first != null ? online.first : (Math.random() < 0.5 ? 0 : 1);
    rng = Logic.seededRng(seed ^ 0x9e3779b9);
    match = D.newMatch(seed, first);
    match.seed = seed;
    match.handicap = sofa || online ? 0 : D.handicapOfDiv(botLevel); // robôs do topo começam com vantagem (como no xadrez), mostrada na tela
    match.score[1] += match.handicap;
    buildPlay(); scoreBox();
    if (sofa || online) say(online && first !== online.side ? T('{name} começa.', { name: pname(first) }) : online ? T('Você começa! Arraste uma peça para o tabuleiro.') : T('{name} começa! Arraste uma peça para o tabuleiro.', { name: pname(first) }));
    else say((first === 0 ? T('Você começa! Arraste uma peça para o tabuleiro.') : T('O rival começa.')) + (match.handicap ? ' ' + T('O robô começa com +{n} de vantagem.', { n: match.handicap }) : ''));
    if (!D.canMove(match, match.turn)) applyAdvanceOnly();
    else if (match.turn === 1 && !sofa && !online) botTurn();
  }
  /** Grava o resultado NA HORA em que a partida acaba (antes da pausa do resultado), para ninguém escapar de uma derrota saindo. */
  function recordEnd() {
    if (!match || match.rec) return match && match.rec;
    var w = D.winner(match), result = w === -1 ? 0 : w === 0 ? 1 : -1, delta = 0, before = D.divisionOf(rank.elo);
    if (ranked) {
      var old = rank.elo;
      delta = D.eloDelta(result, rank.elo, D.botRatingOfDiv(botLevel), rank.games, match.score[0], match.score[1]);
      rank.elo = Math.max(D.floorFor(rank.topElo), rank.elo + delta); // piso: nunca abaixo da maior divisão já alcançada
      delta = rank.elo - old; rank.games++;
      if (result > 0) { rank.w++; rank.streak++; } else if (result < 0) { rank.l++; rank.streak = 0; } else rank.d++;
      rank.best = Math.max(rank.best, match.score[0]); rank.topElo = Math.max(rank.topElo, rank.elo);
      saveRank(rank);
    }
    match.rec = { w: w, result: result, delta: delta, before: before };
    return match.rec;
  }
  function endMatch() {
    if (!match) { busy = false; return; }
    var rec = recordEnd();
    if (!screen.classList.contains('active')) { busy = false; return; } // saiu da tela na pausa: o resultado já foi gravado
    var w = rec.w, result = rec.result, delta = rec.delta, before = rec.before;
    var after = D.divisionOf(rank.elo);
    if ((result > 0 || sofa || (online && w === online.side)) && G.sound.record) G.sound.record(); else if (result < 0 && G.sound.gameover) G.sound.gameover();
    var ov = h('div', 'duel-over card'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    if (online) { var mineW = w === online.side; ov.appendChild(h('h2', 'duel-result ' + (w === -1 ? 'draw' : mineW ? 'win' : 'lose'), w === -1 ? T('Empate') : mineW ? T('Vitória!') : T('{name} venceu!', { name: pname(w) }))); }
    else if (sofa) ov.appendChild(h('h2', 'duel-result ' + (w === 0 ? 'win' : w === 1 ? 'lose' : 'draw'), w === -1 ? T('Empate') : T('{name} venceu!', { name: pname(w) })));
    else ov.appendChild(h('h2', 'duel-result ' + (result > 0 ? 'win' : result < 0 ? 'lose' : 'draw'), result > 0 ? T('Vitória!') : result < 0 ? T('Derrota') : T('Empate')));
    var resH = ov.querySelector('.duel-result.win');
    if (resH && G.flags.hype && window.MZHype) { // v1.30 (chave das falas): vitória com letras pulando e a voz do apresentador
      var wTxt = resH.textContent; resH.textContent = ''; resH.classList.add('hype', 't4'); resH.appendChild(MZHype.build(document, wTxt, 4));
      if (G.shout) G.shout('vitoria', 'Vitória!'); // v1.31: voz gravada do locutor (ou a do celular)
    }
    var sc = h('div', 'duel-final'), ms = mySide();
    sc.appendChild(h('span', 'me', G.fmt(match.score[ms]))); sc.appendChild(h('small', '', '×')); sc.appendChild(h('span', 'rival', G.fmt(match.score[1 - ms])));
    ov.appendChild(sc);
    var st = h('ul', 'duel-stats');
    [[T('Linhas'), match.lines[0], match.lines[1]], [T('Blocos roubados'), match.stolen[0], match.stolen[1]], [T('Travadas'), match.stuck[0], match.stuck[1]]].forEach(function (row) {
      var li = h('li'), a1 = flipped() ? row[2] : row[1], a2 = flipped() ? row[1] : row[2]; li.appendChild(h('b', '', String(a1))); li.appendChild(h('span', '', row[0])); li.appendChild(h('b', '', String(a2))); st.appendChild(li);
    });
    ov.appendChild(st);
    if (ranked) {
      var rp = h('p', 'duel-rp ' + (delta >= 0 ? 'up' : 'down'), T('Rating {r} ({d})', { r: G.fmt(rank.elo), d: (delta >= 0 ? '+' : '') + delta }));
      ov.appendChild(rp);
      if (after.index !== before.index) ov.appendChild(h('p', 'duel-div-change ' + (after.index > before.index ? 'up' : 'down'),
        (after.index > before.index ? T('Subiu para {d}!', { d: T(DIV_NAMES[after.id]) }) : T('Caiu para {d}.', { d: T(DIV_NAMES[after.id]) }))));
      var upEl = ov.querySelector('.duel-div-change.up');
      if (upEl && G.flags.hype && window.MZHype) { var uTxt = upEl.textContent; upEl.textContent = ''; upEl.classList.add('hype', 't3'); upEl.appendChild(MZHype.build(document, uTxt, 3)); } // v1.30: subir de divisão também ganha letras pulando
      ov.appendChild(divBar(after));
    } else ov.appendChild(h('p', 'duel-rp', online ? T('Amistoso online: não vale rating.') : sofa ? T('Duelo no sofá: não vale pontos de ranqueada.') : T('Amistoso: não vale pontos de ranqueada.')));
    var btns = h('div', 'duel-btns');
    var again = h('button', 'btn primary', ranked ? T('Próxima partida') : T('Jogar de novo'));
    again.addEventListener('click', function () {
      G.sound.tap();
      if (online) { again.disabled = true; again.textContent = T('Esperando {name}…', { name: pname(1 - online.side) }); online.againMe = true; online.sess.send({ t: 'again' }); maybeRematch(); return; }
      start(ranked, ranked ? D.divisionOf(rank.elo).index : botLevel, sofa);
    });
    var back = h('button', 'btn', T('Voltar'));
    back.addEventListener('click', function () { G.sound.tap(); endOnline(true); match = null; lobby(); });
    btns.appendChild(again); btns.appendChild(back); ov.appendChild(btns);
    rootEl.appendChild(ov);
    busy = false;
    setTimeout(function () { again.focus(); }, 50);
  }
  function divBar(div) {
    var wrap = h('div', 'duel-divbar');
    var lab = h('div', 'duel-divlab');
    lab.appendChild(h('span', 'duel-divic', DIV_ICON[div.id])); lab.appendChild(h('strong', '', T(DIV_NAMES[div.id])));
    lab.appendChild(h('small', '', T('Rating {r}', { r: G.fmt(rank.elo) })));
    wrap.appendChild(lab);
    var bar = h('div', 'duel-bar'), fill = h('i'); fill.style.width = Math.round(100 * Math.max(0, Math.min(1, div.progress))) + '%'; bar.appendChild(fill); wrap.appendChild(bar);
    var nx = D.CONFIG.divisions[div.index + 1], fl = D.floorFor(rank.topElo);
    wrap.appendChild(h('small', 'duel-next', (nx ? T('Faltam {n} para {d}', { n: G.fmt(Math.max(0, nx.min - rank.elo)), d: T(DIV_NAMES[nx.id]) }) : T('Divisão máxima!')) +
      (fl > 0 ? ' · ' + T('Seu piso: {r}', { r: G.fmt(fl) }) : '')));
    return wrap;
  }

  /* ---------- saguão (antes da partida) ---------- */
  var friendlyLevel = 0, lobbyKind = 'ranked';
  function lobby() {
    match = null; rootEl.innerHTML = '';
    var div = D.divisionOf(rank.elo), lv = div.index;
    /* v1.31 (pedido do dono): Ranqueada e "Jogar com amigos" são partes separadas, cada uma com sua entrada na tela inicial.
       A mesma tela mostra só a parte escolhida (lobbyKind): 'ranked' = ranqueada + treino contra o robô; 'friends' = mesmo celular + online. */
    var panes = { rank: h('div', 'duel-pane'), friends: h('div', 'duel-pane') };
    panes.rank.dataset.pane = 'rank'; panes.friends.dataset.pane = 'friends';
    rootEl.appendChild(panes.rank); rootEl.appendChild(panes.friends);
    function pick(k) { panes.rank.hidden = k !== 'ranked'; panes.friends.hidden = k !== 'friends'; var tt = $('#t-duel'); if (tt) tt.textContent = k === 'friends' ? T('Jogar com amigos') : T('Ranqueada'); }
    var realRoot = rootEl; rootEl = panes.rank; // cada seção abaixo cai na aba certa
    try {
    var hero = h('section', 'm-sec duel-hero');
    hero.appendChild(h('h3', '', T('Duelo no mesmo tabuleiro')));
    hero.appendChild(divBar(div));
    var rec = h('p', 'duel-record', T('{w} vitórias · {l} derrotas · {d} empates', { w: rank.w, l: rank.l, d: rank.d }) + (rank.streak > 1 ? ' · 🔥 ' + rank.streak : ''));
    hero.appendChild(rec);
    var opp = h('div', 'duel-opp');
    var oc = h('canvas'); oc.width = 44 * dpr(); oc.height = 44 * dpr(); oc.style.width = '44px'; oc.style.height = '44px';
    var oc2 = oc.getContext('2d'); oc2.setTransform(dpr(), 0, 0, dpr(), 0, 0); block(oc2, 2, 2, 40, 1);
    opp.appendChild(oc);
    var ot = h('span', 'duel-opp-t'); ot.appendChild(h('small', '', T('Seu próximo rival'))); ot.appendChild(h('strong', '', T(BOT_NAMES[lv])));
    ot.appendChild(h('small', '', T('Rating {r}', { r: G.fmt(D.botRatingOfDiv(lv)) }) + (D.handicapOfDiv(lv) ? ' · ' + T('começa com +{n}', { n: D.handicapOfDiv(lv) }) : '')));
    opp.appendChild(ot); hero.appendChild(opp);
    var go = h('button', 'btn primary big duel-go', T('Procurar partida'));
    go.addEventListener('click', function () {
      G.sound.unlock(); G.sound.tap();
      go.disabled = true; go.textContent = T('Procurando rival…');
      setTimeout(function () { start(true, D.divisionOf(rank.elo).index); }, anim() === 'off' ? 0 : 900);
    });
    hero.appendChild(go);
    rootEl.appendChild(hero);

    var how = h('details', 'm-sec duel-how'); // v1.30 (dono: menos poluição): regras recolhidas, abrem ao tocar
    how.appendChild(h('summary', '', T('Como funciona')));
    var ul = h('ul');
    [T('Vocês dois jogam no mesmo tabuleiro, um de cada vez. Seus blocos são dourados; os do rival, azuis com um losango.'),
     T('Os dois recebem as mesmas peças, na mesma ordem. Você vê as peças do rival.'),
     T('Completou uma linha? Os pontos são seus — e cada bloco do rival na linha vale +{n} (roubo).', { n: D.CONFIG.steal }),
     T('Travou? Você passa a vez e o rival ganha +{n}. Dá para travar o rival de propósito.', { n: D.CONFIG.stuckBonus }),
     T('Cada um joga {n} vezes. Ganha quem tiver mais pontos.', { n: D.CONFIG.turns })].forEach(function (t) { ul.appendChild(h('li', '', t)); });
    how.appendChild(ul);
    rootEl.appendChild(how);

    rootEl = panes.rank; // treino contra o robô fica na Ranqueada
    var fr = h('section', 'm-sec duel-friendly');
    fr.appendChild(h('h3', '', T('Contra o robô (treino)')));
    fr.appendChild(h('p', 'm-note', T('Escolha o robô. Não vale pontos de ranqueada.')));
    var seg = h('div', 'duel-levels'); seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', T('Nível do robô'));
    BOT_NAMES.forEach(function (n, i) {
      var b = h('button', 'duel-lv' + (i === friendlyLevel ? ' on' : ''), T(DIV_NAMES[D.CONFIG.divisions[i].id]));
      b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', i === friendlyLevel ? 'true' : 'false');
      b.addEventListener('click', function () { friendlyLevel = i; G.sound.tap(); Array.prototype.forEach.call(seg.children, function (x, k) { x.classList.toggle('on', k === i); x.setAttribute('aria-checked', k === i ? 'true' : 'false'); }); });
      seg.appendChild(b);
    });
    fr.appendChild(seg);
    var fb = h('button', 'btn', T('Jogar amistoso'));
    fb.addEventListener('click', function () { G.sound.unlock(); G.sound.tap(); start(false, friendlyLevel); });
    fr.appendChild(fb);
    rootEl.appendChild(fr);

    rootEl = panes.friends;
    var so = h('section', 'm-sec duel-sofa');
    so.appendChild(h('h3', '', '📱 ' + T('No mesmo celular')));
    so.appendChild(h('p', 'm-note', T('Duas pessoas no mesmo celular: jogue a sua vez e passe o aparelho. Não vale pontos de ranqueada.')));
    var sb = h('button', 'btn', T('Jogar com um amigo'));
    sb.addEventListener('click', function () { G.sound.unlock(); G.sound.tap(); start(false, 0, true); });
    so.appendChild(sb);
    rootEl.appendChild(so);

    var on = h('section', 'm-sec duel-online');
    on.appendChild(h('h3', '', '🌐 ' + T('Online: cada um no seu celular')));
    on.appendChild(h('p', 'm-note', window.MZNet && MZNet.available() ? T('Cada um no seu celular, no mesmo tabuleiro. Funciona melhor com os dois na mesma Wi-Fi. Não vale rating.') : T('Este navegador não consegue fazer partida online.')));
    if (window.MZNet && MZNet.available()) {
      var row = h('div', 'duel-online-btns');
      var bc = h('button', 'btn primary', T('Criar partida')), bj = h('button', 'btn', T('Entrar na partida'));
      bc.addEventListener('click', function () { G.sound.unlock(); G.sound.tap(); onlineCreate(); });
      bj.addEventListener('click', function () { G.sound.unlock(); G.sound.tap(); onlineJoin(''); });
      row.appendChild(bc); row.appendChild(bj); on.appendChild(row);
    }
    rootEl.appendChild(on);
    } finally { rootEl = realRoot; } // mesmo se algo falhar, o resto do jogo volta a desenhar na tela certa
    if (lobbyKind === 'ranked') rootEl.appendChild(h('p', 'duel-lab', T('Laboratório: a Ranqueada é contra robôs. Para jogar contra pessoas, use "Jogar com amigos" na tela inicial.')));
    pick(lobbyKind);
  }

  /* ---------- Amistoso online: ligar os dois celulares ---------- */
  var pending = null; // conexão sendo montada (antes de abrir)
  function cancelPending() { if (pending && pending.cancel) try { pending.cancel(); } catch (e) {} pending = null; }
  function endOnline(sendBye) {
    cancelPending();
    if (!online) return;
    var o = online; online = null;
    if (sendBye) o.sess.send({ t: 'bye' });
    o.sess.onclose = null; o.sess.onmessage = null; o.sess.close('bye');
  }
  function errText(e) {
    var m = e && e.message;
    return m === 'need-offer' ? T('Isso é uma resposta. Cole o CONVITE que seu amigo mandou.') : m === 'need-answer' ? T('Isso é um convite. Cole a RESPOSTA que seu amigo mandou.') :
      m === 'full' ? T('Essa sala já tem dois jogadores.') : m === 'noroom' ? T('Sala não encontrada. Confira o código.') : m === 'net' ? T('Sem conexão com o servidor.') :
      m === 'nortc' ? T('Este navegador não consegue fazer partida online.') : T('Código inválido. Copie de novo a mensagem inteira.');
  }
  function shareText(text) {
    var msg = T('Bora jogar Kablox comigo? Abra o jogo → Ranqueada → Online → Entrar na partida e cole este código:') + '\n' + text;
    if (navigator.share) { navigator.share({ text: msg }).catch(function () {}); return; }
    copyText(text);
  }
  function copyText(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { G.toast(T('Copiado!'), ''); }, function () { G.toast(T('Selecione e copie o código'), ''); }); return; } } catch (e) {}
    G.toast(T('Selecione e copie o código'), '');
  }
  function codeBox(text, label) {
    var w = h('div', 'duel-code'), ta = h('textarea'); ta.readOnly = true; ta.rows = 3; ta.value = text; ta.setAttribute('aria-label', label);
    ta.addEventListener('focus', function () { ta.select(); });
    var b = h('div', 'duel-code-btns'), sh = h('button', 'btn primary', T('Enviar pelo WhatsApp / outro app')), cp = h('button', 'btn', T('Copiar'));
    sh.addEventListener('click', function () { G.sound.tap(); shareText(text); }); cp.addEventListener('click', function () { G.sound.tap(); copyText(text); });
    b.appendChild(sh); b.appendChild(cp); w.appendChild(ta); w.appendChild(b); return w;
  }
  function pasteBox(label, btnLabel, onGo) {
    var w = h('div', 'duel-code'), ta = h('textarea'); ta.rows = 3; ta.maxLength = MZNet.LIMITS.MAX_CODE; ta.setAttribute('aria-label', label); ta.placeholder = T('Cole aqui');
    ta.autocapitalize = 'off'; ta.spellcheck = false; ta.setAttribute('autocomplete', 'off');
    var b = h('button', 'btn primary', btnLabel);
    b.addEventListener('click', function () { G.sound.tap(); onGo(ta.value, b); });
    w.appendChild(ta); w.appendChild(b); return w;
  }
  function onlinePanel(title) {
    endOnline(true); cancelPending(); match = null; rootEl.innerHTML = '';
    var sec = h('section', 'm-sec duel-connect'); sec.appendChild(h('h3', '', title)); rootEl.appendChild(sec);
    var st = h('p', 'duel-status'); st.setAttribute('aria-live', 'polite');
    var back = h('button', 'btn ghost-dark', T('Cancelar'));
    back.addEventListener('click', function () { G.sound.tap(); cancelPending(); endOnline(true); lobby(); });
    return { sec: sec, status: function (t, cls) { st.textContent = t; st.className = 'duel-status' + (cls ? ' ' + cls : ''); }, done: function () { sec.appendChild(st); sec.appendChild(back); } };
  }
  function onlineCreate() {
    var P = onlinePanel(T('Criar partida online'));
    if (MZNet.relayOn()) { // código curto pelo servidor
      var room = MZNet.newRoomCode();
      P.sec.appendChild(h('p', 'm-note', T('Mande este código para o seu amigo:')));
      P.sec.appendChild(h('p', 'duel-room', room.slice(0, 3) + ' ' + room.slice(3)));
      P.sec.appendChild(codeBox(room, T('Código da sala')));
      P.done(); P.status(T('Esperando seu amigo entrar…'));
      MZNet.relay(room, 'host').then(function (r) { pending = { cancel: function () { r.session.close('cancel'); } }; bind(r.session, 0, P); }, function (e) { P.status(errText(e) + ' ' + T('Tente o convite direto abaixo.'), 'bad'); directCreate(P); });
      return;
    }
    directCreate(P);
  }
  function directCreate(P) {
    P.sec.appendChild(h('p', 'm-note', T('1. Mande o convite para o seu amigo.')));
    var holder = h('div'); holder.appendChild(h('p', 'duel-status', T('Criando convite…'))); P.sec.appendChild(holder);
    P.done();
    MZNet.hostDirect().then(function (x) {
      pending = x; holder.innerHTML = '';
      holder.appendChild(codeBox(x.code, T('Convite')));
      holder.appendChild(h('p', 'm-note', T('2. Cole aqui a resposta que ele mandar:')));
      holder.appendChild(pasteBox(T('Resposta do amigo'), T('Conectar'), function (txt, b) {
        b.disabled = true; P.status(T('Conectando…'));
        x.accept(txt).then(function () { setTimeout(function () { if (!online) { b.disabled = false; P.status(T('Não conectou. Confiram se os dois estão com internet (de preferência na mesma Wi-Fi) e tentem de novo.'), 'bad'); } }, 15000); },
          function (e) { b.disabled = false; P.status(errText(e), 'bad'); });
      }));
      bind(x.session, 0, P);
    }, function (e) { holder.innerHTML = ''; P.status(errText(e), 'bad'); });
  }
  function onlineJoin(prefill) {
    var P = onlinePanel(T('Entrar na partida online'));
    if (MZNet.relayOn()) {
      P.sec.appendChild(h('p', 'm-note', T('Tem um código de 6 letras? Digite aqui:')));
      var inp = h('input', 'duel-room-in'); inp.maxLength = 8; inp.autocapitalize = 'characters'; inp.setAttribute('autocomplete', 'off'); inp.setAttribute('aria-label', T('Código da sala'));
      var go = h('button', 'btn primary', T('Entrar'));
      go.addEventListener('click', function () {
        var c = MZNet.cleanRoomCode(inp.value); if (!c) { P.status(T('O código tem 6 letras e números.'), 'bad'); return; }
        go.disabled = true; P.status(T('Entrando…'));
        MZNet.relay(c, 'guest').then(function (r) { bind(r.session, 1, P); }, function (e) { go.disabled = false; P.status(errText(e), 'bad'); });
      });
      P.sec.appendChild(inp); P.sec.appendChild(go);
      P.sec.appendChild(h('p', 'm-note', T('Ou, se ele mandou um convite longo:')));
    }
    P.sec.appendChild(h('p', 'm-note', T('1. Cole o convite que seu amigo mandou:')));
    var holder = h('div');
    var pb = pasteBox(T('Convite do amigo'), T('Continuar'), function (txt, b) {
      b.disabled = true; P.status(T('Lendo o convite…'));
      MZNet.joinDirect(txt).then(function (x) {
        pending = x; holder.innerHTML = '';
        holder.appendChild(h('p', 'm-note', T('2. Mande esta resposta para ele:')));
        holder.appendChild(codeBox(x.code, T('Resposta')));
        P.status(T('Esperando ele colar a resposta…'));
        bind(x.session, 1, P);
      }, function (e) { b.disabled = false; P.status(errText(e), 'bad'); });
    });
    if (prefill) pb.querySelector('textarea').value = prefill;
    holder.appendChild(pb); P.sec.appendChild(holder); P.done();
  }
  /** Conversa entre os celulares depois de ligados. side 0 = quem criou (sorteia as peças), 1 = quem entrou. */
  function bind(sess, side, P) {
    sess.onopen = function () {
      pending = null;
      online = { sess: sess, side: side, nick: '', round: 0, againMe: false, againThem: false, seed: null, first: null };
      P.status(T('Conectado! Começando…'), 'good');
      sess.send({ t: 'hello', v: 1, nick: G.nick() || '' });
    };
    if (sess.open) sess.onopen();
    sess.onmessage = function (m) {
      if (!online || online.sess !== sess) return;
      if (m.t === 'hello') { online.nick = m.nick; if (side === 0 && !match) newRound(); return; }
      if (m.t === 'start') { if (side !== 1 || m.round <= online.round) return; online.round = m.round; online.seed = m.seed; online.first = m.first; online.againMe = online.againThem = false; start(false, 0, 'online'); return; }
      if (m.t === 'move') { remoteMove(m); return; }
      if (m.t === 'again') { online.againThem = true; if (match && match.over) say(T('{name} quer jogar de novo!', { name: pname(1 - side) }), 'good'); maybeRematch(); return; }
      if (m.t === 'bye') { lostLink(T('{name} saiu da partida.', { name: pname(1 - side) })); }
    };
    sess.onclose = function (why) {
      if (!online || online.sess !== sess) { if (P) P.status(T('A conexão fechou. Tente de novo.'), 'bad'); return; }
      lostLink(why === 'flood' || why === 'bad' ? T('A conexão foi cortada: o outro celular mandou dados estranhos.') : T('A conexão com {name} caiu.', { name: pname(1 - side) }));
    };
  }
  function newRound() { // só quem criou sorteia; o outro recebe a mesma semente
    online.round++; online.seed = (crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0; online.first = crypto.getRandomValues(new Uint8Array(1))[0] & 1;
    online.againMe = online.againThem = false;
    online.sess.send({ t: 'start', seed: online.seed, first: online.first, round: online.round });
    start(false, 0, 'online');
  }
  function maybeRematch() { if (online && online.side === 0 && online.againMe && online.againThem && match && match.over) newRound(); }
  function remoteMove(m) {
    var other = 1 - online.side;
    // tudo é conferido aqui: rodada certa, número da jogada, vez do outro, peça existe e cabe. Qualquer diferença = partida encerrada.
    if (!match || match.over || m.round !== online.round || m.n !== moves.length || match.turn !== other) { lostLink(T('Os dois celulares ficaram diferentes. Partida encerrada.')); return; }
    var p = match.trays[other][m.slot];
    if (!p || !Logic.canPlace(match.board, SHAPES[p.s], m.r, m.c)) { lostLink(T('O outro celular mandou uma jogada inválida. Partida encerrada.')); return; }
    if (drag) { drag = null; dragCv.hidden = true; ghost = null; }
    applyMove(other, m.slot, m.r, m.c);
  }
  function lostLink(text) {
    var was = online; endOnline(false);
    if (!screen.classList.contains('active')) { if (was) G.toast(T('Amistoso online'), text); return; }
    if (match && !match.over) { match.over = true; busy = true; }
    var ov = h('div', 'duel-over card'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.appendChild(h('h2', 'duel-result draw', T('Fim da conexão'))); ov.appendChild(h('p', 'duel-rp', text));
    var b = h('button', 'btn primary', T('Voltar')); b.addEventListener('click', function () { G.sound.tap(); match = null; busy = false; lobby(); });
    ov.appendChild(b);
    Array.prototype.forEach.call(rootEl.querySelectorAll('.duel-over'), function (x) { x.remove(); });
    rootEl.appendChild(ov); setTimeout(function () { b.focus(); }, 50);
  }

  function open(kind) { lobbyKind = kind === 'friends' ? 'friends' : 'ranked'; rank = loadRank(); lobby(); G.show('duel'); }
  function inMatch() { return !!(match && !match.over); }
  function leave() {
    if (online) { endOnline(true); match = null; lobby(); G.goHome(); return; }
    if (inMatch() && ranked && moves.length >= 2) {
      G.showDialog({ title: T('Sair da partida?'), sub: T('Sair de uma partida ranqueada conta como derrota.'), buttons: [
        { label: T('Continuar jogando'), cls: 'primary', fn: function () { G.closeDialog(); } },
        { label: T('Sair'), cls: 'confirm', fn: function () { G.closeDialog(); forfeit(); } }
      ] });
      return;
    }
    match = null; lobby(); G.goHome();
  }
  function forfeit() {
    var old = rank.elo, lv = D.divisionOf(rank.elo).index;
    rank.elo = Math.max(D.floorFor(rank.topElo), rank.elo + D.eloDelta(-1, rank.elo, D.botRatingOfDiv(lv), rank.games, 0, 0));
    var d = rank.elo - old; rank.l++; rank.games++; rank.streak = 0; saveRank(rank);
    match = null; lobby(); G.goHome(); G.toast(T('Partida abandonada: {d} de rating.', { d: d }));
  }
  $('#duel-back').addEventListener('click', function () { G.sound.tap(); leave(); });
  window.addEventListener('popstate', function () { // voltar do Android no meio da partida: pergunta antes de sair
    if (online && !inMatch()) { endOnline(true); return; }
    if (!inMatch()) return;
    setTimeout(function () { G.show('duel'); leave(); }, 0);
  });
  window.addEventListener('resize', function () { if (match && screen.classList.contains('active')) layout(); });
  var btn = $('#btn-ranked');
  var fbtn = $('#btn-friends'); // v1.31 (pedido do dono): entrada própria para jogar com amigos
  if (fbtn) { fbtn.hidden = false; fbtn.addEventListener('click', function () { G.sound.unlock(); G.sound.tap(); open('friends'); }); }
  if (btn) { btn.hidden = false; var mc = btn.parentNode; if (mc) { mc.classList.remove('three'); mc.classList.add(fbtn ? 'four' : 'three'); } btn.addEventListener('click', function () { G.sound.unlock(); G.sound.tap(); open('ranked'); }); var sub = $('#ranked-sub'); if (sub) sub.textContent = DIV_ICON[D.divisionOf(rank.elo).id] + ' ' + T(DIV_NAMES[D.divisionOf(rank.elo).id]); }
  // link de convite (#duelo=...): abre direto o "Entrar na partida" com o código colado
  try { var hm = location.hash.match(/^#duelo=(KBX1[CR]\.[A-Za-z0-9_.-]{20,12000})$/); if (hm) { history.replaceState(null, '', location.pathname + location.search); setTimeout(function () { open('friends'); onlineJoin(hm[1]); }, 300); } } catch (e) {}
  window.GBDuel = { open: open, get kind() { return lobbyKind; }, get online() { return online; }, onlineCreate: function () { onlineCreate(); }, onlineJoin: function (c) { onlineJoin(c || ''); }, get match() { return match; }, get rank() { return rank; }, place: function (s, r, c) { humanPlace(s, r, c); }, get busy() { return busy; } };
})();
