import { admin, envReady, isColumnMissing, json, readBody, requireUser, toUserRow, writesFrozen, maintenance } from "./_lib.mjs";

const USERNAME_RE = /^[a-zA-Z0-9._-]{2,20}$/;

export default async function handler(req, res) {
  if (writesFrozen(req)) return maintenance(res);
  if (!envReady() || !admin) return json(res, 500, { error: "Configuración del servidor incompleta" });

  if (req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const check = url.searchParams.get("check");
    if (check) {
      if (!USERNAME_RE.test(check)) return json(res, 200, { available: false });
      const { data } = await admin.from("users").select("username").eq("username", check).maybeSingle();
      return json(res, 200, { available: !data });
    }

    const me = requireUser(req);
    if (!me) return json(res, 401, { error: "Sesión inválida" });
    const q = (url.searchParams.get("q") || "").trim();
    let query = admin
      .from("users")
      .select("username,name,university,career,semester,ingreso_corte,photo");
    if (q) {
      query = query.or(`name.ilike.%${q}%,username.ilike.%${q}%`);
    }
    query = query.order("name");
    const { data, error } = await query;
    if (error) return json(res, 500, { error: "No se pudo listar a los usuarios" });
    const clean = (data || []).map(({ photo, ...rest }) => ({ ...rest, hasPhoto: !!photo }));
    return json(res, 200, { data: clean });
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const patch = toUserRow(body);
    if (Object.keys(patch).length === 0) return json(res, 400, { error: "Sin cambios" });
    let { error } = await admin.from("users").update(patch).eq("username", me.username);
    if (error && isColumnMissing(error) && patch.birthdate !== undefined) {
      delete patch.birthdate;
      ({ error } = await admin.from("users").update(patch).eq("username", me.username));
    }
    if (error) return json(res, 500, { error: "No se pudo guardar el perfil" });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: "method" });
}
