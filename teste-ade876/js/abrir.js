/* Porta de entrada do app de TESTE: instala o service worker desta pasta e abre o jogo. */
(function () {
  var msg = document.getElementById('msg'), go = document.getElementById('go');
  function open() { location.replace('./'); }
  function show() { msg.textContent = 'Pronto!'; go.hidden = false; }
  if (!('serviceWorker' in navigator)) { show(); return; }
  setTimeout(show, 6000);
  navigator.serviceWorker.register('sw.js', { scope: './' }).then(function () {
    return navigator.serviceWorker.ready;
  }).then(function (reg) {
    if (reg.scope.indexOf(location.pathname.replace(/[^/]*$/, '')) !== -1) open(); else show();
  }).catch(show);
})();
