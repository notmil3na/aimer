import { sendNotification } from "web-push-neo";
import { envReady, json, readBody, requireUser, vreq } from "../lib.js";
import { jparse, jstringify, uuid, nowISO } from "../db.js";

const MAX_SENT_KEYS = 200;
const MAX_SUBS_PER_USER = 5; // Tope máximo de suscripciones push por usuario
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 86400000;
const DEFAULT_REMINDER = 1;
const MAX_SUBREQUESTS = 45; // Límite seguro para Cloudflare Workers (50 máx)

const TIPO_LABEL = {
  examen: "Examen", quiz: "Quiz", tarea: "Tarea",
  proyecto: "Proyecto", laboratorio: "Laboratorio", informe: "Informe",
  taller: "Taller", inicio_semestre: "Inicio de semestre",
  fin_semestre: "Fin de semestre",
};

/**
 * Valida que el endpoint de notificación pertenezca a la lista blanca de proveedores
 * legítimos de Web Push para evitar SSRF, abuso saliente y llamadas a hosts no autorizados.
 */
export function isValidPushEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== "string" || endpoint.length > 1000) return false;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  // Requiere estrictamente protocolo HTTPS y sin credenciales en la URL
  if (url.protocol !== "https:" || url.username || url.password) return false;

  const h = url.hostname.toLowerCase();

  // Lista blanca de proveedores oficiales de Web Push
  const ALLOWED_EXACT = new Set([
    "fcm.googleapis.com",
    "push.services.mozilla.com",
    "push.apple.com",
    "notify.windows.com",
  ]);
  if (ALLOWED_EXACT.has(h)) return true;

  const ALLOWED_SUFFIXES = [
    ".push.services.mozilla.com",
    ".push.apple.com",
    ".notify.windows.com",
  ];
  return ALLOWED_SUFFIXES.some((s) => h.endsWith(s));
}

export function isValidSubscription(sub) {
  if (!sub || typeof sub !== "object") return false;
  if (!isValidPushEndpoint(sub.endpoint)) return false;
  if (!sub.keys || typeof sub.keys !== "object") return false;
  const { p256dh, auth } = sub.keys;
  if (typeof p256dh !== "string" || p256dh.length < 20 || p256dh.length > 250) return false;
  if (typeof auth !== "string" || auth.length < 10 || auth.length > 100) return false;
  return true;
}

function normalizePush(raw) {
  return {
    subs: Array.isArray(raw?.subs) ? raw.subs.filter(isValidSubscription).slice(-MAX_SUBS_PER_USER) : [],
    sentKeys: Array.isArray(raw?.sentKeys) ? raw.sentKeys : [],
  };
}

function dayStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseISODate(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function labelFromTipo(tipo) {
  return TIPO_LABEL[tipo] || "Evento";
}

function daysBetween(a, b) {
  return Math.round((dayStart(b) - dayStart(a)) / DAY_MS);
}

function dueFrom(item, fecha, now) {
  if (item.notificar === false) return null;
  const offset = item.recordatorio ?? DEFAULT_REMINDER;
  const eventDate = parseISODate(fecha);
  if (!eventDate) return null;
  const trigger = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate() - (offset || 0)
  );
  const today = dayStart(now);
  if (today > eventDate) return null;
  if (today < trigger) return null;
  return {
    key: item.key,
    titulo: item.titulo || labelFromTipo(item.tipo),
    fecha,
    diasRestantes: daysBetween(today, eventDate),
    atrasado: today > trigger,
  };
}

function computeDue(row, now) {
  const out = [];
  const seen = new Set();
  const syncedIds = new Set((row?.calendario?.eventos || []).map((ev) => ev.assignmentId).filter(Boolean));
  for (const it of row?.asignaciones?.items || []) {
    if (it.completada || it.calendarId || syncedIds.has(it.id)) continue;
    const fecha =
      it.tipo === "examen" || it.tipo === "quiz" ? it.fechaExamen : it.fechaEntrega;
    const d = dueFrom({ ...it, key: `asig:${it.id}` }, fecha, now);
    if (d && !seen.has(d.key)) { seen.add(d.key); out.push(d); }
  }
  for (const ev of row?.calendario?.eventos || []) {
    const d = dueFrom({ ...ev, key: `ev:${ev.id}` }, ev.fecha, now);
    if (d && !seen.has(d.key)) { seen.add(d.key); out.push(d); }
  }
  out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  return out;
}

function vapidFor(env) {
  return {
    subject: env.VAPID_SUBJECT || "https://mallaunimag.com",
    publicKey: env.VAPID_PUBLIC_KEY || "",
    privateKey: env.VAPID_PRIVATE_KEY || "",
  };
}

// envía un push y nunca lanza: devuelve { ok } o { ok:false, code }
function trySend(env, sub, payload, ttl) {
  if (!isValidSubscription(sub)) {
    return Promise.resolve({ ok: false, code: 400 });
  }
  return sendNotification(sub, payload, { TTL: ttl, vapidDetails: vapidFor(env) }).then(
    () => ({ ok: true }),
    (err) => ({ ok: false, code: err && err.statusCode })
  );
}

const ignore = () => {};

// Helpers para consultar y actualizar la tabla dedicada `push_subscriptions`
async function getSubsForUser(db, username, fallbackSubs = []) {
  try {
    const r = await db
      .prepare("SELECT subscription FROM push_subscriptions WHERE username = ?")
      .bind(username)
      .all();
    if (r?.results && r.results.length > 0) {
      const dbSubs = r.results
        .map((row) => jparse(row.subscription))
        .filter(isValidSubscription);
      const map = new Map();
      for (const s of fallbackSubs) if (isValidSubscription(s)) map.set(s.endpoint, s);
      for (const s of dbSubs) if (isValidSubscription(s)) map.set(s.endpoint, s);
      return Array.from(map.values()).slice(-MAX_SUBS_PER_USER);
    }
  } catch (_) {}
  return fallbackSubs.filter(isValidSubscription).slice(-MAX_SUBS_PER_USER);
}

async function saveSubscriptionToTable(db, username, sub) {
  if (!isValidSubscription(sub)) return;
  const now = nowISO();
  const id = uuid();
  try {
    await db
      .prepare(
        `INSERT INTO push_subscriptions (id, username, endpoint, subscription, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET
           username = excluded.username,
           subscription = excluded.subscription,
           updated_at = excluded.updated_at`
      )
      .bind(id, username, sub.endpoint, jstringify(sub), now, now)
      .run();

    // Mantener tope de 5 suscripciones por usuario en la tabla
    const allUserSubs = await db
      .prepare("SELECT id FROM push_subscriptions WHERE username = ? ORDER BY created_at ASC")
      .bind(username)
      .all();
    if (allUserSubs?.results && allUserSubs.results.length > MAX_SUBS_PER_USER) {
      const excess = allUserSubs.results.slice(0, allUserSubs.results.length - MAX_SUBS_PER_USER);
      for (const row of excess) {
        await db.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(row.id).run();
      }
    }
  } catch (_) {}
}

async function removeSubscriptionFromTable(db, endpoint) {
  if (!endpoint) return;
  try {
    await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
  } catch (_) {}
}

// lógica del cron. la usan tanto scheduled() (index.js) como la ruta manual.
// devuelve { status, body } en vez de responder, para poder llamarla sin http.
export async function runCron(env, isTest = false) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return { status: 503, body: { error: "VAPID no configurado" } };
  }

  const now = new Date(Date.now() - BOGOTA_OFFSET_MS);
  const db = env.DB;

  // Filtrar en SQL solo los usuarios con suscripciones push activas.
  // Evita leer, deserializar y procesar toda la tabla user_data innecesariamente.
  let rRows;
  try {
    rRows = await db
      .prepare(
        `SELECT u.username, u.asignaciones, u.calendario, u.ajustes
         FROM user_data u
         WHERE (
           EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.username = u.username)
           OR (u.ajustes IS NOT NULL AND u.ajustes LIKE '%"endpoint"%')
         )`
      )
      .all();
  } catch (_) {
    rRows = await db
      .prepare(
        `SELECT username, asignaciones, calendario, ajustes
         FROM user_data
         WHERE ajustes IS NOT NULL AND ajustes LIKE '%"endpoint"%'`
      )
      .all();
  }

  if (rRows.error) return { status: 500, body: { error: "No se pudieron leer los datos" } };
  const rows = rRows.results || [];

  let sent = 0;
  let removedSubs = 0;
  let processed = 0;
  let subrequestCount = 0;

  for (const row of rows || []) {
    if (subrequestCount >= MAX_SUBREQUESTS) {
      console.warn("Límite de subrequests alcanzado en este ciclo del cron");
      break;
    }

    const ajustes = row.ajustes && typeof row.ajustes === "object" ? row.ajustes : jparse(row.ajustes) || {};
    const push = normalizePush(ajustes.push);
    const activeSubs = await getSubsForUser(db, row.username, push.subs);
    if (activeSubs.length === 0) continue;

    if (isTest) {
      const payload = JSON.stringify({
        title: "Aimer · Prueba",
        body: "¡Las notificaciones push funcionan!",
        tag: "aimer-test-" + Date.now(),
        url: "/",
      });
      subrequestCount += activeSubs.length;
      const results = await Promise.all(activeSubs.map((sub) => trySend(env, sub, payload, 60)));
      const liveSubs = [];
      for (let i = 0; i < activeSubs.length; i++) {
        const sub = activeSubs[i];
        const r = results[i];
        if (r && !r.ok && (r.code === 404 || r.code === 410)) {
          removedSubs++;
          await removeSubscriptionFromTable(db, sub.endpoint);
        } else {
          liveSubs.push(sub);
        }
      }
      if (liveSubs.length !== activeSubs.length) {
        ajustes.push = { subs: liveSubs, sentKeys: push.sentKeys };
        await db
          .prepare("UPDATE user_data SET ajustes = ? WHERE username = ?")
          .bind(jstringify(ajustes), row.username)
          .run()
          .then(ignore, ignore);
      }
      const okCount = results.filter((r) => r.ok).length;
      sent += okCount;
      if (okCount > 0) processed++;
      continue;
    }

    const rowObj = {
      ...row,
      asignaciones: jparse(row.asignaciones) || {},
      calendario: jparse(row.calendario) || {},
      ajustes: jparse(row.ajustes) || {},
    };
    const due = computeDue(rowObj, now);
    if (due.length === 0) continue;

    const sentKeys = new Set(push.sentKeys);
    const fresh = due.filter((n) => !sentKeys.has(n.key));
    if (fresh.length === 0) continue;

    // Notificar cada ítem pendiente (hasta 3 por día para no saturar).
    // Si hay más, los restantes se notificarán en el siguiente ciclo sin perderse.
    const toNotify = fresh.slice(0, 3);
    let liveSubs = [...activeSubs];
    let userSentCount = 0;

    for (const item of toNotify) {
      if (liveSubs.length === 0) break;
      if (subrequestCount + liveSubs.length > MAX_SUBREQUESTS) break;

      const payload = JSON.stringify({
        title: "Aimer · Recordatorio",
        body: `${item.titulo} · ${item.fecha}${item.atrasado ? " (con retraso)" : ""}`,
        tag: `aimer-${item.key}`,
        url: "/",
      });

      subrequestCount += liveSubs.length;
      const results = await Promise.all(liveSubs.map((sub) => trySend(env, sub, payload, 86400)));

      // Limpiar suscripciones inactivas o desinstaladas (HTTP 404 / 410)
      const nextLiveSubs = [];
      for (let i = 0; i < liveSubs.length; i++) {
        const sub = liveSubs[i];
        const r = results[i];
        if (r && !r.ok && (r.code === 404 || r.code === 410)) {
          removedSubs++;
          await removeSubscriptionFromTable(db, sub.endpoint);
        } else {
          nextLiveSubs.push(sub);
        }
      }
      liveSubs = nextLiveSubs;

      // SOLO marcar este ítem como enviado si al menos un dispositivo recibió la notificación con éxito
      const anyOk = results.some((r) => r.ok);
      if (anyOk) {
        sentKeys.add(item.key);
        userSentCount++;
        sent++;
      }
    }

    // Actualizar ajustes solo si se enviaron recordatorios o se eliminaron suscripciones caídas
    if (userSentCount > 0 || liveSubs.length !== activeSubs.length) {
      ajustes.push = { subs: liveSubs, sentKeys: Array.from(sentKeys).slice(-MAX_SENT_KEYS) };
      try {
        await db
          .prepare("UPDATE user_data SET ajustes = ? WHERE username = ?")
          .bind(jstringify(ajustes), row.username)
          .run();
        if (userSentCount > 0) processed++;
      } catch {}
    }
  }

  return {
    status: 200,
    body: { ok: true, sent, removedSubs, processed, checked: (rows || []).length },
  };
}

export async function handler(c) {
  const req = vreq(c);
  if (!envReady(c.env)) {
    return json(c, 500, { error: "Configuración del servidor incompleta" });
  }
  const db = c.env.DB;

  const VAPID_PUBLIC = c.env.VAPID_PUBLIC_KEY || "";
  const VAPID_PRIVATE = c.env.VAPID_PRIVATE_KEY || "";
  const CRON_SECRET = c.env.CRON_SECRET || "";

  // disparo manual (p. ej. `?test=1`): solo con el secreto en un header.
  if (CRON_SECRET && req.headers["x-cron-secret"] === CRON_SECRET) {
    const r = await runCron(c.env, req.query.test === "1");
    return json(c, r.status, r.body);
  }

  const me = await requireUser(c);

  if (req.method === "GET") {
    if (!me) {
      if (!VAPID_PUBLIC) return json(c, 503, { error: "Push no configurado" });
      return json(c, 200, { publicKey: VAPID_PUBLIC });
    }
    const data = await db.prepare("SELECT ajustes FROM user_data WHERE username = ?").bind(me.username).first();
    const ajustes = jparse(data?.ajustes) || {};
    const push = normalizePush(ajustes.push);
    const activeSubs = await getSubsForUser(db, me.username, push.subs);
    return json(c, 200, {
      publicKey: VAPID_PUBLIC || null,
      subscribed: activeSubs.length > 0,
      sentKeys: push.sentKeys,
    });
  }

  if (!me) return json(c, 401, { error: "Sesión inválida" });

  if (req.method === "POST") {
    const body = await readBody(c);
    const { action } = body;
    if (!action) return json(c, 400, { error: "Faltan datos" });

    const data = await db.prepare("SELECT ajustes FROM user_data WHERE username = ?").bind(me.username).first();
    const ajustes = jparse(data?.ajustes) || {};
    const push = normalizePush(ajustes.push);
    let { subs, sentKeys } = push;

    if (action === "subscribe") {
      const { subscription } = body;
      if (!isValidSubscription(subscription)) {
        return json(c, 400, {
          error: "Suscripción inválida o servicio push no permitido. Solo se aceptan proveedores oficiales (Google, Apple, Mozilla, Windows).",
        });
      }
      await saveSubscriptionToTable(db, me.username, subscription);
      subs = subs.filter((s) => s.endpoint !== subscription.endpoint && isValidSubscription(s));
      if (subs.length >= MAX_SUBS_PER_USER) {
        subs = subs.slice(-(MAX_SUBS_PER_USER - 1));
      }
      subs.push(subscription);
    } else if (action === "unsubscribe") {
      const { endpoint } = body;
      if (!endpoint) return json(c, 400, { error: "Faltan datos" });
      await removeSubscriptionFromTable(db, endpoint);
      subs = subs.filter((s) => s.endpoint !== endpoint);
    } else if (action === "test") {
      const activeSubs = await getSubsForUser(db, me.username, subs);
      if (activeSubs.length === 0) {
        return json(c, 400, { error: "Sin suscripción activa. Toca 'Activar push' o dale permiso a las notificaciones." });
      }
      if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
        return json(c, 503, { error: "Push no configurado" });
      }
      const payload = JSON.stringify({
        title: "Aimer · Prueba",
        body: "¡Las notificaciones funcionan! Esta es una prueba.",
        tag: "aimer-test-" + Date.now(),
        url: "/",
      });
      const results = await Promise.all(activeSubs.map((s) => trySend(c.env, s, payload, 60)));
      const liveSubs = [];
      let okCount = 0;
      for (let i = 0; i < activeSubs.length; i++) {
        const s = activeSubs[i];
        const r = results[i];
        if (!r.ok && (r.code === 404 || r.code === 410)) {
          await removeSubscriptionFromTable(db, s.endpoint);
          continue;
        }
        liveSubs.push(s);
        if (r.ok) okCount++;
      }
      if (liveSubs.length !== activeSubs.length) {
        ajustes.push = { subs: liveSubs, sentKeys };
        await db
          .prepare("UPDATE user_data SET ajustes = ? WHERE username = ?")
          .bind(jstringify(ajustes), me.username)
          .run()
          .then(ignore, ignore);
      }
      if (okCount > 0) return json(c, 200, { ok: true });
      return json(c, 502, { ok: false, error: `No se pudo entregar la notificación (${results[0]?.code || "desconocido"})` });
    } else if (action === "mark") {
      const keys = Array.isArray(body.keys)
        ? body.keys.filter((k) => typeof k === "string")
        : body.key
          ? [body.key]
          : [];
      if (keys.length === 0) return json(c, 400, { error: "Faltan datos" });
      for (const k of keys) {
        if (!sentKeys.includes(k)) sentKeys.push(k);
      }
      if (sentKeys.length > MAX_SENT_KEYS) sentKeys = sentKeys.slice(-MAX_SENT_KEYS);
    } else {
      return json(c, 400, { error: "Acción inválida" });
    }

    ajustes.push = { subs: subs.slice(-MAX_SUBS_PER_USER), sentKeys };
    try {
      await db
        .prepare("UPDATE user_data SET ajustes = ? WHERE username = ?")
        .bind(jstringify(ajustes), me.username)
        .run();
    } catch {
      return json(c, 500, { error: "No se pudo guardar el estado de push" });
    }
    return json(c, 200, { ok: true });
  }

  return json(c, 405, { error: "method" });
}
