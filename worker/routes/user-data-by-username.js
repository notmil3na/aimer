import { envReady, json, requireUser, vreq } from "../lib.js";
import { jparse } from "../db.js";

export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "GET") return json(c, 405, { error: "method" });
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });

  const me = await requireUser(c);
  if (!me) return json(c, 401, { error: "Sesión inválida" });

  const username = decodeURIComponent((req.query && req.query.username) || "");
  if (!username) return json(c, 400, { error: "Falta el usuario" });

  const data = await c.env.DB.prepare("SELECT horario,malla FROM user_data WHERE username = ?").bind(username).first();
  return json(c, 200, {
    data: data
      ? { horario: jparse(data.horario), malla: jparse(data.malla) }
      : { horario: null, malla: null },
  });
}
