import { envReady, json, readBody, verifyPassword, hashPassword, isColumnMissing, vreq } from "../../lib.js";

export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "POST") return json(c, 405, { error: "method" });
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });

  const { username, answer, newPassword } = await readBody(c);
  if (!username) {
    return json(c, 400, { error: "Escribe tu usuario" });
  }
  if (newPassword && String(newPassword).length < 6) {
    return json(c, 400, { error: "La nueva contraseña debe tener al menos 6 caracteres" });
  }

  const db = c.env.DB;
  let data;
  try {
    data = await db
      .prepare("SELECT username,password,security_question,security_answer FROM users WHERE username = ?")
      .bind(String(username).trim())
      .first();
  } catch (error) {
    if (isColumnMissing(error)) {
      return json(c, 500, { error: "Falta la migración de seguridad", needsMigration: true });
    }
    return json(c, 500, { error: "No se pudo recuperar la cuenta" });
  }
  if (!data) return json(c, 401, { error: "Usuario no encontrado" });

  if (!data.security_question || !data.security_answer) {
    return json(c, 400, { error: "Ese usuario no configuró pregunta de seguridad", notConfigured: true });
  }

  if (!answer || !newPassword) {
    return json(c, 200, { question: data.security_question });
  }

  const ok = await verifyPassword(String(answer), data.security_answer);
  if (!ok) return json(c, 400, { error: "La respuesta no coincide" });

  const hashed = await hashPassword(String(newPassword));
  try {
    await db.prepare("UPDATE users SET password = ? WHERE username = ?").bind(hashed, data.username).run();
  } catch {
    return json(c, 500, { error: "No se pudo restablecer la contraseña" });
  }

  return json(c, 200, { ok: true });
}
