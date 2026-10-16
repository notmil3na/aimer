import { envReady, json, requireUser, vreq } from "../lib.js";

export async function handler(c) {
  const req = vreq(c);
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });
  const me = await requireUser(c);
  if (!me) return json(c, 401, { error: "Sesión inválida" });
  if (req.method !== "GET") return json(c, 405, { error: "method" });

  const username = req.query.username ? String(req.query.username) : "";
  if (!username) return json(c, 400, { error: "Falta el usuario" });

  const data = await c.env.DB.prepare("SELECT photo FROM users WHERE username = ?").bind(username).first();
  return json(c, 200, { photo: (data && data.photo) || null });
}
