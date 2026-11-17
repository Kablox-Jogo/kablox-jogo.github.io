/* Kablox — transformações surpresa: decide QUANDO os blocos mudam de visual e PARA QUAL estilo.
 * Só decisões (sem desenho): o jogo (js/app.js) faz a animação. Nunca altera tabuleiro, peças ou pontos.
 * Testável em Node: tests/surprise.test.js
 *
 * v1.20: as mudanças agora são CONQUISTADAS — ver EVENTS/events()/decide() abaixo. Texto antigo (v1.10–v1.19):
 * Como decide:
 *  1) mede a importância da jogada (linhas de uma vez, combo, pontos ganhos, recorde, sequência, tabuleiro limpo);
 *  2) respeita uma pausa mínima desde a última transformação (não acontece em toda jogada);
 *  3) sorteia: quanto mais importante a jogada, maior a chance (tabuleiro limpo: sempre);
 *  4) escolhe o estilo por pesos, sem repetir o atual nem os últimos mostrados; os raros saem menos;
 *  5) decide a duração: algumas jogadas (número variável) ou até o próximo evento especial.
 */
(function (root) {
  'use strict';

  var CONFIG = {
    cooldown: 8,              // v1.18: 18→8 (dono: "não está mudando de blocos"). Jogadas mínimas entre duas transformações (tabuleiro limpo ignora)
    threshold: 2.0,           // v1.18: 3,0→2,0. Importância abaixo disto nunca transforma
    span: 5,                  // importância acima do limite que leva a chance ao máximo
    maxChance: 0.6,           // v1.18: 0,5→0,6. Chance máxima numa jogada comum muito boa
    avoidLast: 2,             // não repete os últimos N estilos mostrados
    rareWeight: 0.3,          // peso dos estilos raros (os comuns pesam 1)
    rareBoostBig: 3,          // raros ficam mais prováveis em jogadas enormes e no tabuleiro limpo
    tempMoves: [20, 45],      // duração temporária: entre 20 e 45 jogadas (sorteado)
    keepChance: 0.25,         // chance de ficar até o próximo evento (jogada muito importante)
    keepChanceClear: 0.6,     // no tabuleiro limpo
    excluded: ['classic', 'theme'] // estilos que nunca entram no sorteio (o "Clássico" é a base)
  };
  var RARE = { energy: 1, rainbow: 1, holo: 1, galaxy: 1, gold: 1 }; // os mais especiais: saem menos

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  /**
   * Importância da jogada (0 = comum). res: resultado de MZLogic.place.
   * ctx: { record: bateu o recorde agora, recent: [linhas por jogada], gained }
   */
  function importance(res, ctx) {
    ctx = ctx || {};
    var I = 0, lines = res.lineCount || 0, combo = res.combo || 0;
    var gained = typeof res.baseGained === 'number' ? res.baseGained : res.gained || 0; // escala antiga (estável)
    if (res.boardClear) I += 10;
    if (lines >= 3) I += 3 + (lines - 3) * 1.5; else if (lines === 2) I += 1.5;
    if (combo >= 6) I += 3; else if (combo >= 4) I += 2; else if (combo === 3) I += 0.8;
    if (gained >= 300) I += 3; else if (gained >= 150) I += 1.5;
    if (res.levelUp) I += 1.5; // subir de nível também conta
    if (ctx.record) I += 3;
    var r = Array.isArray(ctx.recent) ? ctx.recent : [];
    var streak = 0; for (var i = r.length - 1; i >= 0 && r[i] > 0; i--) streak++;
    if (streak >= 5) I += 2.5; else if (streak >= 4) I += 1.5; else if (streak >= 3) I += 0.8; // sequência especial
    return I;
  }

  /** Sorteia um estilo por pesos, evitando o atual, a base e os últimos mostrados. */
  function choose(ids, opts, rng) {
    opts = opts || {}; rng = rng || Math.random;
    var avoid = [opts.current, opts.base].concat((opts.last || []).slice(-CONFIG.avoidLast));
    var pool = ids.filter(function (id) { return CONFIG.excluded.indexOf(id) === -1 && avoid.indexOf(id) === -1; });
    if (!pool.length) pool = ids.filter(function (id) { return CONFIG.excluded.indexOf(id) === -1 && id !== opts.current; });
    var weights = pool.map(function (id) { return RARE[id] ? CONFIG.rareWeight * (opts.big ? CONFIG.rareBoostBig : 1) : 1; });
    var total = weights.reduce(function (a, b) { return a + b; }, 0), x = rng() * total;
    for (var i = 0; i < pool.length; i++) { x -= weights[i]; if (x < 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  /* ---------------- v1.20: EVENTOS conquistados (pedido do dono: "menos mudanças aleatórias, mais mudanças conquistadas") ----
   * A aparência só muda quando o jogador faz algo especial. Sem sorteio de chance por jogada.
   * Calibrado em 01/11/2026 com simulação (120 partidas, robô que busca linhas; mediana 68 jogadas e ~9 mil pontos):
   *  - combo ×8 aparece em ~2/3 das partidas → "extraordinário" só a partir de ×10, no momento em que chega (×10, ×15, ×20…);
   *  - jogada épica: 3+ linhas de uma vez, ou pontos-base da jogada ≥ 330 (~1% das jogadas que limpam);
   *  - marcos de pontos a partir de 25 mil (10 mil sai em metade das partidas). */
  var EVENTS = {
    cooldown: 15,          // jogadas mínimas entre duas mudanças (tabuleiro limpo só exige 4; recorde, 6)
    comboFrom: 10, comboStep: 5,
    bigLines: 3, bigBase: 330,
    milestones: [25000, 50000, 100000, 250000, 500000, 1000000],
    tempMoves: [20, 35]    // sempre temporária: volta ao Clássico depois de 20–35 jogadas
  };
  var EVENT_PRIO = { clear: 5, record: 4, milestone: 3, epic: 2, combo: 1 };
  /** Eventos desta jogada (do mais ao menos importante). ctx: { record (primeira vez que passa o recorde), prevScore, score, prevCombo } */
  function events(res, ctx) {
    ctx = ctx || {}; var out = [], E = EVENTS, combo = res.combo || 0, prevC = ctx.prevCombo || 0;
    if (res.boardClear) out.push({ id: 'clear' });
    if (ctx.record) out.push({ id: 'record' });
    if (typeof ctx.prevScore === 'number' && typeof ctx.score === 'number') {
      E.milestones.forEach(function (m) { if (ctx.prevScore < m && ctx.score >= m) out.push({ id: 'milestone', value: m }); });
    }
    var base = typeof res.baseGained === 'number' ? res.baseGained : 0;
    if ((res.lineCount || 0) >= E.bigLines || base >= E.bigBase) out.push({ id: 'epic' });
    if (combo >= E.comboFrom && combo > prevC && (combo - E.comboFrom) % E.comboStep === 0) out.push({ id: 'combo', value: combo });
    out.sort(function (a, b) { return EVENT_PRIO[b.id] - EVENT_PRIO[a.id]; });
    return out;
  }
  /**
   * Decide se esta jogada transforma os blocos (só em eventos). look: { skin, left, last: [ids], since }.
   * Retorna null ou { skin, left, big, clear, event }.
   */
  function decide(look, res, ctx, ids, rng) {
    rng = rng || Math.random; look = look || {}; ctx = ctx || {};
    var ev = events(res, ctx)[0], since = typeof look.since === 'number' ? look.since : 99;
    if (!ev) return null;
    var need = ev.id === 'clear' ? 4 : ev.id === 'record' ? 6 : EVENTS.cooldown;
    if (since < need) return null;
    var big = ev.id === 'clear' || ev.id === 'record' || ev.id === 'milestone';
    var skin = choose(ids, { current: look.skin || ctx.base, base: ctx.base, last: look.last, big: big }, rng);
    var t = EVENTS.tempMoves, left = t[0] + Math.floor(rng() * (t[1] - t[0] + 1));
    return { skin: skin, left: left, big: big, clear: ev.id === 'clear', event: ev, importance: EVENT_PRIO[ev.id] };
  }

  /** Conta uma jogada. Retorna true quando uma transformação temporária termina (volta ao estilo do jogador). */
  function tick(look) {
    if (!look) return false;
    look.since = (typeof look.since === 'number' ? look.since : 0) + 1;
    if (look.skin && look.left > 0) { look.left--; return look.left === 0; }
    return false;
  }

  /* ---------------- troca do visual inteiro (identidades de js/themes.js) ---------------- */
  var THEME_CONFIG = {
    cooldown: 25,       // jogadas mínimas entre duas trocas de visual
    levelCooldown: 6,   // v1.21: subir de nível troca o visual, se a última troca foi há 6+ jogadas
    threshold: 3.5,     // importância mínima (mais exigente que a troca de blocos, que usa 3,0)
    span: 6,
    maxChance: 0.4,
    clearChance: 0.5,   // tabuleiro limpo: 50% de chance de trocar o visual
    avoidLast: 3        // não repete os 3 últimos visuais
  };
  /**
   * Decide se esta jogada troca o visual do jogo. tl: { since, last: [ids] }; ctx.current: id do visual atual.
   * Retorna null ou { theme, big }.
   */
  function decideTheme(tl, res, ctx, ids, rng) {
    rng = rng || Math.random; tl = tl || {}; ctx = ctx || {};
    var ev = events(res, ctx)[0], since = typeof tl.since === 'number' ? tl.since : 99;
    var avoid0 = [ctx.current].concat((tl.last || []).slice(-THEME_CONFIG.avoidLast));
    // v1.21 ("eras", pedido do dono): subir de nível SEMPRE troca o visual inteiro (fundo, tabuleiro e cores) — é conquista
    if (res.levelUp && (res.level || 0) >= 2 && since >= THEME_CONFIG.levelCooldown) {
      var lp = ids.filter(function (id) { return avoid0.indexOf(id) === -1; });
      if (!lp.length) lp = ids.filter(function (id) { return id !== ctx.current; });
      if (lp.length) return { theme: lp[Math.floor(rng() * lp.length)], big: true, event: { id: 'level', value: res.level } };
    }
    if (!ev || EVENT_PRIO[ev.id] < 3) return null;              // v1.20: visual inteiro só em tabuleiro limpo, recorde ou marco
    if (since < (ev.id === 'clear' ? 4 : THEME_CONFIG.cooldown) || !(rng() < THEME_CONFIG.clearChance)) return null;
    var avoid = [ctx.current].concat((tl.last || []).slice(-THEME_CONFIG.avoidLast));
    var pool = ids.filter(function (id) { return avoid.indexOf(id) === -1; });
    if (!pool.length) pool = ids.filter(function (id) { return id !== ctx.current; });
    return { theme: pool[Math.floor(rng() * pool.length)], big: true, event: ev };
  }
  function tickTheme(tl) { if (tl) tl.since = (typeof tl.since === 'number' ? tl.since : 0) + 1; }

  var api = { CONFIG: CONFIG, THEME_CONFIG: THEME_CONFIG, EVENTS: EVENTS, events: events, RARE: RARE, importance: importance, choose: choose, decide: decide, tick: tick,
    decideTheme: decideTheme, tickTheme: tickTheme };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZSurprise = api;
})(this);
