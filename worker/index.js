// punto de entrada del worker de Aimer.
// - los archivos de `dist/` los sirve cloudflare directamente (ver wrangler.jsonc)
// - todo lo que empiece con /api/ pasa por aquí (run_worker_first)
// - el recordatorio diario entra por scheduled() en vez de un cron http
import { Hono } from "hono";

import { handler as login } from "./routes/auth/login.js";
import { handler as register } from "./routes/auth/register.js";
import { handler as me } from "./routes/auth/me.js";
import { handler as security } from "./routes/auth/security.js";
import { handler as forgotPassword } from "./routes/auth/forgot-password.js";
import { handler as changePassword } from "./routes/auth/change-password.js";
import { handler as users } from "./routes/users.js";
import { handler as userData } from "./routes/user-data.js";
import { handler as userDataByUsername } from "./routes/user-data-by-username.js";
import { handler as photo } from "./routes/photo.js";
import { handler as friendships } from "./routes/friendships.js";
import { uploadHandler as chatUpload, downloadHandler as chatDownload } from "./routes/chat-files.js";
import { handler as push, runCron } from "./routes/push.js";

const app = new Hono();

// migración gradual: si defines LEGACY_ORIGIN (la url de vercel) y LEGACY_PREFIXES
// (p. ej. "/api/friendships,/api/push"), esas rutas se reenvían a vercel en vez de
// resolverse aquí. cuando todo esté probado, quita las dos variables.
app.use("/api/*", async (c, next) => {
  const origin = c.env.LEGACY_ORIGIN;
  const prefixes = (c.env.LEGACY_PREFIXES || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (origin && prefixes.some((p) => c.req.path === p || c.req.path.startsWith(p + "/"))) {
    const u = new URL(c.req.url);
    return fetch(new Request(origin + u.pathname + u.search, c.req.raw));
  }
  await next();
});

app.all("/api/auth/login", login);
app.all("/api/auth/register", register);
app.all("/api/auth/me", me);
app.all("/api/auth/security", security);
app.all("/api/auth/forgot-password", forgotPassword);
app.all("/api/auth/change-password", changePassword);
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
