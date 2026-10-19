import { envReady, json, readBody, requireUser, toUserRow, vreq } from "../lib.js";
import { jstringify, all, unwrapJSON } from "../db.js";

const USERNAME_RE = /^[a-zA-Z0-9._-]{2,20}$/;

// la búsqueda necesita al menos 2 caracteres, devuelve 20 resultados como mucho
// y sin lista de usuarios (sin `q`) solo se devuelven amigos y solicitudes.
const BUSQUEDA_MIN = 2;
const LIMITE_BUSQUEDA = 20;
const LIMITE_LISTA = 200;

function limpio(rows) {
  return (rows || []).map(({ photo, ...rest }) => ({ ...rest, hasPhoto: !!photo }));
}

export async function handler(c) {
  const req = vreq(c);
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });

  const db = c.env.DB;
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET") {
    const check = url.searchParams.get("check");
    if (check) {
      if (!USERNAME_RE.test(check)) return json(c, 200, { available: false });
      const row = await db.prepare("SELECT username FROM users WHERE username = ?").bind(check).first();
      return json(c, 200, { available: !row });
    }

    const me = await requireUser(c);
    if (!me) return json(c, 401, { error: "Sesión inválida" });
    const q = (url.searchParams.get("q") || "")
      .replace(/[^\p{L}\p{N} ._@-]/gu, "")
      .trim()
      .slice(0, 50);

    if (q) {
      if (q.length < BUSQUEDA_MIN) return json(c, 200, { data: [], tooShort: true });
      const like = `%${q}%`;
      const r = await all(
        db
          .prepare(
            "SELECT username,name,photo FROM users WHERE (name LIKE ? OR username LIKE ?) AND username <> ? ORDER BY name LIMIT ?"
          )
          .bind(like, like, me.username, LIMITE_BUSQUEDA)
      );
      return json(c, 200, { data: limpio(r.data) });
    }

    const r = await all(
      db
        .prepare(
          `SELECT u.username, u.name, u.university, u.career, u.semester, u.photo
             FROM users u
             JOIN friendships f
               ON (f.user_username = ? AND f.friend_username = u.username)
               OR (f.friend_username = ? AND f.user_username = u.username)
            ORDER BY u.name
            LIMIT ?`
        )
        .bind(me.username, me.username, LIMITE_LISTA)
    );
    return json(c, 200, { data: limpio(r.data) });
  }

  if (req.method === "POST") {
    const me = await requireUser(c);
    if (!me) return json(c, 401, { error: "Sesión inválida" });
    const body = await readBody(c);
    const patch = toUserRow(body);
    if (Object.keys(patch).length === 0) return json(c, 400, { error: "Sin cambios" });
    if (patch.theme_colors !== undefined && patch.theme_colors !== null) {
      // el cliente puede mandar el objeto o el mismo texto que recibió; se
      // desenvuelve siempre para no ir acumulando niveles de escapado.
      const colors = unwrapJSON(patch.theme_colors);
      patch.theme_colors = colors && typeof colors === "object" ? jstringify(colors) : null;
    }
    const keys = Object.keys(patch);
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    const vals = keys.map((k) => patch[k]);
    try {
      await db.prepare(`UPDATE users SET ${sets} WHERE username = ?`).bind(...vals, me.username).run();
      return json(c, 200, { ok: true });
    } catch (error) {
      return json(c, 500, { error: "No se pudo guardar el perfil" });
    }
  }

  return json(c, 405, { error: "method" });
}
