import { admin, envReady, json, readBody, requireUser, writesFrozen, maintenance } from "./_lib.mjs";

const ALLOWED_COLUMNS = new Set([
  "malla",
  "notas",
  "cursando",
  "horario",
  "plan",
  "calendario",
  "asignaciones",
  "ajustes",
  "notasclase",
]);

export default async function handler(req, res) {
  if (writesFrozen(req)) return maintenance(res);
  if (!envReady() || !admin) return json(res, 500, { error: "Configuración del servidor incompleta" });
  const me = requireUser(req);
  if (!me) return json(res, 401, { error: "Sesión inválida" });

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("user_data")
      .select("*")
      .eq("username", me.username)
      .maybeSingle();
    if (error) return json(res, 500, { error: "No se pudo cargar tus datos" });
    return json(res, 200, { data: data || null });
  }

  if (req.method === "POST") {
    const { patch } = await readBody(req);
    if (!patch || typeof patch !== "object") return json(res, 400, { error: "Faltan datos" });

    const clean = {};
    for (const key of Object.keys(patch)) {
      if (ALLOWED_COLUMNS.has(key)) clean[key] = patch[key];
    }
    if (Object.keys(clean).length === 0) return json(res, 400, { error: "Sin cambios" });

    const { data: existing } = await admin
      .from("user_data")
      .select("username")
      .eq("username", me.username)
      .maybeSingle();

    const result = existing
      ? await admin.from("user_data").update(clean).eq("username", me.username)
      : await admin.from("user_data").insert({ username: me.username, ...clean });

    if (result.error) return json(res, 500, { error: "No se pudo guardar tus datos" });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: "method" });
}
