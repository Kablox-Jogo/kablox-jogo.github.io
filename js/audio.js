/* Kablox — sons e música sintetizados (Web Audio; nenhum arquivo de áudio) */
(function (root) {
  'use strict';

  var ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  var MAX_VOICES = 24, sfxVol = 1, musicVol = 0.8;
  var musicTimer = 0, nextNote = 0, step = 0, musicLp = null, calm = false; // v1.26: calm = Zen (som calmo)
  var theme = { root: 57, scale: [0, 2, 4, 7, 9] };

  var Sound = {
    sfxOn: true,
    musicOn: false, // v1.21.3: música só toca depois que as opções salvas mandarem (antes começava ligada por padrão)

    unlock: function () {
      try {
        if (!ctx) {
          var AC = root.AudioContext || root.webkitAudioContext;
          if (!AC) return;
          ctx = new AC();
          master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
          sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
          // música: filtro suave + eco curto
          musicBus = ctx.createGain(); musicBus.gain.value = 0.0;
          var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; musicLp = lp;
          var delay = ctx.createDelay(1); delay.delayTime.value = 0.36;
          var fb = ctx.createGain(); fb.gain.value = 0.32;
          var wet = ctx.createGain(); wet.gain.value = 0.28;
          musicBus.connect(lp); lp.connect(master);
          lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
        }
        if (ctx.state === 'suspended') ctx.resume();
        this.updateMusic();
      } catch (e) { /* sem áudio */ }
    },

    setSfx: function (on) { this.sfxOn = on; },
    setMusic: function (on) { this.musicOn = on; this.updateMusic(); },
    setTheme: function (t) { if (t && t.music) theme = t.music; },

    suspend: function () { try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) {} },
    resume: function () { try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {} },

    // limite de sons ao mesmo tempo (evita "embolar" e pesar em celulares simples)
    _voices: [],
    _slot: function (t, dur) {
      var now = ctx.currentTime;
      this._voices = this._voices.filter(function (end) { return end > now; });
      if (this._voices.length >= MAX_VOICES) return false;
      this._voices.push(t + dur);
      return true;
    },
    /** v1.26 (dono): Zen com som calmo — música só com acordes e arpejo suave (sem batida nem baixo) e efeitos mais baixos. */
    setCalm: function (on) {
      on = !!on; if (on === calm) return; calm = on;
      if (sfxBus) sfxBus.gain.value = sfxVol * (calm ? 0.6 : 1);
    },
    get calm() { return calm; },
    setVolume: function (sfx, music) {
      sfxVol = sfx; musicVol = music;
      if (sfxBus) sfxBus.gain.value = sfxVol * (calm ? 0.6 : 1);
      this.updateMusic();
    },

    _tone: function (freq, opt) {
      if (!ctx || !this.sfxOn || sfxVol <= 0) return;
      opt = opt || {};
      var t = ctx.currentTime + (opt.delay || 0);
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = opt.type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + (opt.dur || 0.15));
      var vol = (opt.vol || 0.12) * (this._gk || 1), dur = opt.dur || 0.15;
      if (!this._slot(t, dur)) return;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(opt.bus || sfxBus);
      o.start(t); o.stop(t + dur + 0.05);
    },

    _noise: function (opt) { // ruído filtrado (gelo, pedra, pelúcia, madeira)
      if (!ctx || !this.sfxOn || sfxVol <= 0) return;
      opt = opt || {};
      var t = ctx.currentTime + (opt.delay || 0), dur = opt.dur || 0.2;
      if (!this._slot(t, dur)) return;
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      var src = ctx.createBufferSource(); src.buffer = noiseBuf;
      var f = ctx.createBiquadFilter(); f.type = opt.filter || 'lowpass'; f.frequency.value = opt.freq || 800; f.Q.value = opt.q || 0.8;
      if (opt.toFreq) f.frequency.exponentialRampToValueAtTime(opt.toFreq, t + dur);
      var g = ctx.createGain(), vol = (opt.vol || 0.2) * (this._gk || 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (opt.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(sfxBus);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    },

    /** Som de quebra próprio de cada estilo de bloco. */
    breakSkin: function (skin, lines) {
      // v1.25: volumes acertados para nenhuma quebra ficar alta ou baixa demais (medido com tools/sound_check.py)
      this._gk = { lava: 0.6, stone: 0.65, circuit: 1.5, rainbow: 1.5, holo: 1.5, energy: 1.5, galaxy: 1.45, fur: 1.4, wool: 1.4 }[skin] || 1;
      try { this._breakSkin(skin, lines); } finally { this._gk = 1; }
    },
    _breakSkin: function (skin, lines) {
      var n = Math.min(lines || 1, 4), i;
      if (skin === 'ice') {
        this._noise({ filter: 'highpass', freq: 3500, dur: 0.18, vol: 0.12 });
        for (i = 0; i < 4 + n * 2; i++) this._tone(2200 + Math.random() * 2600, { dur: 0.12 + Math.random() * 0.15, vol: 0.05, delay: 0.02 + i * 0.035 + Math.random() * 0.02 });
      } else if (skin === 'stone') {
        this._noise({ filter: 'bandpass', freq: 2200, q: 1.5, dur: 0.06, vol: 0.18 });           // trinca
        this._noise({ filter: 'lowpass', freq: 900, toFreq: 200, dur: 0.45, vol: 0.32, delay: 0.16 }); // desmorona
        this._tone(95, { to: 48, dur: 0.35, vol: 0.2, delay: 0.16, type: 'sine' });
        for (i = 0; i < n + 2; i++) this._noise({ filter: 'bandpass', freq: 600 + Math.random() * 900, q: 3, dur: 0.05, vol: 0.12, delay: 0.3 + i * 0.07 + Math.random() * 0.04 });
      } else if (skin === 'fur' || skin === 'wool') {
        this._noise({ filter: 'bandpass', freq: 700, toFreq: 300, q: 0.7, dur: 0.28, vol: 0.18, attack: 0.03 });
        this._tone(520, { to: 780, dur: 0.12, vol: 0.04, delay: 0.05 });
      } else if (skin === 'jelly' || skin === 'cheese') {
        this._tone(320, { to: 110, dur: 0.22, vol: 0.14, type: 'sine' });
        this._tone(180, { to: 420, dur: 0.18, vol: 0.08, type: 'triangle', delay: 0.16 });
        for (i = 0; i < 3; i++) this._tone(900 + Math.random() * 500, { to: 500, dur: 0.06, vol: 0.04, delay: 0.25 + i * 0.05 });
      } else if (skin === 'neon') {
        this._tone(1400, { to: 160, dur: 0.22, vol: 0.06, type: 'sawtooth' });
        this._tone(700, { to: 90, dur: 0.25, vol: 0.05, type: 'square', delay: 0.03 });
        this._noise({ filter: 'highpass', freq: 5000, dur: 0.08, vol: 0.06 });
      } else if (skin === 'candy') {
        this._tone(620, { to: 1250, dur: 0.1, vol: 0.12 });
        for (i = 0; i < 5; i++) this._tone(1800 + i * 300, { dur: 0.08, vol: 0.035, delay: 0.08 + i * 0.04 });
      } else if (skin === 'pixel') {
        var notes = [523, 659, 784, 1047, 1319];
        for (i = 0; i < Math.min(5, 2 + n); i++) this._tone(notes[i], { dur: 0.07, vol: 0.05, type: 'square', delay: i * 0.055 });
        this._noise({ filter: 'highpass', freq: 3000, dur: 0.12, vol: 0.05, delay: 0.05 });
      } else if (skin === 'crystal') { // vidro: estalo agudo e sininhos
        this._noise({ filter: 'highpass', freq: 4500, dur: 0.12, vol: 0.1 });
        for (i = 0; i < 3 + n * 2; i++) this._tone([2093, 2637, 3136, 3520][i % 4] * (1 + Math.random() * 0.02), { dur: 0.25, vol: 0.04, delay: 0.03 + i * 0.045 });
      } else if (skin === 'metal') { // metal: batida e ressonância
        this._tone(420, { to: 380, dur: 0.4, vol: 0.08, type: 'triangle' });
        this._tone(1130, { dur: 0.3, vol: 0.04, type: 'sine', delay: 0.01 });
        this._noise({ filter: 'bandpass', freq: 3200, q: 3, dur: 0.06, vol: 0.12 });
      } else if (skin === 'galaxy') { // galáxia: brilho subindo
        for (i = 0; i < 4 + n; i++) this._tone(midi(theme.root + 24 + [0, 4, 7, 11, 14, 19, 24][i % 7]), { dur: 0.22, vol: 0.035, type: 'sine', delay: i * 0.05 });
      } else if (skin === 'energy') { // descarga elétrica
        this._noise({ filter: 'bandpass', freq: 2600, toFreq: 900, q: 2, dur: 0.18, vol: 0.12 });
        this._tone(220, { to: 880, dur: 0.16, vol: 0.05, type: 'sawtooth' });
      } else if (skin === 'rainbow' || skin === 'holo') { // brilho em escala
        for (i = 0; i < 3 + n; i++) this._tone(midi(theme.root + 19 + [0, 2, 4, 7, 9, 12, 14][i % 7]), { dur: 0.16, vol: 0.04, type: 'triangle', delay: i * 0.04 });
      } else if (skin === 'lava') { // estrondo grave com chiado
        this._tone(90, { to: 45, dur: 0.4, vol: 0.18, type: 'sine' }); this._noise({ filter: 'lowpass', freq: 1200, toFreq: 300, dur: 0.4, vol: 0.12 });
      } else if (skin === 'gold') { // moedas
        for (i = 0; i < 2 + n; i++) { this._tone(1975, { dur: 0.12, vol: 0.05, delay: i * 0.06 }); this._tone(2637, { dur: 0.1, vol: 0.035, delay: i * 0.06 + 0.02 }); }
      } else if (skin === 'bubble' || skin === 'ocean') { // estouro de bolhas
        for (i = 0; i < 3 + n; i++) this._tone(600 + Math.random() * 500, { to: 1400, dur: 0.05, vol: 0.06, type: 'sine', delay: i * 0.05 });
      } else if (skin === 'circuit') { // bipes
        for (i = 0; i < 3 + n; i++) this._tone([880, 1320, 1760][i % 3], { dur: 0.05, vol: 0.04, type: 'square', delay: i * 0.05 });
      } else if (skin === 'stained' || skin === 'marble') { // vidro / pedra polida
        this._noise({ filter: 'highpass', freq: skin === 'stained' ? 4000 : 2000, dur: 0.1, vol: 0.1 });
        for (i = 0; i < 3; i++) this._tone((skin === 'stained' ? 1760 : 880) * (1 + i * 0.5), { dur: 0.2, vol: 0.035, delay: 0.03 + i * 0.05 });
      } else if (skin === 'glossy' || skin === 'gradient') { // estouro macio
        this._tone(500, { to: 900, dur: 0.09, vol: 0.09, type: 'sine' });
        this._noise({ filter: 'bandpass', freq: 1800, q: 1.2, dur: 0.05, vol: 0.06 });
      } else if (skin === 'wood') {
        this._tone(210, { dur: 0.08, vol: 0.18, type: 'triangle' });
        this._noise({ filter: 'bandpass', freq: 1300, q: 2, dur: 0.05, vol: 0.16 });
        for (i = 0; i < n + 1; i++) this._noise({ filter: 'bandpass', freq: 1800 + Math.random() * 800, q: 4, dur: 0.04, vol: 0.1, delay: 0.12 + i * 0.06 });
      }
    },

    /** Som ao colocar a peça, de acordo com o estilo. */
    placeSkin: function (skin) {
      if (skin === 'ice') { this._tone(1900, { dur: 0.08, vol: 0.06 }); this._tone(2850, { dur: 0.06, vol: 0.03, delay: 0.01 }); }
      else if (skin === 'stone') { this._noise({ filter: 'lowpass', freq: 500, dur: 0.12, vol: 0.22 }); this._tone(110, { dur: 0.1, vol: 0.12 }); }
      else if (skin === 'fur' || skin === 'wool') this._noise({ filter: 'bandpass', freq: 500, q: 0.8, dur: 0.12, vol: 0.3, attack: 0.02 });
      else if (skin === 'jelly' || skin === 'cheese') this._tone(260, { to: 200, dur: 0.12, vol: 0.12 });
      else if (skin === 'neon') this._tone(880, { to: 1320, dur: 0.06, vol: 0.05, type: 'square' });
      else if (skin === 'candy') this._tone(900, { to: 1200, dur: 0.06, vol: 0.08 });
      else if (skin === 'pixel') this._tone(660, { dur: 0.05, vol: 0.05, type: 'square' });
      else if (skin === 'crystal') { this._tone(2349, { dur: 0.1, vol: 0.05 }); this._tone(3136, { dur: 0.08, vol: 0.03, delay: 0.02 }); }
      else if (skin === 'metal') { this._tone(330, { dur: 0.12, vol: 0.1, type: 'triangle' }); this._noise({ filter: 'bandpass', freq: 3000, q: 3, dur: 0.04, vol: 0.08 }); }
      else if (skin === 'galaxy') { this._tone(1320, { to: 1760, dur: 0.12, vol: 0.07, type: 'sine' }); }
      else if (skin === 'energy') { this._tone(660, { to: 1320, dur: 0.07, vol: 0.09, type: 'sawtooth' }); }
      else if (skin === 'rainbow' || skin === 'holo') { this._tone(1046, { dur: 0.08, vol: 0.08, type: 'triangle' }); this._tone(1568, { dur: 0.08, vol: 0.05, delay: 0.03 }); }
      else if (skin === 'gold') { this._tone(1975, { dur: 0.08, vol: 0.05 }); }
      else if (skin === 'bubble' || skin === 'ocean') { this._tone(700, { to: 1100, dur: 0.06, vol: 0.06, type: 'sine' }); }
      else if (skin === 'circuit') { this._tone(1320, { dur: 0.05, vol: 0.06, type: 'square' }); }
      else if (skin === 'lava') { this._tone(120, { dur: 0.1, vol: 0.14, type: 'sine' }); }
      else if (skin === 'glossy') { this._tone(420, { to: 640, dur: 0.07, vol: 0.1, type: 'sine' }); }
      else if (skin === 'wood') { this._tone(240, { dur: 0.06, vol: 0.16, type: 'triangle' }); this._noise({ filter: 'bandpass', freq: 1500, q: 2, dur: 0.03, vol: 0.1 }); }
      else this.place();
    },

    /** Transformação surpresa: varredura brilhante subindo (mais longa quando é especial). */
    transform: function (big) {
      this._noise({ filter: 'bandpass', freq: 1200, toFreq: 6000, q: 0.8, dur: big ? 0.7 : 0.45, vol: 0.06, attack: 0.08 });
      var notes = big ? [0, 4, 7, 11, 14, 19] : [0, 7, 12, 16];
      for (var i = 0; i < notes.length; i++) this._tone(midi(theme.root + 12 + notes[i]), { dur: 0.25, vol: 0.045, type: 'sine', delay: 0.05 + i * 0.07 });
    },

    /** Combo: duas notas subindo, mais agudas a cada nível. */
    combo: function (n) { // v1.24 (dono): sobe um degrau da escala a cada combo — dá vontade de continuar
      var sc = theme.scale, k = Math.min(Math.max(n, 2), 14) - 2, deg = sc[k % sc.length] + 12 * Math.floor(k / sc.length);
      var r = theme.root + 12 + deg;
      this._tone(midi(r), { dur: 0.12, vol: 0.06, type: 'triangle', delay: 0.12 });
      this._tone(midi(r + 7), { dur: 0.16, vol: 0.055, type: 'triangle', delay: 0.19 });
      this._tone(midi(r + 12), { dur: 0.22, vol: 0.05, type: 'sine', delay: 0.26 });
      if (n >= 5) this._noise({ filter: 'highpass', freq: 6500, dur: 0.3, vol: 0.03, attack: 0.05, delay: 0.24 });
    },
    /** Pontuação alta numa jogada: brilho curto. */
    bigScore: function () {
      for (var i = 0; i < 3; i++) this._tone(1568 + i * 392, { dur: 0.1, vol: 0.06, delay: 0.3 + i * 0.05 });
    },
    /** Tabuleiro limpo: acorde subindo + brilho. */
    boardClear: function () {
      var r = theme.root + 12;
      [0, 4, 7, 12, 16].forEach(function (s, i) { Sound._tone(midi(r + s), { dur: 0.9, vol: 0.06, delay: i * 0.07 }); });
      for (var i = 0; i < 6; i++) this._tone(2400 + Math.random() * 1600, { dur: 0.15, vol: 0.02, delay: 0.35 + i * 0.05 });
    },
    /** Novo recorde: pequena fanfarra. */
    record: function () {
      var r = theme.root + 12;
      [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36], [7, 0.5], [12, 0.6]].forEach(function (n) { Sound._tone(midi(r + n[0]), { dur: 0.28, vol: 0.07, type: 'triangle', delay: n[1] }); });
    },

    tap: function () { this._tone(720, { dur: 0.05, vol: 0.05, type: 'triangle' }); },
    // v1.21 (pedido do dono: "barulhinho gostosinho"): sons originais, curtos e secos.
    // Pegar: um "tic" agudo e rápido. Encaixar: um "toc" de madeira (corpo ~540 Hz caindo + estalo curto).
    pick: function () {
      this._tone(1480, { to: 1720, dur: 0.035, vol: 0.06, type: 'triangle' });
      this._noise({ filter: 'highpass', freq: 4200, dur: 0.018, vol: 0.05 });
    },
    place: function () { // v1.24 (dono: "som de encaixar fraco"): clique mais firme + "tum" grave curto
      this._tone(545, { to: 440, dur: 0.06, vol: 0.15, type: 'sine' });
      this._tone(1090, { to: 900, dur: 0.03, vol: 0.05, type: 'triangle' });
      this._tone(160, { to: 95, dur: 0.08, vol: 0.1, type: 'sine' });
      this._noise({ filter: 'bandpass', freq: 2600, q: 1.6, dur: 0.018, vol: 0.15 });
      this._noise({ filter: 'lowpass', freq: 700, dur: 0.05, vol: 0.08 });
    },
    /** v1.21: Estrela acionada — sininho brilhante subindo. */
    star: function () {
      [1568, 2093, 2637, 3136].forEach(function (f, i) { Sound._tone(f, { dur: 0.28, vol: 0.045, type: 'triangle', delay: i * 0.05 }); });
      this._noise({ filter: 'highpass', freq: 6000, dur: 0.25, vol: 0.03, attack: 0.04 });
    },
    /** v1.21: Bomba — estouro grave abafado com estalos. */
    bomb: function () {
      this._noise({ filter: 'lowpass', freq: 1400, toFreq: 140, dur: 0.55, vol: 0.16 });
      this._tone(120, { to: 38, dur: 0.5, vol: 0.12, type: 'sine' });
      for (var i = 0; i < 4; i++) this._noise({ filter: 'bandpass', freq: 1500 + Math.random() * 1500, q: 3, dur: 0.035, vol: 0.08, delay: 0.08 + i * 0.06 + Math.random() * 0.03 });
    },
    /** v1.24 (Semana do Terror): fantasma — "uuuu" com vibrato descendo (leve). */
    ghost: function () {
      this._tone(620, { to: 380, dur: 0.9, vol: 0.05, type: 'sine', attack: 0.15 });
      this._tone(627, { to: 386, dur: 0.9, vol: 0.035, type: 'sine', attack: 0.2, delay: 0.02 });
    },
    /** v1.24 (Semana do Terror): uivo curto no fim da partida. */
    howl: function () {
      this._tone(330, { to: 560, dur: 0.45, vol: 0.05, type: 'sine', attack: 0.12 });
      this._tone(560, { to: 300, dur: 0.8, vol: 0.05, type: 'sine', delay: 0.42 });
    },
    invalid: function () { this._tone(170, { to: 120, dur: 0.16, vol: 0.12, type: 'triangle' }); },
    /** Linha limpa (v1.23, menos poluição sonora): 1 som principal (escala subindo) + no máximo 1 detalhe.
     *  accent: 'boom' (grave macio) quando o estilo não tem som de quebra próprio; null quando outro som já é o detalhe. */
    clear: function (lines, combo, accent) {
      var sc = theme.scale, base = theme.root + 12 + Math.min(combo || 0, 6) * 2;
      var n = Math.min(2 + lines, 6);
      for (var i = 0; i < n; i++) {
        var note = base + sc[i % sc.length] + 12 * Math.floor(i / sc.length);
        this._tone(midi(note), { dur: 0.34, vol: 0.09, delay: i * 0.065 });
      }
      if (accent === 'boom') {
        this._tone(330, { to: 250, dur: 0.7, vol: 0.06, type: 'sine' });
        this._noise({ filter: 'lowpass', freq: 700, toFreq: 180, dur: 0.4, vol: 0.05, attack: 0.01 });
      }
    },
    /** v1.23: o estilo tem som de quebra próprio? (aí ele é o "detalhe" da linha limpa) */
    hasBreak: function (skin) { return /^(ice|stone|fur|wool|jelly|cheese|neon|candy|pixel|crystal|metal|galaxy|energy|rainbow|holo|lava|gold|bubble|ocean|circuit|stained|marble|glossy|gradient|wood)$/.test(skin || ''); },
    theme: function () {
      var r = theme.root + 12;
      [0, 4, 7, 12].forEach(function (s, i) { Sound._tone(midi(r + s), { dur: 1.1, vol: 0.07, delay: i * 0.09 }); });
    },
    gameover: function () {
      var r = theme.root;
      [12, 7, 4, 0].forEach(function (s, i) { Sound._tone(midi(r + s), { dur: 0.5, vol: 0.08, delay: i * 0.18, type: 'triangle' }); });
    },

    updateMusic: function () {
      if (!ctx) return;
      var on = this.musicOn && musicVol > 0;
      var t = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setTargetAtTime(on ? musicVol : 0, t, 0.4);
      if (on && !musicTimer) {
        nextNote = ctx.currentTime + 0.2;
        musicTimer = setInterval(scheduleMusic, 90);
      } else if (!on && musicTimer) {
        clearInterval(musicTimer); musicTimer = 0;
      }
    }
  };

  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* ---------------- v1.19: trilha nova (pedido do dono: "a música é chata") ----------------
   * Música original gerada na hora (Web Audio, nenhum arquivo): 104 bpm, grade de semicolcheias.
   * Camadas: bumbo + palma + chimbal leves, baixo, acorde suave e arpejo/melodia. Progressão de 4 acordes no tom do
   * visual atual; a cada 8 compassos vem uma "pausa" de 4 compassos (sem bumbo, filtro fechando) para não cansar.
   * Tudo parametrizado por (c, bus) para poder ser renderizado fora do jogo (prévia em arquivo). */
  var BPM = 104, S16 = 60 / BPM / 4, MV = 1.8; // MV: volume geral da trilha (medido: pico ~0,4 sem estourar)
  function nbuf(c) {
    if (c === ctx && noiseBuf) return noiseBuf;
    var b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (c === ctx) noiseBuf = b;
    return b;
  }
  function env(c, g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(c, bus, type, f, t, dur, vol, a, cutoff) {
    var o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
    var last = o;
    if (cutoff) { var fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff * 2.2, t); fl.frequency.exponentialRampToValueAtTime(cutoff, t + dur * 0.6); o.connect(fl); last = fl; }
    env(c, g, t, a || 0.008, vol * MV, dur); last.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  function kick(c, bus, t, vol) {
    var o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    env(c, g, t, 0.004, vol * MV, 0.28); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.32);
  }
  function noiseHit(c, bus, t, vol, type, freq, dur) {
    var src = c.createBufferSource(); src.buffer = nbuf(c);
    var f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.9;
    var g = c.createGain(); env(c, g, t, 0.002, vol * MV, dur);
    src.connect(f); f.connect(g); g.connect(bus); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  /** Progressão conforme a escala do visual: menor (tem 3ª menor) ou maior. Graus em semitons a partir da tônica. */
  function progression(sc) {
    var minor = sc.indexOf(3) !== -1;
    return minor ? [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']]   // i – VI – III – VII
                 : [[0, 'M'], [-3, 'm'], [5, 'M'], [7, 'M']];  // I – vi – IV – V
  }
  var ARPS = [[0, 1, 2, 1, 0, 1, 2, 3], [0, 2, 1, 2, 0, 2, 3, 2], [2, 1, 0, 1, 2, 3, 2, 1]];
  /** Agenda uma semicolcheia n (0..) da música no instante t. */
  function musicStep(c, bus, n, t, th) {
    var bar = Math.floor(n / 16), s16 = n % 16, phrase = bar % 12, brk = phrase >= 8; // 8 compassos cheios + 4 de pausa
    // v1.24 (dono: "a música cansa"): a cada 24 compassos (~55 s) muda de tom, de batida e de arpejo
    var cyc = Math.floor(bar / 24), tr = [0, 2, -3, 5][cyc % 4], beat = cyc % 3;
    var prog = progression(th.scale), ch = prog[bar % 4], rootN = th.root - 12 + ch[0] + tr;
    var third = ch[1] === 'm' ? 3 : 4, chord = [rootN, rootN + third, rootN + 7, rootN + 12];
    var arp = ARPS[(Math.floor(bar / 4) + cyc) % ARPS.length];
    if (calm) { // v1.26: Zen — só acordes longos e um arpejo lento e suave
      if (s16 === 0) chord.slice(0, 3).forEach(function (m) { tone(c, bus, 'sine', midi(m + 12), t, S16 * 16, 0.03, 0.6); });
      if (s16 % 4 === 0 && !brk) { var mz = chord[arp[(s16 / 4) % arp.length]] + 24; tone(c, bus, 'sine', midi(mz), t, S16 * 4, 0.014, 0.05); }
      return;
    }
    if (!brk) {
      if (beat === 0 && (s16 === 0 || s16 === 8 || (s16 === 10 && bar % 2))) kick(c, bus, t, 0.22);
      if (beat === 1 && (s16 === 0 || (s16 === 7 && bar % 2))) kick(c, bus, t, 0.22); // meia batida
      if (beat === 2 && s16 % 4 === 0) kick(c, bus, t, 0.18); // 4 por compasso
      if (beat === 1 ? s16 === 8 : (s16 === 4 || s16 === 12)) noiseHit(c, bus, t, 0.07, 'bandpass', 1500, 0.12);
    }
    if (s16 % 2 === 0) noiseHit(c, bus, t, s16 % 4 === 2 ? 0.035 : 0.018, 'highpass', 7000, 0.04); // chimbal
    if (s16 % 2 === 0 && !(brk && s16 % 4)) { // baixo em colcheias (na pausa, só nos tempos)
      var bn = rootN - 12 + (s16 === 6 || s16 === 14 ? 12 : 0);
      tone(c, bus, 'sawtooth', midi(bn), t, S16 * 1.7, brk ? 0.05 : 0.075, 0.006, 420);
    }
    if (s16 === 0) chord.slice(0, 3).forEach(function (m) { tone(c, bus, 'triangle', midi(m + 12), t, S16 * 15, 0.022, 0.25); }); // acorde
    if (s16 % 2 === 0) { // arpejo
      var k = arp[(s16 / 2) % arp.length], m2 = chord[k] + 24;
      if (!brk || s16 % 4 === 0) tone(c, bus, 'square', midi(m2), t, S16 * 1.6, brk ? 0.012 : 0.02, 0.004, 2600);
    }
    if (!brk && bar % 2 === 1 && (s16 === 3 || s16 === 11) ) { // respostas curtas da melodia
      var deg = th.scale[(bar + s16 + cyc) % th.scale.length];
      tone(c, bus, 'triangle', midi(th.root + 12 + deg + tr), t, S16 * 3, 0.03, 0.01);
    }
  }
  function scheduleMusic() {
    if (!ctx || ctx.state !== 'running') return;
    while (nextNote < ctx.currentTime + 0.35) {
      musicStep(ctx, musicBus, step, nextNote, theme);
      if (musicLp) { var ph = Math.floor(step / 16) % 12; musicLp.frequency.setTargetAtTime(calm ? 1500 : ph >= 8 ? 1800 : 5200, nextNote, 0.8); }
      nextNote += S16; step++;
    }
  }
  /** Prévia: renderiza `sec` segundos da música (para gerar um arquivo e ouvir fora do jogo). */
  Sound._renderMusic = function (sec, th) {
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext, c = new OAC(2, Math.round(44100 * sec), 44100);
    var bus = c.createGain(); bus.gain.value = 0.8; var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    var dl = c.createDelay(1); dl.delayTime.value = 0.36; var fb = c.createGain(); fb.gain.value = 0.32; var wet = c.createGain(); wet.gain.value = 0.28;
    bus.connect(lp); lp.connect(c.destination); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(c.destination);
    for (var n = 0, t = 0.05; t < sec - 0.3; n++, t += S16) musicStep(c, bus, n, t, th || theme);
    return c.startRendering();
  };

  root.MZSound = Sound;
})(this);
