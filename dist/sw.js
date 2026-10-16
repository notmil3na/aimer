const CACHE = "aimer-v1792187163984";
const CORE = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];
const PRECACHE = ["/_headers","/assets/AsignacionesView-c1aaf27b.css","/assets/AsignacionesView-ec8d10a2.js","/assets/CalendarioView-22ca1727.css","/assets/CalendarioView-43dbbce3.js","/assets/ChatView-077cc15d.js","/assets/ChatView-e53a3ceb.css","/assets/ColaboracionView-69073c00.js","/assets/ColaboracionView-be69d28d.css","/assets/CursandoView-409d7205.js","/assets/CursandoView-fea7fd8f.css","/assets/CustomCursor-076f71c1.css","/assets/CustomCursor-b85b6c90.js","/assets/Dashboard-3d0daf75.js","/assets/Dashboard-b88b9d0e.css","/assets/HorarioExport-158951e2.css","/assets/HorarioExport-75a704ab.js","/assets/HorarioView-4efcaa0e.css","/assets/HorarioView-567a82ec.js","/assets/HorarioWallpaper-2dc5e662.js","/assets/HorarioWallpaper-8e427b70.css","/assets/Login-2b8618d2.css","/assets/Login-9d87865e.js","/assets/MallaView-2f1894a2.js","/assets/MallaView-4f6f884b.css","/assets/NotasView-40b368fe.js","/assets/NotasView-57c87d14.css","/assets/SettingsView-48d0b07a.css","/assets/SettingsView-5fbf4199.js","/assets/UpdatePrompt-32d42e12.js","/assets/UpdatePrompt-5f133d84.css","/assets/academic-41534e4b.js","/assets/careerProgress-520cf5e3.js","/assets/friendsApi-22afee24.js","/assets/horarioHelpers-6d83de28.js","/assets/html2canvas.esm-f16e60ff.js","/assets/index-1b1ae201.js","/assets/index-a61fb1f8.css","/assets/index-a7cba66d.js","/assets/index-dd7132e3.js","/assets/index.es-a9876b5f.js","/assets/jspdf.es.min-765a470c.js","/assets/notasClase-34006f8a.js","/assets/purify.es-541be1bb.js","/assets/semesterCountdown-a51eb9e3.js","/assets/useBodyScrollLock-ae9a8868.js","/assets/vendor-27d6d7f2.js","/fonts/Sentient-Bold.woff","/fonts/Sentient-Bold.woff2","/fonts/Sentient-BoldItalic.woff","/fonts/Sentient-BoldItalic.woff2","/fonts/Sentient-Extralight.woff","/fonts/Sentient-Extralight.woff2","/fonts/Sentient-ExtralightItalic.woff","/fonts/Sentient-ExtralightItalic.woff2","/fonts/Sentient-Italic.woff","/fonts/Sentient-Italic.woff2","/fonts/Sentient-Light.woff","/fonts/Sentient-Light.woff2","/fonts/Sentient-LightItalic.woff","/fonts/Sentient-LightItalic.woff2","/fonts/Sentient-Medium.woff","/fonts/Sentient-Medium.woff2","/fonts/Sentient-MediumItalic.woff","/fonts/Sentient-MediumItalic.woff2","/fonts/Sentient-Regular.woff","/fonts/Sentient-Regular.woff2","/fonts/Sentient-Variable.woff","/fonts/Sentient-Variable.woff2","/fonts/Sentient-VariableItalic.woff","/fonts/Sentient-VariableItalic.woff2","/icons/apple-touch-icon.png","/icons/icon-192.png","/icons/icon-512-maskable.png","/icons/icon-512.png","/manifest.webmanifest"];

const isSwVersion = (key) => key.startsWith("aimer-v");
const toNumber = (key) => Number(key.replace(/^aimer-v/, "")) || 0;

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
  const title = payload.title || "Aimer · Recordatorio";
  const opts = {
    body: payload.body || "Tienes un recordatorio pendiente.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "aimer-" + Date.now(),
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