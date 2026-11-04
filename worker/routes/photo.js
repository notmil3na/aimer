import { envReady, json, MAX_PHOTO_READ_CHARS, normalizePhoto, requireUser, vreq } from "../lib.js";

export async function handler(c) {
  const req = vreq(c);
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });
  const me = await requireUser(c);
  if (!me) return json(c, 401, { error: "Sesión inválida" });
  if (req.method !== "GET") return json(c, 405, { error: "method" });

  const username = req.query.username ? String(req.query.username) : "";
  if (!username) return json(c, 400, { error: "Falta el usuario" });

  if (username !== me.username) {
    const friendship = await c.env.DB
      .prepare(
        `SELECT 1 FROM friendships
         WHERE status = 'aceptado'
           AND ((user_username = ? AND friend_username = ?)
             OR (user_username = ? AND friend_username = ?))
         LIMIT 1`
      )
      .bind(me.username, username, username, me.username)
      .first();
    if (!friendship) return json(c, 404, { error: "No se encontró la foto" });
  }

  const data = await c.env.DB.prepare("SELECT photo FROM users WHERE username = ?").bind(username).first();
  // Normalizar también al leer: las fotos guardadas antes de esta validación
  // no deben llegar al cliente si no son una data URL de imagen válida.
  return json(c, 200, { photo: normalizePhoto(data && data.photo, MAX_PHOTO_READ_CHARS) });
}
