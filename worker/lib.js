// helpers compartidos del worker.
// no hay process.env (las variables llegan en `c.env`), no hay req/res de node
// (usamos el contexto de hono) y el jwt usa web crypto.
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { unwrapJSON } from "./db.js";

export function envReady(env) {
  return !!(env.DB && env.SESSION_SECRET);
}

export function json(c, status, body) {
  c.header("Cache-Control", "no-store");
  return c.json(body, status);
}

export async function readBody(c) {
  try {
    const body = await c.req.json();
    return body ?? {};
  } catch {
    return {};
  }
}

// `req` ligero (method, url, headers, query) con la forma que esperan los handlers.
export function vreq(c) {
  const url = new URL(c.req.url);
  return {
    method: c.req.method,
    url: c.req.url,
    headers: Object.fromEntries(c.req.raw.headers),
    query: { ...Object.fromEntries(url.searchParams), ...c.req.param() },
  };
}

// ---- contraseñas: mismo formato `scrypt:salt:hash` que antes -----------------
// (así las contraseñas que ya existen en la base siguen funcionando)

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

function scryptAsync(password, salt, keylen) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, SCRYPT_OPTS, (err, key) =>
      err ? reject(err) : resolve(key.toString("hex"))
    );
  });
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${hash}`;
}

export async function verifyPassword(password, stored) {
  try {
    if (!password || typeof stored !== "string") return false;
    if (!stored.startsWith("scrypt:")) return password === stored;
    const [, salt, hash] = stored.split(":");
    const key = await scryptAsync(password, salt, 64);
    const a = Buffer.from(key, "hex");
    const b = Buffer.from(hash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---- jwt hs256 con web crypto: tokens idénticos a los de antes ----------------
// mientras SESSION_SECRET sea el mismo, las sesiones abiertas siguen valiendo.

const te = new TextEncoder();
const td = new TextDecoder();

function b64u(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64uDecode(str) {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

function hmacKey(secret, usage) {
  return crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signToken(c, payload, expiresInSec = 60 * 60 * 24 * 30) {
  const secret = c.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no configurado");
  const header = b64u(te.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const now = Math.floor(Date.now() / 1000);
  const body = b64u(te.encode(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSec })));
  const data = `${header}.${body}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), te.encode(data)));
  return `${data}.${b64u(sig)}`;
}

export async function verifyToken(c, token) {
  const secret = c.env.SESSION_SECRET;
  if (!token || !secret) return null;
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  let provided;
  try {
    provided = b64uDecode(s);
  } catch {
    return null;
  }
  // crypto.subtle.verify compara en tiempo constante
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), provided, te.encode(`${h}.${b}`));
  if (!ok) return null;
  try {
    const payload = JSON.parse(td.decode(b64uDecode(b)));
    if (!payload || !payload.username || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---- enlaces firmados para adjuntos (r2) ------------------------------------
// token = `<exp>.<hex>` donde hex = hmac-sha256(`${path}:${exp}`).
// sirven para subir y descargar un objeto concreto sin exponer el bucket.

function toHex(bytes) {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

export async function signPath(env, path, ttlSec = 6 * 60 * 60) {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET no configurado");
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const msg = `${path}:${exp}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(env.SESSION_SECRET, "sign"), te.encode(msg)));
  return `${exp}.${toHex(sig)}`;
}

export async function verifyPath(env, path, token) {
  if (!path || !token || !env.SESSION_SECRET) return false;
  const [expStr, sig] = String(token).split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = toHex(new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(env.SESSION_SECRET, "sign"), te.encode(`${path}:${exp}`))));
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function getToken(c) {
  const header = c.req.header("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function requireUser(c) {
  return verifyToken(c, getToken(c));
}

export function isColumnMissing(err) {
  if (!err) return false;
  const msg = String(err.message || err.hint || "");
  const code = String(err.code || "");
  const lower = msg.toLowerCase();
  return (
    code === "PGRST204" ||
    code === "42703" ||
    msg.includes("Could not find the '") ||
    msg.includes("no existe la columna") ||
    lower.includes("no such column") ||
    lower.includes("no column named") ||
    lower.includes("has no column")
  );
}

export function publicUser(row) {
  if (!row) return null;
  // theme_colors vive en la base como texto json: si se devuelve tal cual, el
  // frontend recibe un string y el selector de Apariencia revienta al leer
  // colors.cursando (undefined.slice).
  const themeColors = unwrapJSON(row.theme_colors);
  return {
    username: row.username,
    name: row.name ?? "",
    university: row.university ?? "",
    career: row.career ?? "",
    semester: row.semester ?? 1,
    ingresoCorte: row.ingreso_corte ?? "2023-2",
    birthdate: row.birthdate ?? "",
    hasPhoto: !!row.photo,
    appMode: row.app_mode ?? "dark",
    appTheme: row.app_theme ?? "ambar",
    themeColors: themeColors && typeof themeColors === "object" ? themeColors : null,
    borderRadius: row.border_radius ?? 12,
    fontScale: row.font_scale ?? 1,
    fontBody: row.font_body ?? "DM Sans",
    securityQuestion: row.security_question ?? "",
  };
}

export function toUserRow(obj) {
  const row = {};
  if (obj.name !== undefined) row.name = String(obj.name);
  if (obj.university !== undefined) row.university = String(obj.university);
  if (obj.career !== undefined) row.career = String(obj.career);
  if (obj.semester !== undefined) row.semester = Number(obj.semester) || 1;
  if (obj.ingresoCorte !== undefined) row.ingreso_corte = String(obj.ingresoCorte);
  if (obj.birthdate !== undefined) row.birthdate = obj.birthdate || null;
  if (obj.photo !== undefined) row.photo = obj.photo || null;
  if (obj.appMode !== undefined) row.app_mode = String(obj.appMode);
  if (obj.appTheme !== undefined) row.app_theme = String(obj.appTheme);
  if (obj.themeColors !== undefined) row.theme_colors = obj.themeColors || null;
  if (obj.borderRadius !== undefined) row.border_radius = Number(obj.borderRadius);
  if (obj.fontScale !== undefined) row.font_scale = Number(obj.fontScale);
  if (obj.fontBody !== undefined) row.font_body = String(obj.fontBody);
  return row;
}
