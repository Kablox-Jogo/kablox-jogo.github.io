/* v1.24 (ideia do dono): Desafio da Semana + Placar da galera, SEM servidor.
 * Todo mundo joga a mesma sequência de peças na semana (semente da semana). No fim, o jogo gera um
 * CÓDIGO DE PROVA com todas as jogadas. Quem recebe o código cola no jogo, que REFAZ a partida inteira
 * sozinho e só aceita se os pontos baterem. Mudar o número no código não funciona.
 * Formato: KS1.<semana>.<apelido base64url>.<pontos>.<jogadas base64url>.<verificação 8 hex>
 * Cada jogada = 1 byte: peça (0–2) × 64 + linha × 8 + coluna. */
(function (root) {
  'use strict';
  var Logic = typeof module !== 'undefined' && module.exports ? require('./logic.js') : root.MZLogic;
  var MAX_MOVES = 5000, MAX_NAME = 16;

  function fnv(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function b64(bytes) {
    var bin = ''; for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var s = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var bin = typeof atob !== 'undefined' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
    var out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
  }
  function utf8(str) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(str) : Buffer.from(str, 'utf8'); }
  function deutf8(bytes) { return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(bytes) : Buffer.from(bytes).toString('utf8'); }

  function cleanName(n) { return String(n || '').replace(/[\u0000-\u001f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME); }
  function seedFor(week) { return hash('kablox-semana-' + week); }
  /** Mesmo sorteio que o jogo usa a cada jogada (app.js rngFor). */
  function rngFor(st) { return Logic.seededRng((st.seed + st.placed * 2654435761) >>> 0); }
  function newGame(week) {
    var seed = seedFor(week), st = Logic.newGame(Logic.seededRng(seed));
    st.seed = seed; st.week = week; st.moves = '';
    return st;
  }
  function packMove(slot, r, c) { return slot * 64 + r * 8 + c; }

  /** Refaz a partida. Retorna { ok, score, lines, over, state } ou { ok:false, error, at }. */
  function replay(week, bytes) {
    var st = newGame(week), SIZE = Logic.SIZE;
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i], slot = Math.floor(b / 64), r = Math.floor((b % 64) / 8), c = b % 8;
      if (slot > 2 || r >= SIZE || c >= SIZE || st.over) return { ok: false, error: 'move', at: i };
      var res = Logic.place(st, slot, r, c, rngFor(st));
      if (!res) return { ok: false, error: 'move', at: i };
    }
    return { ok: true, score: st.score, lines: st.lines, over: !!st.over, state: st };
  }

  function encode(week, name, score, movesStr) {
    var bytes = []; for (var i = 0; i < movesStr.length; i++) bytes.push(movesStr.charCodeAt(i) & 255);
    var body = [week, b64(utf8(cleanName(name) || '?')), String(Math.floor(score)), b64(bytes)].join('.');
    return 'KS1.' + body + '.' + fnv(body);
  }
  /** Lê e CONFERE um código. Retorna { ok, week, name, score, lines } ou { ok:false, error:'format'|'check'|'replay'|'score'|'big' }. */
  function verify(code) {
    var s = String(code || '').replace(/\s+/g, '');
    if (s.length > 20000) return { ok: false, error: 'big' };
    var m = /^KS1\.(w\d{1,6})\.([A-Za-z0-9_-]{1,40})\.(\d{1,12})\.([A-Za-z0-9_-]*)\.([0-9a-f]{8})$/.exec(s);
    if (!m) return { ok: false, error: 'format' };
    var body = [m[1], m[2], m[3], m[4]].join('.');
    if (fnv(body) !== m[5]) return { ok: false, error: 'check' };
    var name, bytes;
    try { name = cleanName(deutf8(unb64(m[2]))); bytes = unb64(m[4]); } catch (e) { return { ok: false, error: 'format' }; }
    if (bytes.length > MAX_MOVES) return { ok: false, error: 'big' };
    var r = replay(m[1], bytes);
    if (!r.ok) return { ok: false, error: 'replay' };
    if (r.score !== +m[3]) return { ok: false, error: 'score' };
    return { ok: true, week: m[1], name: name || '?', score: r.score, lines: r.lines, over: r.over };
  }

  var api = { seedFor: seedFor, newGame: newGame, rngFor: rngFor, packMove: packMove, replay: replay, encode: encode, verify: verify, cleanName: cleanName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZWeekly = api;
})(this);
