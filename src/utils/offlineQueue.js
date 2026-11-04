const DEFAULT_STORAGE_KEY = "aimer_pending_saves";

function getStorageKey(username) {
  return username ? `aimer_pending_saves_${username}` : DEFAULT_STORAGE_KEY;
}

export function getPendingEntries(username = null) {
  try {
    // Si se pasa usuario, chequear clave de usuario y también migrar la clave default si existe
    const key = getStorageKey(username);
    let raw = localStorage.getItem(key);
    if (!raw && username) {
      raw = localStorage.getItem(DEFAULT_STORAGE_KEY);
      if (raw) {
        localStorage.setItem(key, raw);
        localStorage.removeItem(DEFAULT_STORAGE_KEY);
      }
    }
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getPendingSaves(username = null) {
  const entries = getPendingEntries(username);
  const result = {};
  for (const [col, entry] of Object.entries(entries)) {
    if (entry && typeof entry === "object" && "data" in entry) {
      result[col] = entry.data;
    } else {
      result[col] = entry;
    }
  }
  return result;
}

export function getPendingSaveMeta(column, username = null) {
  const entries = getPendingEntries(username);
  const entry = entries[column];
  if (!entry) return null;
  if (entry && typeof entry === "object" && "data" in entry) {
    return entry;
  }
  return { data: entry, baseVersion: 1, timestamp: Date.now() };
}

export function hasPendingSaves(username = null) {
  return Object.keys(getPendingEntries(username)).length > 0;
}

export function queueSave(column, data, baseVersion = 1, username = null) {
  const entries = getPendingEntries(username);
  entries[column] = {
    data,
    baseVersion: Number(baseVersion || 1),
    timestamp: Date.now(),
  };
  try {
    localStorage.setItem(getStorageKey(username), JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingSave(column, username = null) {
  const entries = getPendingEntries(username);
  delete entries[column];
  try {
    localStorage.setItem(getStorageKey(username), JSON.stringify(entries));
  } catch {}
}

export function clearAllPendingSaves(username = null) {
  try {
    localStorage.removeItem(getStorageKey(username));
  } catch {}
}
