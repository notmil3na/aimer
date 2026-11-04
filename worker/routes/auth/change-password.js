import {
  envReady, json, readBody, requireUser, verifyPassword, hashPassword, signToken,
  setSessionCookie, vreq, getClientIP, SESSION_REMEMBER_TTL, SESSION_BROWSER_TTL,
} from "../../lib.js";
import { checkAndIncrement, resetLimit } from "../../rate-limit.js";

// 5 intentos por usuario en 15 min → bloqueo 15 min.
// 20 intentos por IP en 15 min → bloqueo 30 min.
const CHANGE_PW_LIMIT = { maxAttempts: 5, windowSec: 900, lockoutSec: 900 };
const CHANGE_PW_IP_LIMIT = { maxAttempts: 20, windowSec: 900, lockoutSec: 1800 };

export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "POST") return json(c, 405, { error: "method" });
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });

  // Cambiar una contraseña exige una sesión válida. Antes, sin sesión, se
  // podía indicar cualquier `username` y usar este endpoint como oráculo de
  // contraseñas sin el límite de /auth/login.
  const me = await requireUser(c);
  if (!me) return json(c, 401, { error: "Sesión inválida" });

  const { currentPassword, newPassword, remember } = await readBody(c);
  if (!currentPassword || !newPassword) return json(c, 400, { error: "Completa todos los campos" });
  if (String(newPassword).length < 12 || String(newPassword).length > 256) {
    return json(c, 400, { error: "La nueva contraseña debe tener entre 12 y 256 caracteres" });
  }

  const target = me.username;
  const db = c.env.DB;
  const ip = getClientIP(c);
  const userKey = `changepw:${target}`;
  const ipKey = `changepw-ip:${ip}`;

  // --- Rate limiting ---
  try {
    const [userCheck, ipCheck] = await Promise.all([
      checkAndIncrement(db, userKey, CHANGE_PW_LIMIT),
      checkAndIncrement(db, ipKey, CHANGE_PW_IP_LIMIT),
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
    console.error("rate-limit check failed (change-password)", e);
  }

  const data = await db.prepare("SELECT password,session_version FROM users WHERE username = ?").bind(target).first();
  if (!data) return json(c, 500, { error: "No se pudo recuperar la cuenta" });

  const ok = await verifyPassword(String(currentPassword), data.password);
  if (!ok) return json(c, 400, { error: "La contraseña actual es incorrecta" });

  // Contraseña correcta → reiniciar contadores
  try {
    await Promise.all([resetLimit(db, userKey), resetLimit(db, ipKey)]);
  } catch { /* no crítico */ }

  const hashed = await hashPassword(String(newPassword));
  try {
    await db
      .prepare("UPDATE users SET password = ?, session_version = session_version + 1 WHERE username = ?")
      .bind(hashed, target)
      .run();
  } catch {
    return json(c, 500, { error: "No se pudo cambiar la contraseña" });
  }

  // El cambio de contraseña sube session_version: hay que renovar la cookie o
  // la sesión actual quedaría inválida en la siguiente petición.
  const rememberSession = remember !== false;
  setSessionCookie(
    c,
    await signToken(
      c,
      {
        username: target,
        sessionVersion: Number(data.session_version ?? 0) + 1,
      },
      rememberSession ? SESSION_REMEMBER_TTL : SESSION_BROWSER_TTL
    ),
    rememberSession
  );

  return json(c, 200, { ok: true });
}
