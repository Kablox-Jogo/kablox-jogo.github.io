/* v1.29 (laboratório, chave `natal`) — regras puras do Natal 2026 (rodam também no node: tests/natal.test.js).
 * - Árvore de Natal: cada linha limpa em dezembro acende uma luz (300 luzes). Acesa inteira = estrela no topo + selo.
 * - Calendário do Advento: portas de 1 a 25/12. Sem castigo: dia perdido abre depois (até 31/12). Nunca abre antes do dia.
 * - Réveillon: fogos em 31/12.
 * Dados em stats.events.natal2026 = { tree: n, treeDone: 1, advent: { '1': 1, ... }, ... } (entra no backup junto com stats). */
(function (root) {
  'use strict';
  var EV = 'natal2026', YEAR = '2026', TREE_LIGHTS = 300, LAST_DOOR = 25, END = '2026-12-31';
  var MILESTONES = [50, 100, 150, 200, 250, 300];
  // Prêmios do Advento: xp = experiência do jogador, helper = +1 ajuda (se as ajudas estiverem ligadas; senão vira XP), chest = XP maior
  var ADVENT = [null,
    { k: 'xp', n: 40 }, { k: 'helper' }, { k: 'xp', n: 50 }, { k: 'helper' }, { k: 'xp', n: 60 },
    { k: 'chest', n: 120 }, { k: 'helper' }, { k: 'xp', n: 60 }, { k: 'helper' }, { k: 'xp', n: 70 },
    { k: 'helper' }, { k: 'xp', n: 70 }, { k: 'chest', n: 150 }, { k: 'helper' }, { k: 'xp', n: 80 },
    { k: 'helper' }, { k: 'xp', n: 80 }, { k: 'helper' }, { k: 'xp', n: 90 }, { k: 'chest', n: 180 },
    { k: 'helper' }, { k: 'xp', n: 90 }, { k: 'helper' }, { k: 'xp', n: 100 }, { k: 'gift', n: 300 }]; // 25: presentão (XP + 3 ajudas + selo)

  function data(s) { s.events = s.events || {}; var d = s.events[EV] = s.events[EV] || { played: 0, seen: {}, pk: 0 }; d.advent = d.advent || {}; d.tree = Math.max(0, Math.floor(+d.tree || 0)); return d; }
  function inDecember(day) { return typeof day === 'string' && day >= YEAR + '-12-01' && day <= END; }
  function dayOfMonth(day) { return +String(day).slice(8, 10); }
  /** Porta `n` pode abrir hoje? Só em dezembro de 2026, nunca antes do próprio dia. Prévia do laboratório (`preview`) abre todas. */
  function canOpen(s, n, day, preview) {
    n = Math.floor(+n); if (!(n >= 1 && n <= LAST_DOOR)) return false;
    if (data(s).advent[n]) return false;
    if (preview) return true;
    return inDecember(day) && dayOfMonth(day) >= n;
  }
  function doorState(s, n, day, preview) { return data(s).advent[n] ? 'open' : canOpen(s, n, day, preview) ? 'ready' : 'locked'; }
  /** Abre a porta e devolve o prêmio (o app entrega o XP/ajudas). null se não pode. */
  function openDoor(s, n, day, preview) {
    n = Math.floor(+n); if (!canOpen(s, n, day, preview)) return null;
    data(s).advent[n] = day || 1;
    var r = ADVENT[n], out = { day: n, kind: r.k, xp: r.n || 0, helpers: r.k === 'helper' ? 1 : r.k === 'gift' ? 3 : 0 };
    if (n === LAST_DOOR) { data(s).adventGift = 1; out.badge = 'Selo Advento 2026'; }
    return out;
  }
  function openedCount(s) { var a = data(s).advent, c = 0; for (var i = 1; i <= LAST_DOOR; i++) if (a[i]) c++; return c; }
  function readyCount(s, day, preview) { var c = 0; for (var i = 1; i <= LAST_DOOR; i++) if (canOpen(s, i, day, preview)) c++; return c; }
  /** Soma linhas na árvore. Devolve { lit, before, milestone (número ou 0), done (acabou de acender tudo) }. */
  function addLines(s, lines) {
    var d = data(s), before = d.tree, add = Math.max(0, Math.min(64, Math.floor(+lines || 0)));
    d.tree = Math.min(TREE_LIGHTS, before + add);
    var ms = 0; MILESTONES.forEach(function (m) { if (before < m && d.tree >= m) ms = m; });
    var done = before < TREE_LIGHTS && d.tree >= TREE_LIGHTS; if (done) d.treeDone = 1;
    return { lit: d.tree, before: before, milestone: ms, done: done };
  }
  function isNewYearsEve(day) { return day === END; }
  /** Posições das luzes na árvore (0..1), sempre as mesmas: fileiras em triângulo, de cima para baixo. */
  // Formato da árvore: três camadas de galhos [topo y, base y, meia-largura na base] (frações do quadro)
  var TREE_LAYERS = [[0.08, 0.36, 0.22], [0.26, 0.6, 0.33], [0.46, 0.9, 0.46]];
  function halfAt(y) { var w = 0; TREE_LAYERS.forEach(function (t) { if (y >= t[0] && y <= t[1]) w = Math.max(w, t[2] * (y - t[0]) / (t[1] - t[0])); }); return w; }
  /** Posições das luzes (0..1), sempre as mesmas, sempre em cima dos galhos: fileiras de cima para baixo. */
  function lightSpots() {
    var pts = [], rows = 26, i = 0, total = 0, widths = [];
    for (var r = 0; r < rows; r++) { var y = 0.16 + 0.71 * (r / (rows - 1)); widths.push([y, halfAt(y) * 0.82]); total += widths[r][1]; }
    widths.forEach(function (wy, r) {
      var n = r === rows - 1 ? TREE_LIGHTS - pts.length : Math.max(1, Math.round(TREE_LIGHTS * wy[1] / total));
      for (var k = 0; k < n && pts.length < TREE_LIGHTS; k++, i++) {
        var t = n === 1 ? 0.5 : k / (n - 1), wob = ((i * 37) % 11) / 11 - 0.5;
        pts.push({ x: 0.5 - wy[1] + 2 * wy[1] * t + wob * wy[1] * 0.04, y: wy[0], c: i % 4 });
      }
    });
    return pts.slice(0, TREE_LIGHTS);
  }
  var api = { EV: EV, TREE_LIGHTS: TREE_LIGHTS, LAST_DOOR: LAST_DOOR, ADVENT: ADVENT, MILESTONES: MILESTONES, data: data, inDecember: inDecember,
    canOpen: canOpen, doorState: doorState, openDoor: openDoor, openedCount: openedCount, readyCount: readyCount, addLines: addLines,
    isNewYearsEve: isNewYearsEve, lightSpots: lightSpots, TREE_LAYERS: TREE_LAYERS, halfAt: halfAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZNatal = api;
})(this);
