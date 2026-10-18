const BASE = "/api";

function readSession() {
  try {
    const raw = localStorage.getItem("malla_session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(token, user, data) {
  const prev = readSession();
  const nextData = data !== undefined ? data : (prev && prev.data) || null;
  localStorage.setItem("malla_session", JSON.stringify({ token, user, data: nextData }));
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
    localStorage.setItem("malla_session", JSON.stringify({ ...s, data }));
  } catch (_) {}
}

export function clearSession() {
  localStorage.removeItem("malla_session");
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
