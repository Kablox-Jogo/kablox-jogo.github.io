/* Kablox — rede do Amistoso online (laboratório, v1.28).
 * Dois jeitos de ligar dois celulares, com a MESMA conversa (protocolo) por cima:
 *  1) Direto (WebRTC): um celular gera um CONVITE, o outro responde com uma RESPOSTA; os códigos vão pelo WhatsApp.
 *     Depois disso as jogadas vão de um celular direto ao outro. Só usa servidores públicos de "STUN" para os dois se acharem.
 *  2) Servidor (WebSocket): código curto de 6 letras; o servidor (servidor/worker.js, Cloudflare) só repassa as mensagens.
 * Segurança: tudo que chega do outro lado é tratado como suspeito — tamanho máximo, ritmo máximo, só tipos conhecidos,
 * só números inteiros dentro de faixas, apelido limpo. Nada vira HTML. Nada é guardado.
 */
(function (root) {
  'use strict';
  var MAX_MSG = 600;          // caracteres por mensagem (uma jogada tem ~60)
  var MAX_CODE = 12000;       // tamanho máximo de um código colado
  var RATE_N = 40, RATE_MS = 4000; // no máximo 40 mensagens a cada 4 s (o jogo manda ~1 por jogada)
  var PING_MS = 4000, DEAD_MS = 16000;
  var ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  // Endereço do servidor (Cloudflare). Vazio = só o modo direto. Ex.: 'wss://kablox-sala.SEU-NOME.workers.dev'
  var RELAY_URL = '';
  // Só para testes no computador: ?relay=ws://127.0.0.1:PORTA (aceito apenas em localhost e apontando para o próprio computador).
  try {
    var L = root.location;
    if (L && /^(localhost|127\.0\.0\.1)$/.test(L.hostname)) {
      var q = /[?&]relay=(ws:\/\/(?:127\.0\.0\.1|localhost):\d{2,5})(?:&|$)/.exec(L.search);
      if (q) RELAY_URL = q[1];
    }
  } catch (e) {}
  var CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I/L, para não confundir

  /* ---------------- mensagens: o único formato aceito ---------------- */
  function int(v, lo, hi) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= lo && v <= hi; }
  function cleanNick(s) { // apelido do outro celular: só letras, números, espaço e _ . - (máx. 14)
    if (typeof s !== 'string') return '';
    return s.slice(0, 64).replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14);
  }
  /** Confere uma mensagem que veio do outro celular. Devolve o objeto limpo, ou null se for estranha. */
  function check(raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return null;
    var o; try { o = JSON.parse(raw); } catch (e) { return null; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.t !== 'string') return null;
    switch (o.t) {
      case 'hello': return int(o.v, 1, 99) ? { t: 'hello', v: o.v, nick: cleanNick(o.nick) } : null;
      case 'start': return int(o.seed, 0, 4294967295) && int(o.first, 0, 1) && int(o.round, 0, 9999) ? { t: 'start', seed: o.seed, first: o.first, round: o.round } : null;
      case 'move': return int(o.n, 0, 999) && int(o.slot, 0, 2) && int(o.r, 0, 7) && int(o.c, 0, 7) && int(o.round, 0, 9999) ? { t: 'move', n: o.n, slot: o.slot, r: o.r, c: o.c, round: o.round } : null;
      case 'again': case 'bye': case 'ping': case 'pong': return { t: o.t };
      default: return null;
    }
  }

  /* ---------------- sessão: igual para os dois transportes ---------------- */
  function Session(kind) {
    this.kind = kind; this.open = false; this.closed = false; this.onmessage = null; this.onclose = null; this.onopen = null;
    this._times = []; this._last = Date.now(); this._timer = 0; this._raw = null;
  }
  Session.prototype._opened = function (rawSend, rawClose) {
    var self = this; this._raw = rawSend; this._rawClose = rawClose; this.open = true; this._last = Date.now();
    this._timer = setInterval(function () {
      if (Date.now() - self._last > DEAD_MS) { self.close('timeout'); return; }
      self.send({ t: 'ping' });
    }, PING_MS);
    if (this.onopen) this.onopen();
  };
  Session.prototype._incoming = function (raw) {
    if (this.closed) return;
    var now = Date.now(); this._last = now;
    this._times.push(now); while (this._times.length && now - this._times[0] > RATE_MS) this._times.shift();
    if (this._times.length > RATE_N) { this.close('flood'); return; } // mensagens demais: corta a conexão
    var m = check(raw);
    if (!m) { this.bad = (this.bad || 0) + 1; if (this.bad > 3) this.close('bad'); return; } // estranha: ignora; várias seguidas: corta
    if (m.t === 'ping') { this.send({ t: 'pong' }); return; }
    if (m.t === 'pong') return;
    if (this.onmessage) this.onmessage(m);
  };
  Session.prototype.send = function (o) {
    if (!this.open || this.closed || !this._raw) return false;
    var s = JSON.stringify(o); if (s.length > MAX_MSG) return false;
    try { this._raw(s); return true; } catch (e) { return false; }
  };
  Session.prototype.close = function (why) {
    if (this.closed) return; this.closed = true; this.open = false; clearInterval(this._timer);
    try { if (this._rawClose) this._rawClose(); } catch (e) {}
    if (this.onclose) this.onclose(why || 'closed');
  };

  /* ---------------- códigos de convite (modo direto) ---------------- */
  function b64url(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64url(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), out = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; }
  function pipe(bytes, Stream) { var cs = new Stream('deflate-raw'), w = cs.writable.getWriter(); w.write(bytes); w.close(); return new Response(cs.readable).arrayBuffer().then(function (ab) { return new Uint8Array(ab); }); }
  /** Encurta a descrição da conexão: só as linhas que a conexão precisa, comprimidas. */
  function slimSdp(sdp) {
    return sdp.split(/\r?\n/).filter(function (l) {
      return l && !/^a=(extmap|rtcp-fb|ssrc|msid|rtpmap|fmtp|ice-options:trickle|extmap-allow-mixed)/.test(l);
    }).join('\r\n') + '\r\n';
  }
  function encodeDesc(kind, sdp) {
    var txt = (kind === 'offer' ? 'O' : 'A') + slimSdp(sdp), bytes = new TextEncoder().encode(txt);
    var head = kind === 'offer' ? 'KBX1C.' : 'KBX1R.';
    if (typeof CompressionStream === 'undefined') return Promise.resolve(head + 'U' + b64url(bytes));
    return pipe(bytes, CompressionStream).then(function (z) { return head + 'Z' + b64url(z); });
  }
  /** Lê um código colado. Aceita o código sozinho, com espaços, ou dentro de uma mensagem/link. Recusa qualquer outra coisa. */
  function decodeDesc(text, want) {
    if (typeof text !== 'string' || text.length > MAX_CODE) return Promise.reject(new Error('code'));
    var m = text.match(/KBX1([CR])\.([UZ])([A-Za-z0-9_-]{20,})(?![A-Za-z0-9_-])/); // o código é uma "palavra" só: o que vem antes/depois (texto da mensagem, link) fica de fora
    if (!m) return Promise.reject(new Error('code'));
    var kind = m[1] === 'C' ? 'offer' : 'answer';
    if (want && kind !== want) return Promise.reject(new Error(want === 'offer' ? 'need-offer' : 'need-answer'));
    var bytes; try { bytes = unb64url(m[3]); } catch (e) { return Promise.reject(new Error('code')); }
    var p = m[2] === 'U' ? Promise.resolve(bytes) : (typeof DecompressionStream === 'undefined' ? Promise.reject(new Error('code')) : pipe(bytes, DecompressionStream).catch(function () { throw new Error('code'); }));
    return p.then(function (raw) {
      if (raw.length > 8000) throw new Error('code');
      var txt = new TextDecoder().decode(raw), tag = txt.charAt(0), sdp = txt.slice(1);
      // só aceita uma descrição de conexão de dados de verdade (nada de áudio/vídeo, nada além do esperado)
      if ((tag === 'O') !== (kind === 'offer') || !/^v=0\r\n/.test(sdp) || !/\r\na=fingerprint:sha-256 [0-9A-F:]{95}\r\n/.test(sdp) ||
          !/\r\nm=application \d+ UDP\/DTLS\/SCTP webrtc-datachannel\r\n/.test(sdp) || /\r\nm=(audio|video)/.test(sdp)) throw new Error('code');
      return { type: kind, sdp: sdp };
    });
  }
  function waitIce(pc, ms) {
    return new Promise(function (res) {
      if (pc.iceGatheringState === 'complete') return res();
      var t = setTimeout(res, ms); // não espera para sempre: os endereços da rede local bastam na mesma Wi-Fi
      pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  }
  function wireChannel(sess, ch, pc) {
    ch.onopen = function () { sess._opened(function (s) { ch.send(s); }, function () { try { ch.close(); } catch (e) {} try { pc.close(); } catch (e) {} }); };
    ch.onmessage = function (e) { sess._incoming(typeof e.data === 'string' ? e.data : null); };
    ch.onclose = function () { sess.close('closed'); };
    pc.onconnectionstatechange = function () { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') sess.close('failed'); };
  }
  /** Quem cria: devolve { session, code (convite), accept(respostaColada) }. */
  function hostDirect() {
    if (!root.RTCPeerConnection) return Promise.reject(new Error('nortc'));
    var pc = new RTCPeerConnection({ iceServers: ICE }), sess = new Session('direct');
    var ch = pc.createDataChannel('kablox', { ordered: true });
    wireChannel(sess, ch, pc);
    return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
      .then(function () { return waitIce(pc, 3000); })
      .then(function () { return encodeDesc('offer', pc.localDescription.sdp); })
      .then(function (code) {
        return { session: sess, code: code,
          accept: function (text) { return decodeDesc(text, 'answer').then(function (d) { return pc.setRemoteDescription(d); }); },
          cancel: function () { sess.close('cancel'); try { pc.close(); } catch (e) {} } };
      });
  }
  /** Quem entra: recebe o convite colado e devolve { session, code (resposta) }. */
  function joinDirect(text) {
    if (!root.RTCPeerConnection) return Promise.reject(new Error('nortc'));
    var pc, sess = new Session('direct');
    return decodeDesc(text, 'offer').then(function (d) {
      pc = new RTCPeerConnection({ iceServers: ICE });
      pc.ondatachannel = function (e) { if (e.channel.label === 'kablox') wireChannel(sess, e.channel, pc); };
      return pc.setRemoteDescription(d);
    }).then(function () { return pc.createAnswer(); })
      .then(function (a) { return pc.setLocalDescription(a); })
      .then(function () { return waitIce(pc, 3000); })
      .then(function () { return encodeDesc('answer', pc.localDescription.sdp); })
      .then(function (code) { return { session: sess, code: code, cancel: function () { sess.close('cancel'); try { pc.close(); } catch (e) {} } }; });
  }

  /* ---------------- servidor (código curto) ---------------- */
  function newRoomCode() {
    var a = new Uint8Array(6), s = ''; root.crypto.getRandomValues(a);
    for (var i = 0; i < 6; i++) s += CODE_ABC.charAt(a[i] % CODE_ABC.length);
    return s;
  }
  function cleanRoomCode(t) { var s = String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return /^[A-HJ-NP-Z2-9]{6}$/.test(s) ? s : null; }
  /** Liga no servidor numa sala. role: 'host' cria, 'guest' entra. */
  function relay(room, role) {
    if (!RELAY_URL || !root.WebSocket) return Promise.reject(new Error('norelay'));
    room = cleanRoomCode(room); if (!room) return Promise.reject(new Error('code'));
    return new Promise(function (res, rej) {
      var ws = new WebSocket(RELAY_URL.replace(/\/$/, '') + '/sala/' + room + '?papel=' + role), sess = new Session('relay'), settled = false;
      ws.onmessage = function (e) {
        var d = typeof e.data === 'string' ? e.data : '';
        if (!sess.open) { // primeira conversa é com o servidor: "esperando" ou "pareado"
          if (d === '{"s":"wait"}') { if (!settled) { settled = true; res({ session: sess, code: room }); } return; }
          if (d === '{"s":"paired"}') { if (!settled) { settled = true; res({ session: sess, code: room }); } sess._opened(function (s) { ws.send(s); }, function () { try { ws.close(); } catch (e) {} }); return; }
          if (d === '{"s":"full"}' || d === '{"s":"nohost"}') { settled = true; rej(new Error(d === '{"s":"full"}' ? 'full' : 'noroom')); try { ws.close(); } catch (e) {} return; }
          return;
        }
        if (d === '{"s":"gone"}') { sess.close('closed'); return; }
        sess._incoming(d);
      };
      ws.onerror = function () { if (!settled) { settled = true; rej(new Error('net')); } };
      ws.onclose = function () { if (!settled) { settled = true; rej(new Error('net')); } sess.close('closed'); };
      setTimeout(function () { if (!settled) { settled = true; rej(new Error('net')); try { ws.close(); } catch (e) {} } }, 10000);
    });
  }

  root.MZNet = {
    available: function () { return !!root.RTCPeerConnection; },
    relayOn: function () { return !!RELAY_URL; },
    relayUrl: function () { return RELAY_URL; },
    hostDirect: hostDirect, joinDirect: joinDirect, relay: relay, newRoomCode: newRoomCode, cleanRoomCode: cleanRoomCode,
    check: check, decodeDesc: decodeDesc, encodeDesc: encodeDesc, Session: Session,
    LIMITS: { MAX_MSG: MAX_MSG, MAX_CODE: MAX_CODE, RATE_N: RATE_N, RATE_MS: RATE_MS }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MZNet;
})(typeof window !== 'undefined' ? window : globalThis);
