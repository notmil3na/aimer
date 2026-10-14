const CACHE = "mimalla-v1791956990253";
const CORE = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];
const PRECACHE = ["/assets/AsignacionesView-1812742b.js","/assets/AsignacionesView-7b51041b.css","/assets/CalendarioView-220bfe1c.css","/assets/CalendarioView-f5a86740.js","/assets/ChatView-665c95b9.css","/assets/ChatView-a866a252.js","/assets/ColaboracionView-2eb3e26e.css","/assets/ColaboracionView-503c7405.js","/assets/CursandoView-d3de19ba.js","/assets/CursandoView-d9992b55.css","/assets/CustomCursor-414bbb10.css","/assets/CustomCursor-669a8e48.js","/assets/Dashboard-b107d519.js","/assets/Dashboard-b329c188.css","/assets/HorarioExport-4441eb03.css","/assets/HorarioExport-a05ae5e1.js","/assets/HorarioView-09405986.css","/assets/HorarioView-1fad8847.js","/assets/HorarioWallpaper-05e5c4bb.css","/assets/HorarioWallpaper-5963d349.js","/assets/Login-1dea8ddd.css","/assets/Login-6c990f3d.js","/assets/MallaView-a06c7cbe.css","/assets/MallaView-c74a6f71.js","/assets/NotasView-05d5481e.js","/assets/NotasView-80ba163b.css","/assets/SettingsView-656c58df.js","/assets/SettingsView-f9305d00.css","/assets/UpdatePrompt-90a3fafd.css","/assets/UpdatePrompt-b8dbf392.js","/assets/academic-4c78966e.js","/assets/careerProgress-4497761c.js","/assets/friendsApi-e50cfd92.js","/assets/horarioHelpers-6d83de28.js","/assets/html2canvas.esm-f16e60ff.js","/assets/index-1b1ae201.js","/assets/index-a7cba66d.js","/assets/index-eb63b814.js","/assets/index-eb93115c.css","/assets/index.es-650d34a6.js","/assets/jspdf.es.min-b475143f.js","/assets/notasClase-34006f8a.js","/assets/purify.es-541be1bb.js","/assets/semesterCountdown-a51eb9e3.js","/assets/useBodyScrollLock-93de64dc.js","/assets/vendor-27d6d7f2.js","/icons/apple-touch-icon.png","/icons/icon-192.png","/icons/icon-512-maskable.png","/icons/icon-512.png","/manifest.webmanifest"];

const isSwVersion = (key) => key.startsWith("mimalla-v");
const toNumber = (key) => Number(key.replace(/^mimalla-v/, "")) || 0;

function findInCaches(req) {
  return caches
    .keys()
    .then((keys) =>
      keys
        .filter(isSwVersion)
        .sort((a, b) => toNumber(b) - toNumber(a))
        .reduce(
          (chain, name) =>
            chain.then((hit) => (hit ? hit : caches.open(name).then((c) => c.match(req)))),
          Promise.resolve()
        )
    );
}

function cacheFirst(req) {
  return findInCaches(req).then((cached) => cached || networkFirst(req));
}

function networkFirst(req) {
  return fetch(req).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });
}

const HTML_NETWORK_TIMEOUT = 1500;

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    fetch(req)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

function htmlKey(url) {
  return new Request(url.origin + url.pathname, { method: "GET" });
}

function putHtml(key, res) {
  if (!res || !res.ok) return;
  const copy = res.clone();
  caches.open(CACHE).then((cache) => cache.put(key, copy));
}

function offlineResponse() {
  return new Response("Sin conexión", {
    status: 503,
    headers: { "Content-Type": "text/plain" },
  });
}

async function serveHtml(req, url) {
  const key = htmlKey(url);
  const cached = await findInCaches(key).catch(() => undefined);

  if (url.searchParams.has("_sw")) {
    let res;
    try { res = await fetch(req); } catch (_) {}
    putHtml(key, res);
    if (res && res.ok) return res;
    return cached || offlineResponse();
  }

  if (cached) {
    fetch(req).then((res) => putHtml(key, res)).catch(() => {});
    return cached;
  }

  let res;
  try { res = await fetchWithTimeout(req, HTML_NETWORK_TIMEOUT); } catch (_) {}
  putHtml(key, res);
  if (res && res.ok) return res;
  const root = await findInCaches(htmlKey(new URL(url.origin + "/"))).catch(() => undefined);
  return root || res || offlineResponse();
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(async (c) => {
        const list = self.registration.active ? [...CORE, ...PRECACHE] : CORE;
        const jobs = [...new Set(list)].map(async (url) => {
          try {
            const req = new Request(url, { cache: "no-store" });
            const res = await fetch(req);
            if (res && res.ok) await c.put(url, res);
          } catch (_) {}
        });
        await Promise.all(jobs);
      })
      .then(() => {
        if (self.registration.active) {
          return self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((list) => list.forEach((client) => client.postMessage({ type: "SW_WAITING" })));
        }
      })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (e) => {
  let payload = {};
  try {
    payload = e.data ? e.data.json() : {};
  } catch (_) {}
  const title = payload.title || "MiMalla · Recordatorio";
  const opts = {
    body: payload.body || "Tienes un recordatorio pendiente.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "mimalla-" + Date.now(),
    data: { url: payload.url || "/" },
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data && e.notification.data.url
    ? e.notification.data.url
    : "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const target = list.find((c) => c.url && c.url.startsWith(self.location.origin));
      if (target) {
        target.focus();
        return target.navigate(url).catch(() => {});
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  if (!req.url.startsWith(self.location.origin)) return;

  if (req.url.includes("/api/")) return;

  const url = new URL(req.url);
  if (url.pathname === "/sw.js") return;

  if (req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    e.respondWith(serveHtml(req, url));
    return;
  }

  e.respondWith(cacheFirst(req));
});