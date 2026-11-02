/* v1.25 (pedido do dono): BLOCOS LENDÁRIOS — 9 blocos animados, arte original desenhada por código.
 * Liberados ao passar marcas de pontos (para sempre): 100 mil Aurora · 200 mil Glitch · 300 mil Dragão · 500 mil Plasma ·
 * 750 mil Olho · 1 mi Portal · 2 mi Holograma · 3 mi Galáxia · 4 mi Buraco negro.
 * MZLegend.draw(ctx, id, x, y, s, t, opts) desenha um bloco de lado `s` em (x, y) no tempo `t` (ms).
 * opts.look = {x, y} faz o Olho olhar para um ponto; opts.seed muda a fase de cada bloco; opts.lite = menos detalhes. */
(function (root) {
  'use strict';
  var LIST = [
    { id: 'aurora', min: 100000, name: 'Aurora boreal', icon: '🌌' },
    { id: 'glitch', min: 200000, name: 'Glitch', icon: '📺' },
    { id: 'dragon', min: 300000, name: 'Escama de dragão', icon: '🐉' },
    { id: 'plasma', min: 500000, name: 'Plasma', icon: '⚡' },
    { id: 'eye', min: 750000, name: 'Olho', icon: '👁️' },
    { id: 'portal', min: 1000000, name: 'Portal', icon: '🌀' },
    { id: 'holo', min: 2000000, name: 'Holograma 3D', icon: '🧠' },
    { id: 'galaxy', min: 3000000, name: 'Galáxia', icon: '🪐' },
    { id: 'blackhole', min: 4000000, name: 'Buraco negro', icon: '🕳️' }
  ];
  var TAU = Math.PI * 2;
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  /* moldura comum: borda dourada fina com brilho que passa */
  function frame(g, x, y, s, t, seed, col) {
    var r = s * 0.2, k = ((t / 2600 + seed * 0.13) % 1);
    g.save(); g.lineWidth = Math.max(1.2, s * 0.05);
    var gr = g.createLinearGradient(x, y, x + s, y + s);
    gr.addColorStop(0, col || '#ffd36b'); gr.addColorStop(Math.max(0, k - 0.12), col || '#ffd36b');
    gr.addColorStop(k, '#ffffff'); gr.addColorStop(Math.min(1, k + 0.12), col || '#ffd36b'); gr.addColorStop(1, col || '#c98a1e');
    g.strokeStyle = gr; rr(g, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88, r); g.stroke(); g.restore();
  }
  function clip(g, x, y, s) { rr(g, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88, s * 0.2); g.clip(); }

  var DRAW = {
    aurora: function (g, x, y, s, t, o) {
      var bg = g.createLinearGradient(x, y, x, y + s); bg.addColorStop(0, '#04122b'); bg.addColorStop(1, '#0b3a4a'); g.fillStyle = bg; g.fillRect(x, y, s, s);
      for (var i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.6 * hash(i + o.seed)) * (0.5 + 0.5 * Math.sin(t / 400 + i * 2)) + ')'; g.fillRect(x + hash(i * 3 + o.seed) * s, y + hash(i * 7 + o.seed) * s * 0.5, Math.max(1, s * 0.025), Math.max(1, s * 0.025)); }
      g.globalCompositeOperation = 'lighter';
      [['rgba(60,255,170,', 0], ['rgba(80,200,255,', 1.7], ['rgba(190,110,255,', 3.1]].forEach(function (c, k) {
        for (var j = 0; j < (o.lite ? 6 : 12); j++) {
          var fx = j / (o.lite ? 5 : 11), wave = Math.sin(fx * 5 + t / 700 + c[1]) * s * 0.12 + Math.sin(fx * 2.3 - t / 1100 + k) * s * 0.07;
          var top = y + s * (0.18 + 0.12 * k) + wave, h = s * (0.38 + 0.12 * Math.sin(t / 500 + j + k));
          var gr = g.createLinearGradient(0, top, 0, top + h); gr.addColorStop(0, c[0] + '0)'); gr.addColorStop(0.35, c[0] + '0.55)'); gr.addColorStop(1, c[0] + '0)');
          g.fillStyle = gr; g.fillRect(x + fx * s - s * 0.06, top, s * 0.12, h);
        }
      });
      g.globalCompositeOperation = 'source-over';
    },
    glitch: function (g, x, y, s, t, o) {
      var step = Math.floor(t / 110), burst = hash(step + o.seed) > 0.55;
      var bg = g.createLinearGradient(x, y, x + s, y + s); bg.addColorStop(0, '#ff2bd6'); bg.addColorStop(1, '#2bf3ff'); g.fillStyle = bg; g.fillRect(x, y, s, s);
      g.fillStyle = 'rgba(10,0,30,.55)'; g.fillRect(x + s * 0.24, y + s * 0.24, s * 0.52, s * 0.52);
      g.fillStyle = '#fff'; g.font = '900 ' + Math.round(s * 0.36) + 'px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      var ch = '01#?!@'[Math.floor(hash(step * 3 + o.seed) * 6)];
      g.fillStyle = 'rgba(255,0,80,.9)'; g.fillText(ch, x + s / 2 - s * 0.03, y + s / 2);
      g.fillStyle = 'rgba(0,255,255,.9)'; g.fillText(ch, x + s / 2 + s * 0.03, y + s / 2);
      g.fillStyle = '#fff'; g.fillText(ch, x + s / 2, y + s / 2);
      if (burst) for (var i = 0; i < 4; i++) { // fatias deslocadas
        var sy = y + hash(step * 11 + i) * s, sh = s * (0.05 + 0.1 * hash(step * 5 + i)), dx = (hash(step * 7 + i) - 0.5) * s * 0.4;
        g.fillStyle = i % 2 ? 'rgba(255,255,255,.75)' : 'rgba(0,255,200,.6)'; g.fillRect(x + dx, sy, s, sh * 0.4);
      }
      g.fillStyle = 'rgba(0,0,0,.18)'; for (var l = 0; l < s; l += Math.max(2, s * 0.06)) g.fillRect(x, y + l, s, Math.max(1, s * 0.02));
    },
    dragon: function (g, x, y, s, t, o) {
      g.fillStyle = '#2a0606'; g.fillRect(x, y, s, s);
      var n = 4, w = s / n, sweep = ((t / 1800 + o.seed * 0.17) % 1.6) - 0.3;
      for (var r = -1; r <= n; r++) for (var c = -1; c <= n; c++) {
        var cx = x + (c + (r % 2 ? 0.5 : 0)) * w, cy = y + r * w * 0.75;
        var d = ((c / n) + (r / n)) / 2, heat = Math.max(0, 1 - Math.abs(d - sweep) * 4);
        var gr = g.createRadialGradient(cx, cy + w * 0.6, w * 0.1, cx, cy + w * 0.35, w * 0.75);
        gr.addColorStop(0, 'rgb(' + Math.round(150 + 105 * heat) + ',' + Math.round(40 + 160 * heat) + ',' + Math.round(20 + 60 * heat) + ')');
        gr.addColorStop(1, '#3a0808');
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy + w * 0.35, w * 0.62, 0, Math.PI); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,200,80,' + (0.25 + 0.6 * heat) + ')'; g.lineWidth = Math.max(1, s * 0.015); g.beginPath(); g.arc(cx, cy + w * 0.35, w * 0.62, 0, Math.PI); g.stroke();
      }
    },
    plasma: function (g, x, y, s, t, o) {
      var bg = g.createRadialGradient(x + s / 2, y + s / 2, 0, x + s / 2, y + s / 2, s * 0.7); bg.addColorStop(0, '#1b1f6e'); bg.addColorStop(1, '#05061c'); g.fillStyle = bg; g.fillRect(x, y, s, s);
      var cx = x + s / 2, cy = y + s / 2, step = Math.floor(t / 70);
      g.globalCompositeOperation = 'lighter';
      for (var b = 0; b < (o.lite ? 3 : 5); b++) {
        var a = hash(step * 13 + b + o.seed) * TAU, len = s * (0.36 + 0.12 * hash(step + b));
        g.strokeStyle = b % 2 ? 'rgba(160,120,255,.9)' : 'rgba(120,230,255,.95)'; g.lineWidth = Math.max(1, s * 0.03); g.shadowColor = '#7fd8ff'; g.shadowBlur = s * 0.12;
        g.beginPath(); g.moveTo(cx, cy);
        for (var k = 1; k <= 5; k++) { var f = k / 5, j = (hash(step * 31 + b * 7 + k) - 0.5) * s * 0.18; g.lineTo(cx + Math.cos(a) * len * f + Math.cos(a + 1.57) * j, cy + Math.sin(a) * len * f + Math.sin(a + 1.57) * j); }
        g.stroke();
      }
      g.shadowBlur = 0;
      var core = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.2); core.addColorStop(0, '#ffffff'); core.addColorStop(0.4, 'rgba(150,220,255,.9)'); core.addColorStop(1, 'rgba(80,120,255,0)');
      g.fillStyle = core; g.beginPath(); g.arc(cx, cy, s * (0.18 + 0.03 * Math.sin(t / 90)), 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      var gl = g.createLinearGradient(x, y, x + s, y + s); gl.addColorStop(0, 'rgba(255,255,255,.28)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(x, y, s, s);
    },
    eye: function (g, x, y, s, t, o) {
      g.fillStyle = '#2b0b3d'; g.fillRect(x, y, s, s);
      var cx = x + s / 2, cy = y + s / 2, rx = s * 0.36, ry = s * 0.26;
      var cyc = (t / 1000 + o.seed * 0.7) % 3.6, open = cyc < 0.16 ? Math.abs(cyc - 0.08) / 0.08 : 1;
      g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry * Math.max(0.05, open), 0, 0, TAU); g.clip();
      var sc = g.createRadialGradient(cx, cy, 0, cx, cy, rx); sc.addColorStop(0, '#ffffff'); sc.addColorStop(1, '#e8c9d6'); g.fillStyle = sc; g.fillRect(x, y, s, s);
      g.strokeStyle = 'rgba(200,40,60,.35)'; g.lineWidth = Math.max(1, s * 0.01);
      for (var v = 0; v < 4; v++) { var va = v * 1.6 + o.seed; g.beginPath(); g.moveTo(cx + Math.cos(va) * rx, cy + Math.sin(va) * ry); g.quadraticCurveTo(cx + Math.cos(va + 0.4) * rx * 0.6, cy + Math.sin(va + 0.4) * ry * 0.6, cx + Math.cos(va) * rx * 0.45, cy + Math.sin(va) * ry * 0.45); g.stroke(); }
      var lx = Math.sin(t / 1300 + o.seed) * 0.5, ly = Math.cos(t / 1700 + o.seed) * 0.4;
      if (o.look) { var dx = o.look.x - cx, dy = o.look.y - cy, d = Math.sqrt(dx * dx + dy * dy) || 1; lx = dx / d; ly = dy / d; }
      var ix = cx + lx * rx * 0.4, iy = cy + ly * ry * 0.4, ir = s * 0.15;
      var iris = g.createRadialGradient(ix, iy, 0, ix, iy, ir); iris.addColorStop(0, '#ffe36b'); iris.addColorStop(0.55, '#ff7a1a'); iris.addColorStop(1, '#7a1200');
      g.fillStyle = iris; g.beginPath(); g.arc(ix, iy, ir, 0, TAU); g.fill();
      g.fillStyle = '#0a0006'; g.beginPath(); g.ellipse(ix, iy, ir * 0.22, ir * 0.7, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(ix - ir * 0.35, iy - ir * 0.4, ir * 0.18, 0, TAU); g.fill();
      g.restore();
      g.strokeStyle = '#120318'; g.lineWidth = Math.max(1, s * 0.035); g.beginPath(); g.ellipse(cx, cy, rx, ry * Math.max(0.05, open), 0, 0, TAU); g.stroke();
    },
    portal: function (g, x, y, s, t, o) {
      var cx = x + s / 2, cy = y + s / 2;
      g.fillStyle = '#05010f'; g.fillRect(x, y, s, s);
      var world = g.createLinearGradient(x, y + s * 0.3, x + s, y + s * 0.7), h = (t / 40) % 360;
      world.addColorStop(0, 'hsl(' + h + ',90%,60%)'); world.addColorStop(1, 'hsl(' + ((h + 120) % 360) + ',90%,45%)');
      g.fillStyle = world; g.beginPath(); g.arc(cx, cy, s * 0.22, 0, TAU); g.fill();
      g.lineCap = 'round';
      for (var i = 0; i < (o.lite ? 4 : 7); i++) {
        var rad = s * (0.24 + i * 0.035), rot = t / (500 + i * 120) * (i % 2 ? -1 : 1) + i;
        g.strokeStyle = i % 2 ? 'rgba(170,90,255,' + (0.9 - i * 0.09) + ')' : 'rgba(60,230,255,' + (0.9 - i * 0.09) + ')';
        g.lineWidth = Math.max(1, s * 0.028);
        g.beginPath(); g.arc(cx, cy, rad, rot, rot + 3.6); g.stroke();
      }
      var gl = g.createRadialGradient(cx, cy, s * 0.15, cx, cy, s * 0.5); gl.addColorStop(0, 'rgba(120,200,255,0)'); gl.addColorStop(1, 'rgba(120,80,255,.3)'); g.fillStyle = gl; g.fillRect(x, y, s, s);
    },
    holo: function (g, x, y, s, t, o) {
      g.fillStyle = 'rgba(10,30,50,.92)'; g.fillRect(x, y, s, s);
      var cx = x + s / 2, cy = y + s / 2, a = t / 1500 + o.seed, b = t / 2300, z = s * 0.2;
      var V = [], E = [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]];
      for (var i = 0; i < 8; i++) {
        var px = (i & 1 ? 1 : -1) * z, py = (i & 2 ? 1 : -1) * z, pz = (i & 4 ? 1 : -1) * z;
        var x1 = px * Math.cos(a) - pz * Math.sin(a), z1 = px * Math.sin(a) + pz * Math.cos(a);
        var y1 = py * Math.cos(b) - z1 * Math.sin(b), z2 = py * Math.sin(b) + z1 * Math.cos(b), k = 1 + z2 / (s * 1.4);
        V.push([cx + x1 * k, cy + y1 * k]);
      }
      g.globalCompositeOperation = 'lighter'; g.lineWidth = Math.max(1, s * 0.025);
      E.forEach(function (e, n) { g.strokeStyle = 'hsla(' + ((t / 15 + n * 30) % 360) + ',100%,65%,.9)'; g.beginPath(); g.moveTo(V[e[0]][0], V[e[0]][1]); g.lineTo(V[e[1]][0], V[e[1]][1]); g.stroke(); });
      g.globalCompositeOperation = 'source-over';
      var sl = y + ((t / 12) % s); g.fillStyle = 'rgba(120,255,255,.18)'; g.fillRect(x, sl, s, s * 0.06);
      g.fillStyle = 'rgba(120,255,255,.06)'; for (var l = 0; l < s; l += Math.max(2, s * 0.05)) g.fillRect(x, y + l, s, 1);
    },
    galaxy: function (g, x, y, s, t, o) {
      var cx = x + s / 2, cy = y + s / 2, bg = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.7);
      bg.addColorStop(0, '#3a1a6e'); bg.addColorStop(0.5, '#120a35'); bg.addColorStop(1, '#03020c'); g.fillStyle = bg; g.fillRect(x, y, s, s);
      var rot = t / 4000 + o.seed, n = o.lite ? 40 : 90;
      for (var i = 0; i < n; i++) {
        var f = i / n, arm = i % 2 ? Math.PI : 0, ang = rot + arm + f * 5.2, rad = f * s * 0.44 + (hash(i) - 0.5) * s * 0.05;
        var a2 = 0.35 + 0.65 * (1 - f);
        g.fillStyle = i % 5 === 0 ? 'rgba(255,190,240,' + a2 + ')' : 'rgba(200,220,255,' + a2 + ')';
        var d = Math.max(0.8, s * 0.018 * (1.4 - f)); g.fillRect(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.8, d, d);
      }
      var core = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.14); core.addColorStop(0, '#fff6d8'); core.addColorStop(1, 'rgba(255,200,150,0)');
      g.fillStyle = core; g.beginPath(); g.arc(cx, cy, s * 0.14, 0, TAU); g.fill();
      for (var k = 0; k < 5; k++) { var tw = 0.5 + 0.5 * Math.sin(t / 300 + k * 1.9); g.fillStyle = 'rgba(255,255,255,' + tw + ')'; g.fillRect(x + hash(k * 9 + 2) * s, y + hash(k * 4 + 1) * s, Math.max(1, s * 0.02), Math.max(1, s * 0.02)); }
    },
    blackhole: function (g, x, y, s, t, o) {
      var cx = x + s / 2, cy = y + s / 2;
      g.fillStyle = '#020005'; g.fillRect(x, y, s, s);
      var rot = t / 900;
      for (var i = 0; i < (o.lite ? 10 : 24); i++) { // matéria caindo em espiral
        var life = ((t / 2200 + hash(i + o.seed)) % 1), ang = hash(i * 3) * TAU + life * 5, rad = s * 0.5 * (1 - life);
        g.fillStyle = 'rgba(255,' + Math.round(150 + 100 * life) + ',80,' + (0.2 + 0.8 * life) + ')';
        g.fillRect(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.45, Math.max(1, s * 0.02), Math.max(1, s * 0.02));
      }
      g.save(); g.translate(cx, cy); g.scale(1, 0.38); // disco de acreção
      var disk = g.createRadialGradient(0, 0, s * 0.16, 0, 0, s * 0.46);
      disk.addColorStop(0, 'rgba(255,250,220,1)'); disk.addColorStop(0.35, 'rgba(255,170,60,.95)'); disk.addColorStop(0.75, 'rgba(200,60,20,.6)'); disk.addColorStop(1, 'rgba(120,20,10,0)');
      g.fillStyle = disk; g.beginPath(); g.arc(0, 0, s * 0.46, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(1, s * 0.03);
      g.beginPath(); g.arc(0, 0, s * 0.3, rot, rot + 1.2); g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.38, -rot * 0.7, -rot * 0.7 + 0.8); g.stroke();
      g.restore();
      var halo = g.createRadialGradient(cx, cy, s * 0.13, cx, cy, s * 0.22); halo.addColorStop(0, 'rgba(255,220,160,.9)'); halo.addColorStop(1, 'rgba(255,140,60,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, s * 0.22, 0, TAU); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, s * (0.14 + 0.005 * Math.sin(t / 200)), 0, TAU); g.fill();
    }
  };
  var FRAME = { glitch: '#7ff6ff', eye: '#ff9a3c', plasma: '#9fe7ff', holo: '#7fffe6', blackhole: '#ffb347' };

  function draw(g, id, x, y, s, t, opts) {
    var o = opts || {}; o.seed = o.seed || 0;
    var fn = DRAW[id]; if (!fn) return;
    g.save(); clip(g, x, y, s); fn(g, x, y, s, t || 0, o); g.restore();
    frame(g, x, y, s, t || 0, o.seed, FRAME[id]);
  }
  function byId(id) { return LIST.filter(function (l) { return l.id === id; })[0] || null; }

  var api = { LIST: LIST, draw: draw, byId: byId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZLegend = api;
})(this);
