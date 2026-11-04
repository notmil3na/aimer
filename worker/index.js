// punto de entrada del worker de Aimer.
// - los archivos de `dist/` los sirve cloudflare directamente (ver wrangler.jsonc)
// - todo lo que empiece con /api/ pasa por aquí (run_worker_first)
// - el recordatorio diario entra por scheduled() en vez de un cron http
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { handler as login } from "./routes/auth/login.js";
import { handler as register } from "./routes/auth/register.js";
import { handler as me } from "./routes/auth/me.js";
import { handler as logout } from "./routes/auth/logout.js";
import { handler as deleteAccount } from "./routes/auth/delete-account.js";
import { handler as security } from "./routes/auth/security.js";
import { handler as forgotPassword } from "./routes/auth/forgot-password.js";
import { handler as changePassword } from "./routes/auth/change-password.js";
import { handler as adminResetPassword } from "./routes/admin/reset-password.js";
import { handler as adminBootstrap } from "./routes/admin/bootstrap.js";
import { handler as adminUsers } from "./routes/admin/users.js";
import { handler as siteContent } from "./routes/site-content.js";
import { handler as users } from "./routes/users.js";
import { handler as userData } from "./routes/user-data.js";
import { handler as userDataByUsername } from "./routes/user-data-by-username.js";
import { handler as photo } from "./routes/photo.js";
import { handler as friendships } from "./routes/friendships.js";
import { uploadHandler as chatUpload, downloadHandler as chatDownload } from "./routes/chat-files.js";
import { handler as push, runCron } from "./routes/push.js";

const app = new Hono();

// Límites de cuerpo para las rutas que reciben JSON. `/api/chat-upload` queda
// fuera a propósito: su cuerpo se lee en streaming y acotado en chat-files.js
// (hasta 8 MB), sin confiar en Content-Length.
const tooLarge = (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ error: "El cuerpo de la petición es demasiado grande" }, 413);
};
const jsonBodyLimit = (maxSize) => bodyLimit({ maxSize, onError: tooLarge });

app.use("/api/auth/*", jsonBodyLimit(64 * 1024));
app.use("/api/admin/*", jsonBodyLimit(64 * 1024));
app.use("/api/site-content", jsonBodyLimit(64 * 1024));
app.use("/api/push", jsonBodyLimit(64 * 1024));
app.use("/api/users", jsonBodyLimit(320 * 1024)); // incluye la foto de perfil
app.use("/api/friendships", jsonBodyLimit(128 * 1024));
app.use("/api/user_data", jsonBodyLimit(1536 * 1024)); // cerca del límite de fila de D1

// CSRF extra para la cookie SameSite=Lax: un POST/PUT/DELETE disparado desde
// otro sitio trae `Sec-Fetch-Site: cross-site`; los navegadores que no mandan
// la cabecera quedan cubiertos por SameSite.
app.use("/api/*", async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const site = c.req.header("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") {
      return c.json({ error: "Origen no permitido" }, 403);
    }
  }

  await next();
});

app.all("/api/auth/login", login);
app.all("/api/auth/register", register);
app.all("/api/auth/me", me);
app.all("/api/auth/logout", logout);
app.all("/api/auth/delete-account", deleteAccount);
app.all("/api/auth/security", security);
app.all("/api/auth/forgot-password", forgotPassword);
app.all("/api/auth/change-password", changePassword);
app.all("/api/admin/reset-password", adminResetPassword);
app.all("/api/admin/bootstrap", adminBootstrap);
app.all("/api/admin/users", adminUsers);
app.all("/api/site-content", siteContent);
app.all("/api/users", users);
app.all("/api/user_data", userData);
app.all("/api/user_data/:username", userDataByUsername);
app.all("/api/photo/:username", photo);
app.all("/api/friendships", friendships);
app.all("/api/chat-upload", chatUpload);
app.all("/api/chat-attachment", chatDownload);
app.all("/api/push", push);

app.notFound((c) => c.json({ error: "No encontrado" }, 404));

app.onError((err, c) => {
  console.error("error no controlado", c.req.method, c.req.path, err && err.stack ? err.stack : err);
  c.header("Cache-Control", "no-store");
  return c.json({ error: "Error interno del servidor" }, 500);
});

export default {
  fetch: app.fetch,

  // cron diario (ver `triggers.crons` en wrangler.jsonc)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runCron(env).then(
        (r) => console.log("cron push", r.status, JSON.stringify(r.body)),
        (e) => console.error("cron push falló", e && e.stack ? e.stack : e)
      )
    );
  },
};
