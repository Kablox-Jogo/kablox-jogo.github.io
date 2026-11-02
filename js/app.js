/* Kablox — interface, desenho, arraste, animações e persistência local */
(function () {
  'use strict';

  var VERSION = '1.24.0';
  var Logic = window.MZLogic, Themes = window.MZThemes, Sound = window.MZSound, Skins = window.MZSkins, Progress = window.MZProgress, Fx = window.MZFx, Surprise = window.MZSurprise, Season = window.MZSeason, Weekly = window.MZWeekly, Events = window.MZEvents;
  var SIZE = Logic.SIZE, SHAPES = Logic.SHAPES, THEMES = Themes.THEMES;
  /* v1.24 (reclamação dos jogadores: "tabuleiro quase transparente, machuca a vista"): contraste mínimo garantido em
     todos os visuais e estilos — tabuleiro × fundo da tela, contorno × casa vazia e bloco × casa vazia. */
  var Vis = (function () {
    function hx(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function toHex(a) { return '#' + a.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
    function lum(h) { return hx(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0); }
    function cr(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
    function mix(a, b, k) { var x = hx(a), y = hx(b); return toHex(x.map(function (v, i) { return v + (y[i] - v) * k; })); }
    /** Afasta `c` de `ref` (para o preto ou o branco, o que estiver mais longe) até ter contraste `min`. */
    function push(c, ref, min) {
      if (!c || c[0] !== '#' || c.length !== 7 || cr(c, ref) >= min) return c;
      var to = lum(c) <= lum(ref) ? '#000000' : '#ffffff', out = c;
      for (var k = 0.06; k <= 1 && cr(out, ref) < min; k += 0.06) out = mix(c, to, k);
      if (cr(out, ref) < min && to === '#ffffff') { to = '#000000'; for (k = 0.06; k <= 1 && cr(out, ref) < min; k += 0.06) out = mix(c, to, k); }
      return out;
    }
    function fix(th, bgA, bgB) {
      var bgm = mix(bgA, bgB, 0.5);
      th.board = push(th.board, bgm, 1.7);
      if (th.grid) th.grid = push(th.grid, bgm, 1.5);
      th.emptyEdge = push(th.emptyEdge, th.empty, 1.75);
      if (th.palette) th.palette = th.palette.map(function (c) { return push(c, th.empty, 2.2); });
      return th;
    }
    return { fix: fix, cr: cr, mix: mix };
  })();
  THEMES.forEach(function (th) { if (th.bg && th.board && th.board[0] === '#') Vis.fix(th, th.bg[0], th.bg[1]); });
  var INLINE = !!window.MZ_INLINE; // versão de prévia em arquivo único (sem service worker)
  var I18n = window.MZI18n, T = I18n.t;

  /* ---------------- armazenamento local ---------------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  // migra dados salvos pela versão anterior (Mosaico Zen)
  ['best', 'settings', 'save'].forEach(function (k) {
    try {
      var old = localStorage.getItem('mz.' + k);
      if (old != null && localStorage.getItem('gb.' + k) == null) localStorage.setItem('gb.' + k, old);
      if (old != null) localStorage.removeItem('mz.' + k);
    } catch (e) {}
  });

  var prefersReduced = false;
  try { prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var settings = Object.assign(
    { sound: true, music: true, vibrate: true, symbols: false, sfxVol: 80, musicVol: 40, blocks: 'classic', anim: prefersReduced ? 'reduced' : 'full',
      lang: null, quality: 'high', particles: true, surprise: true, dragSpeed: 1.3, vibStrength: 'normal' },
    store.get('gb.settings', {})
  );
  if (['full', 'reduced', 'off'].indexOf(settings.anim) === -1) settings.anim = 'full';
  settings.blocks = 'classic'; // v1.18 (pedido do dono): não há escolha de estilo — toda partida começa no Clássico e os blocos mudam sozinhos
  if (settings.lang !== 'en' && settings.lang !== 'pt') settings.lang = null; // null = idioma do aparelho
  if (['high', 'medium', 'low'].indexOf(settings.quality) === -1) settings.quality = 'high';
  if (['light', 'normal', 'strong'].indexOf(settings.vibStrength) === -1) settings.vibStrength = 'normal';
  settings.nick = typeof settings.nick === 'string' ? settings.nick.replace(/[\u0000-\u001f<>&"'`\\]/g, '').slice(0, 16) : ''; // v1.24: apelido do placar da galera
  if (!settings.mv40) { if (Number(settings.musicVol) === 60) settings.musicVol = 40; settings.mv40 = true; } // v1.23: música padrão mais baixa (quem nunca mexeu passa de 60% para 40%)
  settings.particles = settings.particles !== false;
  // v1.20: efeitos especiais em 3 níveis (antes: liga/desliga "Mudanças surpresa" — desligado vira 'off')
  if (['full', 'reduced', 'off'].indexOf(settings.fx) === -1) settings.fx = settings.surprise === false ? 'off' : 'full';
  settings.surprise = settings.fx !== 'off';
  if ([1, 1.3, 1.6].indexOf(Number(settings.dragSpeed)) === -1) settings.dragSpeed = 1.3; else settings.dragSpeed = Number(settings.dragSpeed);
  I18n.setLang(settings.lang || I18n.detect());
  ['sfxVol', 'musicVol'].forEach(function (k) { var v = Number(settings[k]); settings[k] = isFinite(v) ? Math.max(0, Math.min(100, v)) : (k === 'sfxVol' ? 80 : 40); });

  /* ---------------- estado ---------------- */
  var state = null;
  var themeIdx = 0;
  var drag = null;
  var anims = [];
  var rafId = 0;
  var gameOverTimer = 0;
  var locked = false;
  var displayedScore = 0, scoreRaf = 0;
  var L = { size: 0, pad: 0, cell: 0, dpr: 1, trayCell: 0 };
  var sprites = {};

  /* ---------------- DOM ---------------- */
  function $(s) { return document.querySelector(s); }
  var screens = {};
  Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (sc) { screens[sc.id.replace('screen-', '')] = sc; });
  var boardCanvas = $('#board'), bctx = boardCanvas.getContext('2d');
  var boardWrap = $('#board-wrap'), boardBox = $('#board-box'), fx = $('#fx');
  var slots = Array.prototype.slice.call(document.querySelectorAll('.slot'));
  var dragCanvas = $('#drag'), dctx = dragCanvas.getContext('2d');
  var bgLayers = [$('#bg-a'), $('#bg-b')], bgActive = -1;
  var metaTheme = document.querySelector('meta[name="theme-color"]');

  function fmt(n) { return I18n.fmt(n); }
  /** Teto de nitidez conforme a qualidade gráfica escolhida (baixa = mais leve para celulares simples). */
  function dprCap() { return settings.quality === 'low' ? 1 : settings.quality === 'medium' ? 1.5 : 2; }
  /** Partículas só com animações completas e a opção ligada. */
  function partsOn() { Fx.setCap(settings.quality === 'low' ? 100 : 260); return settings.anim === 'full' && settings.particles; }
  // v1.21.3 (relato do dono: "não está vibrando"): pulsos muito curtos (4–16 ms) não chegam a mover o motor de vibração
  // de muitos celulares Android. Cada pulso agora tem no mínimo 25 ms (as pausas do padrão continuam como estão).
  // v1.22 (Entrega 1, pedido do dono): cada momento tem seu "jeito" de vibrar + força leve/normal/forte.
  // No navegador só dá para controlar a DURAÇÃO (não a força do motor): a força escolhida alonga ou encurta os pulsos.
  var VIB = { light: { k: 0.6, min: 18 }, normal: { k: 1, min: 25 }, strong: { k: 1.6, min: 32 } };
  function vibPattern(p) {
    var v = VIB[settings.vibStrength] || VIB.normal;
    var one = function (ms) { return Math.max(v.min, Math.round(ms * v.k)); };
    return Array.isArray(p) ? p.map(function (ms, i) { return i % 2 ? ms : one(ms); }) : one(p);
  }
  function vibrate(p) { if (settings.vibrate && navigator.vibrate) { try { navigator.vibrate(vibPattern(p)); } catch (e) {} } }
  /** Tabela de vibrações combinada com o dono (pulso, pausa, pulso…; pausas em ms). */
  var HAPTIC = {
    pick: 15,                                   // pegar a peça: toquinho
    place: 30,                                  // encaixar: "toc" firme
    invalid: [22, 60, 22],                      // não cabe: "não-não"
    line: 45,                                   // 1 linha: pulso médio
    lines: [30, 40, 45, 40, 65],                // várias linhas: pulsos subindo
    star: [15, 45, 15, 45, 15],                 // estrela: brilho
    bomb: [70, 25, 160],                        // bomba: "BUUM"
    celebrate: [40, 60, 40, 60, 40, 60, 140],   // recorde / tabuleiro limpo
    gameover: [220, 70, 120],                   // fim de jogo: longa e caindo
    reward: [20, 40, 20]                        // desafio vencido, visual novo
  };
  function comboPattern(n) { // combo: pulsos que aceleram conforme o combo cresce
    var out = [], k = Math.min(6, Math.max(2, n)), gap = Math.max(25, 90 - n * 8);
    for (var i = 0; i < k; i++) { if (i) out.push(Math.max(20, gap - i * 8)); out.push(30 + i * 6); }
    return out;
  }
  function haptic(name, arg) { vibrate(name === 'combo' ? comboPattern(arg) : HAPTIC[name]); }

  /* ---------------- sprites dos blocos (cache) ---------------- */
  /** Estilo que aparece agora: o da transformação surpresa (se houver) ou o escolhido pelo jogador. */
  /** v1.16 (pedido do dono): estilo escolhido = fixo. Transformações temporárias só acontecem no estilo original (Clássico). */
  function tempSkin() {
    var lk = state && state.look;
    return lk && lk.skin && settings.surprise && settings.blocks === 'classic' && Skins.ids.indexOf(lk.skin) !== -1 ? lk.skin : null;
  }
  function curSkin() { return tempSkin() || settings.blocks; }
  function sprite(theme, color, px, skinOpt) {
    var skin = skinOpt || curSkin(), classic = skin !== 'theme'; // casas vazias quadradas fora do modo "Do tema"
    var key = theme.id + '|' + color + '|' + px + '|' + skin + (settings.symbols ? '|s' : ''), c = sprites[key];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = px;
    var ctx = c.getContext('2d');
    if (color < 0 && classic) { // casa vazia: "encaixe" com contorno claro (v1.22.1: antes a grade preta engolia o contorno)
      var gp = Math.max(1, Math.round(px * 0.035)), rr = px * 0.12, inner = px - 2 * gp;
      Themes.roundRect(ctx, gp, gp, inner, inner, rr); ctx.fillStyle = theme.empty; ctx.fill();
      var sh = ctx.createLinearGradient(0, gp, 0, px - gp); // leve fundo côncavo: mais escuro em cima, claro embaixo
      sh.addColorStop(0, 'rgba(0,0,0,.16)'); sh.addColorStop(0.35, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(255,255,255,.05)');
      ctx.fillStyle = sh; ctx.fill();
      ctx.strokeStyle = theme.emptyEdge || theme.grid; ctx.lineWidth = Math.max(1, px * 0.03); ctx.stroke();
    } else if (color >= 0 && Skins.hasArt(skin)) {
      Skins.drawBlock(ctx, px, skin, theme, color);
    } else if (color >= 0 && classic) {
      Themes.drawBlock(ctx, px, Themes.classic(theme), color);
    } else if (color < 0) {
      var g = px * 0.07;
      Themes.roundRect(ctx, g, g, px - 2 * g, px - 2 * g, px * 0.2);
      ctx.fillStyle = theme.empty; ctx.fill();
      ctx.strokeStyle = theme.emptyEdge; ctx.lineWidth = Math.max(1, px * 0.03); ctx.stroke();
    } else {
      Themes.drawBlock(ctx, px, theme, color);
    }
    if (color >= 0 && settings.symbols) Skins.drawSymbol(ctx, px, color);
    sprites[key] = c;
    return c;
  }

  /* ---------------- layout responsivo ---------------- */
  function layout() {
    if (!screens.game.classList.contains('active')) return;
    if (drag) endDrag(false);
    var w = boardWrap.clientWidth, h = boardWrap.clientHeight;
    var size = Math.max(140, Math.floor(Math.min(w, h, 640)));
    var dpr = Math.min(window.devicePixelRatio || 1, dprCap());
    L.dpr = dpr; L.size = size;
    L.pad = Math.max(4, Math.round(size * 0.022));
    L.cell = (size - 2 * L.pad) / SIZE;
    boardBox.style.width = boardBox.style.height = size + 'px';
    boardCanvas.style.width = boardCanvas.style.height = size + 'px';
    boardCanvas.width = boardCanvas.height = Math.round(size * dpr);
    var sw = slots[0].clientWidth, sh = slots[0].clientHeight;
    L.trayCell = Math.max(8, Math.min(L.cell * 0.6, (sw - 6) / 5, (sh - 6) / 5));
    sprites = {};
    render();
    drawTray(false);
    requestRender();
  }

  var resizeT = 0;
  function onResize() { clearTimeout(resizeT); resizeT = setTimeout(layout, 60); }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

  /* ---------------- desenho do tabuleiro ---------------- */
  function requestRender() { if (!rafId) rafId = requestAnimationFrame(frame); }
  setInterval(function () { // v1.24: um reflexo a cada ~8 s durante a partida (só em Efeitos Completos)
    if (document.hidden || !state || !screenIs('game') || settings.anim !== 'full' || settings.quality === 'low' || drag || locked) return;
    if (!state.board.some(function (v) { return v >= 0; })) return;
    anims.push({ type: 'glint', start: animNow(), dur: 1100 }); requestRender();
  }, 8000);
  /* v1.24: câmera lenta — relógio das animações que pode andar mais devagar por um instante (jogada épica) */
  var clock = { off: 0, last: 0, from: 0, until: 0, k: 1 };
  function animNow(real) {
    real = real || performance.now();
    if (clock.last && clock.until > clock.last) {
      var a = Math.max(clock.last, clock.from), b = Math.min(real, clock.until);
      if (b > a) clock.off += (b - a) * (1 - clock.k);
    }
    clock.last = real;
    return real - clock.off;
  }
  function slowMo(ms, k, delay) { var t0 = performance.now(); animNow(t0); clock.from = t0 + (delay || 0); clock.until = clock.from + ms; clock.k = k; }
  function onFire() { return !!state && state.combo >= 10 && settings.anim === 'full' && settings.quality !== 'low' && state.mode !== 'tutorial' && !document.hidden && screenIs('game'); }
  var FACES = { jelly: 1, fur: 1, candy: 1, bubble: 1, cheese: 1 }; // v1.24: estilos com "carinha"
  function facesOn() { return !!state && !!FACES[curSkin()] && settings.anim === 'full' && settings.quality !== 'low' && !document.hidden && screenIs('game'); }
  var lastLive = 0;
  // v1.23 (otimização, pedido do dono): se o celular engasga nas animações, passa sozinho para "Efeitos: Leves" (uma vez, com aviso)
  var perf = { last: 0, samples: [], done: false };
  function watchPerf(t) {
    if (perf.done || settings.autoLight || presetOf() !== 'full' || document.hidden) return;
    if (perf.last && t - perf.last < 250) perf.samples.push(t - perf.last); // só quadros seguidos de animação
    perf.last = t;
    if (perf.samples.length < 90) return; // ~4 s de animação engasgada
    var a = perf.samples.slice().sort(function (x, y) { return x - y; }), med = a[Math.floor(a.length / 2)];
    perf.samples = [];
    if (med > 45) { // abaixo de ~22 quadros por segundo de forma constante
      perf.done = true; settings.autoLight = true; applyPreset('light');
      toast(T('Efeitos mais leves'), T('O celular estava engasgando, então deixamos os efeitos mais leves. Dá para mudar em Configurações → Visual.'));
    }
  }
  function frame(t) {
    rafId = 0;
    if (anims.length || drag) watchPerf(t); else perf.last = 0;
    var real = t; t = animNow(real);
    // só o movimento contínuo (sem animação nem arraste): até ~30 quadros por segundo
    if (!anims.length && !drag && (live() || onFire() || facesOn()) && real - lastLive < 30) { requestRender(); return; }
    lastLive = real;
    anims = anims.filter(function (a) { return t - a.start < a.dur; });
    render(t);
    if (anims.length || glowing() || live() || onFire() || facesOn() || (tutTarget && settings.anim !== 'off')) requestRender();
  }

  // estilos com movimento contínuo (pelos, gelatina): só com animações completas e o jogo visível
  function live() {
    return Skins.isLive(curSkin()) && settings.anim === 'full' && !document.hidden &&
      screens.game.classList.contains('active') && !!state;
  }

  function glowing() {
    return settings.anim !== 'off' && drag && drag.valid && drag.preview &&
      (drag.preview.rows.length + drag.preview.cols.length) > 0;
  }

  function activeSweep(now) {
    for (var i = 0; i < anims.length; i++) if (anims[i].type === 'sweep') {
      var a = anims[i];
      return { from: a.from, to: a.to, p: Math.min(1, Math.max(0, (now - a.start) / a.dur)) };
    }
    return null;
  }

  function render(now) {
    if (!state || !L.size) return;
    now = now || animNow();
    var ctx = bctx, cell = L.cell, pad = L.pad, px = Math.max(1, Math.round(cell * L.dpr));
    var th = boardTheme(), sw = activeSweep(now);
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.clearRect(0, 0, L.size, L.size);

    var radius = Math.min(18, L.size * 0.045);
    Themes.roundRect(ctx, 0, 0, L.size, L.size, radius);
    ctx.fillStyle = sw ? sw.from.board : th.board; ctx.fill();
    if (sw) { ctx.globalAlpha = sw.p; ctx.fillStyle = sw.to.board; ctx.fill(); ctx.globalAlpha = 1; }

    var prev = drag && drag.valid ? drag : null;
    var liveNow = live(), vary = !!Skins.VARY[curSkin()];
    var clearRows = {}, clearCols = {};
    if (prev && prev.preview) {
      prev.preview.rows.forEach(function (r) { clearRows[r] = 1; });
      prev.preview.cols.forEach(function (c) { clearCols[c] = 1; });
    }

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cth = th;
        if (sw) cth = ((r + c) / (2 * (SIZE - 1))) <= sw.p ? sw.to : sw.from;
        var x = pad + c * cell, y = pad + r * cell, v = state.board[r * SIZE + c];
        if (v < 0) ctx.drawImage(sprite(cth, -1, px), x, y, cell, cell);
        else {
          var color = (prev && (clearRows[r] || clearCols[c])) ? prev.piece.c : v;
          if (liveNow) Skins.drawLive(ctx, sprite(cth, color, px), curSkin(), cth, color, x, y, cell, now, r * 7 + c * 3);
          else if (vary) drawVaried(ctx, sprite(cth, color, px), x, y, cell, (r * 5 + c * 3) % 4);
          else ctx.drawImage(sprite(cth, color, px), x, y, cell, cell);
        }
      }
    }

    if (state.gems && state.gems.length) state.gems.forEach(function (i) { // v1.17: gemas presas nos blocos
      if (state.board[i] >= 0) ctx.drawImage(gemSprite(px), pad + (i % SIZE) * cell, pad + Math.floor(i / SIZE) * cell, cell, cell);
    });

    if (state.rare) for (var rk in state.rare) { // v1.24: blocos raros no tabuleiro (só visual)
      var ri = +rk; if (state.board[ri] < 0) continue;
      var rx = pad + (ri % SIZE) * cell, ry = pad + Math.floor(ri / SIZE) * cell;
      ctx.save(); if (settings.anim === 'full' && state.rare[rk] !== 'pk') ctx.globalAlpha = 0.82 + 0.18 * Math.sin(now / 300 + ri);
      ctx.drawImage(rareSprite(state.rare[rk], px), rx, ry, cell, cell); ctx.restore();
    }
    if (state.spec) for (var sk in state.spec) { // v1.21: blocos especiais no tabuleiro
      var si = +sk; if (state.board[si] >= 0) drawSpecialOn(ctx, state.spec[sk], pad + (si % SIZE) * cell, pad + Math.floor(si / SIZE) * cell, cell, px, now);
    }
    if (prev) {
      ctx.fillStyle = th.highlight;
      prev.preview.rows.forEach(function (r) { ctx.fillRect(pad, pad + r * cell, SIZE * cell, cell); });
      prev.preview.cols.forEach(function (c) { ctx.fillRect(pad + c * cell, pad, cell, SIZE * cell); });
      ctx.globalAlpha = 0.6;
      prev.shape.cells.forEach(function (sc) {
        ctx.drawImage(sprite(th, prev.piece.c, px), pad + (prev.col + sc[1]) * cell, pad + (prev.row + sc[0]) * cell, cell, cell);
      });
      if (prev.piece.sp) { var spc = prev.shape.cells[prev.piece.sp.k]; if (spc) drawSpecialOn(ctx, prev.piece.sp.t, pad + (prev.col + spc[1]) * cell, pad + (prev.row + spc[0]) * cell, cell, px); }
      ctx.globalAlpha = 1;
      if (prev.preview.rows.length + prev.preview.cols.length) { // brilho pulsando nas linhas completas
        var pulse = settings.anim === 'off' ? 1 : 0.65 + 0.35 * Math.sin(now / 140);
        var glowCol = pal(th)[prev.piece.c % th.palette.length];
        ctx.save();
        ctx.shadowColor = glowCol; ctx.shadowBlur = cell * 0.6 * pulse;
        ctx.strokeStyle = glowCol; ctx.globalAlpha = 0.55 + 0.45 * pulse; ctx.lineWidth = Math.max(2, cell * 0.08);
        prev.preview.rows.forEach(function (r) { Themes.roundRect(ctx, pad + 1, pad + r * cell + 1, SIZE * cell - 2, cell - 2, cell * 0.18); ctx.stroke(); });
        prev.preview.cols.forEach(function (c) { Themes.roundRect(ctx, pad + c * cell + 1, pad + 1, cell - 2, SIZE * cell - 2, cell * 0.18); ctx.stroke(); });
        ctx.restore();
        if (settings.anim === 'full') { // v1.24: faixa de luz correndo pelas linhas que vão sumir
          var sp2 = (now % 900) / 900, bandW = cell * 1.6;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          prev.preview.rows.forEach(function (r) {
            var bx2 = pad - bandW + sp2 * (SIZE * cell + bandW), gr2 = ctx.createLinearGradient(bx2, 0, bx2 + bandW, 0);
            gr2.addColorStop(0, 'rgba(255,255,255,0)'); gr2.addColorStop(0.5, 'rgba(255,255,255,.38)'); gr2.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = gr2; ctx.fillRect(Math.max(pad, bx2), pad + r * cell, bandW, cell);
          });
          prev.preview.cols.forEach(function (c) {
            var by2 = pad - bandW + sp2 * (SIZE * cell + bandW), gr3 = ctx.createLinearGradient(0, by2, 0, by2 + bandW);
            gr3.addColorStop(0, 'rgba(255,255,255,0)'); gr3.addColorStop(0.5, 'rgba(255,255,255,.38)'); gr3.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = gr3; ctx.fillRect(pad + c * cell, Math.max(pad, by2), cell, bandW);
          });
          ctx.restore();
        }
      }
      // contorno da área de encaixe
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
      prev.shape.cells.forEach(function (sc) {
        Themes.roundRect(ctx, pad + (prev.col + sc[1]) * cell + 2, pad + (prev.row + sc[0]) * cell + 2, cell - 4, cell - 4, cell * 0.2);
        ctx.stroke();
      });
    }

    if (drag && !drag.valid && (drag.kb || drag.over)) { // posição inválida: contorno vermelho onde a peça cairia
      ctx.strokeStyle = 'rgba(255,110,110,.95)'; ctx.lineWidth = 3;
      drag.shape.cells.forEach(function (sc) {
        var rr = drag.row + sc[0], cc = drag.col + sc[1];
        if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) return;
        Themes.roundRect(ctx, pad + cc * cell + 3, pad + rr * cell + 3, cell - 6, cell - 6, cell * 0.2);
        ctx.stroke();
      });
    }

    if (tutTarget && state.mode === 'tutorial') { // tutorial: área sugerida pulsando
      var tp = settings.anim === 'off' ? 1 : 0.55 + 0.45 * Math.sin(now / 180);
      ctx.save(); ctx.strokeStyle = th.accent; ctx.lineWidth = 3; ctx.globalAlpha = tp;
      ctx.setLineDash([6, 5]);
      tutTarget.forEach(function (rc) { Themes.roundRect(ctx, pad + rc[1] * cell + 3, pad + rc[0] * cell + 3, cell - 6, cell - 6, cell * 0.18); ctx.stroke(); });
      ctx.restore();
    }

    if (facesOn()) drawFaces(ctx, now);
    if (onFire()) drawFire(ctx, now);
    for (var i = 0; i < anims.length; i++) drawAnim(ctx, anims[i], now, px);
  }

  /* v1.24: carinhas nos blocos (Gelatina, Pelúcia, Doce, Bolha, Queijo) — piscam e olham para a peça que você arrasta */
  function drawFaces(ctx, now) {
    var cell = L.cell, pad = L.pad, look = null;
    if (drag && drag.row > -50) look = { x: pad + (drag.col + drag.shape.w / 2) * cell, y: pad + (drag.row + drag.shape.h / 2) * cell };
    ctx.save();
    for (var i = 0; i < state.board.length; i++) {
      if (state.board[i] < 0 || (state.spec && state.spec[i])) continue;
      var r = Math.floor(i / SIZE), c = i % SIZE, cx = pad + (c + 0.5) * cell, cy = pad + (r + 0.52) * cell;
      var seed = (r * 37 + c * 17) % 97, blink = ((now / 1000 + seed * 0.37) % 4.2) < 0.13;
      var ex = cell * 0.17, ey = -cell * 0.06, er = cell * 0.085, dx = 0, dy = 0;
      if (look) { var vx = look.x - cx, vy = look.y - cy, d = Math.sqrt(vx * vx + vy * vy) || 1; dx = vx / d * er * 0.45; dy = vy / d * er * 0.45; }
      [-1, 1].forEach(function (sgn) {
        var x = cx + sgn * ex, y = cy + ey;
        if (blink) { ctx.strokeStyle = 'rgba(30,20,40,.75)'; ctx.lineWidth = Math.max(1, cell * 0.035); ctx.beginPath(); ctx.moveTo(x - er, y); ctx.lineTo(x + er, y); ctx.stroke(); return; }
        ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.ellipse(x, y, er, er * 1.15, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#231a33'; ctx.beginPath(); ctx.arc(x + dx, y + dy, er * 0.55, 0, 7); ctx.fill();
      });
      ctx.strokeStyle = 'rgba(30,20,40,.6)'; ctx.lineWidth = Math.max(1, cell * 0.03);
      ctx.beginPath(); ctx.arc(cx, cy + cell * 0.08, cell * 0.08, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
    ctx.restore();
  }
  /* v1.24: fogo subindo da borda de baixo do tabuleiro (e brilho quente nas laterais) com combo ×10 ou mais */
  function drawFire(ctx, now) {
    var S = L.size, n = 9, cell = L.cell;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var side = ctx.createLinearGradient(0, 0, cell * 0.6, 0); side.addColorStop(0, 'rgba(255,120,30,.42)'); side.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = side; ctx.fillRect(0, 0, cell * 0.6, S);
    ctx.save(); ctx.translate(S, 0); ctx.scale(-1, 1); ctx.fillRect(0, 0, cell * 0.6, S); ctx.restore();
    for (var k = 0; k < n; k++) {
      for (var layer = 0; layer < 2; layer++) {
        var ph = now / (layer ? 230 : 310) + k * 2.1 + layer * 1.3, rise = (ph % 1 + 1) % 1;
        var x = (k + 0.5) / n * S + Math.sin(ph * 2.3) * cell * 0.15, h = cell * (1.3 + 0.6 * Math.sin(now / 170 + k)), y = S - rise * h;
        var r = cell * (0.75 - 0.45 * rise) * (layer ? 0.7 : 1);
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, layer ? 'rgba(255,235,140,.8)' : 'rgba(255,150,40,.7)'); g.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.globalAlpha = 1 - rise * 0.8; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Gema (arte original do Kablox): losango facetado ciano com brilho — desenhada por cima do bloco. */
  var gemCache = {};
  function gemSprite(px) {
    if (gemCache[px]) return gemCache[px];
    var c = document.createElement('canvas'); c.width = c.height = px; var g = c.getContext('2d'), m = px / 2, r = px * 0.3;
    g.shadowColor = 'rgba(120,240,255,.9)'; g.shadowBlur = px * 0.18;
    g.beginPath(); g.moveTo(m, m - r); g.lineTo(m + r * 0.85, m - r * 0.2); g.lineTo(m, m + r); g.lineTo(m - r * 0.85, m - r * 0.2); g.closePath();
    var gr = g.createLinearGradient(m - r, m - r, m + r, m + r); gr.addColorStop(0, '#e9fdff'); gr.addColorStop(0.45, '#4fe3ff'); gr.addColorStop(1, '#1b6fd6');
    g.fillStyle = gr; g.fill(); g.shadowBlur = 0;
    g.strokeStyle = '#0b1240'; g.lineWidth = Math.max(1, px * 0.045); g.stroke();
    g.beginPath(); g.moveTo(m - r * 0.85, m - r * 0.2); g.lineTo(m + r * 0.85, m - r * 0.2); g.moveTo(m, m - r); g.lineTo(m - r * 0.3, m - r * 0.2); g.lineTo(m, m + r); g.lineTo(m + r * 0.3, m - r * 0.2); g.closePath();
    g.strokeStyle = 'rgba(11,18,64,.35)'; g.lineWidth = Math.max(1, px * 0.025); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(m - r * 0.3, m - r * 0.45, r * 0.18, r * 0.09, -0.6, 0, 7); g.fill();
    return (gemCache[px] = c);
  }
  /** v1.21 — blocos especiais (arte original): Estrela dourada (pontos extras) e Bomba (explode os vizinhos). */
  var specCache = {};
  function specialSprite(kind, px) {
    var key = kind + px; if (specCache[key]) return specCache[key];
    var c = document.createElement('canvas'); c.width = c.height = px; var g = c.getContext('2d'), m = px / 2;
    if (kind === 'star') {
      var R = px * 0.34, r = R * 0.45;
      g.shadowColor = 'rgba(255,215,90,.95)'; g.shadowBlur = px * 0.2;
      g.beginPath();
      for (var k = 0; k < 10; k++) { var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r : R; g.lineTo(m + Math.cos(a) * rr, m + 0.03 * px + Math.sin(a) * rr); }
      g.closePath();
      var gr = g.createLinearGradient(m, m - R, m, m + R); gr.addColorStop(0, '#fff6c2'); gr.addColorStop(0.5, '#ffcf3a'); gr.addColorStop(1, '#e48a00');
      g.fillStyle = gr; g.fill(); g.shadowBlur = 0;
      g.strokeStyle = '#5a2c00'; g.lineWidth = Math.max(1, px * 0.045); g.lineJoin = 'round'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(m - R * 0.22, m - R * 0.25, R * 0.16, R * 0.08, -0.5, 0, 7); g.fill();
    } else {
      var br = px * 0.27, cy = m + px * 0.05;
      g.shadowColor = 'rgba(255,90,60,.8)'; g.shadowBlur = px * 0.16;
      var bg = g.createRadialGradient(m - br * 0.4, cy - br * 0.4, br * 0.1, m, cy, br);
      bg.addColorStop(0, '#6a6f86'); bg.addColorStop(0.6, '#23263a'); bg.addColorStop(1, '#0c0d16');
      g.fillStyle = bg; g.beginPath(); g.arc(m, cy, br, 0, 7); g.fill(); g.shadowBlur = 0;
      g.strokeStyle = '#05060c'; g.lineWidth = Math.max(1, px * 0.04); g.stroke();
      g.fillStyle = '#3b3f55'; g.fillRect(m + br * 0.25, cy - br * 1.12, br * 0.5, br * 0.32); // tampa
      g.strokeStyle = '#d9b26a'; g.lineWidth = Math.max(1, px * 0.035); g.beginPath();
      g.moveTo(m + br * 0.5, cy - br * 1.1); g.quadraticCurveTo(m + br * 0.9, cy - br * 1.6, m + br * 1.15, cy - br * 1.35); g.stroke(); // pavio
      g.fillStyle = '#ffe36a'; g.shadowColor = '#ff7a2a'; g.shadowBlur = px * 0.12;
      g.beginPath(); g.arc(m + br * 1.18, cy - br * 1.38, px * 0.05, 0, 7); g.fill(); g.shadowBlur = 0; // faísca
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(m - br * 0.38, cy - br * 0.4, br * 0.22, br * 0.12, -0.7, 0, 7); g.fill();
    }
    return (specCache[key] = c);
  }
  /* v1.24: arte dos blocos raros (original): Vidro doce (listras de bala), Brasa (rachaduras acesas), Pérola (brilho furta-cor) */
  var rareCache = {};
  function rareSprite(t, px) {
    var key = t + px; if (rareCache[key]) return rareCache[key];
    var c = document.createElement('canvas'); c.width = c.height = px; var g = c.getContext('2d'), m = px / 2, r = px * 0.42;
    g.save(); Themes.roundRect(g, px * 0.08, px * 0.08, px * 0.84, px * 0.84, px * 0.18); g.clip();
    if (t === 'r1') { // Vidro doce
      g.globalAlpha = 0.5; g.fillStyle = '#ffffff';
      for (var i = -3; i < 6; i++) { g.save(); g.translate(m, m); g.rotate(-Math.PI / 4); g.fillRect(-px + i * px * 0.28, -px, px * 0.11, px * 2); g.restore(); }
      g.globalAlpha = 1; var gl = g.createLinearGradient(0, 0, px, px); gl.addColorStop(0, 'rgba(255,255,255,.55)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, px, px);
    } else if (t === 'r2') { // Brasa
      g.fillStyle = 'rgba(30,8,0,.45)'; g.fillRect(0, 0, px, px);
      g.strokeStyle = '#ffb03a'; g.shadowColor = '#ff6a00'; g.shadowBlur = px * 0.15; g.lineWidth = Math.max(1, px * 0.05); g.lineCap = 'round';
      [[0.2, 0.25, 0.45, 0.5, 0.35, 0.8], [0.5, 0.5, 0.75, 0.35, 0.85, 0.15], [0.45, 0.5, 0.65, 0.78]].forEach(function (pts) {
        g.beginPath(); g.moveTo(pts[0] * px, pts[1] * px); for (var k = 2; k < pts.length; k += 2) g.lineTo(pts[k] * px, pts[k + 1] * px); g.stroke(); });
    } else if (t === 'pk') { // Abóbora (Semana do Terror): gomos laranja + rosto aceso
      g.restore(); g.save(); Themes.roundRect(g, px * 0.06, px * 0.06, px * 0.88, px * 0.88, px * 0.2); g.clip();
      var go = g.createRadialGradient(m, m * 0.9, px * 0.05, m, m, px * 0.6); go.addColorStop(0, '#ffb340'); go.addColorStop(1, '#c4520a');
      g.fillStyle = go; g.fillRect(0, 0, px, px);
      g.strokeStyle = 'rgba(120,40,0,.45)'; g.lineWidth = Math.max(1, px * 0.035);
      [0.3, 0.5, 0.7].forEach(function (f) { g.beginPath(); g.ellipse(px * f, m, px * 0.16, px * 0.42, 0, 0, 7); g.stroke(); });
      g.fillStyle = '#ffe680'; g.shadowColor = '#ffcf3a'; g.shadowBlur = px * 0.12;
      g.beginPath(); g.moveTo(px * 0.28, px * 0.42); g.lineTo(px * 0.4, px * 0.42); g.lineTo(px * 0.34, px * 0.3); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(px * 0.6, px * 0.42); g.lineTo(px * 0.72, px * 0.42); g.lineTo(px * 0.66, px * 0.3); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(px * 0.27, px * 0.58); g.lineTo(px * 0.38, px * 0.66); g.lineTo(px * 0.5, px * 0.58); g.lineTo(px * 0.62, px * 0.66); g.lineTo(px * 0.73, px * 0.58); g.lineTo(px * 0.62, px * 0.74); g.lineTo(px * 0.38, px * 0.74); g.closePath(); g.fill();
      g.shadowBlur = 0; g.fillStyle = '#3d7a1e'; g.fillRect(m - px * 0.04, px * 0.04, px * 0.08, px * 0.12);
    } else { // Pérola
      var gp = g.createLinearGradient(0, px, px, 0); gp.addColorStop(0, 'rgba(255,150,220,.55)'); gp.addColorStop(0.35, 'rgba(255,255,255,.35)'); gp.addColorStop(0.65, 'rgba(120,230,255,.5)'); gp.addColorStop(1, 'rgba(200,170,255,.55)');
      g.fillStyle = gp; g.fillRect(0, 0, px, px);
      var gr = g.createRadialGradient(m - r * 0.2, m - r * 0.25, 0, m, m, r * 0.55); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#f2ecff'); gr.addColorStop(1, 'rgba(220,210,255,.0)');
      g.fillStyle = gr; g.beginPath(); g.arc(m, m, r * 0.5, 0, 7); g.fill();
    }
    g.restore();
    g.strokeStyle = t === 'r2' || t === 'pk' ? 'rgba(255,170,60,.9)' : 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(1, px * 0.04);
    Themes.roundRect(g, px * 0.1, px * 0.1, px * 0.8, px * 0.8, px * 0.17); g.stroke();
    return (rareCache[key] = c);
  }
  function rareName(t) { var r = Season.RARES.filter(function (x) { return x.id === t; })[0]; return r ? T(r.name) : ''; }
  function rareModes() { return state && (state.mode === 'classic' || state.mode === 'zen' || state.mode === 'event'); }
  function tagRares() { // peças novas podem vir com 1 quadradinho raro
    if (!rareModes()) return;
    state.pieces.forEach(function (p) {
      if (!p || p.rq) return; p.rq = 1;
      var ev = eventNow(), t = null;
      if (ev && Math.random() < (state.mode === 'event' ? ev.goalChance : ev.chance)) t = ev.rare; // v1.24: abóboras da Semana do Terror
      else t = Season.rollRare(stats, state.score, Math.random);
      if (t) p.rk = { k: Math.floor(Math.random() * SHAPES[p.s].cells.length), t: t };
    });
  }
  function drawSpecialOn(ctx, kind, x, y, cell, px, now) {
    var s = cell, img = specialSprite(kind, px);
    if (now && settings.anim === 'full') s = cell * (1 + 0.06 * Math.sin(now / (kind === 'bomb' ? 120 : 260))); // leve pulsar
    ctx.drawImage(img, x + (cell - s) / 2, y + (cell - s) / 2, s, s);
  }
  /** Bloco espelhado (0: normal, 1: horizontal, 2: vertical, 3: os dois) — só aparência, a casa é a mesma. */
  function drawVaried(ctx, img, x, y, cell, k) {
    if (!k) { ctx.drawImage(img, x, y, cell, cell); return; }
    ctx.save(); ctx.translate(x + cell / 2, y + cell / 2); ctx.scale(k & 1 ? -1 : 1, k & 2 ? -1 : 1);
    ctx.drawImage(img, -cell / 2, -cell / 2, cell, cell); ctx.restore();
  }
  function drawAnim(ctx, a, now, px) {
    if (a.type === 'morph') { drawMorph(ctx, a, now, px); return; }
    if (a.type === 'glint') { // v1.24: reflexo de vidro passando pelos blocos de vez em quando
      var gt = (now - a.start) / a.dur; if (gt < 0 || gt >= 1) return;
      var gc = L.cell, gp = L.pad, S2 = SIZE * gc, pos = -S2 * 0.5 + gt * S2 * 2;
      ctx.save(); ctx.beginPath();
      for (var gi = 0; gi < state.board.length; gi++) if (state.board[gi] >= 0) Themes.roundRect(ctx, gp + (gi % SIZE) * gc + 1, gp + Math.floor(gi / SIZE) * gc + 1, gc - 2, gc - 2, gc * 0.2);
      ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      var gg = ctx.createLinearGradient(gp + pos, gp, gp + pos + gc * 1.4, gp + gc * 1.4);
      gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,.32)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gg; ctx.fillRect(gp, gp, S2, S2); ctx.restore();
      return;
    }
    if (a.type === 'beam') { // v1.21: feixe de luz passando pela linha limpa
      var bt = (now - a.start) / a.dur; if (bt < 0 || bt >= 1) return;
      var bc = L.cell, bp = L.pad, span = SIZE * bc, head = bt * 1.35, alpha = bt < 0.75 ? 1 : (1 - bt) / 0.25;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.85 * alpha;
      var bar = function (horiz, k) {
        var x0 = horiz ? bp : bp + k * bc, y0 = horiz ? bp + k * bc : bp;
        var g = horiz ? ctx.createLinearGradient(x0, 0, x0 + span, 0) : ctx.createLinearGradient(0, y0, 0, y0 + span);
        var lo = Math.max(0, head - 0.55), hi = Math.min(1, head);
        if (a.rainbow) {
          var hues = [0, 45, 95, 175, 215, 280, 330];
          hues.forEach(function (h, i) { g.addColorStop(i / (hues.length - 1), 'hsla(' + ((h + bt * 120) % 360) + ',100%,62%,' + (i / (hues.length - 1) <= hi && i / (hues.length - 1) >= lo - 0.2 ? 0.9 : 0) + ')'); });
        } else {
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(lo, 'rgba(255,255,255,0)');
          g.addColorStop((lo + hi) / 2 || 0.001, a.color); g.addColorStop(hi, 'rgba(255,255,255,.95)');
          if (hi < 1) g.addColorStop(Math.min(1, hi + 0.001), 'rgba(255,255,255,0)');
        }
        ctx.fillStyle = g;
        var th0 = bc * (0.55 + 0.25 * Math.sin(Math.PI * bt));
        if (horiz) ctx.fillRect(x0, y0 + (bc - th0) / 2, span, th0); else ctx.fillRect(x0 + (bc - th0) / 2, y0, th0, span);
      };
      a.rows.forEach(function (r) { bar(true, r); });
      a.cols.forEach(function (c) { bar(false, c); });
      ctx.restore(); return;
    }
    if (a.type === 'special') { // v1.21: estrela sobe girando / bomba incha e some num clarão
      var st = (now - a.start) / a.dur; if (st < 0 || st >= 1) return;
      var sc0 = L.cell, sx = L.pad + a.c * sc0, sy = L.pad + a.r * sc0;
      ctx.save();
      if (a.kind === 'star') {
        sy -= st * sc0 * 1.1; var ss = sc0 * (1 + 0.5 * Math.sin(Math.PI * st));
        ctx.globalAlpha = 1 - st * st; ctx.translate(sx + sc0 / 2, sy + sc0 / 2); ctx.rotate(st * Math.PI * 1.2);
        ctx.drawImage(specialSprite('star', px), -ss / 2, -ss / 2, ss, ss);
      } else {
        var flash = Math.max(0, 1 - st * 2.2), bs = sc0 * (1 + st * 1.6);
        ctx.globalAlpha = Math.max(0, 1 - st * 1.8); ctx.drawImage(specialSprite('bomb', px), sx + (sc0 - bs) / 2, sy + (sc0 - bs) / 2, bs, bs);
        ctx.globalAlpha = flash * 0.85; ctx.fillStyle = '#fff1c8';
        ctx.beginPath(); ctx.arc(sx + sc0 / 2, sy + sc0 / 2, sc0 * (0.6 + st * 1.6), 0, 7); ctx.fill();
      }
      ctx.restore(); return;
    }
    if (a.type === 'gem') { // gema subindo e sumindo com brilho
      var gt = (now - a.start) / a.dur; if (gt < 0 || gt >= 1) return;
      var gcell = L.cell, gx = L.pad + a.c * gcell, gy = L.pad + a.r * gcell - gt * gcell * 0.9, gs = gcell * (1 + 0.35 * Math.sin(Math.PI * gt));
      ctx.save(); ctx.globalAlpha = 1 - gt * gt; ctx.drawImage(gemSprite(px), gx + (gcell - gs) / 2, gy + (gcell - gs) / 2, gs, gs); ctx.restore();
      return;
    }
    if (Fx.draw(ctx, a, now, { cell: L.cell, pad: L.pad, size: L.size }, function (ci) { return sprite(boardTheme(), ci, px); })) return;
    var cell = L.cell, pad = L.pad, t = (now - a.start) / a.dur;
    if (t < 0 || t >= 1) return;
    if (a.type === 'pop') {
      var s = 1 + 0.16 * (1 - t);
      ctx.globalAlpha = 1 - t;
      a.cells.forEach(function (rc) {
        var cx = pad + (rc[1] + 0.5) * cell, cy = pad + (rc[0] + 0.5) * cell;
        ctx.drawImage(sprite(a.theme, a.color, px), cx - cell * s / 2, cy - cell * s / 2, cell * s, cell * s);
      });
      ctx.globalAlpha = 1;
    } else if (a.type === 'clear') {
      a.cells.forEach(function (o) {
        if (state && state.board[o.r * SIZE + o.c] >= 0) return; // v1.16: casa já ocupada por peça nova — não cobrir com a quebra antiga
        var tt = (now - a.start - o.d) / a.cellDur;
        var cx = pad + (o.c + 0.5) * cell, cy = pad + (o.r + 0.5) * cell;
        if (tt < 0) { ctx.drawImage(sprite(a.theme, o.color, px), cx - cell / 2, cy - cell / 2, cell, cell); return; }
        if (tt >= 1) return;
        if (a.skin && Skins.drawBreak(ctx, sprite(a.theme, o.color, px), a.skin, a.theme, o.color, cx, cy, cell, tt, o.r * 8 + o.c + 1)) return;
        var e = tt * tt, sc = 1 - e * 0.85;
        ctx.globalAlpha = 1 - e;
        ctx.drawImage(sprite(a.theme, o.color, px), cx - cell * sc / 2, cy - cell * sc / 2, cell * sc, cell * sc);
        if (tt < 0.45) {
          ctx.globalAlpha = (0.45 - tt) * 1.4;
          ctx.fillStyle = '#fff';
          Themes.roundRect(ctx, cx - cell * sc / 2, cy - cell * sc / 2, cell * sc, cell * sc, cell * 0.2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      });
    } else if (a.type === 'parts') {
      var sec = (now - a.start) / 1000;
      ctx.globalAlpha = 1 - t;
      a.list.forEach(function (p) {
        var x = p.x + p.vx * sec, y = p.y + p.vy * sec + 0.5 * p.g * sec * sec;
        ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot + sec * p.spin);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    } else if (a.type === 'gray') { // casas ocupadas ficam cinza, de baixo para cima
      var front = Math.min(1, t * 1.6) * (SIZE + 1);
      ctx.fillStyle = 'rgba(70, 74, 88, .82)';
      for (var gr = 0; gr < SIZE; gr++) {
        if (SIZE - gr > front) continue;
        for (var gc = 0; gc < SIZE; gc++) {
          if (state.board[gr * SIZE + gc] < 0) continue;
          Themes.roundRect(ctx, pad + gc * cell + cell * 0.06, pad + gr * cell + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.14);
          ctx.fill();
        }
      }
    } else if (a.type === 'sweep') {
      // faixa de luz que acompanha a troca de tema
      var front = t * 2 * (SIZE - 1) * cell, len = L.size * 1.5;
      ctx.save();
      Themes.roundRect(ctx, 0, 0, L.size, L.size, Math.min(18, L.size * 0.045)); ctx.clip();
      ctx.translate(pad, pad); ctx.rotate(-Math.PI / 4);
      var off = (front + cell) / Math.SQRT2; // distância da frente diagonal no eixo girado
      var grd = ctx.createLinearGradient(0, off - cell, 0, off + cell);
      grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd; ctx.fillRect(-len, off - cell, len * 2, cell * 2);
      ctx.restore();
    }
  }

  /* ---------------- bandeja de peças ---------------- */
  function drawTray(deal) {
    if (!state) return;
    var th = boardTheme(), dpr = L.dpr || 1;
    slots.forEach(function (slot, i) {
      var cv = slot.querySelector('canvas'), ctx = cv.getContext('2d');
      var w = slot.clientWidth, h = slot.clientHeight;
      if (!w || !h) return;
      var cw = Math.round(w * dpr), ch = Math.round(h * dpr);
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var p = state.pieces[i];
      slot.classList.toggle('empty', !p);
      slot.classList.toggle('unfit', !!p && !Logic.pieceFits(state, i));
      if (!p) { slot.setAttribute('aria-label', T('Espaço vazio')); return; }
      var shape = SHAPES[p.s], c = L.trayCell, px = Math.max(1, Math.round(c * dpr));
      slot.setAttribute('aria-label', shape.cells.length === 1 ? T('Peça de 1 bloco') : T('Peça de {n} blocos', { n: shape.cells.length }));
      var ox = (w - shape.w * c) / 2, oy = (h - shape.h * c) / 2;
      shape.cells.forEach(function (sc) { ctx.drawImage(sprite(th, p.c, px), ox + sc[1] * c, oy + sc[0] * c, c, c); });
      if (p.sp && shape.cells[p.sp.k]) drawSpecialOn(ctx, p.sp.t, ox + shape.cells[p.sp.k][1] * c, oy + shape.cells[p.sp.k][0] * c, c, px);
      if (p.rk && shape.cells[p.rk.k]) ctx.drawImage(rareSprite(p.rk.t, px), ox + shape.cells[p.rk.k][1] * c, oy + shape.cells[p.rk.k][0] * c, c, c);
      if (deal) { slot.classList.remove('deal'); void slot.offsetWidth; slot.classList.add('deal'); }
    });
  }

  /* ---------------- arrastar e soltar ---------------- */
  slots.forEach(function (slot, i) {
    slot.addEventListener('pointerdown', function (e) { startDrag(e, i); });
    slot.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kbSelect(i); } });
    slot.addEventListener('lostpointercapture', function (e) { if (drag && !drag.kb && e.pointerId === drag.id) endDrag(false); });
  });

  /** Desenha a peça que está na mão. v1.18: também é chamada quando os blocos se transformam (a peça na mão muda junto). */
  function paintDragPiece(shape, piece, w, h, px) {
    var cell = L.cell, dpr = L.dpr;
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.clearRect(0, 0, w, h);
    var th = boardTheme();
    shape.cells.forEach(function (sc) { dctx.drawImage(sprite(th, piece.c, px), sc[1] * cell, sc[0] * cell, cell, cell); });
    if (piece.sp && shape.cells[piece.sp.k]) drawSpecialOn(dctx, piece.sp.t, shape.cells[piece.sp.k][1] * cell, shape.cells[piece.sp.k][0] * cell, cell, px);
    if (piece.rk && shape.cells[piece.rk.k]) dctx.drawImage(rareSprite(piece.rk.t, px), shape.cells[piece.rk.k][1] * cell, shape.cells[piece.rk.k][0] * cell, cell, cell);
  }
  function repaintHeldPiece() {
    if (!drag || drag.kb || dragCanvas.hidden) return;
    paintDragPiece(drag.shape, drag.piece, drag.w, drag.h, Math.max(1, Math.round(L.cell * L.dpr)));
    if (settings.anim !== 'off') { dragCanvas.classList.remove('morph'); void dragCanvas.offsetWidth; dragCanvas.classList.add('morph'); }
  }
  function startDrag(e, i) {
    if ((drag && !drag.kb) || !state || locked || state.over) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var piece = state.pieces[i];
    if (!piece) return;
    e.preventDefault();
    if (kbDrag()) endDrag(false);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    Sound.unlock(); haptic('pick');
    var shape = SHAPES[piece.s], cell = L.cell, dpr = L.dpr;
    var w = shape.w * cell, h = shape.h * cell, px = Math.max(1, Math.round(cell * dpr));
    dragCanvas.width = Math.round(w * dpr); dragCanvas.height = Math.round(h * dpr);
    dragCanvas.style.width = w + 'px'; dragCanvas.style.height = h + 'px';
    paintDragPiece(shape, piece, w, h, px);
    var touch = e.pointerType !== 'mouse';
    drag = {
      slot: i, piece: piece, shape: shape, id: e.pointerId, touch: touch,
      w: w, h: h, lift: touch ? Math.max(cell * 1.1, 44) : 0, sx: e.clientX, sy: e.clientY,
      // sensibilidade: no toque, a peça anda mais que o dedo (não precisa arrastar o caminho todo)
      k: touch ? settings.dragSpeed : 1,
      row: -99, col: -99, valid: false, preview: null, over: false, left: 0, top: 0
    };
    dragCanvas.classList.remove('returning', 'invalid');
    dragCanvas.hidden = false;
    // a peça sai do tamanho da bandeja e cresce até o tamanho do tabuleiro (um pouco maior: "levantada").
    // Tamanho e posição vão juntos no mesmo transform (a propriedade CSS "scale" multiplicava a posição
    // e fazia a peça vir voando do alto da tela).
    dragCanvas.style.transition = 'none';
    dragCanvas.style.scale = '';
    drag.s1 = settings.anim === 'off' ? 1 : 1.05;
    drag.s0 = settings.anim === 'off' ? 1 : L.trayCell / L.cell;
    // a peça sai de onde está na bandeja e sobe suavemente até acima do dedo (não "aparece" lá em cima)
    var sr = slots[i].getBoundingClientRect();
    var tLeft = e.clientX - w / 2, tTop = touch ? e.clientY - h - drag.lift : e.clientY - h / 2;
    if (settings.anim !== 'off') {
      drag.ox = (sr.left + sr.width / 2 - w / 2) - tLeft;
      drag.oy = (sr.top + sr.height / 2 - h / 2) - tTop;
      drag.t0 = performance.now();
    }
    slots[i].classList.add('dragging');
    moveDrag(e.clientX, e.clientY);
    if (drag.t0) requestAnimationFrame(liftTick);
    Sound.pick();
  }

  var LIFT_MS = 150;
  /** Quanto falta da subida inicial (1 = ainda na bandeja, 0 = já no lugar). */
  function liftLeft(d) {
    if (!d.t0) return 0;
    var t = Math.min(1, (performance.now() - d.t0) / LIFT_MS);
    if (t >= 1) { d.t0 = 0; return 0; }
    return Math.pow(1 - t, 3); // começa rápido e desacelera
  }
  function placeDrag(d) {
    var k = liftLeft(d), sc = d.s1 + ((d.s0 || d.s1) - d.s1) * k;
    dragCanvas.style.transform = 'translate3d(' + (d.left + (d.ox || 0) * k) + 'px,' + (d.top + (d.oy || 0) * k) + 'px,0) scale(' + sc + ')';
  }
  function liftTick() {
    var d = drag;
    if (!d || d.kb) return;
    placeDrag(d);
    if (d.t0) requestAnimationFrame(liftTick);
  }

  function moveDrag(x, y) {
    var d = drag;
    var fx = d.sx + (x - d.sx) * (d.k || 1), fy = d.sy + (y - d.sy) * (d.k || 1); // ponto "acelerado"
    d.left = fx - d.w / 2;
    d.top = d.touch ? fy - d.h - d.lift : fy - d.h / 2;
    // a peça nunca sai da tela
    d.left = Math.max(-d.w * 0.3, Math.min(window.innerWidth - d.w * 0.7, d.left));
    d.top = Math.max(-d.h * 0.3, Math.min(window.innerHeight - d.h * 0.7, d.top));
    placeDrag(d);
    var rect = boardCanvas.getBoundingClientRect();
    var fc = (d.left - rect.left - L.pad) / L.cell, fr = (d.top - rect.top - L.pad) / L.cell;
    var col = Math.round(fc), row = Math.round(fr);
    // v1.24 (dono: "às vezes cai no lugar errado"): histerese — só troca de casa quando o dedo passa claramente da metade
    if (d.row > -50 && Math.abs(fc - d.col) < 0.62 && Math.abs(fr - d.row) < 0.62 && (d.valid || !Logic.canPlace(state.board, d.shape, row, col))) { col = d.col; row = d.row; }
    var over = d.left + d.w > rect.left && d.left < rect.right && d.top + d.h > rect.top && d.top < rect.bottom;
    // ímã: se o lugar exato não cabe, usa o encaixe válido mais próximo (até 0,75 casa de distância)
    if (over && !Logic.canPlace(state.board, d.shape, row, col)) {
      var best = null;
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        var rr = Math.round(fr) + dr, cc = Math.round(fc) + dc, dist = Math.hypot(rr - fr, cc - fc);
        if (dist <= 0.75 && Logic.canPlace(state.board, d.shape, rr, cc) && (!best || dist < best.dist)) best = { r: rr, c: cc, dist: dist };
      }
      if (best) { row = best.r; col = best.c; }
    }
    if (row !== d.row || col !== d.col) {
      if (d.valid) { d.prevRow = d.row; d.prevCol = d.col; } // lembra o último lugar válido mostrado
      d.changedAt = performance.now(); d.changeMag = d.lastF ? Math.hypot(fc - d.lastF[0], fr - d.lastF[1]) : 9; // tamanho do movimento que trocou a casa
      d.row = row; d.col = col;
      d.valid = Logic.canPlace(state.board, d.shape, row, col);
      d.preview = d.valid ? Logic.previewLines(state.board, d.shape, row, col) : null;
      requestRender();
    }
    d.lastF = [fc, fr];
    if (d.over !== over) requestRender();
    d.over = over;
    dragCanvas.classList.toggle('invalid', over && !d.valid);
  }

  window.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    moveDrag(e.clientX, e.clientY);
  }, { passive: false });
  window.addEventListener('pointerup', function (e) { if (drag && e.pointerId === drag.id) endDrag(true); });
  window.addEventListener('pointercancel', function (e) { if (drag && e.pointerId === drag.id) endDrag(false); });
  window.addEventListener('blur', function () { if (drag) endDrag(false); });

  function endDrag(drop) {
    var d = drag; drag = null;
    if (!d) return;
    var slot = slots[d.slot];
    slot.classList.remove('kb-selected');
    if (d.kb) {
      if (drop && d.valid && commitPlace(d.slot, d.row, d.col)) return;
      if (drop) { Sound.invalid(); slot.classList.remove('shake'); void slot.offsetWidth; slot.classList.add('shake'); drag = d; slot.classList.add('kb-selected'); return; }
      requestRender();
      return;
    }
    // v1.24: se a casa mudou nos últimos 90 ms (o dedo "escorrega" ao soltar), usa o lugar válido que estava aparecendo antes
    if (drop && d.changedAt && performance.now() - d.changedAt < 90 && d.changeMag < 0.3 && d.prevRow != null && Logic.canPlace(state.board, d.shape, d.prevRow, d.prevCol)) {
      d.row = d.prevRow; d.col = d.prevCol; d.valid = true;
    }
    if (drop && d.valid && commitPlace(d.slot, d.row, d.col)) {
      dragCanvas.hidden = true;
      slot.classList.remove('dragging');
      return;
    }
    // volta para a bandeja
    if (d.over) {
      Sound.invalid(); haptic('invalid'); announce(T('Não cabe aí.'));
      slot.classList.remove('shake'); void slot.offsetWidth; slot.classList.add('shake');
    }
    requestRender();
    if (settings.anim === 'off') {
      dragCanvas.hidden = true; slot.classList.remove('dragging');
      return;
    }
    var sr = slot.getBoundingClientRect();
    var tx = sr.left + sr.width / 2 - d.w / 2, ty = sr.top + sr.height / 2 - d.h / 2;
    var sc = L.trayCell / L.cell;
    dragCanvas.style.transition = ''; // volta a usar a transição da classe .returning
    dragCanvas.style.scale = '';
    dragCanvas.classList.add('returning');
    dragCanvas.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) scale(' + sc + ')';
    setTimeout(function () {
      // v1.15: a peça devolvida sempre reaparece na bandeja, mesmo se outra já estiver sendo arrastada
      // (antes ficava invisível quando o jogador pegava outra peça em menos de 0,2 s)
      if (!drag || drag.slot !== d.slot) slot.classList.remove('dragging');
      if (drag) return;
      dragCanvas.hidden = true;
      dragCanvas.classList.remove('returning', 'invalid');
    }, 190);
  }

  /* ---------------- teclado (computador / acessibilidade) ---------------- */
  function kbDrag() { return drag && drag.kb; }

  function kbSelect(i) {
    if (!state || locked || state.over || !state.pieces[i]) return;
    if (drag && !drag.kb) return;
    var prevPos = drag ? { row: drag.row, col: drag.col } : null;
    if (drag) slots[drag.slot].classList.remove('kb-selected');
    var piece = state.pieces[i], shape = SHAPES[piece.s];
    var row = prevPos ? prevPos.row : Math.floor((SIZE - shape.h) / 2);
    var col = prevPos ? prevPos.col : Math.floor((SIZE - shape.w) / 2);
    drag = { kb: true, slot: i, piece: piece, shape: shape, row: 0, col: 0, valid: false, preview: null };
    slots[i].classList.add('kb-selected');
    Sound.unlock(); Sound.pick();
    kbMoveTo(row, col);
    announce(T('Peça {i} selecionada, {n} blocos. Use as setas e Enter.', { i: i + 1, n: shape.cells.length }));
  }

  function kbMoveTo(row, col) {
    var sh = drag.shape;
    drag.row = Math.max(0, Math.min(SIZE - sh.h, row));
    drag.col = Math.max(0, Math.min(SIZE - sh.w, col));
    drag.valid = Logic.canPlace(state.board, sh, drag.row, drag.col);
    drag.preview = drag.valid ? Logic.previewLines(state.board, sh, drag.row, drag.col) : null;
    requestRender();
  }

  document.addEventListener('keydown', function (e) {
    if (!screens.game.classList.contains('active') || !state) return;
    if (document.querySelector('.overlay:not([hidden])')) return;
    var k = e.key;
    if (k === '1' || k === '2' || k === '3') { e.preventDefault(); kbSelect(+k - 1); return; }
    if (!kbDrag()) return;
    var moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[k]) { e.preventDefault(); kbMoveTo(drag.row + moves[k][0], drag.col + moves[k][1]); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); endDrag(true); }
    else if (k === 'Escape') { e.preventDefault(); endDrag(false); }
  });

  /* ---------------- leitor de tela ---------------- */
  var pendingSay = [], sayT = 0;
  function announce(text) { // junta mensagens do mesmo momento numa frase só
    pendingSay.push(text);
    clearTimeout(sayT);
    sayT = setTimeout(function () {
      var el = $('#announcer');
      el.textContent = '';
      var msg = pendingSay.join(' ');
      pendingSay = [];
      setTimeout(function () { el.textContent = msg; }, 20);
    }, 40);
  }

  /* ---------------- jogada ---------------- */
  function overlayOpen() { return !!document.querySelector('.overlay:not([hidden])'); }
  function rngFor(st) { return typeof st.seed === 'number' ? Logic.seededRng((st.seed + st.placed * 2654435761) >>> 0) : undefined; }
  function commitPlace(slot, r, c) {
    if (locked || overlayOpen()) return false;
    if (!state.gid && state.mode !== 'tutorial') state.gid = newGid(); // identifica a partida (recordes sem duplicar após desfazer)
    var snap = state.mode === 'tutorial' ? null : JSON.stringify(state);
    var statsSnap = snap ? JSON.stringify(stats) : null;
    var prevCombo = state.combo || 0;
    var placedPiece = state.pieces[slot];
    var res = Logic.place(state, slot, r, c, rngFor(state));
    if (!res) return false;
    if (placedPiece && placedPiece.rk && SHAPES[placedPiece.s].cells[placedPiece.rk.k]) { // v1.24: bloco raro vai para o tabuleiro
      var rc = SHAPES[placedPiece.s].cells[placedPiece.rk.k], rIdx = (r + rc[0]) * SIZE + c + rc[1];
      state.rare = state.rare || {}; state.rare[rIdx] = placedPiece.rk.t;
    }
    var rareGone = [], lastRareKinds = {};
    if (state.rare) Object.keys(state.rare).forEach(function (k) { if (state.board[+k] < 0) { rareGone.push(+k); lastRareKinds[+k] = state.rare[k]; delete state.rare[k]; } });
    tagRares();
    if (state.mode === 'weekly') state.moves = (state.moves || '') + String.fromCharCode(Weekly.packMove(slot, r, c)); // prova da partida
    if (snap) { lastSnap = snap; lastStatsSnap = statsSnap; }
    if (!res.lineCount) announce(T('Peça colocada.'));
    var now = animNow(), lvl = settings.anim, th = boardTheme(), geo = { cell: L.cell, pad: L.pad, size: L.size };
    var colorOf = function (ci) { var p = pal(th); return p[ci % p.length]; };
    Sound.placeSkin(curSkin());
    if (!res.lineCount) haptic('place'); // toque firme a cada peça encaixada
    // encaixe: pequena expansão e retorno + faíscas discretas
    if (lvl !== 'off') anims.push({ type: 'pop', cells: res.placed, color: res.color, theme: th, start: now, dur: lvl === 'full' ? 220 : 140 });
    if (partsOn()) anims.push(Fx.sparks(res.placed, colorOf(res.color), geo, now, anims));
    var pkGone = rareGone.filter(function (ri) { return lastRareKinds[ri] === 'pk'; }).length;
    if (pkGone) { // v1.24: Semana do Terror — abóboras limpas
      state.pk = (state.pk || 0) + pkGone;
      var evn = eventNow();
      if (state.mode === 'event' && evn && !state.pkDone && state.pk >= evn.goal) {
        state.pkDone = true; stats.rares = stats.rares || {}; stats.rares.pk = 1; saveStats();
        reward('trophy', T('Desafio do evento concluído! 🎃'), T('A Abóbora agora é um bloco raro seu para sempre.'));
        later(function () { Sound.record(); }, 400);
      }
    }
    if (rareGone.length) { // v1.24: limpar bloco raro faz festa (brilho branco + som de recompensa)
      rareGone.forEach(function (ri, n) { if (partsOn()) anims.push(Fx.sparks([[Math.floor(ri / SIZE), ri % SIZE]], '#ffffff', geo, now + 200 + n * 60, anims)); });
      later(function () { Sound.star && Sound.star(); }, 260);
      popup('✨ ' + rareName(rareGone.length && lastRareKinds[rareGone[0]] || 'r1'), [Math.floor(rareGone[0] / SIZE), rareGone[0] % SIZE], 'pts-small', 0.6, false, 250);
    }

    if (res.gems && res.gems.length) { // v1.17: gemas coletadas — brilho, faíscas e "+1" na casa
      res.gems.forEach(function (rc, k) {
        if (lvl !== 'off') anims.push({ type: 'gem', r: rc[0], c: rc[1], start: now + k * 90, dur: 700 });
        popup('+1 ◆', [rc[0], rc[1]], 'gem', 0, false, 120 + k * 90);
      });
      later(function () { Sound.combo(3); }, 140);
      announce(T('Gema coletada!'));
    }
    var spx = res.special; // v1.21: estrela e bomba acionadas
    if (spx && (spx.stars.length || spx.bombs.length)) {
      spx.stars.forEach(function (rc, k) {
        if (lvl !== 'off') anims.push({ type: 'special', kind: 'star', r: rc[0], c: rc[1], start: now + 120 + k * 90, dur: 800 });
        if (partsOn()) anims.push(Fx.sparks([rc], '#ffd54a', geo, now + 120, anims));
        popup('+' + fmt(Math.round(Logic.CONFIG.special.starPts * Logic.multFor(Logic.levelFor(state.lines || 0)))) + ' ★', [rc[0], rc[1]], 'star', 0, false, 160 + k * 90);
      });
      spx.bombs.forEach(function (rc, k) {
        if (lvl !== 'off') {
          anims.push({ type: 'special', kind: 'bomb', r: rc[0], c: rc[1], start: now + 120 + k * 120, dur: 600 });
          anims.push({ type: 'ring', x: L.pad + (rc[1] + 0.5) * L.cell, y: L.pad + (rc[0] + 0.5) * L.cell, reach: 3, color: '#ff8a3a', start: now + 140 + k * 120, dur: 480 });
        }
      });
      if (spx.bombs.length) { later(function () { Sound.bomb(); if (lvl !== 'off') shake('big'); haptic('bomb'); }, 130); announce(T('Bomba! Explodiu os blocos em volta.')); }
      if (spx.stars.length) { later(function () { Sound.star(); if (!spx.bombs.length) haptic('star'); }, 150); announce(T('Estrela! Pontos extras.')); }
    }
    if (res.lineCount > 0) {
      var origin = centroid(res.placed);
      // intensidade cresce com o número de linhas: 1 simples, 2 forte, 3+ especial
      // qualidade da jogada: linhas de uma vez + combo longo; tabuleiro limpo é o máximo
      var tier = res.boardClear ? 4 : Math.min(4, res.lineCount + (res.combo >= 4 ? 1 : 0)), intensity = Math.min(3, res.lineCount);
      var charge = lvl === 'full' ? 170 : 0; // 1) linhas acendem e pulsam  2) quebram
      if (lvl !== 'off') {
        var skinNow = curSkin(), custom = lvl === 'full' && Skins.isCustom(skinNow); // quebra própria (com tremor) só com animações completas
        var stag = lvl === 'full' ? 22 : 0, cellDur = custom ? Skins.breakMs(skinNow) : lvl === 'full' ? 320 : 200, maxD = 0;
        var cells = res.cleared.map(function (o) {
          var d = (Math.abs(o.r - origin[0]) + Math.abs(o.c - origin[1])) * stag;
          maxD = Math.max(maxD, d);
          return { r: o.r, c: o.c, color: o.color, d: d };
        });
        if (charge) anims.push({ type: 'charge', cells: cells, glow: colorOf(res.color), start: now, dur: charge, sprite: null });
        // v1.21: feixe de luz atravessando cada linha limpa; vira arco-íris em várias linhas de uma vez ou combo ×3+
        if (settings.fx !== 'off') anims.push({ type: 'beam', rows: res.rows.slice(), cols: res.cols.slice(), rainbow: res.lineCount >= 2 || res.combo >= 3,
          color: colorOf(res.color), start: now + charge * 0.5, dur: lvl === 'full' ? 520 : 360 });
        anims.push({ type: 'clear', cells: cells, theme: th, skin: custom ? skinNow : null, start: now + charge, cellDur: cellDur, dur: maxD + cellDur });
        if (partsOn() && !custom) anims.push(Fx.burst(res.cleared, colorOf, geo, now, intensity, anims, charge));
        if (lvl === 'full' && res.lineCount >= 2) {
          anims.push({ type: 'ring', x: L.pad + (origin[1] + 0.5) * L.cell, y: L.pad + (origin[0] + 0.5) * L.cell, reach: 4 + res.lineCount * 2,
            color: colorOf(res.color), start: now + charge, dur: 520 });
        }
      }
      // blocos reagem à jogada (hierarquia: 1 linha discreta → combo acende → várias linhas: onda → tabuleiro limpo: florada)
      if (lvl === 'full' && settings.quality !== 'low') {
        var filled = function () { var out = []; if (!state) return out; for (var i = 0; i < state.board.length; i++) if (state.board[i] >= 0) out.push({ r: Math.floor(i / SIZE), c: i % SIZE }); return out; };
        if (res.lineCount >= 2) anims.push({ type: 'wave', cellsFn: filled, r: origin[0], c: origin[1], reach: 9, color: '#ffffff', peak: Math.min(0.55, 0.28 + 0.09 * res.lineCount), start: now + charge, dur: 650 });
        if (res.combo >= 2) anims.push({ type: 'glowCells', cellsFn: filled, color: colorOf(res.color), peak: Math.min(0.42, 0.12 + 0.06 * res.combo), start: now + charge + 120, dur: 520 });
        else if (tier >= 2 && res.lineCount < 2) anims.push({ type: 'glowCells', cellsFn: filled, color: '#ffffff', peak: 0.16, start: now + charge, dur: 420 });
        if (res.boardClear) anims.push({ type: 'bloom', size: SIZE, start: now + charge + 250, dur: 1200 });
      }
      var breakSkin = curSkin();
      // v1.23 (menos poluição sonora): escala + UM detalhe — combo (se houver), senão a quebra do estilo, senão o "boom"
      if (res.combo >= 3 && eventNow() && Math.random() < 0.5) later(function () { Sound.ghost(); }, 300); // v1.24: fantasma no combo (evento)
    if (res.combo >= 2) { Sound.clear(res.lineCount, res.combo, null); Sound.combo(res.combo); }
      else if (Sound.hasBreak(breakSkin)) { Sound.clear(res.lineCount, res.combo, null); later(function () { Sound.breakSkin(breakSkin, res.lineCount); }, charge * 0.6); }
      else Sound.clear(res.lineCount, res.combo, 'boom');
      if (res.boardClear) haptic('celebrate'); else if (res.combo >= 2) haptic('combo', res.combo); else haptic(res.lineCount > 1 ? 'lines' : 'line');
      if (lvl === 'full' && (res.lineCount >= 2 || res.boardClear || res.combo >= 5)) later(function () { shake(res.boardClear || res.lineCount >= 3 || res.combo >= 8 ? 'big' : ''); }, charge);
      if (lvl === 'full' && settings.fx === 'full' && (res.lineCount >= 3 || res.boardClear)) { // v1.24: câmera lenta na jogada épica
        slowMo(650, 0.3, Math.max(0, charge - 40));
        later(function () { boardBox.classList.remove('epic'); void boardBox.offsetWidth; boardBox.classList.add('epic'); }, Math.max(0, charge - 40));
      }
      // cada mensagem em sua faixa, para não se sobreporem: pontos na jogada, elogio, combo, recompensas
      // faixas fixas (em linhas do tabuleiro) para as mensagens não se sobreporem
      var mid = SIZE / 2 - 0.5, lane = res.boardClear ? { points: 6.7 } : { points: 0 };
      var pr = lane.points || (origin[0] < 4.6 ? 5.8 : Math.min(SIZE - 1.2, origin[0]));
      // v1.23 (menos poluição): pontos pequenos junto da peça; UMA mensagem grande por vez (combo, se houver; senão o elogio)
      popup('+' + fmt(res.gained), res.boardClear ? [pr, mid] : [Math.max(0.6, Math.min(SIZE - 0.8, origin[0] - 0.6)), Math.max(1, Math.min(SIZE - 2, origin[1]))], 'pts-small', 0);
      var rec3 = (state.recent || []).slice(-3), streak = rec3.length === 3 && rec3.every(function (v) { return v > 0; });
      var word = res.combo >= 2 || res.boardClear ? '' : praiseFor(tier, res.boardClear, res.combo, streak);
      if (word) popup(word, [2.6, mid], 'praise t' + (word === T('Imparável!') ? 4 : tier), 0);
      if (res.combo >= 2 && !res.boardClear) { // combo em destaque: número grande + pontos extras do combo; combos altos ganham cor e confete
        var cbCls = 'combo-big' + (res.combo >= 10 ? ' mega' : res.combo >= 5 ? ' hot' : '');
        popup(T('Combo <b>{n}</b>', { n: Math.floor(+res.combo) || 0 }) + (res.comboBonus > 0 ? ' <small>+' + fmt(Math.floor(+res.comboBonus) || 0) + '</small>' : '')  /* v1.21.2: só números entram no HTML */, [2.6, mid], cbCls, 0, true, 60);
        if (res.combo >= 5 && partsOn() && !res.boardClear) anims.push(Fx.confetti(pal(th), geo, now + charge + 120, Math.min(70, 20 + res.combo * 4), anims));
        var rec4 = (state.recent || []).slice(-4), streak4 = rec4.length === 4 && rec4.every(function (v) { return v > 0; });
        if (lvl === 'full' && settings.quality !== 'low' && (res.combo >= 5 || streak4)) // efeito temporário: faixas de cor atravessando os blocos
          anims.push({ type: 'prism', cellsFn: function () { var o = []; if (!state) return o; for (var i = 0; i < state.board.length; i++) if (state.board[i] >= 0) o.push({ r: Math.floor(i / SIZE), c: i % SIZE }); return o; },
            start: now + charge + 200, dur: 1400, strong: res.combo >= 7 });
      }
      if (res.boardClear) { // recompensa especial: contorno brilhando, confete e bônus
        // v1.23: limpeza perfeita é a única mensagem grande da jogada (o bônus vai junto, pequeno)
        popup(T('Limpeza perfeita!') + '<br><small>+' + fmt(Math.floor(+res.clearPts) || 0) + '</small>', [4.2, mid], 'big clear', 0, true, 200);
        if (lvl !== 'off') anims.push({ type: 'boardGlow', color: th.accent, start: now + charge, dur: 1300 });
        if (partsOn()) anims.push(Fx.confetti(pal(th), geo, now + charge, 80, anims));
        later(function () { Sound.boardClear(); }, 250);
      }
      announce((res.boardClear ? T('Limpeza perfeita!') + ' ' : '') + (word ? word + ' ' : '') +
        T(res.lineCount > 1 ? '{n} linhas limpas' : '{n} linha limpa', { n: res.lineCount }) +
        (res.combo >= 2 ? T(', combo {n}', { n: res.combo }) : '') + '. ' + T('Mais {g} pontos. Total {t}.', { g: res.gained, t: state.score }));
    }
    // novo recorde durante a partida (uma vez por partida)
    var recordNow = false;
    if ((state.mode === 'classic' || state.mode === 'daily') && !state.recordShown && state.startBest > 0 && state.score > state.startBest) {
      state.recordShown = true; recordNow = true;
      popup(T('Novo recorde!'), [SIZE - 1.4, SIZE / 2 - 0.5], 'praise t4', 0, false, res.lineCount ? 750 : 0);
      later(function () { haptic('celebrate'); }, res.lineCount ? 750 : 0);
      if (lvl !== 'off') anims.push({ type: 'shine', start: now + 200, dur: 900 });
      if (partsOn()) anims.push(Fx.confetti(pal(th), geo, now + 200, 50, anims));
      later(function () { Sound.record(); }, 300);
      announce(T('Novo recorde!'));
    }
    // v1.23 (pedido do dono): "Faltam X para o seu recorde!" ao chegar a 75% e a 90% do recorde (uma vez cada)
    if ((state.mode === 'classic' || state.mode === 'daily' || state.mode === 'weekly') && !state.recordShown && state.startBest > 0 && state.score < state.startBest) {
      var stage = state.score >= state.startBest * 0.9 ? 2 : state.score >= state.startBest * 0.75 ? 1 : 0;
      if (stage > (state.nearShown || 0)) {
        state.nearShown = stage;
        later(function () { toast('🎯 ' + T('Faltam {n} para o seu recorde!', { n: fmt(state.startBest - state.score) }), T('Continue assim!')); }, res.lineCount ? 900 : 200);
      }
    }
    surpriseAfterMove(res, recordNow, prevCombo);
    if (prevCombo >= 2 && state.combo === 0 && state.mode !== 'tutorial') comboEnded(prevCombo);
    if (res.levelUp) { // subiu de nível: multiplicador maior (também no último passo do tutorial)
      popup(T('Fase {n}!', { n: res.level }) + ' ×' + multText(res.level), [SIZE - 2.6, SIZE / 2 - 0.5], 'level', 0, false, res.lineCount ? 1050 : 0);
      later(function () { Sound.record(); var ch = $('#lvl-chip'); ch.classList.remove('up'); void ch.offsetWidth; ch.classList.add('up'); }, res.lineCount ? 1050 : 0);
      announce(T('Fase {n}, multiplicador ×{m}.', { n: res.level, m: multText(res.level) }));
    }
    updateScore();
    updateComboChip();
    updateThemeBar();
    drawTray(res.refilled);
    requestRender();
    afterMove(res);
    return true;
  }

  // elogios em escala de intensidade (1 linha → 4+ linhas / tabuleiro limpo)
  // cada nível tem duas falas que se alternam, para não repetir sempre a mesma
  var PRAISE = { 1: ['Boa!', 'Muito bom!'], 2: ['Mandou bem!', 'Ótimo!'], 3: ['Excelente!', 'Incrível!', 'Brilhante!'], 4: ['Perfeito!', 'Fantástico!', 'Magistral!'] }; // v1.21: + Brilhante, Magistral
  var lastPraise = '';
  /** Elogio conforme a jogada real: combo ×7+ = "Imparável!"; 3 jogadas seguidas limpando = às vezes "Suave!". */
  function praiseFor(tier, boardClear, combo, streak) {
    var opts = PRAISE[tier];
    if (!opts) return '';
    var ki = Math.floor(Math.random() * opts.length), k = boardClear ? 'Fantástico!' : opts[ki];
    if (!boardClear && combo >= 7) k = 'Imparável!';
    else if (!boardClear && streak && tier <= 2 && Math.random() < 0.5) k = 'Suave!';
    if (!boardClear && k === lastPraise && k !== 'Imparável!') k = opts[(opts.indexOf(k) + 1) % opts.length] || opts[0]; // combo real pode repetir "Imparável!""
    lastPraise = k;
    return T(k);
  }

  function pal(th) { return curSkin() === 'theme' ? th.palette : Themes.classic(th).palette; }

  /* ---------------- transformações surpresa (decisão em js/surprise.js) ---------------- */
  function surpriseAfterMove(res, record, prevCombo) {
    if (!state || state.mode === 'tutorial') return;
    if (!state.look || typeof state.look !== 'object') state.look = { skin: null, left: 0, last: [], since: 99 };
    var look = state.look;
    if (!Array.isArray(look.last)) look.last = [];
    var ended = Surprise.tick(look);
    // 1) troca do visual inteiro (mais rara). Se acontecer, os blocos não se transformam nesta jogada.
    if (!state.tlook || typeof state.tlook !== 'object') state.tlook = { since: 99, last: [] };
    if (!Array.isArray(state.tlook.last)) state.tlook.last = [];
    Surprise.tickTheme(state.tlook);
    var evCtx = { record: record, recent: state.recent, prevScore: state.score - (res.gained || 0), score: state.score, prevCombo: prevCombo || 0 }; // v1.20: eventos conquistados
    var dt = settings.surprise ? Surprise.decideTheme(state.tlook, res, Object.assign({ current: THEMES[themeIdx].id }, evCtx),
      THEMES.map(function (t) { return t.id; }), Math.random) : null;
    if (dt) {
      state.tlook.since = 0; state.tlook.last = state.tlook.last.concat(dt.theme).slice(-4);
      state.themeId = dt.theme;
      var tdelay = settings.anim === 'off' ? 0 : res.boardClear ? 1550 : res.lineCount ? 950 : 300;
      later(function () { if (state && state.themeId === dt.theme) applyTheme(Themes.indexOfId(dt.theme), true); if (state && !locked && !state.over) saveGame(); }, tdelay);
      if (ended) scheduleLook(null, res, null);
      return;
    }
    // 2) transformação dos blocos
    var d = settings.surprise && settings.blocks === 'classic' ? Surprise.decide(look, res, Object.assign({ base: settings.blocks }, evCtx), Skins.ids, Math.random) : null;
    if (d) {
      look.since = 0; look.left = d.left;
      look.last = look.last.concat(d.skin).slice(-4);
      scheduleLook(d.skin, res, d);
    } else if (ended) scheduleLook(null, res, null); // fim de uma transformação temporária: volta ao estilo do jogador
  }
  function scheduleLook(skin, res, d) {
    var origin = res.placed && res.placed.length ? centroid(res.placed) : [SIZE / 2 - 0.5, SIZE / 2 - 0.5];
    // espera a quebra das linhas (e a florada do tabuleiro limpo) terminar, para a surpresa ter seu momento
    var delay = settings.anim === 'off' ? 0 : res.boardClear ? 1550 : res.lineCount ? 950 : 300;
    later(function () { applyLook(skin, origin, d); }, delay);
  }
  /** v1.20: nome da conquista que causou a mudança. */
  function eventTitle(ev) {
    if (!ev) return T('Transformação!');
    if (ev.id === 'level') return T('Fase {n}!', { n: ev.value });
    if (ev.id === 'clear') return T('Limpeza perfeita!');
    if (ev.id === 'record') return T('Novo recorde!');
    if (ev.id === 'milestone') return T('Marco de {n} pontos!', { n: fmt(ev.value) });
    if (ev.id === 'epic') return T('Jogada épica!');
    if (ev.id === 'combo') return T('Combo ×{n} extraordinário!', { n: ev.value });
    return T('Transformação!');
  }
  function skinName(id) { var s = Skins.LIST.filter(function (x) { return x.id === id; })[0]; return s ? T(s.name) : id; }
  function applyLook(skin, origin, d) {
    if (!state || !state.look) return;
    var from = curSkin();
    state.look.skin = skin;
    if (!skin) state.look.left = 0;
    var to = curSkin();
    if (from === to) return;
    var discovered = false;
    if (skin) {
      stats.surprises = (stats.surprises || 0) + 1;
      if (Skins.rareIds.indexOf(skin) !== -1 && !stats.surpriseSeen[skin]) { stats.surpriseSeen[skin] = 1; discovered = true; } // estilo raro descoberto (vai para a Coleção)
      saveStats();
    }
    var big = !!(d && d.big) && settings.fx === 'full'; // efeitos reduzidos: troca simples, sem brilho extra
    if (settings.anim !== 'off') {
      anims.push({ type: 'morph', from: from, to: to, r: origin[0], c: origin[1], start: animNow(), dur: settings.fx === 'reduced' ? 450 : big ? 1100 : 800 });
      if (big) anims.push({ type: 'shine', start: animNow() + 500, dur: 900 });
    }
    drawTray(false);
    paintBg(); // o fundo da tela muda junto com os blocos
    repaintHeldPiece(); // v1.18: a peça na mão também se transforma na hora
    slots.forEach(function (sl) { sl.classList.remove('morph'); void sl.offsetWidth; sl.classList.add('morph'); });
    if (skin) {
      Sound.transform(big);
      toast('✦ ' + eventTitle(d && d.event), discovered ? T('Novo estilo descoberto: {name}', { name: skinName(skin) }) : T('Blocos: {name}', { name: skinName(skin) })); // um aviso só, dizendo o que foi conquistado
      announce(T('Os blocos se transformaram: {name}.', { name: skinName(skin) }));
    }
    if (!locked && !state.over) saveGame();
    requestRender();
  }
  /** Transformação: cada bloco gira e troca de visual, numa onda que sai do ponto da jogada. */
  function drawMorph(ctx, a, now, px) {
    if (!state) return;
    var t = (now - a.start) / a.dur, cell = L.cell, pad = L.pad, th = boardTheme();
    if (t >= 1) return;
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      var v = state.board[r * SIZE + c];
      if (v < 0) continue;
      var k = Math.sqrt((r - a.r) * (r - a.r) + (c - a.c) * (c - a.c)) / (SIZE * 0.75);
      var u = (t - Math.min(1, k) * 0.6) / 0.4, x = pad + c * cell, y = pad + r * cell;
      if (u >= 1) continue;
      ctx.drawImage(sprite(th, -1, px), x, y, cell, cell);
      if (u <= 0) { ctx.drawImage(sprite(th, v, px, a.from), x, y, cell, cell); continue; }
      var sc = u < 0.5 ? 1 - 2 * u : 2 * u - 1, w = Math.max(1, cell * sc);
      ctx.drawImage(sprite(th, v, px, u < 0.5 ? a.from : a.to), x + (cell - w) / 2, y, w, cell);
      var f = 1 - Math.abs(u - 0.5) * 2;
      if (f > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.28 * f * f; ctx.fillStyle = '#fff';
        Themes.roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, cell * 0.2); ctx.fill(); ctx.restore();
      }
    }
  }

  function centroid(cells) {
    var r = 0, c = 0;
    cells.forEach(function (rc) { r += rc[0]; c += rc[1]; });
    return [r / cells.length, c / cells.length];
  }



  function popup(text, origin, cls, dy, html, delayMs) {
    var el = document.createElement('div');
    el.className = 'popup' + (cls ? ' ' + cls : '');
    if (html) el.innerHTML = text; else el.textContent = text;
    var x = L.pad + (origin[1] + 0.5) * L.cell, y = L.pad + (origin[0] + 0.5 + (dy || 0)) * L.cell;
    x = Math.max(70, Math.min(L.size - 70, x));
    y = Math.max(24, Math.min(L.size - 24, y));
    el.style.left = x + 'px'; el.style.top = y + 'px';
    if (dy) el.style.animationDelay = '0.08s';
    if (delayMs) { el.style.animationDelay = (delayMs / 1000) + 's'; el.style.opacity = '0'; el.style.animationFillMode = 'forwards'; }
    fx.appendChild(el);
    el.addEventListener('animationend', function () { el.remove(); });
    setTimeout(function () { el.remove(); }, 1700 + (delayMs || 0));
  }

  function updateScore() {
    var el = $('#score'), target = state.score;
    el.parentNode.classList.toggle('long', target >= 1000000); // 7+ dígitos: fonte um pouco menor
    if (settings.anim === 'off' || target < displayedScore) {
      displayedScore = target; el.textContent = fmt(target); return;
    }
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    if (scoreRaf) return;
    (function tick() {
      var diff = state.score - displayedScore;
      if (diff <= 0) { scoreRaf = 0; displayedScore = state.score; el.textContent = fmt(displayedScore); return; }
      displayedScore += Math.max(1, Math.ceil(diff * 0.18));
      el.textContent = fmt(displayedScore);
      scoreRaf = requestAnimationFrame(tick);
    })();
  }

  // chip do combo: multiplicador + bolinhas com as peças que ainda restam para mantê-lo
  /** Fim de uma sequência de combo: o indicador mostra o combo que terminou e some devagar. */
  function comboEnded(n) {
    var chip = $('#combo-chip');
    $('#combo-x').textContent = '×' + n;
    chip.hidden = false; chip.classList.remove('hot', 'ended'); void chip.offsetWidth; chip.classList.add('ended');
    announce(T('Fim do combo ×{n}', { n: n }));
    later(function () { chip.classList.remove('ended'); updateComboChip(); }, settings.anim === 'off' ? 0 : 900);
  }
  /** v1.17: humor do tabuleiro — borda brilhando enquanto o combo está vivo (3+) e alerta vermelho suave
   *  quando a partida está quase perdida (no máximo 1 das peças da bandeja cabe, ou tabuleiro 75%+ cheio). Só aparência. */
  function updateBoardMood() {
    var b = $('#board'); if (!b) return;
    var on = !!state && screenIs('game') && modeOf() !== 'tutorial' && !state.over, k = on ? state.combo || 0 : 0;
    b.classList.toggle('combo-1', k >= 3 && k < 5); b.classList.toggle('combo-2', k >= 5 && k < 10); b.classList.toggle('combo-3', k >= 10);
    var danger = false;
    if (on) {
      var left = state.pieces.filter(function (p) { return !!p; }).length, fit = 0, filled = 0;
      state.pieces.forEach(function (p, i) { if (p && Logic.pieceFits(state, i)) fit++; });
      state.board.forEach(function (v) { if (v >= 0) filled++; });
      danger = (left >= 2 && fit <= 1) || filled >= SIZE * SIZE * 0.75;
    }
    if (danger && !b.classList.contains('danger')) announce(T('Cuidado: quase sem espaço.'));
    b.classList.toggle('danger', danger);
    b.classList.toggle('on-fire', on && !danger && k >= 10 && settings.anim !== 'off'); // v1.24: fogo no combo ×10
  }
  function updateComboChip() {
    updateBoardMood();
    var chip = $('#combo-chip'), win = Logic.CONFIG.combo.window;
    var active = state && state.combo >= 1;
    chip.hidden = !active;
    if (!active) return;
    $('#combo-x').textContent = '×' + Math.max(1, state.combo);
    var left = win - state.movesSinceClear;
    Array.prototype.forEach.call(chip.querySelectorAll('i'), function (d, i) { d.classList.toggle('on', i < left); });
    chip.classList.toggle('hot', state.combo >= 2);
    chip.style.setProperty('--k', Math.min(1.45, 1 + 0.05 * Math.max(0, state.combo - 1)).toFixed(2)); // cresce com o combo
  }

  function shake(kind) {
    boardBox.classList.remove('shake', 'shake-big');
    void boardBox.offsetWidth;
    boardBox.classList.add(kind === 'big' ? 'shake-big' : 'shake');
  }



  /* ---------------- temas ---------------- */
  /** Tema usado para desenhar tabuleiro e peças: durante uma transformação de blocos, o tabuleiro escurece
   *  no tom do fundo daquele estilo (o fundo e o tabuleiro mudam junto com os blocos). */
  var boardThemes = {};
  function mixHex(a, b, k) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), o = [16, 8, 0].map(function (sh) {
      var u = (x >> sh) & 255, v = (y >> sh) & 255; return Math.round(u + (v - u) * k);
    });
    return '#' + ((1 << 24) + (o[0] << 16) + (o[1] << 8) + o[2]).toString(16).slice(1);
  }
  function boardTheme() {
    var th = THEMES[themeIdx], lk = tempSkin(), sb = lk && Skins.BG[lk];
    if (!sb) return th;
    var key = th.id + '@' + lk;
    if (!boardThemes[key]) boardThemes[key] = Vis.fix(Object.assign({}, th, {
      id: key, board: mixHex(sb[1], '#000000', 0.22), grid: mixHex(sb[1], '#000000', 0.3),
      empty: mixHex(sb[0], sb[1], 0.55), emptyEdge: mixHex(sb[0], '#ffffff', 0.2)
    }), sb[0], sb[1]);
    return boardThemes[key];
  }
  /** Fundo da tela: o do visual atual, ou — durante uma transformação de blocos — o fundo próprio daquele estilo. */
  var DARK_UI = { 'text': '#f2f5ff', muted: 'rgba(242,245,255,.8)', panel: 'rgba(0,0,0,.32)', edge: 'rgba(255,255,255,.12)', shadow: 'rgba(0,0,0,.45)' };
  var bgKey = '';
  /** Regra (v1.16): o VISUAL dá fundo, tabuleiro e cores; o ESTILO ESCOLHIDO nas Configurações acrescenta só um desenho
   *  discreto no fundo; a TRANSFORMAÇÃO temporária troca fundo + tabuleiro pelos do estilo e, ao acabar, tudo volta. */
  function paintBg() {
    var th = THEMES[themeIdx], lk = tempSkin();
    var sb = lk && Skins.BG[lk], ui = sb ? DARK_UI : th.ui, rs = document.documentElement.style;
    if (ui) { // cores da interface
      rs.setProperty('--text', ui.text); rs.setProperty('--muted', ui.muted);
      rs.setProperty('--panel', ui.panel); rs.setProperty('--panel-edge', ui.edge); rs.setProperty('--score-shadow', ui.shadow);
    }
    var motif = Skins.MOTIF[lk || settings.blocks];
    var base = sb ? 'radial-gradient(80% 50% at 50% 0%, rgba(255,255,255,.14), transparent 70%), linear-gradient(170deg, ' + sb[0] + ' 0%, ' + sb[1] + ' 100%)'
      : th.decor + ', linear-gradient(170deg, ' + th.bg[0] + ' 0%, ' + th.bg[1] + ' 100%)';
    var bg = (motif ? motif + ', ' : '') + base;
    if (metaTheme) metaTheme.setAttribute('content', sb ? sb[1] : th.themeColor);
    if (bg === bgKey) return;
    bgKey = bg;
    var next = bgActive === 0 ? 1 : 0, layer = bgLayers[next];
    layer.style.background = bg;
    layer.classList.add('on');
    if (bgActive >= 0) bgLayers[bgActive].classList.remove('on');
    bgActive = next;
  }
  function applyTheme(idx, animate) {
    var from = THEMES[themeIdx], to = THEMES[idx];
    themeIdx = idx;
    var rs = document.documentElement.style;
    rs.setProperty('--bg1', to.bg[0]);
    rs.setProperty('--bg2', to.bg[1]);
    rs.setProperty('--accent', to.accent);
    rs.setProperty('--accent-ink', to.accentInk || '#1a1a14');
    paintBg();
    Sound.setTheme(to);
    updateThemeBar();
    if (state && state.mode && state.mode !== 'tutorial' && !(state.mode === 'zen' && state.reliefs) && !stats.themesSeen[to.id]) {
      stats.themesSeen[to.id] = 1; saveStats(); reportAchievements();
    }
    if (animate) {
      if (settings.anim !== 'off' && from !== to) {
        anims = anims.filter(function (a) { return a.type !== 'sweep'; });
        anims.push({ type: 'sweep', from: from, to: to, start: animNow(), dur: settings.anim === 'full' ? 1000 : 360 });
      }
      toast('✦ ' + T('Novo visual: {name}', { name: T(to.name) }), T(to.msg));
      announce(T('Novo visual: {name}', { name: T(to.name) }) + '.');
      Sound.transform(true);
      haptic('reward');
      if (settings.anim !== 'off' && settings.fx === 'full') { // clarão suave na tela inteira + confete nas cores novas
        var fl = $('#theme-flash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
        if (partsOn() && screenIs('game')) anims.push(Fx.confetti(pal(to), { cell: L.cell, pad: L.pad, size: L.size }, animNow(), 60, anims));
      }
    }
    requestRender();
    drawTray(false);
    repaintHeldPiece(); // troca de visual também atualiza a peça na mão
  }

  /** Barra do nível: quanto falta para o próximo nível (percentual real: linhas limpas ÷ linhas do nível). */
  var lastPctMark = -1;
  function updateThemeBar() {
    if (!state) return;
    var every = Logic.CONFIG.score.levelEvery, pct = ((state.lines || 0) % every) / every;
    $('#lvl-progress').style.width = (pct * 100).toFixed(0) + '%';
    $('#lvl-pct').textContent = Math.round(pct * 100) + '%';
    // 20%, 50% e 80% do caminho até o próximo nível: o percentual pulsa (indicador visual de progresso real)
    var mark = pct >= 0.8 ? 80 : pct >= 0.5 ? 50 : pct >= 0.2 ? 20 : 0;
    if (mark > lastPctMark && mark > 0 && settings.anim !== 'off') { var el = $('#lvl-pct'); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
    lastPctMark = mark;
  }

  /* ---------------- avisos em fila (js/ui.js) ---------------- */
  var toasts = window.MZUI.Toasts({
    onTrophy: function () { Sound.record(); },
    place: function (el) { // na partida, logo abaixo do placar; com uma janela aberta, embaixo da tela
      var low = overlayOpen();
      el.classList.toggle('bottom', low);
      el.style.top = !low && screens.game.classList.contains('active') ? Math.round($('#score').getBoundingClientRect().bottom + 6) + 'px' : '';
    }
  });
  function toast(title, text, kind) { toasts.show(title, text, kind); }

  /* ---------------- progresso local ---------------- */
  var stats;
  var hadStats = !!store.get('gb.stats', null); // v1.23: para o aviso de novidades saber se é instalação nova
  try { stats = Progress.normalize(store.get('gb.stats', null)); } catch (e) { stats = Progress.newStats(); }
  // v1.13: recordes feitos na escala antiga de pontos (antes da v1.11) são zerados uma vez.
  // Conquistas, estrelas, estilos e estatísticas de jogo continuam.
  (function resetOldRecords() {
    var raw = store.get('gb.stats', null);
    if (!raw || raw.scale === 2) return;
    stats.best = { classic: 0, zen: 0 };
    stats.daily = { day: stats.daily.day, best: 0, played: stats.daily.played };
    store.del('gb.records'); store.del('gb.best');
    stats.scale = 2;
    store.set('gb.stats', stats);
  })();
  (function migrateOld() { // versões 1.0–1.4 guardavam recorde e partida sem separar por modo
    var oldBest = Number(store.get('gb.best', 0)) || 0;
    if (oldBest > stats.best.classic) stats.best.classic = oldBest;
    var oldSave = store.get('gb.save', null), saved = true;
    if (oldSave && !store.get('gb.save.classic', null)) { oldSave.mode = 'classic'; saved = store.set('gb.save.classic', oldSave); }
    // só apaga as chaves antigas se as novas foram gravadas (armazenamento cheio não perde dados)
    if (saved && store.set('gb.stats', stats)) { store.del('gb.save'); store.del('gb.best'); }
  })();
  function today() { return Progress.dateKey(); }
  var wiping = false; // durante "Apagar todos os dados" nada é gravado
  function saveStats() { if (!wiping) store.set('gb.stats', stats); }
  // v1.24: Temporada 1 — recordes zeram; o recorde antigo fica guardado como "lendário" (js/season.js)
  var seasonNews = null;
  var forcedEvent = /[?&]debug\b/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? (/[?&]event=([a-z]+)/.exec(location.search) || [])[1] : null;
  function eventNow() { return Events.current(today(), forcedEvent); } // v1.24: evento por data (Semana do Terror)
  (function startSeason() {
    var r = Season.startSeason(stats);
    if (stats.season !== Season.SEASON) return;
    var old = store.get('gb.records', null);
    if (r.started && old) { store.set('gb.records.s0', old); store.del('gb.records'); }
    if (r.started) ['classic', 'daily'].forEach(function (m) { var sv = store.get('gb.save.' + m, null); if (sv && typeof sv === 'object') { sv.startBest = 0; store.set('gb.save.' + m, sv); } });
    store.set('gb.stats', stats);
    if (r.started) seasonNews = r;
  })();
  try { Progress.ensureMissions(stats, today()); } catch (e) { stats = Progress.newStats(); Progress.ensureMissions(stats, today()); }
  if (!Progress.isUnlocked(stats, settings.blocks)) settings.blocks = 'classic';
  saveStats();

  // conquistas e missões feitas no meio da partida não interrompem o jogo: aparecem juntas no fim da partida
  var pendingRewards = [];
  function inPlay() { return !!state && screenIs('game') && !state.over && !locked && state.mode !== 'tutorial'; }
  function reward(kind, title, text) {
    if (inPlay() || (state && screenIs('game') && (locked || state.over))) pendingRewards.push({ kind: kind, title: title, text: text }); // v1.24: no fim de partida tudo vai para o cartão
    else toast(title, text, kind === 'trophy' ? 'trophy' : '');
  }
  function flushRewards() { // v1.24: no máximo 1 aviso de resumo (antes: um aviso por conquista, cobrindo a tela)
    var list = pendingRewards; pendingRewards = [];
    if (!list.length) return;
    if (list.length === 1) { toast(list[0].title, list[0].text, list[0].kind === 'trophy' ? 'trophy' : ''); return; }
    toast(T('{n} novidades nesta partida', { n: list.length }), list.slice(0, 3).map(function (r) { return r.title; }).join(' · '), 'trophy');
  }
  function reportMissions(list) { (list || []).forEach(function (m) { reward('mission', T('Missão concluída ★'), T(m.text) + ' · +25 XP'); gainXp(25); }); }
  /* v1.24: XP do jogador e sequência de dias */
  function gainXp(n) {
    var r = Season.addXp(stats, n);
    r.levelsUp.forEach(function (lv) {
      var t = Season.titleFor(lv), tNew = t !== Season.titleFor(lv - 1);
      reward('trophy', T('Você subiu para o nível {n} de jogador!', { n: lv }), tNew ? T('Novo título: {t}', { t: T(t) }) : T('Continue jogando para o próximo nível.'));
    });
    return r;
  }
  function gameXpNow(extra) { // XP da partida que terminou; se ela continuar (reviver/desfazer) e terminar de novo, só a diferença
    if (!state) return null;
    var wk = Season.isWeekend(), base = (extra != null ? extra : Season.gameXp({ lines: state.lines, score: state.score }, false));
    var newBase = Math.max(0, base - (state.xpBase || 0)), give = wk ? newBase * 2 : newBase; // só o dobro do que foi ganho no fim de semana
    if (state.xpRes && !give) return state.xpRes;
    var chest = state.mode !== 'tutorial' ? Season.openChest(stats, today(), Math.random) : null; // v1.24: baú da 1ª partida do dia
    if (chest) { chest.xp = wk ? chest.xp * 2 : chest.xp; gainXp(chest.xp); state.chest = chest; }
    var r = gainXp(give); r.weekend = wk; r.gained = (state.xpGiven || 0) + give;
    state.xpBase = Math.max(state.xpBase || 0, base); state.xpGiven = r.gained; state.xpRes = r; saveStats();
    return r;
  }
  function touchStreak() {
    var r = Season.touchStreak(stats, today());
    if (!r.changed) return;
    if (r.reward) { gainXp(r.reward); reward('trophy', T('🔥 {n} dias seguidos!', { n: r.days }), T('Prêmio da sequência: +{x} XP', { x: r.reward })); }
    else if (r.usedShield) reward('mission', T('🛡️ Escudo usado'), T('Você pulou um dia, mas a sequência de {n} dias foi salva.', { n: r.days }));
    else if (r.days > 1) reward('mission', T('🔥 {n} dias seguidos!', { n: r.days }), T('Volte amanhã para continuar.'));
  }
  function reportAchievements() {
    Progress.checkAchievements(stats, today()).forEach(function (a) { reward('trophy', T('Conquista: {name}', { name: a.name }), a.desc); });
  }
  function unlockedNow() { return Progress.unlocks(stats).filter(function (u) { return u.done; }).map(function (u) { return u.id; }); }
  function reportUnlocks(before) {
    Progress.unlocks(stats).forEach(function (u) {
      if (u.done && before.indexOf(u.id) === -1) toast(T('Novo estilo liberado!'), T('O estilo {name} já está na Coleção.', { name: u.name }));
    });
  }

  function modeOf() { return state && state.mode ? state.mode : 'classic'; }
  function challengeDef(id) { return Progress.CHALLENGES.filter(function (c) { return c.id === id; })[0] || Progress.CHALLENGES[0]; }
  function bestFor(mode) {
    if (mode === 'classic' || mode === 'zen') return stats.best[mode] || 0;
    if (mode === 'daily') return stats.daily.day === today() ? stats.daily.best : 0;
    if (mode === 'weekly') return weeklyData().best || 0;
    return 0;
  }
  /* v1.24: Desafio da Semana (js/weekly.js) — guardado em gb.weekly; placar dos amigos em gb.galera */
  function weekNow() { return Season.weekKey(today()); }
  function weeklyData() {
    var d = store.get('gb.weekly', null);
    return d && d.week === weekNow() && typeof d.best === 'number' ? d : { week: weekNow(), best: 0, moves: '' };
  }
  function galera() {
    var g = store.get('gb.galera', null);
    if (!g || g.week !== weekNow() || !Array.isArray(g.list)) g = { week: weekNow(), list: [] };
    g.list = g.list.filter(function (e) { return e && typeof e.name === 'string' && typeof e.score === 'number' && isFinite(e.score); }).slice(0, 50);
    return g;
  }
  function weeklyPlace(score, record) { // v1.24: posição na galera no fim do Desafio da Semana
    var others = galera().list.filter(function (x) { return !x.me; }), best = Math.max(score, bestFor('weekly'));
    if (!others.length) return (record ? '' : T('Melhor da semana: {n}', { n: fmt(best) }) + ' · ') + T('Mande seu código para a galera e veja quem faz mais.');
    var pos = 1 + others.filter(function (x) { return x.score > best; }).length;
    return T('Você está em {p}º de {t} na galera.', { p: pos, t: others.length + 1 }) + (record ? '' : ' ' + T('Melhor da semana: {n}', { n: fmt(best) }));
  }
  function nick() { return Weekly.cleanName(settings.nick || ''); }
  function setBest(mode, v) {
    if (mode === 'classic' || mode === 'zen') stats.best[mode] = v;
    else if (mode === 'weekly') {
      if (!state || state.week !== weekNow()) return;
      store.set('gb.weekly', { week: state.week, best: v, moves: state.moves || '' }); // as jogadas viram o código de prova
      if (nick() || galera().list.some(function (x) { return x.me; })) addMineToGalera();
    }
    else if (mode === 'daily') {
      if (!state || state.day !== today()) return; // partida que atravessou a meia-noite não conta para hoje
      if (stats.daily.day !== today()) stats.daily = { day: today(), best: 0, played: 0 };
      stats.daily.best = v;
    }
  }

  /* ---------------- partidas salvas (uma por modo) ---------------- */
  function saveKey(mode) { return 'gb.save.' + mode; }
  function saveGame() {
    if (wiping || !state || state.mode === 'tutorial') return;
    if (state.mode === 'zen' || (!state.over && !locked)) store.set(saveKey(modeOf()), state); // Zen nunca termina
  }
  function loadSaved(mode) {
    var s = store.get(saveKey(mode), null);
    if (!Logic.isValidState(s)) return null;
    if (mode !== 'zen' && (s.over || !Logic.hasAnyMove(s))) return null;
    if (mode === 'daily' && s.day !== today()) return null;
    if (mode === 'weekly' && (s.week !== weekNow() || typeof s.moves !== 'string')) return null;
    if (mode === 'event' && !eventNow()) return null;
    if (mode === 'challenge' && !Progress.CHALLENGES.some(function (c) { return c.id === s.chId; })) return null;
    s.mode = mode;
    return s;
  }
  function hasSave(mode) { return !!loadSaved(mode); }

  /* ---------------- começar partidas ---------------- */
  var lastSnap = null, lastStatsSnap = null, playClock = 0, timers = [];
  function later(fn, ms) { var id = setTimeout(function () { timers = timers.filter(function (t) { return t !== id; }); fn(); }, ms); timers.push(id); return id; }
  function cancelLater() { timers.forEach(clearTimeout); timers = []; clearTimeout(gameOverTimer); }
  function resetBoardUi() {
    cancelLater();
    locked = false; anims = []; drag = null; lastSnap = null; lastStatsSnap = null; tutTarget = null;
    dragCanvas.hidden = true;
    slots.forEach(function (s) { s.classList.remove('dragging', 'shake', 'kb-selected'); });
    fx.innerHTML = '';
    $('#coach').hidden = true;
    closeAllOverlays();
  }

  /** mode: classic | zen | challenge | daily. opts: { resume, chId } */
  function startGame(mode, opts) {
    flushRewards(); // recompensas de uma partida interrompida aparecem como avisos
    opts = opts || {};
    mode = mode || 'classic';
    resetBoardUi();
    var saved = opts.resume ? loadSaved(mode) : null;
    if (saved) state = saved;
    else {
      state = Logic.newGame();
      state.mode = mode;
      state.seed = Math.floor(Math.random() * 4294967296);
      state.undoLeft = mode === 'daily' ? 0 : 1;
      state.counted = false;
      if (mode === 'challenge') {
        var def = challengeDef(opts.chId);
        state.chId = def.id;
        state.board = Progress.boardFromRows(def.board, SIZE);
        state.gems = Progress.gemsFromRows(def.board, SIZE); state.gemsGot = 0; // v1.17: Aventura — gemas
        state.queue = Logic.makeQueue(def.seed, def.pieces);
        state.pieces = state.queue.splice(0, 3);
      } else if (mode === 'classic' && !(stats.gamesByMode && stats.gamesByMode.classic) && !(stats.best && stats.best.classic)) {
        state.easy = true; // v1.24 (dono): primeira partida do Clássico mais fácil + meta da medalha de Madeira
      } else if (mode === 'weekly') { // mesmas peças para todo mundo na semana; sem desfazer e sem reviver
        var wg = Weekly.newGame(weekNow());
        state.seed = wg.seed; state.week = wg.week; state.moves = ''; state.pieces = wg.pieces; state.undoLeft = 0;
      } else if (mode === 'daily') {
        var d = Progress.daily(today());
        state.day = d.day;
        state.queue = Logic.makeQueue(d.seed, d.pieces);
        state.pieces = state.queue.splice(0, 3);
        if (stats.daily.day !== d.day) stats.daily = { day: d.day, best: 0, played: 0 };
        stats.daily.played++;
      }
      state.over = !Logic.hasAnyMove(state);
      state.startBest = bestFor(mode);
      saveStats();
    }
    if (typeof state.undoLeft !== 'number') state.undoLeft = mode === 'daily' || mode === 'weekly' ? 0 : 1;
    if (typeof state.startBest !== 'number') state.startBest = bestFor(mode);
    if (!state.themeId) state.themeId = THEMES[0].id; // toda partida nova começa no visual Clássico
    themeIdx = Themes.indexOfId(state.themeId);
    applyTheme(themeIdx, false);
    if (state.rare && typeof state.rare === 'object') Object.keys(state.rare).forEach(function (k) { var i = +k; if (!(Number.isInteger(i) && i >= 0 && i < SIZE * SIZE) || !/^(r[1-3]|pk)$/.test(state.rare[k])) delete state.rare[k]; }); else delete state.rare;
    state.pieces.forEach(function (p) { if (p && p.rk && !(/^(r[1-3]|pk)$/.test(p.rk.t) && SHAPES[p.s].cells[p.rk.k])) delete p.rk; });
    tagRares();
    displayedScore = state.score;
    $('#score').textContent = fmt(state.score);
    updateComboChip();
    show('game');
    updateHud();
    playClock = Date.now();
    saveGame();
    requestAnimationFrame(function () { layout(); drawTray(true); enterBoard(); });
    if (saved && mode === 'zen' && (state.over || !Logic.hasAnyMove(state))) { state.over = true; locked = true; later(showGameOver, 300); }
  }

  function enterBoard() { boardBox.classList.remove('enter'); void boardBox.offsetWidth; boardBox.classList.add('enter'); }

  /* ---------------- painel de cima: recorde/objetivo/desfazer ---------------- */
  /** Multiplicador do nível em texto curto: ×1,35 · ×3,3 · ×15 · ×67. */
  function multText(level) {
    var m = Logic.multFor(level);
    return m >= 10 ? I18n.fmt(m) : m.toLocaleString(I18n.locale(), { maximumFractionDigits: m >= 3 ? 1 : 2 });
  }
  function updateLevelChip() {
    if (!state) return;
    var lv = Logic.levelFor(state.lines || 0), chip = $('#lvl-chip');
    chip.hidden = state.mode === 'tutorial' && tutStep < 3;
    $('#lvl-n').setAttribute('data-label', T('Fase {n}', { n: '' }).trim());
    $('#lvl-n').textContent = lv; $('#lvl-m').textContent = '×' + multText(lv); $('#lvl-m').hidden = lv <= 1; // v1.23: ×1 não diz nada
    chip.setAttribute('title', T('Multiplicador ×{m}', { m: multText(lv) }));
  }
  function updateHud() {
    updateLevelChip();
    if (!state) return;
    updateBoardMood();
    var m = modeOf();
    var icon = { classic: '#i-crown', zen: '#i-leaf', challenge: '#i-flag', daily: '#i-cal', weekly: '#i-trophy', event: '#i-star', tutorial: '#i-help' }[m] || '#i-crown';
    $('#best-icon').setAttribute('href', icon);
    var label = '', val = '';
    if (m === 'classic') { label = T('Recorde'); val = fmt(Math.max(bestFor(m), state.score)); }
    else if (m === 'zen') { label = T('Modo'); val = T('Zen'); }
    else if (m === 'daily') { label = T('Melhor de hoje'); val = fmt(Math.max(bestFor(m), state.score)); }
    else if (m === 'weekly') { label = T('Melhor da semana'); val = fmt(Math.max(bestFor(m), state.score)); }
    else if (m === 'challenge') { label = T('Desafio'); val = T(challengeDef(state.chId).name); }
    else if (m === 'event') { label = T('Evento'); val = T('Semana do Terror'); }
    else { val = T('Tutorial'); }
    $('#best-label').textContent = label;
    $('#best').textContent = val;
    $('#best-mini').classList.toggle('text', m === 'zen' || m === 'challenge' || m === 'tutorial' || m === 'event');
    var bestNow = (m === 'classic' || m === 'daily' || m === 'weekly') ? bestFor(m) : 0; // v1.23: recorde discreto; acende quando você chega perto
    $('#best-mini').classList.toggle('near', bestNow > 0 && state.score >= bestNow * 0.8);

    var u = $('#btn-undo'), canUndo = m !== 'tutorial' && m !== 'daily' && m !== 'weekly';
    u.hidden = !canUndo;
    u.disabled = !lastSnap || state.undoLeft <= 0 || locked;
    $('#undo-count').textContent = Math.max(0, state.undoLeft);
    $('#undo-count').hidden = u.disabled; // v1.16 (QA): sem jogada para desfazer (ex.: após reabrir), o contador some
    u.setAttribute('aria-label', T('Desfazer última jogada ({n} restante)', { n: Math.max(0, state.undoLeft) }));

    var gb = $('#goal-bar');
    if (m === 'challenge') {
      var def = challengeDef(state.chId), st = Progress.challengeStatus(def, state);
      gb.hidden = false;
      $('#goal-text').textContent = Progress.goalText(def);
      $('#goal-progress').style.width = (100 * st.cur / st.target).toFixed(1) + '%';
      $('#goal-extra').textContent = (def.goal === 'score' ? fmt(st.cur) + '/' + fmt(st.target) : st.cur + '/' + st.target) + ' · ' + T('{n} peças', { n: st.piecesLeft });
    } else if (m === 'daily') {
      gb.hidden = false;
      $('#goal-text').textContent = T('Desafio do dia');
      $('#goal-progress').style.width = (100 * state.placed / Progress.DAILY_PIECES).toFixed(1) + '%';
      $('#goal-extra').textContent = T('{n} peças restantes', { n: Progress.DAILY_PIECES - state.placed });
    } else if (m === 'classic' && state.easy && state.score < 5000) { // v1.24: meta da primeira partida
      gb.hidden = false;
      $('#goal-text').textContent = '🪵 ' + T('Primeira medalha');
      $('#goal-progress').style.width = Math.min(100, state.score / 50).toFixed(1) + '%';
      $('#goal-extra').textContent = T('Faça {n} pontos', { n: fmt(5000) });
    } else if (m === 'event') { // v1.24: Semana do Terror
      var evg = eventNow(), goal = evg ? evg.goal : 25, got = Math.min(goal, state.pk || 0);
      gb.hidden = false;
      $('#goal-text').textContent = '🎃 ' + T('Desafio do evento');
      $('#goal-progress').style.width = (100 * got / goal).toFixed(1) + '%';
      $('#goal-extra').textContent = state.pkDone ? T('Concluído!') : T('{a}/{b} abóboras', { a: got, b: goal });
    } else if (m === 'weekly') { // v1.24: posição no placar da galera
      gb.hidden = false;
      var gl = galera().list.filter(function (x) { return !x.me; }), ahead = gl.filter(function (x) { return x.score > state.score; }).sort(function (a, b) { return a.score - b.score; })[0];
      $('#goal-text').textContent = T('Desafio da Semana');
      $('#goal-progress').style.width = ahead ? Math.min(100, 100 * state.score / ahead.score).toFixed(1) + '%' : (gl.length ? '100%' : '0%');
      $('#goal-extra').textContent = ahead ? T('Faltam {n} para passar {name}', { name: ahead.name, n: fmt(ahead.score - state.score) }) : (gl.length ? T('Você está em 1º na galera!') : T('Mesmas peças para todos'));
    } else gb.hidden = true;
  }

  /* ---------------- depois de cada jogada ---------------- */
  function afterMove(res) {
    var m = modeOf();
    if (m === 'tutorial') { afterTutorialMove(res); return; }
    var now = Date.now();
    stats.timeMs += Math.min(60000, now - playClock); playClock = now;
    var before = unlockedNow();
    Progress.ensureMissions(stats, today());
    if (!state.counted) { state.counted = true; reportMissions(Progress.onGameStart(stats, m)); }
    if (m !== 'tutorial' && stats.streak && stats.streak.last !== today()) touchStreak(); // v1.24: conta também quem só continua partida salva
    // no Zen, depois do primeiro alívio os pontos não valem para conquistas de pontos (seria fácil demais)
    reportMissions(Progress.onMove(stats, res, m === 'zen' && state.reliefs ? null : state));
    if ((m === 'classic' || m === 'zen' || m === 'daily' || m === 'weekly') && state.score > bestFor(m)) setBest(m, state.score);
    if (m === 'classic' || m === 'zen' || m === 'daily') Season.unlockRares(stats, state.score).forEach(function (rr) { // v1.24: bloco raro liberado
      reward('trophy', T('Bloco raro liberado: {name}!', { name: T(rr.name) }), T('A partir de agora ele aparece às vezes nas suas peças. Limpe para ver o brilho!'));
    });
    reportAchievements();
    reportUnlocks(before);
    saveStats();

    if (m === 'challenge') {
      var def = challengeDef(state.chId), st = Progress.challengeStatus(def, state);
      updateHud();
      if (st.done) { finishChallenge(true); return; }
      if (st.failed || res.over) { finishChallenge(false, res.over && !(def.pieces && state.placed >= def.pieces)); return; }
      saveGame();
      return;
    }
    updateHud();
    if (res.over && m === 'zen') { gameXpNow(); store.set(saveKey('zen'), state); scheduleGameOver(); }
    else if (res.over) { store.del(saveKey(m)); if (m === 'classic' || m === 'daily') addRecord(); if (m === 'weekly') addMineToGalera(); if (m !== 'tutorial') gameXpNow(); scheduleGameOver(); }
    else saveGame();
  }

  /* ---------------- recordes: as 10 maiores pontuações (js/ui.js) ---------------- */
  var Records = window.MZUI.Records;
  function records() { return Records.list(store); }
  function newGid() { return Records.newGid(); }
  function addRecord() {
    if (!state.gid) state.gid = newGid();
    Records.add(store, { gid: state.gid, score: state.score, mode: state.mode, lines: state.lines || 0, combo: state.maxCombo || 0, day: today() });
  }

  function scheduleGameOver() {
    locked = true;
    updateHud();
    var delay = settings.anim === 'off' ? 350 : 1300;
    if (settings.anim !== 'off') { anims.push({ type: 'gray', start: animNow(), dur: delay + 400 }); requestRender(); }
    gameOverTimer = later(showGameOver, delay);
  }

  function comboText(n) { return n >= 2 ? '×' + n : '—'; }
  function canUndoNow() { return !!lastSnap && state && state.undoLeft > 0 && modeOf() !== 'daily' && modeOf() !== 'weekly'; }

  function showGameOver() {
    var m = modeOf(), score = state.score;
    Sound.gameover();
    if (eventNow()) later(function () { Sound.howl(); }, 500); // v1.24: uivo no fim de partida (evento)
    haptic('gameover');
    if (m === 'zen') {
      showResult({
        title: T('Sem encaixes'), big: fmt(score), sub: T('No Zen a partida não acaba. Limpe as 3 linhas mais cheias e siga jogando.'),
        stats: [[fmt(state.lines), T('linhas')], [comboText(state.maxCombo), T('maior combo')], [fmt(bestFor('zen')), T('recorde Zen')]],
        buttons: [
          { label: T('Limpar e continuar'), cls: 'primary big', fn: zenContinue },
          canUndoNow() ? { label: T('Desfazer última jogada'), fn: undo } : null,
          { label: T('Recomeçar do zero'), fn: function () {
            showDialog({ title: T('Recomeçar o Zen?'), list: [T('A partida Zen atual ({n} pontos) será perdida.', { n: fmt(score) })],
              buttons: [{ label: T('Recomeçar'), cls: 'confirm', fn: function () { closeDialog(); store.del(saveKey('zen')); startGame('zen'); } },
                { label: T('Voltar'), cls: 'primary', fn: closeDialog }] });
          } },
          { label: T('Tela inicial'), cls: 'ghost-dark', fn: goHome }
        ]
      });
      announce(T('Sem encaixes. Você pode limpar 3 linhas e continuar.'));
      return;
    }
    var record = score > (state.startBest || 0) && score > 0;
    if (m === 'weekly') {
      showResult({
        title: T('Desafio da Semana'), badge: record ? T('Seu melhor da semana!') : '', big: fmt(score), countUp: score, record: record,
        sub: weeklyPlace(score, record),
        xp: state.xpRes,
        stats: [[fmt(state.lines), T('linhas')], [comboText(state.maxCombo), T('maior combo')], [String(Logic.levelFor(state.lines)), T('fase')]],
        buttons: [
          { label: T('Mandar meu placar para a galera'), cls: 'primary big', fn: function () { shareWeekly(); } },
          { label: T('Jogar de novo'), fn: function () { startGame('weekly'); } },
          { label: T('Placar da galera'), fn: function () { closeOverlay('#ov-over'); show('records'); } },
          { label: T('Tela inicial'), cls: 'ghost-dark', fn: goHome }
        ]
      });
      announce(T('Fim de partida. {n} pontos.', { n: score }));
      return;
    }
    var isDaily = m === 'daily';
    var piecesOut = isDaily && state.placed >= Progress.DAILY_PIECES;
    showResult({
      title: isDaily ? (piecesOut ? T('Desafio do dia concluído') : T('Sem mais encaixes')) : T('Sem mais encaixes'),
      badge: record ? (isDaily ? T('Melhor resultado de hoje!') : T('Novo recorde!')) : '',
      big: fmt(score), countUp: score, record: record,
      sub: (isDaily ? T('Melhor de hoje: {n}', { n: fmt(bestFor(m)) }) : T('Recorde: {n}', { n: fmt(bestFor(m)) })) +
        (record && state.startBest > 0 ? ' · ' + T('+{n} acima do recorde anterior', { n: fmt(score - state.startBest) }) : ''),
      medal: Season.medalFor(score), nextMedal: Season.nextMedal(score), score: score, xp: state.xpRes,
      stats: [[fmt(state.lines), T('linhas')], [comboText(state.maxCombo), T('maior combo')], [isDaily ? state.placed + '/' + Progress.DAILY_PIECES : String(Logic.levelFor(state.lines)), isDaily ? T('peças') : T('fase')]],
      buttons: [
        canRevive() ? { label: T('Continuar: 3 peças novas (grátis, 1×)'), cls: 'primary big revive', fn: revive } : null,
        { label: T('Jogar novamente'), cls: canRevive() ? '' : 'primary big', fn: function () { startGame(m); } },
        canUndoNow() ? { label: T('Desfazer última jogada ({n})', { n: state.undoLeft }), fn: undo } : null,
        { label: T('Compartilhar resultado'), fn: function () { shareResult(); } },
        { label: T('Tela inicial'), cls: 'ghost-dark', fn: goHome }
      ]
    });
    announce(T('Fim de partida. {n} pontos.', { n: score }) + (record ? ' ' + (isDaily ? T('Melhor resultado de hoje!') : T('Novo recorde!')) : ''));
  }

  var UNIT = { lines: 'linhas', score: 'pontos', combo: 'de combo', multi2: 'jogadas duplas', multi3: 'jogadas triplas', clears: 'tabuleiro vazio', gems: 'gemas' }; // traduzidos com T()
  function finishChallenge(won, stuck) {
    locked = true;
    updateHud();
    var def = challengeDef(state.chId), st = Progress.challengeStatus(def, state);
    var placed = state.placed, score = state.score, lines = state.lines, combo = state.maxCombo;
    store.del(saveKey('challenge'));
    var idx = Progress.CHALLENGES.indexOf(def), next = Progress.CHALLENGES[idx + 1], r = null;
    var nextOk = function () { return next && Progress.levelOpen(stats, next.id); }; // v1.17: fases dos capítulos novos abrem em sequência
    if (won) { // grava agora; sair ou desfazer durante a espera não muda o resultado
      var before = unlockedNow();
      r = Progress.onChallengeDone(stats, def.id, placed, def);
      var chRewards = Progress.grantChapterRewards(stats); // v1.17: capítulo completo → estilo raro na Coleção (uma vez só)
      reportMissions(r.missions); reportAchievements(); reportUnlocks(before); saveStats();
      chRewards.forEach(function (cr) { pendingRewards.push({ kind: 'trophy', title: T('Capítulo concluído: {name}', { name: T(cr.chapter.name) }), text: T('Novo estilo na Coleção: {name}', { name: skinName(cr.skin) }) }); }); // aparece no cartão do resultado
      lastSnap = null; updateHud();
    }
    if (state.mode === 'challenge') gameXpNow(won ? 30 + 15 * (r ? r.stars : 0) : 10);
    later(function () {
      if (won) {
        Sound.theme(); haptic('reward');
        showResult({
          title: T('Desafio concluído!'), stars: r.stars, big: T(def.name), xp: state.xpRes,
          sub: T('Você usou {p} de {t} peças. 3 estrelas: até {par} peças.', { p: placed, t: def.pieces, par: def.par }),
          stats: [[fmt(score), T('pontos')], [fmt(lines), T('linhas')], [comboText(combo), T('maior combo')]],
          buttons: [
            nextOk() ? { label: T('Próximo: {name}', { name: T(next.name) }), cls: 'primary big', fn: function () { openChallengeIntro(next.id); } } : null,
            { label: r.stars < 3 ? T('Tentar 3 estrelas') : T('Jogar de novo'), cls: nextOk() ? '' : 'primary big', fn: function () { startGame('challenge', { chId: def.id }); } },
            { label: T('Ver desafios'), fn: function () { closeOverlay('#ov-over'); show('challenges'); } },
            { label: T('Tela inicial'), cls: 'ghost-dark', fn: goHome }
          ]
        });
        announce(T('Desafio concluído com {n} estrelas.', { n: r.stars }));
      } else {
        Sound.gameover();
        showResult({
          title: T('Não foi desta vez'), big: T(def.name),
          sub: (stuck ? T('Nenhuma peça cabia mais.') : T('As peças acabaram.')) + ' ' +
            T('Progresso: {cur} de {target} {unit}. As peças são sempre as mesmas: dá para planejar.', { cur: st.cur, target: st.target, unit: T(UNIT[def.goal]) }),
          buttons: [
            { label: T('Tentar de novo'), cls: 'primary big', fn: function () { startGame('challenge', { chId: def.id }); } },
            canUndoNow() ? { label: T('Desfazer última jogada'), fn: undo } : null,
            { label: T('Ver desafios'), fn: function () { closeOverlay('#ov-over'); show('challenges'); } },
            { label: T('Tela inicial'), cls: 'ghost-dark', fn: goHome }
          ]
        });
        announce(T('Desafio não concluído.'));
      }
    }, settings.anim === 'off' ? 250 : 700);
  }

  /* ---------------- janela de resultado / diálogo ---------------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function buildCard(card, o, titleId) {
    card.innerHTML = '';
    var h = el('h2', '', o.title); h.id = titleId; card.appendChild(h);
    if (o.badge) card.appendChild(el('div', 'badge', o.badge));
    if (o.stars != null) {
      var row = el('div', 'stars-row'); row.setAttribute('aria-label', T('{n} de 3 estrelas', { n: o.stars }));
      for (var i = 0; i < 3; i++) { var sp = el('span', i < o.stars ? 'on' : ''); sp.innerHTML = '<svg width="34" height="34" aria-hidden="true"><use href="#i-star"/></svg>'; row.appendChild(sp); }
      card.appendChild(row);
    }
    if (o.big) card.appendChild(el('div', o.big.length > 9 ? 'final-score small' : 'final-score', o.big));
    if (o.sub) card.appendChild(el('p', 'muted', o.sub));
    if (o.medal || o.nextMedal) { // v1.24: medalha da partida (Bronze 50 mil · Prata 200 mil · Ouro 500 mil · Diamante 1 milhão)
      var md = el('div', 'medal-row' + (o.medal ? ' ' + o.medal.id : ''));
      if (o.medal) { md.appendChild(el('span', 'medal-ic', o.medal.icon)); md.appendChild(el('strong', '', T('Medalha de {m}', { m: T(o.medal.name) }))); }
      if (o.nextMedal) md.appendChild(el('small', '', T('Faltam {n} para {m}', { n: fmt(o.nextMedal.min - (o.score || 0)), m: o.nextMedal.icon + ' ' + T(o.nextMedal.name) })));
      card.appendChild(md);
    }
    if (o.xp) card.appendChild(xpBlock(o.xp));
    if (o.xp && state && state.chest && !state.chestShown) { // v1.24: baú do dia
      state.chestShown = true;
      var ch = el('div', 'chest-row' + (state.chest.big ? ' big' : ''));
      ch.appendChild(el('span', 'chest-ic', '🎁')); ch.appendChild(el('strong', '', T('Baú do dia: +{n} XP', { n: fmt(state.chest.xp) })));
      ch.appendChild(el('small', '', state.chest.big ? T('Prêmio grande! Volte amanhã para outro baú.') : T('Volte amanhã para outro baú.')));
      card.appendChild(ch); later(function () { Sound.record(); }, 600);
    }
    if (o.list) { var ul = el('ul', 'rules'); o.list.forEach(function (t) { ul.appendChild(el('li', '', t)); }); card.appendChild(ul); }
    if (o.stats) {
      var g = el('div', 'over-stats');
      o.stats.forEach(function (s2) { var d = el('div'); d.appendChild(el('strong', '', s2[0])); d.appendChild(el('span', '', s2[1])); g.appendChild(d); });
      card.appendChild(g);
    }
    var stack = el('div', 'stack');
    (o.buttons || []).filter(Boolean).forEach(function (b) {
      var bt = el('button', 'btn ' + (b.cls || ''), b.label);
      bt.addEventListener('click', function () { Sound.tap(); b.fn(); });
      stack.appendChild(bt);
    });
    card.appendChild(stack);
  }
  function xpBlock(x) {
    var b = el('div', 'xp-box' + (x.levelsUp && x.levelsUp.length ? ' up' : ''));
    var top = el('div', 'xp-top');
    top.appendChild(el('strong', 'xp-gain', '+' + fmt(x.gained) + ' XP' + (x.weekend ? ' ×2' : '')));
    top.appendChild(el('span', 'xp-lv', (x.levelsUp && x.levelsUp.length ? '⬆ ' : '') + T('Jogador nível {n}', { n: x.after.level })));
    b.appendChild(top);
    var bar = el('div', 'xp-bar'), fill = el('i');
    var pct = Math.round(100 * x.after.cur / x.after.need), from = x.levelsUp && x.levelsUp.length ? 0 : Math.round(100 * x.before.cur / x.before.need);
    fill.style.width = from + '%'; bar.appendChild(fill); b.appendChild(bar);
    setTimeout(function () { fill.style.width = pct + '%'; }, 250);
    b.appendChild(el('small', 'muted', T(x.after.title) + ' · ' + T('{c}/{n} XP para o próximo', { c: fmt(x.after.cur), n: fmt(x.after.need), l: x.after.level + 1 })));
    return b;
  }
  function showResult(o) {
    buildCard($('#over-card'), o, 'over-title');
    if (pendingRewards.length) { // o que foi conquistado nesta partida, com troféu dourado
      var box = el('div', 'rewards'), list = pendingRewards; pendingRewards = [];
      box.appendChild(el('h3', '', T('Nesta partida')));
      list.forEach(function (r) {
        var row = el('div', 'reward ' + r.kind);
        row.innerHTML = '<svg width="26" height="26" aria-hidden="true"><use href="#' + (r.kind === 'trophy' ? 'i-trophy' : 'i-star') + '"/></svg>';
        var tx = el('span', ''); tx.appendChild(el('strong', '', r.title)); tx.appendChild(el('small', '', r.text)); row.appendChild(tx);
        box.appendChild(row);
      });
      var stack = $('#over-card .stack');
      if (stack) $('#over-card').insertBefore(box, stack); else $('#over-card').appendChild(box);
      if (list.some(function (r) { return r.kind === 'trophy'; })) later(function () { Sound.record(); }, 500);
    }
    $('#over-card').classList.toggle('record', !!o.record); // moldura iluminada no recorde
    var big = $('#over-card .final-score');
    if (big && typeof o.countUp === 'number' && settings.anim !== 'off' && o.countUp > 0) { // pontuação final contando
      var t0 = performance.now(), dur = 900;
      (function step() {
        var k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        big.textContent = fmt(o.countUp * e);
        if (k < 1 && document.contains(big)) requestAnimationFrame(step);
      })();
    }
    if ((o.badge || o.stars === 3) && settings.anim === 'full') { // comemoração de recorde / 3 estrelas
      var cf = el('div', 'confetti'), cols = pal(THEMES[themeIdx]);
      for (var i = 0; i < 36; i++) {
        var p = el('i'); p.style.left = (Math.random() * 100) + '%'; p.style.background = cols[i % cols.length];
        p.style.animationDelay = (Math.random() * 0.5) + 's'; p.style.transform = 'rotate(' + (Math.random() * 180) + 'deg)'; cf.appendChild(p);
      }
      $('#over-card').appendChild(cf);
    }
    if (o.badge) Sound.record();
    closeOverlay('#ov-settings'); closeOverlay('#ov-pause'); // v1.16 (QA): fim de jogo nunca abre por cima de outra janela
    openOverlay('#ov-over');
    setTimeout(function () { var b = $('#over-card .btn'); if (b) b.focus({ preventScroll: true }); }, 60);
  }
  function showDialog(o) {
    buildCard($('#dialog-card'), o, 'dialog-title');
    openOverlay('#ov-dialog');
    setTimeout(function () { var b = $('#dialog-card .btn'); if (b) b.focus({ preventScroll: true }); }, 60);
  }
  function closeDialog() { closeOverlay('#ov-dialog'); }

  function openChallengeIntro(id) {
    var def = challengeDef(id), rec = stats.challenges[def.id];
    if (!Progress.levelOpen(stats, def.id)) { toast(T('Fase bloqueada'), T('Vença a fase anterior para abrir.')); return; } // v1.17
    closeOverlay('#ov-over');
    showDialog({
      title: T(def.name), stars: rec ? rec.stars : 0,
      list: Progress.describeChallenge(def).concat(rec ? [T('Seu melhor: {n} peças.', { n: rec.bestPieces })] : []),
      buttons: [
        { label: T('Começar'), cls: 'primary big', fn: function () { closeDialog(); confirmReplace('challenge', function () { startGame('challenge', { chId: def.id }); }, function () { startGame('challenge', { resume: true }); }); } },
        { label: T('Voltar'), cls: 'ghost-dark', fn: closeDialog }
      ]
    });
  }

  /** Pede confirmação antes de descartar uma partida salva do mesmo modo. */
  function confirmReplace(mode, startNew, resume) {
    if (!hasSave(mode)) { startNew(); return; }
    var names = { classic: 'Clássico', zen: 'Zen', challenge: 'Desafio', daily: 'Desafio do dia', weekly: 'Desafio da Semana', event: 'Desafio do evento' };
    showDialog({
      title: T('Partida em andamento'),
      list: [T('Você tem uma partida do modo {mode} salva.', { mode: T(names[mode]) }), T('Se começar outra, a partida salva será perdida.')],
      buttons: [
        { label: T('Continuar a partida salva'), cls: 'primary big', fn: function () { closeDialog(); resume(); } },
        { label: T('Começar nova (perder a salva)'), fn: function () { closeDialog(); store.del(saveKey(mode)); startNew(); } },
        { label: T('Cancelar'), cls: 'ghost-dark', fn: closeDialog }
      ]
    });
  }

  /* ---------------- desfazer (1 por partida) ---------------- */
  function undo() {
    if (!canUndoNow()) return;
    var left = state.undoLeft - 1, snap = JSON.parse(lastSnap);
    cancelLater();
    if (lastStatsSnap) { var t = stats.timeMs; stats = Progress.normalize(JSON.parse(lastStatsSnap)); stats.timeMs = t; saveStats(); }
    lastStatsSnap = null;
    closeOverlay('#ov-over');
    if (drag) endDrag(false);
    state = snap; state.undoLeft = left; lastSnap = null; locked = false; anims = []; fx.innerHTML = '';
    themeIdx = Themes.indexOfId(state.themeId); applyTheme(themeIdx, false);
    displayedScore = state.score; $('#score').textContent = fmt(state.score);
    updateComboChip(); updateHud(); drawTray(false); requestRender(); saveGame();
    toast(T('Jogada desfeita'), left > 0 ? '' : T('Este era o desfazer da partida.'));
    announce(T('Jogada desfeita.'));
  }

  /* ---------------- v1.17: reviver (Clássico) ---------------- */
  // Grátis, 1× por partida, sem anúncio: troca as peças por 3 que cabem. Não apaga blocos nem muda pontos/recorde.
  function canRevive() { return modeOf() === 'classic' && state && state.over && !(state.revives > 0); }
  function revive() {
    if (!canRevive()) return;
    cancelLater(); closeOverlay('#ov-over');
    if (!Logic.revive(state, Math.random)) { toast(T('Nenhuma peça cabe mais'), ''); return; }
    locked = false; lastSnap = null; anims = anims.filter(function (a) { return a.type !== 'gray'; }); fx.innerHTML = '';
    if (settings.anim !== 'off') { anims.push({ type: 'shine', start: animNow(), dur: 900 }); var fl = $('#theme-flash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); }
    Sound.transform(true); haptic('reward');
    drawTray(true); slots.forEach(function (sl) { sl.classList.remove('revived'); void sl.offsetWidth; sl.classList.add('revived'); });
    playClock = Date.now(); updateHud(); saveGame(); requestRender();
    toast('✦ ' + T('Continuação!'), T('3 peças novas. Seus pontos foram mantidos.'));
    announce(T('Continuação: 3 peças novas que cabem no tabuleiro.'));
  }

  /* ---------------- Zen: continuar sem fim de partida ---------------- */
  function zenContinue() {
    closeOverlay('#ov-over');
    var cleared = Logic.zenRelief(state, rngFor(state)), now = animNow();
    locked = false; lastSnap = null;
    anims = anims.filter(function (a) { return a.type !== 'gray'; });
    if (settings.anim !== 'off') {
      var zs = curSkin(), custom = Skins.isCustom(zs), cd = custom ? Skins.breakMs(zs) : 320;
      anims.push({ type: 'clear', cells: cleared.map(function (o) { return { r: o.r, c: o.c, color: o.color, d: o.c * 25 }; }), theme: boardTheme(),
        skin: custom ? zs : null, start: now, cellDur: cd, dur: SIZE * 25 + cd });
    }
    Sound.breakSkin(curSkin(), 3);
    drawTray(true); updateHud(); saveGame(); requestRender();
    announce(T('Três linhas limpas. Continue jogando.'));
    if (state.over) scheduleGameOver();
  }

  /* ---------------- compartilhar (só quando o jogador toca) ---------------- */
  function shareText() {
    var m = modeOf(), names = { classic: T('modo Clássico'), zen: T('modo Zen'), daily: T('Desafio do dia {d}', { d: state.day || '' }), challenge: T('desafio {name}', { name: state.chId ? T(challengeDef(state.chId).name) : '' }) };
    var txt = T('Kablox — {n} pontos no {mode}', { n: fmt(state.score), mode: names[m] }) + (state.maxCombo > 1 ? T(', combo ×{n}', { n: state.maxCombo }) : '') + '.';
    if (!INLINE && /^https:$/.test(location.protocol)) txt += '\n' + location.origin + location.pathname;
    return txt;
  }
  /* v1.22 (pedido do dono): imagem do resultado para story/WhatsApp — tabuleiro final, pontos, combo, frase de desafio e link.
   * Feita na hora num canvas (nada sai do aparelho sozinho; quem compartilha é a pessoa). */
  var GAME_NAME = 'KABLOX', SITE_URL = 'kablox-jogo.github.io';
  function makeShareImage() {
    var W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), th = THEMES[themeIdx], bt = boardTheme(), m = modeOf();
    var bg = g.createLinearGradient(0, 0, W * 0.3, H); bg.addColorStop(0, th.bg[0]); bg.addColorStop(1, th.bg[1]);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    var glow = g.createRadialGradient(W / 2, 120, 40, W / 2, 120, 900); glow.addColorStop(0, 'rgba(255,255,255,.22)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    var disp = function (px) { return px + "px 'Russo One', 'Rubik', sans-serif"; }, body = function (px) { return '800 ' + px + "px 'Rubik', sans-serif"; };
    var shadowText = function (txt, x, y, fill, sh) { g.fillStyle = sh || 'rgba(0,0,0,.45)'; g.fillText(txt, x, y + 10); g.fillStyle = fill; g.fillText(txt, x, y); };
    // nome do jogo (última letra em amarelo, como na tela inicial)
    g.font = disp(150); var head = GAME_NAME.slice(0, -1), tail = GAME_NAME.slice(-1), wHead = g.measureText(head).width, wTail = g.measureText(tail).width, x0 = W / 2 - (wHead + wTail) / 2;
    g.textAlign = 'left'; shadowText(head, x0, 230, '#ffffff'); shadowText(tail, x0 + wHead, 230, '#ffc21e', '#b4410a'); g.textAlign = 'center';
    var modeName = { classic: T('Clássico'), zen: T('Zen'), daily: T('Desafio do dia'), weekly: T('Desafio da Semana'), challenge: state.chId ? T(challengeDef(state.chId).name) : T('Desafios') }[m] || T('Clássico');
    g.font = body(46); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(modeName.toUpperCase(), W / 2, 320);
    g.font = disp(170); shadowText(fmt(state.score), W / 2, 500, '#ffffff');
    var info = [];
    if (state.maxCombo > 1) info.push(T('Combo máx. ×{n}', { n: state.maxCombo }));
    info.push(T('Fase {n}', { n: Logic.levelFor(state.lines || 0) }));
    g.font = body(48); g.fillStyle = '#ffd54a'; g.fillText(info.join('  ·  '), W / 2, 580);
    // tabuleiro final
    var bs = 800, bx = (W - bs) / 2, by = 640, pad = 22, cell = (bs - pad * 2) / SIZE, px = Math.round(cell);
    Themes.roundRect(g, bx, by, bs, bs, 44); g.fillStyle = bt.board; g.fill();
    g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.18)'; g.stroke();
    for (var r = 0; r < SIZE; r++) for (var cc = 0; cc < SIZE; cc++) {
      var v = state.board[r * SIZE + cc];
      g.drawImage(sprite(bt, v < 0 ? -1 : v, px), bx + pad + cc * cell, by + pad + r * cell, cell, cell);
    }
    // v1.24: medalha, nível do jogador e sequência de dias
    var md = Season.medalFor(state.score), plv = Season.levelOf(stats.xp || 0), skd = Season.streakNow(stats, today()), tags = [];
    if (md) tags.push(md.icon + ' ' + T('Medalha de {m}', { m: T(md.name) }));
    tags.push(T('Jogador nível {n}', { n: plv.level }));
    if (skd > 1) tags.push('🔥 ' + skd);
    g.font = body(46); g.fillStyle = 'rgba(255,255,255,.92)'; g.fillText(tags.join('  ·  '), W / 2, 1520);
    g.font = disp(76); shadowText(T('Me bate se for capaz!'), W / 2, 1630, '#ffffff');
    g.font = body(50); g.fillStyle = '#4fe3ff'; g.fillText(T('Jogue grátis: {url}', { url: SITE_URL }), W / 2, 1720);
    return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error('sem imagem')); }, 'image/png'); });
  }
  function saveImage(blob) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = GAME_NAME.toLowerCase() + '-resultado.png'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast(T('Imagem salva!'), T('Está na sua galeria ou em Downloads — poste no story e desafie os amigos.'));
  }
  function shareResult() {
    var text = shareText();
    var fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load("150px 'Russo One'"), document.fonts.load("800 50px 'Rubik'")]).catch(function () {}) : Promise.resolve();
    fontsReady.then(makeShareImage).then(function (blob) {
      var file = null;
      try { file = new File([blob], GAME_NAME.toLowerCase() + '-resultado.png', { type: 'image/png' }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: text }).catch(function (err) { if (!err || err.name !== 'AbortError') saveImage(blob); });
      }
      saveImage(blob);
    }).catch(function () { shareText_(); });
    function copy() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast(T('Resultado copiado'), T('Cole onde quiser compartilhar.')); },
          function () { toast(T('Copie o resultado'), text); });
      } else toast(T('Copie o resultado'), text);
    }
    function shareText_() { if (navigator.share) navigator.share({ text: text }).catch(function (err) { if (!err || err.name !== 'AbortError') copy(); }); else copy(); }
  }

  /* ---------------- tutorial interativo (pulável, repetível na Ajuda) ---------------- */
  var TUTORIAL = [
    { text: 'Arraste a peça de baixo até a área destacada.', board: null, pieces: [{ s: 9, c: 1 }], target: [[3, 3], [3, 4], [4, 3], [4, 4]], need: 'place' },
    { text: 'Complete a linha: quando ela fica cheia, ela some e vale pontos.', board: ['........', '........', '........', '........', '........', '........', '........', '333333..'],
      pieces: [{ s: 1, c: 4 }], target: [[7, 6], [7, 7]], need: 'clear' },
    { text: 'Colunas também valem. Limpar várias de uma vez rende mais pontos!', board: ['...2....', '...2....', '...2....', '...2....', '555.5555', '...2....', '...2....', '...2....'],
      pieces: [{ s: 0, c: 2 }], target: [[4, 3]], need: 'clear' },
    { text: 'Esta é sua 10ª linha: a cada 10 linhas você sobe de nível e TODOS os pontos passam a ser multiplicados!',
      board: ['........', '........', '........', '........', '........', '........', '........', '3333333.'],
      pieces: [{ s: 0, c: 5 }], target: [[7, 7]], need: 'clear', lines: 9 }
  ];
  var tutStep = 0, tutTarget = null, tutFrom = 'play';

  function startTutorial(from) {
    tutFrom = from || 'play';
    resetBoardUi();
    state = Logic.newGame(); state.mode = 'tutorial'; state.undoLeft = 0;
    tutStep = 0;
    themeIdx = 0; applyTheme(0, false);
    displayedScore = 0; $('#score').textContent = '0';
    updateComboChip();
    show('game');
    loadTutorialStep();
    requestAnimationFrame(function () { layout(); drawTray(true); });
  }
  function loadTutorialStep() {
    var st = TUTORIAL[tutStep];
    state.board = Progress.boardFromRows(st.board, SIZE);
    state.pieces = [st.pieces[0], null, null];
    state.queue = []; state.over = false; state.combo = 0; state.lines = st.lines || 0;
    tutTarget = st.target;
    $('#coach').hidden = false;
    $('#coach-text').textContent = (tutStep + 1) + '/' + TUTORIAL.length + ' · ' + T(st.text);
    updateHud(); drawTray(true); requestRender();
    announce(T(st.text));
  }
  function afterTutorialMove(res) {
    var st = TUTORIAL[tutStep];
    if (st.need === 'clear' && res.lineCount === 0) {
      toast(T('Quase!'), T('Coloque a peça para completar a linha.'));
      later(function () { if (modeOf() === 'tutorial') loadTutorialStep(); }, 700);
      return;
    }
    tutTarget = null;
    later(function () {
      if (modeOf() !== 'tutorial') return;
      tutStep++;
      if (tutStep < TUTORIAL.length) loadTutorialStep();
      else finishTutorial(false);
    }, res.lineCount ? 900 : 500);
  }
  function finishTutorial(skipped) {
    cancelLater();
    store.set('gb.tutorialDone', true);
    $('#coach').hidden = true; tutTarget = null;
    if (skipped && tutFrom === 'help') { goHome(); return; }
    showDialog({
      title: skipped ? T('Tutorial pulado') : T('Pronto para jogar!'),
      list: [T('As peças não giram.'), T('Limpe de novo em até 3 peças para manter o combo.'), T('A cada 10 linhas você sobe de fase: os pontos são multiplicados.'),
        T('Jogadas especiais podem mudar o visual e os blocos. É surpresa!'), T('A partida acaba quando nenhuma das 3 peças couber.'), T('Você pode rever o tutorial em Ajuda.')],
      buttons: [
        { label: T('Começar a jogar'), cls: 'primary big', fn: function () { closeDialog(); startGame('classic'); } },
        { label: T('Tela inicial'), cls: 'ghost-dark', fn: function () { closeDialog(); goHome(); } }
      ]
    });
  }
  $('#coach-skip').addEventListener('click', function () { Sound.tap(); finishTutorial(true); });

  /* ---------------- telas e navegação ---------------- */
  /* v1.24 (polimento): dicas das novidades — um balão por vez, só na primeira vez (gb.tips) */
  var TIPS = {
    home: [['level', '#home-meta .lv-box', 'Este é o seu nível de jogador. Toda partida, missão e sequência de dias dá XP. No fim de semana vale o dobro!'],
      ['streak', '#home-streak', '🔥 Sua sequência de dias. Jogue todo dia para aumentar; se pular um dia, o escudo da semana salva.'],
      ['modes', '[data-go="modes"]', 'Novo modo: Desafio da Semana! Mesmas peças para todo mundo, e o placar da galera é conferido.']],
    modes: [['weekly', '.weekly-card .mode-actions', 'Jogue, depois mande seu código para os amigos. Quem colar vê seus pontos conferidos ✅.']],
    records: [['galera', '#body-records .mode-actions .btn.primary', 'Cole aqui o código que um amigo mandou. O jogo refaz a partida dele para conferir.']]
  };
  var tipEl = null, tipTimer = 0;
  function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }
  function tipsFor(name) {
    clearTimeout(tipTimer); hideTip();
    var list = TIPS[name]; if (!list) return;
    if (/[?&]debug\b/.test(location.search) && !/[?&]tips\b/.test(location.search)) return; // testes automáticos: sem balões (a não ser com ?tips)
    tipTimer = setTimeout(function () {
      if (!screenIs(name) || overlayOpen()) return;
      var seen = store.get('gb.tips', {}) || {};
      for (var i = 0; i < list.length; i++) {
        var t = list[i], target = document.querySelector(t[1]);
        if (seen[t[0]] || !target || target.hidden || !target.offsetParent) continue;
        showTip(t[0], target, T(t[2]), name); return;
      }
    }, 900);
  }
  function showTip(id, target, text, screen) {
    hideTip();
    var r = target.getBoundingClientRect(), b = el('div', 'tip-bubble');
    b.setAttribute('role', 'status');
    b.appendChild(el('p', '', text));
    var ok = el('button', 'btn small primary', T('Entendi'));
    ok.addEventListener('click', function () {
      var seen = store.get('gb.tips', {}) || {}; seen[id] = 1; store.set('gb.tips', seen); hideTip(); Sound.tap(); tipsFor(screen);
    });
    b.appendChild(ok); document.body.appendChild(b); tipEl = b;
    setTimeout(function () { // tocar em qualquer outro lugar também fecha (o balão nunca atrapalha o jogo)
      document.addEventListener('pointerdown', function off(ev) {
        if (tipEl !== b) { document.removeEventListener('pointerdown', off, true); return; }
        if (b.contains(ev.target)) return;
        document.removeEventListener('pointerdown', off, true);
        var seen = store.get('gb.tips', {}) || {}; seen[id] = 1; store.set('gb.tips', seen); hideTip();
      }, true);
    }, 50);
    var bw = b.offsetWidth, bh = b.offsetHeight, below = r.bottom + bh + 20 < window.innerHeight;
    var left = Math.max(12, Math.min(window.innerWidth - bw - 12, r.left + r.width / 2 - bw / 2));
    b.style.left = left + 'px';
    b.style.top = (below ? r.bottom + 12 : r.top - bh - 12) + 'px';
    b.classList.add(below ? 'down' : 'up');
    b.style.setProperty('--ax', Math.max(18, Math.min(bw - 18, r.left + r.width / 2 - left)) + 'px');
  }
  function show(name) {
    Object.keys(screens).forEach(function (k) { screens[k].classList.toggle('active', k === name); });
    var evl = eventNow(); $('#event-layer').hidden = !evl || settings.anim === 'off'; document.body.classList.toggle('ev-terror', !!evl); // v1.24: lua e morcegos
    if (name !== 'home' && $('#news-bar')) $('#news-bar').hidden = true; // v1.24: barra de novidades só na tela inicial
    tipsFor(name);
    if (name === 'home') refreshHome();
    else if (!(history.state && history.state.gb)) { try { history.pushState({ gb: 1 }, ''); } catch (e) {} }
    if (window.GBMenus && window.GBMenus.onShow) window.GBMenus.onShow(name);
    requestRender();
  }
  function screenIs(name) { return screens[name] && screens[name].classList.contains('active'); }
  function goHome() { if (state && !locked) saveGame(); cancelLater(); locked = false; closeAllOverlays(); show('home'); flushRewards(); }

  // botão "voltar" do Android / navegador
  window.addEventListener('popstate', function () {
    if (drag) endDrag(false);
    if (screenIs('home')) return;
    var repush = function () { try { history.pushState({ gb: 1 }, ''); } catch (e) {} };
    var open = document.querySelector('.overlay:not([hidden])');
    // v1.16: fecha pela função normal (antes só escondia a janela e a tela do jogo ficava travada — 'inert' — sem aceitar toques)
    if (open && open.id !== 'ov-over') { closeOverlay('#' + open.id); repush(); return; }
    if (screenIs('game')) { if (!locked && modeOf() !== 'tutorial') openOverlay('#ov-pause'); repush(); return; }
    show('home');
  });

  function refreshHome() {
    $('#home-best').textContent = fmt(bestFor('classic'));
    var hm = Season.medalFor(bestFor('classic')); $('#home-medal').textContent = hm ? hm.icon : ''; $('#home-medal').hidden = !hm;
    var lv = Season.levelOf(stats.xp || 0), sk = Season.streakNow(stats, today());
    $('#home-lv').textContent = T('Nível {n}', { n: lv.level }); $('#home-title').textContent = T(lv.title);
    $('#home-xp').style.width = Math.round(100 * lv.cur / lv.need) + '%';
    $('#home-streak').hidden = sk < 1; $('#home-streak-n').textContent = sk === 1 ? T('1 dia') : T('{n} dias', { n: sk });
    $('#home-x2').hidden = !Season.isWeekend();
    if (window.GBHome) window.GBHome.sync(); // v1.24: botões de modo
    var evh = eventNow(); $('#event-banner').hidden = !evh;
    if (evh) $('#event-title').textContent = evh.icon + ' ' + T(evh.name) + ' · ' + T('até domingo');
    $('.home-best').hidden = bestFor('classic') <= 0; // v1.23: sem "Recorde 0" para quem ainda não tem recorde
    var ng = $('#home-next') ? Progress.nextGoal(stats) : null; // v1.14: tela inicial simplificada (sem barra de próximo objetivo)
    if ($('#home-next')) $('#home-next').hidden = !ng;
    if (ng) {
      $('#home-next-text').textContent = T('Próximo: {text} ({cur}/{target})', { text: ng.text, cur: ng.cur, target: ng.target });
      $('#home-next-bar').style.width = (100 * ng.cur / ng.target).toFixed(0) + '%';
    }
    Progress.ensureMissions(stats, today());
    var left = stats.missions.filter(function (m) { return !m.done; }).length;
    $('#badge-missions').hidden = left === 0;
    $('#badge-missions').textContent = left;
    $('#badge-missions').setAttribute('aria-hidden', 'true');
    document.querySelector('[data-go="challenges"]').setAttribute('aria-label', left ? T('Desafios, {n} missões de hoje em aberto', { n: left }) : T('Desafios'));
    if (!state || modeOf() === 'tutorial') applyTheme(themeIdx, false);
  }

  var focusStack = [];
  function focusables(root) {
    return Array.prototype.filter.call(root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (e) { return !e.disabled && e.offsetParent !== null; });
  }
  function openOverlay(sel) {
    if (drag) endDrag(false);
    var ov = $(sel);
    if (ov.hidden) focusStack.push(document.activeElement);
    ov.hidden = false;
    $('#app').setAttribute('inert', '');
    setTimeout(function () { if (!ov.contains(document.activeElement)) { var f = focusables(ov)[0]; if (f) f.focus({ preventScroll: true }); } }, 30);
    if (sel === '#ov-settings' && $('#skins')) buildSkinPicker();
    if (sel === '#ov-pause') {
      var names = { classic: 'Modo Clássico', zen: 'Modo Zen', challenge: 'Desafio', daily: 'Desafio do dia', tutorial: 'Tutorial' };
      $('#pause-mode').textContent = T(names[modeOf()]) + (modeOf() === 'challenge' ? ': ' + T(challengeDef(state.chId).name) : '');
      document.querySelector('#ov-pause [data-action="home"]').textContent = modeOf() === 'tutorial' ? T('Sair do tutorial') : T('Sair (a partida fica salva)');
    }
  }
  function closeOverlay(sel) {
    var ov = $(sel);
    if (ov.hidden) return;
    ov.hidden = true;
    if (!overlayOpen()) $('#app').removeAttribute('inert');
    var back = focusStack.pop();
    if (back && document.contains(back) && !overlayOpen()) { try { back.focus({ preventScroll: true }); } catch (e) {} }
  }
  /** Rede de segurança: sem nenhuma janela aberta, a tela do jogo nunca pode ficar travada (inert). */
  function unstickApp() { if (!overlayOpen() && $('#app').hasAttribute('inert')) $('#app').removeAttribute('inert'); }
  document.addEventListener('visibilitychange', unstickApp);
  window.addEventListener('popstate', function () { setTimeout(unstickApp, 0); });
  function closeAllOverlays() { ['#ov-pause', '#ov-settings', '#ov-over', '#ov-dialog'].forEach(closeOverlay); focusStack = []; }

  /* ---------------- configurações ---------------- */
  function saveSettings() { store.set('gb.settings', settings); }
  /* v1.23: uma escolha só para os efeitos (as 4 opções antigas continuam em "Mais opções de visual") */
  var PRESETS = {
    full: { anim: 'full', fx: 'full', particles: true, quality: 'high' },
    light: { anim: 'reduced', fx: 'reduced', particles: false, quality: 'medium' },
    min: { anim: 'off', fx: 'reduced', particles: false, quality: 'low' }
  };
  function presetOf() {
    for (var k in PRESETS) { var p = PRESETS[k]; if (settings.anim === p.anim && settings.fx === p.fx && !!settings.particles === p.particles && settings.quality === p.quality) return k; }
    return '';
  }
  function applyPreset(k) {
    var p = PRESETS[k]; if (!p) return;
    settings.anim = p.anim; settings.fx = p.fx; settings.surprise = p.fx !== 'off'; settings.particles = p.particles; settings.quality = p.quality;
    saveSettings(); sprites = {}; applySettings(); layout(); drawTray(false); paintBg(); requestRender();
  }

  function applySettings() {
    document.body.classList.remove('anim-full', 'anim-reduced', 'anim-off');
    document.body.classList.add('anim-' + settings.anim);
    document.body.classList.toggle('q-low', settings.quality === 'low'); // v1.16: qualidade baixa corta efeitos de CSS contínuos
    Sound.setSfx(settings.sound);
    Sound.setVolume(settings.sfxVol / 100, settings.musicVol / 100);
    Sound.setMusic(settings.music);
    $('#set-sfx-vol').value = settings.sfxVol; $('#out-sfx-vol').textContent = settings.sfxVol + '%';
    $('#set-music-vol').value = settings.musicVol; $('#out-music-vol').textContent = settings.musicVol + '%';
    $('#set-sound').checked = settings.sound;
    $('#set-music').checked = settings.music;
    $('#set-vibrate').checked = settings.vibrate;
    $('#set-symbols').checked = !!settings.symbols;
    $('#set-particles').checked = !!settings.particles;
    var fxr = document.querySelector('input[name="fx"][value="' + settings.fx + '"]'); if (fxr) fxr.checked = true;
    $('#row-vibstrength').hidden = !navigator.vibrate || !settings.vibrate;
    $('#sec-vibrate').hidden = !navigator.vibrate;
    // v1.23 (menos poluição): volume só aparece com o som ligado; escolha única de efeitos reflete as opções avançadas
    $('#set-sfx-vol').closest('.vol').hidden = !settings.sound;
    $('#set-music-vol').closest('.vol').hidden = !settings.music;
    var pz = presetOf(); Array.prototype.forEach.call(document.querySelectorAll('input[name="preset"]'), function (r) { r.checked = r.value === pz; });
    ['lang', 'quality', 'dragSpeed', 'vibStrength'].forEach(function (k) {
      var v = k === 'lang' ? I18n.lang : settings[k], el = document.querySelector('input[name="' + k + '"][value="' + v + '"]');
      if (el) el.checked = true;
    });
    var r = document.querySelector('input[name="anim"][value="' + settings.anim + '"]');
    if (r) r.checked = true;
    if (settings.anim === 'off') anims = [];
    requestRender();
  }

  $('#row-vibrate').hidden = !navigator.vibrate;
  $('#set-sound').addEventListener('change', function (e) { settings.sound = e.target.checked; saveSettings(); applySettings(); Sound.unlock(); Sound.tap(); });
  $('#set-music').addEventListener('change', function (e) { settings.music = e.target.checked; saveSettings(); Sound.unlock(); applySettings(); });
  ['sfx', 'music'].forEach(function (k) {
    var inp = $('#set-' + k + '-vol');
    inp.addEventListener('input', function () {
      settings[k + 'Vol'] = +inp.value; applySettings(); Sound.unlock();
      if (k === 'sfx') Sound.tap();
    });
    inp.addEventListener('change', saveSettings);
  });
  $('#set-vibrate').addEventListener('change', function (e) { settings.vibrate = e.target.checked; saveSettings(); applySettings(); haptic('place'); });
  // v1.22.1 (dono: "no meu celular não vibra"): teste que diz se o navegador aceitou vibrar. Se aceitou e não vibrou,
  // o bloqueio é do sistema do celular (Não perturbe, economia de bateria, vibração desligada nas configurações).
  $('#btn-vib-test').addEventListener('click', function () {
    var okv = false;
    try { okv = !!navigator.vibrate && navigator.vibrate(vibPattern([200, 120, 200])); } catch (e) {}
    if (okv) toast(T('Pedido de vibração enviado'), T('Sentiu? Se não, o celular está bloqueando: confira o modo Não perturbe, a economia de bateria e a vibração nas configurações do aparelho.'));
    else toast(T('Este navegador não deixou vibrar'), T('Abra o jogo pelo app instalado ou pelo Chrome. No iPhone não é possível vibrar.'));
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="preset"]'), function (r) {
    r.addEventListener('change', function () { applyPreset(r.value); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="vibStrength"]'), function (r) {
    r.addEventListener('change', function () { settings.vibStrength = r.value; saveSettings(); haptic('lines'); });
  });
  $('#set-symbols').addEventListener('change', function (e) { settings.symbols = e.target.checked; saveSettings(); setSkin(settings.blocks); });
  $('#set-particles').addEventListener('change', function (e) { settings.particles = e.target.checked; saveSettings(); applySettings(); });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="fx"]'), function (r) {
    r.addEventListener('change', function () { settings.fx = r.value; settings.surprise = r.value !== 'off'; saveSettings(); sprites = {}; applySettings(); drawTray(false); paintBg(); requestRender(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="lang"]'), function (r) {
    r.addEventListener('change', function () { settings.lang = r.value; saveSettings(); I18n.setLang(r.value); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="dragSpeed"]'), function (r) {
    r.addEventListener('change', function () { settings.dragSpeed = Number(r.value); saveSettings(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="quality"]'), function (r) {
    r.addEventListener('change', function () { settings.quality = r.value; saveSettings(); sprites = {}; applySettings(); layout(); drawTray(false); requestRender(); });
  });

  /** Troca de idioma: refaz na hora todos os textos montados pelo jogo (o HTML marcado já foi traduzido). */
  function refreshTexts() {
    $('#btn-restart').textContent = T('Recomeçar');
    var cur = Object.keys(screens).filter(function (k) { return screenIs(k); })[0];
    if (cur === 'home') refreshHome();
    else if (cur && window.GBMenus) window.GBMenus.onShow(cur);
    if (state && screenIs('game')) { updateHud(); updateThemeBar(); drawTray(false); }
    if (!$('#ov-settings').hidden) buildSkinPicker();
    if (!$('#ov-pause').hidden) { var keep = $('#ov-pause'); keep.hidden = true; focusStack.pop(); openOverlay('#ov-pause'); }
  }
  I18n.onChange(refreshTexts);
  Array.prototype.forEach.call(document.querySelectorAll('input[name="anim"]'), function (r) {
    r.addEventListener('change', function () { settings.anim = r.value; saveSettings(); applySettings(); });
  });

  function setSkin(id) {
    if (id !== 'classic') return false; // v1.18: estilo não é mais escolhido pelo jogador (a Coleção é só galeria)
    if (!Progress.isUnlocked(stats, id)) return false;
    settings.blocks = id; saveSettings(); sprites = {};
    if (id !== 'classic' && state && state.look) { state.look.skin = null; state.look.left = 0; }
    render(); drawTray(false); paintBg(); requestRender();
    return true;
  }

  /** Desenha a miniatura (2×2 blocos) de um estilo num canvas de 88×88. */
  function drawSkinPreview(cv, skinId) {
    var th = THEMES[themeIdx], ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 88, 88);
    ctx.fillStyle = th.board; ctx.fillRect(0, 0, 88, 88);
    [[0, 0, 0], [44, 0, 2], [0, 44, 4], [44, 44, 5]].forEach(function (p) { ctx.drawImage(sprite(th, p[2], 44, skinId), p[0], p[1], 44, 44); });
  }

  // seletor de estilos nas configurações (estilos bloqueados aparecem com cadeado e o que falta)
  /** Configurações (v1.16): o estilo só é trocado na Coleção, na tela inicial. Aqui: qual está em uso + voltar ao original. */
  function buildSkinPicker() {
    var box = $('#skins'), sk = Skins.LIST.filter(function (x) { return x.id === settings.blocks; })[0] || Skins.LIST[0];
    box.innerHTML = '';
    var cur = document.createElement('div'); cur.className = 'skin-current';
    cur.innerHTML = '<canvas width="88" height="88"></canvas><span><strong></strong><small></small></span>';
    cur.querySelector('strong').textContent = T(sk.name);
    cur.querySelector('small').textContent = sk.id === 'classic' ? T('Original: pode se transformar em jogadas especiais.') : T('Escolhido: fica fixo, sem transformações.');
    drawSkinPreview(cur.querySelector('canvas'), sk.id);
    box.appendChild(cur);
    if (sk.id !== 'classic') {
      var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn ghost-dark'; bt.id = 'btn-skin-reset';
      bt.textContent = T('Voltar ao original');
      bt.addEventListener('click', function () { setSkin('classic'); Sound.placeSkin('classic'); buildSkinPicker(); var cl = $('#ov-settings [data-action="close-settings"]'); if (cl) cl.focus({ preventScroll: true }); });
      box.appendChild(bt);
    }
    var note = document.createElement('small'); note.className = 'skin-note';
    note.textContent = T('Para escolher outro estilo, use a Coleção na tela inicial.');
    box.appendChild(note);
  }

  function confirmButton(btn, label, confirmLabel, action) {
    var armed = false, t = 0;
    btn.addEventListener('click', function () {
      if (!armed) {
        armed = true; btn.textContent = T(confirmLabel); btn.classList.add('confirm'); announce(T(confirmLabel));
        t = setTimeout(reset, 3000);
        return;
      }
      reset(); action();
    });
    function reset() { armed = false; clearTimeout(t); btn.textContent = T(label); btn.classList.remove('confirm'); }
  }
  confirmButton($('#btn-restart'), 'Recomeçar', 'Toque de novo para recomeçar', function () {
    var m = modeOf();
    store.del(saveKey(m));
    if (m === 'tutorial') startTutorial(tutFrom);
    else startGame(m, { chId: state.chId });
  });

  /* ---------------- v1.22: backup do progresso por código (js/backup.js) ---------------- */
  function backupCode() {
    saveGame(); saveStats();
    var data = {};
    window.MZBackup.KEYS.forEach(function (k) { var v = store.get(k, null); if (v !== null) data[k] = v; });
    return window.MZBackup.encode(data);
  }
  function copyProgress() {
    var code = backupCode();
    var done = function () { toast(T('Progresso copiado!'), T('Cole no WhatsApp ou e-mail e mande para você mesmo.')); };
    var manual = function () { showCodeDialog(code); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, manual);
    else manual();
  }
  function showCodeDialog(code) { // celular sem permissão de copiar: mostra o código para copiar à mão
    var card = $('#dialog-card'); card.innerHTML = '';
    var h = el('h2', '', T('Seu código de progresso')); h.id = 'dialog-title'; card.appendChild(h);
    card.appendChild(el('p', 'muted', T('Segure no texto, escolha "Selecionar tudo" e "Copiar".')));
    var ta = el('textarea'); ta.id = 'restore-code'; ta.readOnly = true; ta.value = code; card.appendChild(ta);
    var b = el('button', 'btn primary', T('Fechar')); b.addEventListener('click', closeDialog);
    var st = el('div', 'stack'); st.appendChild(b); card.appendChild(st);
    openOverlay('#ov-dialog'); setTimeout(function () { try { ta.focus(); ta.select(); } catch (e) {} }, 80);
  }
  /** Confere cada parte do backup como o jogo confere o que lê do armazenamento. Retorna só o que é válido. */
  function validBackup(data) {
    var out = {}, n = 0;
    if (data['gb.stats'] && typeof data['gb.stats'] === 'object') { try { out['gb.stats'] = Progress.normalize(data['gb.stats']); n++; } catch (e) {} }
    if (data['gb.settings'] && typeof data['gb.settings'] === 'object' && !Array.isArray(data['gb.settings'])) out['gb.settings'] = data['gb.settings'];
    if (data['gb.tutorialDone'] === true) out['gb.tutorialDone'] = true;
    ['classic', 'zen', 'daily', 'challenge'].forEach(function (m) {
      var v = data['gb.save.' + m]; if (v && Logic.isValidState(v)) { out['gb.save.' + m] = v; n++; }
    });
    return n ? out : null;
  }
  /* v1.24: Placar da galera (sem servidor): mandar o código de prova e colar o código dos amigos */
  function myWeeklyCode() { var wd = weeklyData(); return wd.best ? Weekly.encode(wd.week, nick() || T('Eu'), wd.best, wd.moves || '') : ''; }
  function addMineToGalera() {
    var wd = weeklyData(); if (!wd.best) return;
    var g = galera(); g.list = g.list.filter(function (x) { return !x.me; });
    g.list.push({ name: nick() || T('Você'), score: wd.best, me: true });
    g.list.sort(function (a, b) { return b.score - a.score; }); store.set('gb.galera', g);
  }
  function addFriendToGalera(e) {
    var g = galera(), key = e.name.toLowerCase(), old = g.list.filter(function (x) { return !x.me && x.name.toLowerCase() === key; })[0];
    if (old && old.score >= e.score) return false;
    g.list = g.list.filter(function (x) { return x.me || x.name.toLowerCase() !== key; });
    g.list.push({ name: e.name, score: e.score, lines: e.lines || 0 });
    g.list.sort(function (a, b) { return b.score - a.score; }); store.set('gb.galera', g);
    return true;
  }
  function refreshRecords() { if (screenIs('records') && window.GBMenus) window.GBMenus.onShow('records'); }
  function askNick(then) {
    var card = $('#dialog-card'); card.innerHTML = '';
    var h = el('h2', '', T('Seu apelido no placar')); h.id = 'dialog-title'; card.appendChild(h);
    card.appendChild(el('p', 'muted', T('Aparece para os amigos que colarem o seu código. Até 16 letras. Fica só neste celular.')));
    var inp = el('input'); inp.id = 'nick-input'; inp.type = 'text'; inp.maxLength = 16; inp.value = nick(); inp.placeholder = T('Ex.: Thesco'); inp.setAttribute('autocomplete', 'nickname'); inp.setAttribute('aria-label', T('Apelido')); card.appendChild(inp);
    var st = el('div', 'stack'), ok = el('button', 'btn primary', T('Salvar')), no = el('button', 'btn', T('Cancelar'));
    ok.addEventListener('click', function () {
      var n = Weekly.cleanName(inp.value); if (!n) { inp.focus(); return; }
      settings.nick = n; saveSettings(); closeDialog(); addMineToGalera(); refreshRecords(); if (then) then();
    });
    no.addEventListener('click', closeDialog);
    st.appendChild(ok); st.appendChild(no); card.appendChild(st);
    openOverlay('#ov-dialog'); setTimeout(function () { try { inp.focus(); } catch (e) {} }, 80);
  }
  function shareWeekly() {
    if (!nick()) { askNick(shareWeekly); return; }
    var wd = weeklyData();
    if (!wd.best) { toast(T('Jogue o Desafio da Semana primeiro'), ''); return; }
    var text = T('Fiz {n} pontos no Desafio da Semana do Kablox! Cole esta mensagem no jogo (Recordes → Placar da galera) para conferir e tentar me bater:', { n: fmt(wd.best) }) + '\n\n' + myWeeklyCode() + '\n\n' + SITE_URL;
    var fallback = function () { showCodeDialog(text); };
    if (navigator.share) { navigator.share({ text: text }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(text).then(function () { toast(T('Código copiado!'), T('Cole no WhatsApp para a galera. Eles colam no jogo para conferir.')); }, fallback); } catch (e) { fallback(); }
  }
  function openPasteFriend() {
    var card = $('#dialog-card'); card.innerHTML = '';
    var h = el('h2', '', T('Colar código de amigo')); h.id = 'dialog-title'; card.appendChild(h);
    card.appendChild(el('p', 'muted', T('Cole a mensagem inteira que o amigo mandou. O jogo refaz a partida dele, jogada por jogada, para conferir os pontos.')));
    var ta = el('textarea'); ta.id = 'friend-code'; ta.setAttribute('spellcheck', 'false'); ta.setAttribute('aria-label', T('Código do amigo')); card.appendChild(ta);
    var msg = el('p', 'restore-msg'); msg.setAttribute('role', 'status'); card.appendChild(msg);
    var st = el('div', 'stack'), ok = el('button', 'btn primary', T('Conferir')), no = el('button', 'btn', T('Fechar'));
    ok.addEventListener('click', function () {
      var raw = ta.value, at = raw.indexOf('KS1.'), v = { ok: false, error: 'format' };
      if (at >= 0) { // o WhatsApp pode quebrar o código em linhas: junta até o fim do código (8 letras de verificação)
        var tail = raw.slice(at).replace(/\s+/g, ''), mm = /^KS1\.w\d+\.[A-Za-z0-9_-]+\.\d+\.[A-Za-z0-9_-]*\.[0-9a-f]{8}/.exec(tail);
        v = mm ? Weekly.verify(mm[0]) : v;
      }
      if (!v.ok) { msg.className = 'restore-msg bad'; msg.textContent = v.error === 'format' || v.error === 'big' ? T('Não achei um código do Desafio da Semana nessa mensagem.') : T('Esse código não confere: os pontos não batem com as jogadas.'); return; }
      if (v.week !== weekNow()) { msg.className = 'restore-msg bad'; msg.textContent = T('Esse código é de outra semana.'); return; }
      var added = addFriendToGalera(v);
      msg.className = 'restore-msg good';
      msg.textContent = '✅ ' + T('{name}: {n} pontos conferidos!', { name: v.name, n: fmt(v.score) }) + (added ? '' : ' ' + T('(já estava no placar)'));
      ta.value = ''; Sound.tap(); refreshRecords();
    });
    no.addEventListener('click', closeDialog);
    st.appendChild(ok); st.appendChild(no); card.appendChild(st);
    openOverlay('#ov-dialog'); setTimeout(function () { try { ta.focus(); } catch (e) {} }, 80);
  }
  /* v1.24 (polimento, pedido do dono): "Achei um bug" — monta a mensagem com a versão e o aparelho, copia e abre o Direct.
     Nada é enviado sozinho: a pessoa vê o texto e decide mandar. */
  var BUG_DM = 'https://ig.me/m/othesco.br';
  function bugInfo() {
    var ua = navigator.userAgent || '', dev = /iPhone|iPad|iPod/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : T('computador/outro');
    var inst = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    var where = screenIs('game') ? T('na partida') + ' (' + modeOf() + ')' : T('nos menus');
    return 'Kablox v' + VERSION + ' · ' + dev + (inst ? ' (' + T('instalado') + ')' : '') + ' · ' + window.innerWidth + '×' + window.innerHeight + ' · ' + where + ' · ' + T('efeitos') + ' ' + ({ full: T('Completos'), light: T('Leves'), min: T('Mínimos') }[presetOf()] || T('personalizados'));
  }
  function openBugReport() {
    var card = $('#dialog-card'); card.innerHTML = '';
    var h = el('h2', '', '🐞 ' + T('Achei um bug')); h.id = 'dialog-title'; card.appendChild(h);
    card.appendChild(el('p', 'muted', T('Conte o que aconteceu e o que você estava fazendo. O jogo junta a versão e o tipo de celular para ajudar a achar o problema.')));
    var ta = el('textarea'); ta.id = 'bug-text'; ta.setAttribute('aria-label', T('O que aconteceu?')); ta.placeholder = T('Ex.: arrastei a peça e ela sumiu'); card.appendChild(ta);
    var info = bugInfo(), pv = el('p', 'bug-info', info); card.appendChild(pv);
    var msg = el('p', 'restore-msg'); msg.setAttribute('role', 'status'); card.appendChild(msg);
    var st = el('div', 'stack'), ok = el('button', 'btn primary', T('Copiar e abrir o Direct')), no = el('button', 'btn', T('Cancelar'));
    ok.addEventListener('click', function () {
      var t = ta.value.trim(); if (!t) { msg.className = 'restore-msg bad'; msg.textContent = T('Escreva o que aconteceu.'); ta.focus(); return; }
      var text = '🐞 Bug no Kablox\n' + t + '\n— ' + info;
      var go = function () { msg.className = 'restore-msg good'; msg.textContent = T('Mensagem copiada! Cole no Direct e envie.'); try { window.open(BUG_DM, '_blank', 'noopener'); } catch (e) {} };
      try { navigator.clipboard.writeText(text).then(go, function () { showCodeDialog(text); }); } catch (e) { showCodeDialog(text); }
    });
    no.addEventListener('click', closeDialog);
    st.appendChild(ok); st.appendChild(no); card.appendChild(st);
    openOverlay('#ov-dialog'); setTimeout(function () { try { ta.focus(); } catch (e) {} }, 80);
  }
  $('#btn-event').addEventListener('click', function () { Sound.tap(); openEvent(); });
  function openEvent() { // v1.24: Desafio do evento (Semana do Terror)
    var ev = eventNow(); if (!ev) return;
    showDialog({ title: ev.icon + ' ' + T(ev.name), list: [
      T('Limpe {n} abóboras 🎃 numa partida só.', { n: ev.goal }), T('As abóboras aparecem bem mais neste desafio.'),
      stats.rares && stats.rares.pk ? T('Você já ganhou a Abóbora! Jogue de novo por diversão.') : T('Prêmio: a Abóbora vira um bloco raro seu para sempre.'), T('O evento acaba domingo, 8/11.')],
      buttons: [{ label: T('Jogar'), cls: 'primary big', fn: function () { closeDialog(); confirmReplace('event', function () { startGame('event'); }, function () { startGame('event', { resume: true }); }); } },
        { label: T('Agora não'), cls: 'ghost-dark', fn: closeDialog }] });
  }
  $('#btn-bug').addEventListener('click', function () { Sound.tap(); openBugReport(); });
  $('#btn-bug-pause').addEventListener('click', function () { Sound.tap(); closeOverlay('#ov-pause'); openBugReport(); });
  function openRestore() {
    var card = $('#dialog-card'); card.innerHTML = '';
    var h = el('h2', '', T('Restaurar progresso')); h.id = 'dialog-title'; card.appendChild(h);
    card.appendChild(el('p', 'muted', T('Cole aqui o código que você copiou no outro celular. O progresso deste aparelho será trocado pelo do código.')));
    var ta = el('textarea'); ta.id = 'restore-code'; ta.setAttribute('autocomplete', 'off'); ta.setAttribute('spellcheck', 'false');
    ta.setAttribute('aria-label', T('Código de progresso')); card.appendChild(ta);
    var msg = el('p', 'restore-msg'); msg.setAttribute('role', 'status'); card.appendChild(msg);
    var st = el('div', 'stack'), ok = el('button', 'btn confirm', T('Restaurar')), no = el('button', 'btn primary', T('Cancelar'));
    var armed = false;
    ok.addEventListener('click', function () {
      var r = window.MZBackup.decode(ta.value), data = r.ok ? validBackup(r.data) : null;
      if (!data) {
        msg.className = 'restore-msg bad';
        msg.textContent = r.error === 'check' ? T('O código está incompleto ou foi alterado. Copie de novo, inteiro.') : T('Esse código não é um progresso do jogo. Confira se colou o código inteiro.');
        armed = false; ok.textContent = T('Restaurar'); return;
      }
      if (!armed) { // confirmação na própria janela (nada de alert/confirm)
        armed = true; msg.className = 'restore-msg good'; ok.textContent = T('Toque de novo para trocar o progresso');
        msg.textContent = T('Código válido! O progresso atual deste celular será substituído.'); return;
      }
      wiping = true;
      try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('gb.') === 0 && k !== 'gb.wipe') localStorage.removeItem(k); }); } catch (e) {}
      Object.keys(data).forEach(function (k) { store.set(k, data[k]); });
      try { localStorage.setItem('gb.restored', String(Date.now())); } catch (e) {}
      location.reload();
    });
    ta.addEventListener('input', function () { armed = false; ok.textContent = T('Restaurar'); msg.textContent = ''; });
    no.addEventListener('click', closeDialog);
    st.appendChild(ok); st.appendChild(no); card.appendChild(st);
    openOverlay('#ov-dialog'); setTimeout(function () { try { ta.focus(); } catch (e) {} }, 80);
  }
  $('#btn-backup-copy').addEventListener('click', function () { Sound.tap(); copyProgress(); });
  $('#btn-backup-restore').addEventListener('click', function () { Sound.tap(); closeOverlay('#ov-settings'); openRestore(); });

  /** Apaga tudo o que o jogo guardou neste aparelho. */
  function resetAll() {
    wiping = true;
    try { localStorage.setItem('gb.wipe', String(Date.now())); } catch (e) {}
    try {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf('gb.') === 0 || k.indexOf('mz.') === 0) localStorage.removeItem(k); });
    } catch (e) {}
    location.reload();
  }

  /* ---------------- botões ---------------- */
  var settingsReturn = null;
  $('#btn-home-settings').addEventListener('click', function () { Sound.unlock(); settingsReturn = null; openOverlay('#ov-settings'); });
  $('#btn-settings').addEventListener('click', function () { Sound.unlock(); Sound.tap(); settingsReturn = null; openOverlay('#ov-settings'); });
  $('#btn-pause').addEventListener('click', function () { Sound.unlock(); Sound.tap(); if (!locked) openOverlay('#ov-pause'); });
  $('#btn-undo').addEventListener('click', function () { Sound.unlock(); undo(); });
  $('#btn-update-later').addEventListener('click', function () { $('#update-bar').hidden = true; });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]');
    if (!b) return;
    var a = b.getAttribute('data-action');
    Sound.tap();
    if (a === 'resume') closeOverlay('#ov-pause');
    else if (a === 'settings') { closeOverlay('#ov-pause'); settingsReturn = '#ov-pause'; openOverlay('#ov-settings'); }
    else if (a === 'close-settings') { closeOverlay('#ov-settings'); if (settingsReturn) { openOverlay(settingsReturn); settingsReturn = null; } }
    else if (a === 'home') goHome();
  });

  // tocar no fundo escuro fecha pausa/configurações/diálogos
  ['#ov-pause', '#ov-settings', '#ov-dialog'].forEach(function (sel) {
    $(sel).addEventListener('click', function (e) { if (e.target === e.currentTarget) { closeOverlay(sel); settingsReturn = null; } });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeOverlay('#ov-settings'); closeOverlay('#ov-pause'); closeOverlay('#ov-dialog'); settingsReturn = null; return; }
    if (e.key !== 'Tab') return;
    var open = Array.prototype.filter.call(document.querySelectorAll('.overlay'), function (o) { return !o.hidden; }).pop();
    if (!open) return;
    var f = focusables(open); if (!f.length) return;
    var i = f.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  });

  /* ---------------- gestos do navegador ---------------- */
  document.addEventListener('touchmove', function (e) {
    if (!e.target.closest || !e.target.closest('.scrollable')) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (e) { if (!e.target.closest('.card') && !e.target.closest('.menu-body')) e.preventDefault(); });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { saveGame(); saveStats(); Sound.suspend(); if (drag) endDrag(false); }
    else { syncSavedSettings(); Sound.resume(); playClock = Date.now(); requestRender(); }
  });
  // v1.21.3 (relato do dono: música voltava ao reabrir, com a opção aparecendo desligada): sempre que o jogo volta
  // para a tela, ou outra janela do jogo (ex.: o site no navegador + o app instalado) muda as opções, o som segue
  // exatamente o que está salvo — e a chave na tela também.
  function syncSavedSettings() {
    var s = store.get('gb.settings', null);
    if (!s || typeof s !== 'object') return;
    ['sound', 'music', 'vibrate'].forEach(function (k) { if (typeof s[k] === 'boolean') settings[k] = s[k]; });
    if (['light', 'normal', 'strong'].indexOf(s.vibStrength) !== -1) settings.vibStrength = s.vibStrength;
    ['sfxVol', 'musicVol'].forEach(function (k) { var v = Number(s[k]); if (isFinite(v)) settings[k] = Math.max(0, Math.min(100, v)); });
    applySettings();
  }
  window.addEventListener('pageshow', function () { syncSavedSettings(); });
  window.addEventListener('pagehide', function () { saveGame(); saveStats(); });
  // outra aba apagou os dados: não regravar nada e recarregar
  window.addEventListener('storage', function (e) { if (e.key === 'gb.wipe' && e.newValue) { wiping = true; location.reload(); } else if (e.key === 'gb.settings') syncSavedSettings(); });

  /* ---------------- PWA: offline e atualização (js/ui.js) ---------------- */
  window.MZUI.setupPwa({ enabled: !INLINE, beforeUpdate: function () { saveGame(); saveStats(); } });

  /* ---------------- início ---------------- */
  $('#version').textContent = 'v' + VERSION;
  /* v1.23: novidades depois de atualizar (js/news.js) — aviso pequeno, a pessoa escolhe ver ou não */
  function newsDialog(entries) {
    var list = [];
    entries.forEach(function (e) { list.push('— v' + e.v + ' —'); window.MZNews.lines(e, I18n.lang).forEach(function (l) { list.push(l); }); });
    showDialog({ title: T('O que há de novo'), list: list, buttons: [{ label: T('Legal!'), cls: 'primary', fn: closeDialog }] });
  }
  (function checkNews() {
    var N = window.MZNews; if (!N) return;
    var seen = store.get('gb.newsSeen', null);
    if (!seen) seen = hadStats ? '1.22.1' : VERSION; // quem já jogava antes do aviso existir vê só o que é novo; quem acabou de instalar, nada
    var fresh = N.since(seen, VERSION);
    store.set('gb.newsSeen', VERSION);
    if (!fresh.length) return;
    setTimeout(function () {
      var bar = $('#news-bar'); if (!bar || !screens.home.classList.contains('active') || seasonNews || overlayOpen()) return; // v1.24: o aviso da temporada já fala das novidades
      bar.hidden = false;
      $('#btn-news-show').onclick = function () { bar.hidden = true; Sound.tap(); newsDialog(fresh); };
      $('#btn-news-later').onclick = function () { bar.hidden = true; };
      setTimeout(function () { bar.hidden = true; }, 15000); // some sozinho; a lista fica em Ajuda → Novidades
    }, 1200);
  })();
  if (seasonNews) setTimeout(function () { // v1.24: aviso único da Temporada 1
    showDialog({ title: T('🏆 Começou a Temporada 1!'), list: [
      T('Os recordes começam do zero para todo mundo competir de igual para igual.'),
      seasonNews.legend > 0 ? T('Seu recorde antigo ({n}) fica guardado como Recorde lendário.', { n: fmt(seasonNews.legend) }) : T('Seus estilos, conquistas e estrelas continuam.'),
      T('Novidades: medalhas de recorde, nível do jogador e sequência de dias 🔥.')],
      buttons: [{ label: T('Bora!'), cls: 'primary', fn: closeDialog }] });
  }, 900);
  try { if (localStorage.getItem('gb.restored')) { localStorage.removeItem('gb.restored'); setTimeout(function () { toast(T('Progresso restaurado!'), T('Seus recordes e conquistas estão de volta.')); }, 600); } } catch (e) {}
  applySettings();
  Sound.setTheme(THEMES[0]);
  applyTheme(0, false);

  // interface usada por js/menus.js
  window.GB = {
    VERSION: VERSION, Progress: Progress, THEMES: THEMES, Skins: Skins,
    get stats() { return stats; }, get settings() { return settings; }, get themeIdx() { return themeIdx; },
    fmt: fmt, today: today, store: store, saveStats: saveStats, toast: toast, sound: Sound,
    startGame: startGame, startTutorial: startTutorial, hasSave: hasSave, bestFor: bestFor, challengeDef: challengeDef,
    confirmReplace: confirmReplace, openChallengeIntro: openChallengeIntro, showDialog: showDialog, closeDialog: closeDialog,
    show: show, goHome: goHome, openSettings: function () { settingsReturn = null; openOverlay('#ov-settings'); },
    eventNow: eventNow, openEvent: openEvent, saveSettings: saveSettings,
    galera: galera, weeklyData: weeklyData, shareWeekly: shareWeekly, openPasteFriend: openPasteFriend, askNick: askNick, nick: nick,
    drawSkinPreview: drawSkinPreview, setSkin: setSkin, resetAll: resetAll, records: records, multText: multText,
    tutorialDone: function () { return !!store.get('gb.tutorialDone', false); }
  };

  show('home');

  // ganchos para testes automatizados: só existem com ?debug na URL e em localhost
  // segurança: só no computador de desenvolvimento (localhost), nunca no site publicado
  if (/[?&]debug\b/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.gbDebug = {
    get state() { return state; },
    get themeIdx() { return themeIdx; },
    get layout() { return L; },
    get anims() { return anims.length; },
    get stats() { return stats; },
    get perf() { return perf; },
    place: function (slot, r, c) { return commitPlace(slot, r, c); },
    get settings() { return settings; },
    /** Onde o dedo precisa ir (considerando a sensibilidade) para a peça cair em (row, col). Só para testes. */
    fingerFor: function (slot, row, col) {
      var p = state.pieces[slot], sh = SHAPES[p.s], r = boardCanvas.getBoundingClientRect(), s = slots[slot].getBoundingClientRect();
      var w = sh.w * L.cell, h = sh.h * L.cell, lift = Math.max(L.cell * 1.1, 44), k = settings.dragSpeed;
      var sx = s.left + s.width / 2, sy = s.top + s.height / 2;
      var px = r.left + L.pad + col * L.cell + w / 2, py = r.top + L.pad + row * L.cell + h + lift; // ponto acelerado desejado
      return { sx: sx, sy: sy, x: sx + (px - sx) / k, y: sy + (py - sy) / k };
    },
    look: function (id, animate) { state.themeId = id; themeIdx = Themes.indexOfId(id); applyTheme(themeIdx, !!animate); },
    transform: function (skin, big) { if (!state.look) state.look = { skin: null, left: 0, last: [], since: 99 }; applyLook(skin, [SIZE / 2 - 0.5, SIZE / 2 - 0.5], { big: !!big }); },
    shareImage: function () { return makeShareImage(); }, share: function () { shareResult(); },
    load: function (s) { state = s; themeIdx = Themes.indexOfId(s.themeId); applyTheme(themeIdx, false); drawTray(false); updateHud(); render(); }
  };
})();
