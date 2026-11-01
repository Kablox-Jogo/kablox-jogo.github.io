/* Kablox — efeitos visuais do tabuleiro (gerenciador de animações e partículas).
 * Cada efeito é um objeto { type, start, dur, ... } guardado na lista de animações do jogo.
 * As animações só desenham: a lógica do tabuleiro já foi aplicada antes, então nenhum efeito
 * consegue alterar o estado do jogo.
 */
(function (root) {
  'use strict';
  var T = root.MZThemes;
  var MAX_PARTICLES = 260; // teto global, para não pesar em celulares simples
  var cap = MAX_PARTICLES;   // v1.16: qualidade "baixa" usa teto menor (setCap)

  /** Quantas partículas ainda cabem, dado o que já está na tela. */
  function budget(anims) {
    var used = 0;
    anims.forEach(function (a) { if (a.list) used += a.list.length; });
    return Math.max(0, cap - used);
  }

  /** Explosão de fragmentos a partir das casas limpas, na cor de cada bloco. intensity: 1..3 */
  function burst(cells, colorOf, geo, now, intensity, anims, delay) {
    var cell = geo.cell, pad = geo.pad, list = [], room = budget(anims);
    var per = intensity >= 3 ? 4 : intensity === 2 ? 3 : 2;
    var step = Math.max(1, Math.ceil(cells.length * per / Math.max(1, room)));
    for (var i = 0; i < cells.length && list.length < room; i += step) {
      var o = cells[i];
      for (var k = 0; k < per && list.length < room; k++) {
        var spd = (1 + intensity * 0.35);
        list.push({
          x: pad + (o.c + 0.5) * cell, y: pad + (o.r + 0.5) * cell,
          vx: (Math.random() - 0.5) * cell * 6 * spd, vy: -(0.8 + Math.random() * 2.2) * cell * 2.4 * spd,
          g: cell * 16, size: cell * (0.12 + Math.random() * 0.16),
          rot: Math.random() * 6, spin: (Math.random() - 0.5) * 10, color: colorOf(o.color)
        });
      }
    }
    return { type: 'parts', list: list, start: now + (delay || 0), dur: 650 + intensity * 120 };
  }

  /** Confete a partir do centro (tabuleiro limpo, recorde). */
  function confetti(palette, geo, now, amount, anims) {
    var cell = geo.cell, cx = geo.size / 2, cy = geo.size / 2, list = [], n = Math.min(amount, budget(anims));
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = (2 + Math.random() * 5) * cell;
      list.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - cell * 2, g: cell * 9,
        size: cell * (0.15 + Math.random() * 0.2), rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12,
        color: palette[i % palette.length] });
    }
    return { type: 'parts', list: list, start: now, dur: 1100 };
  }

  /** Faíscas discretas em volta da peça que acabou de encaixar. */
  function sparks(placed, color, geo, now, anims) {
    var list = [], cell = geo.cell, pad = geo.pad, room = Math.min(14, budget(anims));
    for (var i = 0; i < room; i++) {
      var rc = placed[i % placed.length], a = Math.random() * Math.PI * 2;
      list.push({ x: pad + (rc[1] + 0.5) * cell, y: pad + (rc[0] + 0.5) * cell, a: a, d: cell * (0.45 + Math.random() * 0.35), color: color });
    }
    return { type: 'sparks', list: list, start: now, dur: 300 };
  }

  /* ---------------- desenho ---------------- */
  /** Desenha um efeito deste módulo. Retorna false se o tipo não for daqui. */
  function draw(ctx, a, now, geo, spriteOf) {
    var t = (now - a.start) / a.dur, cell = geo.cell, pad = geo.pad;
    if (t < 0 || t >= 1) return a.type in DRAWERS;
    var fn = DRAWERS[a.type];
    if (!fn) return false;
    fn(ctx, a, t, now, geo, spriteOf);
    return true;
  }

  var DRAWERS = {
    // 1ª etapa da destruição: os blocos da linha acendem e pulsam antes de quebrar
    charge: function (ctx, a, t, now, geo, spriteOf) {
      var cell = geo.cell, pad = geo.pad;
      var pulse = 1 + 0.1 * Math.sin(t * Math.PI), glow = 0.15 + 0.6 * t;
      a.cells.forEach(function (o) {
        var cx = pad + (o.c + 0.5) * cell, cy = pad + (o.r + 0.5) * cell, s = cell * pulse;
        ctx.drawImage(spriteOf(o.color), cx - s / 2, cy - s / 2, s, s);
        ctx.save();
        ctx.globalAlpha = glow;
        ctx.shadowColor = a.glow; ctx.shadowBlur = cell * 0.5 * t;
        ctx.fillStyle = '#fff';
        T.roundRect(ctx, cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2, cell * 0.18);
        ctx.fill();
        ctx.restore();
      });
    },
    // onda de luz saindo do centro das linhas (2+ linhas)
    ring: function (ctx, a, t, now, geo) {
      var r = geo.cell * (0.5 + t * a.reach);
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = a.color; ctx.lineWidth = Math.max(2, geo.cell * 0.18 * (1 - t));
      ctx.shadowColor = a.color; ctx.shadowBlur = geo.cell * 0.6;
      ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    },
    sparks: function (ctx, a, t) {
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = '#fff';
      a.list.forEach(function (p) {
        var d = p.d * (0.4 + t * 0.9), x = p.x + Math.cos(p.a) * d, y = p.y + Math.sin(p.a) * d, s = Math.max(1.5, 3.2 * (1 - t));
        ctx.shadowColor = p.color; ctx.shadowBlur = 6;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      });
      ctx.restore();
    },
    // tabuleiro limpo: contorno brilhando + clarão
    boardGlow: function (ctx, a, t, now, geo) {
      var k = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8, r = Math.min(18, geo.size * 0.045);
      ctx.save();
      ctx.globalAlpha = 0.35 * k;
      ctx.fillStyle = '#fff';
      T.roundRect(ctx, 0, 0, geo.size, geo.size, r); ctx.fill();
      ctx.globalAlpha = k;
      ctx.strokeStyle = a.color; ctx.lineWidth = 4 + 6 * k;
      ctx.shadowColor = a.color; ctx.shadowBlur = 30 * k;
      T.roundRect(ctx, 3, 3, geo.size - 6, geo.size - 6, r); ctx.stroke();
      ctx.restore();
    },
    // boa jogada / combo: os blocos que ficaram no tabuleiro acendem por um instante (mais forte quanto maior o combo)
    glowCells: function (ctx, a, t, now, geo) {
      var cells = a.cellsFn(), cell = geo.cell, pad = geo.pad, k = Math.sin(Math.PI * t) * a.peak;
      if (!cells.length || k <= 0.01) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = a.color; ctx.globalAlpha = k;
      cells.forEach(function (o) { T.roundRect(ctx, pad + o.c * cell + 2, pad + o.r * cell + 2, cell - 4, cell - 4, cell * 0.2); ctx.fill(); });
      ctx.restore();
    },
    // várias linhas: onda de energia que passa pelos blocos a partir do ponto da jogada
    wave: function (ctx, a, t, now, geo) {
      var cells = a.cellsFn(), cell = geo.cell, pad = geo.pad, front = t * a.reach;
      if (!cells.length) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = a.color;
      cells.forEach(function (o) {
        var d = Math.sqrt((o.r - a.r) * (o.r - a.r) + (o.c - a.c) * (o.c - a.c)), b = 1 - Math.abs(d - front) / 1.3;
        if (b <= 0) return;
        ctx.globalAlpha = b * (1 - t * 0.6) * a.peak;
        T.roundRect(ctx, pad + o.c * cell + 1, pad + o.r * cell + 1, cell - 2, cell - 2, cell * 0.2); ctx.fill();
      });
      ctx.restore();
    },
    // tabuleiro limpo: o tabuleiro vazio "floresce" — blocos coloridos acendem em diagonal e somem
    bloom: function (ctx, a, t, now, geo, spriteOf) {
      var cell = geo.cell, pad = geo.pad, n = a.size;
      ctx.save();
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
        var k = (r + c) / (2 * n - 2), u = (t - k * 0.55) / 0.45;
        if (u <= 0 || u >= 1) continue;
        var e = Math.sin(Math.PI * u), sc = 0.55 + 0.45 * e;
        ctx.globalAlpha = 0.85 * e;
        ctx.drawImage(spriteOf((r * 3 + c * 2) % 7), pad + (c + 0.5) * cell - cell * sc / 2, pad + (r + 0.5) * cell - cell * sc / 2, cell * sc, cell * sc);
      }
      ctx.restore();
    },
    // efeito temporário (independente do visual): faixas azul, verde, amarelo e laranja atravessando os blocos
    prism: function (ctx, a, t, now, geo) {
      var cells = a.cellsFn(), cell = geo.cell, pad = geo.pad;
      if (!cells.length) return;
      var fade = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1, shift = t * geo.size * 1.6;
      var g = ctx.createLinearGradient(-geo.size + shift, 0, shift, geo.size);
      ['#3fa7ff', '#2fd27a', '#ffd23f', '#ff8a2b', '#3fa7ff'].forEach(function (c, i) { g.addColorStop(i / 4, c); });
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (a.strong ? 0.38 : 0.26) * fade; ctx.fillStyle = g;
      cells.forEach(function (o) { T.roundRect(ctx, pad + o.c * cell + 2, pad + o.r * cell + 2, cell - 4, cell - 4, cell * 0.2); ctx.fill(); });
      ctx.restore();
    },
    // texto de recorde: só um brilho no tabuleiro, o texto vai por popup
    shine: function (ctx, a, t, now, geo) {
      var x = -geo.size + t * geo.size * 3;
      ctx.save();
      T.roundRect(ctx, 0, 0, geo.size, geo.size, Math.min(18, geo.size * 0.045)); ctx.clip();
      var g = ctx.createLinearGradient(x, 0, x + geo.size * 0.6, geo.size * 0.6);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, geo.size, geo.size);
      ctx.restore();
    }
  };

  root.MZFx = { MAX_PARTICLES: MAX_PARTICLES, setCap: function (n) { cap = n; }, budget: budget, burst: burst, confetti: confetti, sparks: sparks, draw: draw };
})(this);
