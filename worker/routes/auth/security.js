import {
  envReady, json, readBody, requireUser, hashPassword, verifyPassword,
  isColumnMissing, vreq, getClientIP,
} from "../../lib.js";
import { checkAndIncrement, resetLimit } from "../../rate-limit.js";

// 5 intentos por usuario en 15 min → bloqueo 15 min.
// 20 intentos por IP en 15 min → bloqueo 30 min.
const SECURITY_USER_LIMIT = { maxAttempts: 5, windowSec: 900, lockoutSec: 900 };
const SECURITY_IP_LIMIT = { maxAttempts: 20, windowSec: 900, lockoutSec: 1800 };
const MAX_QUESTION_CHARS = 200;
const MAX_ANSWER_CHARS = 200;

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
    const { currentPassword, question, answer } = await readBody(c);
    const q = String(question || "").trim();
    const a = String(answer || "").trim().toLowerCase();
    if (!q || !a) return json(c, 400, { error: "Pregunta y respuesta son obligatorias" });
    if (q.length > MAX_QUESTION_CHARS) {
      return json(c, 400, { error: "La pregunta es demasiado larga" });
    }
    if (a.length < 3 || a.length > MAX_ANSWER_CHARS) {
      return json(c, 400, { error: "La respuesta debe tener entre 3 y 200 caracteres" });
    }
    if (!currentPassword) {
      return json(c, 400, { error: "La contraseña actual es obligatoria" });
    }

    const ip = getClientIP(c);
    const userKey = `security:${me.username}`;
    const ipKey = `security-ip:${ip}`;

    // La pregunta de seguridad permite restablecer la contraseña, así que
    // cambiarla exige la contraseña actual y está limitada contra fuerza bruta.
    try {
      const [userCheck, ipCheck] = await Promise.all([
        checkAndIncrement(db, userKey, SECURITY_USER_LIMIT),
        checkAndIncrement(db, ipKey, SECURITY_IP_LIMIT),
      ]);
      if (!userCheck.allowed) {
        const retry = userCheck.retryAfter;
        return json(c, 429, {
          error: `Demasiados intentos. Intenta de nuevo en ${Math.ceil(retry / 60)} minuto(s).`,
          retryAfter: retry,
        });
      }
      if (!ipCheck.allowed) {
        const retry = ipCheck.retryAfter;
        return json(c, 429, {
          error: `Demasiados intentos desde esta dirección. Intenta de nuevo en ${Math.ceil(retry / 60)} minuto(s).`,
          retryAfter: retry,
        });
      }
    } catch (e) {
      console.error("rate-limit check failed (security)", e);
    }

    const targetData = await db
      .prepare("SELECT password FROM users WHERE username = ?")
      .bind(me.username)
      .first();
    if (!targetData) return json(c, 500, { error: "No se pudo recuperar la cuenta" });

    const ok = await verifyPassword(String(currentPassword), targetData.password);
    if (!ok) return json(c, 400, { error: "La contraseña actual es incorrecta" });

    try {
      await Promise.all([resetLimit(db, userKey), resetLimit(db, ipKey)]);
    } catch { /* no crítico */ }

    try {
      await db
        .prepare("UPDATE users SET security_question = ?, security_answer = ? WHERE username = ?")
        .bind(q, await hashPassword(a), me.username)
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
