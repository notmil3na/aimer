import { timingSafeEqual } from "node:crypto";
import { hashPassword, json, readBody, vreq } from "../../lib.js";

const USERNAME_RE = /^[a-zA-Z0-9._-]{2,20}$/;

function matchesSecret(provided, expected) {
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "POST") return json(c, 405, { error: "method" });

  const expectedSecret = c.env.ADMIN_RESET_SECRET;
  if (!c.env.DB || !expectedSecret || Buffer.byteLength(expectedSecret, "utf8") < 32) {
    return json(c, 503, { error: "El restablecimiento administrativo no está configurado" });
  }

  const providedSecret = c.req.header("x-admin-reset-secret") || "";
  if (!matchesSecret(providedSecret, expectedSecret)) {
    return json(c, 401, { error: "No autorizado" });
  }

  const body = await readBody(c);
  const username = String(body.username || "").trim();
  const newPassword = String(body.newPassword || "");

  if (!USERNAME_RE.test(username)) {
    return json(c, 400, { error: "Escribe un usuario válido" });
  }
  if (newPassword.length < 12 || newPassword.length > 256) {
    return json(c, 400, { error: "La contraseña temporal debe tener entre 12 y 256 caracteres" });
  }

  const db = c.env.DB;
  try {
    const user = await db.prepare("SELECT username FROM users WHERE username = ?").bind(username).first();
    if (!user) return json(c, 404, { error: "No se encontró la cuenta" });

    const hashedPassword = await hashPassword(newPassword);
    const result = await db
      .prepare("UPDATE users SET password = ?, session_version = session_version + 1 WHERE username = ?")
      .bind(hashedPassword, username)
      .run();
    if (!result.meta?.changes) return json(c, 404, { error: "No se encontró la cuenta" });
  } catch (error) {
    console.error("falló el restablecimiento administrativo de contraseña", error);
    return json(c, 500, { error: "No se pudo restablecer la contraseña" });
  }

  console.info("restablecimiento administrativo de contraseña completado", username);
  return json(c, 200, { ok: true });
}
