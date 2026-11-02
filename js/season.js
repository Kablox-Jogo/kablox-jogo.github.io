/* v1.24 (pedido do dono, patch de quarta): Temporada, medalhas de recorde, nível do jogador (XP) e sequência de dias.
 * Tudo local, sem conta e sem servidor. Funções puras sobre o objeto `stats` (testes: tests/season.test.js).
 * Campos em stats (criados por Progress.newStats e validados por Progress.normalize):
 *   season, legend {classic, daily}, xp, streak {days, last, best, shields, shieldWeek} */
(function (root) {
  'use strict';
  var SEASON = 1;
  var MEDALS = [ // do maior para o menor
    { id: 'diamond', min: 1000000, icon: '💎', name: 'Diamante' },
    { id: 'gold', min: 500000, icon: '🥇', name: 'Ouro' },
    { id: 'silver', min: 200000, icon: '🥈', name: 'Prata' },
    { id: 'bronze', min: 50000, icon: '🥉', name: 'Bronze' },
    { id: 'iron', min: 20000, icon: '⚙️', name: 'Ferro' }, // v1.24 (dono): medalhas mais cedo para animar quem começa
    { id: 'wood', min: 5000, icon: '🪵', name: 'Madeira' }
  ];
  /* v1.24 (dono): BLOCOS RAROS antes dos lendários — liberados ao passar destas marcas pela 1ª vez.
     Só visual (brilham e fazem festa ao serem limpos); aparecem às vezes nas peças do Clássico e do Zen. */
  var RARES = [
    { id: 'r1', min: 10000, name: 'Vidro doce' },
    { id: 'r2', min: 25000, name: 'Brasa' },
    { id: 'r3', min: 50000, name: 'Pérola' },
    { id: 'pk', min: Infinity, name: 'Abóbora', event: true } // prêmio do Desafio da Semana do Terror (Halloween 2026)
  ];
  /** Libera os raros alcançados com `score`. Retorna a lista dos que acabaram de ser liberados. */
  function unlockRares(s, score) {
    s.rares = s.rares || {}; var got = [];
    RARES.forEach(function (r) { if (!r.event && (score || 0) >= r.min && !s.rares[r.id]) { s.rares[r.id] = 1; got.push(r); } });
    return got;
  }
  /** Sorteia (ou não) um raro para uma peça nova. Mais frequente depois de passar a marca na partida. */
  function rollRare(s, scoreNow, rnd) {
    var have = RARES.filter(function (r) { return s.rares && s.rares[r.id]; }); if (!have.length) return null;
    var hot = have.filter(function (r) { return (scoreNow || 0) >= r.min; }), chance = hot.length ? 0.12 : 0.05;
    if (rnd() >= chance) return null;
    var pool = hot.length ? hot : have; return pool[Math.floor(rnd() * pool.length)].id;
  }
  /* v1.24 (dono): baú da primeira partida do dia — prêmio surpresa (XP) */
  function openChest(s, day, rnd) {
    if (s.chestDay === day) return null;
    s.chestDay = day;
    var roll = rnd(), xp = roll < 0.6 ? 60 : roll < 0.9 ? 100 : 200;
    return { xp: xp, big: xp >= 200 };
  }
  function medalFor(score) {
    for (var i = 0; i < MEDALS.length; i++) if ((score || 0) >= MEDALS[i].min) return MEDALS[i];
    return null;
  }
  function nextMedal(score) {
    for (var i = MEDALS.length - 1; i >= 0; i--) if ((score || 0) < MEDALS[i].min) return MEDALS[i];
    return null;
  }

  /** Começa a temporada atual. Quem já tinha recorde guarda o antigo como "lendário" e o placar zera.
   *  Retorna { started: bool, legend: número } — started só é true para quem já jogava (para o aviso). */
  function startSeason(s) {
    if ((s.season || 0) >= SEASON) return { started: false, legend: 0 };
    var old = (s.best && s.best.classic) || 0, oldDaily = (s.daily && s.daily.best) || 0;
    s.legend = s.legend || { classic: 0, daily: 0 };
    s.legend.classic = Math.max(s.legend.classic || 0, old);
    s.legend.daily = Math.max(s.legend.daily || 0, oldDaily);
    if (s.best) s.best.classic = 0;
    if (s.daily) s.daily.best = 0;
    s.season = SEASON;
    return { started: old > 0 || (s.games || 0) > 0, legend: old };
  }

  /* ---------- nível do jogador ---------- */
  var TITLES = [ // a cada 5 níveis um título novo
    [1, 'Iniciante'], [5, 'Aprendiz'], [10, 'Construtor'], [15, 'Explosivo'], [20, 'Mestre dos Blocos'], [30, 'Lenda']
  ];
  function need(level) { return 100 + 40 * (level - 1); } // XP para ir do nível `level` ao próximo
  /** { level, cur (XP dentro do nível), need, title } */
  function levelOf(xp) {
    var lv = 1, rest = Math.max(0, Math.floor(xp || 0));
    while (rest >= need(lv) && lv < 999) { rest -= need(lv); lv++; }
    return { level: lv, cur: rest, need: need(lv), title: titleFor(lv) };
  }
  function titleFor(level) { var t = TITLES[0][1]; TITLES.forEach(function (x) { if (level >= x[0]) t = x[1]; }); return t; }
  function isWeekend(d) { d = d || new Date(); var w = d.getDay(); return w === 0 || w === 6; }
  /** XP de uma partida: um pouco por jogar, mais por linhas e pontos. Fim de semana vale o dobro. */
  function gameXp(g, weekend) {
    var lines = Math.max(0, g.lines || 0), score = Math.max(0, g.score || 0);
    var xp = 10 + Math.min(150, lines * 2) + Math.min(120, Math.floor(Math.sqrt(score) / 5));
    return weekend ? xp * 2 : xp;
  }
  /** Soma XP; devolve { gained, before, after, levelsUp: [níveis novos] } */
  function addXp(s, amount) {
    var before = levelOf(s.xp || 0);
    s.xp = Math.max(0, Math.floor((s.xp || 0) + (amount || 0)));
    var after = levelOf(s.xp), up = [];
    for (var l = before.level + 1; l <= after.level; l++) up.push(l);
    return { gained: amount || 0, before: before, after: after, levelsUp: up };
  }

  /* ---------- sequência de dias ---------- */
  function dayNum(key) { var p = String(key).split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000); }
  function weekKey(key) { return 'w' + Math.floor((dayNum(key) + 3) / 7); } // semanas começando na segunda
  /** Chamado na primeira partida contada do dia. Retorna { changed, days, usedShield, reward (XP do 7º dia), broke } */
  function touchStreak(s, day) {
    var st = s.streak = s.streak || { days: 0, last: '', best: 0, shields: 1, shieldWeek: '' };
    var wk = weekKey(day);
    if (st.shieldWeek !== wk) { st.shields = 1; st.shieldWeek = wk; } // 1 escudo por semana
    if (st.last === day) return { changed: false, days: st.days };
    var gap = st.last ? dayNum(day) - dayNum(st.last) : 99, used = false, broke = false;
    if (st.last && gap < 1) return { changed: false, days: st.days }; // relógio voltou: não pune nem anda para trás
    if (gap === 1) st.days++;
    else if (gap === 2 && st.shields > 0 && st.days > 0) { st.shields--; st.days++; used = true; }
    else { broke = st.days > 1; st.days = 1; }
    st.last = day;
    st.best = Math.max(st.best || 0, st.days);
    var reward = st.days % 7 === 0 ? 150 : 0;
    return { changed: true, days: st.days, usedShield: used, reward: reward, broke: broke };
  }
  /** Sequência que ainda vale hoje (0 se já quebrou e a pessoa ainda não jogou hoje). */
  function streakNow(s, day) {
    var st = s.streak; if (!st || !st.last) return 0;
    var gap = dayNum(day) - dayNum(st.last);
    if (gap <= 1) return st.days;
    if (gap === 2 && (st.shields > 0 || weekKey(day) !== st.shieldWeek)) return st.days; // semana nova já ganhou escudo novo
    return 0;
  }

  var api = { SEASON: SEASON, MEDALS: MEDALS, RARES: RARES, unlockRares: unlockRares, rollRare: rollRare, openChest: openChest, medalFor: medalFor, nextMedal: nextMedal, startSeason: startSeason,
    need: need, levelOf: levelOf, titleFor: titleFor, isWeekend: isWeekend, gameXp: gameXp, addXp: addXp,
    touchStreak: touchStreak, streakNow: streakNow, dayNum: dayNum, weekKey: weekKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZSeason = api;
})(this);
