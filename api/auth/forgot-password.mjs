import {
  admin,
  envReady,
  json,
  readBody,
  verifyPassword,
  hashPassword,
  isColumnMissing,
  writesFrozen,
  maintenance,
} from "../_lib.mjs";

export default async function handler(req, res) {
  if (writesFrozen(req)) return maintenance(res);
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!envReady() || !admin) return json(res, 500, { error: "Configuración del servidor incompleta" });

  const { username, answer, newPassword } = await readBody(req);
  if (!username) {
    return json(res, 400, { error: "Escribe tu usuario" });
  }
  if (newPassword && String(newPassword).length < 6) {
    return json(res, 400, { error: "La nueva contraseña debe tener al menos 6 caracteres" });
  }

  const { data, error } = await admin
    .from("users")
    .select("username,password,security_question,security_answer")
    .eq("username", String(username).trim())
    .maybeSingle();
  if (error) {
    if (isColumnMissing(error)) {
      return json(res, 500, { error: "Falta la migración de seguridad", needsMigration: true });
    }
    return json(res, 500, { error: "No se pudo recuperar la cuenta" });
  }
  if (!data) return json(res, 401, { error: "Usuario no encontrado" });

  if (!data.security_question || !data.security_answer) {
    return json(res, 400, { error: "Ese usuario no configuró pregunta de seguridad", notConfigured: true });
  }

  if (!answer || !newPassword) {
    return json(res, 200, { question: data.security_question });
  }

  const ok = await verifyPassword(String(answer), data.security_answer);
  if (!ok) return json(res, 400, { error: "La respuesta no coincide" });

  const hashed = await hashPassword(String(newPassword));
  const { error: upErr } = await admin
    .from("users")
    .update({ password: hashed })
    .eq("username", data.username);
  if (upErr) return json(res, 500, { error: "No se pudo restablecer la contraseña" });

  return json(res, 200, { ok: true });
}
