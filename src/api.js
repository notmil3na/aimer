const BASE = "/api";

function readSession() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem("malla_session");
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return null;
}

/* `persist` decide dónde vive la sesión: localStorage (sobrevive al cerrar el
   navegador) o sessionStorage (solo esta pestaña). Sin `persist` se conserva el
   almacén que ya tenía la sesión, para no moverla al actualizar el perfil. */
export function saveSession(token, user, data, persist) {
  const prev = readSession();
  const nextData = data !== undefined ? data : (prev && prev.data) || null;
  const keepLocal = (() => {
    if (typeof persist === "boolean") return persist;
    try {
      return !sessionStorage.getItem("malla_session") || !!localStorage.getItem("malla_session");
    } catch {
      return true;
    }
  })();
  const payload = JSON.stringify({ token, user, data: nextData });
  try {
    if (keepLocal) {
      localStorage.setItem("malla_session", payload);
      sessionStorage.removeItem("malla_session");
    } else {
      sessionStorage.setItem("malla_session", payload);
      localStorage.removeItem("malla_session");
    }
  } catch {}
}

export function getSessionData() {
  const s = readSession();
  return s && s.data ? s.data : null;
}

export function updateSessionData(patch) {
  if (!patch || typeof patch !== "object") return;
  try {
    const s = readSession();
    if (!s) return;
    const data = { ...(s.data || {}), ...patch };
    const payload = JSON.stringify({ ...s, data });
    const store = localStorage.getItem("malla_session") ? localStorage : sessionStorage;
    store.setItem("malla_session", payload);
  } catch (_) {}
}

export function clearSession() {
  try {
    localStorage.removeItem("malla_session");
    sessionStorage.removeItem("malla_session");
  } catch (_) {}
}

export function getToken() {
  const s = readSession();
  return s && s.token ? s.token : null;
}

const PUBLIC_AUTH_PATHS = new Set(["/auth/login", "/auth/register"]);

export async function api(path, { method = "GET", body, skipAuth = false, soft401 = false } = {}) {
  const token = skipAuth ? null : getToken();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (res.status === 401) {
    if (!PUBLIC_AUTH_PATHS.has(path)) {
      clearSession();
      if (!soft401) window.location.reload();
    }
    throw new Error((data && data.error) || "Sesión expirada");
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || "Error de red");
    if (data) {
      err.code = data.code;
      err.needsMigration = data.needsMigration;
      err.notConfigured = data.notConfigured;
    }
    throw err;
  }
  if (data === null) {
    throw new Error("El servidor no devolvió una respuesta válida");
  }
  return data;
}

const WARM_PATHS = ["/auth/login", "/auth/me", "/user_data", "/auth/security"];

export function prewarm() {
  if (typeof fetch === "undefined" || typeof document === "undefined") return;
  if (document.visibilityState === "hidden") return;
  WARM_PATHS.forEach((path) => {
    try {
      fetch(BASE + path, { method: "GET", keepalive: true }).catch(() => {});
    } catch (_) {}
  });
}
