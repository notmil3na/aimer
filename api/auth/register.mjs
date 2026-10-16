import { admin, envReady, json, readBody, hashPassword, toUserRow, isColumnMissing, writesFrozen, maintenance } from "../_lib.mjs";

const USERNAME_RE = /^[a-zA-Z0-9._-]{2,20}$/;

export default async function handler(req, res) {
  if (writesFrozen(req)) return maintenance(res);
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!envReady() || !admin) return json(res, 500, { error: "Configuración del servidor incompleta" });

  const body = await readBody(req);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!USERNAME_RE.test(username)) {
    return json(res, 400, { error: "Usuario: 2-20 caracteres, sin espacios (letras, números, . _ -)" });
  }
  if (password.length < 6) {
    return json(res, 400, { error: "La contraseña debe tener al menos 6 caracteres" });
  }
  if (!body.name) return json(res, 400, { error: "El nombre es obligatorio" });
  if (!String(body.career || "").trim()) return json(res, 400, { error: "La carrera es obligatoria" });

  const { data: existing } = await admin
    .from("users")
    .select("username")
    .eq("username", username)
    .maybeSingle();
  if (existing) return json(res, 409, { error: "Ese usuario ya existe" });

  const hashed = await hashPassword(password);
  const row = {
    username,
    password: hashed,
    ...toUserRow(body),
    photo: null,
    app_mode: body.appMode ?? "light",
    app_theme: body.appTheme ?? "ambar",
    theme_colors: body.themeColors ?? {
      cursando: "#c8a96e",
      aprobada: "#6ec88a",
      faltante: "#3a3a52",
    },
    border_radius: body.borderRadius ?? 12,
    font_scale: body.fontScale ?? 1,
    font_body: body.fontBody ?? "DM Sans",
  };

  const securityQuestion = String(body.securityQuestion || "").trim();
  const securityAnswer = String(body.securityAnswer || "").trim();
  if (securityQuestion && securityAnswer) {
    row.security_question = securityQuestion;
    row.security_answer = await hashPassword(securityAnswer);
  }

  const { error } = await admin.from("users").insert(row);
  if (error) {
    if (error.code === "23505") return json(res, 409, { error: "Ese usuario ya existe" });
    if (isColumnMissing(error) && row.security_question !== undefined) {
      delete row.security_question;
      delete row.security_answer;
      const retry = await admin.from("users").insert(row);
      if (retry.error) {
        if (retry.error.code === "23505") return json(res, 409, { error: "Ese usuario ya existe" });
        return json(res, 500, { error: "No se pudo crear la cuenta" });
      }
      return json(res, 200, { ok: true });
    }
    return json(res, 500, { error: "No se pudo crear la cuenta" });
  }
  return json(res, 200, { ok: true });
}
