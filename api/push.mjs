import webpush from "web-push";
import { admin, envReady, json, readBody, requireUser } from "./_lib.mjs";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "https://mallaunimag.com";
const CRON_SECRET = process.env.CRON_SECRET || "";

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

async function runCron(res, req) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json(res, 503, { error: "VAPID no configurado" });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const isTest = !!(req && req.query && req.query.test === "1");
  const now = new Date(Date.now() - BOGOTA_OFFSET_MS);

  const { data: rows, error } = await admin
    .from("user_data")
    .select("username, asignaciones, calendario, ajustes");
  if (error) return json(res, 500, { error: "No se pudieron leer los datos" });

  let sent = 0;
  let removedSubs = 0;
  let processed = 0;

  for (const row of rows || []) {
    const ajustes =
      row.ajustes && typeof row.ajustes === "object" ? row.ajustes : {};
    const push = normalizePush(ajustes.push);
    if (push.subs.length === 0) continue;

    if (isTest) {
      const payload = JSON.stringify({
        title: "MiMalla · Prueba",
        body: "¡Las notificaciones push funcionan!",
        tag: "mimalla-test-" + Date.now(),
        url: "/",
      });
      const results = await Promise.all(
        push.subs.map((sub) =>
          webpush
            .sendNotification(sub, payload, { TTL: 60 })
            .then(() => ({ ok: true }))
            .catch((err) => ({ ok: false, code: err.statusCode }))
        )
      );
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
        await admin
          .from("user_data")
          .update({ ajustes })
          .eq("username", row.username)
          .catch(() => {});
      }
      const okCount = results.filter((r) => r.ok).length;
      sent += okCount;
      if (okCount > 0) processed++;
      continue;
    }

    const due = computeDue(row, now);
    if (due.length === 0) continue;

    const sentKeys = new Set(push.sentKeys);
    const fresh = due.filter((n) => !sentKeys.has(n.key));
    if (fresh.length === 0) continue;

    const payload = JSON.stringify({
      title: "MiMalla · Recordatorio",
      body: `${fresh[0].titulo} · ${fresh[0].fecha}${fresh[0].atrasado ? " (con retraso)" : ""}`,
      tag: `mimalla-${fresh[0].key}`,
      url: "/",
    });

    const results = await Promise.all(
      push.subs.map((sub) =>
        webpush
          .sendNotification(sub, payload, { TTL: 86400 })
          .then(() => ({ ok: true }))
          .catch((err) => ({ ok: false, code: err.statusCode }))
      )
    );

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

    const { error: updErr } = await admin
      .from("user_data")
      .update({ ajustes })
      .eq("username", row.username);
    if (!updErr) {
      sent += fresh.length;
      processed++;
    }
  }

  return json(res, 200, {
    ok: true,
    sent,
    removedSubs,
    processed,
    checked: (rows || []).length,
  });
}

export default async function handler(req, res) {
  if (!envReady() || !admin) {
    return json(res, 500, { error: "Configuración del servidor incompleta" });
  }

  const fromCron = req.headers["x-vercel-cron"] === "1";
  const hasSecret =
    CRON_SECRET &&
    (req.headers["x-cron-secret"] === CRON_SECRET || req.query?.secret === CRON_SECRET);
  if (fromCron || hasSecret) return runCron(res, req);

  const me = requireUser(req);

  if (req.method === "GET") {
    if (!me) {
      if (!VAPID_PUBLIC) return json(res, 503, { error: "Push no configurado" });
      return json(res, 200, { publicKey: VAPID_PUBLIC });
    }
    const { data, error } = await admin
      .from("user_data")
      .select("ajustes")
      .eq("username", me.username)
      .maybeSingle();
    if (error) return json(res, 500, { error: "No se pudo cargar el estado de push" });
    const push = normalizePush(data?.ajustes?.push);
    return json(res, 200, {
      publicKey: VAPID_PUBLIC || null,
      subscribed: push.subs.length > 0,
      sentKeys: push.sentKeys,
    });
  }

  if (!me) return json(res, 401, { error: "Sesión inválida" });

  if (req.method === "POST") {
    const body = await readBody(req);
    const { action } = body;
    if (!action) return json(res, 400, { error: "Faltan datos" });

    const { data, error: readErr } = await admin
      .from("user_data")
      .select("ajustes")
      .eq("username", me.username)
      .maybeSingle();
    if (readErr) return json(res, 500, { error: "No se pudo guardar el estado de push" });

    const ajustes =
      data?.ajustes && typeof data.ajustes === "object" ? data.ajustes : {};
    const push = normalizePush(ajustes.push);
    let { subs, sentKeys } = push;

    if (action === "subscribe") {
      const { subscription } = body;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return json(res, 400, { error: "Suscripción inválida" });
      }
      subs = subs.filter((s) => s.endpoint !== subscription.endpoint);
      subs.push(subscription);
    } else if (action === "unsubscribe") {
      const { endpoint } = body;
      if (!endpoint) return json(res, 400, { error: "Faltan datos" });
      subs = subs.filter((s) => s.endpoint !== endpoint);
    } else if (action === "test") {
      if (subs.length === 0) return json(res, 400, { error: "Sin suscripción activa. Toca 'Activar push' o dale permiso a las notificaciones." });
      if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
        return json(res, 503, { error: "Push no configurado" });
      }
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
      const payload = JSON.stringify({
        title: "MiMalla · Prueba",
        body: "¡Las notificaciones funcionan! Esta es una prueba.",
        tag: "mimalla-test-" + Date.now(),
        url: "/",
      });
      const results = await Promise.all(
        subs.map((s) =>
          webpush.sendNotification(s, payload, { TTL: 60 }).then(
            () => ({ ok: true }),
            (err) => ({ ok: false, code: err && err.statusCode })
          )
        )
      );
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
        await admin
          .from("user_data")
          .update({ ajustes })
          .eq("username", me.username)
          .catch(() => {});
      }
      if (okCount > 0) return json(res, 200, { ok: true });
      return json(res, 502, { ok: false, error: `No se pudo entregar la notificación (${results[0]?.code || "desconocido"})` });
    } else if (action === "mark") {
      const keys = Array.isArray(body.keys)
        ? body.keys.filter((k) => typeof k === "string")
        : body.key
          ? [body.key]
          : [];
      if (keys.length === 0) return json(res, 400, { error: "Faltan datos" });
      for (const k of keys) {
        if (!sentKeys.includes(k)) sentKeys.push(k);
      }
      if (sentKeys.length > MAX_SENT_KEYS) sentKeys = sentKeys.slice(-MAX_SENT_KEYS);
    } else {
      return json(res, 400, { error: "Acción inválida" });
    }

    ajustes.push = { subs, sentKeys };
    const { error: updErr } = await admin
      .from("user_data")
      .update({ ajustes })
      .eq("username", me.username);
    if (updErr) return json(res, 500, { error: "No se pudo guardar el estado de push" });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: "method" });
}
