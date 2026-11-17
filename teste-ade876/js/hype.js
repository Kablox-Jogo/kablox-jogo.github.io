/* v1.30 (laboratório, chave `hype`) — FALAS ANIMADAS: "INCRÍVEL!", "INSANO!", "ÉPICO!"…
 * Pedido do dono (15/11): "falas animadas, tipo crazy, amazing".
 * - pick(): escolhe a fala pela força da jogada (1 a 4), sem repetir a anterior. Combo alto e limpeza perfeita têm falas próprias.
 * - build(): monta a fala letra por letra (cada letra pula sozinha), com raios de luz atrás nas jogadas grandes.
 * - Vozes gravadas (quando existirem): assets/voz/vozes.json lista os arquivos; MZVoice toca a fala certa (feminina/masculina).
 *   Sem o arquivo, nada quebra: fica o som de "apresentador" sintetizado (Sound.hype).
 * Puro o bastante para rodar no node (tests/hype.test.js). */
(function (root) {
  'use strict';
  // Chave = texto em português (traduzido com T no app). v = nome do arquivo de voz (docs VOZES-PARA-GRAVAR + novas).
  var WORDS = {
    1: [{ k: 'Boa!', v: 'boa' }, { k: 'Show!', v: 'show' }, { k: 'Muito bom!', v: 'muito_bom' }],
    2: [{ k: 'Mandou bem!', v: 'mandou_bem' }, { k: 'Ótimo!', v: 'otimo' }, { k: 'Arrasou!', v: 'arrasou' }],
    3: [{ k: 'Incrível!', v: 'incrivel' }, { k: 'Insano!', v: 'insano' }, { k: 'Brabo!', v: 'brabo' }, { k: 'Absurdo!', v: 'absurdo' }],
    4: [{ k: 'Épico!', v: 'epico' }, { k: 'Fantástico!', v: 'fantastico' }, { k: 'Monstro!', v: 'monstro' }, { k: 'Que isso?!', v: 'que_isso' }]
  };
  var SPECIAL = {
    unstoppable: { k: 'Imparável!', v: 'imparavel', t: 4 },  // combo 7+
    legendary: { k: 'Lendário!', v: 'lendario', t: 4 },      // combo 10+
    clear: { k: 'Limpeza perfeita!', v: 'limpeza_perfeita', t: 4 },
    record: { k: 'Novo recorde!', v: 'novo_recorde', t: 4 },
    smooth: { k: 'Suave!', v: 'suave', t: 1 },               // 3 jogadas seguidas limpando
    fever: { k: 'Febre!', v: 'febre', t: 4 }                 // v1.30: Modo Febre (chave febre)
  };
  var last = '';
  /** Escolhe a fala. tier 1..4 = força da jogada. opts: { combo, boardClear, streak }. rng opcional (testes). */
  function pick(tier, opts, rng) {
    opts = opts || {}; rng = rng || Math.random;
    tier = Math.max(1, Math.min(4, Math.floor(+tier) || 1));
    var w;
    if (opts.boardClear) w = SPECIAL.clear;
    else if ((opts.combo | 0) >= 10) w = SPECIAL.legendary;
    else if ((opts.combo | 0) >= 7) w = SPECIAL.unstoppable;
    else if (opts.streak && tier <= 2 && rng() < 0.35) w = SPECIAL.smooth;
    else {
      var list = WORDS[tier], i = Math.floor(rng() * list.length);
      if (list[i].k === last) i = (i + 1) % list.length; // nunca a mesma fala duas vezes seguidas
      w = { k: list[i].k, v: list[i].v, t: tier };
    }
    last = w.k;
    return { key: w.k, voice: w.v, tier: w.t || tier };
  }
  function allKeys() { var out = []; for (var t in WORDS) WORDS[t].forEach(function (w) { out.push(w.k); }); for (var s in SPECIAL) out.push(SPECIAL[s].k); return out; }
  function allVoices() { var out = []; for (var t in WORDS) WORDS[t].forEach(function (w) { out.push(w.v); }); for (var s in SPECIAL) out.push(SPECIAL[s].v); return out; }

  /** Monta o elemento da fala (só textContent — nada de HTML vindo de fora). sub = linha pequena embaixo (ex.: "+500"). */
  function build(doc, text, tier, sub) {
    var box = doc.createElement('span'); box.className = 'hype-in';
    if (tier >= 3) { var rays = doc.createElement('span'); rays.className = 'hype-rays'; rays.setAttribute('aria-hidden', 'true'); box.appendChild(rays); }
    var word = doc.createElement('span'); word.className = 'hype-word';
    var chars = Array.from ? Array.from(String(text)) : String(text).split('');
    if (chars.length > 12) box.classList.add('long'); // "Limpeza perfeita!": um pouco menor para caber no tabuleiro
    box.style.setProperty('--st', Math.round(Math.min(40, 300 / Math.max(1, chars.length))) + 'ms'); // v1.30: palavra longa entra inteira em ~0,3 s
    chars.forEach(function (ch, i) {
      var s = doc.createElement('span'); s.className = ch === ' ' ? 'hl sp' : 'hl';
      s.textContent = ch === ' ' ? ' ' : ch; s.style.setProperty('--i', i);
      word.appendChild(s);
    });
    box.appendChild(word);
    if (sub) { var sm = doc.createElement('small'); sm.className = 'hype-sub'; sm.textContent = String(sub); box.appendChild(sm); }
    if (tier >= 3) for (var k = 0; k < 6; k++) { var sp = doc.createElement('span'); sp.className = 'hype-spark'; sp.style.setProperty('--k', k); sp.setAttribute('aria-hidden', 'true'); box.appendChild(sp); }
    return box;
  }

  /* ---------- vozes gravadas (opcional) ---------- */
  var Voice = {
    list: null, buffers: {}, loading: false, gender: 'f',
    /** Lê assets/voz/vozes.json (lista de arquivos). Sem o arquivo: vozes desligadas, sem erro. */
    init: function (fetchFn) {
      if (this.loading || this.list) return; this.loading = true; var self = this;
      try {
        (fetchFn || root.fetch)('assets/voz/vozes.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) { self.list = j && Array.isArray(j.arquivos) ? j.arquivos.filter(function (f) { return /^(pt|en)_[a-z_]+_[fm]\.(mp3|m4a|ogg|wav)$/.test(f); }) : []; })
          .catch(function () { self.list = []; });
      } catch (e) { this.list = []; }
    },
    /** Nome do arquivo para a fala, ou null. Prefere o gênero escolhido; se faltar, usa o outro. */
    fileFor: function (lang, voice) {
      if (!this.list || !this.list.length) return null;
      var pre = (lang === 'pt' ? 'pt' : 'en') + '_' + voice + '_', g = this.gender === 'm' ? ['m', 'f'] : ['f', 'm'], self = this;
      for (var i = 0; i < g.length; i++) { var hit = self.list.filter(function (f) { return f.indexOf(pre + g[i] + '.') === 0; })[0]; if (hit) return hit; }
      return null;
    },
    has: function (lang, voice) { return !!this.fileFor(lang, voice); }
  };

  /* ---------- v1.30: voz do próprio celular (sem gravação) ----------
     Usa a voz de leitura do aparelho (speechSynthesis). Se não houver voz no idioma, fica calado (o som sintetizado continua). */
  var PREFER = /google|luciana|francisca|felipe|daniel|samantha|natural|neural|premium|enhanced/i;
  var Speak = {
    lastAt: 0,
    /** Escolhe a melhor voz para o idioma ('pt' ou 'en') numa lista de vozes do aparelho. Puro (testado no node). */
    pickVoice: function (voices, lang) {
      var want = lang === 'pt' ? 'pt-br' : 'en-us', base = want.slice(0, 2), list = (voices || []).filter(function (v) { return v && typeof v.lang === 'string' && v.lang.toLowerCase().replace('_', '-').indexOf(base) === 0; });
      if (!list.length) return null;
      function score(v) { var l = v.lang.toLowerCase().replace('_', '-'), sc = 0; if (l === want) sc += 4; if (PREFER.test(v.name || '')) sc += 2; if (v.localService) sc += 1; if (/compact|eloquence/i.test(v.name || '')) sc -= 3; return sc; }
      return list.slice().sort(function (a, b) { return score(b) - score(a); })[0];
    },
    supported: function () { return !!(root.speechSynthesis && root.SpeechSynthesisUtterance); },
    /** Fala o texto com empolgação. Volta true se começou a falar. vol 0..1. */
    say: function (text, lang, tier, vol) {
      if (!this.supported() || !(vol > 0)) return false;
      var now = Date.now(); if (now - this.lastAt < 900) return false; // nunca uma fala em cima da outra
      var v = this.pickVoice(root.speechSynthesis.getVoices(), lang); if (!v) return false;
      try {
        root.speechSynthesis.cancel();
        var u = new root.SpeechSynthesisUtterance(String(text).replace(/[!?]+/g, '!'));
        u.voice = v; u.lang = v.lang; u.rate = 1.12; u.pitch = tier >= 4 ? 1.35 : 1.2; u.volume = Math.max(0, Math.min(1, vol));
        root.speechSynthesis.speak(u); this.lastAt = now; return true;
      } catch (e) { return false; }
    },
    /** Pede a lista de vozes cedo (no Chrome ela chega depois). */
    warm: function () { try { if (this.supported()) { root.speechSynthesis.getVoices(); root.speechSynthesis.onvoiceschanged = function () { root.speechSynthesis.getVoices(); }; } } catch (e) {} }
  };

  var api = { WORDS: WORDS, SPECIAL: SPECIAL, pick: pick, build: build, allKeys: allKeys, allVoices: allVoices, Voice: Voice, Speak: Speak, _reset: function () { last = ''; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZHype = api;
})(this);
