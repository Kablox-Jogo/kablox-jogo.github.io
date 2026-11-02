/* Backup do progresso por código (v1.22, pedido do dono): "Copiar meu progresso" gera um texto que a pessoa manda
 * para si mesma (WhatsApp etc.) e cola no celular novo em "Restaurar progresso". Sem conta, sem servidor, sem rede.
 * Formato: BK1.<dados em base64url>.<verificação de 8 hex>  — a verificação pega código cortado ou digitado errado.
 * Só estas chaves entram e voltam; tudo o que volta ainda é validado pelo jogo antes de gravar. */
(function (root) {
  'use strict';
  var PREFIX = 'BK1';
  var KEYS = ['gb.stats', 'gb.settings', 'gb.tutorialDone', 'gb.save.classic', 'gb.save.zen', 'gb.save.daily', 'gb.save.challenge'];
  var MAX_CODE = 300000; // ~300 KB: muito acima de um progresso real, barra lixo gigante

  function fnv(str) { // FNV-1a 32 bits
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function toB64(str) {
    var bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(str) : Buffer.from(str, 'utf8');
    var bin = ''; for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64(b) {
    b = b.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
    var bin = typeof atob !== 'undefined' ? atob(b) : Buffer.from(b, 'base64').toString('binary');
    var bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(bytes) : Buffer.from(bytes).toString('utf8');
  }

  /** data: { 'gb.stats': {...}, ... } (valores já lidos do armazenamento). Retorna o código. */
  function encode(data) {
    var d = {};
    KEYS.forEach(function (k) { if (data && data[k] !== undefined && data[k] !== null) d[k] = data[k]; });
    var body = toB64(JSON.stringify({ v: 1, t: Date.now(), d: d }));
    return PREFIX + '.' + body + '.' + fnv(body);
  }

  /** Retorna { ok:true, data:{chave:valor}, when } ou { ok:false, error:'empty'|'format'|'check'|'big' }. */
  function decode(code) {
    if (typeof code !== 'string') return { ok: false, error: 'empty' };
    var s = code.replace(/\s+/g, ''); // o WhatsApp pode quebrar linhas
    if (!s) return { ok: false, error: 'empty' };
    if (s.length > MAX_CODE) return { ok: false, error: 'big' };
    var m = /^BK1\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(s);
    if (!m) return { ok: false, error: 'format' };
    if (fnv(m[1]) !== m[2]) return { ok: false, error: 'check' };
    var obj;
    try { obj = JSON.parse(fromB64(m[1])); } catch (e) { return { ok: false, error: 'format' }; }
    if (!obj || obj.v !== 1 || !obj.d || typeof obj.d !== 'object' || Array.isArray(obj.d)) return { ok: false, error: 'format' };
    var out = {};
    KEYS.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(obj.d, k)) out[k] = obj.d[k]; });
    return { ok: true, data: out, when: typeof obj.t === 'number' ? obj.t : 0 };
  }

  var api = { KEYS: KEYS, encode: encode, decode: decode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MZBackup = api;
})(this);
