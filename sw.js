// Dō offline helper (web version). Keeps Dō's own files on the device so it opens without a connection.
// It only ever stores Dō's files — your jobs live in the browser's database, never here, and nothing is sent anywhere.
const CACHE = 'do-1791651440095';
// The screenshot reader (about 7 MB) is kept in its own cache, so updates to Dō don't download it again.
const READER = 'reader-tesseract-1';
const APP = ['./', 'index.html', 'app.js', 'app.css', 'manifest.webmanifest', 'LICENSE.txt',
  'fonts/poppins-regular.woff', 'fonts/poppins-medium.woff', 'fonts/poppins-bold.woff',
  'icons/icon-16.png', 'icons/icon-32.png', 'icons/icon-48.png', 'icons/icon-128.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('do-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Opening Dō (including Share → Dō, which adds ?share_… to the address): the saved page, refreshed when online.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  if (new URL(req.url).pathname.includes('/ocr/')) {
    e.respondWith(caches.open(READER).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  // Dō's files and guide pictures: from the device first, then the network (and kept for next time).
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
