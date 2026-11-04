import { envReady, json, readBody, requireUser, vreq } from "../lib.js";
import { jparse, jstringify, nowISO } from "../db.js";

// D1 limita cada fila a ~2 MB. Dejamos margen para el resto de columnas y
// rechazamos parches que no quepan antes de intentar escribir.
const MAX_COLUMN_BYTES = 800_000;
const MAX_ROW_BYTES = 1_500_000;
const encoder = new TextEncoder();

function byteLength(value) {
  return value == null ? 0 : encoder.encode(String(value)).byteLength;
}

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

function parseUserData(raw) {
  if (!raw) return null;
  const out = { ...raw };
  out.malla = jparse(out.malla);
  out.notas = jparse(out.notas);
  out.cursando = jparse(out.cursando);
  out.horario = jparse(out.horario);
  out.plan = jparse(out.plan);
  out.calendario = jparse(out.calendario);
  out.asignaciones = jparse(out.asignaciones);
  out.ajustes = jparse(out.ajustes);
  out.notasclase = jparse(out.notasclase);
  out.version = Number(out.version ?? 1);
  out.updated_at = out.updated_at ?? null;
  return out;
}

export async function handler(c) {
  const req = vreq(c);
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });
  const me = await requireUser(c);
  if (!me) return json(c, 401, { error: "Sesión inválida" });

  const db = c.env.DB;

  if (req.method === "GET") {
    const data = await db.prepare("SELECT * FROM user_data WHERE username = ?").bind(me.username).first();
    if (!data) return json(c, 200, { data: null });
    return json(c, 200, { data: parseUserData(data) });
  }

  if (req.method === "POST") {
    const { patch, baseVersion } = await readBody(c);
    if (!patch || typeof patch !== "object") return json(c, 400, { error: "Faltan datos" });

    const clean = {};
    for (const key of Object.keys(patch)) {
      if (ALLOWED_COLUMNS.has(key)) clean[key] = patch[key];
    }
    if (Object.keys(clean).length === 0) return json(c, 400, { error: "Sin cambios" });

    const existing = await db.prepare("SELECT * FROM user_data WHERE username = ?").bind(me.username).first();

    const currentVersion = Number(existing?.version ?? 1);
    // Control de concurrencia optimista: si el cliente envía una versión base anterior a la actual
    if (existing && baseVersion !== undefined && baseVersion !== null && Number(baseVersion) < currentVersion) {
      return json(c, 409, {
        error: "conflict",
        message: "Los datos fueron modificados en otro dispositivo",
        serverVersion: currentVersion,
        serverData: parseUserData(existing),
      });
    }

    // Seguridad: no aceptar push dentro de ajustes desde el cliente.
    // Las suscripciones push únicamente se administran a través del endpoint dedicado /api/push.
    if (clean.ajustes !== undefined && clean.ajustes !== null) {
      const incomingAjustes = typeof clean.ajustes === "object" ? clean.ajustes : jparse(clean.ajustes) || {};
      const sanitized = { ...incomingAjustes };
      delete sanitized.push;
      const existingAjustes = jparse(existing?.ajustes) || {};
      if (existingAjustes.push) {
        sanitized.push = existingAjustes.push;
      }
      clean.ajustes = sanitized;
    }

    const cleanStr = {};
    for (const k of Object.keys(clean)) {
      cleanStr[k] = jstringify(clean[k]);
    }

    // Tope por columna y por fila: si el parche (o la suma con lo que ya había)
    // supera el límite de D1, se rechaza con 413 en vez de perder la escritura.
    let rowBytes = 0;
    for (const column of ALLOWED_COLUMNS) {
      const incoming = cleanStr[column];
      const size = byteLength(incoming !== undefined ? incoming : existing?.[column]);
      if (incoming !== undefined && size > MAX_COLUMN_BYTES) {
        return json(c, 413, {
          error: `La sección "${column}" es demasiado grande para guardarse`,
        });
      }
      rowBytes += size;
    }
    if (rowBytes > MAX_ROW_BYTES) {
      return json(c, 413, {
        error: "Tus datos superan el tamaño máximo que puede guardar el servidor",
      });
    }

    const newVersion = existing ? currentVersion + 1 : 1;
    const now = nowISO();

    try {
      if (existing) {
        const keys = Object.keys(cleanStr);
        const sets = keys.map((k) => `${k} = ?`).join(", ");
        const vals = keys.map((k) => cleanStr[k]);
        try {
          await db
            .prepare(`UPDATE user_data SET ${sets}, version = ?, updated_at = ? WHERE username = ?`)
            .bind(...vals, newVersion, now, me.username)
            .run();
        } catch (colErr) {
          if (String(colErr?.message || "").toLowerCase().includes("no such column")) {
            await db.prepare(`UPDATE user_data SET ${sets} WHERE username = ?`).bind(...vals, me.username).run();
          } else {
            throw colErr;
          }
        }
      } else {
        try {
          const cols = ["username", ...Object.keys(cleanStr), "version", "updated_at"].join(", ");
          const qs = Array(Object.keys(cleanStr).length + 3).fill("?").join(", ");
          const vals = [me.username, ...Object.keys(cleanStr).map((k) => cleanStr[k]), 1, now];
          await db.prepare(`INSERT INTO user_data (${cols}) VALUES (${qs})`).bind(...vals).run();
        } catch (colErr) {
          if (String(colErr?.message || "").toLowerCase().includes("no such column")) {
            const fallbackCols = ["username", ...Object.keys(cleanStr)].join(", ");
            const fallbackQs = Array(Object.keys(cleanStr).length + 1).fill("?").join(", ");
            const fallbackVals = [me.username, ...Object.keys(cleanStr).map((k) => cleanStr[k])];
            await db.prepare(`INSERT INTO user_data (${fallbackCols}) VALUES (${fallbackQs})`).bind(...fallbackVals).run();
          } else {
            throw colErr;
          }
        }
      }
      return json(c, 200, { ok: true, version: newVersion, updated_at: now });
    } catch {
      return json(c, 500, { error: "No se pudo guardar tus datos" });
    }
  }

  return json(c, 405, { error: "method" });
}
