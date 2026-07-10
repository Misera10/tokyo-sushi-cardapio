const CACHE_NAME = "tokyo-sushi-v23";
const ASSETS = ["./", "./index.html", "./admin.html", "./styles.css", "./admin.css", "./config.js", "./db.js", "./menu-data.js", "./app.js", "./admin.js", "./manifest.webmanifest", "./assets/tokyo-logo-instagram.jpg"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
