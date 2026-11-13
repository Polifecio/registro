// Service worker: guarda la app para abrirla sin internet y sube lo pendiente cuando vuelve la señal.
importScripts('kv.js');

var VERSION = '07b4127d';
var CACHE = 'registro-paul-' + VERSION;
var FUENTES = 'registro-paul-fuentes';
var ARCHIVOS = ['./', 'index.html', 'kv.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  // cache:'reload' pide los archivos nuevos a internet, no la copia vieja del navegador.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(ARCHIVOS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  // Solo borra versiones viejas de esta misma app.
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('registro-paul-') === 0 && k !== CACHE && k !== FUENTES; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var u = new URL(e.request.url);
  if (u.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || fetch(e.request); }));
  } else if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    // Las letras de la app: se guardan la primera vez para verse igual sin internet.
    e.respondWith(caches.open(FUENTES).then(function (c) {
      return c.match(e.request).then(function (r) {
        return r || fetch(e.request).then(function (resp) { c.put(e.request, resp.clone()); return resp; });
      });
    }));
  }
});

// Android: Chrome despierta esto cuando vuelve la señal, aunque la app esté cerrada.
self.addEventListener('sync', function (e) {
  if (e.tag === 'subir') e.waitUntil(Telefono.subirPendientes().then(avisar));
});

function avisar() {
  return self.clients.matchAll().then(function (cs) { cs.forEach(function (c) { c.postMessage('actualizar'); }); });
}
