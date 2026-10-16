import {
  admin,
  envReady,
  json,
  readBody,
  requireUser,
  verifyPassword,
  hashPassword,
  writesFrozen,
  maintenance,
} from "../_lib.mjs";

export default async function handler(req, res) {
  if (writesFrozen(req)) return maintenance(res);
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!envReady() || !admin) return json(res, 500, { error: "Configuración del servidor incompleta" });

  const me = requireUser(req);

  const { username, currentPassword, newPassword } = await readBody(req);
  if (!currentPassword || !newPassword) return json(res, 400, { error: "Completa todos los campos" });
  if (String(newPassword).length < 6) {
    return json(res, 400, { error: "La nueva contraseña debe tener al menos 6 caracteres" });
  }

  const target = me?.username || (username ? String(username).trim() : "");
  if (!target) return json(res, 401, { error: "Sesión inválida" });

  const { data, error } = await admin
    .from("users")
    .select("password")
    .eq("username", target)
    .maybeSingle();
  if (error || !data) return json(res, 500, { error: "No se pudo recuperar la cuenta" });

  const ok = await verifyPassword(String(currentPassword), data.password);
  if (!ok) return json(res, 400, { error: "La contraseña actual es incorrecta" });

  const hashed = await hashPassword(String(newPassword));
  const { error: upErr } = await admin
    .from("users")
    .update({ password: hashed })
    .eq("username", target);
  if (upErr) return json(res, 500, { error: "No se pudo cambiar la contraseña" });

  return json(res, 200, { ok: true });
}
