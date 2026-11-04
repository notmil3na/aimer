import {
  clearSessionCookie, envReady, json, requireUser, verifyPassword, vreq, getClientIP,
} from "../../lib.js";
import { uuid } from "../../db.js";
import { deleteUserMessages } from "../../chat-storage.js";
import { checkAndIncrement } from "../../rate-limit.js";

const DELETE_USER_LIMIT = { maxAttempts: 5, windowSec: 900, lockoutSec: 900 };
const DELETE_IP_LIMIT = { maxAttempts: 20, windowSec: 900, lockoutSec: 1800 };

export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "POST") return json(c, 405, { error: "method" });
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });

  const me = await requireUser(c);
  if (!me) return json(c, 401, { error: "Sesión inválida" });

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.currentPassword !== "string" || body.confirmUsername !== me.username) {
    return json(c, 400, { error: "Confirma tu usuario y contraseña actual" });
  }

  const db = c.env.DB;
  const userKey = `delete-account:${me.username}`;
  const ipKey = `delete-account-ip:${getClientIP(c)}`;
  try {
    const [userCheck, ipCheck] = await Promise.all([
      checkAndIncrement(db, userKey, DELETE_USER_LIMIT),
      checkAndIncrement(db, ipKey, DELETE_IP_LIMIT),
    ]);
    if (!userCheck.allowed || !ipCheck.allowed) {
      const retry = Math.max(userCheck.retryAfter, ipCheck.retryAfter);
      return json(c, 429, {
        error: `Demasiados intentos. Intenta de nuevo en ${Math.ceil(retry / 60)} minuto(s).`,
        retryAfter: retry,
      });
    }
  } catch (error) {
    console.error("rate-limit check failed (delete-account)", error);
    return json(c, 503, { error: "No se pudo validar el límite de intentos" });
  }

  const account = await db
    .prepare("SELECT password, is_admin FROM users WHERE username = ?")
    .bind(me.username)
    .first();
  if (!account) return json(c, 401, { error: "Sesión inválida" });
  if (!(await verifyPassword(body.currentPassword, account.password))) {
    return json(c, 400, { error: "La contraseña actual es incorrecta" });
  }

  if (Number(account.is_admin) === 1) {
    const admins = await db.prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1").first();
    if (Number(admins?.count) <= 1) {
      return json(c, 409, { error: "No puedes eliminar la última cuenta administradora" });
    }
  }

  try {
    await deleteUserMessages(db, c.env.R2_BUCKET, me.username);

    const deletedId = `deleted-${uuid()}`;
    const statements = [
      db.prepare("UPDATE conversation_members SET username = ? WHERE username = ?")
        .bind(deletedId, me.username),
      db.prepare(
        `UPDATE conversation_pairs SET
           user_a = CASE WHEN ? < CASE WHEN user_a = ? THEN user_b ELSE user_a END
             THEN ? ELSE CASE WHEN user_a = ? THEN user_b ELSE user_a END END,
           user_b = CASE WHEN ? < CASE WHEN user_a = ? THEN user_b ELSE user_a END
             THEN CASE WHEN user_a = ? THEN user_b ELSE user_a END ELSE ? END
         WHERE user_a = ? OR user_b = ?`
      ).bind(
        deletedId, me.username, deletedId, me.username,
        deletedId, me.username, me.username, deletedId,
        me.username, me.username
      ),
      db.prepare(
        `UPDATE friendships SET
           user_username = CASE WHEN ? < CASE WHEN user_username = ? THEN friend_username ELSE user_username END
             THEN ? ELSE CASE WHEN user_username = ? THEN friend_username ELSE user_username END END,
           friend_username = CASE WHEN ? < CASE WHEN user_username = ? THEN friend_username ELSE user_username END
             THEN CASE WHEN user_username = ? THEN friend_username ELSE user_username END ELSE ? END,
           requested_by = CASE WHEN requested_by = ? THEN ? ELSE requested_by END,
           status = 'archived'
         WHERE user_username = ? OR friend_username = ?`
      ).bind(
        deletedId, me.username, deletedId, me.username,
        deletedId, me.username, me.username, deletedId,
        me.username, deletedId, me.username, me.username
      ),
      db.prepare("DELETE FROM push_subscriptions WHERE username = ?").bind(me.username),
      db.prepare("DELETE FROM user_data WHERE username = ?").bind(me.username),
      db.prepare("DELETE FROM rate_limits WHERE key IN (?, ?, ?, ?, ?)")
        .bind(`login:${me.username}`, `forgot:${me.username}`, `changepw:${me.username}`, `security:${me.username}`, userKey),
      db.prepare("DELETE FROM users WHERE username = ?").bind(me.username),
    ];
    await db.batch(statements);
    clearSessionCookie(c);
    return json(c, 200, { ok: true });
  } catch (error) {
    console.error("no se pudo eliminar la cuenta", error);
    return json(c, 500, { error: "No se pudo completar la eliminación de la cuenta" });
  }
}
