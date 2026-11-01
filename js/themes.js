/* Kablox — temas visuais (afetam só a aparência, nunca as regras) */
(function (root) {
  'use strict';

  /* v1.12: 8 identidades visuais. Não dependem de pontos: o jogo troca entre elas em momentos
   * especiais da partida (ver js/surprise.js → decideTheme). Cada uma muda fundo, tabuleiro, grade,
   * cores e acabamento dos blocos, sombras/reflexos, peças da bandeja, cores da interface e a música.
   * finish: acabamento dos blocos (desenhado em drawBlock); vivid: false mantém a paleta como está (tons suaves). */
  var THEMES = [
    {
      id: 'classico', name: 'Clássico', finish: 'bevel', vivid: true,
      msg: 'Azul-claro e blocos coloridos.',
      bg: ['#1f5fb8', '#0a1c45'], decor: 'radial-gradient(90% 50% at 50% -10%, rgba(120,200,255,.35), transparent 70%)',
      board: '#1c3b6e', empty: '#24508e', grid: '#1a3766', emptyEdge: '#2f5fa3',
      accent: '#ffcc33', accentInk: '#1a1a14', themeColor: '#0a1c45',
      ui: { text: '#f2f5ff', muted: 'rgba(242,245,255,.8)', panel: 'rgba(0,0,0,.3)', edge: 'rgba(255,255,255,.12)', shadow: 'rgba(0,0,0,.45)' },
      highlight: 'rgba(255,255,255,.25)',
      palette: ['#ff4d5a', '#ffb400', '#2fd27a', '#2f9bff', '#9b5cff', '#ff6fc0', '#ff8a2b'],
      music: { root: 57, scale: [0, 2, 4, 7, 9] }
    },
    {
      id: 'verdeagua', name: 'Verde-água', finish: 'soft', vivid: false,
      msg: 'Menta clara e turquesa.',
      bg: ['#14706a', '#06282a'], decor: 'radial-gradient(70% 40% at 20% 0%, rgba(120,255,225,.3), transparent 70%)',
      board: '#eefcf7', empty: '#d6f3ea', grid: '#c4ebdf', emptyEdge: '#b6e2d4',
      accent: '#ff8a5c', accentInk: '#2a1208', themeColor: '#06282a',
      ui: { text: '#f2f5ff', muted: 'rgba(242,245,255,.8)', panel: 'rgba(0,0,0,.3)', edge: 'rgba(255,255,255,.12)', shadow: 'rgba(0,0,0,.45)' },
      highlight: 'rgba(20,150,140,.2)',
      palette: ['#16b3a6', '#2bcfc6', '#0f8f88', '#5fdccf', '#0b7480', '#82e8da', '#36b89c'],
      music: { root: 60, scale: [0, 2, 4, 7, 9] }
    },
    {
      id: 'brancoazul', name: 'Branco e azul', finish: 'cube', vivid: false,
      msg: 'Branco limpo e azul em 3D.',
      bg: ['#3a5590', '#121d3c'], decor: 'radial-gradient(80% 45% at 50% -5%, rgba(255,255,255,.28), transparent 70%)',
      board: '#f1f5fb', empty: '#dfe8f4', grid: '#cbd8ea', emptyEdge: '#c3d2e6',
      accent: '#4d8dff', accentInk: '#0b1736', themeColor: '#121d3c',
      ui: { text: '#f2f5ff', muted: 'rgba(242,245,255,.8)', panel: 'rgba(0,0,0,.3)', edge: 'rgba(255,255,255,.12)', shadow: 'rgba(0,0,0,.45)' },
      highlight: 'rgba(37,99,235,.18)',
      palette: ['#1e63d6', '#3b82f6', '#1747a6', '#60a5fa', '#2554c7', '#0f3d91', '#7cb4ff'],
      music: { root: 64, scale: [0, 2, 4, 7, 11] }
    },
    {
      id: 'terra', name: 'Marrom e laranja', finish: 'matte', vivid: true,
      msg: 'Tons de terra e laranja.',
      bg: ['#8a4a22', '#2e1508'], decor: 'radial-gradient(80% 50% at 80% 0%, rgba(255,190,110,.35), transparent 70%)',
      board: '#33200f', empty: '#432a16', grid: '#2a1a0c', emptyEdge: '#55361e',
      accent: '#ffb347', accentInk: '#2a1608', themeColor: '#2e1508',
      ui: { text: '#fff6ea', muted: 'rgba(255,246,234,.8)', panel: 'rgba(0,0,0,.22)', edge: 'rgba(255,255,255,.1)', shadow: 'rgba(0,0,0,.35)' },
      highlight: 'rgba(255,200,120,.2)',
      palette: ['#ff8c2b', '#ffd166', '#e85d3f', '#7cc46b', '#4fb3d9', '#c77dff', '#f2e3c6'],
      music: { root: 55, scale: [0, 3, 5, 7, 10] }
    },
    {
      id: 'roxo', name: 'Roxo', finish: 'jewel', vivid: false,
      msg: 'Lilás e violeta.',
      bg: ['#5a2fa0', '#1a0d33'], decor: 'radial-gradient(70% 45% at 70% 0%, rgba(210,170,255,.35), transparent 70%)',
      board: '#2a1747', empty: '#38205e', grid: '#24133e', emptyEdge: '#482b76',
      accent: '#ffcf5c', accentInk: '#2a1747', themeColor: '#1a0d33',
      ui: { text: '#f2f5ff', muted: 'rgba(242,245,255,.8)', panel: 'rgba(0,0,0,.3)', edge: 'rgba(255,255,255,.12)', shadow: 'rgba(0,0,0,.45)' },
      highlight: 'rgba(200,160,255,.22)',
      palette: ['#8e44ff', '#b06bff', '#c04dff', '#d29bff', '#a44de8', '#7b5cff', '#e6ccff'],
      music: { root: 59, scale: [0, 2, 3, 7, 9] }
    },
    {
      id: 'pastel', name: 'Cinza e pastel', finish: 'pastel', vivid: false,
      msg: 'Cinza claro, branco e rosa.',
      bg: ['#4e4f5e', '#1b1c24'], decor: 'radial-gradient(60% 40% at 30% 0%, rgba(255,200,220,.25), transparent 70%)',
      board: '#393a45', empty: '#464754', grid: '#30313a', emptyEdge: '#565766',
      accent: '#ff8fab', accentInk: '#3a0d1a', themeColor: '#1b1c24',
      ui: { text: '#f2f5ff', muted: 'rgba(242,245,255,.8)', panel: 'rgba(0,0,0,.3)', edge: 'rgba(255,255,255,.12)', shadow: 'rgba(0,0,0,.45)' },
      highlight: 'rgba(255,200,220,.22)',
      palette: ['#ffffff', '#ffd3df', '#ffadc4', '#f6e3ea', '#ffc0d3', '#e9e9f2', '#ff97b4'],
      music: { root: 62, scale: [0, 2, 4, 7, 9] }
    },
    {
      id: 'azulintenso', name: 'Azul intenso', finish: 'glow', vivid: false,
      msg: 'Azul profundo e blocos luminosos.',
      bg: ['#0b2c8f', '#04154f'], decor: 'radial-gradient(70% 40% at 50% -5%, rgba(80,200,255,.3), transparent 70%)',
      board: '#060f38', empty: '#0b1c58', grid: '#050c2c', emptyEdge: '#132a78',
      accent: '#38e1ff', accentInk: '#03122e', themeColor: '#04154f',
      ui: { text: '#eaf2ff', muted: 'rgba(234,242,255,.8)', panel: 'rgba(0,0,0,.28)', edge: 'rgba(255,255,255,.1)', shadow: 'rgba(0,0,0,.4)' },
      highlight: 'rgba(80,220,255,.22)',
      palette: ['#38e1ff', '#5b8cff', '#00f5a0', '#ffe14d', '#ff5ec4', '#9d7bff', '#7dfcff'],
      music: { root: 53, scale: [0, 2, 5, 7, 10] }
    },
    {
      id: 'rosa', name: 'Rosa', finish: 'candy', vivid: false,
      msg: 'Rosa em todas as tonalidades.',
      bg: ['#9a2462', '#2e0a1d'], decor: 'radial-gradient(70% 45% at 30% 0%, rgba(255,160,210,.35), transparent 70%)',
      board: '#5e0f36', empty: '#781c48', grid: '#4f0c2d', emptyEdge: '#8e2a5a',
      accent: '#ff5fa2', accentInk: '#2e0a1d', themeColor: '#2e0a1d',
      ui: { text: '#f2f5ff', muted: 'rgba(242,245,255,.8)', panel: 'rgba(0,0,0,.3)', edge: 'rgba(255,255,255,.12)', shadow: 'rgba(0,0,0,.45)' },
      highlight: 'rgba(255,220,235,.3)',
      palette: ['#ff4f9a', '#ff8abb', '#ff2d8a', '#ffb6d3', '#ff7a9e', '#ff6fae', '#ffd5e7'],
      music: { root: 65, scale: [0, 2, 4, 7, 9] }
    }
  ];
  THEMES.forEach(function (t) { t.style = t.finish; });
  var BY_ID = {};
  THEMES.forEach(function (t, i) { BY_ID[t.id] = i; });
  /** Posição de uma identidade pelo id (ids antigos/desconhecidos → Clássico). */
  function indexOfId(id) { return BY_ID[id] != null ? BY_ID[id] : 0; }

  /* ---------- utilitários de cor ---------- */
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(hex, target, t) {
    var a = hexToRgb(hex), b = target === 'white' ? [255, 255, 255] : [0, 0, 0];
    return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(',') + ')';
  }
  function rgba(hex, a) { var c = hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function lighten(h, t) { return mix(h, 'white', t); }
  function darken(h, t) { return mix(h, 'black', t); }

  function poly2(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Desenha um bloco de tamanho s×s em (0,0) com o estilo do tema. */
  function drawBlock(ctx, s, theme, ci) {
    var pal = theme.palette, col = pal[ci % pal.length];
    var g = Math.max(1, s * 0.05), w = s - 2 * g, x = g, y = g, grad;
    ctx.save();
    switch (theme.style) {
      case 'garden':
        grad = ctx.createLinearGradient(0, y, 0, y + w);
        grad.addColorStop(0, lighten(col, 0.22));
        grad.addColorStop(1, darken(col, 0.12));
        rr(ctx, x, y, w, w, s * 0.24); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.fillStyle = darken(col, 0.25); ctx.globalAlpha = 0.45;
        ctx.fillRect(x, y + w * 0.82, w, w * 0.2);
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,.42)';
        ctx.beginPath(); ctx.ellipse(s * 0.34, s * 0.3, s * 0.17, s * 0.075, -0.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = darken(col, 0.3); ctx.lineWidth = Math.max(1, s * 0.03);
        rr(ctx, x, y, w, w, s * 0.24); ctx.stroke();
        break;

      case 'ocean':
        grad = ctx.createLinearGradient(0, y, 0, y + w);
        grad.addColorStop(0, lighten(col, 0.3));
        grad.addColorStop(0.55, col);
        grad.addColorStop(1, darken(col, 0.22));
        rr(ctx, x, y, w, w, s * 0.3); ctx.fillStyle = grad; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.beginPath(); ctx.arc(s * 0.3, s * 0.3, s * 0.095, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.beginPath(); ctx.arc(s * 0.47, s * 0.21, s * 0.045, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath(); ctx.arc(s * 0.5, s * 0.5, w * 0.36, 0.2 * Math.PI, 0.55 * Math.PI); ctx.stroke();
        break;

      case 'night':
        rr(ctx, x, y, w, w, s * 0.2); ctx.fillStyle = darken(col, 0.62); ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.2); ctx.clip();
        ctx.shadowColor = col; ctx.shadowBlur = s * 0.35;
        ctx.strokeStyle = col; ctx.lineWidth = s * 0.12;
        rr(ctx, x, y, w, w, s * 0.2); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = lighten(col, 0.3); ctx.lineWidth = Math.max(1, s * 0.045);
        rr(ctx, x + s * 0.03, y + s * 0.03, w - s * 0.06, w - s * 0.06, s * 0.17); ctx.stroke();
        // estrela de 4 pontas
        var cx = s * 0.5, cy = s * 0.5, R = s * 0.17, r2 = s * 0.05;
        ctx.fillStyle = lighten(col, 0.55);
        ctx.beginPath();
        for (var k = 0; k < 8; k++) {
          var ang = -Math.PI / 2 + k * Math.PI / 4, rad = k % 2 ? r2 : R;
          ctx.lineTo(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
        }
        ctx.closePath(); ctx.fill();
        break;

      case 'crystal':
        var b = w * 0.22, x2 = x + w, y2 = y + w;
        function poly(pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
        poly([x, y, x2, y, x2 - b, y + b, x + b, y + b], lighten(col, 0.45));
        poly([x, y, x + b, y + b, x + b, y2 - b, x, y2], lighten(col, 0.18));
        poly([x2, y, x2, y2, x2 - b, y2 - b, x2 - b, y + b], darken(col, 0.18));
        poly([x, y2, x + b, y2 - b, x2 - b, y2 - b, x2, y2], darken(col, 0.35));
        grad = ctx.createLinearGradient(x + b, y + b, x2 - b, y2 - b);
        grad.addColorStop(0, lighten(col, 0.12)); grad.addColorStop(1, darken(col, 0.05));
        ctx.fillStyle = grad; ctx.fillRect(x + b, y + b, w - 2 * b, w - 2 * b);
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = Math.max(1, s * 0.035);
        ctx.beginPath(); ctx.moveTo(x + b * 1.3, y2 - b * 1.6); ctx.lineTo(x + b * 2.2, y + b * 1.3); ctx.stroke();
        break;

      case 'soft': { // verde-água: cantos bem redondos, fosco suave
        grad = ctx.createLinearGradient(0, y, 0, y + w); grad.addColorStop(0, lighten(col, 0.25)); grad.addColorStop(1, darken(col, 0.06));
        rr(ctx, x, y, w, w, s * 0.28); ctx.fillStyle = grad; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(ctx, x + w * 0.12, y + w * 0.08, w * 0.76, w * 0.28, s * 0.14); ctx.fill();
        rr(ctx, x, y, w, w, s * 0.28); ctx.strokeStyle = darken(col, 0.18); ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
        break;
      }
      case 'cube': { // branco e azul: cubo em 3D (topo claro, lateral escura, face com brilho)
        var dz = w * 0.16;
        ctx.fillStyle = darken(col, 0.35); poly2(ctx, [x + w, y + dz, x + w, y + w, x + dz, y + w, x + w - dz, y + w - dz]);
        ctx.fillStyle = darken(col, 0.2); poly2(ctx, [x + dz, y + w, x + w - dz, y + w - dz, x + w - dz, y + w - dz, x, y + w - dz]);
        grad = ctx.createLinearGradient(x, y, x + w - dz, y + w - dz); grad.addColorStop(0, lighten(col, 0.35)); grad.addColorStop(1, col);
        ctx.fillStyle = grad; ctx.fillRect(x, y, w - dz, w - dz);
        ctx.fillStyle = 'rgba(255,255,255,.45)'; poly2(ctx, [x, y, x + (w - dz) * 0.6, y, x, y + (w - dz) * 0.6]);
        ctx.strokeStyle = darken(col, 0.45); ctx.lineWidth = Math.max(1, s * 0.025); ctx.strokeRect(x, y, w - dz, w - dz);
        break;
      }
      case 'matte': { // marrom e laranja: fosco, chanfro baixo, sombra interna embaixo
        rr(ctx, x, y, w, w, s * 0.1); ctx.fillStyle = col; ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.1); ctx.clip();
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x, y + w * 0.78, w, w * 0.22);
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x, y, w, w * 0.12);
        ctx.restore();
        rr(ctx, x, y, w, w, s * 0.1); ctx.strokeStyle = darken(col, 0.45); ctx.lineWidth = Math.max(1, s * 0.04); ctx.stroke();
        break;
      }
      case 'jewel': { // roxo: pedra polida com reflexo e brilho
        grad = ctx.createRadialGradient(x + w * 0.35, y + w * 0.3, w * 0.05, x + w * 0.5, y + w * 0.5, w * 0.75);
        grad.addColorStop(0, lighten(col, 0.5)); grad.addColorStop(0.5, col); grad.addColorStop(1, darken(col, 0.35));
        rr(ctx, x, y, w, w, s * 0.18); ctx.fillStyle = grad; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x + w * 0.32, y + w * 0.24, w * 0.18, w * 0.08, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + w * 0.74, y + w * 0.7, s * 0.035, 0, Math.PI * 2); ctx.fill();
        rr(ctx, x, y, w, w, s * 0.18); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
        break;
      }
      case 'pastel': { // cinza e pastel: macio, borda fina, sombra suave
        rr(ctx, x, y + w * 0.05, w, w * 0.95, s * 0.22); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
        grad = ctx.createLinearGradient(0, y, 0, y + w); grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, col);
        rr(ctx, x, y, w, w * 0.94, s * 0.22); ctx.fillStyle = grad; ctx.fill();
        rr(ctx, x, y, w, w * 0.94, s * 0.22); ctx.strokeStyle = 'rgba(120,90,110,.35)'; ctx.lineWidth = Math.max(1, s * 0.025); ctx.stroke();
        break;
      }
      case 'glow': { // azul intenso: núcleo escuro e borda luminosa
        rr(ctx, x, y, w, w, s * 0.16); ctx.fillStyle = darken(col, 0.55); ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.16); ctx.clip();
        grad = ctx.createRadialGradient(x + w / 2, y + w / 2, 0, x + w / 2, y + w / 2, w * 0.7);
        grad.addColorStop(0, rgba(col, 0.75)); grad.addColorStop(1, rgba(col, 0.05)); ctx.fillStyle = grad; ctx.fillRect(x, y, w, w);
        ctx.restore();
        ctx.shadowColor = col; ctx.shadowBlur = s * 0.35; ctx.strokeStyle = lighten(col, 0.35); ctx.lineWidth = Math.max(1.5, s * 0.07);
        rr(ctx, x + s * 0.04, y + s * 0.04, w - s * 0.08, w - s * 0.08, s * 0.13); ctx.stroke();
        break;
      }
      case 'candy': { // rosa: bala brilhante, bem redonda
        grad = ctx.createLinearGradient(0, y, 0, y + w); grad.addColorStop(0, lighten(col, 0.35)); grad.addColorStop(1, darken(col, 0.12));
        rr(ctx, x, y, w, w, s * 0.34); ctx.fillStyle = grad; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x + w * 0.38, y + w * 0.22, w * 0.24, w * 0.09, -0.3, 0, Math.PI * 2); ctx.fill();
        rr(ctx, x, y, w, w, s * 0.34); ctx.strokeStyle = darken(col, 0.3); ctx.lineWidth = Math.max(1, s * 0.035); ctx.stroke();
        break;
      }
      case 'bevel':
      case 'classic': {
        // bloco clássico: face lisa com chanfro fino (claro em cima/esquerda, escuro embaixo/direita)
        var bv = w * 0.13, cx2 = x + w, cy2 = y + w;
        var cpoly = function (pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
        ctx.fillStyle = darken(col, 0.5); ctx.fillRect(x - g * 0.5, y - g * 0.5, w + g, w + g);
        cpoly([x, y, cx2, y, cx2 - bv, y + bv, x + bv, y + bv], lighten(col, 0.38));
        cpoly([x, y, x + bv, y + bv, x + bv, cy2 - bv, x, cy2], lighten(col, 0.16));
        cpoly([cx2, y, cx2, cy2, cx2 - bv, cy2 - bv, cx2 - bv, y + bv], darken(col, 0.2));
        cpoly([x, cy2, x + bv, cy2 - bv, cx2 - bv, cy2 - bv, cx2, cy2], darken(col, 0.36));
        grad = ctx.createLinearGradient(0, y + bv, 0, cy2 - bv);
        grad.addColorStop(0, lighten(col, 0.06)); grad.addColorStop(1, darken(col, 0.06));
        ctx.fillStyle = grad; ctx.fillRect(x + bv, y + bv, w - 2 * bv, w - 2 * bv);
        break;
      }

      case 'aurora':
      default:
        var col2 = pal[(ci + 2) % pal.length];
        grad = ctx.createLinearGradient(x, y, x + w, y + w);
        grad.addColorStop(0, lighten(col, 0.15));
        grad.addColorStop(1, darken(col2, 0.08));
        rr(ctx, x, y, w, w, s * 0.26); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.26); ctx.clip();
        ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x, y + w * 0.55);
        ctx.bezierCurveTo(x + w * 0.3, y + w * 0.25, x + w * 0.6, y + w * 0.65, x + w, y + w * 0.3);
        ctx.lineTo(x + w, y + w * 0.42);
        ctx.bezierCurveTo(x + w * 0.6, y + w * 0.78, x + w * 0.3, y + w * 0.38, x, y + w * 0.68);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = Math.max(1, s * 0.03);
        rr(ctx, x + s * 0.02, y + s * 0.02, w - s * 0.04, w - s * 0.04, s * 0.24); ctx.stroke();
        break;
    }
    ctx.restore();
  }

  /** Versão mais saturada de uma cor (usada pelos blocos clássicos). */
  function vivid(hex) {
    var c = hexToRgb(hex).map(function (v) { return v / 255; });
    var max = Math.max.apply(null, c), min = Math.min.apply(null, c), h = 0, l = (max + min) / 2, d = max - min;
    if (d) {
      if (max === c[0]) h = ((c[1] - c[2]) / d) % 6; else if (max === c[1]) h = (c[2] - c[0]) / d + 2; else h = (c[0] - c[1]) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    var origSat = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    var pale = l > 0.82 || origSat < 0.35; // cores quase brancas continuam claras
    var sat = pale ? 0.45 : 0.82, lig = pale ? 0.8 : Math.min(0.6, Math.max(0.5, l - 0.08));
    var k = function (n) { return (n + h / 30) % 12; }, a2 = sat * Math.min(lig, 1 - lig);
    var f = function (n) { return lig - a2 * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    return '#' + [f(0), f(8), f(4)].map(function (v) { return ('0' + Math.round(v * 255).toString(16)).slice(-2); }).join('');
  }

  var classicCache = {};
  /** Tema com o mesmo jeito do original, mas blocos clássicos e cores vivas. */
  function classic(theme) {
    if (!classicCache[theme.id]) {
      // o estilo "Clássico" usa o acabamento e as cores de cada identidade (paletas suaves ficam como estão)
      classicCache[theme.id] = { id: theme.id + '-classic', style: theme.finish || 'classic', palette: theme.vivid === false ? theme.palette.slice() : theme.palette.map(vivid) };
    }
    return classicCache[theme.id];
  }

  root.MZThemes = {
    classic: classic, vivid: vivid,
    THEMES: THEMES, indexOfId: indexOfId, drawBlock: drawBlock, roundRect: rr,
    lighten: lighten, darken: darken, rgba: rgba
  };
})(this);
