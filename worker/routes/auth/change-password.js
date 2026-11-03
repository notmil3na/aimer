import { envReady, json, readBody, requireUser, verifyPassword, hashPassword, signToken, setSessionCookie, vreq } from "../../lib.js";

export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "POST") return json(c, 405, { error: "method" });
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });

  const me = await requireUser(c);

  const { username, currentPassword, newPassword, remember } = await readBody(c);
  if (!currentPassword || !newPassword) return json(c, 400, { error: "Completa todos los campos" });
  if (String(newPassword).length < 12 || String(newPassword).length > 256) {
    return json(c, 400, { error: "La nueva contraseña debe tener entre 12 y 256 caracteres" });
  }

  const target = me?.username || (username ? String(username).trim() : "");
  if (!target) return json(c, 401, { error: "Sesión inválida" });

  const db = c.env.DB;
  const data = await db.prepare("SELECT password,session_version FROM users WHERE username = ?").bind(target).first();
  if (!data) return json(c, 500, { error: "No se pudo recuperar la cuenta" });

  const ok = await verifyPassword(String(currentPassword), data.password);
  if (!ok) return json(c, 400, { error: "La contraseña actual es incorrecta" });

  const hashed = await hashPassword(String(newPassword));
  try {
    await db
      .prepare("UPDATE users SET password = ?, session_version = session_version + 1 WHERE username = ?")
      .bind(hashed, target)
      .run();
  } catch {
    return json(c, 500, { error: "No se pudo cambiar la contraseña" });
  }

  // el cambio de contraseña sube session_version: hay que renovar la cookie o
  // la sesión actual quedaría inválida en la siguiente petición.
  if (me) {
    setSessionCookie(
      c,
      await signToken(c, {
        username: target,
        sessionVersion: Number(data.session_version ?? 0) + 1,
      }),
      remember !== false
    );
  }

  return json(c, 200, { ok: true });
}
