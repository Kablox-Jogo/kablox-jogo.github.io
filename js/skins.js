/* Kablox — estilos de blocos: desenho, animação viva e quebra de cada estilo.
 * As cores vêm da paleta do tema atual (versão viva), então os temas continuam mudando as cores.
 */
(function (root) {
  'use strict';
  var T = root.MZThemes;

  var LIST = [
    { id: 'classic', name: 'Clássico' },
    { id: 'theme', name: 'Do tema' },
    { id: 'ice', name: 'Gelo' },
    { id: 'stone', name: 'Pedra' },
    { id: 'fur', name: 'Pelúcia' },
    { id: 'jelly', name: 'Gelatina' },
    { id: 'neon', name: 'Neon' },
    { id: 'wood', name: 'Madeira' },
    { id: 'candy', name: 'Doce' },
    { id: 'pixel', name: 'Pixel' },
    // v1.8: estilos "premium"
    { id: 'glossy', name: 'Brilho' },
    { id: 'crystal', name: 'Cristal' },
    { id: 'metal', name: 'Metálico' },
    { id: 'gradient', name: 'Gradiente' },
    { id: 'galaxy', name: 'Galáxia' },
    { id: 'ocean', name: 'Oceano' },
    { id: 'cheese', name: 'Queijo' },
    { id: 'wool', name: 'Lã' },
    // v1.10: estilos raros — aparecem primeiro nas transformações surpresa
    { id: 'energy', name: 'Energia', rare: true },
    { id: 'rainbow', name: 'Arco-íris', rare: true },
    { id: 'holo', name: 'Holográfico', rare: true },
    // v1.11: mais estilos para descobrir nas transformações
    { id: 'lava', name: 'Lava', rare: true },
    { id: 'gold', name: 'Ouro', rare: true },
    { id: 'marble', name: 'Mármore', rare: true },
    { id: 'circuit', name: 'Circuito', rare: true },
    { id: 'bubble', name: 'Bolha', rare: true },
    { id: 'stained', name: 'Vitral', rare: true }
  ];
  var LIVE = { fur: true, jelly: true };          // têm movimento contínuo no tabuleiro
  var BREAK_MS = { ice: 460, stone: 620, fur: 460, jelly: 460, neon: 400, wood: 520, candy: 480, pixel: 520, crystal: 440,
    wool: 560, cheese: 460, metal: 420, bubble: 360, ocean: 460 }; // v1.20: quebras próprias de Lã, Queijo, Metálico, Bolha, Oceano

  /* ---------------- utilitários ---------------- */
  /** v1.20: aceita '#rrggbb' e 'rgb(r,g,b)' (T.lighten/T.darken devolvem rgb()). Antes, rgb() virava NaN e a cor era
   *  ignorada em silêncio pelo canvas — vários detalhes (pintas, ondas, veios) nunca apareciam. */
  function hex2rgb(h) {
    var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(h);
    if (m) return [+m[1], +m[2], +m[3]];
    h = h.replace('#', ''); var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    var x = hex2rgb(a), y = hex2rgb(b);
    return '#' + x.map(function (v, i) { return ('0' + Math.round(v + (y[i] - v) * t).toString(16)).slice(-2); }).join('');
  }
  function rgba(h, a) { var c = hex2rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function rnd(seed, i) { var x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); }
  function colorOf(theme, ci) { var p = T.classic(theme).palette; return p[ci % p.length]; }
  var rr = T.roundRect, L = T.lighten, D = T.darken;

  function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); }

  /* ---------------- desenho estático (sprite) ---------------- */
  function drawBlock(ctx, s, skin, theme, ci) {
    var col = colorOf(theme, ci), g = Math.max(1, s * 0.05), w = s - 2 * g, x = g, y = g, grad, i;
    ctx.save();
    switch (skin) {
      case 'ice': {
        var ice = mix(mix(col, '#9fe6ff', 0.45), '#ffffff', 0.35);
        grad = ctx.createLinearGradient(x, y, x + w, y + w);
        grad.addColorStop(0, L(ice, 0.55)); grad.addColorStop(0.55, ice); grad.addColorStop(1, mix(ice, '#5fb8e8', 0.35));
        rr(ctx, x, y, w, w, s * 0.12); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.12); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, s * 0.035);
        for (i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + w * (0.15 + i * 0.28), y + w); ctx.lineTo(x + w * (0.55 + i * 0.28), y); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,255,255,.4)'; poly(ctx, [x, y, x + w * 0.55, y, x, y + w * 0.55]); ctx.fill();
        ctx.fillStyle = rgba(D(col, 0.1), 0.18); ctx.fillRect(x, y + w * 0.75, w, w * 0.25);
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        [[0.72, 0.3, 0.05], [0.8, 0.45, 0.03], [0.3, 0.72, 0.035]].forEach(function (b) { ctx.beginPath(); ctx.arc(x + w * b[0], y + w * b[1], s * b[2], 0, 7); ctx.fill(); });
        rr(ctx, x, y, w, w, s * 0.12); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(1, s * 0.045); ctx.stroke();
        break;
      }
      case 'stone': {
        var st = mix(col, '#7c7a76', 0.62), seed = ci + 1, j = s * 0.07;
        var pts = [x + j * rnd(seed, 1), y + j * rnd(seed, 2), x + w * 0.5, y + j * 0.4 * rnd(seed, 3), x + w - j * rnd(seed, 4), y + j * rnd(seed, 5),
          x + w - j * 0.4 * rnd(seed, 6), y + w * 0.5, x + w - j * rnd(seed, 7), y + w - j * rnd(seed, 8), x + w * 0.5, y + w - j * 0.4 * rnd(seed, 9),
          x + j * rnd(seed, 10), y + w - j * rnd(seed, 11), x + j * 0.4 * rnd(seed, 12), y + w * 0.5];
        grad = ctx.createLinearGradient(x, y, x + w, y + w);
        grad.addColorStop(0, L(st, 0.22)); grad.addColorStop(1, D(st, 0.25));
        poly(ctx, pts); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); poly(ctx, pts); ctx.clip();
        for (i = 0; i < 26; i++) {
          ctx.fillStyle = i % 2 ? rgba(D(st, 0.45), 0.5) : rgba(L(st, 0.4), 0.45);
          ctx.beginPath(); ctx.arc(x + w * rnd(seed, 20 + i), y + w * rnd(seed, 60 + i), s * (0.012 + 0.025 * rnd(seed, 90 + i)), 0, 7); ctx.fill();
        }
        ctx.strokeStyle = rgba(D(st, 0.5), 0.35); ctx.lineWidth = Math.max(1, s * 0.025);
        ctx.beginPath(); ctx.moveTo(x + w * 0.62, y + w * 0.1); ctx.lineTo(x + w * 0.55, y + w * 0.35); ctx.lineTo(x + w * 0.7, y + w * 0.5); ctx.stroke();
        ctx.restore();
        poly(ctx, pts); ctx.strokeStyle = D(st, 0.45); ctx.lineWidth = Math.max(1, s * 0.04); ctx.stroke();
        ctx.strokeStyle = rgba(L(st, 0.5), 0.6); ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath(); ctx.moveTo(pts[14] + s * 0.03, pts[15]); ctx.lineTo(pts[0] + s * 0.03, pts[1] + s * 0.03); ctx.lineTo(pts[4], pts[5] + s * 0.03); ctx.stroke();
        break;
      }
      case 'fur': {
        grad = ctx.createRadialGradient(x + w * 0.4, y + w * 0.35, w * 0.1, x + w * 0.5, y + w * 0.5, w * 0.7);
        grad.addColorStop(0, L(col, 0.25)); grad.addColorStop(1, D(col, 0.2));
        rr(ctx, x + w * 0.04, y + w * 0.08, w * 0.92, w * 0.9, s * 0.32); ctx.fillStyle = grad; ctx.fill();
        // penugem curta na borda
        ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, s * 0.035);
        for (i = 0; i < 34; i++) {
          var a = (i / 34) * Math.PI * 2, rx = w * 0.44, cx = x + w / 2, cy = y + w * 0.53;
          var px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * rx * 0.95, len = s * (0.05 + 0.04 * rnd(ci, i));
          ctx.strokeStyle = i % 3 ? L(col, 0.15) : D(col, 0.15);
          ctx.beginPath(); ctx.moveTo(px - Math.cos(a) * len, py - Math.sin(a) * len); ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); ctx.stroke();
        }
        // v1.16: sem rosto (menos infantil) — só textura de pelo por dentro
        ctx.lineWidth = Math.max(1, s * 0.03);
        for (i = 0; i < 16; i++) {
          var fx = x + w * (0.22 + 0.56 * rnd(ci + 7, i)), fy = y + w * (0.28 + 0.52 * rnd(ci + 11, i)), fa = -0.9 + 0.6 * rnd(ci + 3, i), fl = s * 0.06;
          ctx.strokeStyle = i % 2 ? L(col, 0.22) : D(col, 0.12);
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(fa) * fl, fy + Math.sin(fa) * fl); ctx.stroke();
        }
        break;
      }
      case 'jelly': {
        rr(ctx, x, y + w * 0.04, w, w * 0.96, s * 0.3); ctx.fillStyle = D(col, 0.12); ctx.fill();
        grad = ctx.createLinearGradient(0, y, 0, y + w);
        grad.addColorStop(0, L(col, 0.5)); grad.addColorStop(0.6, L(col, 0.12)); grad.addColorStop(1, col);
        rr(ctx, x + w * 0.05, y, w * 0.9, w * 0.88, s * 0.28); ctx.fillStyle = grad; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.65)';
        ctx.beginPath(); ctx.ellipse(x + w * 0.34, y + w * 0.22, w * 0.2, w * 0.08, -0.25, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        ctx.beginPath(); ctx.arc(x + w * 0.7, y + w * 0.62, s * 0.05, 0, 7); ctx.arc(x + w * 0.6, y + w * 0.74, s * 0.03, 0, 7); ctx.fill();
        break;
      }
      case 'neon': {
        rr(ctx, x, y, w, w, s * 0.16); ctx.fillStyle = D(col, 0.82); ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.16); ctx.clip();
        ctx.shadowColor = col; ctx.shadowBlur = s * 0.22; ctx.strokeStyle = col; ctx.lineWidth = s * 0.12; // v1.20: brilho menor
        rr(ctx, x, y, w, w, s * 0.16); ctx.stroke();
        ctx.restore();
        ctx.shadowColor = col; ctx.shadowBlur = s * 0.1;
        ctx.strokeStyle = L(col, 0.45); ctx.lineWidth = Math.max(1.5, s * 0.06);
        rr(ctx, x + s * 0.12, y + s * 0.12, w - s * 0.24, w - s * 0.24, s * 0.1); ctx.stroke();
        ctx.fillStyle = L(col, 0.75);
        ctx.beginPath(); ctx.arc(x + w / 2, y + w / 2, s * 0.06, 0, 7); ctx.fill();
        break;
      }
      case 'wood': { // v1.20: madeira natural — veios ondulados, um nó discreto, tons variados, borda chanfrada
        var wtones = ['#b9783f', '#a8693a', '#c48a52', '#9b5f34', '#b07a48', '#8e5a32', '#c79a62'];
        var wd = mix(wtones[ci % wtones.length], col, 0.1), rw = s * 0.14;
        grad = ctx.createLinearGradient(x, y, x + w * 0.3, y + w);
        grad.addColorStop(0, L(wd, 0.16)); grad.addColorStop(0.55, wd); grad.addColorStop(1, D(wd, 0.18));
        rr(ctx, x, y, w, w, rw); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, rw); ctx.clip();
        var kx = x + w * (rnd(ci, 3) > 0.5 ? 0.78 : 0.22), ky = y + w * (0.25 + 0.5 * rnd(ci, 4)); // nó perto da borda
        for (i = 0; i < 9; i++) { // veios: linhas longas que contornam o nó
          var gy = y + w * (i + 0.5) / 9, push = (gy - ky) * 0.35;
          ctx.strokeStyle = rgba(D(wd, 0.35 + 0.15 * (i % 2)), 0.22 + 0.12 * rnd(ci, i)); ctx.lineWidth = Math.max(0.8, s * (0.012 + 0.012 * rnd(ci, i + 7)));
          ctx.beginPath(); ctx.moveTo(x - 1, gy);
          ctx.bezierCurveTo(kx - w * 0.25, gy, kx - w * 0.12, gy + push, kx, gy + push * 1.2);
          ctx.bezierCurveTo(kx + w * 0.14, gy + push, kx + w * 0.3, gy, x + w + 1, gy + w * 0.02 * rnd(ci, i)); ctx.stroke();
        }
        ctx.strokeStyle = rgba(D(wd, 0.45), 0.4); ctx.lineWidth = Math.max(0.8, s * 0.014);
        ctx.beginPath(); ctx.ellipse(kx, ky, w * 0.05, w * 0.1, 0.1, 0, 7); ctx.stroke();
        var hl = ctx.createLinearGradient(0, y, 0, y + w * 0.25); hl.addColorStop(0, 'rgba(255,240,215,.28)'); hl.addColorStop(1, 'rgba(255,240,215,0)');
        ctx.fillStyle = hl; ctx.fillRect(x, y, w, w * 0.25);
        ctx.restore();
        rr(ctx, x, y, w, w, rw); ctx.strokeStyle = D(wd, 0.45); ctx.lineWidth = Math.max(1, s * 0.04); ctx.stroke();
        rr(ctx, x + s * 0.05, y + s * 0.05, w - s * 0.1, w - s * 0.1, rw * 0.7); ctx.strokeStyle = 'rgba(255,235,205,.18)'; ctx.lineWidth = Math.max(1, s * 0.02); ctx.stroke();
        break;
      }
      case 'ocean': { // v1.16: vidro marinho — fundo profundo, luz ondulada (cáustica) e uma bolha
        var oc = mix(col, '#0a3a5a', 0.22);
        grad = ctx.createLinearGradient(x, y, x, y + w);
        grad.addColorStop(0, L(oc, 0.28)); grad.addColorStop(1, D(oc, 0.35));
        rr(ctx, x, y, w, w, s * 0.16); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.16); ctx.clip();
        ctx.strokeStyle = rgba(L(col, 0.6), 0.45); ctx.lineWidth = Math.max(1, s * 0.035);
        for (i = 0; i < 2; i++) {
          var oy = y + w * (0.3 + i * 0.28) + w * 0.06 * rnd(ci, i);
          ctx.beginPath(); ctx.moveTo(x - 2, oy);
          ctx.bezierCurveTo(x + w * 0.3, oy - w * 0.12, x + w * 0.6, oy + w * 0.12, x + w + 2, oy - w * 0.02); ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath(); ctx.arc(x + w * 0.74, y + w * 0.26, s * 0.075, 0, 7); ctx.stroke();
        rr(ctx, x, y, w, w, s * 0.16); ctx.strokeStyle = rgba(L(col, 0.45), 0.9); ctx.lineWidth = Math.max(1, s * 0.045); ctx.stroke();
        break;
      }
      case 'cheese': { // v1.20: queijo — amarelo/laranja, casca nas bordas, furinhos 3D de tamanhos variados
        var ctones = ['#ffc83d', '#ffad2e', '#f6d36e', '#ff9b2f', '#ffdf86', '#f2b13f', '#ffc561'];
        var ch = mix(ctones[ci % ctones.length], col, 0.1), r3 = s * 0.16;
        grad = ctx.createLinearGradient(x, y, x, y + w);
        grad.addColorStop(0, L(ch, 0.22)); grad.addColorStop(1, D(ch, 0.12));
        rr(ctx, x, y, w, w, r3); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, r3); ctx.clip();
        var holes = [[0.28, 0.3, 0.12], [0.68, 0.24, 0.07], [0.62, 0.62, 0.15], [0.26, 0.72, 0.08], [0.85, 0.82, 0.06], [0.45, 0.5, 0.045]];
        holes.forEach(function (hh, k) {
          var hx = x + w * (hh[0] + 0.06 * (rnd(ci, k) - 0.5)), hy = y + w * (hh[1] + 0.06 * (rnd(ci, k + 9) - 0.5)), hr = w * hh[2];
          ctx.fillStyle = D(ch, 0.32); ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 7); ctx.fill();
          ctx.fillStyle = D(ch, 0.14); ctx.beginPath(); ctx.arc(hx + hr * 0.2, hy + hr * 0.25, hr * 0.78, 0, 7); ctx.fill();
          ctx.strokeStyle = rgba(L(ch, 0.5), 0.8); ctx.lineWidth = Math.max(0.8, s * 0.014);
          ctx.beginPath(); ctx.arc(hx, hy, hr, 0.2, 1.9); ctx.stroke();
        });
        var hl2 = ctx.createLinearGradient(0, y, 0, y + w * 0.3); hl2.addColorStop(0, 'rgba(255,255,230,.4)'); hl2.addColorStop(1, 'rgba(255,255,230,0)');
        ctx.fillStyle = hl2; ctx.fillRect(x, y, w, w * 0.3);
        ctx.restore();
        rr(ctx, x, y, w, w, r3); ctx.strokeStyle = D(ch, 0.38); ctx.lineWidth = Math.max(1.2, s * 0.05); ctx.stroke();
        break;
      }
      case 'wool': { // v1.20: lã tricotada — pontos em "V" entrelaçados, fios visíveis, macia
        var wl = mix(col, '#e8dcc8', 0.18), r4 = s * 0.2;
        rr(ctx, x, y, w, w, r4); ctx.fillStyle = D(wl, 0.28); ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, r4); ctx.clip();
        var cols3 = 3, rows3 = 4, cwid = w / cols3, rh = w / (rows3 - 0.6);
        for (var rr3 = -1; rr3 < rows3; rr3++) for (var cc3 = 0; cc3 < cols3; cc3++) {
          var px3 = x + cwid * (cc3 + 0.5), py3 = y + rh * (rr3 + 0.55);
          [-1, 1].forEach(function (sd) {
            ctx.save(); ctx.translate(px3 + sd * cwid * 0.2, py3); ctx.rotate(sd * -0.55);
            var lg2 = ctx.createLinearGradient(0, -rh * 0.5, 0, rh * 0.5); lg2.addColorStop(0, L(wl, 0.28)); lg2.addColorStop(1, D(wl, 0.12));
            ctx.fillStyle = lg2; ctx.beginPath(); ctx.ellipse(0, 0, cwid * 0.24, rh * 0.52, 0, 0, 7); ctx.fill();
            ctx.strokeStyle = rgba(D(wl, 0.42), 0.8); ctx.lineWidth = Math.max(0.8, s * 0.018); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = Math.max(0.6, s * 0.01);
            ctx.beginPath(); ctx.moveTo(-cwid * 0.06, -rh * 0.35); ctx.lineTo(cwid * 0.04, rh * 0.3); ctx.stroke(); // fio
            ctx.restore();
          });
        }
        ctx.restore();
        rr(ctx, x, y, w, w, r4); ctx.strokeStyle = D(wl, 0.45); ctx.lineWidth = Math.max(1.2, s * 0.045); ctx.stroke();
        break;
      }
      case 'candy': {
        grad = ctx.createLinearGradient(x, y, x, y + w);
        grad.addColorStop(0, L(col, 0.12)); grad.addColorStop(1, D(col, 0.22)); // v1.16: tons mais fundos, listras finas (menos "bala infantil")
        rr(ctx, x, y, w, w, s * 0.22); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.22); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        for (i = -2; i < 4; i++) { poly(ctx, [x + i * w * 0.34, y + w, x + i * w * 0.34 + w * 0.07, y + w, x + i * w * 0.34 + w * 0.61, y, x + i * w * 0.34 + w * 0.54, y]); ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.beginPath(); ctx.ellipse(x + w * 0.3, y + w * 0.2, w * 0.14, w * 0.05, -0.4, 0, 7); ctx.fill();
        rr(ctx, x, y, w, w, s * 0.22); ctx.strokeStyle = D(col, 0.4); ctx.lineWidth = Math.max(1, s * 0.04); ctx.stroke();
        break;
      }
      case 'glossy': { // v1.20 "Brilho": laca polida — cor lisa, reflexo diagonal suave e borda fina (diferente da Gelatina e do Cristal)
        var r0 = s * 0.18;
        grad = ctx.createLinearGradient(0, y, 0, y + w);
        grad.addColorStop(0, L(col, 0.2)); grad.addColorStop(1, D(col, 0.18));
        rr(ctx, x, y, w, w, r0); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, r0); ctx.clip();
        var band = ctx.createLinearGradient(x, y, x + w, y + w);
        band.addColorStop(0.18, 'rgba(255,255,255,0)'); band.addColorStop(0.32, 'rgba(255,255,255,.26)'); band.addColorStop(0.42, 'rgba(255,255,255,.06)'); band.addColorStop(0.5, 'rgba(255,255,255,0)');
        ctx.fillStyle = band; ctx.fillRect(x, y, w, w);
        ctx.fillStyle = rgba(D(col, 0.4), 0.22); ctx.fillRect(x, y + w * 0.82, w, w * 0.18);
        ctx.restore();
        rr(ctx, x, y, w, w, r0); ctx.strokeStyle = D(col, 0.3); ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
        rr(ctx, x + s * 0.035, y + s * 0.035, w - s * 0.07, w - s * 0.07, r0 * 0.8); ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = Math.max(1, s * 0.018); ctx.stroke();
        break;
      }
      case 'crystal': { // v1.20: cristal translúcido — facetas geométricas de baixo contraste, profundidade, sem estrela de brilho
        var b = w * 0.26, cxl = x + b, cyt = y + b, cw = w - 2 * b, gem = mix(col, '#dfe8ff', 0.08);
        rr(ctx, x, y, w, w, s * 0.06); ctx.fillStyle = D(gem, 0.2); ctx.fill();
        [[[x, y, x + w, y, cxl + cw, cyt, cxl, cyt], L(gem, 0.26), 0.95],
          [[x, y, cxl, cyt, cxl, cyt + cw, x, y + w], L(gem, 0.1), 0.9],
          [[x + w, y, x + w, y + w, cxl + cw, cyt + cw, cxl + cw, cyt], D(gem, 0.12), 0.9],
          [[x, y + w, cxl, cyt + cw, cxl + cw, cyt + cw, x + w, y + w], D(gem, 0.26), 0.92]].forEach(function (f) { poly(ctx, f[0]); ctx.globalAlpha = f[2]; ctx.fillStyle = f[1]; ctx.fill(); ctx.globalAlpha = 1; });
        grad = ctx.createLinearGradient(cxl, cyt, cxl + cw, cyt + cw);
        grad.addColorStop(0, L(gem, 0.16)); grad.addColorStop(1, gem); ctx.globalAlpha = 0.92;
        ctx.fillStyle = grad; ctx.fillRect(cxl, cyt, cw, cw); ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = Math.max(1, s * 0.016);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cxl, cyt); ctx.moveTo(x + w, y); ctx.lineTo(cxl + cw, cyt);
        ctx.moveTo(x, y + w); ctx.lineTo(cxl, cyt + cw); ctx.moveTo(x + w, y + w); ctx.lineTo(cxl + cw, cyt + cw); ctx.stroke();
        ctx.strokeRect(cxl, cyt, cw, cw);
        ctx.fillStyle = 'rgba(255,255,255,.16)'; poly(ctx, [cxl, cyt, cxl + cw * 0.55, cyt, cxl, cyt + cw * 0.55]); ctx.fill(); // reflexo discreto
        rr(ctx, x, y, w, w, s * 0.06); ctx.strokeStyle = D(gem, 0.5); ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
        break;
      }
      case 'metal': { // v1.20: metal escovado — aço/alumínio/cobre (cinza tingido pela cor), riscos finos, chanfro e rebites; brilho discreto
        var mtones = ['#b07a5a', '#c0a060', '#8fa08a', '#8c9aaa', '#9a92a8', '#a88a90', '#b08a68'];
        var mt = mix('#959ca5', col, 0.3); // aço tingido pela cor do bloco (cores continuam distinguíveis)
        grad = ctx.createLinearGradient(0, y, 0, y + w);
        grad.addColorStop(0, L(mt, 0.3)); grad.addColorStop(0.45, mt); grad.addColorStop(0.55, L(mt, 0.08)); grad.addColorStop(1, D(mt, 0.3));
        rr(ctx, x, y, w, w, s * 0.1); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.1); ctx.clip();
        for (i = 0; i < 22; i++) { var ly = y + w * (i + 0.5) / 22; ctx.strokeStyle = rnd(ci, i) > 0.5 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(x + w * 0.04 * rnd(ci, i + 3), ly); ctx.lineTo(x + w * (0.6 + 0.4 * rnd(ci, i + 5)), ly); ctx.stroke(); }
        ctx.restore();
        rr(ctx, x + s * 0.06, y + s * 0.06, w - s * 0.12, w - s * 0.12, s * 0.06); ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = Math.max(1, s * 0.022); ctx.stroke();
        rr(ctx, x, y, w, w, s * 0.1); ctx.strokeStyle = D(mt, 0.5); ctx.lineWidth = Math.max(1, s * 0.04); ctx.stroke();
        [[0.16, 0.16], [0.84, 0.16], [0.16, 0.84], [0.84, 0.84]].forEach(function (p) {
          var rx = x + w * p[0], ry = y + w * p[1], r1 = s * 0.04;
          ctx.fillStyle = D(mt, 0.35); ctx.beginPath(); ctx.arc(rx, ry, r1, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(rx - r1 * 0.3, ry - r1 * 0.3, r1 * 0.4, 0, 7); ctx.fill();
        });
        break;
      }
      case 'gradient': { // degradê entre duas cores da paleta + brilho suave
        var pal2 = T.classic(theme).palette, c2 = pal2[(ci + 2) % pal2.length];
        grad = ctx.createLinearGradient(x, y, x + w, y + w);
        grad.addColorStop(0, L(col, 0.15)); grad.addColorStop(1, mix(col, c2, 0.65));
        rr(ctx, x, y, w, w, s * 0.24); ctx.fillStyle = grad; ctx.fill();
        var rg = ctx.createRadialGradient(x + w * 0.3, y + w * 0.25, 0, x + w * 0.3, y + w * 0.25, w * 0.75);
        rg.addColorStop(0, 'rgba(255,255,255,.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        rr(ctx, x, y, w, w, s * 0.24); ctx.fillStyle = rg; ctx.fill();
        rr(ctx, x + s * 0.04, y + s * 0.04, w - s * 0.08, w - s * 0.08, s * 0.2); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = Math.max(1, s * 0.025); ctx.stroke();
        break;
      }
      case 'galaxy': { // céu profundo: nebulosa na cor do bloco e estrelas
        rr(ctx, x, y, w, w, s * 0.16); ctx.fillStyle = mix(col, '#0d0822', 0.78); ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.16); ctx.clip();
        var ng = ctx.createRadialGradient(x + w * (0.3 + 0.4 * rnd(ci, 1)), y + w * (0.3 + 0.4 * rnd(ci, 2)), 0, x + w * 0.5, y + w * 0.5, w * 0.8);
        ng.addColorStop(0, rgba(L(col, 0.3), 0.9)); ng.addColorStop(0.45, rgba(col, 0.45)); ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ng; ctx.fillRect(x, y, w, w);
        for (i = 0; i < 14; i++) {
          ctx.fillStyle = 'rgba(255,255,255,' + (0.45 + 0.5 * rnd(ci, i + 40)) + ')';
          ctx.beginPath(); ctx.arc(x + w * rnd(ci, i + 10), y + w * rnd(ci, i + 25), s * (0.008 + 0.018 * rnd(ci, i + 55)), 0, 7); ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = '#fff'; var gx = x + w * 0.7, gy = y + w * 0.3, gr = s * 0.1;
        poly(ctx, [gx, gy - gr, gx + gr * 0.2, gy - gr * 0.2, gx + gr, gy, gx + gr * 0.2, gy + gr * 0.2, gx, gy + gr, gx - gr * 0.2, gy + gr * 0.2, gx - gr, gy, gx - gr * 0.2, gy - gr * 0.2]); ctx.fill();
        rr(ctx, x, y, w, w, s * 0.16); ctx.strokeStyle = rgba(L(col, 0.35), 0.85); ctx.lineWidth = Math.max(1, s * 0.035); ctx.stroke();
        break;
      }
      case 'energy': { // núcleo de energia: fundo escuro, brilho interno e um raio
        rr(ctx, x, y, w, w, s * 0.14); ctx.fillStyle = mix(col, '#05060c', 0.72); ctx.fill();
        var eg = ctx.createRadialGradient(x + w / 2, y + w / 2, 0, x + w / 2, y + w / 2, w * 0.62);
        eg.addColorStop(0, rgba(L(col, 0.7), 0.95)); eg.addColorStop(0.45, rgba(col, 0.55)); eg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save(); rr(ctx, x, y, w, w, s * 0.14); ctx.clip(); ctx.fillStyle = eg; ctx.fillRect(x, y, w, w);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, s * 0.035); ctx.shadowColor = L(col, 0.5); ctx.shadowBlur = s * 0.25;
        ctx.beginPath(); ctx.moveTo(x + w * 0.58, y + w * 0.08); ctx.lineTo(x + w * 0.38, y + w * 0.5); ctx.lineTo(x + w * 0.56, y + w * 0.5); ctx.lineTo(x + w * 0.4, y + w * 0.92); ctx.stroke();
        ctx.restore();
        ctx.shadowColor = col; ctx.shadowBlur = s * 0.3; ctx.strokeStyle = L(col, 0.55); ctx.lineWidth = Math.max(1.5, s * 0.06);
        rr(ctx, x + s * 0.03, y + s * 0.03, w - s * 0.06, w - s * 0.06, s * 0.12); ctx.stroke();
        break;
      }
      case 'rainbow': { // arco-íris: faixas diagonais, cada cor começa num ponto diferente do espectro
        var hues = ['#ff5a5a', '#ffa94d', '#ffe066', '#63e6be', '#4dabf7', '#9775fa'], off = ci % hues.length;
        grad = ctx.createLinearGradient(x, y, x + w, y + w);
        for (i = 0; i < hues.length; i++) grad.addColorStop(i / (hues.length - 1), mix(hues[(i + off) % hues.length], col, 0.25));
        rr(ctx, x, y, w, w, s * 0.2); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.2); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x + w * 0.45, y + w * 0.1, w * 0.6, w * 0.32, -0.2, 0, 7); ctx.fill();
        ctx.restore();
        rr(ctx, x, y, w, w, s * 0.2); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = Math.max(1, s * 0.035); ctx.stroke();
        break;
      }
      case 'holo': { // holográfico: base prateada na cor do bloco + reflexo furta-cor
        var hb = mix(col, '#dfe6ee', 0.22);
        grad = ctx.createLinearGradient(x, y, x, y + w);
        grad.addColorStop(0, L(hb, 0.3)); grad.addColorStop(1, D(hb, 0.15));
        rr(ctx, x, y, w, w, s * 0.16); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.16); ctx.clip();
        var hg2 = ctx.createLinearGradient(x, y + w, x + w, y);
        ['rgba(255,0,200,.45)', 'rgba(0,240,255,.45)', 'rgba(255,240,0,.38)', 'rgba(140,60,255,.42)'].forEach(function (c, k) { hg2.addColorStop(k / 3, c); });
        ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = hg2; ctx.fillRect(x, y, w, w);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        for (i = 0; i < 3; i++) poly(ctx, [x + w * (0.1 + i * 0.3), y + w, x + w * (0.2 + i * 0.3), y + w, x + w * (0.6 + i * 0.3), y, x + w * (0.5 + i * 0.3), y]), ctx.fill();
        ctx.restore();
        rr(ctx, x, y, w, w, s * 0.16); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1, s * 0.035); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + w * 0.76, y + w * 0.24, s * 0.04, 0, 7); ctx.fill();
        break;
      }
      case 'lava': { // rocha escura com rachaduras incandescentes
        rr(ctx, x, y, w, w, s * 0.1); ctx.fillStyle = mix(col, '#26120c', 0.78); ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.1); ctx.clip();
        var lg = ctx.createRadialGradient(x + w * 0.5, y + w * 0.6, 0, x + w * 0.5, y + w * 0.6, w * 0.7);
        lg.addColorStop(0, 'rgba(255,120,30,.45)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = lg; ctx.fillRect(x, y, w, w);
        ctx.strokeStyle = mix('#ffb020', col, 0.2); ctx.lineWidth = Math.max(1.2, s * 0.05); ctx.lineJoin = 'round';
        ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = s * 0.25;
        ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + w * (0.3 + 0.2 * rnd(ci, 1))); ctx.lineTo(x + w * 0.45, y + w * 0.45); ctx.lineTo(x + w * 0.6, y + w * 0.2);
        ctx.moveTo(x + w * 0.45, y + w * 0.45); ctx.lineTo(x + w * 0.55, y + w * 0.75); ctx.lineTo(x + w * 0.9, y + w * (0.7 + 0.15 * rnd(ci, 2))); ctx.stroke();
        ctx.fillStyle = '#ffd25e'; ctx.beginPath(); ctx.arc(x + w * 0.25, y + w * 0.75, s * 0.05, 0, 7); ctx.fill();
        ctx.restore();
        rr(ctx, x, y, w, w, s * 0.1); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.stroke();
        break;
      }
      case 'gold': { // ouro polido com leve tom da cor do bloco
        var au = mix('#f2c23c', col, 0.2);
        grad = ctx.createLinearGradient(x, y, x + w, y + w);
        grad.addColorStop(0, L(au, 0.45)); grad.addColorStop(0.45, au); grad.addColorStop(0.55, L(au, 0.25)); grad.addColorStop(1, D(au, 0.35));
        rr(ctx, x, y, w, w, s * 0.12); ctx.fillStyle = grad; ctx.fill();
        rr(ctx, x + s * 0.12, y + s * 0.12, w - s * 0.24, w - s * 0.24, s * 0.08);
        ctx.strokeStyle = D(au, 0.3); ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.55)'; poly(ctx, [x + w * 0.15, y + w * 0.15, x + w * 0.45, y + w * 0.15, x + w * 0.15, y + w * 0.45]); ctx.fill();
        ctx.fillStyle = '#fff'; var gx2 = x + w * 0.74, gy2 = y + w * 0.26, gr2 = s * 0.09;
        poly(ctx, [gx2, gy2 - gr2, gx2 + gr2 * 0.2, gy2 - gr2 * 0.2, gx2 + gr2, gy2, gx2 + gr2 * 0.2, gy2 + gr2 * 0.2, gx2, gy2 + gr2, gx2 - gr2 * 0.2, gy2 + gr2 * 0.2, gx2 - gr2, gy2, gx2 - gr2 * 0.2, gy2 - gr2 * 0.2]); ctx.fill();
        rr(ctx, x, y, w, w, s * 0.12); ctx.strokeStyle = D(au, 0.5); ctx.lineWidth = Math.max(1, s * 0.04); ctx.stroke();
        break;
      }
      case 'marble': { // mármore claro com veios na cor do bloco
        var mb = mix(col, '#f4f1ea', 0.62);
        grad = ctx.createLinearGradient(x, y, x + w, y + w); grad.addColorStop(0, L(mb, 0.3)); grad.addColorStop(1, D(mb, 0.08));
        rr(ctx, x, y, w, w, s * 0.1); ctx.fillStyle = grad; ctx.fill();
        ctx.save(); rr(ctx, x, y, w, w, s * 0.1); ctx.clip();
        for (i = 0; i < 3; i++) {
          ctx.strokeStyle = rgba(D(col, 0.15), 0.35 + 0.2 * i % 2); ctx.lineWidth = Math.max(1, s * (0.012 + 0.012 * i));
          var y0 = y + w * (0.15 + 0.3 * i + 0.1 * rnd(ci, i));
          ctx.beginPath(); ctx.moveTo(x - 2, y0); ctx.bezierCurveTo(x + w * 0.3, y0 + w * 0.25 * (rnd(ci, i + 5) - 0.3), x + w * 0.6, y0 - w * 0.2, x + w + 2, y0 + w * 0.1); ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(x + w * 0.3, y + w * 0.18, w * 0.22, w * 0.07, -0.3, 0, 7); ctx.fill();
        rr(ctx, x, y, w, w, s * 0.1); ctx.strokeStyle = D(mb, 0.3); ctx.lineWidth = Math.max(1, s * 0.035); ctx.stroke();
        break;
      }
      case 'circuit': { // placa de circuito: trilhas e um chip
        rr(ctx, x, y, w, w, s * 0.08); ctx.fillStyle = mix(col, '#0a1712', 0.72); ctx.fill();
        ctx.strokeStyle = L(col, 0.45); ctx.lineWidth = Math.max(1, s * 0.03); ctx.fillStyle = L(col, 0.6);
        [[0.1, 0.25, 0.4, 0.25, 0.4, 0.4], [0.9, 0.7, 0.62, 0.7, 0.62, 0.6], [0.25, 0.9, 0.25, 0.62, 0.4, 0.62], [0.75, 0.1, 0.75, 0.4, 0.62, 0.4]].forEach(function (t2) {
          ctx.beginPath(); ctx.moveTo(x + w * t2[0], y + w * t2[1]); ctx.lineTo(x + w * t2[2], y + w * t2[3]); ctx.lineTo(x + w * t2[4], y + w * t2[5]); ctx.stroke();
          ctx.beginPath(); ctx.arc(x + w * t2[0], y + w * t2[1], s * 0.04, 0, 7); ctx.fill();
        });
        ctx.fillStyle = D(col, 0.55); ctx.fillRect(x + w * 0.38, y + w * 0.38, w * 0.24, w * 0.24);
        ctx.strokeStyle = L(col, 0.7); ctx.strokeRect(x + w * 0.38, y + w * 0.38, w * 0.24, w * 0.24);
        rr(ctx, x, y, w, w, s * 0.08); ctx.strokeStyle = L(col, 0.2); ctx.lineWidth = Math.max(1, s * 0.035); ctx.stroke();
        break;
      }
      case 'bubble': { // bolha de sabão: transparente, com borda colorida e reflexo
        var bg2 = ctx.createRadialGradient(x + w * 0.4, y + w * 0.35, w * 0.05, x + w / 2, y + w / 2, w * 0.55);
        bg2.addColorStop(0, rgba(L(col, 0.5), 0.55)); bg2.addColorStop(0.7, rgba(col, 0.8)); bg2.addColorStop(1, rgba(L(col, 0.4), 1)); // v1.15: mais opaca (antes quase sumia no tabuleiro)
        ctx.beginPath(); ctx.arc(x + w / 2, y + w / 2, w * 0.48, 0, 7); ctx.fillStyle = bg2; ctx.fill();
        ctx.strokeStyle = rgba(L(col, 0.7), 1); ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(x + w * 0.33, y + w * 0.3, w * 0.12, w * 0.07, -0.6, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(x + w * 0.68, y + w * 0.7, s * 0.035, 0, 7); ctx.fill();
        break;
      }
      case 'stained': { // vitral: pedaços de vidro com chumbo escuro entre eles
        var pal3 = T.classic(theme).palette, cx3 = x + w * (0.4 + 0.2 * rnd(ci, 3)), cy3 = y + w * (0.4 + 0.2 * rnd(ci, 4));
        var pieces3 = [[x, y, x + w, y, cx3, cy3], [x + w, y, x + w, y + w, cx3, cy3], [x + w, y + w, x, y + w, cx3, cy3], [x, y + w, x, y, cx3, cy3]];
        pieces3.forEach(function (pp, k) {
          var c3 = k % 2 ? col : mix(col, pal3[(ci + 3) % pal3.length], 0.35);
          var g3 = ctx.createLinearGradient(x, y, x, y + w); g3.addColorStop(0, L(c3, 0.35)); g3.addColorStop(1, c3);
          poly(ctx, pp); ctx.fillStyle = g3; ctx.fill();
        });
        ctx.strokeStyle = '#1d1a22'; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.lineJoin = 'round';
        pieces3.forEach(function (pp) { poly(ctx, pp); ctx.stroke(); });
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x + w * 0.3, y + w * 0.22, s * 0.06, 0, 7); ctx.fill();
        break;
      }
      case 'pixel': {
        var n = 4, ps = w / n;
        for (var py = 0; py < n; py++) for (var px2 = 0; px2 < n; px2++) {
          var edgeHi = py === 0 || px2 === 0, edgeLo = py === n - 1 || px2 === n - 1;
          ctx.fillStyle = edgeHi && !edgeLo ? L(col, 0.35) : edgeLo && !edgeHi ? D(col, 0.3) : col;
          if (px2 === 1 && py === 1) ctx.fillStyle = L(col, 0.6);
          ctx.fillRect(Math.floor(x + px2 * ps), Math.floor(y + py * ps), Math.ceil(ps), Math.ceil(ps));
        }
        ctx.strokeStyle = D(col, 0.55); ctx.lineWidth = Math.max(1, s * 0.04); ctx.strokeRect(x, y, w, w);
        break;
      }
    }
    ctx.restore();
  }

  /* ---------------- símbolos (para não depender só da cor) ---------------- */
  function drawSymbol(ctx, s, ci) {
    var cx = s / 2, cy = s / 2, r = s * 0.17, k = ci % 7;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath();
    if (k === 0) ctx.arc(cx, cy, r, 0, 7);
    else if (k === 1) { ctx.moveTo(cx, cy - r * 1.15); ctx.lineTo(cx + r * 1.1, cy + r * 0.85); ctx.lineTo(cx - r * 1.1, cy + r * 0.85); ctx.closePath(); }
    else if (k === 2) ctx.rect(cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8);
    else if (k === 3) { ctx.moveTo(cx, cy - r * 1.2); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r * 1.2); ctx.lineTo(cx - r, cy); ctx.closePath(); }
    else if (k === 4) { for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.5 : r * 1.2; ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); } ctx.closePath(); }
    else if (k === 5) { var t = r * 0.42; poly(ctx, [cx - t, cy - r, cx + t, cy - r, cx + t, cy - t, cx + r, cy - t, cx + r, cy + t, cx + t, cy + t, cx + t, cy + r, cx - t, cy + r, cx - t, cy + t, cx - r, cy + t, cx - r, cy - t, cx - t, cy - t]); }
    else { ctx.moveTo(cx, cy + r); ctx.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.5, cy - r * 1.3, cx, cy - r * 0.45); ctx.bezierCurveTo(cx + r * 0.5, cy - r * 1.3, cx + r * 1.6, cy - r * 0.2, cx, cy + r); }
    ctx.stroke(); ctx.fill();
    ctx.restore();
  }

  /* ---------------- movimento contínuo (pelos e gelatina) ---------------- */
  /** Desenha o bloco vivo em (x, y) com tamanho s no tempo t (ms). */
  function drawLive(ctx, sprite, skin, theme, ci, x, y, s, t, seed) {
    if (skin === 'jelly') {
      var k = Math.sin(t / 260 + seed * 0.9) * 0.045;
      var sx = 1 + k, sy = 1 - k;
      ctx.drawImage(sprite, x + s * (1 - sx) / 2, y + s * (1 - sy), s * sx, s * sy);
      return;
    }
    if (skin !== 'fur') { ctx.drawImage(sprite, x, y, s, s); return; }
    // pelúcia: o topete balança; cada posição de balanço é desenhada uma vez e reaproveitada
    var sway = Math.sin(t / 420 + seed * 1.7) * 0.5 + Math.sin(t / 170 + seed) * 0.12;
    var phase = Math.max(0, Math.min(FUR_PHASES - 1, Math.round((sway + 0.62) / 1.24 * (FUR_PHASES - 1))));
    var frames = furCache.get(sprite);
    if (!frames) { frames = []; furCache.set(sprite, frames); }
    var key = (seed % 3) * FUR_PHASES + phase;
    if (!frames[key]) frames[key] = furFrame(sprite, theme, ci, (phase / (FUR_PHASES - 1)) * 1.24 - 0.62, seed % 3);
    var f = frames[key];
    ctx.drawImage(f, x, y - s * FUR_TOP, s, s * (1 + FUR_TOP));
  }

  var FUR_PHASES = 12, FUR_TOP = 0.3;
  var furCache = typeof WeakMap !== 'undefined' ? new WeakMap() : { get: function () {}, set: function () {} };
  function furFrame(sprite, theme, ci, sway, variant) {
    var px = sprite.width, c = document.createElement('canvas');
    c.width = px; c.height = Math.round(px * (1 + FUR_TOP));
    var ctx = c.getContext('2d'), s = px, top = px * FUR_TOP, col = colorOf(theme, ci);
    ctx.drawImage(sprite, 0, top, px, px);
    ctx.lineCap = 'round';
    for (var i = 0; i < 9; i++) {
      var bx = s * (0.2 + i * 0.075), by = top + s * 0.2, len = s * (0.22 + 0.12 * rnd(variant + 1, i));
      var a = -Math.PI / 2 + sway + (i - 4) * 0.12, bend = sway * 0.8;
      ctx.strokeStyle = i % 2 ? L(col, 0.25) : D(col, 0.1);
      ctx.lineWidth = Math.max(1, s * 0.045);
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + Math.cos(a) * len * 0.5, by + Math.sin(a) * len * 0.5,
        bx + Math.cos(a + bend) * len, by + Math.sin(a + bend) * len);
      ctx.stroke();
    }
    return c;
  }

  /* ---------------- quebra (tt de 0 a 1) ---------------- */
  /** Desenha a célula quebrando, centrada em (cx, cy). Retorna false para usar a quebra padrão. */
  function drawBreak(ctx, sprite, skin, theme, ci, cx, cy, s, tt, seed) {
    if (!BREAK_MS[skin]) return false;
    var col = colorOf(theme, ci), i, u, a;
    ctx.save();
    if (skin === 'ice' || skin === 'crystal') { // cristal estilhaça como gelo
      if (tt < 0.25) {
        ctx.drawImage(sprite, cx - s / 2, cy - s / 2, s, s);
        var k = tt / 0.25;
        ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(1, s * 0.04);
        for (i = 0; i < 6; i++) { a = i * 1.05 + rnd(seed, i); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * s * 0.55 * k, cy + Math.sin(a) * s * 0.55 * k); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,255,255,' + ((skin === 'crystal' ? 0.18 : 0.5) * k) + ')'; ctx.fillRect(cx - s / 2, cy - s / 2, s, s); // v1.20: cristal sem clarão forte
      } else {
        u = (tt - 0.25) / 0.75;
        for (i = 0; i < 7; i++) {
          a = (i / 7) * Math.PI * 2 + rnd(seed, i) * 0.6;
          var a2 = a + 0.9, d = s * (0.3 + 1.1 * u) * (0.7 + 0.5 * rnd(seed, i + 9));
          var ox = cx + Math.cos(a + 0.45) * d, oy = cy + Math.sin(a + 0.45) * d + s * 1.6 * u * u;
          ctx.globalAlpha = 1 - u;
          ctx.save(); ctx.translate(ox, oy); ctx.rotate(u * (rnd(seed, i + 20) - 0.5) * 6);
          poly(ctx, [0, 0, Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28, Math.cos(a2) * s * 0.28, Math.sin(a2) * s * 0.28]);
          ctx.fillStyle = rgba(mix(col, '#e8f7ff', skin === 'crystal' ? 0.15 : 0.6), 0.9); ctx.fill(); // cristal: estilhaços na cor do bloco
          ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.restore();
        }
      }
    } else if (skin === 'stone') {
      if (tt < 0.38) {
        var k2 = tt / 0.38, sh = Math.sin(tt * 90) * s * 0.03;
        ctx.drawImage(sprite, cx - s / 2 + sh, cy - s / 2, s, s);
        ctx.strokeStyle = 'rgba(20,18,16,.85)'; ctx.lineWidth = Math.max(1.2, s * 0.05);
        ctx.beginPath(); ctx.moveTo(cx - s * 0.05 + sh, cy - s * 0.48);
        var steps = Math.ceil(5 * k2);
        for (i = 1; i <= steps; i++) ctx.lineTo(cx + sh + (i % 2 ? 1 : -1) * s * 0.12 * rnd(seed, i), cy - s * 0.48 + (s * 0.96) * (i / 5));
        ctx.stroke();
        if (k2 > 0.5) { ctx.beginPath(); ctx.moveTo(cx - s * 0.48 + sh, cy + s * 0.05); ctx.lineTo(cx + sh, cy + s * 0.1); ctx.lineTo(cx + s * 0.4 * (k2 - 0.5) * 2 + sh, cy - s * 0.05); ctx.stroke(); }
      } else {
        u = (tt - 0.38) / 0.62;
        var q = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
        for (i = 0; i < 4; i++) {
          var dx = q[i][0], dy = q[i][1];
          ctx.save();
          ctx.globalAlpha = Math.min(1, 1.6 - u * 1.6);
          ctx.translate(cx + dx * s * 0.25 + dx * s * 0.5 * u, cy + dy * s * 0.25 + s * 2.2 * u * u - s * 0.3 * u);
          ctx.rotate(dx * u * 1.6);
          ctx.beginPath(); ctx.rect(-s * 0.25, -s * 0.25, s * 0.5, s * 0.5); ctx.clip();
          ctx.drawImage(sprite, -s * 0.25 - (dx > 0 ? s * 0.5 : 0), -s * 0.25 - (dy > 0 ? s * 0.5 : 0), s, s);
          ctx.restore();
        }
        ctx.globalAlpha = 0.45 * (1 - u);
        ctx.fillStyle = '#b9b3aa';
        for (i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(cx + (rnd(seed, i) - 0.5) * s, cy + (rnd(seed, i + 5) - 0.2) * s * 0.6, s * (0.12 + 0.3 * u), 0, 7); ctx.fill(); }
      }
    } else if (skin === 'fur') {
      var sc = 1 + 0.35 * tt;
      ctx.globalAlpha = 1 - tt * tt;
      ctx.drawImage(sprite, cx - s * sc / 2, cy - s * sc / 2, s * sc, s * sc);
      ctx.fillStyle = rgba(L(col, 0.35), 0.75 * (1 - tt));
      for (i = 0; i < 7; i++) {
        a = (i / 7) * Math.PI * 2 + seed;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * s * 0.7 * tt, cy + Math.sin(a) * s * 0.7 * tt - s * 0.3 * tt, s * (0.12 + 0.18 * tt), 0, 7); ctx.fill();
      }
      ctx.strokeStyle = D(col, 0.1); ctx.lineWidth = Math.max(1, s * 0.03); ctx.lineCap = 'round';
      for (i = 0; i < 6; i++) {
        a = rnd(seed, i) * 6.28; var r0 = s * 0.9 * tt;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 - s * 0.4 * tt);
        ctx.lineTo(cx + Math.cos(a + 0.3) * (r0 + s * 0.15), cy + Math.sin(a + 0.3) * (r0 + s * 0.15) - s * 0.4 * tt); ctx.stroke();
      }
    } else if (skin === 'jelly') {
      if (tt < 0.32) {
        var k3 = tt / 0.32, sx = 1 + 0.45 * k3, sy = 1 - 0.5 * k3;
        ctx.drawImage(sprite, cx - s * sx / 2, cy + s / 2 - s * sy, s * sx, s * sy);
      } else {
        u = (tt - 0.32) / 0.68;
        ctx.fillStyle = rgba(col, 0.85);
        for (i = 0; i < 8; i++) {
          a = Math.PI + (i / 7) * Math.PI + (rnd(seed, i) - 0.5) * 0.4;
          var v = s * (0.6 + 0.8 * rnd(seed, i + 3));
          ctx.globalAlpha = 1 - u;
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * v * u, cy + s * 0.25 + Math.sin(a) * v * u + s * 2 * u * u, s * (0.13 - 0.06 * u), 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 0.6 * (1 - u);
        ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.42, s * 0.5 * (1 + u), s * 0.08, 0, 0, 7); ctx.fill();
      }
    } else if (skin === 'neon') {
      var flick = tt < 0.35 ? 1 - 0.45 * Math.sin(Math.PI * tt / 0.35) : 1; // v1.16: um apagar suave (antes piscava ~7× em 0,14 s — fotossensibilidade)
      var hs = tt < 0.35 ? 1 : 1 - (tt - 0.35) / 0.65;
      ctx.globalAlpha = flick * (tt < 0.35 ? 1 : 0.4 + 0.6 * hs);
      ctx.drawImage(sprite, cx - s / 2, cy - s * hs / 2, s, s * hs);
      if (tt >= 0.35) {
        ctx.globalAlpha = 1 - (tt - 0.35) / 0.65;
        ctx.shadowColor = col; ctx.shadowBlur = s * 0.8; ctx.strokeStyle = L(col, 0.6); ctx.lineWidth = Math.max(2, s * 0.08);
        ctx.beginPath(); ctx.moveTo(cx - s * 0.6, cy); ctx.lineTo(cx + s * 0.6, cy); ctx.stroke();
      }
    } else if (skin === 'wood') {
      if (tt < 0.2) {
        ctx.drawImage(sprite, cx - s / 2 + Math.sin(tt * 120) * s * 0.035, cy - s / 2, s, s);
      } else {
        u = (tt - 0.2) / 0.8;
        for (i = 0; i < 3; i++) {
          var off = (i - 1);
          ctx.save();
          ctx.globalAlpha = Math.min(1, 1.5 - u * 1.5);
          ctx.translate(cx + off * s * 0.33 + off * s * 0.45 * u, cy + s * 2.3 * u * u - s * 0.25 * u * (1 + rnd(seed, i)));
          ctx.rotate((off || (rnd(seed, i) - 0.5)) * u * 1.8);
          ctx.beginPath(); ctx.rect(-s / 6, -s / 2, s / 3, s); ctx.clip();
          ctx.drawImage(sprite, -s / 6 - i * s / 3, -s / 2, s, s);
          ctx.restore();
        }
        ctx.strokeStyle = rgba(mix(col, '#a0703f', 0.6), 1 - u); ctx.lineWidth = Math.max(1, s * 0.04);
        for (i = 0; i < 5; i++) {
          a = -Math.PI * rnd(seed, i + 7); var r1 = s * 0.9 * u;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * (r1 + s * 0.18), cy + Math.sin(a) * (r1 + s * 0.18)); ctx.stroke();
        }
      }
    }
    else if (skin === 'candy') {
      var sc2 = tt < 0.3 ? 1 + 0.25 * (tt / 0.3) : 0;
      if (sc2) ctx.drawImage(sprite, cx - s * sc2 / 2, cy - s * sc2 / 2, s * sc2, s * sc2);
      else {
        u = (tt - 0.3) / 0.7;
        var pal = T.classic(theme).palette;
        for (i = 0; i < 12; i++) {
          a = (i / 12) * Math.PI * 2 + rnd(seed, i);
          var dist = s * (0.2 + 1.1 * u * (0.6 + 0.6 * rnd(seed, i + 30)));
          ctx.save(); ctx.globalAlpha = 1 - u;
          ctx.translate(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist + s * 1.2 * u * u);
          ctx.rotate(a + u * 6); ctx.fillStyle = i % 3 ? pal[(ci + i) % pal.length] : '#fff';
          rr(ctx, -s * 0.09, -s * 0.03, s * 0.18, s * 0.06, s * 0.03); ctx.fill();
          ctx.restore();
        }
      }
    } else if (skin === 'wool') { // v1.20: a lã se desfaz — solta, desenrola em fios, pedacinhos se desprendem e somem
      var wl = mix(col, '#e8dcc8', 0.18);
      if (tt < 0.25) { // 1) o bloco se solta (balança e afrouxa)
        var k5 = tt / 0.25, wob = Math.sin(k5 * Math.PI * 3) * 0.08 * (1 - k5);
        ctx.translate(cx, cy); ctx.rotate(wob); var sc5 = 1 - 0.06 * k5;
        ctx.drawImage(sprite, -s * sc5 / 2, -s * sc5 / 2, s * sc5, s * sc5);
      } else { // 2) desenrola: o bloco encolhe e os fios saem girando  3) pedacinhos  4) somem
        u = (tt - 0.25) / 0.75;
        var sc6 = Math.max(0, 1 - u * 1.4);
        if (sc6 > 0) { ctx.globalAlpha = sc6; ctx.drawImage(sprite, cx - s * sc6 / 2, cy - s * sc6 / 2, s * sc6, s * sc6); ctx.globalAlpha = 1; }
        ctx.lineCap = 'round';
        for (i = 0; i < 4; i++) {
          a = i * 1.57 + rnd(seed, i) * 0.8; var len = s * (0.25 + 0.9 * u);
          ctx.globalAlpha = Math.max(0, 1 - u * u); ctx.strokeStyle = i % 2 ? L(wl, 0.15) : wl; ctx.lineWidth = Math.max(1.2, s * 0.07 * (1 - u * 0.6));
          ctx.beginPath(); ctx.moveTo(cx, cy);
          ctx.bezierCurveTo(cx + Math.cos(a) * len * 0.4 - Math.sin(a) * s * 0.25 * (1 - u), cy + Math.sin(a) * len * 0.4 + Math.cos(a) * s * 0.25 * (1 - u),
            cx + Math.cos(a + 0.6) * len * 0.8, cy + Math.sin(a + 0.6) * len * 0.8 + s * 0.4 * u * u,
            cx + Math.cos(a + 0.3) * len, cy + Math.sin(a + 0.3) * len + s * 0.7 * u * u);
          ctx.stroke();
        }
        for (i = 0; i < 6; i++) { // pedacinhos de lã (bolinhas felpudas)
          a = (i / 6) * Math.PI * 2 + rnd(seed, i + 40); var dd = s * (0.2 + 0.9 * u * (0.6 + 0.5 * rnd(seed, i + 50)));
          ctx.globalAlpha = Math.max(0, 1 - u); ctx.fillStyle = i % 2 ? L(wl, 0.25) : wl;
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd + s * 0.9 * u * u, s * 0.05 * (1 - u * 0.5), 0, 7); ctx.fill();
        }
      }
    } else if (skin === 'cheese') { // v1.20: queijo — racha em pedaços e solta farelos
      if (tt < 0.2) ctx.drawImage(sprite, cx - s / 2, cy - s / 2, s, s);
      else {
        u = (tt - 0.2) / 0.8;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q, k) { // 4 pedaços
          ctx.save(); ctx.globalAlpha = 1 - u;
          var dx = q[0] * s * 0.45 * u, dy = q[1] * s * 0.3 * u + s * 1.3 * u * u;
          ctx.translate(cx + dx, cy + dy); ctx.rotate(q[0] * u * 0.8);
          var hw = sprite.width / 2; // recorte direto da imagem (mais leve que máscara)
          ctx.drawImage(sprite, q[0] < 0 ? 0 : hw, q[1] < 0 ? 0 : hw, hw, hw, q[0] < 0 ? -s / 2 : 0, q[1] < 0 ? -s / 2 : 0, s / 2, s / 2); ctx.restore();
        });
        ctx.fillStyle = '#f7c64a';
        for (i = 0; i < 8; i++) { a = rnd(seed, i) * 6.28; var d6 = s * (0.15 + 0.8 * u); ctx.globalAlpha = 1 - u;
          ctx.fillRect(cx + Math.cos(a) * d6, cy + Math.sin(a) * d6 * 0.6 + s * 1.5 * u * u, s * 0.05, s * 0.05); }
      }
    } else if (skin === 'metal') { // v1.20: metal — impacto (anel), faíscas curtas e o bloco encolhe
      u = tt;
      var sc7 = 1 - u * u;
      ctx.globalAlpha = 1 - u * 0.8; ctx.drawImage(sprite, cx - s * sc7 / 2, cy - s * sc7 / 2, s * sc7, s * sc7);
      ctx.globalAlpha = Math.max(0, 0.8 - u); ctx.strokeStyle = '#e8eef5'; ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath(); ctx.arc(cx, cy, s * (0.3 + 0.5 * u), 0, 7); ctx.stroke();
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.lineCap = 'round';
      for (i = 0; i < 6; i++) { a = (i / 6) * 6.28 + rnd(seed, i); var r5 = s * (0.35 + 0.7 * u), r6 = r5 - s * 0.16 * (1 - u);
        ctx.globalAlpha = Math.max(0, 1 - u * 1.3); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r6, cy + Math.sin(a) * r6); ctx.lineTo(cx + Math.cos(a) * r5, cy + Math.sin(a) * r5); ctx.stroke(); }
    } else if (skin === 'bubble') { // v1.20: bolha estoura suave — anel abre e gotinhas
      if (tt < 0.15) { var sw2 = 1 + 0.08 * (tt / 0.15); ctx.drawImage(sprite, cx - s * sw2 / 2, cy - s * sw2 / 2, s * sw2, s * sw2); }
      else {
        u = (tt - 0.15) / 0.85;
        ctx.globalAlpha = Math.max(0, 1 - u * 1.5); ctx.strokeStyle = L(col, 0.5); ctx.lineWidth = Math.max(1, s * 0.05 * (1 - u));
        ctx.beginPath(); ctx.arc(cx, cy, s * (0.45 + 0.35 * u), 0, 7); ctx.stroke();
        ctx.fillStyle = L(col, 0.4);
        for (i = 0; i < 6; i++) { a = (i / 6) * 6.28 + rnd(seed, i); var d7 = s * (0.45 + 0.5 * u);
          ctx.globalAlpha = Math.max(0, 1 - u); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d7, cy + Math.sin(a) * d7 + s * 0.5 * u * u, s * 0.04, 0, 7); ctx.fill(); }
      }
    } else if (skin === 'ocean') { // v1.20: oceano — vira água: onda e gotas em arco
      u = tt;
      var sc8 = Math.max(0, 1 - u * 1.6);
      if (sc8 > 0) { ctx.globalAlpha = sc8; ctx.drawImage(sprite, cx - s / 2, cy - s * sc8 / 2 + s * (1 - sc8) / 2, s, s * sc8); }
      ctx.globalAlpha = Math.max(0, 0.7 - u); ctx.strokeStyle = 'rgba(190,240,255,1)'; ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.35, s * (0.3 + 0.5 * u), s * (0.08 + 0.08 * u), 0, 0, 7); ctx.stroke();
      ctx.fillStyle = mix(col, '#bff0ff', 0.5);
      for (i = 0; i < 7; i++) { var vx = (rnd(seed, i) - 0.5) * 1.6, vy = -0.8 - rnd(seed, i + 9) * 0.6;
        ctx.globalAlpha = Math.max(0, 1 - u); ctx.beginPath(); ctx.arc(cx + vx * s * u, cy + vy * s * u + 2.2 * s * u * u, s * 0.045, 0, 7); ctx.fill(); }
    } else if (skin === 'pixel') {
      u = tt;
      for (var py2 = 0; py2 < 4; py2++) for (var px3 = 0; px3 < 4; px3++) {
        var k4 = py2 * 4 + px3, delay = rnd(seed, k4) * 0.35;
        var uu = Math.max(0, (u - delay) / (1 - delay));
        if (uu >= 1) continue;
        var ox2 = (px3 - 1.5) * s / 4, oy2 = (py2 - 1.5) * s / 4;
        ctx.globalAlpha = 1 - uu;
        var jx = (rnd(seed, k4 + 50) - 0.5) * s * 1.4 * uu, jy = -s * 0.6 * uu + s * 2 * uu * uu;
        ctx.save(); ctx.beginPath(); ctx.rect(cx + ox2 - s / 8 + jx, cy + oy2 - s / 8 + jy, s / 4, s / 4); ctx.clip();
        ctx.drawImage(sprite, cx - s / 2 + jx, cy - s / 2 + jy, s, s);
        ctx.restore();
      }
    }
    ctx.restore();
    return true;
  }

  root.MZSkins = {
    LIST: LIST,
    /** v1.15: fundo da tela durante uma transformação de blocos (o fundo muda junto com os blocos). Todos escuros,
     *  para o texto claro da interface ficar legível; 'classic' e 'theme' usam o fundo do visual atual. */
    BG: {
      ice: ['#0d3b5c', '#06192b'], stone: ['#3a3d44', '#16181c'], fur: ['#5a2d4f', '#22101e'], jelly: ['#1f4f63', '#0a1d2a'],
      neon: ['#1a0638', '#05010f'], wood: ['#4a2c17', '#1c0f06'], candy: ['#6a1d4a', '#2a0a1e'], pixel: ['#1c3a1c', '#081608'],
      glossy: ['#123a7a', '#050f2a'], crystal: ['#24315e', '#0b1026'], metal: ['#3c4654', '#12161c'], gradient: ['#4a1c6e', '#0f1b4a'],
      galaxy: ['#1b0f45', '#03020c'], energy: ['#003a4a', '#00080f'], rainbow: ['#3a1257', '#0c2340'], holo: ['#25205a', '#0a2a3a'],
      lava: ['#5a1404', '#140200'], gold: ['#4a3606', '#140d00'], marble: ['#3e3b45', '#141218'], circuit: ['#06302a', '#010d0b'],
      bubble: ['#3a2a4a', '#0e0a14'], ocean: ['#0b4f6e', '#021624'], cheese: ['#5a3a0a', '#1e1204'], wool: ['#4a2a3a', '#170d14'], stained: ['#3d0f3a', '#0e1838']
    },
    /** v1.16: desenho discreto do fundo para cada estilo (estilo escolhido OU transformação). Só CSS parado
     *  (sem animação, custo quase zero); fica atrás de tudo, nunca sobre o tabuleiro. Motivos compartilhados por família. */
    MOTIF: (function () {
      var bubbles = 'radial-gradient(circle at 12% 78%, rgba(255,255,255,.10) 0 18px, transparent 19px), radial-gradient(circle at 86% 64%, rgba(255,255,255,.08) 0 30px, transparent 31px), radial-gradient(circle at 74% 12%, rgba(255,255,255,.07) 0 12px, transparent 13px), radial-gradient(circle at 22% 22%, rgba(255,255,255,.06) 0 8px, transparent 9px), radial-gradient(circle at 50% 92%, rgba(255,255,255,.07) 0 14px, transparent 15px)';
      var lines = 'repeating-linear-gradient(0deg, rgba(120,220,255,.07) 0 1px, transparent 1px 44px), repeating-linear-gradient(90deg, rgba(255,90,220,.06) 0 1px, transparent 1px 44px)';
      var rock = 'repeating-linear-gradient(118deg, rgba(255,255,255,.05) 0 2px, transparent 2px 70px), repeating-linear-gradient(28deg, rgba(0,0,0,.12) 0 3px, transparent 3px 90px)';
      var frost = 'linear-gradient(135deg, rgba(200,240,255,.14) 0%, transparent 30%), repeating-linear-gradient(60deg, rgba(220,245,255,.05) 0 1px, transparent 1px 26px), repeating-linear-gradient(-60deg, rgba(220,245,255,.05) 0 1px, transparent 1px 26px)';
      var sprinkles = 'radial-gradient(circle at 10% 20%, rgba(255,140,190,.22) 0 3px, transparent 4px), radial-gradient(circle at 80% 30%, rgba(140,220,255,.2) 0 3px, transparent 4px), radial-gradient(circle at 30% 85%, rgba(255,230,120,.2) 0 3px, transparent 4px), radial-gradient(circle at 70% 75%, rgba(160,255,190,.2) 0 3px, transparent 4px), radial-gradient(circle at 50% 8%, rgba(255,255,255,.16) 0 2px, transparent 3px)';
      var grain = 'repeating-linear-gradient(90deg, rgba(0,0,0,.10) 0 2px, transparent 2px 18px, rgba(255,220,170,.05) 18px 19px, transparent 19px 37px)';
      var stars = 'radial-gradient(circle at 15% 25%, rgba(255,255,255,.6) 0 1px, transparent 2px), radial-gradient(circle at 75% 15%, rgba(255,255,255,.5) 0 1px, transparent 2px), radial-gradient(circle at 60% 80%, rgba(255,255,255,.45) 0 1px, transparent 2px), radial-gradient(circle at 30% 65%, rgba(200,180,255,.5) 0 1.5px, transparent 2.5px), radial-gradient(circle at 90% 50%, rgba(255,255,255,.4) 0 1px, transparent 2px), radial-gradient(circle at 45% 35%, rgba(255,255,255,.35) 0 1px, transparent 2px)';
      var heat = 'radial-gradient(120% 40% at 50% 105%, rgba(255,120,30,.28), transparent 70%)';
      var glow = 'radial-gradient(90% 60% at 50% 50%, transparent 55%, rgba(0,0,0,.35) 100%)';
      return { ocean: bubbles, jelly: bubbles, bubble: bubbles, glossy: bubbles, neon: lines, circuit: lines, pixel: lines, energy: lines,
        stone: rock, marble: rock, metal: rock, crystal: frost, ice: frost, candy: sprinkles, wood: grain,
        cheese: sprinkles, wool: glow, galaxy: stars, holo: stars, rainbow: stars, gradient: stars, lava: heat, gold: heat, fur: glow, stained: glow };
    })(),
    /** v1.16: estilos com desenho marcado são espelhados conforme a casa, para não parecer carimbo repetido. */
    VARY: { lava: 1, energy: 1, stone: 1, marble: 1, wood: 1, ocean: 1, crystal: 1, circuit: 1 },
    ids: LIST.map(function (s) { return s.id; }),
    rareIds: LIST.filter(function (s) { return s.rare; }).map(function (s) { return s.id; }),
    isCustom: function (id) { return !!BREAK_MS[id]; },          // tem quebra própria
    hasArt: function (id) { return id !== 'classic' && id !== 'theme' && LIST.some(function (x) { return x.id === id; }); }, // desenho próprio
    isLive: function (id) { return !!LIVE[id]; },
    breakMs: function (id) { return BREAK_MS[id] || 320; },
    drawBlock: drawBlock, drawLive: drawLive, drawBreak: drawBreak, drawSymbol: drawSymbol
  };
})(this);
