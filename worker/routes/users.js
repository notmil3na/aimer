import { envReady, json, readBody, requireUser, toUserRow, vreq } from "../lib.js";
import { jstringify, all, unwrapJSON } from "../db.js";

const USERNAME_RE = /^[a-zA-Z0-9._-]{2,20}$/;

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
    let data = [];
    if (q) {
      const like = `%${q}%`;
      const r = await all(
        db
          .prepare("SELECT username,name,university,career,semester,ingreso_corte,photo FROM users WHERE name LIKE ? OR username LIKE ? ORDER BY name")
          .bind(like, like)
      );
      data = r.data;
    } else {
      const r = await all(db.prepare("SELECT username,name,university,career,semester,ingreso_corte,photo FROM users ORDER BY name"));
      data = r.data;
    }
    const clean = (data || []).map(({ photo, ...rest }) => ({ ...rest, hasPhoto: !!photo }));
    return json(c, 200, { data: clean });
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
