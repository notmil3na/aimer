const BASE = "/api";
const STORAGE_KEY = "malla_session";

function readSession() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }
  return null;
}

/* La sesión (el JWT) vive en una cookie HttpOnly que este código no puede leer.
   Aquí solo se guardan las preferencias y los datos para pintar la app al
   instante; nunca el token. */
function stripLegacyToken() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && "token" in parsed) {
        delete parsed.token;
        store.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch {}
  }
}

stripLegacyToken();

/* true cuando la sesión sobrevive al cierre del navegador (localStorage). */
export function isPersistentSession() {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return true;
  }
}

/* `persist` decide dónde viven las preferencias: localStorage (sobrevive al
   cerrar el navegador) o sessionStorage (solo esta pestaña). Sin `persist` se
   conserva el almacén que ya tenía la sesión, para no moverla al actualizar el
   perfil. El token no se guarda: lo pone el servidor en la cookie. */
export function saveSession(user, data, persist) {
  const prev = readSession();
  const nextData = data !== undefined ? data : (prev && prev.data) || null;
  const keepLocal = typeof persist === "boolean" ? persist : isPersistentSession();
  const payload = JSON.stringify({ user, data: nextData });
  try {
    if (keepLocal) {
      localStorage.setItem(STORAGE_KEY, payload);
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, payload);
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export function getSession() {
  return readSession();
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
    const payload = JSON.stringify({ user: s.user, data });
    const store = localStorage.getItem(STORAGE_KEY) ? localStorage : sessionStorage;
    store.setItem(STORAGE_KEY, payload);
  } catch (_) {}
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}

const PUBLIC_AUTH_PATHS = new Set(["/auth/login", "/auth/register"]);

export async function api(path, { method = "GET", body, skipAuth = false, soft401 = false } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "same-origin", // la cookie HttpOnly viaja sola
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (netErr) {
    netErr.status = 0;
    throw netErr;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (res.status === 401) {
    if (!skipAuth && !PUBLIC_AUTH_PATHS.has(path)) {
      clearSession();
      if (!soft401) window.location.reload();
    }
    const err = new Error((data && data.error) || "Sesión expirada");
    err.status = res.status;
    if (data) {
      err.code = data.code;
      err.needsMigration = data.needsMigration;
      err.notConfigured = data.notConfigured;
      err.retryAfter = data.retryAfter;
    }
    throw err;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || "Error de red");
    if (data) {
      err.code = data.code;
      err.needsMigration = data.needsMigration;
      err.notConfigured = data.notConfigured;
      err.retryAfter = data.retryAfter;
    }
    err.status = res.status;
    throw err;
  }
  if (data === null) {
    const err = new Error("El servidor no devolvió una respuesta válida");
    err.status = res.status;
    throw err;
  }
  return data;
}

/* Cierra la sesión en el servidor (borra la cookie) y en el navegador. */
export async function logout() {
  clearSession();
  try {
    await fetch(BASE + "/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch (_) {}
}
