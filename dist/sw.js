const CACHE = "aimer-v1792382374833";
// a donde salta el servidor local de pruebas (vite preview), que no tiene /api
const NEW_ORIGIN = "https://aimer-project.yaritzamilena4.workers.dev";
// El salto es SOLO para localhost. Antes se aplicaba a cualquier origen distinto
// de workers.dev, y por eso al entrar a aimeru.lat la navegacion se redirigia a
// workers.dev y la barra de direcciones mostraba el dominio viejo.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(self.location.hostname);
const LEGACY_ORIGIN = LOCAL_HOST && self.location.origin !== NEW_ORIGIN;
const CORE = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];
const PRECACHE = ["/_headers","/aimer.svg","/assets/AsignacionesView-af2cfa1f.js","/assets/AsignacionesView-f2d39ec8.css","/assets/CalendarioView-22ca1727.css","/assets/CalendarioView-f74a13e4.js","/assets/ChatView-52a3de49.css","/assets/ChatView-e087f882.js","/assets/ColaboracionView-41abe0dc.css","/assets/ColaboracionView-60b1129c.js","/assets/CursandoView-6ac27160.css","/assets/CursandoView-884c8365.js","/assets/CustomCursor-076f71c1.css","/assets/CustomCursor-f7dfba25.js","/assets/Dashboard-693b9028.css","/assets/Dashboard-798a9ded.js","/assets/HorarioExport-158951e2.css","/assets/HorarioExport-5f59573d.js","/assets/HorarioView-edc2a902.css","/assets/HorarioView-f0844fd3.js","/assets/HorarioWallpaper-380bd89e.js","/assets/HorarioWallpaper-8e427b70.css","/assets/Login-6bb74793.js","/assets/Login-ea9f26c4.css","/assets/MallaView-31855f3e.js","/assets/MallaView-4acc1819.css","/assets/NotasView-362c71e5.js","/assets/NotasView-44119669.css","/assets/SettingsView-08c7ecb7.js","/assets/SettingsView-48d0b07a.css","/assets/UpdatePrompt-93701845.css","/assets/UpdatePrompt-9fe2d3d5.js","/assets/academic-150329ee.js","/assets/careerProgress-54c9a332.js","/assets/friendsApi-c724ac1f.js","/assets/horarioHelpers-6d83de28.js","/assets/html2canvas.esm-dc7c977a.js","/assets/index-00be5468.js","/assets/index-bb6fec06.js","/assets/index-e52542c8.css","/assets/index-f2811c2d.js","/assets/index.es-c362ff67.js","/assets/jspdf.es.min-8243aa66.js","/assets/notasClase-34006f8a.js","/assets/purify.es-e7687dc2.js","/assets/semesterCountdown-a51eb9e3.js","/assets/useBodyScrollLock-eaa38a9c.js","/assets/vendor-653562d3.js","/favicon.ico","/fonts/OverusedGrotesk-VF.ttf","/fonts/Sentient-Bold.woff","/fonts/Sentient-Bold.woff2","/fonts/Sentient-BoldItalic.woff","/fonts/Sentient-BoldItalic.woff2","/fonts/Sentient-Extralight.woff","/fonts/Sentient-Extralight.woff2","/fonts/Sentient-ExtralightItalic.woff","/fonts/Sentient-ExtralightItalic.woff2","/fonts/Sentient-Italic.woff","/fonts/Sentient-Italic.woff2","/fonts/Sentient-Light.woff","/fonts/Sentient-Light.woff2","/fonts/Sentient-LightItalic.woff","/fonts/Sentient-LightItalic.woff2","/fonts/Sentient-Medium.woff","/fonts/Sentient-Medium.woff2","/fonts/Sentient-MediumItalic.woff","/fonts/Sentient-MediumItalic.woff2","/fonts/Sentient-Regular.woff","/fonts/Sentient-Regular.woff2","/fonts/Sentient-Variable.woff","/fonts/Sentient-Variable.woff2","/fonts/Sentient-VariableItalic.woff","/fonts/Sentient-VariableItalic.woff2","/icons/apple-touch-icon.png","/icons/favicon-16.png","/icons/favicon-32.png","/icons/icon-192-maskable.png","/icons/icon-192.png","/icons/icon-512-maskable.png","/icons/icon-512.png","/manifest.webmanifest"];

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

  if (LEGACY_ORIGIN && (req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html"))) {
    e.respondWith(Response.redirect(NEW_ORIGIN + url.pathname + url.search, 307));
    return;
  }

  if (req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    e.respondWith(serveHtml(req, url));
    return;
  }

  e.respondWith(cacheFirst(req));
});