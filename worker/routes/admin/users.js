import { hashPassword, json, readBody, requireAdmin, toUserRow, vreq } from "../../lib.js";
import { all } from "../../db.js";

const USERNAME_RE = /^[a-zA-Z0-9._-]{2,20}$/;

export async function handler(c) {
  const req = vreq(c);
  if (!c.env.DB) return json(c, 500, { error: "Configuración del servidor incompleta" });

  const access = await requireAdmin(c);
  if (access.error === "unauthenticated") return json(c, 401, { error: "Sesión inválida" });
  if (access.error) return json(c, 403, { error: "Se requieren permisos de administrador" });

  const db = c.env.DB;
  if (req.method === "GET") {
    const result = await all(
      db.prepare("SELECT username,name,university,career,semester,ingreso_corte,security_question,is_admin FROM users ORDER BY username LIMIT 1000")
    );
    if (result.error) {
      console.error("no se pudo cargar la lista administrativa de usuarios", result.error);
      return json(c, 500, { error: "No se pudieron cargar las cuentas" });
    }
    return json(c, 200, { users: result.data });
  }

  const body = await readBody(c);
  const username = String(body.username || "").trim();
  if (!USERNAME_RE.test(username)) return json(c, 400, { error: "Escribe un usuario válido" });
  if (body.action === "update") {
    const editable = {};
    for (const key of ["name", "university", "career", "semester", "ingresoCorte"]) {
      if (body.user?.[key] !== undefined) editable[key] = body.user[key];
    }
    const patch = toUserRow(editable);
    try {
      if (body.user?.securityQuestion !== undefined) {
        const securityQuestion = String(body.user.securityQuestion || "").trim();
        const securityAnswer = String(body.securityAnswer || "").trim();
        if (securityQuestion.length > 300) {
          return json(c, 400, { error: "La pregunta de seguridad es demasiado larga" });
        }
        if (securityAnswer && (securityAnswer.length < 4 || securityAnswer.length > 500)) {
          return json(c, 400, { error: "La respuesta de seguridad debe tener entre 4 y 500 caracteres" });
        }

        const current = await db.prepare(
          "SELECT security_question FROM users WHERE username = ?"
        ).bind(username).first();
        if (!current) return json(c, 404, { error: "No se encontró la cuenta" });

        const currentQuestion = String(current.security_question || "").trim();
        if (!securityQuestion) {
          patch.security_question = null;
          patch.security_answer = null;
        } else {
          if (securityQuestion !== currentQuestion && !securityAnswer) {
            return json(c, 400, { error: "Escribe una nueva respuesta al cambiar la pregunta de seguridad" });
          }
          patch.security_question = securityQuestion;
          if (securityAnswer) patch.security_answer = await hashPassword(securityAnswer);
        }
      }

      const keys = Object.keys(patch);
      if (!keys.length) return json(c, 400, { error: "No hay cambios para guardar" });
      const sets = keys.map((key) => `${key} = ?`).join(", ");
      const result = await db.prepare(`UPDATE users SET ${sets} WHERE username = ?`)
        .bind(...keys.map((key) => patch[key]), username).run();
      if (!result.meta?.changes) return json(c, 404, { error: "No se encontró la cuenta" });
      return json(c, 200, { ok: true });
    } catch (error) {
      console.error("no se pudo actualizar el perfil administrado", error);
      return json(c, 500, { error: "No se pudo guardar el perfil" });
    }
  }

  if (body.action === "reset-password") {
    const password = String(body.newPassword || "");
    if (password.length < 12 || password.length > 256) {
      return json(c, 400, { error: "La contraseña temporal debe tener entre 12 y 256 caracteres" });
    }
    try {
      const user = await db.prepare("SELECT username FROM users WHERE username = ?").bind(username).first();
      if (!user) return json(c, 404, { error: "No se encontró la cuenta" });
      const hashed = await hashPassword(password);
      await db.prepare("UPDATE users SET password = ?, session_version = session_version + 1 WHERE username = ?")
        .bind(hashed, username).run();
      return json(c, 200, { ok: true });
    } catch (error) {
      console.error("no se pudo restablecer la contraseña desde administración", error);
      return json(c, 500, { error: "No se pudo restablecer la contraseña" });
    }
  }

  if (body.action === "delete") {
    if (username === access.user.username) {
      return json(c, 400, { error: "No puedes eliminar la cuenta con la que tienes esta sesión" });
    }
    try {
      const target = await db.prepare("SELECT is_admin FROM users WHERE username = ?").bind(username).first();
      if (!target) return json(c, 404, { error: "No se encontró la cuenta" });
      const results = await db.batch([
        db.prepare(
          `DELETE FROM users WHERE username = ?
           AND (is_admin = 0 OR (SELECT COUNT(*) FROM users WHERE is_admin = 1) > 1)`
        ).bind(username),
        db.prepare(
          `DELETE FROM friendships WHERE (user_username = ? OR friend_username = ?)
           AND NOT EXISTS (SELECT 1 FROM users WHERE username = ?)`
        ).bind(username, username, username),
        db.prepare(
          `DELETE FROM conversation_members WHERE username = ?
           AND NOT EXISTS (SELECT 1 FROM users WHERE username = ?)`
        ).bind(username, username),
        db.prepare(
          `DELETE FROM user_data WHERE username = ?
           AND NOT EXISTS (SELECT 1 FROM users WHERE username = ?)`
        ).bind(username, username),
      ]);
      if (!results[0]?.meta?.changes) {
        return json(c, 409, { error: "No puedes eliminar a la última cuenta administradora" });
      }
      return json(c, 200, { ok: true });
    } catch (error) {
      console.error("no se pudo eliminar la cuenta administrada", error);
      return json(c, 500, { error: "No se pudo eliminar la cuenta" });
    }
  }

  return json(c, 400, { error: "Acción administrativa desconocida" });
}
