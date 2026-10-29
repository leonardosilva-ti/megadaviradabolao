/**
 * SERVICE WORKER - BOLÃO MEGA DA VIRADA PWA
 */

const CACHE_NAME = "mega-bolao-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./css/style.css",
  "./js/config.js",
  "./js/api.js",
  "./js/app.js",
  "./js/admin.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon.svg"
];

// Instalação do Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptação de requisições
self.addEventListener("fetch", (event) => {
  // Apenas intercepta requisições GET
  if (event.request.method !== "GET") {
    return;
  }

  // Não cacheia requisições do Google Apps Script
  const url = event.request.url;
  if (url.includes("script.google.com") || url.includes("googleusercontent.com")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Se encontrar no cache, tenta buscar versão mais recente na rede em background (Stale-While-Revalidate)
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
