import { envReady, json, readBody, requireUser, hashPassword, verifyPassword, isColumnMissing, vreq } from "../../lib.js";

export async function handler(c) {
  const req = vreq(c);
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });
  const me = await requireUser(c);
  if (!me) return json(c, 401, { error: "Sesión inválida" });

  const db = c.env.DB;

  if (req.method === "GET") {
    try {
      const row = await db.prepare("SELECT security_question FROM users WHERE username = ?").bind(me.username).first();
      return json(c, 200, { question: (row && row.security_question) || "", needsMigration: false });
    } catch (error) {
      if (isColumnMissing(error)) {
        return json(c, 200, { question: "", needsMigration: true });
      }
      return json(c, 500, { error: "No se pudo recuperar la pregunta de seguridad" });
    }
  }

  if (req.method === "POST") {
    const { username, currentPassword, question, answer } = await readBody(c);
    const q = String(question || "").trim();
    const a = String(answer || "").trim();
    if (!q || !a) return json(c, 400, { error: "Pregunta y respuesta son obligatorias" });
    if (a.length < 3) return json(c, 400, { error: "La respuesta debe tener al menos 3 caracteres" });

    let target = me.username;
    if (!me) {
      target = username ? String(username).trim() : "";
      if (!target) return json(c, 401, { error: "Sesión inválida" });
      if (!currentPassword) return json(c, 400, { error: "La contraseña actual es obligatoria" });
      const targetData = await db.prepare("SELECT password FROM users WHERE username = ?").bind(target).first();
      if (!targetData) return json(c, 500, { error: "No se pudo recuperar la cuenta" });
      const ok = await verifyPassword(String(currentPassword), targetData.password);
      if (!ok) return json(c, 400, { error: "La contraseña actual es incorrecta" });
    }

    try {
      await db
        .prepare("UPDATE users SET security_question = ?, security_answer = ? WHERE username = ?")
        .bind(q, await hashPassword(a), target)
        .run();
      return json(c, 200, { ok: true });
    } catch (error) {
      if (isColumnMissing(error)) {
        return json(c, 500, { error: "Falta la migración de seguridad", needsMigration: true });
      }
      return json(c, 500, { error: "No se pudo guardar la pregunta de seguridad" });
    }
  }

  return json(c, 405, { error: "method" });
}
