import { sendNotification } from "web-push-neo";
import { envReady, json, readBody, requireUser, vreq } from "../lib.js";
import { jparse, jstringify } from "../db.js";

const MAX_SENT_KEYS = 200;
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 86400000;
const DEFAULT_REMINDER = 1;

const TIPO_LABEL = {
  examen: "Examen", quiz: "Quiz", tarea: "Tarea",
  proyecto: "Proyecto", laboratorio: "Laboratorio", informe: "Informe",
  taller: "Taller", inicio_semestre: "Inicio de semestre",
  fin_semestre: "Fin de semestre",
};

function normalizePush(raw) {
  return {
    subs: Array.isArray(raw?.subs) ? raw.subs : [],
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
  const syncedIds = new Set((row?.calendario?.eventos || []).map(ev => ev.assignmentId).filter(Boolean));
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
  return sendNotification(sub, payload, { TTL: ttl, vapidDetails: vapidFor(env) }).then(
    () => ({ ok: true }),
    (err) => ({ ok: false, code: err && err.statusCode })
  );
}

const ignore = () => {};

// lógica del cron. la usan tanto scheduled() (index.js) como la ruta manual.
// devuelve { status, body } en vez de responder, para poder llamarla sin http.
export async function runCron(env, isTest = false) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return { status: 503, body: { error: "VAPID no configurado" } };
  }

  const now = new Date(Date.now() - BOGOTA_OFFSET_MS);
  const db = env.DB;

  const rRows = await db
    .prepare("SELECT username, asignaciones, calendario, ajustes FROM user_data")
    .all();
  if (rRows.error) return { status: 500, body: { error: "No se pudieron leer los datos" } };
  const rows = rRows.results || [];

  let sent = 0;
  let removedSubs = 0;
  let processed = 0;

  for (const row of rows || []) {
    const ajustes = row.ajustes && typeof row.ajustes === "object" ? row.ajustes : jparse(row.ajustes) || {};
    const push = normalizePush(ajustes.push);
    if (push.subs.length === 0) continue;

    if (isTest) {
      const payload = JSON.stringify({
        title: "Aimer · Prueba",
        body: "¡Las notificaciones push funcionan!",
        tag: "aimer-test-" + Date.now(),
        url: "/",
      });
      const results = await Promise.all(push.subs.map((sub) => trySend(env, sub, payload, 60)));
      const liveSubs = [];
      push.subs.forEach((sub, i) => {
        const r = results[i];
        if (r && !r.ok && (r.code === 404 || r.code === 410)) {
          removedSubs++;
        } else {
          liveSubs.push(sub);
        }
      });
      if (liveSubs.length !== push.subs.length) {
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

    const payload = JSON.stringify({
      title: "Aimer · Recordatorio",
      body: `${fresh[0].titulo} · ${fresh[0].fecha}${fresh[0].atrasado ? " (con retraso)" : ""}`,
      tag: `aimer-${fresh[0].key}`,
      url: "/",
    });

    const results = await Promise.all(push.subs.map((sub) => trySend(env, sub, payload, 86400)));

    const liveSubs = [];
    push.subs.forEach((sub, i) => {
      const r = results[i];
      if (r && !r.ok && (r.code === 404 || r.code === 410)) {
        removedSubs++;
      } else {
        liveSubs.push(sub);
      }
    });

    fresh.forEach((n) => sentKeys.add(n.key));
    ajustes.push = { subs: liveSubs, sentKeys: Array.from(sentKeys).slice(-MAX_SENT_KEYS) };

    try {
      await db
        .prepare("UPDATE user_data SET ajustes = ? WHERE username = ?")
        .bind(jstringify(ajustes), row.username)
        .run();
      sent += fresh.length;
      processed++;
    } catch {}
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
  // el cron diario ya no pasa por aquí: entra por scheduled() en index.js.
  // (se quitó la confianza en el header `x-vercel-cron`, que cualquiera podía enviar.)
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
    if (!data) return json(c, 500, { error: "No se pudo cargar el estado de push" });
    const ajustes = jparse(data.ajustes) || {};
    const push = normalizePush(ajustes.push);
    return json(c, 200, {
      publicKey: VAPID_PUBLIC || null,
      subscribed: push.subs.length > 0,
      sentKeys: push.sentKeys,
    });
  }

  if (!me) return json(c, 401, { error: "Sesión inválida" });

  if (req.method === "POST") {
    const body = await readBody(c);
    const { action } = body;
    if (!action) return json(c, 400, { error: "Faltan datos" });

    const data = await db.prepare("SELECT ajustes FROM user_data WHERE username = ?").bind(me.username).first();
    if (!data) return json(c, 500, { error: "No se pudo guardar el estado de push" });

    const ajustes = jparse(data.ajustes) || {};
    const push = normalizePush(ajustes.push);
    let { subs, sentKeys } = push;

    if (action === "subscribe") {
      const { subscription } = body;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return json(c, 400, { error: "Suscripción inválida" });
      }
      subs = subs.filter((s) => s.endpoint !== subscription.endpoint);
      subs.push(subscription);
    } else if (action === "unsubscribe") {
      const { endpoint } = body;
      if (!endpoint) return json(c, 400, { error: "Faltan datos" });
      subs = subs.filter((s) => s.endpoint !== endpoint);
    } else if (action === "test") {
      if (subs.length === 0) return json(c, 400, { error: "Sin suscripción activa. Toca 'Activar push' o dale permiso a las notificaciones." });
      if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
        return json(c, 503, { error: "Push no configurado" });
      }
      const payload = JSON.stringify({
        title: "Aimer · Prueba",
        body: "¡Las notificaciones funcionan! Esta es una prueba.",
        tag: "aimer-test-" + Date.now(),
        url: "/",
      });
      const results = await Promise.all(subs.map((s) => trySend(c.env, s, payload, 60)));
      const liveSubs = [];
      let okCount = 0;
      subs.forEach((s, i) => {
        const r = results[i];
        if (!r.ok && (r.code === 404 || r.code === 410)) return;
        liveSubs.push(s);
        if (r.ok) okCount++;
      });
      if (liveSubs.length !== subs.length) {
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

    ajustes.push = { subs, sentKeys };
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
