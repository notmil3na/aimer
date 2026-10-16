// helpers de acceso a D1 y utilidades comunes
export function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export function nowISO() {
  return new Date().toISOString();
}

export function jparse(text) {
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function jstringify(obj) {
  if (obj === undefined || obj === null) return null;
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

// acepta tanto un `D1PreparedStatement` (sin ejecutar) como una promesa ya lanzada.
// devuelve el primer resultado
export async function first(q) {
  try {
    const s = await q;
    const row = s && typeof s.first === "function" ? await s.first() : s;
    return { data: row ?? null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// all
export async function all(q) {
  try {
    const s = await q;
    const res = s && typeof s.all === "function" ? await s.all() : s;
    return { data: res?.results ?? [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}
