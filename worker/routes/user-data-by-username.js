import { envReady, json, requireUser, vreq } from "../lib.js";
import { jparse } from "../db.js";

// horario y malla de otra persona: solo su propio dueño o un amigo aceptado.
// sin esto, cualquiera con sesión podía recorrer la malla de todas las cuentas.
async function puedeVer(db, me, other) {
  if (me === other) return true;
  const [a, b] = me < other ? [me, other] : [other, me];
  const row = await db
    .prepare("SELECT status FROM friendships WHERE user_username = ? AND friend_username = ?")
    .bind(a, b)
    .first();
  return !!(row && row.status === "aceptado");
}

export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "GET") return json(c, 405, { error: "method" });
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });

  const me = await requireUser(c);
  if (!me) return json(c, 401, { error: "Sesión inválida" });

  const username = decodeURIComponent((req.query && req.query.username) || "");
  if (!username) return json(c, 400, { error: "Falta el usuario" });

  if (!(await puedeVer(c.env.DB, me.username, username))) {
    return json(c, 403, { error: "Solo puedes ver los datos de tus amigos" });
  }

  const data = await c.env.DB.prepare("SELECT horario,malla FROM user_data WHERE username = ?").bind(username).first();
  return json(c, 200, {
    data: data
      ? { horario: jparse(data.horario), malla: jparse(data.malla) }
      : { horario: null, malla: null },
  });
}
