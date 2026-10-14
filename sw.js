// Service worker: deja la app disponible sin conexión.
// Al publicar una versión nueva, sube el número de VERSION para que los móviles la actualicen.
const VERSION = 'drxinxus-v5';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/main.js', 'js/dom.js', 'js/store.js', 'js/content.js', 'js/lesson.js', 'js/shell.js', 'js/vfs.js',
  'js/seed.js', 'js/bash-parser.js', 'js/terminal-ui.js', 'js/editor.js', 'js/mascot.js', 'js/sound.js',
  'js/achievements.js', 'js/games.js', 'js/ranking.js', 'js/config.js', 'js/data/repo.js', 'js/data/man.js', 'js/data/pdb.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Primero la red (para recibir actualizaciones); si no hay conexión, la caché.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))),
  );
});
