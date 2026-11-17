/* Kablox — interface, desenho, arraste, animações e persistência local */
(function () {
  'use strict';

  var VERSION = '1.31.0';
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
  settings.kbq = settings.kbq !== false; // v1.30: dá para esconder o Kabloquinho (menos coisa na tela)
  settings.tts = settings.tts !== false; // v1.30: voz do apresentador (voz do celular), só com a chave das falas
  // v1.20: efeitos especiais em 3 níveis (antes: liga/desliga "Mudanças surpresa" — desligado vira 'off')
  if (['full', 'reduced', 'off'].indexOf(settings.fx) === -1) settings.fx = settings.surprise === false ? 'off' : 'full';
  settings.surprise = settings.fx !== 'off';
  if ([1, 1.3, 1.6].indexOf(Number(settings.dragSpeed)) === -1) settings.dragSpeed = 1.3; else settings.dragSpeed = Number(settings.dragSpeed);
  I18n.setLang(settings.lang || (window.MZ_LAB === true ? 'pt' : I18n.detect())); // v1.30: laboratório (prévia do dono, dentro da página do Claude) abre em português
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
  /* v1.25: quebra assombrada do evento — o bloco incha, sobe virando fumaça; alguns soltam um morcego */
  function drawBat(ctx, x, y, s, flap) {
    ctx.beginPath(); ctx.ellipse(x, y, s * 0.18, s * 0.24, 0, 0, 7); ctx.fill();
    var w = s * (0.35 + 0.25 * flap);
    [-1, 1].forEach(function (d) {
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.05);
      ctx.quadraticCurveTo(x + d * w * 0.6, y - s * 0.45 * flap - s * 0.1, x + d * w * 1.6, y - s * 0.2 * flap);
      ctx.quadraticCurveTo(x + d * w * 1.1, y + s * 0.05, x + d * w * 0.9, y + s * 0.15);
      ctx.quadraticCurveTo(x + d * w * 0.5, y + s * 0.02, x, y + s * 0.1); ctx.fill();
    });
  }
  function drawHauntBreak(ctx, spr, cx, cy, s, tt, seed, ghost) {
    ctx.save();
    if (tt < 0.18) { // incha com brilho roxo
      var k = tt / 0.18, sc = 1 + 0.12 * Math.sin(k * Math.PI / 2);
      ctx.drawImage(spr, cx - s * sc / 2, cy - s * sc / 2, s * sc, s * sc);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * k; ctx.fillStyle = '#9b4dff';
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.55, 0, 7); ctx.fill();
    } else {
      var u = (tt - 0.18) / 0.82, rise = s * (ghost ? 1.3 : 0.7) * u;
      ctx.globalAlpha = Math.max(0, 1 - u * 1.3); var sc2 = 1 - 0.5 * u; // o bloco sobe e some
      ctx.drawImage(spr, cx - s * sc2 / 2 + Math.sin(u * 9 + seed) * s * 0.06, cy - s * sc2 / 2 - rise, s * sc2, s * sc2);
      for (var i = 0; i < 4; i++) { // fumaça roxa e laranja
        var a = seed * 1.3 + i * 1.57, d = s * (0.15 + 0.5 * u);
        ctx.globalAlpha = 0.38 * (1 - u); ctx.fillStyle = i % 2 ? 'rgba(160,80,255,1)' : 'rgba(255,130,40,1)';
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6 - s * 0.4 * u, s * (0.16 + 0.3 * u), 0, 7); ctx.fill();
      }
      if (seed % 3 === 0) { // um morcego sai voando
        var dir = seed % 2 ? 1 : -1, bx = cx + dir * s * 1.6 * u, by = cy - s * 1.9 * u + Math.sin(u * 14) * s * 0.08;
        ctx.globalAlpha = Math.min(1, 2.2 * (1 - u)); ctx.fillStyle = '#1a0f24'; ctx.shadowColor = '#ff8a1f'; ctx.shadowBlur = s * 0.25; // contorno laranja para aparecer no tabuleiro escuro
        drawBat(ctx, bx, by, s * 0.75, Math.abs(Math.sin(u * 22)));
      }
    }
    ctx.restore();
  }
  /* v1.25: blocos de Halloween (js/halloween-art.js) — só durante o evento e depois que a imagem carregou */
  // v1.29: o mesmo vale para os blocos de Natal (js/natal-art.js, gerado por tools/cut_blocks.py quando chegarem as imagens do dono)
  function evArt() { return terrorGame() ? window.MZHalloweenArt || null : natalGame() ? window.MZNatalArt || null : null; }
  function evArtKey() { return terrorGame() ? 'hw' : 'xm'; }
  var artImgs = {};
  function natalAlbum() { var ne = Events.byId('natal2026'); if (window.MZNatalArt && ne && !ne.album.length) ne.album = Events.NATAL_ALBUM; } // v1.29: blocos de Natal chegaram → álbum de Natal
  natalAlbum();
  /* v1.30 (fluidez): a arte do Halloween (256 KB) não trava mais a abertura do jogo — carrega depois, sozinha, ou na hora se houver evento.
     Na versão de arquivo único (laboratório) ela já vem junto. loadArt(cb) chama cb quando estiver pronta. */
  var artQ = null;
  function loadArt(cb) {
    if (window.MZHalloweenArt) { if (cb) cb(); return; }
    if (!artQ) {
      artQ = []; var sc = document.createElement('script'); sc.src = 'js/halloween-art.js'; sc.async = true;
      sc.onload = function () { natalAlbum(); artImgs = {}; sprites = {}; rareCache = {}; if (state) drawTray(false); requestRender(); var q = artQ; artQ = []; q.forEach(function (f) { try { f(); } catch (e) {} }); };
      sc.onerror = function () { artQ = null; };
      document.head.appendChild(sc);
    }
    if (cb) artQ.push(cb);
  }
  function hwTile(skin, theme) {
    var art = evArt(); if (!art) return null; // v1.25 (dono): blocos do evento só no modo Evento — Clássico e Zen ficam normais
    var ak = evArtKey(), im = artImgs[ak];
    if (!im) { im = artImgs[ak] = new Image(); im.onload = function () { im.ready = true; sprites = {}; rareCache = {}; if (typeof drawTray === 'function' && state) drawTray(false); requestRender(); }; im.src = art.src; }
    if (!im.ready) return null;
    var k = skin;
    if (skin === 'classic' && theme) k = { verdeagua: 'v-verdeagua', brancoazul: 'v-brancoazul', terra: 'v-terra' }[theme.id] || 'classic';
    var row = art.keys.indexOf(k); return row < 0 ? null : { row: row, key: k, img: im, cell: art.cell };
  }
  /* v1.25: blocos normais das imagens do dono (js/normal-art.js) — fora do modo Evento */
  var nmImg = null, nmReady = false;
  function nmTile(skin) {
    var art = window.MZNormalArt; if (!art || evArt()) return null;
    if (!nmImg) { nmImg = new Image(); nmImg.onload = function () { nmReady = true; sprites = {}; if (state) drawTray(false); requestRender(); if (window.GBMenus && window.GBMenus.refresh && screenIs('collection')) window.GBMenus.refresh('collection'); if (screenIs('home') || overlayOpen()) buildSkinPicker && $('#skins') && buildSkinPicker(); }; nmImg.src = art.src; }
    if (!nmReady) return null;
    var row = art.keys.indexOf(skin); return row < 0 ? null : { row: row, key: skin, img: nmImg, cell: art.cell, normal: true };
  }
  setTimeout(function () { nmTile('ice'); }, 0);
  var FLAGS = window.MZFlags || { helpers: true, legends: true, zenNew: true }; // v1.26: partes esperando aprovação do dono (js/flags.js)
  if (FLAGS.hype && window.MZHype) MZHype.Voice.init(); // v1.30: procura vozes gravadas (assets/voz/vozes.json); sem elas, nada muda
  setTimeout(function () { if (FLAGS.helpers && !stats.helperWelcome) { stats.helperWelcome = 1; stats.helpers = { hammer: 1, rotate: 1, hint: 1 }; saveStats(); } }, 0); // v1.26: 1 de cada para experimentar // v1.25: começa a carregar os blocos novos já na abertura (a galeria não mostra os antigos)
  function artTile(skin, theme) { return hwTile(skin, theme) || nmTile(skin); }
  function sprite(theme, color, px, skinOpt) {
    var skin = skinOpt || curSkin(), classic = skin !== 'theme'; // casas vazias quadradas fora do modo "Do tema"
    var key = theme.id + '|' + color + '|' + px + '|' + skin + (settings.symbols ? '|s' : '') + (color >= 0 && artTile(skin, theme) ? (evArt() ? '|' + evArtKey() : '|nm') : ''), c = sprites[key];
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
    } else if (color >= 0 && artTile(skin, theme)) { // v1.25: blocos desenhados nas imagens do dono (Halloween no evento, normais fora dele)
      var hw = artTile(skin, theme), hc = hw.cell;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(hw.img, (color % 4) * hc, hw.row * hc, hc, hc, 0, 0, px, px);
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
    placeMascot(); // v1.30
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
  function onFire() { return !!state && state.combo >= 10 && settings.anim === 'full' && settings.quality !== 'low' && state.mode !== 'tutorial' && state.mode !== 'zen' && !document.hidden && screenIs('game'); }
  /** v1.25: faíscas correndo pela moldura enquanto o combo ×3+ está vivo (fora do Zen e dos efeitos leves). */
  function comboFrameOn() { return !!state && state.combo >= 3 && state.combo < 10 && !state.over && settings.anim === 'full' && settings.quality !== 'low' && state.mode !== 'tutorial' && state.mode !== 'zen' && !document.hidden && screenIs('game'); }
  var FACES = { jelly: 1, fur: 1, candy: 1, bubble: 1, cheese: 1 }; // v1.24: estilos com "carinha"
  function facesOn() { return !!state && !!FACES[curSkin()] && !artTile(curSkin(), boardTheme()) && settings.anim === 'full' && settings.quality !== 'low' && !document.hidden && screenIs('game'); }
  function cagesOn() { if (!state || !state.rare || settings.anim !== 'full' || document.hidden || !screenIs('game')) return false; for (var k in state.rare) if (isEvItem(state.rare[k])) return true; return false; }
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
    if (med > (FLAGS.juice ? 34 : 45)) { // abaixo de ~22 quadros por segundo de forma constante (v1.30, chave juice: abaixo de ~30 — celular médio também fica liso)
      perf.done = true; settings.autoLight = true; applyPreset('light');
      toast(T('Efeitos mais leves'), T('O celular estava engasgando, então deixamos os efeitos mais leves. Dá para mudar em Configurações → Visual.'));
    }
  }
  function frame(t) {
    rafId = 0;
    if (anims.length || drag) watchPerf(t); else perf.last = 0;
    var real = t; t = animNow(real);
    // só o movimento contínuo (sem animação nem arraste): até ~30 quadros por segundo
    if (!anims.length && !drag && (live() || onFire() || comboFrameOn() || facesOn() || cagesOn() || legendsOn()) && real - lastLive < 30) { requestRender(); return; }
    lastLive = real;
    anims = anims.filter(function (a) { return t - a.start < a.dur; });
    render(t);
    if (anims.length || glowing() || live() || onFire() || comboFrameOn() || facesOn() || cagesOn() || legendsOn() || (tutTarget && settings.anim !== 'off')) requestRender();
  }

  // estilos com movimento contínuo (pelos, gelatina): só com animações completas e o jogo visível
  function live() {
    if (hwFurOn()) return true; // v1.25: pelúcias monstruosas respiram e piscam
    return Skins.isLive(curSkin()) && !artTile(curSkin(), boardTheme()) && settings.anim === 'full' && !document.hidden &&
      screens.game.classList.contains('active') && !!state;
  }
  function hwFurOn() { return !!state && curSkin() === 'fur' && !!artTile('fur', null) && settings.anim === 'full' && settings.quality !== 'low' && !document.hidden && screens.game.classList.contains('active'); }
  var HW_FUR = ['#e0508f', '#ead8e6', '#e0508f', '#8340c8'], NM_FUR = ['#f2eef2', '#f08cb8', '#f08cb8', '#f2eef2'];
  function drawHwFur(ctx, spr, x, y, cell, now, seed, color) { // v1.25: pelo balançando de leve + olhos que piscam
    var b = 1 + 0.035 * Math.sin(now / 420 + seed), rot = 0.035 * Math.sin(now / 610 + seed * 1.7), cx = x + cell / 2, cy = y + cell / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(b, 2 - b);
    ctx.drawImage(spr, -cell / 2, -cell / 2, cell, cell);
    var furCols = terrorGame() ? HW_FUR : NM_FUR, cute = !terrorGame(); // normal: pelúcia fofinha (olhos pequenos)
    ctx.strokeStyle = furCols[color % 4]; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, cell * 0.035); ctx.globalAlpha = 0.85;
    for (var k = 0; k < 5; k++) { // tufos no alto da cabeça balançando
      var fx = -cell * 0.3 + k * cell * 0.15, sway = Math.sin(now / 260 + seed + k * 1.3) * cell * 0.06;
      ctx.beginPath(); ctx.moveTo(fx, -cell * 0.36); ctx.quadraticCurveTo(fx + sway, -cell * 0.46, fx + sway * 1.6, -cell * 0.5); ctx.stroke();
    }
    var per = 2600 + (seed * 137) % 2200, ph = (now + seed * 911) % per; // pisca de vez em quando, cada um no seu tempo
    if (ph < 150) {
      var k2 = Math.sin(ph / 150 * Math.PI); ctx.globalAlpha = 1; ctx.fillStyle = furCols[color % 4];
      [-0.15, 0.15].forEach(function (ex) { ctx.beginPath(); ctx.ellipse(ex * (cute ? 0.85 : 1) * cell, cute ? -cell * 0.04 : 0, cell * (cute ? 0.07 : 0.12), cell * (cute ? 0.05 : 0.075) * k2 + 0.5, 0, 0, 7); ctx.fill(); });
    }
    ctx.restore();
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
    var hwOn = !!artTile(curSkin(), th), furLive = hwOn && hwFurOn(); // v1.25: blocos de Halloween não giram/espelham (são desenhos prontos)
    var liveNow = !hwOn && live(), vary = !hwOn && !!Skins.VARY[curSkin()];
    var clearRows = {}, clearCols = {};
    if (prev && prev.preview) {
      prev.preview.rows.forEach(function (r) { clearRows[r] = 1; });
      prev.preview.cols.forEach(function (c) { clearCols[c] = 1; });
    }

    var cas = null; for (var ai = 0; ai < anims.length; ai++) if (anims[ai].type === 'cascade') { cas = anims[ai]; break; } // v1.30
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (cas) { // v1.30: entrada em onda — cada casa cresce e aparece um pouco depois da vizinha
          var ct = Math.max(0, Math.min(1, (now - cas.start - (r + c) * 32) / 240));
          if (ct <= 0) continue;
          if (ct < 1) { var ce = 1 - Math.pow(1 - ct, 3), csz = cell * (0.35 + 0.65 * ce) * (1 + 0.08 * Math.sin(ct * Math.PI)), cx0 = pad + c * cell + (cell - csz) / 2, cy0 = pad + r * cell + (cell - csz) / 2, cv = state.board[r * SIZE + c];
            ctx.globalAlpha = ce; ctx.drawImage(sprite(th, cv < 0 ? -1 : cv, px), cx0, cy0, csz, csz); ctx.globalAlpha = 1; continue; }
        }
        var cth = th;
        if (sw) cth = ((r + c) / (2 * (SIZE - 1))) <= sw.p ? sw.to : sw.from;
        var x = pad + c * cell, y = pad + r * cell, v = state.board[r * SIZE + c];
        if (v < 0 || (state.rare && String(state.rare[r * SIZE + c] || '').charAt(0) === 'L' && window.MZLegend)) ctx.drawImage(sprite(cth, -1, px), x, y, cell, cell); // v1.31: lendário não tem bloco comum por baixo (a borda dele não aparece em volta)
        else {
          var color = (prev && (clearRows[r] || clearCols[c])) ? prev.piece.c : v;
          if (furLive) drawHwFur(ctx, sprite(cth, color, px), x, y, cell, now, r * 7 + c * 3, color);
          else if (liveNow) Skins.drawLive(ctx, sprite(cth, color, px), curSkin(), cth, color, x, y, cell, now, r * 7 + c * 3);
          else if (vary) drawVaried(ctx, sprite(cth, color, px), x, y, cell, (r * 5 + c * 3) % 4);
          else ctx.drawImage(sprite(cth, color, px), x, y, cell, cell);
        }
      }
    }

    if (state.gems && state.gems.length) state.gems.forEach(function (i) { // v1.17: gemas presas nos blocos
      if (state.board[i] >= 0) ctx.drawImage(gemSprite(px), pad + (i % SIZE) * cell, pad + Math.floor(i / SIZE) * cell, cell, cell);
    });

    if (state.rare) for (var rk in state.rare) { // v1.24: blocos raros no tabuleiro (só visual)
      var ri = +rk; if (state.board[ri] < 0 || ((isEvItem(state.rare[rk]) || state.rare[rk] === 'sn') && state.mode !== 'event')) continue; // v1.25: gaiola só no modo Evento
      var rx = pad + (ri % SIZE) * cell, ry = pad + Math.floor(ri / SIZE) * cell;
      ctx.save(); if (settings.anim === 'full' && !isEvItem(state.rare[rk]) && state.rare[rk] !== 'sn') ctx.globalAlpha = 0.82 + 0.18 * Math.sin(now / 300 + ri);
      var rsh = isEvItem(state.rare[rk]) && settings.anim === 'full' && (now + ri * 377) % 2400 < 300 ? Math.sin(now / 22) * cell * 0.05 : 0; // o morcego sacode a gaiola
      if (String(state.rare[rk]).charAt(0) === 'L') { ctx.globalAlpha = 1; drawRare(ctx, state.rare[rk], rx, ry, cell, px, now, ri); }
      else ctx.drawImage(rareSprite(state.rare[rk], px), rx + rsh, ry, cell, cell);
      if (isEvItem(state.rare[rk]) && state.pkAge && state.pkAge[rk] != null) { // v1.25: jogadas até o morcego fugir (aparece nas 3 últimas)
        var fleeLeft = itemFlee(state.rare[rk]) - ((state.evMoves || 0) - state.pkAge[rk]);
        if (fleeLeft <= 3) {
          var bxr = rx + cell * 0.8, byr = ry + cell * 0.2, brr = cell * 0.19;
          ctx.fillStyle = fleeLeft <= 1 ? '#e8243c' : '#b0306a'; ctx.beginPath(); ctx.arc(bxr, byr, brr, 0, 7); ctx.fill();
          ctx.lineWidth = Math.max(1, cell * 0.03); ctx.strokeStyle = '#fff'; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.round(cell * 0.26) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(Math.max(1, fleeLeft)), bxr, byr + cell * 0.01);
        }
      }
      ctx.restore();
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
    else if (comboFrameOn()) drawComboSparks(ctx, now);
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
  /* v1.25: faíscas na cor do visual dando a volta na borda do tabuleiro; mais faíscas e mais rápidas conforme o combo.
   *  Quando só falta 1 peça para o combo acabar, elas ficam mais fracas (a moldura "apagando"). */
  function drawComboSparks(ctx, now) {
    var S = L.size, k = state.combo, n = k >= 7 ? 8 : k >= 5 ? 6 : 4, per = 4 * (S - 6), speed = k >= 7 ? 0.11 : k >= 5 ? 0.085 : 0.06;
    var left = Logic.CONFIG.combo.window - state.movesSinceClear, dim = left <= 1 ? 0.45 : 1, col = boardTheme().accent, haunt = terrorGame();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col;
    for (var i = 0; i < n; i++) {
      if (haunt) col = i % 2 ? '#a45bff' : '#ff8a1f'; // v1.25: faíscas roxas e laranja no evento
      var d = ((now * speed + i * per / n) % per + per) % per, side = Math.floor(d / (S - 6)), o = d % (S - 6) + 3, x, y;
      if (side === 0) { x = o; y = 3; } else if (side === 1) { x = S - 3; y = o; } else if (side === 2) { x = S - o; y = S - 3; } else { x = 3; y = S - o; }
      var r = L.cell * 0.09 * (0.8 + 0.3 * Math.sin(now / 120 + i));
      var g = ctx.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.55 * dim; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.95 * dim; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  /* v1.24: fogo subindo da borda de baixo do tabuleiro (e brilho quente nas laterais) com combo ×10 ou mais */
  function drawFire(ctx, now) {
    var S = L.size, n = 9, cell = L.cell;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var side = ctx.createLinearGradient(0, 0, cell * 0.6, 0); side.addColorStop(0, 'rgba(255,120,30,.26)'); side.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = side; ctx.fillRect(0, 0, cell * 0.6, S);
    ctx.save(); ctx.translate(S, 0); ctx.scale(-1, 1); ctx.fillRect(0, 0, cell * 0.6, S); ctx.restore();
    for (var k = 0; k < n; k++) {
      for (var layer = 0; layer < 2; layer++) {
        var ph = now / (layer ? 230 : 310) + k * 2.1 + layer * 1.3, rise = (ph % 1 + 1) % 1;
        var x = (k + 0.5) / n * S + Math.sin(ph * 2.3) * cell * 0.15, h = cell * (1.3 + 0.6 * Math.sin(now / 170 + k)), y = S - rise * h;
        var r = cell * (0.75 - 0.45 * rise) * (layer ? 0.7 : 1);
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, layer ? (terrorGame() ? 'rgba(190,120,255,.8)' : natalGame() ? 'rgba(255,250,235,.85)' : 'rgba(255,235,140,.8)') : 'rgba(255,150,40,.7)'); // v1.25: fogo roxo e laranja no evento g.addColorStop(1, 'rgba(255,90,20,0)');
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
  /* v1.28 (laboratório): presente de Natal (desenho próprio) — caixa vermelha, fita dourada e laço. lid=0 desenha sem a tampa. */
  function drawGift(g, px, lid, gold) {
    g.save(); Themes.roundRect(g, px * 0.06, px * 0.06, px * 0.88, px * 0.88, px * 0.18); g.clip();
    var bg = g.createRadialGradient(px * 0.5, px * 0.4, px * 0.05, px * 0.5, px * 0.5, px * 0.62);
    bg.addColorStop(0, '#2c7a4b'); bg.addColorStop(1, '#0f3322'); g.fillStyle = bg; g.fillRect(0, 0, px, px); // fundo verde-pinheiro
    g.fillStyle = 'rgba(255,255,255,.75)'; [[0.18, 0.2], [0.82, 0.16], [0.14, 0.8], [0.86, 0.78], [0.5, 0.12]].forEach(function (d) { g.beginPath(); g.arc(px * d[0], px * d[1], px * 0.025, 0, 7); g.fill(); }); // neve
    g.restore();
    var bx = px * 0.22, by = px * 0.44, bw = px * 0.56, bh = px * 0.42;
    var bodyG = g.createLinearGradient(0, by, 0, by + bh); bodyG.addColorStop(0, gold ? '#ffe27a' : '#f0383f'); bodyG.addColorStop(1, gold ? '#c98a0c' : '#a8121c'); // v1.29: dourado = vale 3
    g.fillStyle = bodyG; Themes.roundRect(g, bx, by, bw, bh, px * 0.05); g.fill();
    g.fillStyle = '#ffd23f'; g.fillRect(px * 0.46, by, px * 0.08, bh); // fita
    if (lid) {
      g.fillStyle = gold ? '#f5c234' : '#d82230'; Themes.roundRect(g, px * 0.18, px * 0.34, px * 0.64, px * 0.13, px * 0.04); g.fill(); // tampa
      g.fillStyle = gold ? '#e8243c' : '#ffd23f'; g.fillRect(px * 0.46, px * 0.34, px * 0.08, px * 0.13);
      drawBow(g, px * 0.5, px * 0.33, px);
    }
    g.strokeStyle = gold ? '#fff2a8' : 'rgba(255,240,200,.9)'; g.lineWidth = Math.max(1.5, px * (gold ? 0.06 : 0.045)); g.shadowColor = '#ffd23f'; g.shadowBlur = px * (gold ? 0.16 : 0.08);
    Themes.roundRect(g, px * 0.07, px * 0.07, px * 0.86, px * 0.86, px * 0.18); g.stroke(); // moldura brilhante
    if (gold) { g.shadowBlur = 0; g.fillStyle = '#fff'; g.font = '900 ' + Math.round(px * 0.22) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeStyle = '#7a4a00'; g.lineWidth = Math.max(1, px * 0.04); g.strokeText('×3', px * 0.27, px * 0.22); g.fillText('×3', px * 0.27, px * 0.22); }
  }
  function drawSnowball(g, px) { // v1.29: bola de neve da Nevasca (some quando a linha é limpa)
    g.save(); Themes.roundRect(g, px * 0.06, px * 0.06, px * 0.88, px * 0.88, px * 0.18); g.clip();
    g.fillStyle = '#9fc4e8'; g.fillRect(0, 0, px, px); g.restore();
    var sb = g.createRadialGradient(px * 0.4, px * 0.38, px * 0.04, px * 0.5, px * 0.5, px * 0.42); sb.addColorStop(0, '#ffffff'); sb.addColorStop(0.7, '#e6f1ff'); sb.addColorStop(1, '#a9c6e6');
    g.fillStyle = sb; g.beginPath(); g.arc(px * 0.5, px * 0.52, px * 0.36, 0, 7); g.fill();
    g.fillStyle = 'rgba(120,160,210,.35)'; [[0.36, 0.62, 0.05], [0.6, 0.4, 0.04], [0.62, 0.66, 0.035]].forEach(function (d) { g.beginPath(); g.arc(px * d[0], px * d[1], px * d[2], 0, 7); g.fill(); });
  }
  function drawBow(g, x, y, px) {
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#c99a12'; g.lineWidth = Math.max(1, px * 0.02);
    [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(x + d * px * 0.1, y - px * 0.04, px * 0.1, px * 0.065, d * 0.5, 0, 7); g.fill(); g.stroke(); });
    g.beginPath(); g.arc(x, y - px * 0.01, px * 0.04, 0, 7); g.fill(); g.stroke();
  }
  function drawSnowPuff(ctx, x, y, s, u) { // nuvem de neve
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < 6; i++) { var a = i * 1.05, d = s * (0.12 + 0.4 * u); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, s * (0.14 + 0.18 * (1 - u)), 0, 7); ctx.fill(); }
  }
  function rareSprite(t, px) {
    var gift = t === 'gf' || t === 'pg' || (t === 'pk' && evTheme() === 'natal');
    var key = t + px + (gift ? 'g' : ''); if (rareCache[key]) return rareCache[key];
    if (gift) { var gc = document.createElement('canvas'); gc.width = gc.height = px; drawGift(gc.getContext('2d'), px, 1, t === 'pg'); return (rareCache[key] = gc); }
    if (t === 'sn') { var sc = document.createElement('canvas'); sc.width = sc.height = px; drawSnowball(sc.getContext('2d'), px); return (rareCache[key] = sc); }
    if (t === 'pk') { // v1.25 (ideia do dono): gaiolinha com morcego — quebre a linha para soltar o morcego
      var hc0 = document.createElement('canvas'); hc0.width = hc0.height = px; var h0 = hc0.getContext('2d');
      h0.save(); Themes.roundRect(h0, px * 0.06, px * 0.06, px * 0.88, px * 0.88, px * 0.18); h0.clip();
      var bg0 = h0.createRadialGradient(px * 0.5, px * 0.45, px * 0.05, px * 0.5, px * 0.5, px * 0.6);
      bg0.addColorStop(0, '#d9822b'); bg0.addColorStop(0.5, '#5a2470'); bg0.addColorStop(1, '#170a24'); h0.fillStyle = bg0; h0.fillRect(0, 0, px, px);
      h0.fillStyle = '#0e0614'; drawBat(h0, px * 0.5, px * 0.56, px * 0.78, 0.6); // morcego preso
      h0.fillStyle = '#ffb02e'; [0.43, 0.57].forEach(function (ex) { h0.beginPath(); h0.arc(px * ex, px * 0.52, px * 0.03, 0, 7); h0.fill(); }); // olhos acesos
      h0.restore();
      h0.strokeStyle = '#f2b544'; h0.lineCap = 'round'; h0.shadowColor = '#ff9a2a'; h0.shadowBlur = px * 0.06;
      h0.lineWidth = Math.max(1.5, px * 0.045);
      for (var bi = 0; bi < 5; bi++) { var bx0 = px * (0.2 + bi * 0.15); h0.beginPath(); h0.moveTo(bx0, px * 0.3); h0.lineTo(bx0, px * 0.86); h0.stroke(); } // grades
      h0.lineWidth = Math.max(2, px * 0.06);
      h0.beginPath(); h0.moveTo(px * 0.14, px * 0.86); h0.lineTo(px * 0.86, px * 0.86); h0.stroke(); // base
      h0.beginPath(); h0.moveTo(px * 0.17, px * 0.32); h0.quadraticCurveTo(px * 0.5, px * 0.08, px * 0.83, px * 0.32); h0.stroke(); // cúpula
      h0.beginPath(); h0.arc(px * 0.5, px * 0.12, px * 0.05, 0, 7); h0.stroke(); // argola
      h0.shadowBlur = px * 0.12; h0.strokeStyle = '#ffcf5a'; h0.lineWidth = Math.max(2, px * 0.05);
      Themes.roundRect(h0, px * 0.07, px * 0.07, px * 0.86, px * 0.86, px * 0.18); h0.stroke(); // moldura brilhante
      return (rareCache[key] = hc0);
    }
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
  function rareName(t) { var lg = Season.legendOf(t); if (lg) return T(window.MZLegend.byId(lg.id).name); var r = Season.RARES.filter(function (x) { return x.id === t; })[0]; return r ? T(r.name) : ''; }
  /* v1.26 (dono): blocos lendários — desenhados ao vivo por js/legend.js; poder = selinho no canto */
  var LEG_COL = { aurora: ['#3cffaa', '#50c8ff', '#be6eff'], glitch: ['#ff2bd6', '#2bf3ff', '#ffffff'], dragon: ['#ff5a1f', '#ffc23a', '#7a0f0f'], plasma: ['#9fe7ff', '#5a7bff', '#ffffff'], eye: ['#ff9a3c', '#ffe08a', '#7a2a00'], portal: ['#7a5bff', '#2bf3ff', '#ff6af0'], holo: ['#7fffe6', '#b38cff', '#ffffff'], galaxy: ['#ffbef0', '#c8dcff', '#fff6d8'], blackhole: ['#ffb347', '#ff6a2a', '#fff0c8'] };
  function legendLite() { return settings.anim !== 'full' || settings.quality === 'low'; }
  function drawPowerBadge(c2, pw, x, y, cell) {
    // v1.27 (laboratório): selo de poder redesenhado — moeda dourada contornada com símbolo desenhado (antes: emoji num círculo escuro)
    var P2 = Season.POWERS[pw]; if (!P2) return;
    var bx = x + cell * 0.76, by = y + cell * 0.24, br = cell * 0.21, lw = Math.max(1.2, cell * 0.045);
    c2.save();
    c2.fillStyle = '#05080F'; c2.beginPath(); c2.arc(bx + lw * 0.8, by + lw * 0.8, br, 0, 7); c2.fill(); // sombra carimbada
    var g = c2.createLinearGradient(bx - br, by - br, bx + br, by + br); g.addColorStop(0, '#FFE39A'); g.addColorStop(0.55, '#F5B93A'); g.addColorStop(1, '#C4861A');
    c2.fillStyle = g; c2.beginPath(); c2.arc(bx, by, br, 0, 7); c2.fill(); c2.lineWidth = lw; c2.strokeStyle = '#05080F'; c2.stroke();
    powerGlyph(c2, pw, bx, by, br * 0.62);
    c2.restore();
  }
  /** Símbolo de cada poder, desenhado (não depende de emoji do aparelho). */
  function powerGlyph(c2, pw, cx, cy, r) {
    c2.save(); c2.lineJoin = 'round'; c2.lineCap = 'round'; c2.fillStyle = '#05080F'; c2.strokeStyle = '#05080F'; c2.lineWidth = Math.max(1, r * 0.22);
    c2.beginPath();
    if (pw === 'z') { c2.moveTo(cx + r * 0.25, cy - r); c2.lineTo(cx - r * 0.55, cy + r * 0.12); c2.lineTo(cx - r * 0.02, cy + r * 0.12); c2.lineTo(cx - r * 0.25, cy + r); c2.lineTo(cx + r * 0.55, cy - r * 0.15); c2.lineTo(cx + r * 0.05, cy - r * 0.15); c2.closePath(); c2.fill(); }
    else if (pw === 'd') { c2.moveTo(cx - r * 0.8, cy - r * 0.25); c2.lineTo(cx - r * 0.45, cy - r * 0.75); c2.lineTo(cx + r * 0.45, cy - r * 0.75); c2.lineTo(cx + r * 0.8, cy - r * 0.25); c2.lineTo(cx, cy + r * 0.85); c2.closePath(); c2.fill(); }
    else if (pw === 'k') { c2.moveTo(cx - r * 0.85, cy + r * 0.6); c2.lineTo(cx - r * 0.85, cy - r * 0.5); c2.lineTo(cx - r * 0.35, cy); c2.lineTo(cx, cy - r * 0.8); c2.lineTo(cx + r * 0.35, cy); c2.lineTo(cx + r * 0.85, cy - r * 0.5); c2.lineTo(cx + r * 0.85, cy + r * 0.6); c2.closePath(); c2.fill(); }
    else if (pw === 'r') { [0.95, 0.62, 0.3].forEach(function (k) { c2.beginPath(); c2.arc(cx, cy + r * 0.45, r * k, Math.PI * 1.05, Math.PI * 1.95); c2.stroke(); }); }
    c2.restore();
  }
  function drawRare(c2, t, x, y, cell, px, now, seed) {
    var lg = Season.legendOf(t);
    if (lg && window.MZLegend) { window.MZLegend.draw(c2, lg.id, x, y, cell, legendLite() ? 0 : (now || 0), { seed: seed || 0, lite: legendLite() }); if (lg.pw) drawPowerBadge(c2, lg.pw, x, y, cell); return; }
    c2.drawImage(rareSprite(t, px), x, y, cell, cell);
  }
  /** Quadradinhos especiais de uma peça: [[índice da casa, valor]] (peça inteira lendária = todas as casas). */
  function rareCellsOf(p) {
    var sh = SHAPES[p.s]; if (!p.rk || !sh.cells[p.rk.k]) return [];
    if (!p.rk.all) return [[p.rk.k, p.rk.t]];
    var lg = Season.legendOf(p.rk.t), base = lg ? 'L:' + lg.id : p.rk.t;
    return sh.cells.map(function (_, i) { return [i, i === p.rk.k ? p.rk.t : base]; });
  }
  function legendsOn() { if (!state || !state.rare || legendLite() || document.hidden || !screenIs('game')) return false; for (var k in state.rare) if (String(state.rare[k]).charAt(0) === 'L') return true; return false; }
  function rareModes() { return state && (state.mode === 'classic' || state.mode === 'event'); } // v1.26: Zen só com blocos normais
  function tagRares() { // peças novas podem vir com 1 quadradinho raro
    if (!rareModes()) return;
    state.pieces.forEach(function (p) {
      if (!p || p.rq) return; p.rq = 1;
      var ev = state.mode === 'event' ? eventNow() : null, t = null; // v1.25: abóboras só no modo Evento
      if (ev) { var tr0 = evTier() || ev; t = Math.random() < (tr0.chance != null && tr0 !== ev ? tr0.chance : ev.goalChance) ? ev.rare : null; if (t && tr0.gold && Math.random() < tr0.gold) t = 'pg'; } // v1.29: chance do nível + presente dourado // v1.25 (dono): no modo Halloween só a gaiola — sem Vidro doce, Brasa ou Pérola
      else { t = Season.rollRare(stats, state.score, Math.random); if (t === 'pk' || t === 'gf') t = null; } // gaiola/presente nunca fora do evento
      var lgR = null; // v1.31 (pedido do dono): os lendários viraram medalhas de coleção — não aparecem mais nas peças
      if (lgR) { p.rk = { k: Math.floor(Math.random() * SHAPES[p.s].cells.length), t: 'L:' + lgR.id + (lgR.pw ? ':' + lgR.pw : '') }; if (lgR.whole && SHAPES[p.s].cells.length > 1) p.rk.all = 1; return; }
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
    if (a.type === 'legendBurst') { // v1.26: lendário quebrando — o bloco cresce e some num anel nas cores dele
      var lt = (now - a.start) / a.dur; if (lt < 0 || lt >= 1) return;
      var lcx = L.pad + (a.c + 0.5) * L.cell, lcy = L.pad + (a.r + 0.5) * L.cell, lcol = LEG_COL[a.id] || ['#fff', '#fff'];
      ctx.save(); ctx.globalAlpha = 1 - lt;
      var ls = L.cell * (1 + lt * 0.9); if (window.MZLegend) window.MZLegend.draw(ctx, a.id, lcx - ls / 2, lcy - ls / 2, ls, now, { seed: a.r * 8 + a.c, lite: true });
      ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = Math.max(2, L.cell * 0.12 * (1 - lt));
      [0, 1].forEach(function (k) { ctx.strokeStyle = lcol[k]; ctx.beginPath(); ctx.arc(lcx, lcy, L.cell * (0.4 + lt * (1.6 + k * 0.7)), 0, 7); ctx.stroke(); });
      ctx.restore(); return;
    }
    if (a.type === 'hint') { // v1.26: dica — contorno piscando onde a peça encaixa
      var ht = (now - a.start) / a.dur; if (ht < 0 || ht >= 1) return;
      var hal = 0.7 + 0.3 * Math.sin(ht * Math.PI * 6);
      ctx.save(); ctx.globalAlpha = hal * Math.min(1, (1 - ht) * 4); ctx.strokeStyle = boardTheme().accent; ctx.fillStyle = boardTheme().accent;
      ctx.lineWidth = Math.max(2, L.cell * 0.08); ctx.shadowColor = boardTheme().accent; ctx.shadowBlur = L.cell * 0.3;
      a.cells.forEach(function (x) { var hx = L.pad + x[1] * L.cell, hy = L.pad + x[0] * L.cell;
        ctx.globalAlpha = hal * 0.4; ctx.fillRect(hx + 3, hy + 3, L.cell - 6, L.cell - 6);
        ctx.globalAlpha = hal; Themes.roundRect(ctx, hx + 3, hy + 3, L.cell - 6, L.cell - 6, L.cell * 0.18); ctx.stroke(); });
      ctx.restore(); return;
    }
    if (a.type === 'snowDrop') { // v1.29: bola de neve caindo do alto até a casa
      var sd = (now - a.start) / a.dur; if (sd < 0 || sd >= 1) return;
      var sx2 = L.pad + a.c * L.cell, syEnd = L.pad + a.r * L.cell, sy2 = syEnd - (1 - sd * sd) * (syEnd + L.cell);
      ctx.save(); ctx.globalAlpha = 0.95; ctx.drawImage(rareSprite('sn', px), sx2, sy2, L.cell, L.cell); ctx.restore(); return;
    }
    if (a.type === 'flakes') { // v1.29: flocos saem dos blocos quebrados e caem girando
      var ft0 = (now - a.start) / a.dur; if (ft0 < 0 || ft0 >= 1) return;
      ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, L.cell * 0.04);
      a.cells.forEach(function (o, i) {
        var u = Math.max(0, Math.min(1, ft0 - (o.d || 0) / a.dur)); if (u <= 0) return;
        var fx0 = L.pad + (o.c + 0.5) * L.cell + Math.sin(u * 6 + i) * L.cell * 0.25, fy0 = L.pad + (o.r + 0.5) * L.cell - L.cell * 0.4 * Math.sin(u * Math.PI) + L.cell * 0.6 * u * u;
        var fr0 = L.cell * (0.16 + 0.06 * (i % 3)); ctx.globalAlpha = 0.9 * (1 - u);
        ctx.save(); ctx.translate(fx0, fy0); ctx.rotate(u * 3 + i);
        for (var sp = 0; sp < 3; sp++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-fr0, 0); ctx.lineTo(fr0, 0); ctx.moveTo(fr0 * 0.55, 0); ctx.lineTo(fr0 * 0.8, fr0 * 0.22); ctx.moveTo(fr0 * 0.55, 0); ctx.lineTo(fr0 * 0.8, -fr0 * 0.22); ctx.stroke(); }
        ctx.restore();
      });
      ctx.restore(); return;
    }
    if (a.type === 'batFlee' && a.xmas) { // v1.28: presente some numa nuvem de neve
      var nt = (now - a.start) / a.dur; if (nt < 0 || nt >= 1) return;
      var ncx = L.pad + (a.c + 0.5) * L.cell, ncy = L.pad + (a.r + 0.5) * L.cell;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - nt * 1.6); var ns = 1 - 0.7 * nt;
      ctx.drawImage(rareSprite('gf', px), ncx - L.cell * ns / 2, ncy - L.cell * ns / 2, L.cell * ns, L.cell * ns);
      ctx.globalAlpha = 0.85 * (1 - nt); drawSnowPuff(ctx, ncx, ncy - L.cell * 0.3 * nt, L.cell, nt);
      ctx.restore(); return;
    }
    if (a.type === 'pkbreak' && a.xmas) { // v1.28: presente abre — a tampa voa, sai uma estrela dourada e brilhos
      var xt = (now - a.start) / a.dur; if (xt >= 1) return;
      if (state && state.board[a.r * SIZE + a.c] >= 0) return;
      var xc = L.cell, xcx = L.pad + (a.c + 0.5) * xc, xcy = L.pad + (a.r + 0.5) * xc, xi;
      ctx.save();
      if (xt < 0.2) { var xsh = xt > 0 ? Math.sin(xt * 140) * xc * 0.05 : 0; ctx.drawImage(rareSprite(a.gold ? 'pg' : 'gf', px), xcx - xc / 2 + xsh, xcy - xc / 2, xc, xc); }
      else {
        var xu = (xt - 0.2) / 0.8;
        ctx.globalAlpha = Math.max(0, 1 - xu * 1.4);
        var boxC = document.createElement('canvas'); // caixa aberta (sem tampa)
        boxC.width = boxC.height = Math.max(8, Math.round(xc)); drawGift(boxC.getContext('2d'), boxC.width, 0); ctx.drawImage(boxC, xcx - xc / 2, xcy - xc / 2, xc, xc);
        ctx.save(); ctx.translate(xcx + xc * 0.5 * xu, xcy - xc * 0.2 - xc * 1.6 * xu + xc * 1.2 * xu * xu); ctx.rotate(xu * 2.2); // tampa voando
        ctx.fillStyle = '#d82230'; Themes.roundRect(ctx, -xc * 0.32, -xc * 0.065, xc * 0.64, xc * 0.13, xc * 0.04); ctx.fill();
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(-xc * 0.04, -xc * 0.065, xc * 0.08, xc * 0.13); drawBow(ctx, 0, -xc * 0.07, xc); ctx.restore();
        var sy = xcy - xc * 2.2 * xu, sr = xc * (0.18 + 0.12 * Math.sin(xu * 3.1)); // estrela subindo
        ctx.globalAlpha = Math.min(1, 2.4 * (1 - xu)); ctx.fillStyle = '#ffd23f'; ctx.shadowColor = '#fff3b0'; ctx.shadowBlur = xc * 0.35;
        ctx.beginPath(); for (xi = 0; xi < 10; xi++) { var ra = xi * Math.PI / 5 - Math.PI / 2 + xu * 2, rr = xi % 2 ? sr * 0.45 : sr; ctx.lineTo(xcx + Math.cos(ra) * rr, sy + Math.sin(ra) * rr); } ctx.closePath(); ctx.fill();
        if (a.seeds && xu < 0.7) { ctx.shadowBlur = 0; for (xi = 0; xi < 8; xi++) { var qa = xi * 0.785 + a.c, qd = xc * (0.2 + xu); ctx.globalAlpha = 0.9 * (1 - xu / 0.7); ctx.fillStyle = EV_FX.natal[xi % 4]; ctx.beginPath(); ctx.arc(xcx + Math.cos(qa) * qd, xcy + Math.sin(qa) * qd, xc * 0.05, 0, 7); ctx.fill(); } }
      }
      ctx.restore(); return;
    }
    if (a.type === 'batFlee') { // v1.25: morcego escapa voando, deixando um rastro de fumaça
      var ft = (now - a.start) / a.dur; if (ft < 0 || ft >= 1) return;
      var fcx = L.pad + (a.c + 0.5) * L.cell, fcy = L.pad + (a.r + 0.5) * L.cell, fdir = a.c < SIZE / 2 ? -1 : 1;
      ctx.save(); ctx.globalAlpha = 0.35 * (1 - ft); ctx.fillStyle = '#9b4dff';
      ctx.beginPath(); ctx.arc(fcx, fcy, L.cell * (0.3 + 0.5 * ft), 0, 7); ctx.fill();
      ctx.globalAlpha = Math.min(1, 2 * (1 - ft)); ctx.fillStyle = '#1a0f24'; ctx.shadowColor = '#e8243c'; ctx.shadowBlur = L.cell * 0.25;
      drawBat(ctx, fcx + fdir * L.cell * 3 * ft, fcy - L.cell * 3.2 * ft + Math.sin(ft * 14) * L.cell * 0.1, L.cell * 0.8, Math.abs(Math.sin(ft * 28)));
      ctx.restore(); return;
    }
    if (a.type === 'pkbreak') { // v1.25: gaiola quebra — grades caem e o morcego sai voando
      var pt = (now - a.start) / a.dur; if (pt >= 1) return;
      if (state && state.board[a.r * SIZE + a.c] >= 0) return; // casa já tem peça nova
      var pc = L.cell, pcx = L.pad + (a.c + 0.5) * pc, pcy = L.pad + (a.r + 0.5) * pc, pi;
      ctx.save();
      if (pt < 0.2) { var psh = pt > 0 ? Math.sin(pt * 140) * pc * 0.05 : 0; ctx.drawImage(rareSprite('pk', px), pcx - pc / 2 + psh, pcy - pc / 2, pc, pc); }
      else {
        var pu = (pt - 0.2) / 0.8;
        ctx.strokeStyle = '#f2b544'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, pc * 0.045); ctx.globalAlpha = Math.max(0, 1 - pu * 1.2);
        for (pi = 0; pi < 5; pi++) { // grades caindo e girando
          var side = pi - 2, gx2 = pcx + (pi * 0.15 - 0.3) * pc + side * pc * 0.5 * pu, gy2 = pcy + 0.08 * pc + pc * 1.8 * pu * pu;
          ctx.save(); ctx.translate(gx2, gy2); ctx.rotate(side * pu * 1.4 + (pi % 2 ? 0.4 : -0.4) * pu);
          ctx.beginPath(); ctx.moveTo(0, -pc * 0.28); ctx.lineTo(0, pc * 0.28); ctx.stroke(); ctx.restore();
        }
        var dir = (a.c < SIZE / 2) ? 1 : -1, bx = pcx + dir * pc * 2.4 * pu, by = pcy - pc * 2.8 * pu + Math.sin(pu * 12) * pc * 0.1; // morcego livre!
        ctx.globalAlpha = Math.min(1, 2.5 * (1 - pu)); ctx.fillStyle = '#1a0f24'; ctx.shadowColor = '#ff9a2a'; ctx.shadowBlur = pc * 0.25;
        drawBat(ctx, bx, by, pc * (0.7 + 0.3 * pu), Math.abs(Math.sin(pu * 26)));
        if (a.seeds && pu < 0.6) { ctx.shadowBlur = 0; ctx.fillStyle = '#ffd36a'; for (pi = 0; pi < 6; pi++) { var sa = pi * 1.05 + a.c, sd = pc * (0.2 + 0.9 * pu); ctx.globalAlpha = 0.9 * (1 - pu / 0.6); ctx.beginPath(); ctx.arc(pcx + Math.cos(sa) * sd, pcy + Math.sin(sa) * sd, pc * 0.04, 0, 7); ctx.fill(); } } // faíscas
      }
      ctx.restore(); return;
    }
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
    if (a.type === 'dust') { // v1.30: poeirinha ao assentar a peça
      var dt = (now - a.start) / a.dur; if (dt < 0 || dt >= 1) return;
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.globalAlpha = (1 - dt) * 0.8;
      a.cells.forEach(function (rc) {
        var bx = L.pad + rc[1] * L.cell, byy = L.pad + (rc[0] + 1) * L.cell - L.cell * 0.06;
        [-1, 1].forEach(function (d) { for (var q = 0; q < 2; q++) { var off = L.cell * (0.1 + 0.45 * dt + q * 0.12); ctx.beginPath(); ctx.arc(bx + L.cell / 2 + d * (L.cell * 0.32 + off), byy - L.cell * 0.12 * dt - q * L.cell * 0.05, L.cell * (0.05 + 0.04 * (1 - dt)), 0, 7); ctx.fill(); } });
      });
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
        if (o.pk) return; // v1.25: abóbora tem quebra própria (pkbreak)
        var tt = (now - a.start - o.d) / a.cellDur;
        var cx = pad + (o.c + 0.5) * cell, cy = pad + (o.r + 0.5) * cell;
        if (tt < 0) { ctx.drawImage(sprite(a.theme, o.color, px), cx - cell / 2, cy - cell / 2, cell, cell); return; }
        if (tt >= 1) return;
        if (a.hw) { drawHauntBreak(ctx, sprite(a.theme, o.color, px), cx, cy, cell, tt, o.r * 8 + o.c + 1, a.ghost); return; }
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
      var legCells = {}; if (p.rk && String(p.rk.t || '').charAt(0) === 'L' && window.MZLegend) rareCellsOf(p).forEach(function (rc) { legCells[rc[0]] = 1; }); // v1.31
      shape.cells.forEach(function (sc, k) { if (!legCells[k]) ctx.drawImage(sprite(th, p.c, px), ox + sc[1] * c, oy + sc[0] * c, c, c); });
      if (p.sp && shape.cells[p.sp.k]) drawSpecialOn(ctx, p.sp.t, ox + shape.cells[p.sp.k][1] * c, oy + shape.cells[p.sp.k][0] * c, c, px);
      if (p.rk && (!isEvItem(p.rk.t) || state.mode === 'event')) rareCellsOf(p).forEach(function (rc) { drawRare(ctx, rc[1], ox + shape.cells[rc[0]][1] * c, oy + shape.cells[rc[0]][0] * c, c, px, 0, rc[0]); });
      if (deal) { slot.classList.remove('deal'); void slot.offsetWidth; slot.classList.add('deal'); }
    });
  }

  /* ---------------- v1.26: ajudas — Martelo, Girar e Dica (ganhas nas missões diárias; dono: valem em todo lugar) ---------------- */
  var HELP = { hammer: { name: 'Martelo', icon: '🔨', tip: 'Toque num bloco do tabuleiro para quebrar.' },
    rotate: { name: 'Girar', icon: '🔄', tip: 'Toque numa peça embaixo para girar.' },
    hint: { name: 'Dica', icon: '💡', tip: '' } };
  var helperMode = null, shapeKeyMap = null;
  function helpersOn() { return FLAGS.helpers && !!state && state.mode !== 'tutorial' && state.mode !== 'weekly' && !state.over && !(state.nightmare && natalGame()); } // v1.29: Noite Feliz/Nevasca sem ajudas // v1.26 (dono): sem ajudas no Desafio da Semana (regras iguais para todos e a prova da partida continua valendo)
  function helperCount(k) { return (stats.helpers && stats.helpers[k]) || 0; }
  function updateHelpers() {
    var bar = $('#helpers'); if (!bar) return;
    bar.hidden = !state || state.mode === 'tutorial' || state.mode === 'weekly' || (state.nightmare && natalGame()) || !(FLAGS.helpers || (FLAGS.zenNew && state.mode === 'zen')); // v1.29: Noite Feliz/Nevasca sem ajudas
    Array.prototype.forEach.call(bar.querySelectorAll('[data-h]'), function (b) { b.hidden = !FLAGS.helpers; });
    Array.prototype.forEach.call(bar.querySelectorAll('[data-h]'), function (b) {
      var k = b.getAttribute('data-h'), n = helperCount(k);
      b.querySelector('b').textContent = n; b.classList.toggle('empty', !n); b.classList.toggle('on', helperMode === k);
      b.setAttribute('aria-pressed', String(helperMode === k));
    });
    boardBox.classList.toggle('hammer-mode', helperMode === 'hammer'); $('#tray').classList.toggle('rotate-mode', helperMode === 'rotate');
  }
  function useHelper(k) {
    stats.helpers[k] = Math.max(0, helperCount(k) - 1); saveStats();
    lastSnap = null; lastStatsSnap = null; // ajuda não se desfaz
    helperMode = null; zenHist = []; updateHelpers(); updateHud(); saveGame();
  }
  function shapeKey(cells) {
    var mr = Math.min.apply(null, cells.map(function (x) { return x[0]; })), mc = Math.min.apply(null, cells.map(function (x) { return x[1]; }));
    return cells.map(function (x) { return (x[0] - mr) + ',' + (x[1] - mc); }).sort().join(' ');
  }
  function rotatedShape(id) {
    if (!shapeKeyMap) { shapeKeyMap = {}; SHAPES.forEach(function (sh) { var k = shapeKey(sh.cells); if (shapeKeyMap[k] == null) shapeKeyMap[k] = sh.id; }); }
    var sh = SHAPES[id], rot = sh.cells.map(function (x) { return [x[1], sh.h - 1 - x[0]]; }), k = shapeKey(rot), to = shapeKeyMap[k];
    if (to == null || to === id) return null;
    var nsh = SHAPES[to], map = rot.map(function (x) { var mr = Math.min.apply(null, rot.map(function (y) { return y[0]; })), mc = Math.min.apply(null, rot.map(function (y) { return y[1]; }));
      var t = (x[0] - mr) + ',' + (x[1] - mc); for (var j = 0; j < nsh.cells.length; j++) if (nsh.cells[j][0] + ',' + nsh.cells[j][1] === t) return j; return 0; });
    return { id: to, map: map };
  }
  function helperTap(k) {
    if (!helpersOn() || locked) return;
    Sound.unlock(); Sound.tap();
    if (helperMode === k) { helperMode = null; updateHelpers(); return; } // tocar de novo cancela
    if (!helperCount(k)) { toast(HELP[k].icon + ' ' + T('Sem {name}', { name: T(HELP[k].name) }), T('Complete as missões do dia para ganhar ajudas.')); return; }
    if (k === 'hint') { doHint(); return; }
    helperMode = k; updateHelpers(); toast(HELP[k].icon + ' ' + T(HELP[k].name), T(HELP[k].tip));
  }
  function hammerAt(r, c) {
    var i = r * SIZE + c, col = state.board[i]; if (col < 0) return false;
    state.board[i] = -1;
    if (state.rare) delete state.rare[i]; if (state.spec) delete state.spec[i]; if (state.pkAge) delete state.pkAge[i];
    if (settings.anim !== 'off') anims.push({ type: 'clear', cells: [{ r: r, c: c, color: col, d: 0 }], theme: boardTheme(), skin: null, start: animNow(), cellDur: 420, dur: 420 });
    Sound.clear(1, 0, null); haptic('place'); shake(false);
    useHelper('hammer'); drawTray(false); requestRender();
    announce(T('Martelo: bloco quebrado.'));
    return true;
  }
  function rotateSlot(i) {
    var p = state.pieces[i]; if (!p) return;
    var rot = rotatedShape(p.s);
    if (!rot) { toast('🔄 ' + T('Girar'), T('Essa peça fica igual girando. Escolha outra.')); return; }
    p.s = rot.id;
    if (p.sp) p.sp.k = rot.map[p.sp.k] || 0; if (p.rk) p.rk.k = rot.map[p.rk.k] || 0;
    Sound.transform(false); haptic('pick');
    useHelper('rotate'); drawTray(false);
    var sl = slots[i]; sl.classList.remove('morph'); void sl.offsetWidth; sl.classList.add('morph');
    announce(T('Peça girada.'));
  }
  function doHint() {
    var best = null;
    state.pieces.forEach(function (p, i) {
      if (!p) return; var sh = SHAPES[p.s];
      for (var r = 0; r <= SIZE - sh.h; r++) for (var c = 0; c <= SIZE - sh.w; c++) {
        if (!Logic.canPlace(state.board, sh, r, c)) continue;
        var fl = Logic.previewLines(state.board, sh, r, c), lines = fl.rows.length + fl.cols.length, snug = 0;
        sh.cells.forEach(function (x) { var rr = r + x[0], cc = c + x[1]; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var a = rr + d[0], b = cc + d[1]; if (a < 0 || b < 0 || a >= SIZE || b >= SIZE || state.board[a * SIZE + b] >= 0) snug++; }); });
        var sc = lines * 100 + snug + sh.cells.length * 0.5;
        if (!best || sc > best.sc) best = { sc: sc, i: i, r: r, c: c, sh: sh, lines: lines };
      }
    });
    if (!best) { toast('💡 ' + T('Dica'), T('Nenhuma peça cabe agora.')); return; }
    anims = anims.filter(function (a) { return a.type !== 'hint'; });
    anims.push({ type: 'hint', cells: best.sh.cells.map(function (x) { return [best.r + x[0], best.c + x[1]]; }), start: animNow(), dur: 3200 });
    var sl = slots[best.i]; sl.classList.remove('hinted'); void sl.offsetWidth; sl.classList.add('hinted'); later(function () { sl.classList.remove('hinted'); }, 3200);
    Sound.tap(); useHelper('hint'); requestRender();
    toast('💡 ' + T('Dica'), best.lines ? T('Essa peça ali limpa {n}!', { n: best.lines }) : T('Essa peça encaixa bem ali.'));
  }
  function giveHelper(from) { // v1.26: missão concluída = +1 ajuda (alterna Martelo → Girar → Dica)
    var k = ['hammer', 'rotate', 'hint'][(stats.helperGift || 0) % 3]; stats.helperGift = (stats.helperGift || 0) + 1;
    stats.helpers[k] = Math.min(9, helperCount(k) + 1); saveStats(); updateHelpers(); return k;
  }
  Array.prototype.forEach.call(document.querySelectorAll('#helpers [data-h]'), function (b) {
    b.addEventListener('click', function () { helperTap(b.getAttribute('data-h')); });
  });
  /* ---------------- v1.26 (dono): ZEN NOVO — jardim que cresce, quadro pintado pelas linhas, desfazer e trocar à vontade ---------------- */
  var ZEN_PAL = ['#f6b8c4', '#ffd6a5', '#fdf3a7', '#c5ecc0', '#a8dcef', '#c7c3f5', '#f4c6ec', '#b9e7dc'];
  var ZEN_PLANT = 12, zenHist = [], zenDrawn = '';
  // v1.27 (laboratório): cada quadro esconde um desenho (arte original 8×8); as linhas limpas revelam as casas. Dígito = cor de ZEN_PAL.
  var ZEN_PICS = [
    { name: 'Pôr do sol', rows: ['11111111', '11122111', '11222211', '00222200', '44444444', '44424444', '44442444', '44444444'] },
    { name: 'Montanha', rows: ['44444224', '44444224', '44454444', '44555444', '45555544', '55535555', '33333333', '33337333'] },
    { name: 'Flor', rows: ['44444444', '44400444', '44022044', '44400444', '44434444', '44334444', '44434444', '33333333'] },
    { name: 'Peixe', rows: ['44444444', '44447444', '44111144', '41111514', '41111114', '44111144', '44444474', '66666666'] },
    { name: 'Casinha', rows: ['44442244', '44400444', '44000044', '40000004', '41111114', '41151124', '41151114', '33333333'] },
    { name: 'Arco-íris', rows: ['44444444', '40000004', '01111110', '12222221', '23444432', '34444443', '44444444', '33333333'] }
  ];
  function zenPic(i) { var p = ZEN_PICS[((i % ZEN_PICS.length) + ZEN_PICS.length) % ZEN_PICS.length]; return p.rows.join(''); }
  function zenPicNow() { return zenPic(zenData().art.length); }
  function zenOn() { return FLAGS.zenNew && !!state && state.mode === 'zen'; }
  function zenData() { if (!stats.zen || typeof stats.zen !== 'object') stats.zen = { garden: 0, art: [] }; if (!Array.isArray(stats.zen.art)) stats.zen.art = []; stats.zen.garden = Math.max(0, +stats.zen.garden || 0); return stats.zen; }
  function zenHash(n) { var x = Math.sin(n * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x); }
  /** Desenha o jardim (g = linhas limpas no Zen, para sempre). Usado na partida e na Coleção. */
  function drawGarden(cv, g) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || cv.width / dpr, H = cv.clientHeight || cv.height / dpr;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    var c2 = cv.getContext('2d'); c2.setTransform(dpr, 0, 0, dpr, 0, 0); c2.clearRect(0, 0, W, H);
    var sky = c2.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#9fd8f2'); sky.addColorStop(0.7, '#fde4ec'); sky.addColorStop(1, '#fff1d6'); // v1.27: céu de verdade
    c2.fillStyle = sky; Themes.roundRect(c2, 0, 0, W, H, 14); c2.fill();
    var ground = H * 0.8;
    c2.save(); Themes.roundRect(c2, 0, 0, W, H, 14); c2.clip();
    c2.fillStyle = '#ffe9a3'; c2.beginPath(); c2.arc(W * 0.86, H * 0.26, H * 0.13, 0, 7); c2.fill(); // sol
    c2.fillStyle = 'rgba(255,255,255,.85)'; [[0.2, 0.22, 1], [0.27, 0.18, 1.3], [0.34, 0.23, 0.9]].forEach(function (q) { c2.beginPath(); c2.arc(W * q[0], H * q[1], H * 0.07 * q[2], 0, 7); c2.fill(); }); // nuvem
    c2.fillStyle = '#b6e0b0'; c2.beginPath(); c2.moveTo(0, ground); c2.quadraticCurveTo(W * 0.25, ground - H * 0.32, W * 0.55, ground - H * 0.05); c2.quadraticCurveTo(W * 0.8, ground - H * 0.28, W, ground - H * 0.08); c2.lineTo(W, H); c2.lineTo(0, H); c2.closePath(); c2.fill(); // morros ao fundo
    c2.fillStyle = '#7bbf7a'; c2.beginPath(); c2.moveTo(0, H); c2.lineTo(0, ground);
    for (var x = 0; x <= W; x += 8) c2.lineTo(x, ground + Math.sin(x / 23) * 2.5); c2.lineTo(W, H); c2.closePath(); c2.fill();
    c2.fillStyle = '#5ea66a'; for (var gx = 4; gx < W; gx += 9) c2.fillRect(gx, ground + 2 + zenHash(gx) * 4, 1.5, 3); // grama
    var n = Math.min(ZEN_PLANT, 1 + Math.floor(g / 12));
    for (var i = 0; i < n; i++) {
      var grow = Math.max(0.12, Math.min(1, (g - i * 12) / 12)), slot = (i * 5) % ZEN_PLANT; // novas plantas nascem espalhadas
      var px0 = W * (slot + 0.5) / ZEN_PLANT + (zenHash(i) - 0.5) * W / ZEN_PLANT * 0.5, maxH = H * (0.5 + 0.24 * zenHash(i + 9)), ph = maxH * grow, kind = i % 5;
      c2.strokeStyle = '#3f8a4a'; c2.lineWidth = 2.6; c2.lineCap = 'round';
      c2.beginPath(); c2.moveTo(px0, ground + 2); c2.quadraticCurveTo(px0 + 3, ground - ph / 2, px0, ground - ph); c2.stroke(); // caule
      c2.fillStyle = '#6cc070';
      [0.35, 0.6].forEach(function (f, k) { if (grow < f - 0.2) return; var ly = ground - ph * f, d = k ? -1 : 1; c2.beginPath(); c2.ellipse(px0 + d * 5, ly, 5.5, 2.4, d * -0.5, 0, 7); c2.fill(); }); // folhas
      var top = ground - ph, col = ZEN_PAL[(i * 3) % ZEN_PAL.length];
      if (grow < 0.7) { c2.fillStyle = '#8fd18f'; c2.beginPath(); c2.ellipse(px0, top, 2.5, 3.5, 0, 0, 7); c2.fill(); continue; } // broto
      var bloom = grow >= 1 ? 1 : 0.55, r = Math.min(9, H * 0.11) * bloom;
      if (kind === 0) { c2.fillStyle = col; c2.beginPath(); c2.moveTo(px0 - r, top - r * 0.2); c2.quadraticCurveTo(px0, top + r * 1.4, px0 + r, top - r * 0.2); c2.lineTo(px0 + r * 0.5, top - r); c2.lineTo(px0, top - r * 0.4); c2.lineTo(px0 - r * 0.5, top - r); c2.closePath(); c2.fill(); } // tulipa
      else if (kind === 1 || kind === 2) { // margarida / girassol
        c2.fillStyle = kind === 2 ? '#ffd45c' : '#fffaf0';
        for (var pp = 0; pp < 8; pp++) { var a = pp / 8 * Math.PI * 2; c2.beginPath(); c2.ellipse(px0 + Math.cos(a) * r * 0.7, top + Math.sin(a) * r * 0.7, r * 0.45, r * 0.22, a, 0, 7); c2.fill(); }
        c2.fillStyle = kind === 2 ? '#8a5a2b' : '#f5c04a'; c2.beginPath(); c2.arc(px0, top, r * 0.35, 0, 7); c2.fill();
      } else if (kind === 3) { c2.fillStyle = '#b79cf0'; for (var lv = 0; lv < 5; lv++) { c2.beginPath(); c2.arc(px0 + (lv % 2 ? 1.6 : -1.6), top + lv * 3 * bloom, 2.4 * bloom + 0.6, 0, 7); c2.fill(); } } // lavanda
      else { c2.fillStyle = '#5fb36a'; c2.beginPath(); c2.arc(px0, top + 2, r * 0.95, 0, 7); c2.fill(); c2.fillStyle = col; [[-3, 0], [3, 2], [0, -3]].forEach(function (o) { c2.beginPath(); c2.arc(px0 + o[0] * bloom, top + 2 + o[1] * bloom, 1.8, 0, 7); c2.fill(); }); } // arbusto com frutinhas
    }
    var bf = g >= ZEN_PLANT * 12 + 12 ? Math.min(4, 1 + Math.floor((g - ZEN_PLANT * 12 - 12) / 40)) : 0; // borboletas no jardim completo
    for (var b = 0; b < bf; b++) { var bx = W * (0.15 + 0.7 * zenHash(b + 40)), by = H * (0.18 + 0.25 * zenHash(b + 50)); c2.fillStyle = ZEN_PAL[(b * 2 + 5) % 8]; c2.beginPath(); c2.ellipse(bx - 3, by, 3, 2.2, -0.5, 0, 7); c2.ellipse(bx + 3, by, 3, 2.2, 0.5, 0, 7); c2.fill(); }
    c2.restore();
  }
  /** Desenha um quadro (64 casas: '.' = sem tinta, '0'..'7' = cor pastel). */
  function drawArt(cv, art, sketch) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || cv.width / dpr;
    if (cv.width !== Math.round(W * dpr)) { cv.width = cv.height = Math.round(W * dpr); }
    var c2 = cv.getContext('2d'); c2.setTransform(dpr, 0, 0, dpr, 0, 0); c2.clearRect(0, 0, W, W);
    var fr = Math.max(3, W * 0.07), inner = W - fr * 2, k = inner / SIZE;
    c2.fillStyle = '#b98a5a'; Themes.roundRect(c2, 0, 0, W, W, W * 0.1); c2.fill(); // moldura de madeira
    c2.fillStyle = '#fbf6ec'; c2.fillRect(fr, fr, inner, inner); // tela
    for (var i = 0; i < SIZE * SIZE; i++) {
      var d = art ? art.charAt(i) : '.';
      if ((d === '.' || d === '') && sketch) { c2.globalAlpha = 0.22; c2.fillStyle = ZEN_PAL[+sketch.charAt(i) % ZEN_PAL.length]; c2.fillRect(fr + (i % SIZE) * k + k * 0.3, fr + Math.floor(i / SIZE) * k + k * 0.3, k * 0.4, k * 0.4); c2.globalAlpha = 1; continue; }
      if (d === '.' || d === '') continue;
      c2.globalAlpha = 0.8 + 0.2 * zenHash(i); c2.fillStyle = ZEN_PAL[+d % ZEN_PAL.length];
      Themes.roundRect(c2, fr + (i % SIZE) * k - 0.3, fr + Math.floor(i / SIZE) * k - 0.3, k + 0.6, k + 0.6, k * 0.3); c2.fill();
    }
    c2.globalAlpha = 1;
  }
  function zenArtNow() { return state && typeof state.art === 'string' && state.art.length === SIZE * SIZE ? state.art : new Array(SIZE * SIZE + 1).join('.'); }
  function syncZenUi() {
    var on = zenOn() && screenIs('game');
    $('#screen-game').classList.toggle('zen-mode', zenOn());
    $('#zen-bar').hidden = !zenOn();
    Array.prototype.forEach.call(document.querySelectorAll('#helpers .zen-only'), function (b) { b.hidden = !zenOn(); });
    if (Sound.setCalm) Sound.setCalm(on);
    if (!zenOn()) return;
    var key = zenData().garden + '|' + zenArtNow() + '|' + zenData().art.length + '|' + ($('#zen-garden').clientWidth || 0);
    if (key === zenDrawn) return; zenDrawn = key;
    drawGarden($('#zen-garden'), zenData().garden); drawArt($('#zen-art'), zenArtNow(), zenPicNow());
    var plants = Math.min(ZEN_PLANT, 1 + Math.floor(zenData().garden / 12));
    $('#zen-garden').setAttribute('aria-label', T('Seu jardim: {n} plantas', { n: plants }));
  }
  /** Linhas limpas no Zen: o jardim cresce e o quadro ganha tinta onde os blocos estavam. */
  function zenGrow(res) {
    var z = zenData(), before = Math.min(ZEN_PLANT, 1 + Math.floor(z.garden / 12));
    z.garden += res.lineCount;
    var art = zenArtNow().split('');
    var pic = zenPicNow();
    res.cleared.forEach(function (o) { art[o.r * SIZE + o.c] = pic.charAt(o.r * SIZE + o.c); });
    state.art = art.join('');
    if (state.art.indexOf('.') === -1) { // quadro pronto → vai para a galeria
      z.art.unshift(state.art); if (z.art.length > 40) z.art.length = 40; state.art = null;
      later(function () { toast('🖼️ ' + T('Quadro pronto!'), T('Ele foi guardado na Coleção. Um quadro novo começa agora.')); }, 700);
    }
    if (Math.min(ZEN_PLANT, 1 + Math.floor(z.garden / 12)) > before) { var gc = $('#zen-garden'); gc.classList.remove('grow'); void gc.offsetWidth; gc.classList.add('grow'); }
    saveStats();
  }
  function zenSwap() { // trocar as peças à vontade (só no Zen)
    if (!zenOn() || locked || state.over) return;
    Sound.unlock(); Sound.tap();
    zenHist.push({ snap: JSON.stringify(state), stats: JSON.stringify(stats) }); if (zenHist.length > 30) zenHist.shift();
    state.pieces = Logic.generatePieces(state.board, Math.random, Logic.ctxOf(state));
    state.pieces.forEach(function (p) { if (p) p.rq = 1; });
    lastSnap = null; drawTray(true); updateHud(); saveGame(); announce(T('Peças trocadas.'));
  }
  Array.prototype.forEach.call(document.querySelectorAll('#helpers [data-z]'), function (b) { b.addEventListener('click', zenSwap); });

  boardBox.addEventListener('pointerdown', function (e) { // martelo: toque no bloco
    if (helperMode !== 'hammer' || !state) return;
    var rect = boardCanvas.getBoundingClientRect(), c = Math.floor((e.clientX - rect.left - L.pad) / L.cell), r = Math.floor((e.clientY - rect.top - L.pad) / L.cell);
    e.preventDefault(); e.stopPropagation();
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE || state.board[r * SIZE + c] < 0) { toast('🔨 ' + T('Martelo'), T('Toque num bloco (não numa casa vazia).')); return; }
    hammerAt(r, c);
  }, true);
  $('#tray').addEventListener('pointerdown', function (e) { // girar: toque na peça
    if (helperMode !== 'rotate' || !state) return;
    var sl = e.target.closest && e.target.closest('.slot'); if (!sl) return;
    e.preventDefault(); e.stopPropagation(); rotateSlot(+sl.getAttribute('data-i'));
  }, true);

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
    var legCells = {}; if (piece.rk && String(piece.rk.t || '').charAt(0) === 'L' && window.MZLegend) rareCellsOf(piece).forEach(function (rc) { legCells[rc[0]] = 1; }); // v1.31
    shape.cells.forEach(function (sc, k) { if (!legCells[k]) dctx.drawImage(sprite(th, piece.c, px), sc[1] * cell, sc[0] * cell, cell, cell); });
    if (piece.sp && shape.cells[piece.sp.k]) drawSpecialOn(dctx, piece.sp.t, shape.cells[piece.sp.k][1] * cell, shape.cells[piece.sp.k][0] * cell, cell, px);
    if (piece.rk) rareCellsOf(piece).forEach(function (rc) { drawRare(dctx, rc[1], shape.cells[rc[0]][1] * cell, shape.cells[rc[0]][0] * cell, cell, px, 0, rc[0]); });
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

  /* v1.30 (laboratório, chave juice): a peça arrastada inclina para o lado do movimento e volta ao parar (como uma carta balançando) */
  var tilt = { a: 0, target: 0, raf: 0, lx: 0, lt: 0 };
  function tiltOn() { return !!FLAGS.juice && settings.anim === 'full' && settings.quality !== 'low'; }
  function tiltTick() {
    tilt.target *= 0.82; tilt.a += (tilt.target - tilt.a) * 0.3;
    if (drag && !dragCanvas.hidden && (Math.abs(tilt.a) > 0.05 || Math.abs(tilt.target) > 0.05)) { dragCanvas.style.rotate = tilt.a.toFixed(2) + 'deg'; tilt.raf = requestAnimationFrame(tiltTick); }
    else { tilt.raf = 0; tilt.a = 0; dragCanvas.style.rotate = ''; }
  }
  function tiltFeed(x) {
    if (!tiltOn()) return;
    var t = performance.now();
    if (tilt.lt && t > tilt.lt) tilt.target = Math.max(-11, Math.min(11, (x - tilt.lx) / Math.max(8, t - tilt.lt) * 16));
    tilt.lx = x; tilt.lt = t;
    if (!tilt.raf) tilt.raf = requestAnimationFrame(tiltTick);
  }
  function tiltReset() { tilt.lt = 0; tilt.target = 0; tilt.a = 0; dragCanvas.style.rotate = ''; if (window.MZMascot) MZMascot.look(); }
  function moveDrag(x, y) {
    var d = drag; tiltFeed(x);
    if (mascotOn() && settings.anim !== 'off') MZMascot.look(x, y); // v1.30: o Kabloquinho acompanha a peça com os olhos
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
    tiltReset();
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
    var rkSet = [];
    if (placedPiece && placedPiece.rk && SHAPES[placedPiece.s].cells[placedPiece.rk.k] && Logic.canPlace(state.board, SHAPES[placedPiece.s], r, c)) { // v1.24: bloco raro vai para o tabuleiro
      state.rare = state.rare || {}; // v1.26: antes da jogada, para o poder do lendário valer na mesma jogada
      rareCellsOf(placedPiece).forEach(function (rv) { var rc = SHAPES[placedPiece.s].cells[rv[0]], ix = (r + rc[0]) * SIZE + c + rc[1]; state.rare[ix] = rv[1]; rkSet.push(ix); }); // v1.26: peça inteira lendária
    }
    var res = Logic.place(state, slot, r, c, rngFor(state));
    var feverNow = false; // v1.30 (laboratório, chave febre): combo ×5 no Clássico liga a Febre — 3 jogadas valendo pontos em dobro
    if (res && FLAGS.febre && state.mode === 'classic' && res.combo >= 5 && prevCombo < 5 && !((state.fever | 0) > 0)) { state.fever = 3; feverNow = true; }
    var feverEnded = !!(res && res.fever && !((state.fever | 0) > 0));
    if (!res) { rkSet.forEach(function (ix) { delete state.rare[ix]; }); return false; }
    var rareGone = [], lastRareKinds = {};
    if (state.rare) Object.keys(state.rare).forEach(function (k) { if (state.board[+k] < 0) { rareGone.push(+k); lastRareKinds[+k] = state.rare[k]; delete state.rare[k]; } });
    tagRares();
    if (state.mode === 'weekly') state.moves = (state.moves || '') + String.fromCharCode(Weekly.packMove(slot, r, c)); // prova da partida
    if (snap) { lastSnap = snap; lastStatsSnap = statsSnap; }
    if (snap && zenOn()) { zenHist.push({ snap: snap, stats: statsSnap }); if (zenHist.length > 30) zenHist.shift(); } // v1.26: Zen desfaz à vontade
    if (!res.lineCount) announce(T('Peça colocada.'));
    var now = animNow(), lvl = settings.anim, th = boardTheme(), geo = { cell: L.cell, pad: L.pad, size: L.size };
    var colorOf = function (ci) { if (evGame()) return EV_FX[evTheme()][ci % 4]; var p = pal(th); return p[ci % p.length]; }; // v1.25: faíscas assombradas no evento
    Sound.placeSkin(curSkin());
    if (!res.lineCount) haptic('place'); // toque firme a cada peça encaixada
    // encaixe: pequena expansão e retorno + faíscas discretas
    if (lvl !== 'off') anims.push({ type: 'pop', cells: res.placed, color: res.color, theme: th, start: now, dur: lvl === 'full' ? 220 : 140 });
    if (FLAGS.juice && lvl === 'full' && settings.quality !== 'low' && state.mode !== 'zen') { // v1.30: poeirinha nas bordas de baixo da peça que assentou
      var placedSet = {}; res.placed.forEach(function (rc) { placedSet[rc[0] * SIZE + rc[1]] = 1; });
      anims.push({ type: 'dust', cells: res.placed.filter(function (rc) { return !placedSet[(rc[0] + 1) * SIZE + rc[1]]; }).slice(0, 5), start: now + 40, dur: 420 });
    }
    if (partsOn()) anims.push(Fx.sparks(res.placed, colorOf(res.color), geo, now, anims));
    if (evGame()) { // v1.25: álbum do evento — participação (selo), blocos vistos e mais abóboras numa partida
      var evA = eventNow(), alb = stats.events[evA.id] = stats.events[evA.id] || { played: 1, seen: {}, pk: 0 };
      alb.played = 1; alb.seen = alb.seen || {};
      var hk = hwTile(curSkin(), boardTheme()); if (hk && !alb.seen[hk.key]) { alb.seen[hk.key] = 1; saveStats(); }
    }
    if (evGame()) { // v1.25 (dono): o morcego foge se a gaiola não for quebrada a tempo
      state.evMoves = (state.evMoves || 0) + 1; state.pkAge = state.pkAge || {};
      Object.keys(state.pkAge).forEach(function (k) { if (!state.rare || !isEvItem(state.rare[k])) delete state.pkAge[k]; });
      if (state.rare) Object.keys(state.rare).forEach(function (k) { if (isEvItem(state.rare[k]) && state.pkAge[k] == null) state.pkAge[k] = state.evMoves; });
      var fled = 0;
      Object.keys(state.pkAge).forEach(function (k) {
        if (state.evMoves - state.pkAge[k] < itemFlee(state.rare[k])) return;
        delete state.pkAge[k]; delete state.rare[k]; fled++;
        var fr = Math.floor(+k / SIZE), fc = +k % SIZE;
        if (lvl !== 'off') anims.push({ type: 'batFlee', r: fr, c: fc, xmas: natalGame(), start: now + 150, dur: 1000 });
        popup(natalGame() ? '❄️ ' + T('Sumiu!') : '🦇 ' + T('Fugiu!'), [fr, fc], 'pts-small', 0.4, false, 200);
      });
      if (fled && natalGame()) { later(function () { Sound.poof && Sound.poof(); }, 200); announce(T('Um presente sumiu na neve!')); }
      else if (fled) { later(function () { Sound.ghost && Sound.ghost(); }, 200); announce(T('Um morcego fugiu!')); }
      var tz = evTier();
      if (tz && tz.snow && !state.over && state.evMoves % tz.snow === 0) dropSnowball(now, lvl); // v1.29: Nevasca — cai uma bola de neve no tabuleiro
    }
    if (res.lineCount && natalOn() && state.mode !== 'tutorial' && window.MZNatal) { // v1.29: árvore de Natal — uma luz por linha limpa em dezembro
      var tr = MZNatal.addLines(stats, res.lineCount); saveStats();
      if (tr.done) reward('trophy', T('A árvore de Natal acendeu inteira! 🌟'), T('Você ganhou o {b}, guardado para sempre.', { b: T('Selo Árvore Acesa 2026') }));
      else if (tr.milestone) reward('trophy', T('A árvore ganhou mais luzes! 🎄'), T('{a} de {b} luzes acesas.', { a: tr.lit, b: MZNatal.TREE_LIGHTS }));
    }
    var pkGone = rareGone.reduce(function (n, ri) { return n + (lastRareKinds[ri] === 'pg' ? 3 : lastRareKinds[ri] === 'pk' ? 1 : 0); }, 0); // v1.29: dourado vale 3
    if (pkGone) { // v1.24: Semana do Terror — abóboras limpas
      state.pk = (state.pk || 0) + pkGone;
      var evP = eventNow(); if (evP && stats.events[evP.id] && state.pk > (stats.events[evP.id].pk || 0)) { stats.events[evP.id].pk = state.pk; saveStats(); }
      if (evP && evP.theme === 'natal' && stats.events[evP.id]) { // v1.29: recorde de cada nível + "faltam só N!"
        var tb = stats.events[evP.id].best = stats.events[evP.id].best || {}, tn = state.tier === 3 ? 3 : state.nightmare ? 2 : 1;
        if (state.pk > (tb[tn] || 0)) { tb[tn] = state.pk; saveStats(); }
        var gl = evGoal(), was = state.pk - pkGone;
        if (!state.pkDone && state.pk < gl && was < gl - 5 && state.pk >= gl - 5) popup(T('Faltam só {n}! 🎁', { n: gl - state.pk }), [2.6, 3.5], 'combo-big hot', 0, false, 300);
        else if (!state.pkDone && state.pk === gl - 1) popup(T('Só mais 1! 🎁'), [2.6, 3.5], 'combo-big hot', 0, false, 300);
        if (pkGone >= 3 && lastRareKinds && rareGone.some(function (ri) { return lastRareKinds[ri] === 'pg'; })) popup('✨ ' + T('Presente dourado! +3'), [1.4, 3.5], 'pts-small', 0, false, 100);
      }
      var evn = eventNow();
      if (state.mode === 'event' && evn && !state.pkDone && state.pk >= evGoal()) {
        state.pkDone = true; stats.rares = stats.rares || {}; stats.rares[evPrize()] = 1;
        if (state.nightmare && state.tier !== 3) { var evN = stats.events[evn.id] = stats.events[evn.id] || { played: 1, seen: {}, pk: 0 }; evN.nightmare = 1; }
        saveStats();
        if (evn.theme === 'natal') { // v1.28
          if (state.tier === 3) { stats.events[evn.id].storm = 1; saveStats(); reward('trophy', T('Nevasca vencida! ❄️'), T('Você ganhou o {b}, guardado para sempre. Pouca gente consegue!', { b: T(evn.storm.badge) })); }
          else if (state.nightmare) reward('trophy', T('Noite Feliz vencida! 🌟'), T('Você ganhou o {b}, guardado para sempre. Agora encare a Nevasca!', { b: T(evn.nightmare.badge) }));
          else reward('trophy', T('Desafio de Natal concluído! 🎄'), T('Você é Ajudante do Noel! Ganhou a conquista e liberou a Fase Noite Feliz.'));
        } else if (state.nightmare) reward('trophy', T('Pesadelo vencido! 👹'), T('Você ganhou o {b}, guardado para sempre.', { b: T(evn.nightmare.badge) }));
        else reward('trophy', T('Desafio do evento concluído! 🎃'), T('Você é Caçador de Morcegos! Ganhou a conquista e liberou a Fase Pesadelo.'));
        later(function () { Sound.record(); }, 400);
      }
    }
    if (rareGone.length) { // v1.24: limpar bloco raro faz festa (brilho branco + som de recompensa)
      rareGone.forEach(function (ri, n) { if (partsOn()) anims.push(Fx.sparks([[Math.floor(ri / SIZE), ri % SIZE]], '#ffffff', geo, now + 200 + n * 60, anims)); });
      later(function () { Sound.star && Sound.star(); }, 260);
      var rareTxt = rareGone.filter(function (ri) { return !isEvItem(lastRareKinds[ri]) && lastRareKinds[ri] !== 'sn'; })[0]; // v1.25: abóbora já tem contador e quebra própria — sem texto extra
      var hasPw = res.special && res.special.legend && res.special.legend.length;
      if (rareTxt != null && !(hasPw && FLAGS.legends)) popup('✨ ' + rareName(lastRareKinds[rareTxt]), [Math.floor(rareTxt / SIZE), rareTxt % SIZE], 'pts-small', 0.6, false, 250);
      var legGone = rareGone.filter(function (ri) { return Season.legendOf(lastRareKinds[ri]); }); // v1.26: explosão própria de cada lendário (nas cores dele)
      if (legGone.length) {
        if (partsOn()) legGone.slice(0, 6).forEach(function (ri, n) { var lg = Season.legendOf(lastRareKinds[ri]); (LEG_COL[lg.id] || ['#fff']).forEach(function (col, j) { anims.push(Fx.sparks([[Math.floor(ri / SIZE), ri % SIZE]], col, geo, now + 140 + n * 50 + j * 90, anims)); }); });
        if (lvl !== 'off') legGone.slice(0, 6).forEach(function (ri, n) { anims.push({ type: 'legendBurst', r: Math.floor(ri / SIZE), c: ri % SIZE, id: Season.legendOf(lastRareKinds[ri]).id, start: now + n * 40, dur: 650 }); });
        haptic('place');
      }
    }
    if (res.special && res.special.legend && res.special.legend.length) { // v1.26: poderes dos lendários
      var PW_TXT = { z: '⚡ ' + T('Raio!'), d: '💎 ' + T('Diamante!'), k: '👑 ' + T('Coroa: jogada em dobro!'), r: '🌈 ' + T('Arco-íris!') };
      // v1.27 (laboratório): um aviso só, na fila das mensagens grandes (antes vários textos se amontoavam em cima do combo)
      var pwSeen = {}, pwTxt = res.special.legend.filter(function (lp) { if (pwSeen[lp.pw]) return false; pwSeen[lp.pw] = 1; return !!PW_TXT[lp.pw]; }).map(function (lp) { return PW_TXT[lp.pw]; });
      if (pwTxt.length) popup(pwTxt.join(' · '), [SIZE - 2, SIZE / 2 - 0.5], 'legend-pw', 0, false, 380);
      later(function () { Sound.record && Sound.record(); }, 380);
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
      var zen = state.mode === 'zen'; // v1.25: Zen tranquilo — só a quebra básica, sem moldura, partículas, flashes, tremor ou vibração especial
      var charge = lvl === 'full' && !zen ? 170 : 0; // 1) linhas acendem e pulsam  2) quebram
      if (lvl !== 'off') {
        var skinNow = curSkin(), custom = lvl === 'full' && !zen && Skins.isCustom(skinNow); // quebra própria (com tremor) só com animações completas
        var stag = lvl === 'full' ? 22 : 0, cellDur = custom ? Skins.breakMs(skinNow) : lvl === 'full' ? 320 : 200, maxD = 0;
        var cells = res.cleared.map(function (o) {
          var d = (Math.abs(o.r - origin[0]) + Math.abs(o.c - origin[1])) * stag;
          maxD = Math.max(maxD, d);
          return { r: o.r, c: o.c, color: o.color, d: d };
        });
        if (charge) anims.push({ type: 'charge', cells: cells, glow: colorOf(res.color), start: now, dur: charge, sprite: null });
        // v1.21: feixe de luz atravessando cada linha limpa; vira arco-íris em várias linhas de uma vez ou combo ×3+
        if (settings.fx !== 'off' && !zen) anims.push({ type: 'beam', rows: res.rows.slice(), cols: res.cols.slice(), rainbow: res.lineCount >= 2 || res.combo >= 3,
          color: colorOf(res.color), start: now + charge * 0.5, dur: lvl === 'full' ? 520 : 360 });
        cells.forEach(function (o) { // v1.25: gaiolas da Semana do Terror quebram e soltam o morcego
          var ri0 = o.r * SIZE + o.c; if (!isEvItem(lastRareKinds[ri0])) return;
          o.pk = true;
          anims.push({ type: 'pkbreak', r: o.r, c: o.c, xmas: natalGame(), gold: lastRareKinds[ri0] === 'pg', seeds: lvl === 'full' && !zen && settings.quality !== 'low', start: now + charge + o.d, dur: 900 });
        });
        if (natalGame() && lvl !== 'off' && !zen) anims.push({ type: 'flakes', cells: cells.slice(0, 16), start: now + charge, dur: 1000 }); // v1.29: quebra com flocos de neve
        var haunted = terrorGame() && lvl === 'full'; // v1.25: quebra assombrada (fumaça roxa e laranja, fantasmas sobem, morcegos voam)
        if (haunted) { custom = false; cellDur = 560; }
        anims.push({ type: 'clear', cells: cells, theme: th, hw: haunted, ghost: curSkin() === 'theme', skin: custom ? skinNow : null, start: now + charge, cellDur: cellDur, dur: maxD + cellDur });
        if (partsOn() && !custom && !zen) anims.push(Fx.burst(res.cleared, colorOf, geo, now, intensity, anims, charge));
        if (lvl === 'full' && res.lineCount >= 2 && !zen) {
          anims.push({ type: 'ring', x: L.pad + (origin[1] + 0.5) * L.cell, y: L.pad + (origin[0] + 0.5) * L.cell, reach: 4 + res.lineCount * 2,
            color: colorOf(res.color), start: now + charge, dur: 520 });
        }
      }
      // blocos reagem à jogada (hierarquia: 1 linha discreta → combo acende → várias linhas: onda → tabuleiro limpo: florada)
      if (lvl === 'full' && settings.quality !== 'low' && !zen) {
        var filled = function () { var out = []; if (!state) return out; for (var i = 0; i < state.board.length; i++) if (state.board[i] >= 0) out.push({ r: Math.floor(i / SIZE), c: i % SIZE }); return out; };
        if (res.lineCount >= 2) anims.push({ type: 'wave', cellsFn: filled, r: origin[0], c: origin[1], reach: 9, color: '#ffffff', peak: Math.min(0.55, 0.28 + 0.09 * res.lineCount), start: now + charge, dur: 650 });
        if (res.combo >= 2) anims.push({ type: 'glowCells', cellsFn: filled, color: colorOf(res.color), peak: Math.min(0.42, 0.12 + 0.06 * res.combo), start: now + charge + 120, dur: 520 });
        else if (tier >= 2 && res.lineCount < 2) anims.push({ type: 'glowCells', cellsFn: filled, color: '#ffffff', peak: 0.16, start: now + charge, dur: 420 });
        if (res.boardClear) anims.push({ type: 'bloom', size: SIZE, start: now + charge + 250, dur: 1200 });
      }
      if (res.boardClear || tier >= 3 || res.combo >= 5) mascot('wow', 1100); else mascot('happy', 800); // v1.30: mascote comemora
      var breakSkin = curSkin();
      // v1.23 (menos poluição sonora): escala + UM detalhe — combo (se houver), senão a quebra do estilo, senão o "boom"
      if (res.combo >= 3 && evGame() && Math.random() < 0.5) later(function () { if (natalGame()) Sound.jingle(); else Sound.ghost(); }, 300);
      else if (natalGame()) later(function () { Sound.bell(); }, 120); // v1.29: sininho na quebra (Natal) // v1.24: fantasma no combo (evento)
    if (res.combo >= 2) { Sound.clear(res.lineCount, res.combo, null); Sound.combo(res.combo); }
      else if (Sound.hasBreak(breakSkin)) { Sound.clear(res.lineCount, res.combo, null); later(function () { Sound.breakSkin(breakSkin, res.lineCount); }, charge * 0.6); }
      else Sound.clear(res.lineCount, res.combo, 'boom');
      if (zen) haptic('line'); else if (res.boardClear) haptic('celebrate'); else if (res.combo >= 2) haptic('combo', res.combo); else haptic(res.lineCount > 1 ? 'lines' : 'line');
      if (lvl === 'full' && !zen && (res.lineCount >= 2 || res.boardClear || res.combo >= 5)) later(function () { shake(res.boardClear || res.lineCount >= 3 || res.combo >= 8 ? 'big' : ''); }, charge);
      if (lvl === 'full' && settings.fx === 'full' && !zen && (res.lineCount >= 3 || res.boardClear)) { // v1.24: câmera lenta na jogada épica
        slowMo(650, 0.3, Math.max(0, charge - 40));
        later(function () { boardBox.classList.remove('epic'); void boardBox.offsetWidth; boardBox.classList.add('epic'); }, Math.max(0, charge - 40));
      }
      // cada mensagem em sua faixa, para não se sobreporem: pontos na jogada, elogio, combo, recompensas
      // faixas fixas (em linhas do tabuleiro) para as mensagens não se sobreporem
      var mid = SIZE / 2 - 0.5, lane = res.boardClear ? { points: 6.7 } : { points: 0 };
      var pr = lane.points || (origin[0] < 4.6 ? 5.8 : Math.min(SIZE - 1.2, origin[0]));
      // v1.23 (menos poluição): pontos pequenos junto da peça; UMA mensagem grande por vez (combo, se houver; senão o elogio)
      var flyMs = FLAGS.juice && settings.anim === 'full' && !zen ? (res.boardClear ? 650 : 380) : 0;
      if (!flyMs) popup('+' + fmt(res.gained), res.boardClear ? [pr, mid] : [Math.max(0.6, Math.min(SIZE - 0.8, origin[0] - 0.6)), Math.max(1, Math.min(SIZE - 2, origin[1]))], 'pts-small', 0);
      if (flyMs) { flyToScore('+' + fmt(res.gained), res.boardClear ? [4.2, mid] : origin, flyMs); scoreHoldUntil = Date.now() + flyMs + 700; } // v1.30: pontos voam até o placar (o placar sobe quando chegam)
      var rec3 = (state.recent || []).slice(-3), streak = rec3.length === 3 && rec3.every(function (v) { return v > 0; });
      var word = res.combo >= 2 || res.boardClear || hypeOn() ? '' : praiseFor(tier, res.boardClear, res.combo, streak);
      if (word) popup(word, [2.6, mid], 'praise t' + (word === T('Imparável!') ? 4 : tier), 0);
      var hyped = false;
      // v1.31 (dono: "a fala tá muito frequente e as animações também"): a fala grande aparece só nos momentos que
      // valem: 3+ linhas, 2 linhas no máximo a cada 6 s, e o combo só nos marcos (7, 10, 15, 20…). 1 linha: só os pontos.
      var cmb = Math.floor(+res.combo) || 0, comboMile = cmb === 7 || cmb === 10 || (cmb > 10 && cmb % 5 === 0);
      if (hypeOn() && !res.boardClear && (comboMile || (cmb < 2 && (tier >= 3 || (tier === 2 && Date.now() - hypeAt > 6000))))) { // v1.30: fala animada (combo 7+ vira "Imparável!"/"Lendário!" com o combo embaixo)
        word = sayHype(MZHype.pick(tier, { combo: comboMile ? cmb : 0, streak: streak }), [1.15, mid], comboMile ? T('Combo ×{n}', { n: cmb }) + (res.comboBonus > 0 ? '  +' + fmt(Math.floor(+res.comboBonus) || 0) : '') : '');
        hyped = comboMile; hypeAt = Date.now();
      }
      if (feverNow && !res.boardClear) { // a Febre é a mensagem grande desta jogada
        if (window.MZHype) sayHype({ key: 'Febre!', voice: 'febre', tier: 4 }, [1.15, mid], T('Pontos ×2')); // v1.30 (dono: menos texto na tela)
        else popup(T('Febre!'), [2.6, mid], 'praise t4', 0);
        later(function () { Sound.hype(4); }, 80); hyped = true;
      }
      if (res.combo >= 2 && !res.boardClear && !hyped) { // combo em destaque: número grande + pontos extras do combo; combos altos ganham cor e confete
        var cbCls = 'combo-big' + (res.combo >= 10 ? ' mega' : res.combo >= 5 ? ' hot' : ''), cbShow = true;
        if (hypeOn()) { // v1.30 (dono: menos poluição): combo no mesmo estilo limpo das falas, no alto do tabuleiro
          var ct = res.combo >= 5 ? 3 : 2;
          cbShow = cmb === 3 || cmb === 5 || (tier >= 3 && Date.now() - hypeAt > 2500);
          if (cbShow) { hypeAt = Date.now(); // v1.31: combo grande só no ×3, ×5 ou numa jogada forte (o contador do combo continua no alto)
          popup(MZHype.build(document, T('Combo ×{n}', { n: Math.floor(+res.combo) || 0 }), ct, res.comboBonus > 0 ? '+' + fmt(Math.floor(+res.comboBonus) || 0) : ''), [1.15, mid], 'hype t' + ct + ' combo-hype', 0, false, 60); }
        } else
        popup(T('Combo <b>{n}</b>', { n: Math.floor(+res.combo) || 0 }) + (res.comboBonus > 0 ? ' <small>+' + fmt(Math.floor(+res.comboBonus) || 0) + '</small>' : '')  /* v1.21.2: só números entram no HTML */, [2.6, mid], cbCls, 0, true, 60);
        if (cbShow && res.combo >= 5 && partsOn() && !res.boardClear && !zen) anims.push(Fx.confetti(natalGame() ? ['#e8243c', '#2fbf5a', '#ffd23f', '#ffffff', '#1f6b3d'] : evGame() ? ['#ff8a1f', '#9b4dff', '#ffb347', '#6a2fd1', '#2a1a3a'] : pal(th), geo, now + charge + 120, Math.min(70, 20 + res.combo * 4), anims));
        var rec4 = (state.recent || []).slice(-4), streak4 = rec4.length === 4 && rec4.every(function (v) { return v > 0; });
        if (cbShow && lvl === 'full' && settings.quality !== 'low' && !zen && (res.combo >= 5 || streak4)) // efeito temporário: faixas de cor atravessando os blocos
          anims.push({ type: 'prism', cellsFn: function () { var o = []; if (!state) return o; for (var i = 0; i < state.board.length; i++) if (state.board[i] >= 0) o.push({ r: Math.floor(i / SIZE), c: i % SIZE }); return o; },
            start: now + charge + 200, dur: 1400, strong: res.combo >= 7 });
      }
      if (res.boardClear) { // recompensa especial: contorno brilhando, confete e bônus
        // v1.23: limpeza perfeita é a única mensagem grande da jogada (o bônus vai junto, pequeno)
        if (hypeOn()) sayHype(MZHype.pick(4, { boardClear: true }), [4.2, mid], '+' + fmt(Math.floor(+res.clearPts) || 0), 200, true);
        else popup(T('Limpeza perfeita!') + '<br><small>+' + fmt(Math.floor(+res.clearPts) || 0) + '</small>', [4.2, mid], 'big clear', 0, true, 200);
        if (lvl !== 'off' && !zen) anims.push({ type: 'boardGlow', color: th.accent, start: now + charge, dur: 1300 });
        if (partsOn() && !zen) anims.push(Fx.confetti(pal(th), geo, now + charge, 80, anims));
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
      if (hypeOn()) sayHype({ key: MZHype.SPECIAL.record.k, voice: MZHype.SPECIAL.record.v, tier: 4 }, [SIZE - 1.4, SIZE / 2 - 0.5], '', res.lineCount ? 750 : 0, true);
      else popup(T('Novo recorde!'), [SIZE - 1.4, SIZE / 2 - 0.5], 'praise t4', 0, false, res.lineCount ? 750 : 0);
      later(function () { haptic('celebrate'); mascot('wow', 1800); }, res.lineCount ? 750 : 0); // v1.30: Kabloquinho comemora o recorde
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
    if (feverEnded) { announce(T('Fim da Febre.')); later(function () { Sound.comboLost(3); }, 300); }
    surpriseAfterMove(res, recordNow, prevCombo);
    if (prevCombo >= 2 && state.combo === 0 && state.mode !== 'tutorial') comboEnded(prevCombo);
    if (res.levelUp) { // subiu de nível: multiplicador maior (também no último passo do tutorial)
      if (hypeOn()) popup(MZHype.build(document, T('Fase {n}!', { n: res.level }), 2, '×' + multText(res.level)), [SIZE - 2.6, SIZE / 2 - 0.5], 'hype t2 level-hype', 0, false, res.lineCount ? 1050 : 0); // v1.30: mesmo estilo limpo
      else popup(T('Fase {n}!', { n: res.level }) + ' ×' + multText(res.level), [SIZE - 2.6, SIZE / 2 - 0.5], 'level', 0, false, res.lineCount ? 1050 : 0);
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

  /* v1.30 (laboratório, chave hype): fala animada + voz gravada (se houver) ou "apresentador" sintetizado */
  /* v1.30 (laboratório, chave mascote): Kabloquinho reage às jogadas */
  /** v1.30: o mascote cabe no espaço entre a barra de fase e o tabuleiro (encolhe até 34 px); sem espaço, some. */
  function placeMascot() {
    var m = window.MZMascot && MZMascot.el; if (!m || m.hidden) return;
    var tb = document.querySelector('#screen-game .theme-bar'), gbar = $('#goal-bar'); if (!tb) return;
    var above = Math.max(tb.getBoundingClientRect().bottom, gbar && !gbar.hidden ? gbar.getBoundingClientRect().bottom : 0);
    var gap = boardBox.getBoundingClientRect().top - above - 4, size = Math.min(52, gap + 6);
    m.classList.toggle('kbq-nospace', size < 34); // sem espaço: some (nunca cobre o tabuleiro nem a barra)
    if (size < 34) return;
    m.style.width = m.style.height = size + 'px';
    m.style.top = -(size - 6) + 'px';
  }
  /* v1.30 (laboratório, chave mascote): Kabloquinho também na tela inicial, em cima do Jogar, com um balão que puxa para a partida
     (baú do dia esperando, sequência de dias, missões, evento, recorde). Toque nele para a próxima frase. */
  var homeKbq = null, homeBub = null, homeBubT = 0, homeLines = [], homeLineI = 0;
  /** v1.30 (laboratório, chave do acabamento): fundo com profundidade — bolhas de luz bem suaves na cor do visual, flutuando devagar. Some com Efeitos leves/mínimos, qualidade baixa e nos eventos (que têm o próprio fundo). */
  function ambLayer(on) {
    var lay = $('#amb-layer');
    on = on && FLAGS.juice && settings.anim === 'full' && settings.quality !== 'low';
    if (!lay) { if (!on) return; lay = el('div'); lay.id = 'amb-layer'; lay.setAttribute('aria-hidden', 'true'); for (var i = 1; i <= 7; i++) lay.appendChild(el('i', 'amb a' + i)); var appEl = $('#app'); appEl.parentNode.insertBefore(lay, appEl); } // entre o fundo (.bg-layer) e o jogo
    lay.hidden = !on;
  }
  /** v1.30 (laboratório, chave do acabamento): atalhos no alto das Configurações (Som · Vibração · Visual · Jogo · Progresso · Idioma).
      Tocar rola até a seção; a seção visível fica marcada. Nada é escondido (as opções continuam todas na mesma tela). */
  function settingsJump() {
    var card = $('#ov-settings .card'); if (!card) return;
    var secs = Array.prototype.filter.call(card.querySelectorAll('h3.set-sec'), function (h) { return h.offsetParent; });
    var bar = card.querySelector('.set-jump');
    if (!bar) {
      bar = el('nav', 'set-jump'); bar.setAttribute('aria-label', T('Seções das configurações'));
      card.insertBefore(bar, $('#settings-title').nextSibling);
      card.addEventListener('scroll', function () { markJump(); }, { passive: true });
    }
    bar.textContent = '';
    secs.forEach(function (h, i) {
      var parts = h.textContent.trim().split(' '), ic = parts.length > 1 ? parts.shift() : '', name = parts.join(' ');
      var b = el('button', 'sj'); b.type = 'button'; b.appendChild(el('span', 'sj-ic', ic)); b.appendChild(el('span', '', name));
      b.addEventListener('click', function () { Sound.tap(); card.scrollTo({ top: h.offsetTop - bar.offsetHeight - 10, behavior: settings.anim === 'off' ? 'auto' : 'smooth' }); });
      bar.appendChild(b);
    });
    card.scrollTop = 0; markJump();
    function markJump() {
      var y = card.scrollTop + bar.offsetHeight + 24, cur = 0;
      secs.forEach(function (h, i) { if (h.offsetTop <= y) cur = i; });
      if (card.scrollTop + card.clientHeight >= card.scrollHeight - 4) cur = secs.length - 1;
      Array.prototype.forEach.call(bar.children, function (b, i) { var was = b.classList.contains('on'); b.classList.toggle('on', i === cur); if (i === cur && !was) bar.scrollTo({ left: Math.max(0, b.offsetLeft - 24), behavior: 'smooth' }); });
    }
  }
  var homeCheer = '';
  function homeLinesNow() {
    var out = homeCheer ? [homeCheer] : []; homeCheer = '';
    var best = bestFor('classic'), sk = Season.streakNow(stats, today()), st = stats.streak || {}, left = (stats.missions || []).filter(function (m) { return !m.done; }).length;
    if (stats.chestDay !== today()) out.push(T('Baú do dia te esperando! 🎁'));
    if (sk >= 2 && st.last !== today()) out.push(T('{n} dias seguidos! Não perde hoje 🔥', { n: sk }));
    if (eventNow()) out.push(T('Tem evento rolando! 🎉'));
    if (left) out.push(left === 1 ? T('Falta 1 missão hoje') : T('Faltam {n} missões hoje', { n: left }));
    if (best > 0) out.push(T('Bora passar dos {n} pontos?', { n: fmt(best) }));
    out.push(T('Hoje é dia de recorde!'), T('Bora jogar?'));
    return out;
  }
  function homeSay(i) {
    if (!homeBub) return; clearTimeout(homeBubT);
    homeBub.textContent = homeLines[i % homeLines.length]; homeBub.classList.remove('show'); void homeBub.offsetWidth; homeBub.classList.add('show');
    homeBubT = setTimeout(function () { homeBub.classList.remove('show'); }, 4200);
  }
  var napT = 0;
  function homeNap() { // v1.30: parado 25 s na tela inicial, o Kabloquinho cochila; qualquer toque acorda
    clearTimeout(napT);
    napT = setTimeout(function () { if (homeKbq && screenIs('home') && !overlayOpen()) homeKbq.base('sleep'); }, 25000);
  }
  document.addEventListener('pointerdown', function () { if (homeKbq && homeKbq.mood === 'sleep') { homeKbq.base('idle'); homeKbq.react('wow', 600); } if (homeKbq) homeNap(); }, true);
  function homeMascot() {
    if (!FLAGS.mascote || !window.MZMascot || !MZMascot.create) return;
    var play = $('#btn-play'); if (!play) return;
    if (!homeKbq) {
      var wrap = el('div', 'play-wrap'); play.parentNode.insertBefore(wrap, play); wrap.appendChild(play);
      homeKbq = MZMascot.create(); homeKbq.mount(wrap, function () { Sound.boop(); haptic('line'); homeSay(++homeLineI); });
      homeKbq.el.classList.add('kbq-home'); homeKbq.el.setAttribute('aria-label', T('Kabloquinho: toque para ouvir uma dica'));
      homeBub = el('div', 'kbq-bubble'); homeBub.setAttribute('role', 'status'); wrap.appendChild(homeBub);
    }
    homeKbq.show(settings.kbq !== false); if (settings.kbq === false) return;
    homeLines = homeLinesNow(); homeLineI = 0; homeKbq.base('idle'); homeNap(); var hev = eventNow(); homeKbq.outfit(hev && hev.theme === 'natal' ? 'xmas' : '');
    setTimeout(function () { if (screenIs('home') && !overlayOpen()) { homeKbq.react('happy', 900); homeSay(0); } }, 900);
  }
  function mascotOn() { return !!FLAGS.mascote && settings.kbq !== false && !!window.MZMascot && !!state && state.mode !== 'zen' && state.mode !== 'tutorial'; }
  function mascot(m, ms) { if (mascotOn()) MZMascot.react(m, ms); }
  function hypeOn() { return !!FLAGS.hype && !!window.MZHype; }
  var hypeAt = 0, voiceAt = 0; // v1.31: última fala grande na tela / última voz (para não ficar chato)
  /** v1.31: a voz só fala em jogada forte (3+ linhas) e no máximo a cada 8 s; momentos especiais (recorde, limpeza
   *  perfeita, Imparável, Lendário, Febre) falam sempre. */
  function voiceOk(pk, special) {
    if (pk.tier < 3) return false;
    var now = Date.now(); if (!special && now - voiceAt < 8000) return false;
    voiceAt = now; return true;
  }
  function sayHype(pk, origin, sub, delayMs, quiet) { // quiet: a jogada já tem som próprio (limpeza perfeita, recorde) — só a voz gravada, se houver
    popup(MZHype.build(document, T(pk.key), pk.tier, sub), origin, 'hype t' + pk.tier, 0, false, delayMs || 0);
    var special = !!quiet || pk.voice === 'febre' || pk.voice === 'imparavel' || pk.voice === 'lendario';
    later(function () {
      var talk = voiceOk(pk, special);
      var f = talk && settings.tts !== false ? MZHype.Voice.fileFor(MZI18n.lang, pk.voice) : null; // v1.31: a chave "Voz do apresentador" vale também para a voz gravada
      if (f && Sound.voice(f)) return;
      var spoke = talk && ttsOn() && MZHype.Speak.say(T(pk.key), MZI18n.lang, pk.tier, settings.sfxVol / 100); // v1.30: voz do próprio celular
      if (pk.tier >= 2 && !quiet) Sound.hype(spoke ? Math.min(3, pk.tier) : pk.tier); // com voz, sem o "uau" sintetizado por cima
    }, (delayMs || 0) + 60);
    return T(pk.key);
  }
  /** v1.31: o apresentador fala uma frase solta: voz gravada se houver; senão, a voz do celular (se ligada). */
  function shout(voice, key) {
    if (!hypeOn() || settings.tts === false || !settings.sound) return false;
    var f = MZHype.Voice.fileFor(MZI18n.lang, voice);
    if (f && Sound.voice(f)) return true;
    if (ttsOn()) { MZHype.Speak.lastAt = 0; return MZHype.Speak.say(T(key), MZI18n.lang, 4, settings.sfxVol / 100); }
    return false;
  }
  function ttsOn() { return !!FLAGS.hype && settings.tts !== false && settings.sound && !!window.MZHype && MZHype.Speak.supported(); }
  function pal(th) { return curSkin() === 'theme' ? th.palette : Themes.classic(th).palette; }

  /* ---------------- transformações surpresa (decisão em js/surprise.js) ---------------- */
  function surpriseAfterMove(res, record, prevCombo) {
    if (!state || state.mode === 'tutorial' || state.mode === 'zen') return; // v1.26 (dono): Zen 100% limpo — sem transformações surpresa
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
    var skinPool = evArt() ? Skins.ids.filter(function (id) { return evArt().keys.indexOf(id) !== -1; }) : Skins.ids; // v1.25 (dono): no modo Halloween só viram estilos que têm versão de Halloween
    if (Skins.prizeIds && Skins.prizeIds.length) skinPool = skinPool.filter(function (id) { return Skins.prizeIds.indexOf(id) === -1 || Progress.isUnlocked(stats, id); }); // v1.27: prêmio de nível só aparece depois de ganho
    var d = settings.surprise && settings.blocks === 'classic' ? Surprise.decide(look, res, Object.assign({ base: settings.blocks }, evCtx), skinPool, Math.random) : null;
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
  function skinName(id) {
    var evS = evGame() && eventNow().album && eventNow().album.filter(function (a) { return a[0] === id; })[0]; if (evS) return T(evS[1]); // v1.25: nome de Halloween no evento
    var s = Skins.LIST.filter(function (x) { return x.id === id; })[0]; return s ? T(s.name) : id;
  }
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
      var seenKey = evGame() ? (natalGame() ? 'xm-' : 'hw-') + skin : skin; // Halloween conta separado
      if (!stats.surpriseSeen[seenKey]) { stats.surpriseSeen[seenKey] = 1; discovered = true; } // v1.25.1 (dono): aviso só na 1ª vez que vê o estilo
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
      if (discovered) toast('✦ ' + eventTitle(d && d.event), T('Novo estilo descoberto: {name}', { name: skinName(skin) })); // v1.25.1: só na primeira vez
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



  var bigUntil = 0; // v1.25: uma mensagem grande por vez — a próxima espera a anterior sumir
  function popup(text, origin, cls, dy, html, delayMs) {
    if (state && state.mode === 'zen') return; // v1.26 (dono): Zen 100% limpo — sem pontos voando, elogios nem combo
    if (/(^|\s)(praise|hype|combo-big|big|level|legend-pw)(\s|$)/.test(cls || '')) {
      var nowMs = Date.now(), at = nowMs + (delayMs || 0);
      if (at < bigUntil) { if (bigUntil - nowMs > 3000) return; delayMs = bigUntil - nowMs; at = bigUntil; } // fila longa demais: pula
      bigUntil = at + (settings.anim === 'full' ? 1050 : 950);
    }
    var el = document.createElement('div');
    el.className = 'popup' + (cls ? ' ' + cls : '');
    if (text && text.nodeType) el.appendChild(text); else if (html) el.innerHTML = text; else el.textContent = text; // v1.30: fala animada chega pronta (montada só com textContent)
    var x = L.pad + (origin[1] + 0.5) * L.cell, y = L.pad + (origin[0] + 0.5 + (dy || 0)) * L.cell;
    x = Math.max(70, Math.min(L.size - 70, x));
    y = Math.max(24, Math.min(L.size - 24, y));
    el.style.left = x + 'px'; el.style.top = y + 'px';
    if (dy) el.style.animationDelay = '0.08s';
    if (delayMs) { el.style.animationDelay = (delayMs / 1000) + 's'; el.style.opacity = '0'; el.style.animationFillMode = 'forwards'; }
    fx.appendChild(el);
    el.addEventListener('animationend', function (e) { if (e.target === el) el.remove(); }); // v1.30: animação das letras (filhas) não apaga a fala
    setTimeout(function () { el.remove(); }, 1900 + (delayMs || 0));
  }

  /** v1.30 (laboratório, chave juice): os pontos da jogada voam do tabuleiro até o placar, que dá um pulinho ao receber. */
  function flyToScore(text, cell, delayMs) {
    var sc = $('#score'), cv = $('#board'); if (!sc || !cv || !cv.animate) return;
    var br = cv.getBoundingClientRect(), sr = sc.getBoundingClientRect();
    var x0 = br.left + (L.pad + (cell[1] + 0.5) * L.cell) * (br.width / L.size), y0 = br.top + (L.pad + (cell[0] + 0.5) * L.cell) * (br.height / L.size);
    var x1 = sr.left + sr.width / 2, y1 = sr.top + sr.height / 2;
    var el = document.createElement('div'); el.className = 'fly-pts'; el.textContent = text; el.setAttribute('aria-hidden', 'true');
    el.style.left = x0 + 'px'; el.style.top = y0 + 'px'; document.body.appendChild(el);
    var dx = x1 - x0, dy = y1 - y0;
    var a = el.animate([
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%,-50%) translate(' + (dx * 0.08) + 'px,' + (-30) + 'px) scale(1.15)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-50%) translate(' + (dx * 0.55) + 'px,' + (dy * 0.45 - 40) + 'px) scale(.95)', opacity: 1, offset: 0.6 },
      { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) scale(.45)', opacity: 0.2 }
    ], { duration: 720, delay: delayMs || 0, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' });
    a.onfinish = function () { el.remove(); sc.classList.remove('catch'); void sc.offsetWidth; sc.classList.add('catch'); };
    setTimeout(function () { el.remove(); }, 1600 + (delayMs || 0));
  }
  var scoreHoldUntil = 0;
  function updateScore() {
    var hold = scoreHoldUntil - Date.now(); if (hold > 0) { scoreHoldUntil = 0; later(updateScore, hold); return; } // v1.30: espera os pontos voando chegarem
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
    if (FLAGS.juice && n >= 3) Sound.comboLost(n); // v1.30: combo grande acabou — som curto e baixinho
    mascot('sad', 1300);
    announce(T('Fim do combo ×{n}', { n: n }));
    later(function () { chip.classList.remove('ended'); updateComboChip(); }, settings.anim === 'off' ? 0 : 900);
  }
  /** v1.17: humor do tabuleiro — borda brilhando enquanto o combo está vivo (3+) e alerta vermelho suave
   *  quando a partida está quase perdida (no máximo 1 das peças da bandeja cabe, ou tabuleiro 75%+ cheio). Só aparência. */
  function updateBoardMood() {
    var b = $('#board'); if (!b) return;
    var on = !!state && screenIs('game') && modeOf() !== 'tutorial' && !state.over, k = on && modeOf() !== 'zen' ? state.combo || 0 : 0; // v1.25: Zen sem moldura
    if (FLAGS.juice) Sound.setHeat(k >= 7 ? 2 : k >= 3 ? 1 : 0); // v1.30: trilha esquenta com o combo
    // v1.25: moldura de combo em 5 níveis (×2 brilho leve, ×3 faíscas, ×5 moldura visível, ×7 ondas, ×10 fogo), na cor do visual
    b.classList.toggle('combo-a', k === 2); b.classList.toggle('combo-b', k >= 3 && k < 5); b.classList.toggle('combo-c', k >= 5 && k < 7);
    b.classList.toggle('combo-d', k >= 7 && k < 10); b.classList.toggle('combo-e', k >= 10);
    var leftC = on ? Logic.CONFIG.combo.window - (state.movesSinceClear || 0) : 9;
    b.classList.toggle('fading', k >= 2 && leftC <= 1); // falta 1 peça: a moldura apaga devagar
    b.style.setProperty('--frame-rgb', natalGame() ? '232,36,60' : evGame() ? '255,122,26' : hexRgb(boardTheme().accent)); // v1.25: no evento a moldura é laranja e roxa (assombrada)
    b.classList.toggle('haunt', terrorGame()); b.classList.toggle('xmas', natalGame());
    var danger = false;
    if (on) {
      var left = state.pieces.filter(function (p) { return !!p; }).length, fit = 0, filled = 0;
      state.pieces.forEach(function (p, i) { if (p && Logic.pieceFits(state, i)) fit++; });
      state.board.forEach(function (v) { if (v >= 0) filled++; });
      danger = (left >= 2 && fit <= 1) || filled >= SIZE * SIZE * 0.75;
    }
    if (FLAGS.juice) heartbeat(on && danger && modeOf() !== 'zen'); // v1.30: batimento baixinho com o tabuleiro quase cheio
    if (danger && !b.classList.contains('danger')) announce(T('Cuidado: quase sem espaço.'));
    b.classList.toggle('danger', danger);
    var fev = on && (state.fever | 0) > 0; // v1.30: Febre acende o fogo da moldura e a trilha no máximo
    b.classList.toggle('on-fire', on && !danger && (k >= 10 || fev) && settings.anim !== 'off'); // v1.24: fogo no combo ×10
    if (fev) Sound.setHeat(2);
    if (FLAGS.juice) document.body.setAttribute('data-heat', !on ? '0' : fev ? '2' : k >= 3 ? '1' : '0'); // v1.30: as luzes do fundo esquentam com o combo e a Febre
    if (mascotOn()) MZMascot.base(fev ? 'fire' : danger ? 'sweat' : 'idle'); // v1.30: humor de fundo do mascote
  }
  var hbTimer = 0;
  function heartbeat(onNow) {
    if (onNow && !hbTimer) { Sound.heartbeat(); hbTimer = setInterval(function () { if (!state || state.over || !screenIs('game') || document.hidden) { clearInterval(hbTimer); hbTimer = 0; return; } Sound.heartbeat(); }, 1100); }
    else if (!onNow && hbTimer) { clearInterval(hbTimer); hbTimer = 0; }
  }
  function hexRgb(h) { var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(h || ''); return m ? parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) : '242,201,76'; }
  function updateComboChip() {
    updateBoardMood();
    var chip = $('#combo-chip'), win = Logic.CONFIG.combo.window;
    var fev = !!state && (state.fever | 0) > 0 && state.mode !== 'zen'; // v1.30 (dono: menos poluição): a Febre usa o próprio chip do combo, sem chip extra
    var active = state && (state.combo >= 1 || fev);
    chip.hidden = !active;
    chip.classList.toggle('fever', fev);
    if (!active) return;
    $('#combo-x').textContent = fev ? '🔥×2' : '×' + Math.max(1, state.combo);
    var left = fev ? (state.fever | 0) : win - state.movesSinceClear;
    Array.prototype.forEach.call(chip.querySelectorAll('i'), function (d, i) { d.classList.toggle('on', i < left); });
    chip.classList.toggle('hot', state.combo >= 2);
    if (FLAGS.juice) { // v1.30: última chance do combo — bolinha pisca vermelha e um tique avisa (só ao entrar nesse estado)
      var last = !fev && state.combo >= 2 && left === 1 && state.mode !== 'zen';
      if (last && !chip.classList.contains('last')) { Sound.tick(0.15); later(function () { Sound.tick(0.15); }, 110); announce(T('Última chance de manter o combo!')); }
      chip.classList.toggle('last', last);
    }
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
    var firstLook = !stats.themesSeen[to.id]; // v1.25.1 (dono): aviso de visual novo só na PRIMEIRA vez que a pessoa vê aquele fundo
    if (state && state.mode && state.mode !== 'tutorial' && !(state.mode === 'zen' && state.reliefs) && !stats.themesSeen[to.id]) {
      stats.themesSeen[to.id] = 1; saveStats(); reportAchievements();
    }
    if (animate) {
      if (settings.anim !== 'off' && from !== to) {
        anims = anims.filter(function (a) { return a.type !== 'sweep'; });
        anims.push({ type: 'sweep', from: from, to: to, start: animNow(), dur: settings.anim === 'full' ? 1000 : 360 });
      }
      var zenQuiet = state && state.mode === 'zen';
      if (firstLook && !zenQuiet) toast('✦ ' + T('Novo visual: {name}', { name: T(to.name) }), T(to.msg));
      announce(T('Visual: {name}', { name: T(to.name) }) + '.');
      if (!zenQuiet) { Sound.transform(true); haptic('reward'); }
      if (settings.anim !== 'off' && settings.fx === 'full' && !zenQuiet) { // clarão suave na tela inteira + confete nas cores novas
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
      var inGame = !low && screens.game.classList.contains('active');
      el.classList.toggle('ingame', inGame);
      el.classList.toggle('bottom', low);
      el.style.top = '';
      if (inGame) { // v1.25: logo abaixo do placar, mas sem cobrir as primeiras linhas do tabuleiro
        var top = Math.round($('#score').getBoundingClientRect().bottom + 6), boardTop = boardBox.getBoundingClientRect().top;
        top = Math.min(top, Math.round(boardTop - el.offsetHeight - 4));
        if (top < 4) { el.classList.add('bottom'); return; } // tela muito baixa: vai para baixo
        el.style.top = top + 'px';
      }
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
  function evTier() { var ev = eventNow(); return !ev || !state ? null : state.tier === 3 && ev.storm ? ev.storm : state.nightmare ? ev.nightmare : ev; } // v1.29: regras do nível (Desafio / Noite Feliz-Pesadelo / Nevasca)
  function evGoal() { var t = evTier(); return t ? t.goal : 40; } // v1.25: meta do desafio
  function evFlee() { var t = evTier(); return t ? t.flee : 6; }
  /** v1.29 (Nevasca): bola de neve cai numa casa vazia. Nunca fecha linha sozinha e nunca deixa o jogador sem jogada (justo). */
  function dropSnowball(now, lvl) {
    var free = []; state.board.forEach(function (v, k) { if (v < 0) free.push(k); });
    for (var tries = 0; tries < 12 && free.length; tries++) {
      var j = Math.floor(Math.random() * free.length), k = free[j]; free.splice(j, 1);
      state.board[k] = 6; var fl = Logic.findFullLines(state.board);
      if (fl.rows.length || fl.cols.length || !Logic.hasAnyMove(state)) { state.board[k] = -1; continue; }
      state.rare = state.rare || {}; state.rare[k] = 'sn';
      if (lvl !== 'off') anims.push({ type: 'snowDrop', r: Math.floor(k / SIZE), c: k % SIZE, start: now + 250, dur: 600 });
      later(function () { Sound.poof && Sound.poof(); }, 250); announce(T('Caiu uma bola de neve!'));
      return true;
    }
    return false;
  }
  function isEvItem(t) { return t === 'pk' || t === 'pg'; } // v1.29: item do desafio (pg = presente dourado, vale 3)
  function itemFlee(t) { return t === 'pg' ? Math.max(2, evFlee() - 2) : evFlee(); }
  function evGame() { return !!(state && state.mode === 'event' && eventNow()); }
  function evTheme() { var e = eventNow(); return (e && e.theme) || 'terror'; } // v1.28: 'terror' (Halloween) ou 'natal'
  function terrorGame() { return evGame() && evTheme() === 'terror'; } // arte/efeitos assombrados só no Halloween
  function natalGame() { return evGame() && evTheme() === 'natal'; }
  function natalOn() { return !!eventNow() && evTheme() === 'natal'; } // v1.29: Natal valendo (data ou prévia do laboratório) — árvore e Advento contam em qualquer modo
  var natalPreview = false, fwPreview = false;
  function adventDay() { return natalPreview && !MZNatal.inDecember(today()) ? '2026-12-25' : today(); }
  function openAdvent(n) { // v1.29: Calendário do Advento — abre a porta e entrega o prêmio
    var r = MZNatal.openDoor(stats, n, adventDay(), natalPreview); if (!r) return null;
    var parts = [], hk;
    if (r.xp) { gainXp(r.xp); parts.push('+' + r.xp + ' XP'); }
    for (var i = 0; i < r.helpers; i++) { if (FLAGS.helpers) { hk = giveHelper(); parts.push('+1 ' + HELP[hk].icon + ' ' + T(HELP[hk].name)); } else { gainXp(50); parts.push('+50 XP'); } }
    if (r.badge) parts.push('🏅 ' + T(r.badge));
    saveStats(); var fresh = Progress.checkAchievements(stats, today()); if (fresh.length) saveStats();
    Sound.jingle(); toast(T('Porta {n} aberta! 🎁', { n: r.day }), parts.join(' · '), 'trophy');
    fresh.forEach(function (a) { reward('trophy', T('Conquista: {name}', { name: a.name }), a.desc); });
    return r;
  }
  function evPrize() { var e = eventNow(); return (e && e.prize) || 'pk'; } // chave do prêmio em stats.rares
  var EV_FX = { terror: ['#ff8a1f', '#9b4dff', '#ffb347', '#6a2fd1'], natal: ['#e8243c', '#2fbf5a', '#ffd23f', '#ffffff'] }; // v1.25: conteúdo do evento só dentro do modo Evento
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
  // v1.31: quem já tinha feito os pontos antes das medalhas lendárias chegarem ao site ganha as medalhas agora (recorde da temporada ou o antigo)
  var lateLegends = [];
  try { if (FLAGS.legends && window.MZLegend) lateLegends = Season.unlockLegends(stats, Math.max((stats.best && stats.best.classic) || 0, (stats.legend && stats.legend.classic) || 0)); } catch (e) {}
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
  function reportMissions(list) { (list || []).forEach(function (m) { var hk = FLAGS.helpers ? giveHelper() : null; reward('mission', T('Missão concluída ★'), T(m.text) + ' · +25 XP' + (hk ? ' · +1 ' + HELP[hk].icon + ' ' + T(HELP[hk].name) : '')); gainXp(25); }); }
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
  /** v1.30 (laboratório, chave do acabamento): tocar no 🔥 da tela inicial mostra a trilha de 7 dias — o 7º dia tem presente (+150 XP, regra que já existia). */
  function openStreak() {
    var st = stats.streak || {}, sk = Season.streakNow(stats, today()), playedToday = st.last === today();
    var p = sk % 7; if (sk > 0 && p === 0) p = 7; if (!playedToday && p === 7) p = 0; // semana completa e ainda não jogou hoje: começa trilha nova
    showDialog({ title: T('Sequência de dias'), sub: sk ? T('{n} dias seguidos', { n: sk }) : T('Jogue hoje para começar'), buttons: [{ label: T('Jogar'), cls: 'primary', fn: function () { closeDialog(); $('#btn-play').click(); } }, { label: T('Fechar'), fn: closeDialog }] });
    var row = el('div', 'streak-track');
    for (var d = 1; d <= 7; d++) {
      var done = d <= p, isToday = playedToday ? d === p : d === p + 1;
      var bx = el('div', 'sd' + (done ? ' done' : '') + (isToday ? ' today' : '') + (d === 7 ? ' gift' : ''));
      bx.appendChild(el('span', 'sd-ic', d === 7 ? '🎁' : done ? '🔥' : '·'));
      bx.appendChild(el('small', '', isToday ? T('Hoje') : T('Dia {n}', { n: d })));
      row.appendChild(bx);
    }
    var info = el('p', 'streak-info', T('No 7º dia: +150 XP.') + ' ' + ((st.shields | 0) > 0 ? T('🛡️ Escudo da semana pronto: se pular um dia, ele salva a sequência.') : T('🛡️ Escudo da semana já usado.')) + (st.best > 1 ? ' ' + T('Melhor sequência: {n} dias.', { n: st.best }) : ''));
    var card = $('#dialog-card'), stack = card.querySelector('.stack');
    card.insertBefore(row, stack); card.insertBefore(info, stack);
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
    if (state.mode !== 'zen') { if (lastSnap && !state.over) store.set(saveKey(modeOf()) + '.undo', lastSnap); else store.del(saveKey(modeOf()) + '.undo'); } // v1.27: desfazer não some ao recarregar
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
    locked = false; anims = []; drag = null; lastSnap = null; lastStatsSnap = null; tutTarget = null; zenHist = [];
    dragCanvas.hidden = true;
    slots.forEach(function (s) { s.classList.remove('dragging', 'shake', 'kb-selected'); });
    fx.innerHTML = ''; bigUntil = 0; helperMode = null;
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
    if (saved && mode !== 'zen') { // v1.27: recupera o desfazer guardado (só se for desta mesma partida e uma jogada atrás)
      try { var us = store.get(saveKey(mode) + '.undo', null), up = typeof us === 'string' ? JSON.parse(us) : null;
        if (up && Logic.isValidState(up) && up.seed === saved.seed && up.placed === saved.placed - 1) lastSnap = us; } catch (e) {}
    }
    if (typeof state.undoLeft !== 'number') state.undoLeft = mode === 'daily' || mode === 'weekly' ? 0 : 1;
    if (typeof state.startBest !== 'number') state.startBest = bestFor(mode);
    if (!state.themeId) state.themeId = startLookId(); // toda partida nova começa no visual Clássico (v1.27, laboratório: ou no visual inicial escolhido na Galeria)
    themeIdx = Themes.indexOfId(state.themeId);
    applyTheme(themeIdx, false);
    if (state.rare && typeof state.rare === 'object') Object.keys(state.rare).forEach(function (k) { var i = +k; if (!(Number.isInteger(i) && i >= 0 && i < SIZE * SIZE) || !(/^(r[1-3]|pk|pg|sn)$/.test(state.rare[k]) || false) || ((isEvItem(state.rare[k]) || state.rare[k] === 'sn') && state.mode !== 'event')) delete state.rare[k]; }); else delete state.rare; // v1.25: gaiola do morcego só no modo Evento (partidas salvas antigas perdem a abóbora/gaiola)
    state.pieces.forEach(function (p) { if (p && p.rk && (!((/^(r[1-3]|pk|pg|sn)$/.test(p.rk.t) || false) && SHAPES[p.s].cells[p.rk.k]) || ((isEvItem(p.rk.t) || p.rk.t === 'sn') && state.mode !== 'event'))) delete p.rk; });
    tagRares();
    displayedScore = state.score;
    $('#score').textContent = fmt(state.score);
    updateComboChip();
    show('game');
    if (FLAGS.mascote && window.MZMascot) { MZMascot.mount(boardBox, function () { Sound.boop(); haptic('line'); }); MZMascot.show(mascotOn()); MZMascot.base('idle'); MZMascot.outfit(natalGame() ? 'xmas' : ''); placeMascot(); }
    updateHud();
    playClock = Date.now();
    saveGame();
    requestAnimationFrame(function () { layout(); drawTray(true); enterBoard(); });
    if (saved && mode === 'zen' && (state.over || !Logic.hasAnyMove(state))) { state.over = true; locked = true; later(showGameOver, 300); }
  }

  function enterBoard() {
    if (hypeOn() && MZHype.Voice.list && Sound.voicePreload) Sound.voicePreload(MZHype.Voice.list.filter(function (f) { return f.indexOf(MZI18n.lang === 'pt' ? 'pt_' : 'en_') === 0; })); // v1.31: vozes gravadas prontas antes da 1ª fala
    boardBox.classList.remove('enter'); void boardBox.offsetWidth; boardBox.classList.add('enter');
    if (FLAGS.juice && settings.anim === 'full') { anims.push({ type: 'cascade', start: animNow() + 120, dur: 760 }); requestRender(); } // v1.30: casas entram em onda, da quina de cima
  }

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
    updateHelpers(); // v1.26
    syncZenUi(); // v1.26: Zen novo
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
    else if (m === 'event') { label = T('Evento'); val = natalGame() ? T('Natal') : T('Semana do Terror'); }
    else { val = T('Tutorial'); }
    $('#best-label').textContent = label;
    $('#best').textContent = val;
    $('#best-mini').classList.toggle('text', m === 'zen' || m === 'challenge' || m === 'tutorial' || m === 'event');
    var bestNow = (m === 'classic' || m === 'daily' || m === 'weekly') ? bestFor(m) : 0; // v1.23: recorde discreto; acende quando você chega perto
    $('#best-mini').classList.toggle('near', bestNow > 0 && state.score >= bestNow * 0.8);

    var u = $('#btn-undo'), canUndo = m !== 'tutorial' && m !== 'daily' && m !== 'weekly';
    u.hidden = !canUndo;
    u.disabled = zenOn() ? !canUndoNow() : (!lastSnap || state.undoLeft <= 0 || locked);
    $('#undo-count').textContent = zenOn() ? '∞' : Math.max(0, state.undoLeft);
    $('#undo-count').hidden = u.disabled; // v1.16 (QA): sem jogada para desfazer (ex.: após reabrir), o contador some
    u.setAttribute('aria-label', zenOn() ? T('Desfazer (à vontade no Zen)') : T('Desfazer última jogada ({n} restante)', { n: Math.max(0, state.undoLeft) }));

    var gb = $('#goal-bar'); gb.classList.remove('mission', 'mission-done');
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
    } else if (m === 'classic' && FLAGS.juice && missionForBar()) { // v1.30 (chave juice): a missão do dia mais perto de acabar, escolhida no começo da partida
      var mb = missionForBar(), md = Progress.missionDef(mb.id), money = md.stat === 'gameScore';
      gb.hidden = false;
      $('#goal-text').textContent = '🎯 ' + T(md.text);
      $('#goal-progress').style.width = (100 * Math.min(1, mb.cur / md.target)).toFixed(1) + '%';
      $('#goal-extra').textContent = mb.done ? T('Missão completa! ⭐') : (money ? fmt(mb.cur) + '/' + fmt(md.target) : mb.cur + '/' + md.target);
      gb.classList.toggle('mission-done', !!mb.done); gb.classList.add('mission');
      if (mb.done && !state.misCel) { // v1.30: a missão acabou de ser cumprida nesta partida — festa curtinha na barra
        state.misCel = true; gb.classList.remove('mis-pop'); void gb.offsetWidth; gb.classList.add('mis-pop');
        later(function () { Sound.star(); haptic('line'); }, 250); announce(T('Missão completa! ⭐'));
      }
    } else if (m === 'event') { // v1.24: Semana do Terror
      var goal = evGoal(), got = Math.min(goal, state.pk || 0);
      gb.hidden = false;
      var xm = natalGame();
      $('#goal-text').textContent = state.nightmare ? (xm ? (state.tier === 3 ? '❄️ ' + T('Nevasca') : '🌟 ' + T('Noite Feliz')) : '👹 ' + T('Pesadelo')) : (xm ? '🎄 ' : '🎃 ') + T('Desafio do evento');
      $('#goal-progress').style.width = (100 * got / goal).toFixed(1) + '%';
      $('#goal-extra').textContent = state.pkDone ? T('Concluído!') : (xm ? T('{a}/{b} presentes', { a: got, b: goal }) : T('{a}/{b} morcegos', { a: got, b: goal }));
    } else if (m === 'weekly') { // v1.24: posição no placar da galera
      gb.hidden = false;
      var gl = galera().list.filter(function (x) { return !x.me; }), ahead = gl.filter(function (x) { return x.score > state.score; }).sort(function (a, b) { return a.score - b.score; })[0];
      $('#goal-text').textContent = T('Desafio da Semana');
      $('#goal-progress').style.width = ahead ? Math.min(100, 100 * state.score / ahead.score).toFixed(1) + '%' : (gl.length ? '100%' : '0%');
      $('#goal-extra').textContent = ahead ? T('Faltam {n} para passar {name}', { name: ahead.name, n: fmt(ahead.score - state.score) }) : (gl.length ? T('Você está em 1º na galera!') : T('Mesmas peças para todos'));
    } else gb.hidden = true;
  }

  /** v1.30: missão mostrada na barra durante o Clássico. Escolhida uma vez por partida (a barra não aparece/some no meio, e o tabuleiro não muda de tamanho). */
  var BAR_STATS = { lines: 1, placed: 1, combo: 1, multi2: 1, gameScore: 1 };
  function missionForBar() {
    if (!state) return null;
    if (state.misId === undefined) {
      Progress.ensureMissions(stats, today());
      var best = null;
      (stats.missions || []).forEach(function (mm) {
        var d = Progress.missionDef(mm.id); if (!d || mm.done || !BAR_STATS[d.stat]) return;
        var k = (d.stat === 'gameScore' || d.stat === 'combo' ? 0 : mm.cur) / d.target, pref = { lines: 5, placed: 4, combo: 3, multi2: 2, gameScore: 1 }[d.stat]; // empate: a mais fácil de ver andando
        if (!best || k > best.k || (k === best.k && pref > best.pref)) best = { id: mm.id, k: k, pref: pref };
      });
      state.misId = best ? best.id : '';
    }
    if (!state.misId) return null;
    var mm2 = (stats.missions || []).filter(function (x) { return x.id === state.misId; })[0];
    if (!mm2) return null;
    var d2 = Progress.missionDef(mm2.id);
    if (d2.stat === 'gameScore' && !mm2.done) return { id: mm2.id, cur: Math.min(d2.target, state.score), done: false }; // pontos desta partida
    if (d2.stat === 'combo' && !mm2.done) return { id: mm2.id, cur: Math.min(d2.target, state.maxCombo || 0), done: false };
    return mm2;
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
    if (zenOn() && res.lineCount) zenGrow(res); // v1.26: jardim e quadro
    if ((m === 'classic' || m === 'zen' || m === 'daily' || m === 'weekly') && state.score > bestFor(m)) setBest(m, state.score);
    if (m === 'classic' || m === 'zen' || m === 'daily') Season.unlockRares(stats, state.score).forEach(function (rr) { // v1.24: bloco raro liberado
      reward('trophy', T('Bloco raro liberado: {name}!', { name: T(rr.name) }), T('A partir de agora ele aparece às vezes nas suas peças. Limpe para ver o brilho!'));
    });
    if (m === 'classic' && FLAGS.legends) { var newLeg = Season.unlockLegends(stats, state.score); if (newLeg.length) { legendQ = legendQ.concat(newLeg); later(showLegendUnlock, 900); } } // v1.26: lendário liberado = tela cheia
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
  function canUndoNow() { if (zenOn()) return zenHist.length > 0 && !locked; return !!lastSnap && state && state.undoLeft > 0 && modeOf() !== 'daily' && modeOf() !== 'weekly' && !state.nightmare; } // v1.25: Pesadelo sem desfazer

  function showGameOver() {
    var m = modeOf(), score = state.score;
    Sound.setHeat(0); // v1.30
    mascot(score > 0 && score >= bestFor(m) ? 'wow' : 'sad', 4000); // v1.30: no recorde ele comemora em vez de ficar triste
    prepShareKbq(score > 0 && score >= bestFor(m) ? 'wow' : 'happy');
    if (score > 0 && score >= bestFor(m) && m !== 'tutorial') homeCheer = T('Que recorde! 🏆'); // v1.30: o Kabloquinho comenta na tela inicial
    Sound.gameover();
    if (natalGame()) later(function () { Sound.jingleSong(); }, 500); else if (evGame()) later(function () { Sound.howl(); }, 500); // v1.24: uivo no fim de partida (evento)
    haptic('gameover');
    if (m === 'zen') {
      showResult({
        title: T('Sem encaixes'), big: zenOn() ? '🌱 ' + fmt(Math.min(ZEN_PLANT, 1 + Math.floor(zenData().garden / 12))) : fmt(score), sub: T('No Zen a partida não acaba. Limpe as 3 linhas mais cheias e siga jogando.'), // v1.26: Zen sem placar (só com o Zen novo ligado)
        stats: zenOn() ? [[fmt(state.lines), T('linhas')], [fmt(Math.min(ZEN_PLANT, 1 + Math.floor(zenData().garden / 12))), T('plantas no jardim')], [fmt(zenData().art.length), T('quadros')]]
          : [[fmt(state.lines), T('linhas')], [comboText(state.maxCombo), T('maior combo')], [fmt(bestFor('zen')), T('recorde Zen')]],
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
    if (natalGame()) { // v1.29: fim da partida de Natal — quantos presentes, quanto faltou, recorde do nível
      var tN = state.tier === 3 ? 3 : state.nightmare ? 2 : 1, gN = evGoal(), got = Math.min(gN, state.pk || 0), bN = ((stats.events.natal2026 || {}).best || {})[tN] || 0;
      var nameN = [T('Desafio de Natal'), T('Noite Feliz'), T('Nevasca')][tN - 1];
      showResult({
        title: nameN, badge: state.pkDone ? T('Concluído!') : got >= bN && got > 0 ? T('Seu melhor neste nível!') : '', big: '🎁 ' + got + '/' + gN,
        sub: state.pkDone ? T('Você conseguiu! O prêmio fica guardado para sempre.') : gN - got <= 10 ? T('Faltaram só {n} presentes! Dá para conseguir.', { n: gN - got }) : T('Seu recorde neste nível: {b} de {n}.', { b: bN, n: gN }),
        xp: state.xpRes,
        stats: [[String(got), T('presentes')], [fmt(score), T('pontos')], [String(bN), T('recorde')]],
        buttons: [
          { label: T('Tentar de novo'), cls: 'primary big', fn: function () { startNatal(tN); } },
          { label: T('Escolher nível'), fn: function () { closeOverlay('#ov-over'); openEvent(); } },
          { label: T('Tela inicial'), cls: 'ghost-dark', fn: goHome }
        ]
      });
      announce(T('Fim de partida. {n} presentes.', { n: got }));
      return;
    }
    var isDaily = m === 'daily';
    var piecesOut = isDaily && state.placed >= Progress.DAILY_PIECES;
    var nearMiss = !!FLAGS.juice && !record && !isDaily && state.startBest > 0 && score >= state.startBest * 0.85 && score < state.startBest; // v1.30: "quase!" puxa mais uma partida
    showResult({
      title: isDaily ? (piecesOut ? T('Desafio do dia concluído') : T('Sem mais encaixes')) : T('Sem mais encaixes'),
      badge: record ? (isDaily ? T('Melhor resultado de hoje!') : T('Novo recorde!')) : nearMiss ? T('Quase!') : '',
      big: fmt(score), countUp: score, record: record, prevBest: state.startBest, near: nearMiss,
      sub: nearMiss ? T('Faltaram só {n} para o seu recorde! 😱', { n: fmt(state.startBest - score) }) : (isDaily ? T('Melhor de hoje: {n}', { n: fmt(bestFor(m)) }) : T('Recorde: {n}', { n: fmt(bestFor(m)) })) +
        (record && state.startBest > 0 ? ' · ' + T('+{n} acima do recorde anterior', { n: fmt(score - state.startBest) }) : ''),
      medal: Season.medalFor(score), nextMedal: Season.nextMedal(score), score: score, xp: state.xpRes,
      stats: [[fmt(state.lines), T('linhas')], [comboText(state.maxCombo), T('maior combo')], [isDaily ? state.placed + '/' + Progress.DAILY_PIECES : String(Logic.levelFor(state.lines)), isDaily ? T('peças') : T('fase')]],
      buttons: [
        canRevive() ? { label: T('Continuar: 3 peças novas (grátis, 1×)'), cls: 'primary big revive', fn: revive } : null,
        { label: T('Jogar novamente'), cls: canRevive() ? '' : 'primary big', fn: function () { startGame(m); } },
        canUndoNow() ? { label: zenOn() ? T('Desfazer') : T('Desfazer última jogada ({n})', { n: state.undoLeft }), fn: undo } : null,
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
      card.appendChild(ch);
      if (FLAGS.juice) chestShow(ch, state.chest); else later(function () { Sound.record(); }, 600);
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
  /** v1.30 (laboratório, chave do acabamento): baú fechado que treme; ao tocar (ou sozinho em 2,5 s) abre com a raridade — comum, raro ou épico. O XP já foi dado; aqui é só a festa. */
  function chestShow(row, chest) {
    var rar = chest.rar || (chest.big ? 'epic' : 'common'), names = { common: T('Comum'), rare: T('Raro!'), epic: T('Épico!') };
    row.classList.add('closed', 'rar-' + rar); row.setAttribute('role', 'button'); row.tabIndex = 0;
    row.setAttribute('aria-label', T('Abrir o baú do dia'));
    var hint = el('em', 'chest-hint', T('Toque para abrir')); row.insertBefore(hint, row.children[1]);
    var knocks = [700, 1300, 1900].map(function (ms) { return setTimeout(function () { if (row.classList.contains('closed') && row.offsetParent) { Sound.chestKnock(); haptic('place'); } }, ms); });
    var open = function () {
      if (!row.classList.contains('closed')) return;
      knocks.forEach(clearTimeout); clearTimeout(auto);
      if (!row.offsetParent) { row.classList.remove('closed'); return; } // janela já fechou: sem festa fora da tela
      row.classList.remove('closed'); row.classList.add('opened'); row.removeAttribute('role'); row.removeAttribute('tabindex');
      row.querySelector('.chest-ic').textContent = rar === 'epic' ? '💎' : rar === 'rare' ? '✨' : '🎁';
      hint.remove();
      var tag = el('span', 'chest-rar hype ' + (rar === 'epic' ? 't4' : rar === 'rare' ? 't3' : 't1')); tag.appendChild(MZHype.build(document, names[rar], rar === 'common' ? 1 : 3)); row.insertBefore(tag, row.children[1]);
      Sound.chestOpen(rar); haptic(rar === 'common' ? 'line' : 'combo', rar === 'epic' ? 5 : 3);
      if (rar === 'epic' && !homeCheer) homeCheer = T('Baú épico! Que sorte! 💎'); // v1.30
      if (rar !== 'common' && settings.anim !== 'off') { var cf = el('div', 'confetti'), cols = rar === 'epic' ? ['#b46bff', '#4bd2ff', '#ff4b6e', '#ffd23f'] : ['#4bd2ff', '#7ee8ff', '#ffffff']; for (var i = 0; i < 18; i++) { var c = el('i'); c.style.left = (Math.random() * 100) + '%'; c.style.background = cols[i % cols.length]; c.style.animationDelay = (Math.random() * 0.4) + 's'; cf.appendChild(c); } row.appendChild(cf); }
      announce(T('Baú {r}: +{n} XP', { r: names[rar], n: fmt(chest.xp) }));
    };
    var auto = setTimeout(open, 2500);
    row.addEventListener('click', open);
    row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
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
    if (FLAGS.juice && x.levelsUp && x.levelsUp.length) { // v1.30: subir de nível de jogador ganha fala animada e fanfarra
      setTimeout(function () {
        if (!document.contains(b) || !b.offsetParent) return;
        var up = el('span', 'xp-levelup hype t3'); up.appendChild(MZHype.build(document, T('Nível {n}!', { n: x.after.level }), 1)); b.appendChild(up); b.classList.add('lvl-flash');
        Sound.hype(3); haptic('combo', 4);
      }, 900);
    }
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
    if (FLAGS.juice) { // v1.30 (chave juice): os botões principais (continuar / jogar de novo) sobem para logo abaixo da pontuação — sem rolar a tela
      var oc = $('#over-card'), st0 = oc.querySelector('.stack'), anchor = oc.querySelector('.final-score + p.muted') || oc.querySelector('.final-score');
      if (st0 && anchor) {
        var topAct = el('div', 'stack top-actions'), btns = Array.prototype.slice.call(st0.querySelectorAll('.btn'));
        btns.filter(function (bt, i) { return i < 2 && !bt.classList.contains('ghost-dark'); }).forEach(function (bt) { topAct.appendChild(bt); });
        if (topAct.children.length) anchor.parentNode.insertBefore(topAct, anchor.nextSibling);
      }
      // v1.30 (dono: menos poluição): números da partida e conquistas ficam recolhidos em "Detalhes"; o resultado principal fica limpo
      var extras = Array.prototype.filter.call(oc.querySelectorAll(':scope > .over-stats, :scope > ul.rules, :scope > .rewards'), Boolean);
      if (extras.length) {
        var nRew = oc.querySelectorAll(':scope > .rewards .reward').length;
        var det = el('details', 'over-more'), sum = el('summary', '', nRew ? (nRew === 1 ? T('Detalhes da partida · 1 conquista') : T('Detalhes da partida · {n} conquistas', { n: nRew })) : T('Detalhes da partida'));
        det.appendChild(sum); extras.forEach(function (x) { det.appendChild(x); });
        var st1 = oc.querySelector(':scope > .stack:not(.top-actions)'); if (st1) oc.insertBefore(det, st1); else oc.appendChild(det);
        det.addEventListener('toggle', function () { if (det.open) Sound.uiOpen(); });
      }
    }
    $('#over-card').classList.toggle('record', !!o.record); // moldura iluminada no recorde
    var big = $('#over-card .final-score');
    // v1.30 (chave juice): no recorde, a contagem é mais longa, faz "tique-tique" subindo e explode no momento em que passa o recorde anterior
    var drum = !!FLAGS.juice && !!o.record && o.prevBest > 0 && settings.anim === 'full' && !!big && typeof o.countUp === 'number';
    var badgeEl = $('#over-card .badge');
    if (drum && badgeEl) badgeEl.classList.add('wait');
    var celebrate = function () {
      if (!(((o.badge && !o.near) || o.stars === 3) && settings.anim === 'full')) return; // v1.30: "Quase!" não é festa
      var cf = el('div', 'confetti'), cols = pal(THEMES[themeIdx]);
      for (var i = 0; i < 36; i++) {
        var p = el('i'); p.style.left = (Math.random() * 100) + '%'; p.style.background = cols[i % cols.length];
        p.style.animationDelay = (Math.random() * 0.5) + 's'; p.style.transform = 'rotate(' + (Math.random() * 180) + 'deg)'; cf.appendChild(p);
      }
      $('#over-card').appendChild(cf);
    };
    if (big && typeof o.countUp === 'number' && settings.anim !== 'off' && o.countUp > 0) { // pontuação final contando
      var t0 = performance.now(), dur = drum ? 1600 : 900, broke = false, lastTick = 0;
      (function step() {
        var now = performance.now(), k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, drum ? 2.2 : 3), v = o.countUp * e;
        big.textContent = fmt(v);
        if (drum && !broke && now - lastTick > 70 && k < 1) { lastTick = now; Sound.tick(Math.min(1, v / o.prevBest)); }
        if (drum && !broke && v >= o.prevBest) {
          broke = true; big.classList.add('broke'); if (badgeEl) { badgeEl.classList.remove('wait'); badgeEl.classList.add('pop'); }
          celebrate(); Sound.record(); haptic('celebrate');
          shout('novo_recorde', 'Novo recorde!'); // v1.30: o apresentador grita o recorde (v1.31: voz gravada, se houver)
        }
        if (k < 1 && document.contains(big)) requestAnimationFrame(step);
      })();
    }
    if (!drum) celebrate();
    if (o.badge && !drum && !o.near) Sound.record();
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
    if (zenOn()) { var zh = zenHist.pop(); lastSnap = zh.snap; lastStatsSnap = zh.stats; state.undoLeft = 99; } // v1.26: Zen desfaz à vontade
    var left = zenOn() ? 99 : state.undoLeft - 1, snap = JSON.parse(lastSnap);
    cancelLater();
    if (lastStatsSnap) { var t = stats.timeMs; stats = Progress.normalize(JSON.parse(lastStatsSnap)); stats.timeMs = t; saveStats(); }
    lastStatsSnap = null;
    closeOverlay('#ov-over');
    if (drag) endDrag(false);
    state = snap; state.undoLeft = left; lastSnap = null; locked = false; anims = []; fx.innerHTML = '';
    themeIdx = Themes.indexOfId(state.themeId); applyTheme(themeIdx, false);
    displayedScore = state.score; $('#score').textContent = fmt(state.score);
    updateComboChip(); updateHud(); drawTray(false); requestRender(); saveGame();
    if (!zenOn()) toast(T('Jogada desfeita'), left > 0 ? '' : T('Este era o desfazer da partida.'));
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
    locked = false; lastSnap = null; zenHist = [];
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
  var shareKbq = null; // v1.30: imagem do Kabloquinho para o compartilhar (carrega antes, a imagem é montada na hora)
  function prepShareKbq(mood) {
    if (!FLAGS.mascote || settings.kbq === false || !window.MZMascot || !MZMascot.svgFor) return;
    var im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(MZMascot.svgFor(mood)); shareKbq = im;
  }
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
    if (shareKbq && shareKbq.complete && shareKbq.naturalWidth) g.drawImage(shareKbq, bx + bs - 190, by - 150, 180, 180); // v1.30 (chave mascote): Kabloquinho sentado no tabuleiro
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
  var coachKbq = null;
  function loadTutorialStep() {
    var st = TUTORIAL[tutStep];
    state.board = Progress.boardFromRows(st.board, SIZE);
    state.pieces = [st.pieces[0], null, null];
    state.queue = []; state.over = false; state.combo = 0; state.lines = st.lines || 0;
    tutTarget = st.target;
    $('#coach').hidden = false;
    $('#coach-text').textContent = (tutStep + 1) + '/' + TUTORIAL.length + ' · ' + T(st.text);
    if (FLAGS.mascote && settings.kbq !== false && window.MZMascot && MZMascot.create) { // v1.30 (chave mascote): o Kabloquinho ensina — fica ao lado do texto do tutorial
      if (!coachKbq) { coachKbq = MZMascot.create(); var cw = el('div', 'coach-line'); var cp = $('#coach-text'); cp.parentNode.insertBefore(cw, cp); coachKbq.mount(cw); cw.appendChild(cp); coachKbq.el.classList.add('kbq-coach'); coachKbq.el.tabIndex = -1; }
      coachKbq.react('happy', 700);
    }
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
    if (coachKbq) coachKbq.react(res.lineCount ? 'wow' : 'happy', 900); // v1.30: comemora o acerto
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
  var layerTheme = 'terror';
  function eventLayer(th) { // v1.28: fundo do evento — lua e morcegos (Halloween) ou neve caindo e estrela (Natal)
    if (th === layerTheme) return; layerTheme = th; var lay = $('#event-layer'); lay.innerHTML = '';
    if (th === 'natal') { lay.appendChild(el('i', 'xstar', '')); for (var i = 1; i <= 8; i++) lay.appendChild(el('i', 'snow n' + i, '❄')); if (fwPreview || MZNatal.isNewYearsEve(today())) for (var f = 1; f <= 4; f++) lay.appendChild(el('i', 'fw f' + f, '')); } // v1.29: fogos de Réveillon em 31/12
    else { lay.appendChild(el('i', 'moon', '')); [1, 2, 3].forEach(function (n) { lay.appendChild(el('i', 'bat b' + n, '🦇')); }); }
  }
  /* v1.30 (chave juice): selo NOVO nos modos que a pessoa ainda não abriu — some no primeiro toque */
  function newTags() {
    if (!FLAGS.juice) return;
    var seen = store.get('gb.seenNew', {}) || {}, ev = eventNow();
    [['#btn-ranked', 'ranked', !!FLAGS.ranked], ['#btn-friends', 'friends', !!FLAGS.ranked], ['#btn-events', 'ev-' + (ev ? ev.id : ''), !!ev], ['#btn-zen', 'zen-novo', !!FLAGS.zenNew]].forEach(function (it) {
      var b = $(it[0]); if (!b) return;
      var tag = b.querySelector('.new-badge'), want = it[2] && !seen[it[1]]; // (o botão da Ranqueada aparece um instante depois; o selo já fica pronto nele)
      if (want && !tag) {
        tag = el('em', 'tile-badge new-badge', T('NOVO')); tag.setAttribute('aria-hidden', 'true'); b.appendChild(tag);
        b.addEventListener('click', function once() { var sn = store.get('gb.seenNew', {}) || {}; sn[it[1]] = 1; store.set('gb.seenNew', sn); var t2 = b.querySelector('.new-badge'); if (t2) t2.remove(); b.removeEventListener('click', once); });
      } else if (!want && tag) tag.remove();
    });
  }
  function show(name) {
    if (name !== 'game') { Sound.setHeat(0); if (typeof heartbeat === 'function') heartbeat(false); } // v1.30: fora do jogo a trilha volta ao normal e o batimento para
    Object.keys(screens).forEach(function (k) { screens[k].classList.toggle('active', k === name); });
    var evl = eventNow() && (name !== 'game' || evGame()); $('#event-layer').hidden = !evl || settings.anim === 'off'; document.body.classList.toggle('ev-terror', !!evl && evTheme() === 'terror'); document.body.classList.toggle('ev-natal', !!evl && evTheme() === 'natal'); if (evl) eventLayer(evTheme()); // v1.24: lua e morcegos
    if (name !== 'home' && $('#news-bar')) $('#news-bar').hidden = true; // v1.24: barra de novidades só na tela inicial
    ambLayer(!evl);
    tipsFor(name);
    if (name === 'home') { refreshHome(); newTags(); homeMascot(); }
    else if (!(history.state && history.state.gb)) { try { history.pushState({ gb: 1 }, ''); } catch (e) {} }
    if (window.GBMenus && window.GBMenus.onShow) window.GBMenus.onShow(name);
    if (Sound.setCalm) Sound.setCalm(name === 'game' && zenOn()); // v1.26: som calmo só na partida Zen
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
    if (open && open.id !== 'ov-over') {
      closeOverlay('#' + open.id);
      if (open.id === 'ov-settings' && settingsReturn) { openOverlay(settingsReturn); settingsReturn = null; } // v1.25: Pausa → Configurações → voltar = Pausa
      repush(); return;
    }
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
    if (window.GBHome) window.GBHome.sync(); // v1.26: cartões Zen e Eventos
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
    var tEl = $('#toast'); // v1.30 (correção): aviso que apareceu um instante antes da janela ia para cima dela (cobria a pontuação final)
    if (tEl && tEl.classList.contains('show')) { tEl.style.top = ''; tEl.classList.remove('ingame'); tEl.classList.add('bottom'); }
    if (drag) endDrag(false);
    var ov = $(sel);
    if (ov.hidden) focusStack.push(document.activeElement);
    ov.hidden = false;
    if (FLAGS.juice && sel !== '#ov-over' && sel !== '#ov-result') Sound.uiOpen(); // v1.30: som suave de abrir janela
    $('#app').setAttribute('inert', '');
    setTimeout(function () { if (!ov.contains(document.activeElement)) { var f = focusables(ov)[0]; if (f) f.focus({ preventScroll: true }); } }, 30);
    if (sel === '#ov-settings' && $('#skins')) buildSkinPicker();
    if (sel === '#ov-settings' && FLAGS.juice) settingsJump();
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
    if (FLAGS.juice && sel !== '#ov-over' && sel !== '#ov-result') Sound.uiBack(); // v1.30: som suave de voltar (não ao sair do fim de partida)
    if (!overlayOpen()) $('#app').removeAttribute('inert');
    var back = focusStack.pop();
    if (back && document.contains(back) && !overlayOpen()) { try { back.focus({ preventScroll: true }); } catch (e) {} }
  }
  /** Rede de segurança: sem nenhuma janela aberta, a tela do jogo nunca pode ficar travada (inert). */
  function unstickApp() { if (!overlayOpen() && $('#app').hasAttribute('inert')) $('#app').removeAttribute('inert'); }
  document.addEventListener('visibilitychange', unstickApp);
  window.addEventListener('popstate', function () { setTimeout(unstickApp, 0); });
  function closeAllOverlays() { ['#ov-pause', '#ov-settings', '#ov-over', '#ov-dialog', '#ov-legend'].forEach(closeOverlay); focusStack = []; }
  /* v1.26 (dono): bloco lendário liberado — comemoração em tela cheia (uma vez por bloco, para sempre) */
  var legendQ = [], legendRaf = 0;
  function showLegendUnlock() {
    var lg = legendQ.shift(); if (!lg) return;
    if (overlayOpen() || !screenIs('game')) { reward('trophy', T('Medalha lendária: {name}!', { name: T(lg.name) }), T('É sua para sempre. Veja na Coleção.')); showLegendUnlock(); return; }
    if (drag) endDrag(false);
    var card = $('#legend-card'); card.innerHTML = '';
    var mk = function (tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    card.appendChild(mk('p', 'legend-kicker', '🏅 ' + T('Medalha lendária conquistada!') + ' 🏅'));
    var cv = mk('canvas', 'legend-art'); var dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = cv.height = Math.round(170 * dpr); card.appendChild(cv);
    card.appendChild(mk('h2', '', lg.icon + ' ' + T(lg.name))).id = 'legend-title';
    card.appendChild(mk('p', 'legend-text', T('Você passou de {n} pontos no Clássico. Esta medalha é sua para sempre e fica guardada na sua Coleção.', { n: fmt(lg.min) })));
    var ok = mk('button', 'btn primary big', T('Que demais!')); ok.type = 'button'; card.appendChild(ok);
    ok.addEventListener('click', function () { cancelAnimationFrame(legendRaf); closeOverlay('#ov-legend'); if (legendQ.length) setTimeout(showLegendUnlock, 300); });
    openOverlay('#ov-legend');
    var g = cv.getContext('2d'), t0 = performance.now();
    (function spin(t) {
      if ($('#ov-legend').hidden) return;
      var W = cv.width, k = Math.min(1, (t - t0) / 600), sz = W * 0.62 * (0.4 + 0.6 * (1 - Math.pow(1 - k, 3)));
      g.clearRect(0, 0, W, W);
      g.save(); g.translate(W / 2, W / 2); g.rotate(t / 4000); // raios de luz girando
      for (var i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.fillStyle = 'rgba(255,215,120,' + (0.10 + 0.06 * Math.sin(t / 300 + i)) + ')'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.6, -W * 0.06); g.lineTo(W * 0.6, W * 0.06); g.closePath(); g.fill(); }
      g.restore();
      if (window.MZLegend) window.MZLegend.drawMedal(g, lg.id, (W - sz * 1.55) / 2, (W - sz * 1.55) / 2 - W * 0.06, sz * 1.55, legendLite() ? 0 : t, { seed: 3, lite: legendLite() }); // v1.31: medalha
      if (!legendLite() || k < 1) legendRaf = requestAnimationFrame(spin);
    })(t0);
    Sound.record(); haptic('place');
    announce(T('Medalha lendária: {name}!', { name: T(lg.name) }));
  }

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
    document.body.classList.toggle('juice', !!FLAGS.juice); // v1.30: acabamento de animação (laboratório)
    document.body.classList.toggle('q-low', settings.quality === 'low'); // v1.16: qualidade baixa corta efeitos de CSS contínuos
    Sound.setSfx(settings.sound);
    Sound.setVolume(settings.sfxVol / 100, settings.musicVol / 100);
    Sound.setMusic(settings.music);
    $('#set-sfx-vol').value = settings.sfxVol; $('#out-sfx-vol').textContent = settings.sfxVol + '%';
    $('#set-music-vol').value = settings.musicVol; $('#out-music-vol').textContent = settings.musicVol + '%';
    $('#set-sound').checked = settings.sound;
    $('#set-music').checked = settings.music;
    if ($('#set-tts')) { $('#set-tts').checked = settings.tts !== false; $('#row-tts').hidden = !(FLAGS.hype && window.MZHype && (MZHype.Speak.supported() || (MZHype.Voice.list && MZHype.Voice.list.length))) || !settings.sound; }
    $('#set-vibrate').checked = settings.vibrate;
    if ($('#set-kbq')) { $('#set-kbq').checked = settings.kbq !== false; $('#row-kbq').hidden = !FLAGS.mascote; }
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
  if ($('#set-tts')) $('#set-tts').addEventListener('change', function (e) { // v1.30: ao ligar, fala uma vez para a pessoa ouvir
    settings.tts = e.target.checked; saveSettings(); applySettings();
    if (settings.tts && window.MZHype) { var vf = MZHype.Voice.fileFor(MZI18n.lang, 'incrivel'); if (vf && Sound.voicePreload) Sound.voicePreload([vf]); setTimeout(function () { shout('incrivel', 'Incrível!'); }, vf ? 250 : 0); } // v1.31: voz gravada, se houver
  });
  if (window.MZHype) MZHype.Speak.warm();
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
  if ($('#set-kbq')) $('#set-kbq').addEventListener('change', function (e) {
    settings.kbq = e.target.checked; saveSettings();
    if (window.MZMascot) MZMascot.show(mascotOn());
    if (homeKbq) { homeKbq.show(settings.kbq); if (homeBub) homeBub.classList.remove('show'); }
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

  /** v1.27 (Galeria de visuais, Entrega E): visual inicial escolhido pelo jogador — só um já descoberto; senão o Clássico. */
  function startLookId() {
    var id = settings.startLook;
    if (FLAGS.gallery && id && Themes.indexOfId(id) > 0 && THEMES[Themes.indexOfId(id)].id === id && stats.themesSeen[id]) return id;
    return THEMES[0].id;
  }
  /** Miniatura de um visual: pedaço de tabuleiro com blocos (cores e acabamento do visual). */
  function drawLookPreview(cv, themeId) {
    var th = THEMES[Math.max(0, Themes.indexOfId(themeId))], W = cv.width, H = cv.height, ctx = cv.getContext('2d'), cols = 6, rows = 4;
    var cs = Math.floor(Math.min(W / cols, H / rows)), ox = Math.floor((W - cs * cols) / 2), oy = Math.floor((H - cs * rows) / 2);
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = th.board; Themes.roundRect(ctx, ox - 3, oy - 3, cs * cols + 6, cs * rows + 6, 8); ctx.fill();
    var pat = ['..1100', '.11002', '330.22', '34455.'];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var ch = pat[r].charAt(c), x = ox + c * cs, y = oy + r * cs;
      if (ch === '.') { ctx.fillStyle = th.empty; Themes.roundRect(ctx, x + 1, y + 1, cs - 2, cs - 2, cs * 0.18); ctx.fill(); }
      else ctx.drawImage(sprite(th, +ch % 7, cs, 'classic'), x, y, cs, cs);
    }
  }
  /** Desenha a miniatura (2×2 blocos) de um estilo num canvas de 88×88. */
  function drawSkinPreview(cv, skinId) {
    var th = THEMES[0], ctx = cv.getContext('2d'); // v1.25: cada estilo mostra as próprias cores (antes pegava o visual da última partida e ficava tudo igual)
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
    var rk = data['gb.ranked']; // v1.27: Ranqueada — só números inteiros e não negativos
    if (rk && typeof rk === 'object' && !Array.isArray(rk)) { var ro = {}; ['rp', 'w', 'l', 'd', 'best', 'streak', 'top', 'elo', 'topElo', 'games'].forEach(function (k) { var v = rk[k]; ro[k] = typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : 0; }); out['gb.ranked'] = ro; }
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
  // v1.26: o botão do evento agora fica na tela Eventos (menus.js)
  function openEvent() { // v1.24: Desafio do evento (Semana do Terror)
    var ev = eventNow(); if (!ev) return;
    if (ev.theme === 'natal') { openNatal(ev); return; }
    showDialog({ title: ev.icon + ' ' + T(ev.name), list: [
      T('Liberte {n} morcegos 🦇 numa partida só.', { n: ev.goal }), T('Quebre as gaiolas para soltar os morcegos. Elas aparecem bem mais neste desafio.'),
      T('Corra: se a gaiola não quebrar em {n} jogadas, o morcego foge.', { n: ev.flee }),
      stats.rares && stats.rares.pk ? T('Você já é Caçador de Morcegos! Jogue de novo por diversão.') : T('Prêmio: a conquista Caçador de Morcegos, para sempre.'), T('O evento acaba domingo, 8/11.')],
      buttons: [{ label: T('Jogar'), cls: 'primary big', fn: function () { closeDialog(); confirmReplace('event', function () { startGame('event'); }, function () { startGame('event', { resume: true }); }); } }]
        .concat(stats.rares && stats.rares.pk ? [{ label: '👹 ' + T('Fase Pesadelo'), cls: 'confirm', fn: function () { // v1.25: liberada depois de vencer o desafio
          closeDialog(); showDialog({ title: '👹 ' + T('Fase Pesadelo'), list: [T('Liberte {n} morcegos numa partida só.', { n: ev.nightmare.goal }), T('Sem desfazer e sem reviver.'),
            T('O morcego foge em {n} jogadas.', { n: ev.nightmare.flee }), T('Prêmio: {b}, guardado para sempre.', { b: T(ev.nightmare.badge) })],
            buttons: [{ label: T('Encarar o Pesadelo'), cls: 'primary big', fn: function () { closeDialog(); startGame('event'); state.nightmare = true; state.undoLeft = 0; saveGame(); updateHud(); } },
              { label: T('Agora não'), cls: 'ghost-dark', fn: closeDialog }] }); } }] : [])
        .concat([{ label: T('Agora não'), cls: 'ghost-dark', fn: closeDialog }]) });
  }
  function startNatal(tier) { // v1.29: 1 = Desafio de Natal, 2 = Noite Feliz, 3 = Nevasca
    closeDialog(); startGame('event');
    state.tier = tier; state.nightmare = tier >= 2; state.hard = tier >= 2 ? 2 : 0;
    if (tier >= 2) { state.undoLeft = 0; helperMode = null; }
    saveGame(); updateHud(); updateHelpers();
  }
  function openNatal(ev) { // v1.29 (dono): três níveis — um mais fácil e dois bem mais difíceis
    var mine = (stats.events || {})[ev.id] || {}, best = mine.best || {}, w1 = !!(stats.rares && stats.rares.gf), w2 = !!mine.nightmare, w3 = !!mine.storm;
    var line = function (icon, name, t, won, open, rule) { return icon + ' ' + T(name) + ' — ' + (won ? '✅ ' + T('vencido') : open ? T('seu melhor: {b} de {n}', { b: best[t] || 0, n: (t === 3 ? ev.storm : t === 2 ? ev.nightmare : ev).goal }) : '🔒 ' + rule); };
    var play = function () { closeDialog(); if (hasSave('event') && !(state && state.mode === 'event' && state.over)) confirmReplace('event', function () { startNatal(1); }, function () { startGame('event', { resume: true }); }); else startNatal(1); };
    showDialog({ title: ev.icon + ' ' + T(ev.name), list: [
      T('Abra {n} presentes 🎁 numa partida só. Presente que não abre a tempo some na neve.', { n: ev.goal }),
      '✨ ' + T('Presente dourado vale 3, mas some mais rápido. Arrisca?'),
      line('🎄', 'Desafio de Natal', 1, w1, true, ''),
      line('🌟', 'Noite Feliz', 2, w2, w1, T('vença o Desafio de Natal')),
      line('❄️', 'Nevasca', 3, w3, w2, T('vença a Noite Feliz')),
      T('O evento acaba em 31/12.')],
      buttons: [{ label: '🎄 ' + T('Desafio de Natal'), cls: 'primary big', fn: play }]
        .concat(w1 ? [{ label: '🌟 ' + T('Noite Feliz'), cls: 'confirm', fn: function () {
          closeDialog(); showDialog({ title: '🌟 ' + T('Fase Noite Feliz'), list: [T('Abra {n} presentes numa partida só.', { n: ev.nightmare.goal }), T('Bem mais presentes no tabuleiro, mas peças mais difíceis.'),
            T('Sem desfazer e sem ajudas.'), T('O presente some em {n} jogadas.', { n: ev.nightmare.flee }), T('Prêmio: {b}, guardado para sempre.', { b: T(ev.nightmare.badge) })],
            buttons: [{ label: T('Encarar a Noite Feliz'), cls: 'primary big', fn: function () { startNatal(2); } }, { label: T('Agora não'), cls: 'ghost-dark', fn: closeDialog }] }); } }] : [])
        .concat(w2 ? [{ label: '❄️ ' + T('Nevasca'), cls: 'confirm', fn: function () {
          closeDialog(); showDialog({ title: '❄️ ' + T('Fase Nevasca'), list: [T('Abra {n} presentes numa partida só.', { n: ev.storm.goal }), T('Bolas de neve caem no tabuleiro a cada {n} jogadas.', { n: ev.storm.snow }),
            T('Sem desfazer e sem ajudas.'), T('O presente some em {n} jogadas.', { n: ev.storm.flee }), T('Prêmio: {b}, guardado para sempre.', { b: T(ev.storm.badge) })],
            buttons: [{ label: T('Encarar a Nevasca'), cls: 'primary big', fn: function () { startNatal(3); } }, { label: T('Agora não'), cls: 'ghost-dark', fn: closeDialog }] }); } }] : [])
        .concat([{ label: T('Agora não'), cls: 'ghost-dark', fn: closeDialog }]) });
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
    if (e.key === 'Escape') { closeOverlay('#ov-settings'); closeOverlay('#ov-pause'); closeOverlay('#ov-dialog'); closeOverlay('#ov-legend'); settingsReturn = null; return; }
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
  window.addEventListener('storage', function (e) {
    if (e.key === 'gb.wipe' && e.newValue) { wiping = true; location.reload(); }
    else if (e.key === 'gb.settings') syncSavedSettings();
    else if (e.key === 'gb.stats' && e.newValue && !wiping) { // v1.27: outra aba gravou o progresso → usa o mais novo (antes esta aba sobrescrevia e o progresso da outra sumia)
      try { var t = stats.timeMs; stats = Progress.normalize(JSON.parse(e.newValue)); stats.timeMs = Math.max(t || 0, stats.timeMs || 0); lastStatsSnap = null; if (screenIs('home')) refreshHome(); } catch (err) {}
    }
  });

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
  if (lateLegends.length) setTimeout(function () { // v1.31: medalhas lendárias ganhas pelo recorde de antes
    toast(lateLegends.length > 1 ? T('{n} medalhas lendárias!', { n: lateLegends.length }) : T('Medalha lendária: {name}!', { name: T(lateLegends[0].name) }), T('Pelo seu recorde. Use como bloco na Ranqueada.'));
  }, 2600);
  try { if (localStorage.getItem('gb.restored')) { localStorage.removeItem('gb.restored'); setTimeout(function () { toast(T('Progresso restaurado!'), T('Seus recordes e conquistas estão de volta.')); }, 600); } } catch (e) {}
  applySettings();
  Sound.setTheme(THEMES[0]);
  applyTheme(0, false);

  // interface usada por js/menus.js
  window.GB = {
    VERSION: VERSION, Progress: Progress, THEMES: THEMES, Skins: Skins,
    get stats() { return stats; }, get settings() { return settings; }, flags: FLAGS, loadArt: loadArt, openStreak: openStreak, get themeIdx() { return themeIdx; },
    fmt: fmt, today: today, store: store, saveStats: saveStats, toast: toast, sound: Sound, shout: shout,
    startGame: startGame, startTutorial: startTutorial, hasSave: hasSave, bestFor: bestFor, challengeDef: challengeDef,
    confirmReplace: confirmReplace, openChallengeIntro: openChallengeIntro, showDialog: showDialog, closeDialog: closeDialog,
    show: show, goHome: goHome, openSettings: function () { settingsReturn = null; openOverlay('#ov-settings'); },
    eventNow: eventNow, openEvent: openEvent, saveSettings: saveSettings,
    previewEvent: function (id) { if (!(window.MZ_LAB === true || /[?&]feat=all\b/.test(location.search)) || !FLAGS.natal) return false; forcedEvent = id; loadArt(); natalPreview = true; rareCache = {}; sprites = {}; return !!eventNow(); },
    previewFireworks: function () { if (!natalPreview) return false; fwPreview = true; layerTheme = ''; return true; }, // v1.29: laboratório — ver os fogos antes de 31/12
    natalPreview: function () { return natalPreview; }, adventDay: adventDay, openAdvent: openAdvent, // v1.28: só no laboratório — ver o Natal antes de dezembro
    galera: galera, weeklyData: weeklyData, shareWeekly: shareWeekly, openPasteFriend: openPasteFriend, askNick: askNick, nick: nick,
    drawSkinPreview: drawSkinPreview, drawLookPreview: drawLookPreview, startLookId: startLookId, drawGarden: drawGarden, drawArt: drawArt, setSkin: setSkin, resetAll: resetAll, records: records, multText: multText,
    tutorialDone: function () { return !!store.get('gb.tutorialDone', false); }
  };

  if (FLAGS.juice && $('#home-streak')) { // v1.30: 🔥 vira botão da trilha de 7 dias
    var hsk = $('#home-streak'); hsk.setAttribute('role', 'button'); hsk.tabIndex = 0; hsk.classList.add('tappable'); hsk.setAttribute('aria-label', T('Ver sequência de dias'));
    hsk.addEventListener('click', function () { Sound.tap(); openStreak(); });
    hsk.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStreak(); } });
  }
  show('home');
  if (eventNow() || forcedEvent) loadArt(); else setTimeout(function () { loadArt(); }, 1500); // v1.30: arte do evento depois da abertura

  // ganchos para testes automatizados: só existem com ?debug na URL e em localhost
  // segurança: só no computador de desenvolvimento (localhost), nunca no site publicado
  if (/[?&]debug\b/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.gbDebug = {
    get state() { return state; },
    get themeIdx() { return themeIdx; },
    get layout() { return L; },
    get anims() { return anims.length; },
    get animTypes() { return anims.map(function (a) { return a.type; }); }, // v1.29: testes
    get stats() { return stats; },
    get perf() { return perf; },
    mood: function () { updateComboChip(); requestRender(); }, // v1.25: testes da moldura de combo
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
    say: function (key, tier, sub) { return sayHype({ key: key, voice: '', tier: tier }, [1.15, SIZE / 2 - 0.5], sub || '', 0, true); }, // v1.30: conferir as falas
    look: function (id, animate) { state.themeId = id; themeIdx = Themes.indexOfId(id); applyTheme(themeIdx, !!animate); },
    transform: function (skin, big) { if (!state.look) state.look = { skin: null, left: 0, last: [], since: 99 }; applyLook(skin, [SIZE / 2 - 0.5, SIZE / 2 - 0.5], { big: !!big }); },
    shareImage: function () { return makeShareImage(); }, share: function () { shareResult(); },
    load: function (s) { state = s; themeIdx = Themes.indexOfId(s.themeId); applyTheme(themeIdx, false); drawTray(false); updateHud(); render(); }
  };
})();
