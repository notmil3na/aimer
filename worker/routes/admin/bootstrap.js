import { timingSafeEqual } from "node:crypto";
import { json, readBody, vreq } from "../../lib.js";

const USERNAME_RE = /^[a-zA-Z0-9._-]{2,20}$/;

function matchesSecret(provided, expected) {
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "POST") return json(c, 405, { error: "method" });

  const expectedSecret = c.env.ADMIN_BOOTSTRAP_SECRET;
  if (!c.env.DB || !expectedSecret || Buffer.byteLength(expectedSecret, "utf8") < 32) {
    return json(c, 503, { error: "La configuración inicial de administración no está disponible" });
  }
  if (!matchesSecret(c.req.header("x-admin-bootstrap-secret") || "", expectedSecret)) {
    return json(c, 401, { error: "No autorizado" });
  }

  const { username: rawUsername } = await readBody(c);
  const username = String(rawUsername || "").trim();
  if (!USERNAME_RE.test(username)) return json(c, 400, { error: "Escribe un usuario válido" });

  const db = c.env.DB;
  try {
    const result = await db.prepare(
      `UPDATE users SET is_admin = 1
       WHERE username = ? AND is_admin = 0
         AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = 1)`
    ).bind(username).run();
    if (!result.meta?.changes) {
      const admins = await db.prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1").first();
      if (Number(admins?.count || 0) > 0) {
        return json(c, 409, { error: "La administración ya fue configurada" });
      }
      return json(c, 404, { error: "No existe esa cuenta; regístrala primero" });
    }
  } catch (error) {
    console.error("falló la configuración inicial de administración", error);
    return json(c, 500, { error: "No se pudo configurar la cuenta administradora" });
  }

  console.info("cuenta administradora inicial configurada", username);
  return json(c, 200, { ok: true, username });
}
