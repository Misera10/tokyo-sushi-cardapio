const CACHE_NAME = "tokyo-sushi-v20260816-schedule-override-1";
const ASSETS = [
  "./", "./index.html", "./admin.html", "./styles.css", "./admin.css", "./config.js", "./db.js", "./menu-data.js", "./schedule.js", "./app.js", "./admin.js", "./manifest.webmanifest", "./admin-manifest.webmanifest", "./icon.svg", "./assets/tokyo-logo-instagram.jpg", "./assets/hero/tokyo-izakaya-hero.png", "./assets/hero/tokyo-kanban-v2.webp",
  "./assets/menu/5141360.jpeg", "./assets/menu/5141386.jpeg", "./assets/menu/5141416.jpeg", "./assets/menu/5141422.jpeg", "./assets/menu/5141472.jpeg", "./assets/menu/5141527.jpeg", "./assets/menu/5141541.jpeg", "./assets/menu/5141662.jpeg", "./assets/menu/5141673.jpeg", "./assets/menu/5141714.jpeg", "./assets/menu/5141758.jpeg", "./assets/menu/5142965.jpeg", "./assets/menu/5142974.jpeg", "./assets/menu/5142983.jpeg", "./assets/menu/5142990.jpeg", "./assets/menu/5142995.jpeg", "./assets/menu/5142999.jpeg", "./assets/menu/5143005.jpeg", "./assets/menu/5143032.jpeg", "./assets/menu/5143036.jpeg", "./assets/menu/5143058.jpeg", "./assets/menu/5143064.jpeg", "./assets/menu/5143092.jpeg", "./assets/menu/5143093.jpeg", "./assets/menu/5143124.jpeg", "./assets/menu/5143126.jpeg", "./assets/menu/5143148.jpeg", "./assets/menu/5143153.jpeg", "./assets/menu/5143158.jpeg", "./assets/menu/5143162.jpeg", "./assets/menu/5143164.jpeg", "./assets/menu/5150663.jpeg", "./assets/menu/5150695.jpeg", "./assets/menu/5154590.jpeg", "./assets/menu/5160817.jpeg"
];

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
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
    return;
  }

  if (event.request.destination === "image") {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    })));
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { body: event.data?.text() || "Há um novo pedido." }; }
  event.waitUntil(self.registration.showNotification(data.title || "Novo pedido · Tokyo Sushi", {
    body: data.body || "Confira o painel de pedidos.",
    icon: data.icon || "./icon.svg",
    badge: data.badge || "./icon.svg",
    tag: data.tag || "tokyo-new-order",
    renotify: true,
    data: { url: data.url || data.data?.url || "./admin.html#main-content" }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "./admin.html#main-content", self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => client.url.startsWith(self.registration.scope));
    if (existing) return existing.focus().then(() => existing.navigate(targetUrl));
    return self.clients.openWindow(targetUrl);
  }));
});
