/**
 * Service Worker — Bolão da Mega da Virada (PWA)
 *
 * Estratégia "rede primeiro": sempre tenta buscar a versão mais nova e só usa o
 * cache quando estiver offline. Assim uma atualização publicada no GitHub Pages
 * chega aos participantes na próxima abertura do app.
 */

const CACHE_NAME = "mega-bolao-v13";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./css/styles.css",
  "./js/config.js",
  "./js/utils.js",
  "./js/state.js",
  "./js/ui.js",
  "./js/api.js",
  "./js/mock.js",
  "./js/pdf.js",
  "./js/pwa.js",
  "./js/convite.js",
  "./js/conferencia.js",
  "./js/tema.js",
  "./js/participante.js",
  "./js/main.js",
  "./js/admin.js",
  "./js/admin-main.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith("http")) return;

  // A API (Google Apps Script) nunca passa pelo cache.
  const url = new URL(request.url);
  if (url.hostname.endsWith("script.google.com") || url.hostname.endsWith("googleusercontent.com")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (response.type === "basic" || response.type === "cors")) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((cached) => cached || Response.error()))
  );
});
