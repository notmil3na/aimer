import {
  envReady, json, readBody, verifyPassword, hashPassword, signToken, setSessionCookie,
  publicUser, HASH_FALSO, vreq, getClientIP, SESSION_REMEMBER_TTL, SESSION_BROWSER_TTL,
} from "../../lib.js";
import { jparse } from "../../db.js";
import { checkAndIncrement, resetLimit } from "../../rate-limit.js";

// 10 intentos por usuario en 15 min → bloqueo 10 min.
// 30 intentos por IP en 15 min → bloqueo 30 min.
const LOGIN_USER_LIMIT = { maxAttempts: 10, windowSec: 900, lockoutSec: 600 };
const LOGIN_IP_LIMIT   = { maxAttempts: 30, windowSec: 900, lockoutSec: 1800 };

export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "POST") return json(c, 405, { error: "method" });
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });

  const { username, password, remember } = await readBody(c);
  if (!username || !password) return json(c, 400, { error: "Faltan datos" });

  const uname = String(username).trim();
  const db = c.env.DB;
  const ip = getClientIP(c);
  const userKey = `login:${uname}`;
  const ipKey = `login-ip:${ip}`;

  // --- Rate limiting ---
  try {
    const [userCheck, ipCheck] = await Promise.all([
      checkAndIncrement(db, userKey, LOGIN_USER_LIMIT),
      checkAndIncrement(db, ipKey, LOGIN_IP_LIMIT),
    ]);

    if (!userCheck.allowed) {
      const retry = userCheck.retryAfter;
      return json(c, 429, {
        error: `Demasiados intentos de inicio de sesión. Intenta de nuevo en ${Math.ceil(retry / 60)} minuto(s).`,
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
    console.error("rate-limit check failed (login)", e);
  }

  const user = await db.prepare("SELECT * FROM users WHERE username = ?").bind(uname).first();

  // se verifica siempre, contra un hash de relleno si la cuenta no existe: así
  // el tiempo de respuesta no delata qué usuarios están registrados.
  const ok = await verifyPassword(String(password), user ? user.password : HASH_FALSO);
  if (!user || !ok) return json(c, 401, { error: "Usuario o contraseña incorrectos" });

  if (typeof user.password === "string" && !user.password.startsWith("scrypt:")) {
    const hashed = await hashPassword(String(password));
    await db.prepare("UPDATE users SET password = ? WHERE username = ?").bind(hashed, user.username).run();
  }

  // Login exitoso → reiniciar contadores
  try {
    await Promise.all([resetLimit(db, userKey), resetLimit(db, ipKey)]);
  } catch { /* no crítico */ }

  const userData = await db.prepare("SELECT * FROM user_data WHERE username = ?").bind(user.username).first();
  const dataOut = userData ? { ...userData } : null;
  if (dataOut) {
    dataOut.malla = jparse(dataOut.malla);
    dataOut.notas = jparse(dataOut.notas);
    dataOut.cursando = jparse(dataOut.cursando);
    dataOut.horario = jparse(dataOut.horario);
    dataOut.plan = jparse(dataOut.plan);
    dataOut.calendario = jparse(dataOut.calendario);
    dataOut.asignaciones = jparse(dataOut.asignaciones);
    dataOut.ajustes = jparse(dataOut.ajustes);
    dataOut.notasclase = jparse(dataOut.notasclase);
    dataOut.version = Number(dataOut.version ?? 1);
    dataOut.updated_at = dataOut.updated_at ?? null;
  }

  const rememberSession = remember !== false;
  setSessionCookie(
    c,
    await signToken(
      c,
      {
        username: user.username,
        sessionVersion: Number(user.session_version ?? 0),
      },
      rememberSession ? SESSION_REMEMBER_TTL : SESSION_BROWSER_TTL
    ),
    rememberSession
  );

  // el token ya no viaja en el cuerpo: vive solo en la cookie HttpOnly.
  return json(c, 200, {
    user: publicUser(user),
    data: dataOut || null,
  });
}
