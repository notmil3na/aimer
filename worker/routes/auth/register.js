import { envReady, json, readBody, hashPassword, toUserRow, vreq, getClientIP } from "../../lib.js";
import { jstringify } from "../../db.js";
import { checkAndIncrement } from "../../rate-limit.js";
import { SECURITY_QUESTIONS } from "../../security-questions.js";

const USERNAME_RE = /^[a-zA-Z0-9._-]{2,20}$/;

// 5 registros por IP en 1 hora → bloqueo 1 hora.
const REGISTER_IP_LIMIT = { maxAttempts: 5, windowSec: 3600, lockoutSec: 3600 };

function newSessionVersion() {
  const words = crypto.getRandomValues(new Uint32Array(2));
  // 52 bits para conservar margen al incrementar y evitar reutilizar la
  // versión de sesión de una cuenta eliminada con el mismo nombre.
  return (words[0] & 0x000fffff) * 0x100000000 + words[1];
}

export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "POST") return json(c, 405, { error: "method" });
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });

  const ip = getClientIP(c);
  const db = c.env.DB;

  // --- Rate limiting por IP ---
  try {
    const ipCheck = await checkAndIncrement(db, `register-ip:${ip}`, REGISTER_IP_LIMIT);
    if (!ipCheck.allowed) {
      const retry = ipCheck.retryAfter;
      return json(c, 429, {
        error: `Demasiados registros desde esta dirección. Intenta de nuevo en ${Math.ceil(retry / 60)} minuto(s).`,
        retryAfter: retry,
      });
    }
  } catch (e) {
    console.error("rate-limit check failed (register)", e);
  }

  const body = await readBody(c);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!USERNAME_RE.test(username)) {
    return json(c, 400, { error: "Usuario: 2-20 caracteres, sin espacios (letras, números, . _ -)" });
  }
  if (password.length < 6) {
    return json(c, 400, { error: "La contraseña debe tener al menos 6 caracteres" });
  }
  if (!body.name) return json(c, 400, { error: "El nombre es obligatorio" });
  if (!String(body.career || "").trim()) return json(c, 400, { error: "La carrera es obligatoria" });

  const existing = await db.prepare("SELECT username FROM users WHERE username = ?").bind(username).first();
  if (existing) return json(c, 409, { error: "Ese usuario ya existe" });

  const hashed = await hashPassword(password);
  const row = {
    username,
    password: hashed,
    session_version: newSessionVersion(),
    ...toUserRow(body),
    photo: null,
    app_mode: body.appMode ?? "light",
    app_theme: body.appTheme ?? "ambar",
    theme_colors: body.themeColors ?? {
      cursando: "#c8a96e",
      aprobada: "#6ec88a",
      faltante: "#3a3a52",
    },
    border_radius: body.borderRadius ?? 12,
    font_scale: body.fontScale ?? 1,
    font_body: body.fontBody ?? "DM Sans",
  };

  const securityQuestion = String(body.securityQuestion || "").trim();
  const securityAnswer = String(body.securityAnswer || "").trim();
  if (securityQuestion && !SECURITY_QUESTIONS.includes(securityQuestion)) {
    return json(c, 400, { error: "Selecciona una pregunta de seguridad de la lista" });
  }
  if (Boolean(securityQuestion) !== Boolean(securityAnswer)) {
    return json(c, 400, { error: "Elige una pregunta y escribe su respuesta, o deja ambas vacías" });
  }
  if (securityAnswer && securityAnswer.length < 4) {
    return json(c, 400, { error: "La respuesta de seguridad debe tener al menos 4 caracteres" });
  }
  if (securityAnswer.length > 200) {
    return json(c, 400, { error: "La respuesta de seguridad es demasiado larga" });
  }
  if (securityQuestion && securityAnswer) {
    row.security_question = securityQuestion;
    // Normalizar la respuesta: trim + lowercase antes de hashear.
    row.security_answer = await hashPassword(securityAnswer.toLowerCase());
  }

  const themeColorsStr = jstringify(row.theme_colors);
  try {
    await db
      .prepare(
        `INSERT INTO users (
          username,password,session_version,name,university,career,semester,ingreso_corte,photo,
          app_mode,app_theme,theme_colors,border_radius,font_scale,font_body,
          security_question,security_answer
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .bind(
        row.username,
        row.password,
        row.session_version,
        row.name ?? "",
        row.university ?? "",
        row.career ?? "",
        row.semester ?? 1,
        row.ingreso_corte ?? "2023-2",
        row.photo,
        row.app_mode,
        row.app_theme,
        themeColorsStr,
        row.border_radius,
        row.font_scale,
        row.font_body,
        row.security_question ?? null,
        row.security_answer ?? null
      )
      .run();
  } catch (e) {
    const msg = String(e?.message || "").toLowerCase();
    if (msg.includes("unique") || msg.includes("constraint")) {
      return json(c, 409, { error: "Ese usuario ya existe" });
    }
    return json(c, 500, { error: "No se pudo crear la cuenta" });
  }
  return json(c, 200, { ok: true });
}
