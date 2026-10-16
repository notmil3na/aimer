import { envReady, json, readBody, requireUser, vreq } from "../lib.js";
import { jparse, jstringify } from "../db.js";

const ALLOWED_COLUMNS = new Set([
  "malla",
  "notas",
  "cursando",
  "horario",
  "plan",
  "calendario",
  "asignaciones",
  "ajustes",
  "notasclase",
]);

export async function handler(c) {
  const req = vreq(c);
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });
  const me = await requireUser(c);
  if (!me) return json(c, 401, { error: "Sesión inválida" });

  const db = c.env.DB;

  if (req.method === "GET") {
    const data = await db.prepare("SELECT * FROM user_data WHERE username = ?").bind(me.username).first();
    if (!data) return json(c, 200, { data: null });
    const out = { ...data };
    out.malla = jparse(out.malla);
    out.notas = jparse(out.notas);
    out.cursando = jparse(out.cursando);
    out.horario = jparse(out.horario);
    out.plan = jparse(out.plan);
    out.calendario = jparse(out.calendario);
    out.asignaciones = jparse(out.asignaciones);
    out.ajustes = jparse(out.ajustes);
    out.notasclase = jparse(out.notasclase);
    return json(c, 200, { data: out });
  }

  if (req.method === "POST") {
    const { patch } = await readBody(c);
    if (!patch || typeof patch !== "object") return json(c, 400, { error: "Faltan datos" });

    const clean = {};
    for (const key of Object.keys(patch)) {
      if (ALLOWED_COLUMNS.has(key)) clean[key] = patch[key];
    }
    if (Object.keys(clean).length === 0) return json(c, 400, { error: "Sin cambios" });

    const existing = await db.prepare("SELECT username FROM user_data WHERE username = ?").bind(me.username).first();

    const cleanStr = {};
    for (const k of Object.keys(clean)) {
      cleanStr[k] = jstringify(clean[k]);
    }

    try {
      if (existing) {
        const keys = Object.keys(cleanStr);
        const sets = keys.map((k) => `${k} = ?`).join(", ");
        const vals = keys.map((k) => cleanStr[k]);
        await db.prepare(`UPDATE user_data SET ${sets} WHERE username = ?`).bind(...vals, me.username).run();
      } else {
        const cols = ["username", ...Object.keys(cleanStr)].join(", ");
        const qs = Array(Object.keys(cleanStr).length + 1).fill("?").join(", ");
        const vals = [me.username, ...Object.keys(cleanStr).map((k) => cleanStr[k])];
        await db.prepare(`INSERT INTO user_data (${cols}) VALUES (${qs})`).bind(...vals).run();
      }
      return json(c, 200, { ok: true });
    } catch {
      return json(c, 500, { error: "No se pudo guardar tus datos" });
    }
  }

  return json(c, 405, { error: "method" });
}
