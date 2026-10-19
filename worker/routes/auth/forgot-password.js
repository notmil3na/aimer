import { envReady, json, readBody, verifyPassword, hashPassword, isColumnMissing, HASH_FALSO, vreq } from "../../lib.js";

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

  // paso 2: verificar la respuesta. se verifica siempre (contra un hash de
  // relleno si la cuenta no existe) para igualar el tiempo de respuesta.
  const ok = await verifyPassword(String(answer), tienePregunta ? data.security_answer : HASH_FALSO);
  if (!tienePregunta || !ok) {
    return json(c, 400, { error: NO_COINCIDE });
  }

  const hashed = await hashPassword(String(newPassword));
  try {
    await db.prepare("UPDATE users SET password = ? WHERE username = ?").bind(hashed, data.username).run();
  } catch {
    return json(c, 500, { error: "No se pudo restablecer la contraseña" });
  }

  return json(c, 200, { ok: true });
}
