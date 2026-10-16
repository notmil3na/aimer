import {
  admin,
  envReady,
  json,
  readBody,
  requireUser,
  hashPassword,
  verifyPassword,
  isColumnMissing,
  writesFrozen,
  maintenance,
} from "../_lib.mjs";

export default async function handler(req, res) {
  if (writesFrozen(req)) return maintenance(res);
  if (!envReady() || !admin) return json(res, 500, { error: "Configuración del servidor incompleta" });
  const me = requireUser(req);
  if (!me) return json(res, 401, { error: "Sesión inválida" });

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("users")
      .select("security_question")
      .eq("username", me.username)
      .maybeSingle();
    if (error) {
      if (isColumnMissing(error)) {
        return json(res, 200, { question: "", needsMigration: true });
      }
      return json(res, 500, { error: "No se pudo recuperar la pregunta de seguridad" });
    }
    return json(res, 200, { question: (data && data.security_question) || "", needsMigration: false });
  }

  if (req.method === "POST") {
    const { username, currentPassword, question, answer } = await readBody(req);
    const q = String(question || "").trim();
    const a = String(answer || "").trim();
    if (!q || !a) return json(res, 400, { error: "Pregunta y respuesta son obligatorias" });
    if (a.length < 3) return json(res, 400, { error: "La respuesta debe tener al menos 3 caracteres" });

    let target = me.username;
    if (!me) {
      target = username ? String(username).trim() : "";
      if (!target) return json(res, 401, { error: "Sesión inválida" });
      if (!currentPassword) return json(res, 400, { error: "La contraseña actual es obligatoria" });
      const { data: targetData, error: targetErr } = await admin
        .from("users")
        .select("password")
        .eq("username", target)
        .maybeSingle();
      if (targetErr || !targetData) return json(res, 500, { error: "No se pudo recuperar la cuenta" });
      const ok = await verifyPassword(String(currentPassword), targetData.password);
      if (!ok) return json(res, 400, { error: "La contraseña actual es incorrecta" });
    }

    const patch = {
      security_question: q,
      security_answer: await hashPassword(a),
    };
    const { error } = await admin.from("users").update(patch).eq("username", target);
    if (error) {
      if (isColumnMissing(error)) {
        return json(res, 500, { error: "Falta la migración de seguridad", needsMigration: true });
      }
      return json(res, 500, { error: "No se pudo guardar la pregunta de seguridad" });
    }
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: "method" });
}
