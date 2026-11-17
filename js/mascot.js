/* v1.30 (laboratório, chave mascote) — MASCOTE "Kabloquinho": um bloquinho original sentado em cima do tabuleiro, que reage às jogadas.
 * Humores: idle (pisca), happy (pula), wow (pulo alto + olhos grandes), sad (combo perdido / fim), sweat (tabuleiro quase cheio), fire (Febre).
 * Desenho próprio (SVG fixo, sem texto de fora). O app chama MZMascot.mount(box), .react(humor, ms) e .base(humor). */
(function (root) {
  'use strict';
  var SVG = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
    '<defs><linearGradient id="kbq-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#ff9a1e"/></linearGradient></defs>' +
    '<ellipse class="kbq-shadow" cx="32" cy="60" rx="18" ry="3" fill="rgba(0,0,0,.28)"/>' +
    '<g class="kbq-flame"><path d="M32 2 C26 9 27 13 30 15 C27 13 24 10 25 6 C20 12 22 18 32 19 C42 18 43 11 38 6 C39 10 37 13 34 15 C37 12 37 7 32 2Z" fill="#ff7a1a"/><path d="M32 8 C29 12 30 15 32 16 C34 15 35 12 32 8Z" fill="#ffe066"/></g>' +
    '<g class="kbq-body"><rect x="8" y="14" width="48" height="42" rx="12" fill="url(#kbq-body)" stroke="#1a1404" stroke-width="3"/>' +
    '<rect x="14" y="18" width="16" height="5" rx="2.5" fill="#fff" opacity=".55"/>' +
    '<circle cx="17" cy="42" r="3.4" fill="#ff6b8a" opacity=".55"/><circle cx="47" cy="42" r="3.4" fill="#ff6b8a" opacity=".55"/>' +
    '<g class="kbq-e kbq-e-idle"><ellipse cx="24" cy="34" rx="3.6" ry="4.6" fill="#1a1404"/><ellipse cx="40" cy="34" rx="3.6" ry="4.6" fill="#1a1404"/><circle cx="25.2" cy="32.4" r="1.2" fill="#fff"/><circle cx="41.2" cy="32.4" r="1.2" fill="#fff"/></g>' +
    '<g class="kbq-e kbq-e-happy" fill="none" stroke="#1a1404" stroke-width="3" stroke-linecap="round"><path d="M19.5 35 Q24 29 28.5 35"/><path d="M35.5 35 Q40 29 44.5 35"/></g>' +
    '<g class="kbq-e kbq-e-wow"><circle cx="24" cy="33" r="6" fill="#fff" stroke="#1a1404" stroke-width="2.5"/><circle cx="40" cy="33" r="6" fill="#fff" stroke="#1a1404" stroke-width="2.5"/><circle cx="24" cy="33" r="2.8" fill="#1a1404"/><circle cx="40" cy="33" r="2.8" fill="#1a1404"/></g>' +
    '<g class="kbq-e kbq-e-sad" fill="none" stroke="#1a1404" stroke-width="3" stroke-linecap="round"><path d="M20 36 Q24 31.5 28 34"/><path d="M44 36 Q40 31.5 36 34"/></g>' +
    '<g class="kbq-e kbq-e-sleep" fill="none" stroke="#1a1404" stroke-width="3" stroke-linecap="round"><path d="M19.5 34 Q24 37.5 28.5 34"/><path d="M35.5 34 Q40 37.5 44.5 34"/></g>' +
    '<ellipse class="kbq-m kbq-m-sleep" cx="32" cy="45.5" rx="2.6" ry="2.2" fill="#7a1f2b" stroke="#1a1404" stroke-width="2"/>' +
    '<path class="kbq-m kbq-m-idle" d="M27 44 Q32 48 37 44" fill="none" stroke="#1a1404" stroke-width="2.8" stroke-linecap="round"/>' +
    '<path class="kbq-m kbq-m-happy" d="M25 42 Q32 52 39 42 Z" fill="#7a1f2b" stroke="#1a1404" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<ellipse class="kbq-m kbq-m-wow" cx="32" cy="46" rx="4" ry="5" fill="#7a1f2b" stroke="#1a1404" stroke-width="2.4"/>' +
    '<path class="kbq-m kbq-m-sad" d="M27 48 Q32 43 37 48" fill="none" stroke="#1a1404" stroke-width="2.8" stroke-linecap="round"/>' +
    '<g class="kbq-hat"><path d="M14 18 C18 4 40 -2 52 10 L56 18 Z" fill="#e8243c" stroke="#1a1404" stroke-width="2.5" stroke-linejoin="round"/><rect x="10" y="15" width="44" height="7" rx="3.5" fill="#fff" stroke="#1a1404" stroke-width="2"/><circle cx="55" cy="10" r="4.5" fill="#fff" stroke="#1a1404" stroke-width="2"/></g></g>' + // v1.30: gorro de Natal (classe xmas), dentro do corpo para pular junto
    '<g class="kbq-zzz" fill="#fff" stroke="#1a1404" stroke-width="1.6" paint-order="stroke" font-family="sans-serif" font-weight="900"><text x="44" y="15" font-size="13">z</text><text x="53" y="8" font-size="10">z</text></g>' + // v1.30: dormindo
    '<path class="kbq-sweat" d="M52 16 C49 21 49 24 52 25 C55 24 55 21 52 16Z" fill="#8fd8ff" stroke="#1a1404" stroke-width="1.5"/>' +
    '</svg>';
  var MOODS = ['idle', 'happy', 'wow', 'sad', 'sweat', 'fire', 'sleep'];
  /** Cria um Kabloquinho (o do jogo é o principal; a tela inicial ganha outro com MZMascot.create()). */
  function create() {
    var el = null, baseMood = 'idle', timer = 0, onTap = null;
    function set(m) { if (!el) return; MOODS.forEach(function (k) { el.classList.toggle('kbq-' + k, k === m); }); el.classList.remove('kbq-bump'); void el.offsetWidth; el.classList.add('kbq-bump'); }
    var me = {
      MOODS: MOODS,
      /** Coloca o mascote dentro de `box` (uma vez). tap = função ao tocar nele. */
      mount: function (box, tap) {
        if (el || !box) return el; onTap = tap || null;
        el = document.createElement('button'); el.type = 'button'; el.className = 'kbq kbq-idle'; el.setAttribute('aria-label', 'Kabloquinho');
        uid++; el.innerHTML = SVG.replace('id="kbq-body"', 'id="kbq-g' + uid + '"').replace('url(#kbq-body)', 'url(#kbq-g' + uid + ')'); // desenho fixo; degradê com id próprio por cópia
        el.addEventListener('click', function (e) { e.stopPropagation(); me.react('happy', 900); if (onTap) onTap(); });
        box.appendChild(el); return el;
      },
      /** Humor de fundo (volta para ele depois de cada reação). */
      base: function (m) { if (MOODS.indexOf(m) < 0) m = 'idle'; if (m === baseMood) return; baseMood = m; if (!timer) set(m); },
      /** Reação curta: humor por `ms` milissegundos, depois volta ao de fundo. */
      react: function (m, ms) { if (!el || MOODS.indexOf(m) < 0) return; clearTimeout(timer); set(m); timer = setTimeout(function () { timer = 0; set(baseMood); }, ms || 900); },
      show: function (on) { if (el) el.hidden = !on; },
      /** Olhos seguem um ponto da tela (x, y em pixels); sem argumentos, voltam ao centro. */
      look: function (x, y) {
        if (!el) return;
        if (x == null) { el.style.removeProperty('--lx'); el.style.removeProperty('--ly'); return; }
        var r = el.getBoundingClientRect(), dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), d = Math.max(1, Math.hypot(dx, dy));
        el.style.setProperty('--lx', (2.6 * dx / d).toFixed(2) + 'px'); el.style.setProperty('--ly', (2.2 * dy / d).toFixed(2) + 'px');
      },
      /** Roupa da época: 'xmas' (gorro de Natal) ou nada. */
      outfit: function (k) { if (el) el.classList.toggle('xmas', k === 'xmas'); },
      get mood() { if (!el) return null; for (var i = 0; i < MOODS.length; i++) if (el.classList.contains('kbq-' + MOODS[i])) return MOODS[i]; return null; },
      get el() { return el; }
    };
    return me;
  }
  var uid = 0, api = create();
  api.create = create;
  /** SVG sozinho (para virar imagem, ex.: na imagem de compartilhar), já com o humor escolhido. */
  api.svgFor = function (mood) {
    if (MOODS.indexOf(mood) < 0) mood = 'happy';
    var css = '<style>.kbq-e,.kbq-m,.kbq-sweat,.kbq-flame,.kbq-hat,.kbq-zzz{display:none}.kbq-e-' + mood + ',.kbq-m-' + mood + '{display:inline}</style>';
    return SVG.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" ').replace('aria-hidden="true" focusable="false">', '>' + css);
  };
  root.MZMascot = api;
})(this);
