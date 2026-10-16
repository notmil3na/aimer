// pruebas del worker portado: interoperabilidad con el código original + e2e con wrangler dev
// contra una base D1 local (--local) y un servidor de push falso.
//
// importante: mientras `wrangler dev` está corriendo NO se toca el archivo sqlite de D1
// (workerd lo mantiene bloqueado y abrirlo cuelga). Todo se verifica por la API http.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, "..");
const ORIG = path.resolve(PROJECT, process.argv[2] || "api/_lib.mjs");
const SECRET = "test-secret-123";
process.env.SESSION_SECRET = SECRET;

const NPX = "npx";
const D1_NAME = "aimer";
const PERSIST = path.join(PROJECT, ".e2e-d1state");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LOG = path.join(PROJECT, "tools", "e2e-progress.log");
try { fs.writeFileSync(LOG, ""); } catch {}
const log = (line) => { console.log(line); try { fs.appendFileSync(LOG, line + "\n"); } catch {} };
const step = (name) => log(`>> ${name}`);

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`); };

const HARD = setTimeout(() => { console.log(`\nTIEMPO AGOTADO (${pass} ok, ${fail} fallos antes de colgarse)`); process.exit(2); }, 240000);
HARD.unref?.();

// ---------- A. interoperabilidad con _lib.mjs original ----------
fs.mkdirSync(`${PROJECT}/.origtest`, { recursive: true });
fs.copyFileSync(ORIG, `${PROJECT}/.origtest/_lib.mjs`);
const orig = await import(pathToFileURL(path.join(PROJECT, ".origtest/_lib.mjs")).href);
const neu = await import(pathToFileURL(path.join(PROJECT, "worker/lib.js")).href);
const fakeC = (token) => ({ env: { SESSION_SECRET: SECRET }, req: { header: (n) => (n.toLowerCase() === "authorization" && token ? `Bearer ${token}` : undefined) } });

const tokOrig = orig.signToken({ username: "milena" });
const tokNew = await neu.signToken(fakeC(), { username: "milena" });
ok("jwt: token del código viejo lo valida el nuevo", (await neu.verifyToken(fakeC(), tokOrig))?.username === "milena");
ok("jwt: token del código nuevo lo valida el viejo", orig.verifyToken(tokNew)?.username === "milena");
ok("jwt: mismo header y misma forma (3 partes, hs256)", JSON.parse(Buffer.from(tokNew.split(".")[0], "base64url")).alg === "HS256" && tokNew.split(".").length === 3);
const tampered = tokNew.slice(0, -2) + (tokNew.endsWith("AA") ? "BB" : "AA");
ok("jwt: firma alterada se rechaza", (await neu.verifyToken(fakeC(), tampered)) === null);
ok("jwt: token con otro secreto se rechaza", (await neu.verifyToken({ env: { SESSION_SECRET: "otro" } }, tokOrig)) === null);
const expired = orig.signToken({ username: "milena" }, -10);
ok("jwt: token vencido se rechaza", (await neu.verifyToken(fakeC(), expired)) === null);
ok("jwt: utf-8 en el payload (usuario con ñ) coincide", (await neu.verifyToken(fakeC(), orig.signToken({ username: "ñandú" })))?.username === "ñandú");

const hOrig = await orig.hashPassword("clave-secreta");
const hNew = await neu.hashPassword("clave-secreta");
ok("password: hash del código viejo lo verifica el nuevo", await neu.verifyPassword("clave-secreta", hOrig));
ok("password: hash del código nuevo lo verifica el viejo", await orig.verifyPassword("clave-secreta", hNew));
ok("password: contraseña incorrecta se rechaza", !(await neu.verifyPassword("mala", hOrig)));
ok("password: texto plano heredado sigue funcionando", await neu.verifyPassword("plano", "plano"));

step("B: preparar d1 local");
// ---------- B. base D1 local ----------
const gufi = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const gjson = (o) => gufi(JSON.stringify(o));

const ENV = { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" };
const qs = (s) => (/[\s"&|<>^()]/.test(String(s)) ? `"` + String(s).replace(/"/g, '\\"') + `"` : String(s));

function runCmd(cmd, timeoutMs = 90000) {
  return new Promise((resolve) => {
    const p = spawn(cmd, { cwd: PROJECT, shell: true, env: ENV, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "", done = false;
    const finish = (code) => { if (done) return; done = true; clearTimeout(t); resolve({ code, out, err }); };
    const t = setTimeout(() => { try { p.kill(); } catch {} finish(-1); }, timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => finish(code));
    p.on("error", (e) => { err += String(e); finish(-1); });
  });
}

fs.rmSync(PERSIST, { recursive: true, force: true });
fs.mkdirSync(PERSIST, { recursive: true });
step("B: aplicando migraciones d1 (local)");
{
  const r = await runCmd(`${NPX} wrangler d1 migrations apply ${D1_NAME} --local --persist-to ${qs(PERSIST)}`);
  ok("d1: migraciones aplicadas a la base local", /0001_init|commands executed|✅/i.test(r.out + r.err), (r.out + r.err).slice(-300));
}

const bogotaToday = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
const sub = (p) => { const e = crypto.createECDH("prime256v1"); e.generateKeys(); return { endpoint: `http://127.0.0.1:9999${p}`, keys: { p256dh: e.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") } }; };

const seed = `
INSERT INTO users (username,password,name,career,semester,security_question,security_answer) VALUES
  (${gufi("milena")},${gufi(hOrig)},${gufi("Milena")},${gufi("Ingeniería de Sistemas")},5,${gufi("q")},${gufi(await orig.hashPassword("azul"))}),
  (${gufi("plano")},${gufi("claveplana")},${gufi("Plano")},${gufi("")},1,NULL,NULL),
  (${gufi("yan")},NULL,${gufi("Yan")},${gufi("Ingeniería de Sistemas")},1,NULL,NULL);
INSERT INTO user_data (username,horario,malla,ajustes,asignaciones,calendario) VALUES
  (${gufi("milena")},${gjson({ h: 1 })},${gjson({ m: 1 })},${gjson({ push: { subs: [sub("/ok"), sub("/gone")], sentKeys: [] } })},${gjson({ items: [{ id: "a1", tipo: "tarea", titulo: "Entregar taller", fechaEntrega: bogotaToday, recordatorio: 0 }] })},${gjson({ eventos: [] })});
INSERT INTO friendships (user_username,friend_username,status,requested_by,created_at,updated_at) VALUES
  (${gufi("milena")},${gufi("yan")},${gufi("aceptado")},${gufi("yan")},${gufi(new Date().toISOString())},${gufi(new Date().toISOString())});
`;
const seedPath = path.join(PERSIST, "seed.sql");
fs.writeFileSync(seedPath, seed);
step("B: cargando datos de prueba");
{
  const r = await runCmd(`${NPX} wrangler d1 execute ${D1_NAME} --local --persist-to ${qs(PERSIST)} --file ${qs(seedPath)}`);
  ok("d1: datos de prueba cargados", /executed|success/i.test(r.out + r.err), (r.out + r.err).slice(-300));
}

// ---------- C. push falso ----------
const pushLog = [];
const pushSrv = http.createServer((req, res) => { let n = 0; req.on("data", (c) => (n += c.length)); req.on("end", () => { pushLog.push({ url: req.url, bytes: n, enc: req.headers["content-encoding"], auth: String(req.headers.authorization).startsWith("vapid t="), ttl: req.headers.ttl }); res.statusCode = req.url === "/gone" ? 410 : 201; res.end(); }); }).listen(9999, "127.0.0.1");

// origen "legacy" falso (para probar el proxy a vercel)
const legacy = http.createServer((req, res) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ from: "legacy", path: req.url, auth: req.headers.authorization || null })); }).listen(9998, "127.0.0.1");

// ---------- D. wrangler dev ----------
const vapid = crypto.createECDH("prime256v1"); vapid.generateKeys();
const vars = { SESSION_SECRET: SECRET, VAPID_PUBLIC_KEY: vapid.getPublicKey().toString("base64url"), VAPID_PRIVATE_KEY: vapid.getPrivateKey().toString("base64url"), CRON_SECRET: "cron-xyz", LEGACY_ORIGIN: "http://127.0.0.1:9998", LEGACY_PREFIXES: "/api/photo" };
step("D: arrancando wrangler dev");
const devCmd = `${NPX} wrangler dev --port 8788 --ip 127.0.0.1 --test-scheduled --persist-to ${qs(PERSIST)} ` + Object.entries(vars).map(([k, v]) => `--var ${qs(`${k}:${v}`)}`).join(" ");
const wr = spawn(devCmd, { cwd: PROJECT, shell: true, env: ENV, stdio: ["ignore", "pipe", "pipe"] });
let wlog = ""; wr.stdout.on("data", (d) => (wlog += d)); wr.stderr.on("data", (d) => (wlog += d));
const B = "http://127.0.0.1:8788";
let up = false;
for (let i = 0; i < 90; i++) { try { await fetch(B + "/"); up = true; break; } catch { await sleep(1000); } }
ok("wrangler dev: el servidor local responde", up, wlog.slice(-500));
step("tests: comenzando");

const call = async (p, { method = "GET", body, token, headers = {} } = {}) => {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = null; const text = await r.text(); try { j = JSON.parse(text); } catch {}
  return { status: r.status, json: j, text, headers: r.headers };
};
const login = (username, password) => call("/api/auth/login", { method: "POST", body: { username, password } });

try {
  // login
  step("tests: auth");
  let r = await login("milena", "clave-secreta");
  ok("login: scrypt generado por el código viejo entra", r.status === 200 && !!r.json?.token && r.json.user?.username === "milena" && r.json.data?.username === "milena", JSON.stringify(r).slice(0, 200));
  const token = r.json?.token;
  ok("login: la respuesta no filtra la contraseña", !JSON.stringify(r.json).includes("scrypt:"));
  ok("login: contraseña incorrecta → 401", (await login("milena", "mala")).status === 401);
  ok("login: usuario inexistente → 401", (await login("nadie", "x")).status === 401);
  ok("login: faltan datos → 400", (await call("/api/auth/login", { method: "POST", body: {} })).status === 400);
  ok("login: GET → 405", (await call("/api/auth/login")).status === 405);
  r = await login("plano", "claveplana");
  ok("login: contraseña en texto plano heredada entra", r.status === 200);

  // sesiones viejas (token firmado por el código original)
  const oldTok = orig.signToken({ username: "milena" });
  r = await call("/api/auth/me", { token: oldTok });
  ok("me: token emitido por vercel sigue valiendo en cloudflare", r.status === 200 && r.json?.user?.username === "milena", JSON.stringify(r).slice(0, 150));
  ok("me: sin token → 401", (await call("/api/auth/me")).status === 401);
  ok("me: token basura → 401", (await call("/api/auth/me", { token: "a.b.c" })).status === 401);

  // user_data
  r = await call("/api/user_data", { token });
  ok("user_data GET devuelve los datos", r.status === 200 && r.json?.data?.username === "milena");
  r = await call("/api/user_data", { method: "POST", token, body: { patch: { notas: { x: 1 }, hack: 1 } } });
  const ud = (await call("/api/user_data", { token })).json?.data || {};
  ok("user_data POST guarda solo columnas permitidas", r.status === 200 && ud.notas?.x === 1 && !("hack" in ud));
  ok("user_data POST sin patch → 400", (await call("/api/user_data", { method: "POST", token, body: {} })).status === 400);
  r = await call("/api/user_data/yan", { token });
  ok("user_data/:username responde horario y malla", r.status === 200 && "horario" in (r.json?.data || {}));

  // users
  r = await call("/api/users?check=yan");
  ok("users?check público: usuario ocupado", r.status === 200 && r.json?.available === false);
  r = await call("/api/users?check=libre123");
  ok("users?check público: usuario libre", r.json?.available === true);
  ok("users listado sin token → 401", (await call("/api/users")).status === 401);
  r = await call("/api/users?q=" + encodeURIComponent("zz%,password.like.scrypt:a%"), { token });
  ok("users?q: la inyección de filtros queda neutralizada (respuesta ok y sin contraseña)", r.status === 200 && Array.isArray(r.json?.data) && !JSON.stringify(r.json).includes("scrypt:"));
  r = await call("/api/users?q=mile", { token });
  ok("users?q: búsqueda normal funciona y no expone foto/contraseña", r.status === 200 && Array.isArray(r.json?.data) && r.json.data.some((u) => u.username === "milena") && !JSON.stringify(r.json).includes("password"));
  r = await call("/api/users", { method: "POST", token, body: { name: "Milena S", appTheme: "rosa" } });
  const me1 = (await call("/api/auth/me", { token })).json?.user || {};
  ok("users POST (guardar perfil) actualiza", r.status === 200 && me1.name === "Milena S" && me1.appTheme === "rosa", JSON.stringify({ r: r.json, me1 }));
  ok("users POST sin sesión → 401", (await call("/api/users", { method: "POST", body: { name: "x" } })).status === 401);

  // register / forgot / change password / security
  r = await call("/api/auth/register", { method: "POST", body: { username: "nueva.user", password: "123456", name: "Nueva", career: "Hotelería y Turismo", securityQuestion: "color?", securityAnswer: "verde" } });
  ok("register crea el usuario (se puede iniciar sesión)", r.status === 200 && (await login("nueva.user", "123456")).status === 200);
  ok("register: usuario repetido → 409", (await call("/api/auth/register", { method: "POST", body: { username: "milena", password: "123456", name: "x", career: "y" } })).status === 409);
  ok("register: usuario inválido → 400", (await call("/api/auth/register", { method: "POST", body: { username: "a b", password: "123456", name: "x", career: "y" } })).status === 400);
  r = await call("/api/auth/forgot-password", { method: "POST", body: { username: "milena" } });
  ok("forgot-password paso 1 devuelve la pregunta", r.status === 200 && r.json?.question === "q");
  r = await call("/api/auth/forgot-password", { method: "POST", body: { username: "milena", answer: "azul", newPassword: "nueva-clave" } });
  ok("forgot-password paso 2 con respuesta correcta cambia la clave", r.status === 200 && (await login("milena", "nueva-clave")).status === 200);
  r = await call("/api/auth/forgot-password", { method: "POST", body: { username: "milena", answer: "roja", newPassword: "otra-clave" } });
  ok("forgot-password con respuesta incorrecta → 400", r.status === 400);
  r = await call("/api/auth/change-password", { method: "POST", token, body: { currentPassword: "nueva-clave", newPassword: "tercera-clave" } });
  ok("change-password con la clave actual correcta funciona", r.status === 200 && (await login("milena", "tercera-clave")).status === 200);
  r = await call("/api/auth/security", { token });
  ok("security GET devuelve la pregunta", r.status === 200 && r.json?.question === "q");
  r = await call("/api/auth/security", { method: "POST", token, body: { question: "nueva?", answer: "respuesta" } });
  const sec = (await call("/api/auth/security", { token })).json?.question;
  ok("security POST guarda pregunta y respuesta hasheada", r.status === 200 && sec === "nueva?");

  // friendships
  step("tests: friendships");
  r = await call("/api/friendships", { token });
  ok("friendships GET devuelve el mapa de amistades", r.status === 200 && r.json?.data?.yan?.status === "aceptado", JSON.stringify(r).slice(0, 150));
  r = await call("/api/friendships?view=chat", { token });
  ok("friendships?view=chat (sin chats) → lista vacía", r.status === 200 && Array.isArray(r.json?.data) && r.json.data.length === 0, JSON.stringify(r).slice(0, 150));
  r = await call("/api/friendships", { method: "POST", token, body: { action: "request", other: "yan" } });
  ok("friendships request funciona", r.status === 200 && r.json?.ok === true);
  await call("/api/friendships", { method: "POST", token, body: { action: "accept", other: "yan" } });
  ok("friendships: no puedes ser tu propio amigo → 400", (await call("/api/friendships", { method: "POST", token, body: { action: "request", other: "milena" } })).status === 400);
  ok("friendships sin token → 401", (await call("/api/friendships")).status === 401);

  // chat (7 acciones + hilo + lista)
  r = await call("/api/friendships", { method: "POST", token, body: { action: "chatOpen", other: "yan" } });
  ok("chat: abrir conversación con un amigo", r.status === 200 && !!r.json?.data?.conversation_id && !!r.json.data.channel_token, JSON.stringify(r).slice(0, 200));
  r = await call("/api/friendships", { method: "POST", token, body: { action: "chatSend", other: "yan", message_type: "text", content: "hola yan" } });
  const thread1 = (await call("/api/friendships?view=chat&other=yan", { token })).json?.data;
  ok("chat: enviar mensaje de texto", r.status === 200 && !!r.json?.data?.message_id && thread1?.messages?.length === 1, JSON.stringify({ r: r.json, n: thread1?.messages?.length }));
  ok("chat: mensaje vacío → 400", (await call("/api/friendships", { method: "POST", token, body: { action: "chatSend", other: "yan", message_type: "text", content: "  " } })).status === 400);
  ok("chat: con alguien que no es amigo → 403", (await call("/api/friendships", { method: "POST", token, body: { action: "chatOpen", other: "nueva.user" } })).status === 403);
  r = await call("/api/friendships?view=chat&other=yan", { token });
  ok("chat: el hilo trae el mensaje y 2 participantes", r.status === 200 && r.json?.data?.messages?.length === 1 && r.json.data.messages[0].content === "hola yan" && r.json.data.participants?.length === 2, JSON.stringify(r).slice(0, 250));
  r = await call("/api/friendships?view=chat", { token });
  ok("chat: la lista muestra la conversación con su último mensaje", r.status === 200 && r.json?.data?.length === 1 && r.json.data[0].partner === "yan" && r.json.data[0].last?.label === "hola yan", JSON.stringify(r).slice(0, 250));
  r = await call("/api/friendships", { method: "POST", token, body: { action: "chatPin", other: "yan", pinned: true } });
  ok("chat: fijar conversación", r.status === 200 && r.json?.data?.pinned === true);
  r = await call("/api/friendships", { method: "POST", token, body: { action: "chatRead", other: "yan" } });
  ok("chat: marcar como leído", r.status === 200 && r.json?.ok === true);

  // adjuntos (R2): firmar subida, subir, enviar como imagen y descargar
  r = await call("/api/friendships", { method: "POST", token, body: { action: "chatUploadURL", other: "yan", file_name: "foto.png", mime_type: "image/png", file_size: 9 } });
  const up = r.json?.data;
  ok("chat: generar URL de subida firmada", r.status === 200 && !!up?.upload_url && String(up.storage_path).startsWith("chat/"), JSON.stringify(r).slice(0, 220));
  const putRes = await fetch(B + up.upload_url, { method: "PUT", headers: { "content-type": "image/png" }, body: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]) });
  ok("chat: subir el archivo a R2 mediante la URL firmada", putRes.status === 200, await putRes.clone().text());
  r = await call("/api/friendships", { method: "POST", token, body: { action: "chatSend", other: "yan", message_type: "image", attachments: [{ storage_path: up.storage_path, file_name: up.file_name, mime_type: up.mime_type, file_size: 9 }] } });
  ok("chat: enviar mensaje con adjunto", r.status === 200 && !!r.json?.data?.message_id, JSON.stringify(r).slice(0, 220));
  r = await call("/api/friendships?view=chat&other=yan", { token });
  const attMsg = (r.json?.data?.messages || []).find((m) => m.message_type === "image");
  ok("chat: el hilo devuelve el adjunto con URL de descarga", !!attMsg?.attachment?.url, JSON.stringify(r.json?.data?.messages).slice(0, 250));
  const dl = await fetch(B + attMsg.attachment.url);
  ok("chat: descargar el adjunto desde R2", dl.status === 200 && dl.headers.get("content-type") === "image/png", String(dl.status));
  ok("chat: descargar con token inválido → 403", (await fetch(B + "/api/chat-attachment?path=x&token=1.2")).status === 403);

  // push: rutas http
  step("tests: push");
  r = await call("/api/push");
  ok("push GET público devuelve la clave vapid pública", r.status === 200 && r.json?.publicKey === vars.VAPID_PUBLIC_KEY);
  pushLog.length = 0;
  r = await call("/api/push", { method: "POST", token, body: { action: "test" } });
  ok("push test: envía a cada suscripción (cifrado aes128gcm + vapid)", r.status === 200 && pushLog.length === 2 && pushLog.every((p) => p.enc === "aes128gcm" && p.auth && p.ttl === "60"), JSON.stringify({ r: r.json, pushLog }));
  pushLog.length = 0;
  await call("/api/push", { method: "POST", token, body: { action: "test" } });
  ok("push test: la suscripción que dio 410 quedó eliminada", pushLog.length === 1, JSON.stringify(pushLog));
  r = await call("/api/push", { method: "POST", token, body: { action: "subscribe", subscription: sub("/ok2") } });
  pushLog.length = 0;
  await call("/api/push", { method: "POST", token, body: { action: "test" } });
  ok("push subscribe agrega la suscripción", r.status === 200 && pushLog.length === 2, JSON.stringify(pushLog));
  ok("push: cron http sin secreto no dispara nada (x-vercel-cron ya no cuenta)", (await call("/api/push?test=1", { headers: { "x-vercel-cron": "1" } })).json?.publicKey === vars.VAPID_PUBLIC_KEY);

  // cron: scheduled()
  step("tests: cron");
  await call("/api/push", { method: "POST", token, body: { action: "subscribe", subscription: sub("/gone") } });
  pushLog.length = 0;
  const s1 = await call("/cdn-cgi/handler/scheduled?cron=5+13+*+*+*");
  await sleep(3000);
  ok("cron: dispara el recordatorio de la tarea que vence hoy a cada dispositivo (3)", s1.status === 200 && pushLog.length === 3, JSON.stringify({ st: s1.status, pushLog }));
  pushLog.length = 0;
  await call("/cdn-cgi/handler/scheduled?cron=5+13+*+*+*");
  await sleep(1500);
  ok("cron: una segunda corrida no duplica la notificación (sentKeys)", pushLog.length === 0, JSON.stringify(pushLog));
  pushLog.length = 0;
  await call("/api/push", { method: "POST", token, body: { action: "test" } });
  ok("cron: la suscripción muerta (410) quedó eliminada", pushLog.length === 2, JSON.stringify(pushLog));
  r = await call("/api/push?test=1", { headers: { "x-cron-secret": "cron-xyz" } });
  ok("cron manual con secreto correcto responde el resumen", r.status === 200 && r.json?.ok === true && typeof r.json.checked === "number", JSON.stringify(r).slice(0, 150));

  // proxy legacy, rutas desconocidas, SPA
  r = await call("/api/photo/yan", { token });
  ok("proxy a vercel: /api/photo se reenvía al origen legacy con el Authorization", r.json?.from === "legacy" && r.json?.path === "/api/photo/yan" && r.json?.auth === `Bearer ${token}`, JSON.stringify(r).slice(0, 200));
  r = await call("/api/no-existe");
  ok("ruta /api desconocida → 404 json", r.status === 404 && r.json?.error);
  r = await call("/perfil/cualquiera");
  ok("ruta de la SPA devuelve index.html", r.status === 200 && r.text.includes('id="root"'), r.text.slice(0, 80));
  ok("respuestas de la api llevan Cache-Control: no-store", (await call("/api/auth/me", { token })).headers.get("cache-control") === "no-store");
} catch (e) {
  fail++; console.log("FAIL  excepción en el test:", e && e.stack || e);
}

clearTimeout(HARD);
console.log(`\n${pass} ok, ${fail} fallos`);
if (fail) console.log("--- wrangler log (final) ---\n" + wlog.split("\n").filter((l) => !/Proxy environment/.test(l)).slice(-40).join("\n"));
wr.kill("SIGINT"); pushSrv.close(); legacy.close();
fs.rmSync(`${PROJECT}/.origtest`, { recursive: true, force: true });
setTimeout(() => process.exit(fail ? 1 : 0), 500);
