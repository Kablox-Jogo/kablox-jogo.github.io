/* Kablox — páginas "Como baixar" e "Dê sua opinião". Sem rede, sem coleta de dados: nada sai do aparelho sozinho. */
(function () {
  'use strict';
  var IG_USER = 'othesco.br';                       // Instagram que recebe as opiniões (Direct)
  var IG_DM = 'https://ig.me/m/' + IG_USER;
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|Threads/i.test(ua);
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  function $(s) { return document.querySelector(s); }
  function show(el, on) { if (el) el.hidden = !on; }

  // aplicativo offline: a mesma "memória" do jogo, para dar para instalar a partir desta página também
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  /* ---------- Como baixar ---------- */
  var tabA = $('#tab-android'), tabI = $('#tab-ios');
  if (tabA && tabI) {
    var pick = function (ios) {
      tabA.setAttribute('aria-selected', String(!ios)); tabI.setAttribute('aria-selected', String(ios));
      show($('#p-android'), !ios); show($('#p-ios'), ios);
    };
    tabA.addEventListener('click', function () { pick(false); });
    tabI.addEventListener('click', function () { pick(true); });
    pick(isIOS);
    show($('#inapp'), inApp);
    show($('#installed'), standalone);
    var deferred = null, btn = $('#install');
    window.addEventListener('beforeinstallprompt', function (e) { // Android/Chrome: botão de instalar de verdade
      e.preventDefault(); deferred = e; show(btn, !standalone);
    });
    if (btn) btn.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; show(btn, false); }).catch(function () {});
    });
    window.addEventListener('appinstalled', function () { show(btn, false); show($('#installed'), true); });
  }

  /* ---------- Dê sua opinião ---------- */
  var preview = $('#preview');
  if (!preview) return;
  var hn = $('#handle-name'); if (hn) hn.textContent = '@' + IG_USER;
  var FACES = ['', '😕', '😐', '🙂', '😄', '🤩'], nota = 0;
  function pressedIn(id) {
    return Array.prototype.filter.call(document.querySelectorAll('#' + id + ' button'), function (b) { return b.getAttribute('aria-pressed') === 'true'; })
      .map(function (b) { return b.textContent.trim(); });
  }
  function device() { return isIOS ? 'iPhone' : isAndroid ? 'Android' : 'computador/outro'; }
  function message() {
    var lines = ['🎮 Opinião sobre o KABLOX'];
    if (nota) lines.push('Nota: ' + nota + '/5 ' + FACES[nota]);
    var liked = pressedIn('liked'), imp = pressedIn('improve');
    if (liked.length) lines.push('Curti: ' + liked.join(', '));
    if (imp.length) lines.push('Pode melhorar: ' + imp.join(', '));
    var t = ($('#text').value || '').trim();
    if (t) lines.push('Comentário: ' + t);
    var n = ($('#nick').value || '').trim();
    lines.push('Celular: ' + device() + (standalone ? ' (instalado)' : ''));
    if (n) lines.push('— ' + n);
    return lines.join('\n');
  }
  function update() { preview.textContent = message(); }
  Array.prototype.forEach.call(document.querySelectorAll('#stars button'), function (b) {
    b.addEventListener('click', function () {
      nota = +b.getAttribute('data-v');
      Array.prototype.forEach.call(document.querySelectorAll('#stars button'), function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      update();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.chips button'), function (b) {
    b.addEventListener('click', function () { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); update(); });
  });
  $('#text').addEventListener('input', update);
  $('#nick').addEventListener('input', update);
  update();

  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.className = 'offscreen'; document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta); return ok;
  }
  $('#send').addEventListener('click', function () {
    var text = message(), ok = $('#ok');
    var go = function (copied) {
      ok.textContent = copied ? '✅ Mensagem copiada! Agora é só colar no Direct e enviar.' : 'Copie a mensagem acima e cole no Direct.';
      setTimeout(function () { location.href = IG_DM; }, copied ? 700 : 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { go(true); }, function () { go(fallbackCopy(text)); });
    else go(fallbackCopy(text));
  });
})();
