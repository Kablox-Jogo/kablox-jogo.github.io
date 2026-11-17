/* App de TESTE do dono (gerado por tools/build_teste.py). Não existe no site dos amigos. */
(function () {
  window.MZ_LAB = true;
  window.MZ_TESTE = true;
  var P = 'kt.';
  try {
    var S = Storage.prototype, g = S.getItem, s = S.setItem, r = S.removeItem;
    var mine = function (st, k) { return st === window.localStorage && typeof k === 'string' && (k.indexOf('gb.') === 0 || k.indexOf('mz.') === 0); };
    // primeira vez: copia o progresso do app de verdade (só lê; o original fica intacto)
    var L = window.localStorage;
    if (g.call(L, P + 'copiado') === null) {
      for (var i = 0; i < L.length; i++) {
        var k = L.key(i);
        if (k && (k.indexOf('gb.') === 0 || k.indexOf('mz.') === 0)) s.call(L, P + k, g.call(L, k));
      }
      s.call(L, P + 'copiado', String(Date.now()));
    }
    S.getItem = function (k) { return g.call(this, mine(this, k) ? P + k : k); };
    S.setItem = function (k, v) { return s.call(this, mine(this, k) ? P + k : k, v); };
    S.removeItem = function (k) { return r.call(this, mine(this, k) ? P + k : k); };
  } catch (e) {}
})();
