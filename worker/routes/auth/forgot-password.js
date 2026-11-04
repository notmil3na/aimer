import { envReady, json, readBody, verifyPassword, hashPassword, isColumnMissing, HASH_FALSO, vreq, getClientIP } from "../../lib.js";
import { checkAndIncrement, resetLimit } from "../../rate-limit.js";

// mismas preguntas que src/utils/securityQuestions.js (si cambia la lista hay
// que cambiarla en los dos sitios).
const PREGUNTAS = [
  "¿Cómo se llamaba tu primera mascota?",
  "¿Cuál es el nombre de tu mejor amigo(a) de la infancia?",
  "¿En qué ciudad naciste?",
  "¿Cómo se llamaba tu colegio de primaria?",
  "¿Cuál es tu comida favorita?",
  "¿Cuál es el segundo apellido de tu madre?",
  "¿Cuál es el nombre de tu canción favorita?",
  "¿Qué deporte practicabas en el colegio?",
];

// pregunta de relleno para las cuentas que no existen (o que no tienen pregunta
// configurada): se elige de forma estable a partir del usuario, así que la
// respuesta no se distingue de la de una cuenta real.
function preguntaFalsa(username) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) >>> 0;
  return PREGUNTAS[h % PREGUNTAS.length];
}

const NO_COINCIDE = "La respuesta no coincide. Si tu cuenta no tiene pregunta de seguridad, pide ayuda al administrador.";

// --- Rate limiting ---
// 5 intentos por usuario en una ventana de 15 min → bloqueo de 15 min.
// 20 intentos por IP en una ventana de 15 min → bloqueo de 30 min.
const FORGOT_USER_LIMIT = { maxAttempts: 5, windowSec: 900, lockoutSec: 900 };
const FORGOT_IP_LIMIT   = { maxAttempts: 20, windowSec: 900, lockoutSec: 1800 };

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
  const uname = String(username).trim();
  let data;
  try {
    data = await db
      .prepare("SELECT username,password,security_question,security_answer FROM users WHERE username = ?")
      .bind(uname)
      .first();
  } catch (error) {
    if (isColumnMissing(error)) {
      return json(c, 500, { error: "Falta la migración de seguridad", needsMigration: true });
    }
    return json(c, 500, { error: "No se pudo recuperar la cuenta" });
  }

  const tienePregunta = !!(data && data.security_question && data.security_answer);

  // paso 1: mostrar la pregunta. exista o no la cuenta se devuelve una pregunta.
  if (!answer || !newPassword) {
    return json(c, 200, { question: tienePregunta ? data.security_question : preguntaFalsa(uname) });
  }

  // --- Rate limiting: verificar antes de procesar la respuesta ---
  const ip = getClientIP(c);
  const userKey = `forgot:${uname}`;
  const ipKey = `forgot-ip:${ip}`;

  try {
    const [userCheck, ipCheck] = await Promise.all([
      checkAndIncrement(db, userKey, FORGOT_USER_LIMIT),
      checkAndIncrement(db, ipKey, FORGOT_IP_LIMIT),
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
    // Si la tabla rate_limits no existe aún, se deja pasar (no bloquear por
    // migración faltante), pero se loguea.
    console.error("rate-limit check failed (forgot-password)", e);
  }

  // paso 2: verificar la respuesta. se normaliza con .trim().toLowerCase() para
  // que "Santa Marta" == "santa marta " == "SANTA MARTA".
  const normalizedAnswer = String(answer).trim().toLowerCase();
  const ok = await verifyPassword(normalizedAnswer, tienePregunta ? data.security_answer : HASH_FALSO);
  if (!tienePregunta || !ok) {
    return json(c, 400, { error: NO_COINCIDE });
  }

  // Respuesta correcta → reiniciar contadores
  try {
    await Promise.all([resetLimit(db, userKey), resetLimit(db, ipKey)]);
  } catch { /* no crítico */ }

  const hashed = await hashPassword(String(newPassword));
  try {
    await db
      .prepare("UPDATE users SET password = ?, session_version = session_version + 1 WHERE username = ?")
      .bind(hashed, data.username)
      .run();
  } catch {
    return json(c, 500, { error: "No se pudo restablecer la contraseña" });
  }

  return json(c, 200, { ok: true });
}
