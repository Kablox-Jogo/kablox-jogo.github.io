/* Kablox — service worker (funciona offline após o primeiro carregamento)
 * Para publicar uma atualização: altere VERSION abaixo (ex.: 'gb-1.1.1') e publique de novo.
 */
const VERSION = 'gb-1.21.1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './fonts/russo-one.woff2',
  './fonts/rubik-600.woff2',
  './fonts/rubik-800.woff2',
  './js/i18n.js', './js/pieces.js',
  './js/logic.js',
  './js/themes.js',
  './js/skins.js',
  './js/fx.js',
  './js/audio.js',
  './js/progress.js',
  './js/ui.js',
  './js/surprise.js',
  './js/menus.js',
  './js/app.js',
  './manifest.webmanifest',
  './baixar.html', './opiniao.html', './css/site.css', './js/site.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

// Algumas hospedagens (ex.: Cloudflare Pages) redirecionam index.html → '/'. O navegador recusa
// abrir uma página a partir de uma resposta marcada como "redirecionada", então guardamos uma cópia limpa.
function clean(res) {
  if (!res.redirected) return res;
  return res.blob().then((body) => new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => Promise.all(ASSETS.map((u) =>
      fetch(new Request(u, { cache: 'reload' })).then((res) => {
        if (!res.ok) throw new Error('falha ao baixar ' + u);
        return Promise.resolve(clean(res)).then((r) => cache.put(u, r));
      })
    )))
  );
  // primeira instalação: ativa já; atualizações esperam o jogador tocar em "Atualizar"
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.indexOf('gb-') === 0 && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // páginas: responde com o index.html em cache (abre offline)
  // v1.21.1: as páginas "Como baixar" e "Dê sua opinião" abrem elas mesmas (rede primeiro, cópia guardada se offline)
  if (req.mode === 'navigate' && /\/(baixar|opiniao)\.html$/.test(url.pathname)) {
    event.respondWith(fetch(req).catch(() => caches.match(req, { ignoreSearch: true }).then((c) => c || caches.match('./'))));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./').then((c) => c || caches.match('./index.html'))
        .then((cached) => cached || fetch(req))
        .catch(() => caches.match('./'))
    );
    return;
  }

  // demais arquivos: cache primeiro, rede como reserva
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
