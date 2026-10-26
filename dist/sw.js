const CACHE = "aimer-v1792979873365";
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
const PRECACHE = ["/_headers","/aimer.svg","/assets/AsignacionesView-e11f6fac.css","/assets/AsignacionesView-e63c6ada.js","/assets/CalendarioView-2b9a9d11.js","/assets/CalendarioView-7f8dacc5.css","/assets/ChatView-bcda1794.css","/assets/ChatView-f363270d.js","/assets/ColaboracionView-0adb293c.css","/assets/ColaboracionView-ab2f6725.js","/assets/CursandoView-3b8cfeba.css","/assets/CursandoView-99af2cfb.js","/assets/Dashboard-380ff66a.js","/assets/Dashboard-f12fc5c4.css","/assets/HorarioExport-244b58aa.js","/assets/HorarioExport-b11b08c7.css","/assets/HorarioView-d0bb1be2.js","/assets/HorarioView-e9f5438f.css","/assets/HorarioWallpaper-4b0eb341.js","/assets/HorarioWallpaper-9304a346.css","/assets/Login-03941cd0.css","/assets/Login-da97ce5a.js","/assets/MallaView-b8d998bb.js","/assets/MallaView-d4896dce.css","/assets/NotasView-127d1448.js","/assets/NotasView-d607ddcd.css","/assets/SettingsView-2f844d40.js","/assets/SettingsView-4c0d710f.css","/assets/UpdatePrompt-245960b7.js","/assets/UpdatePrompt-7d136648.css","/assets/academic-e387c3e1.js","/assets/careerProgress-d8eb2e5d.js","/assets/friendsApi-2e4684ca.js","/assets/horarioHelpers-6d83de28.js","/assets/html2canvas.esm-dc7c977a.js","/assets/index-00be5468.js","/assets/index-0ac14058.js","/assets/index-5042306e.css","/assets/index.es-e627017d.js","/assets/jspdf.es.min-9816cbbb.js","/assets/notasClase-34006f8a.js","/assets/purify.es-e7687dc2.js","/assets/semesterCountdown-a51eb9e3.js","/assets/useBodyScrollLock-e2c28317.js","/assets/vendor-653562d3.js","/favicon.ico","/fonts/OverusedGrotesk-VF.ttf","/fonts/Sentient-Bold.woff","/fonts/Sentient-Bold.woff2","/fonts/Sentient-BoldItalic.woff","/fonts/Sentient-BoldItalic.woff2","/fonts/Sentient-Extralight.woff","/fonts/Sentient-Extralight.woff2","/fonts/Sentient-ExtralightItalic.woff","/fonts/Sentient-ExtralightItalic.woff2","/fonts/Sentient-Italic.woff","/fonts/Sentient-Italic.woff2","/fonts/Sentient-Light.woff","/fonts/Sentient-Light.woff2","/fonts/Sentient-LightItalic.woff","/fonts/Sentient-LightItalic.woff2","/fonts/Sentient-Medium.woff","/fonts/Sentient-Medium.woff2","/fonts/Sentient-MediumItalic.woff","/fonts/Sentient-MediumItalic.woff2","/fonts/Sentient-Regular.woff","/fonts/Sentient-Regular.woff2","/fonts/Sentient-Variable.woff","/fonts/Sentient-Variable.woff2","/fonts/Sentient-VariableItalic.woff","/fonts/Sentient-VariableItalic.woff2","/icons/apple-touch-icon.png","/icons/favicon-16.png","/icons/favicon-32.png","/icons/icon-192-maskable.png","/icons/icon-192.png","/icons/icon-512-maskable.png","/icons/icon-512.png","/icons/icono-animado-difuminado.svg","/manifest.webmanifest"];

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