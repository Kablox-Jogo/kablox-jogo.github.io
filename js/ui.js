/* Kablox — peças de interface independentes da partida:
 *  - MZUI.Toasts: avisos em fila (um de cada vez, sem se sobrepor);
 *  - MZUI.Records: as 10 maiores pontuações guardadas no aparelho;
 *  - MZUI.setupPwa: funcionamento offline e aviso de versão nova.
 * Separadas de js/app.js para o arquivo principal ficar menor e mais fácil de mexer com segurança.
 */
(function (root) {
  'use strict';
  function $(s) { return document.querySelector(s); }

  /**
   * Fila de avisos. opts.onTrophy(): toca quando o aviso é de conquista;
   * opts.place(el): decide onde o aviso aparece (o jogo coloca abaixo do placar ou embaixo da tela).
   */
  function Toasts(opts) {
    opts = opts || {};
    var queue = [], busy = false;
    function next() {
      var t = queue.shift(), el = $('#toast');
      if (!t) { busy = false; return; }
      busy = true;
      $('#toast-title').textContent = t[0];
      $('#toast-text').textContent = t[1];
      el.classList.toggle('trophy', t[2] === 'trophy'); // conquista: troféu dourado com brilho
      if (t[2] === 'trophy' && opts.onTrophy) opts.onTrophy();
      if (opts.place) opts.place(el);
      el.classList.add('show');
      setTimeout(function () { el.classList.remove('show'); setTimeout(next, 380); }, 2300);
    }
    return {
      show: function (title, text, kind) {
        queue.push([title, text || '', kind || '']);
        if (!busy) next();
      }
    };
  }

  /** As 10 maiores pontuações (Clássico e Desafio do dia). Desfazer e terminar de novo não duplica (mesmo gid). */
  var Records = {
    KEY: 'gb.records',
    list: function (store) {
      var list = store.get(Records.KEY, []);
      if (!Array.isArray(list)) return [];
      return list.filter(function (r) {
        return r && typeof r.score === 'number' && isFinite(r.score) && (r.mode === 'classic' || r.mode === 'daily');
      }).slice(0, 10);
    },
    add: function (store, entry) {
      var list = Records.list(store).filter(function (r) { return r.gid !== entry.gid; });
      list.push(entry);
      list.sort(function (a, b) { return b.score - a.score; });
      store.set(Records.KEY, list.slice(0, 10));
    },
    newGid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  };

  /**
   * Service worker (offline) e barra "Nova versão disponível".
   * opts.enabled: false na prévia em arquivo único; opts.beforeUpdate(): salva tudo antes de atualizar.
   */
  function setupPwa(opts) {
    opts = opts || {};
    if (!opts.enabled || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    var hadController = !!navigator.serviceWorker.controller, updating = false;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        function offer() {
          if (!reg.waiting || !navigator.serviceWorker.controller) return;
          $('#update-bar').hidden = false;
          $('#btn-update').onclick = function () {
            if (!reg.waiting) { location.reload(); return; }
            updating = true; $('#update-bar').hidden = true;
            if (opts.beforeUpdate) opts.beforeUpdate();
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          };
        }
        document.addEventListener('visibilitychange', function () { if (!document.hidden) { try { reg.update(); } catch (e) {} } });
        offer();
        reg.addEventListener('updatefound', function () {
          var w = reg.installing;
          if (w) w.addEventListener('statechange', function () { if (w.state === 'installed') offer(); });
        });
      }).catch(function () {});
      var reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if ((!hadController && !updating) || reloading) return;
        reloading = true; location.reload();
      });
    });
  }

  root.MZUI = { Toasts: Toasts, Records: Records, setupPwa: setupPwa };
})(this);
