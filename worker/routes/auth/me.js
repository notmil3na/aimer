import { envReady, json, requireUser, publicUser, vreq } from "../../lib.js";

export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "GET") return json(c, 405, { error: "method" });
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });

  const me = await requireUser(c);
  if (!me) return json(c, 401, { error: "Sesión inválida" });

  const data = await c.env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(me.username).first();
  if (!data) return json(c, 401, { error: "Sesión inválida" });

  return json(c, 200, { user: publicUser(data) });
}
