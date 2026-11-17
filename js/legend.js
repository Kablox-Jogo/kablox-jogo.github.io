/* BLOCOS LENDÁRIOS — 9 blocos animados, arte original desenhada por código.
 * Liberados ao passar marcas de pontos (para sempre): 100 mil Aurora · 200 mil Glitch · 300 mil Dragão · 500 mil Plasma ·
 * 750 mil Olho · 1 mi Portal · 2 mi Holograma · 3 mi Galáxia · 4 mi Buraco negro.
 * MZLegend.draw(ctx, id, x, y, s, t, opts) desenha um bloco de lado `s` em (x, y) no tempo `t` (ms).
 * opts.look = {x, y} faz o Olho olhar para um ponto; opts.seed muda a fase de cada bloco; opts.lite = menos detalhes.
 *
 * v1.31 (pedido do dono: "os lendários estão muito feios") — redesenho completo, com uma linguagem visual única:
 *  1. Mesmo formato dos blocos normais (quadrado arredondado cheio), sem a moldura dourada com vão que fazia
 *     cada um parecer um ícone de app colado no tabuleiro.
 *  2. Uma cor dominante por lendário (todos diferentes entre si) e UM desenho central grande, com contraste forte,
 *     legível mesmo pequeno na bandeja de peças (22 px). Sai o que sumia de tão fino (letras, pontinhos, linhas de 1 px).
 *  3. Acabamento de pedra preciosa igual para todos: luz no alto, sombra embaixo, reflexo no canto, borda escura
 *     por fora (destaca no tabuleiro) e fio claro na cor do lendário por dentro.
 *  4. Raridade que se vê: um brilho atravessa o bloco de tempos em tempos, e quanto mais raro, mais estrelinhas piscam.
 */
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
  function lw(s, k) { return Math.max(1, s * k); }

  /* Corpo do bloco: mesma margem e mesmo arredondado dos blocos normais. */
  var IN = 0.04, RAD = 0.22;
  function body(g, x, y, s) { rr(g, x + s * IN, y + s * IN, s * (1 - 2 * IN), s * (1 - 2 * IN), s * RAD); }

  /* Cores de cada lendário: fundo (alto/baixo), cor de destaque (fio interno e brilho) e quantas estrelinhas (raridade). */
  var LOOK = {
    aurora:    { top: '#06182e', bot: '#0b3346', acc: '#5dffc0', stars: 1 },
    glitch:    { top: '#ff3fd2', bot: '#5a17d6', acc: '#7ffcff', stars: 1 },
    dragon:    { top: '#d8342a', bot: '#4a060c', acc: '#ffcf5a', stars: 2 },
    plasma:    { top: '#2a4dff', bot: '#0a0f4a', acc: '#a8f0ff', stars: 2 },
    eye:       { top: '#7d2bd6', bot: '#2a0a4a', acc: '#ffb13d', stars: 2 },
    portal:    { top: '#5a1fd6', bot: '#12043a', acc: '#e3a8ff', stars: 3 },
    holo:      { top: '#0f5a6e', bot: '#031c26', acc: '#7dfff0', stars: 3 },
    galaxy:    { top: '#c43da8', bot: '#26093f', acc: '#ffc2f0', stars: 4 },
    blackhole: { top: '#3a1a08', bot: '#000000', acc: '#ffc061', stars: 4 }
  };
  function fillBg(g, x, y, s, L) { var bg = g.createLinearGradient(x, y, x, y + s); bg.addColorStop(0, L.top); bg.addColorStop(1, L.bot); g.fillStyle = bg; g.fillRect(x, y, s, s); }

  /* ---------- desenho central de cada um (dentro do recorte do corpo) ---------- */
  var DRAW = {
    aurora: function (g, x, y, s, t, o, L) { // céu escuro, duas cortinas de luz largas (verde e lilás) ondulando, montanha com neve
      fillBg(g, x, y, s, L);
      for (var i = 0; i < 4; i++) { var tw = 0.4 + 0.6 * Math.abs(Math.sin(t / 700 + i * 2.1 + o.seed)); g.fillStyle = 'rgba(255,255,255,' + tw.toFixed(2) + ')'; var d = lw(s, 0.03); g.fillRect(x + s * (0.15 + 0.22 * i) + hash(i) * s * 0.05, y + s * (0.12 + 0.08 * hash(i + 9)), d, d); }
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
      // cortina = a mesma onda desenhada várias vezes, subindo e apagando (borda de baixo forte, topo esfumado)
      [['90,255,170', 0.6, 0.42, 0, 9], ['200,120,255', 0.44, 0.3, 2.4, 6]].forEach(function (b) {
        var ph = t / 1200 + b[3] + o.seed, layers = o.lite ? 4 : b[4];
        for (var i = layers - 1; i >= 0; i--) {
          var up = i * s * 0.03, al = (i === 0 ? 1 : 0.6 * (1 - i / layers));
          g.strokeStyle = 'rgba(' + b[0] + ',' + al.toFixed(2) + ')'; g.lineWidth = lw(s, i === 0 ? 0.05 : 0.065);
          g.beginPath();
          for (var j = 0; j <= 10; j++) { var f = j / 10, yy = y + s * (b[1] - (b[1] - b[2]) * f) + Math.sin(f * 4 + ph) * s * 0.06 - up;
            if (j) g.lineTo(x - s * 0.05 + f * s * 1.1, yy); else g.moveTo(x - s * 0.05, yy); }
          g.stroke();
        }
      });
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#030d16'; g.beginPath(); g.moveTo(x, y + s); g.lineTo(x, y + s * 0.84); g.lineTo(x + s * 0.3, y + s * 0.66); g.lineTo(x + s * 0.48, y + s * 0.78); g.lineTo(x + s * 0.7, y + s * 0.6); g.lineTo(x + s, y + s * 0.82); g.lineTo(x + s, y + s); g.closePath(); g.fill();
      g.fillStyle = '#e8fbff'; g.beginPath(); g.moveTo(x + s * 0.61, y + s * 0.675); g.lineTo(x + s * 0.7, y + s * 0.6); g.lineTo(x + s * 0.79, y + s * 0.675); g.lineTo(x + s * 0.73, y + s * 0.66); g.lineTo(x + s * 0.7, y + s * 0.69); g.lineTo(x + s * 0.67, y + s * 0.66); g.closePath(); g.fill();
    },
    glitch: function (g, x, y, s, t, o, L) { // quadrado de pixels com separação de cor (vermelho/ciano) e fatias que pulam
      fillBg(g, x, y, s, L);
      var step = Math.floor(t / 120), burst = hash(step + o.seed) > 0.62, jx = burst ? (hash(step * 3 + o.seed) - 0.5) * s * 0.08 : 0;
      var P = [[0,0,1,0,0],[0,1,1,1,0],[1,1,0,1,1],[0,1,1,1,0],[0,0,1,0,0]], u = s * 0.12, ox = x + s / 2 - u * 2.5, oy = y + s / 2 - u * 2.5; // diamante de pixels
      function px(dx, col) { g.fillStyle = col; for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) if (P[r][c]) g.fillRect(ox + c * u + dx, oy + r * u, u * 0.86, u * 0.86); }
      px(-s * 0.035 + jx, '#ff2a6a'); px(s * 0.035 - jx, '#2affff');
      px(jx * 0.3, '#ffffff');
      if (burst) for (var i = 0; i < 2; i++) { var sy = y + s * (0.2 + 0.6 * hash(step * 11 + i)), dx = (hash(step * 7 + i) - 0.5) * s * 0.3;
        g.fillStyle = i ? 'rgba(127,252,255,.7)' : 'rgba(255,255,255,.6)'; g.fillRect(x + dx, sy, s, lw(s, 0.05)); }
      g.fillStyle = 'rgba(40,0,60,.12)'; for (var l = 0; l < s; l += lw(s, 0.1)) g.fillRect(x, y + l, s, lw(s, 0.02));
    },
    dragon: function (g, x, y, s, t, o, L) { // 3 escamas por fileira, grandes, com brilho dourado que atravessa
      g.fillStyle = '#2a0508'; g.fillRect(x, y, s, s);
      var n = 3, w = s / n, sweep = ((t / 1900 + o.seed * 0.17) % 1.8) - 0.4;
      for (var r = n + 3; r >= -1; r--) for (var c = -1; c <= n; c++) {
        var cx = x + (c + 0.5 + (r % 2 ? 0.5 : 0)) * w, cy = y + r * w * 0.5 - w * 0.35;
        var d = (c / n + r / (n + 2)) / 2, heat = Math.max(0, 1 - Math.abs(d - sweep) * 3);
        var gr = g.createLinearGradient(cx, cy, cx, cy + w * 0.85);
        gr.addColorStop(0, 'rgb(' + Math.round(235 + 20 * heat) + ',' + Math.round(80 + 140 * heat) + ',' + Math.round(50 + 60 * heat) + ')');
        gr.addColorStop(0.6, 'rgb(' + Math.round(170 + 50 * heat) + ',' + Math.round(25 + 50 * heat) + ',30)');
        gr.addColorStop(1, '#5a0a12');
        g.beginPath(); g.moveTo(cx - w * 0.52, cy); g.bezierCurveTo(cx - w * 0.54, cy + w * 0.55, cx - w * 0.2, cy + w * 0.84, cx, cy + w * 0.9); g.bezierCurveTo(cx + w * 0.2, cy + w * 0.84, cx + w * 0.54, cy + w * 0.55, cx + w * 0.52, cy); g.closePath();
        g.fillStyle = gr; g.fill(); g.lineWidth = lw(s, 0.028); g.strokeStyle = '#2a0508'; g.stroke();
        g.strokeStyle = 'rgba(255,214,120,' + (0.35 + 0.65 * heat).toFixed(2) + ')'; g.lineWidth = lw(s, 0.022);
        g.beginPath(); g.moveTo(cx - w * 0.3, cy + w * 0.18); g.quadraticCurveTo(cx - w * 0.28, cy + w * 0.55, cx, cy + w * 0.66); g.stroke();
      }
      if (!o.lite) for (var e = 0; e < 3; e++) { var life = ((t / 1500 + hash(e + o.seed)) % 1), es = lw(s, 0.045 * (1 - life));
        g.fillStyle = 'rgba(255,' + Math.round(170 + 80 * (1 - life)) + ',70,' + (1 - life).toFixed(2) + ')'; g.fillRect(x + s * (0.2 + 0.6 * hash(e * 5 + 1)) + Math.sin(life * 6 + e) * s * 0.04, y + s * (1 - life), es, es); }
    },
    plasma: function (g, x, y, s, t, o, L) { // esfera elétrica grande no centro + 3 raios grossos
      var cx = x + s / 2, cy = y + s / 2;
      var bg = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.75); bg.addColorStop(0, L.top); bg.addColorStop(1, L.bot); g.fillStyle = bg; g.fillRect(x, y, s, s);
      g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
      var step = Math.floor(t / 85);
      for (var b = 0; b < 3; b++) {
        var a = hash(step * 13 + b + o.seed) * TAU, len = s * 0.5;
        g.beginPath(); g.moveTo(cx, cy);
        for (var k = 1; k <= 4; k++) { var f = k / 4, j = (hash(step * 31 + b * 7 + k) - 0.5) * s * 0.2; g.lineTo(cx + Math.cos(a) * len * f + Math.cos(a + 1.57) * j, cy + Math.sin(a) * len * f + Math.sin(a + 1.57) * j); }
        g.strokeStyle = 'rgba(120,200,255,.55)'; g.lineWidth = lw(s, 0.09); g.stroke();
        g.strokeStyle = '#ffffff'; g.lineWidth = lw(s, 0.03); g.stroke();
      }
      var pr = s * (0.17 + 0.015 * Math.sin(t / 110));
      var core = g.createRadialGradient(cx, cy, 0, cx, cy, pr * 1.6); core.addColorStop(0, '#ffffff'); core.addColorStop(0.25, 'rgba(190,240,255,.9)'); core.addColorStop(0.55, 'rgba(90,140,255,.4)'); core.addColorStop(1, 'rgba(60,80,255,0)');
      g.fillStyle = core; g.beginPath(); g.arc(cx, cy, pr * 1.6, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
    },
    eye: function (g, x, y, s, t, o, L) { // olho de dragão grande, pálpebra amendoada, íris dourada que segue a peça
      fillBg(g, x, y, s, L);
      var cx = x + s / 2, cy = y + s / 2, rx = s * 0.42, ry = s * 0.3;
      var cyc = (t / 1000 + o.seed * 0.7) % 4, open = cyc < 0.18 ? Math.abs(cyc - 0.09) / 0.09 : 1, oy = ry * Math.max(0.06, open);
      function lid() { g.beginPath(); g.moveTo(cx - rx, cy); g.quadraticCurveTo(cx, cy - oy * 2, cx + rx, cy); g.quadraticCurveTo(cx, cy + oy * 2, cx - rx, cy); g.closePath(); }
      g.save(); lid(); g.clip();
      var sc = g.createRadialGradient(cx, cy - ry * 0.2, 0, cx, cy, rx); sc.addColorStop(0, '#fff7e8'); sc.addColorStop(1, '#e6b98a'); g.fillStyle = sc; g.fillRect(x, y, s, s);
      var lx = Math.sin(t / 1300 + o.seed) * 0.6, ly = Math.cos(t / 1700 + o.seed) * 0.4;
      if (o.look) { var dx = o.look.x - cx, dy = o.look.y - cy, dd = Math.sqrt(dx * dx + dy * dy) || 1; lx = dx / dd; ly = dy / dd; }
      var ix = cx + lx * rx * 0.35, iy = cy + ly * ry * 0.3, ir = s * 0.2;
      var iris = g.createRadialGradient(ix, iy, 0, ix, iy, ir); iris.addColorStop(0, '#fff07a'); iris.addColorStop(0.5, '#ffa21a'); iris.addColorStop(1, '#8a2a00');
      g.fillStyle = iris; g.beginPath(); g.arc(ix, iy, ir, 0, TAU); g.fill();
      g.fillStyle = '#120400'; g.beginPath(); g.ellipse(ix, iy, ir * 0.24, ir * 0.82, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ix - ir * 0.38, iy - ir * 0.38, ir * 0.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(40,0,40,.35)'; g.fillRect(x, cy - oy * 2, s, oy * 0.55); // sombra da pálpebra de cima
      g.restore();
      g.strokeStyle = '#1a0526'; g.lineWidth = lw(s, 0.05); lid(); g.stroke();
    },
    portal: function (g, x, y, s, t, o, L) { // 3 braços grossos em espiral girando para o centro brilhante
      var cx = x + s / 2, cy = y + s / 2, rot = -(t / 800 + o.seed);
      var bg = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.75); bg.addColorStop(0, L.top); bg.addColorStop(1, L.bot); g.fillStyle = bg; g.fillRect(x, y, s, s);
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (var a = 0; a < 3; a++) {
        var base = rot + a * TAU / 3, seg = o.lite ? 8 : 14;
        for (var k = 0; k < seg; k++) {
          var f0 = k / seg, f1 = (k + 1) / seg, a0 = base + f0 * 3.2, a1 = base + f1 * 3.2, r0 = s * (0.08 + 0.46 * f0), r1 = s * (0.08 + 0.46 * f1);
          g.strokeStyle = a % 2 ? 'rgba(230,160,255,' + (0.95 - f0 * 0.75).toFixed(2) + ')' : 'rgba(120,235,255,' + (0.95 - f0 * 0.75).toFixed(2) + ')';
          g.lineWidth = lw(s, 0.12 * (1 - f0) + 0.025);
          g.beginPath(); g.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0); g.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1); g.stroke();
        }
      }
      var core = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.22); core.addColorStop(0, '#ffffff'); core.addColorStop(0.45, 'rgba(210,180,255,.85)'); core.addColorStop(1, 'rgba(120,60,255,0)');
      g.fillStyle = core; g.beginPath(); g.arc(cx, cy, s * 0.22 * (1 + 0.08 * Math.sin(t / 300)), 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
    },
    holo: function (g, x, y, s, t, o, L) { // cubo de luz grosso girando sobre grade, com brilho em volta
      fillBg(g, x, y, s, L);
      g.strokeStyle = 'rgba(125,255,240,.12)'; g.lineWidth = lw(s, 0.015);
      for (var l = 1; l < 4; l++) { g.beginPath(); g.moveTo(x + s * l / 4, y); g.lineTo(x + s * l / 4, y + s); g.moveTo(x, y + s * l / 4); g.lineTo(x + s, y + s * l / 4); g.stroke(); }
      var cx = x + s / 2, cy = y + s / 2, a = t / 1500 + o.seed, b = 0.55 + 0.2 * Math.sin(t / 2300), z = s * 0.19;
      var V = [], E = [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]];
      for (var i = 0; i < 8; i++) {
        var px = (i & 1 ? 1 : -1) * z, py = (i & 2 ? 1 : -1) * z, pz = (i & 4 ? 1 : -1) * z;
        var x1 = px * Math.cos(a) - pz * Math.sin(a), z1 = px * Math.sin(a) + pz * Math.cos(a);
        var y1 = py * Math.cos(b) - z1 * Math.sin(b), z2 = py * Math.sin(b) + z1 * Math.cos(b), k = 1 + z2 / (s * 1.6);
        V.push([cx + x1 * k, cy + y1 * k]);
      }
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      [[lw(s, 0.11), 'rgba(80,255,230,.25)'], [lw(s, 0.045), '#b8fff6']].forEach(function (p) {
        g.lineWidth = p[0]; g.strokeStyle = p[1]; g.beginPath();
        E.forEach(function (e) { g.moveTo(V[e[0]][0], V[e[0]][1]); g.lineTo(V[e[1]][0], V[e[1]][1]); }); g.stroke();
      });
      g.globalCompositeOperation = 'source-over';
      var sl = y + ((t / 14) % (s * 1.2)) - s * 0.1; g.fillStyle = 'rgba(160,255,250,.16)'; g.fillRect(x, sl, s, s * 0.08);
    },
    galaxy: function (g, x, y, s, t, o, L) { // dois braços largos em espiral (rosa e azul) + núcleo + poucas estrelas grandes
      var cx = x + s / 2, cy = y + s / 2;
      var bg = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.75); bg.addColorStop(0, '#4a1a6e'); bg.addColorStop(1, L.bot); g.fillStyle = bg; g.fillRect(x, y, s, s);
      var rot = t / 3500 + o.seed;
      g.save(); g.translate(cx, cy); g.rotate(-0.35); g.scale(1, 0.72);
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (var arm = 0; arm < 2; arm++) {
        var seg = o.lite ? 8 : 16;
        for (var k = 0; k < seg; k++) {
          var f0 = k / seg, f1 = (k + 1) / seg, a0 = rot + arm * Math.PI + f0 * 4.4, a1 = rot + arm * Math.PI + f1 * 4.4, r0 = s * 0.05 + f0 * s * 0.46, r1 = s * 0.05 + f1 * s * 0.46;
          g.strokeStyle = arm ? 'rgba(150,200,255,' + (0.85 - f0 * 0.6).toFixed(2) + ')' : 'rgba(255,150,230,' + (0.85 - f0 * 0.6).toFixed(2) + ')';
          g.lineWidth = lw(s, 0.13 * (1 - f0 * 0.7));
          g.beginPath(); g.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0); g.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1); g.stroke();
        }
      }
      g.restore();
      var core = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.2); core.addColorStop(0, '#fffbe8'); core.addColorStop(0.4, 'rgba(255,220,240,.85)'); core.addColorStop(1, 'rgba(255,160,220,0)');
      g.fillStyle = core; g.beginPath(); g.arc(cx, cy, s * 0.2, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
    },
    blackhole: function (g, x, y, s, t, o, L) { // disco de fogo inclinado + anel de luz + centro preto
      var cx = x + s / 2, cy = y + s / 2, rot = t / 700;
      fillBg(g, x, y, s, L);
      g.save(); g.translate(cx, cy); g.scale(1, 0.36);
      var disk = g.createRadialGradient(0, 0, s * 0.16, 0, 0, s * 0.52);
      disk.addColorStop(0, '#fff6d6'); disk.addColorStop(0.3, '#ffbf4a'); disk.addColorStop(0.7, 'rgba(230,80,20,.75)'); disk.addColorStop(1, 'rgba(140,20,10,0)');
      g.fillStyle = disk; g.beginPath(); g.arc(0, 0, s * 0.52, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = lw(s, 0.04) / 0.36 * 0.5;
      g.beginPath(); g.arc(0, 0, s * 0.33, rot, rot + 1.1); g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.42, -rot * 0.8 + 2, -rot * 0.8 + 2.7); g.stroke();
      g.restore();
      var ring = g.createRadialGradient(cx, cy, s * 0.15, cx, cy, s * 0.26); ring.addColorStop(0, 'rgba(255,236,190,1)'); ring.addColorStop(0.45, 'rgba(255,170,70,.7)'); ring.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = ring; g.beginPath(); g.arc(cx, cy, s * 0.26, 0, TAU); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, s * (0.155 + 0.006 * Math.sin(t / 220)), 0, TAU); g.fill();
      g.save(); g.beginPath(); g.rect(x, cy - s * 0.5, s, s * 0.5); g.clip(); // a frente do disco passa por cima do buraco
      g.translate(cx, cy); g.scale(1, 0.36); g.globalAlpha = 0.9; g.fillStyle = disk;
      g.beginPath(); g.arc(0, 0, s * 0.52, 0.06 * Math.PI, 0.94 * Math.PI); g.arc(0, 0, s * 0.18, 0.94 * Math.PI, 0.06 * Math.PI, true); g.closePath(); g.fill();
      g.restore();
    }
  };

  /* ---------- acabamento de pedra preciosa, igual para todos ---------- */
  function finish(g, x, y, s, t, o, L) {
    var ix = x + s * IN, iy = y + s * IN, iw = s * (1 - 2 * IN), r = s * RAD;
    g.save(); body(g, x, y, s); g.clip();
    var sh = g.createLinearGradient(0, iy, 0, iy + iw); // luz em cima, sombra embaixo (volume)
    sh.addColorStop(0, 'rgba(255,255,255,.30)'); sh.addColorStop(0.42, 'rgba(255,255,255,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.38)');
    g.fillStyle = sh; g.fillRect(ix, iy, iw, iw);
    if (!o.lite) { // brilho que atravessa a cada ~3,5 s
      var k = ((t / 3500 + o.seed * 0.137) % 1) * 2.2 - 0.6;
      if (k > -0.4 && k < 1.4) {
        var gx = ix + iw * k, gl = g.createLinearGradient(gx - iw * 0.3, iy, gx + iw * 0.3, iy + iw * 0.6);
        gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,.42)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gl; g.fillRect(ix, iy, iw, iw);
      }
    }
    g.fillStyle = 'rgba(255,255,255,.5)'; // reflexo no canto de cima, como nos blocos normais
    g.beginPath(); g.ellipse(x + s * 0.3, y + s * 0.22, s * 0.15, s * 0.055, -0.5, 0, TAU); g.fill();
    g.restore();
    g.lineWidth = lw(s, 0.045); g.strokeStyle = L.acc; g.globalAlpha = 0.85; // fio claro por dentro na cor do lendário
    rr(g, ix + s * 0.04, iy + s * 0.04, iw - s * 0.08, iw - s * 0.08, r * 0.75); g.stroke(); g.globalAlpha = 1;
    g.lineWidth = lw(s, 0.04); g.strokeStyle = 'rgba(0,0,0,.65)'; body(g, x, y, s); g.stroke(); // borda escura por fora (destaca no tabuleiro)
    if (!o.lite && s >= 26) for (var i = 0; i < L.stars; i++) { // estrelinhas: quanto mais raro, mais
      var ph = (t / 1600 + i * 0.37 + hash(i + o.seed * 7)) % 1, a = Math.sin(ph * Math.PI);
      if (a < 0.05) continue;
      var sx = x + s * (0.2 + 0.62 * hash(i * 13 + o.seed)), sy = y + s * (0.18 + 0.62 * hash(i * 29 + o.seed + 1)), sz = s * 0.09 * a;
      g.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
      g.beginPath(); g.moveTo(sx, sy - sz); g.quadraticCurveTo(sx, sy, sx + sz, sy); g.quadraticCurveTo(sx, sy, sx, sy + sz); g.quadraticCurveTo(sx, sy, sx - sz, sy); g.quadraticCurveTo(sx, sy, sx, sy - sz); g.fill();
    }
  }

  function draw(g, id, x, y, s, t, opts) {
    var o = opts || {}; o.seed = o.seed || 0; t = t || 0;
    var fn = DRAW[id], L = LOOK[id]; if (!fn || !L) return;
    g.save(); body(g, x, y, s); g.clip(); fn(g, x, y, s, t, o, L); g.restore();
    g.save(); finish(g, x, y, s, t, o, L); g.restore();
  }
  /* ---------- v1.31 (pedido do dono): os lendários viraram MEDALHAS — prêmios de coleção, fora do jogo ----------
     drawMedal(g, id, x, y, s, t, opts) desenha a medalha num quadrado de lado s: fita em V em cima (cores do lendário),
     aro de metal com sulcos, o desenho do lendário dentro do círculo, brilho e estrelinhas de raridade.
     opts.locked = medalha apagada (cinza, ainda não conquistada). */
  var RIBBON = {
    aurora: ['#2fd39a', '#1b6e8a'], glitch: ['#ff3fd2', '#3be8ff'], dragon: ['#d8342a', '#ffcf5a'], plasma: ['#2a4dff', '#a8f0ff'], eye: ['#7d2bd6', '#ffb13d'],
    portal: ['#5a1fd6', '#e3a8ff'], holo: ['#0f8a9e', '#7dfff0'], galaxy: ['#c43da8', '#7aa8ff'], blackhole: ['#1a1a1a', '#ffc061']
  };
  function drawMedal(g, id, x, y, s, t, opts) {
    var o = opts || {}; o.seed = o.seed || 0; t = t || 0;
    var fn = DRAW[id], L = LOOK[id], R = RIBBON[id]; if (!fn || !L) return;
    var cx = x + s / 2, cy = y + s * 0.6, rOut = s * 0.36, rIn = s * 0.27, lock = !!o.locked;
    g.save();
    // fita em V (duas tiras listradas), atrás da medalha
    [[-1, 0], [1, 1]].forEach(function (sd) {
      var x0 = cx + sd[0] * s * 0.2, x1 = cx + sd[0] * s * 0.04, w = s * 0.17;
      g.beginPath(); g.moveTo(x0 - w / 2, y + s * 0.02); g.lineTo(x0 + w / 2, y + s * 0.02); g.lineTo(x1 + w / 2, cy - rOut * 0.4); g.lineTo(x1 - w / 2, cy - rOut * 0.4); g.closePath();
      var rg = g.createLinearGradient(x0 - w / 2, 0, x0 + w / 2, 0);
      var c1 = lock ? '#4a4f63' : R[sd[1]], c2 = lock ? '#5c6278' : R[1 - sd[1]];
      rg.addColorStop(0, c1); rg.addColorStop(0.33, c1); rg.addColorStop(0.34, c2); rg.addColorStop(0.66, c2); rg.addColorStop(0.67, c1); rg.addColorStop(1, c1);
      g.fillStyle = rg; g.fill(); g.lineWidth = lw(s, 0.018); g.strokeStyle = 'rgba(0,0,0,.45)'; g.stroke();
    });
    // aro de metal com sulcos (dourado; apagado se ainda não conquistada)
    var teeth = 28; g.beginPath();
    for (var k = 0; k <= teeth * 2; k++) { var a = k / (teeth * 2) * TAU, rr2 = k % 2 ? rOut : rOut * 0.94; g.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); }
    g.closePath();
    var mg = g.createLinearGradient(cx - rOut, cy - rOut, cx + rOut, cy + rOut);
    if (lock) { mg.addColorStop(0, '#8a90a6'); mg.addColorStop(1, '#3d4152'); } else { mg.addColorStop(0, '#fff3b0'); mg.addColorStop(0.35, '#ffcf4a'); mg.addColorStop(0.7, '#c8891a'); mg.addColorStop(1, '#8a5a0a'); }
    g.fillStyle = mg; g.fill(); g.lineWidth = lw(s, 0.02); g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke();
    g.beginPath(); g.arc(cx, cy, rIn + s * 0.035, 0, TAU); g.fillStyle = lock ? '#2b2f3d' : '#7a4a08'; g.fill(); // degrau do aro
    // desenho do lendário dentro do círculo
    g.save(); g.beginPath(); g.arc(cx, cy, rIn, 0, TAU); g.clip();
    var bx = cx - rIn * 1.12, by = cy - rIn * 1.12, bs = rIn * 2.24;
    if (lock) { g.fillStyle = '#1c1f2b'; g.fillRect(bx, by, bs, bs); }
    else { fn(g, bx, by, bs, t, o, L); var sh = g.createLinearGradient(0, cy - rIn, 0, cy + rIn); sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = sh; g.fillRect(bx, by, bs, bs);
      if (!o.lite) { var kk = ((t / 3800 + o.seed * 0.137) % 1) * 2.4 - 0.7, gx = cx - rIn + rIn * 2 * kk, gl = g.createLinearGradient(gx - rIn * 0.6, cy - rIn, gx + rIn * 0.6, cy + rIn);
        gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,.45)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(bx, by, bs, bs); } }
    g.restore();
    g.beginPath(); g.arc(cx, cy, rIn, 0, TAU); g.lineWidth = lw(s, 0.022); g.strokeStyle = lock ? '#6b7088' : L.acc; g.stroke();
    if (lock) { g.fillStyle = '#8a90a6'; g.font = '900 ' + Math.round(s * 0.22) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', cx, cy + s * 0.01); }
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(cx - rOut * 0.42, cy - rOut * 0.55, rOut * 0.28, rOut * 0.1, -0.6, 0, TAU); g.fill(); // reflexo no metal
    if (!lock && !o.lite) for (var i = 0; i < L.stars + 1; i++) { // estrelinhas em volta: quanto mais rara, mais
      var ph = (t / 1500 + i * 0.29 + hash(i + o.seed * 7)) % 1, al = Math.sin(ph * Math.PI); if (al < 0.05) continue;
      var an = -2.2 + i * 1.15 + hash(i * 3) * 0.4, sx = cx + Math.cos(an) * rOut * 1.08, sy = cy + Math.sin(an) * rOut * 1.08, sz = s * 0.06 * al;
      g.fillStyle = 'rgba(255,250,220,' + al.toFixed(2) + ')';
      g.beginPath(); g.moveTo(sx, sy - sz); g.quadraticCurveTo(sx, sy, sx + sz, sy); g.quadraticCurveTo(sx, sy, sx, sy + sz); g.quadraticCurveTo(sx, sy, sx - sz, sy); g.quadraticCurveTo(sx, sy, sx, sy - sz); g.fill();
    }
    g.restore();
  }
  function byId(id) { return LIST.filter(function (l) { return l.id === id; })[0] || null; }

  var api = { LIST: LIST, draw: draw, drawMedal: drawMedal, byId: byId, LOOK: LOOK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZLegend = api;
})(this);
