import { envReady, json, readBody, requireUser, signPath, vreq } from "../lib.js";
import { uuid, nowISO, jstringify, all } from "../db.js";

function canonicalPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT = 8000;
const MAX_JSON = 32000;
const MESSAGE_TYPES = ["text", "image", "file", "assignment", "note"];

function newChannelToken() {
  try {
    return crypto.randomBytes(24).toString("hex");
  } catch {
    const b = new Uint8Array(24);
    crypto.getRandomValues(b);
    return Array.from(b)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  }
}

function newMessageId() {
  return uuid();
}

function sanitizeFileName(name) {
  const base = String(name || "archivo")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return base || "archivo";
}

function msgParams(data) {
  const isJson = data.message_type === "assignment" || data.message_type === "note";
  return {
    type: String(data.message_type || "text"),
    content: typeof data.content === "string"
      ? data.content.slice(0, isJson ? MAX_JSON : MAX_TEXT)
      : "",
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    academicItems: Array.isArray(data.academic_items) ? data.academic_items : [],
    messageId: data.message_id || newMessageId(),
  };
}

async function sonAmigos(db, a, b) {
  const [x, y] = canonicalPair(a, b);
  const row = await db
    .prepare("SELECT * FROM friendships WHERE user_username = ? AND friend_username = ?")
    .bind(x, y)
    .first();
  return { ok: !!(row && row.status === "aceptado"), friendRow: row || null };
}

async function resolveConversationId(db, me, other) {
  const [a, b] = canonicalPair(me, other);
  const row = await db
    .prepare("SELECT conversation_id FROM conversation_pairs WHERE user_a = ? AND user_b = ?")
    .bind(a, b)
    .first();
  return { conversationId: row ? row.conversation_id : null };
}

async function ensureConversation(db, me, other) {
  const [a, b] = canonicalPair(me, other);

  const existing = await resolveConversationId(db, me, other);
  if (existing.conversationId) return { conversation_id: existing.conversationId, error: null };

  const id = uuid();
  const now = nowISO();
  await db
    .prepare("INSERT INTO conversations (id, channel_token, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .bind(id, newChannelToken(), now, now)
    .run();

  await db
    .prepare("INSERT INTO conversation_members (conversation_id, username, joined_at, last_read_at) VALUES (?, ?, ?, ?)")
    .bind(id, a, now, now)
    .run();
  await db
    .prepare("INSERT INTO conversation_members (conversation_id, username, joined_at, last_read_at) VALUES (?, ?, ?, ?)")
    .bind(id, b, now, null)
    .run();

  try {
    await db
      .prepare("INSERT INTO conversation_pairs (conversation_id, user_a, user_b) VALUES (?, ?, ?)")
      .bind(id, a, b)
      .run();
  } catch (pairErr) {
    // carrera: otro proceso creó el par; deshacer la conversación sobrante y re-resolver
    await db.prepare("DELETE FROM conversation_members WHERE conversation_id = ?").bind(id).run();
    await db.prepare("DELETE FROM conversations WHERE id = ?").bind(id).run();
    const again = await resolveConversationId(db, me, other);
    return { conversation_id: again.conversationId, error: again.conversationId ? null : pairErr };
  }

  return { conversation_id: id, error: null };
}

async function membersOf(db, conversationId) {
  const res = await db
    .prepare("SELECT * FROM conversation_members WHERE conversation_id = ?")
    .bind(conversationId)
    .all();
  return res.results || [];
}

async function channelTokenOf(db, conversationId) {
  const row = await db
    .prepare("SELECT channel_token FROM conversations WHERE id = ?")
    .bind(conversationId)
    .first();
  return row ? row.channel_token : "";
}

function userPublicInfo(row) {
  return {
    username: row.username,
    name: row.name ?? "",
    university: row.university ?? "",
    career: row.career ?? "",
    semester: row.semester ?? 1,
    hasPhoto: !!row.photo,
  };
}

async function usersInfo(db, usernames) {
  const uniq = [...new Set(usernames)];
  if (uniq.length === 0) return {};
  const ph = uniq.map(() => "?").join(",");
  const res = await db
    .prepare(`SELECT username, name, university, career, semester, photo FROM users WHERE username IN (${ph})`)
    .bind(...uniq)
    .all();
  const map = {};
  (res.results || []).forEach((u) => { map[u.username] = userPublicInfo(u); });
  return map;
}

function lastPreview(msg) {
  if (!msg) return { kind: "none", label: "Inicia una conversación" };
  let label = "Mensaje";
  if (msg.message_type === "image") label = "📷 Foto";
  else if (msg.message_type === "file") label = "📎 Archivo";
  else if (msg.message_type === "assignment") label = "📋 Compartió una asignación";
  else if (msg.message_type === "note") label = "📒 Compartió un apunte";
  else if (msg.message_type === "text") {
    const t = (msg.content || "").trim().replace(/\s+/g, " ");
    label = t.length > 60 ? t.slice(0, 60) + "…" : t;
  }
  return { kind: msg.message_type, label };
}

async function signedUrlFor(env, absPath) {
  if (!absPath) return { url: null, name: "" };
  const token = await signPath(env, absPath, 6 * 60 * 60);
  const parts = String(absPath).split("/").pop() || "";
  return { url: `/api/chat-attachment?path=${encodeURIComponent(absPath)}&token=${token}`, name: parts };
}

async function handleChatList(db, me) {
  const mine = await db
    .prepare("SELECT * FROM conversation_members WHERE username = ?")
    .bind(me)
    .all();
  const myConvs = mine.results || [];
  const convIds = myConvs.map((c) => c.conversation_id);
  if (convIds.length === 0) return { data: [] };
  const ph = convIds.map(() => "?").join(",");

  const clearedByConv = {};
  const hiddenByConv = {};
  const pinnedByConv = {};
  for (const c of myConvs) {
    if (c.cleared_at) clearedByConv[c.conversation_id] = new Date(c.cleared_at).getTime();
    if (c.hidden_at) hiddenByConv[c.conversation_id] = new Date(c.hidden_at).getTime();
    pinnedByConv[c.conversation_id] = !!c.pinned_at;
  }

  const convRows = await db
    .prepare(`SELECT id, channel_token, updated_at FROM conversations WHERE id IN (${ph})`)
    .bind(...convIds)
    .all();
  const convMap = {};
  (convRows.results || []).forEach((c) => { convMap[c.id] = c; });

  const memberRows = await db
    .prepare(`SELECT conversation_id, username FROM conversation_members WHERE conversation_id IN (${ph})`)
    .bind(...convIds)
    .all();
  const partnerByConv = {};
  const partnerUsernames = [];
  (memberRows.results || []).forEach((m) => {
    if (m.username === me) return;
    partnerByConv[m.conversation_id] = m.username;
    partnerUsernames.push(m.username);
  });

  const msgRows = await db
    .prepare(`SELECT id, conversation_id, sender, message_type, content, read, created_at FROM messages WHERE conversation_id IN (${ph}) ORDER BY created_at DESC`)
    .bind(...convIds)
    .all();

  const lastByConv = {};
  const unreadByConv = {};
  const visibleAfterHidden = new Set();
  for (const m of msgRows.results || []) {
    const createdMs = new Date(m.created_at).getTime();
    const clearedMs = clearedByConv[m.conversation_id];
    if (clearedMs && createdMs <= clearedMs) continue;
    const hiddenMs = hiddenByConv[m.conversation_id];
    if (hiddenMs && createdMs > hiddenMs) visibleAfterHidden.add(m.conversation_id);
    if (lastByConv[m.conversation_id] === undefined) lastByConv[m.conversation_id] = m;
    if (m.sender !== me && !m.read) unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id] || 0) + 1;
  }

  const info = await usersInfo(db, partnerUsernames);

  const list = convIds
    .filter((convId) => !hiddenByConv[convId] || visibleAfterHidden.has(convId))
    .map((convId) => {
      const conv = convMap[convId] || {};
      const partner = partnerByConv[convId];
      const last = lastByConv[convId];
      const prev = lastPreview(last);
      return {
        conversation_id: convId,
        channel_token: conv.channel_token || "",
        updated_at: conv.updated_at || null,
        partner: partner || null,
        partnerName: info[partner] ? info[partner].name : "",
        partnerHasPhoto: !!(info[partner] && info[partner].hasPhoto),
        pinned: pinnedByConv[convId],
        last: last
          ? {
              id: last.id,
              sender: last.sender,
              created_at: last.created_at,
              kind: last.message_type,
              label: prev.label,
              content: last.content,
            }
          : null,
        unread: unreadByConv[convId] || 0,
      };
    });

  list.sort((x, y) => {
    if (x.pinned !== y.pinned) return x.pinned ? -1 : 1;
    const tx = x.last ? new Date(x.last.created_at).getTime() : 0;
    const ty = y.last ? new Date(y.last.created_at).getTime() : 0;
    return ty - tx;
  });

  return { data: list };
}

async function handleChatThread(db, env, me, other) {
  const friend = await sonAmigos(db, me, other);
  if (!friend.ok) return { error: "Solo puedes chatear con tus amigos", status: 403 };

  const resolved = await resolveConversationId(db, me, other);
  if (!resolved.conversationId) {
    return {
      data: { conversation_id: null, channel_token: null, participants: [], messages: [] },
    };
  }
  const conversationId = resolved.conversationId;

  const members = await membersOf(db, conversationId);
  const usernames = members.map((m) => m.username);
  if (!usernames.includes(me)) return { error: "No tienes acceso a esta conversación", status: 403 };

  const myMember = members.find((m) => m.username === me) || {};
  const clearedMs = myMember.cleared_at ? new Date(myMember.cleared_at).getTime() : 0;

  const msgRes = await db
    .prepare("SELECT id, sender, message_type, content, read, created_at, deleted_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
    .bind(conversationId)
    .all();

  const visible = (msgRes.results || []).filter(
    (m) => !m.deleted_at && (!clearedMs || new Date(m.created_at).getTime() > clearedMs)
  );
  const ids = visible.map((m) => m.id);

  let attachments = [];
  let academicItems = [];
  if (ids.length) {
    const ph = ids.map(() => "?").join(",");
    const att = await db
      .prepare(`SELECT * FROM message_attachments WHERE message_id IN (${ph}) ORDER BY created_at ASC`)
      .bind(...ids)
      .all();
    attachments = att.results || [];
    const ai = await db
      .prepare(`SELECT * FROM message_academic_items WHERE message_id IN (${ph}) ORDER BY created_at ASC`)
      .bind(...ids)
      .all();
    academicItems = ai.results || [];
  }

  const attByMsg = {};
  const signedUrls = {};
  for (const att of attachments || []) {
    attByMsg[att.message_id] = att;
    const s = await signedUrlFor(env, att.storage_path);
    signedUrls[att.message_id] = { ...s, mime_type: att.mime_type, file_size: att.file_size, file_name: att.file_name || s.name };
  }
  const aiByMsg = {};
  for (const item of academicItems || []) aiByMsg[item.message_id] = item;

  const channel_token = await channelTokenOf(db, conversationId);
  const info = await usersInfo(db, usernames);

  const messages = visible.map((m) => {
    let parsed = null;
    if (m.message_type === "assignment" || m.message_type === "note") {
      try { parsed = JSON.parse(m.content); } catch { parsed = null; }
    }
    return {
      id: m.id,
      sender: m.sender,
      message_type: m.message_type,
      content: m.content,
      created_at: m.created_at,
      read: !!m.read,
      payload: parsed,
      attachment: signedUrls[m.id] || null,
      academic_item: aiByMsg[m.id] || null,
    };
  });

  const participants = usernames
    .map((u) => info[u] || { username: u, name: u, hasPhoto: false })
    .sort((x, y) => (x.username === me ? -1 : 1));

  return {
    data: {
      conversation_id: conversationId,
      channel_token,
      participants,
      messages,
    },
  };
}

async function actionChatOpen(db, env, me, other) {
  const friend = await sonAmigos(db, me, other);
  if (!friend.ok) return { error: "Solo puedes chatear con tus amigos", status: 403 };

  const conv = await ensureConversation(db, me, other);
  if (!conv.conversation_id) return { error: "No se pudo abrir la conversación" };

  const token = await channelTokenOf(db, conv.conversation_id);
  return { ok: true, data: { conversation_id: conv.conversation_id, channel_token: token } };
}

async function actionChatSend(db, env, me, other, body) {
  const p = msgParams(body);
  if (!MESSAGE_TYPES.includes(p.type)) return { error: "Tipo de mensaje inválido" };
  if ((p.type === "image" || p.type === "file") && p.attachments.length === 0) {
    return { error: "El mensaje necesita un archivo adjunto" };
  }
  if (p.type === "text" && !p.content.trim()) return { error: "El mensaje no puede estar vacío" };

  const friend = await sonAmigos(db, me, other);
  if (!friend.ok) return { error: "Solo puedes chatear con tus amigos", status: 403 };

  let conv = await resolveConversationId(db, me, other);
  let newConversation = false;
  if (!conv.conversationId) {
    const made = await ensureConversation(db, me, other);
    if (!made.conversation_id) return { error: "No se pudo enviar el mensaje" };
    conv = { conversationId: made.conversation_id };
    newConversation = true;
  }
  const conversationId = conv.conversationId;

  const cleanAttachments = p.attachments
    .filter((a) => a && typeof a.storage_path === "string" && a.storage_path.startsWith(`chat/${conversationId}/`))
    .slice(0, 3)
    .map((a) => ({
      storage_path: String(a.storage_path).slice(0, 500),
      file_name: sanitizeFileName(a.file_name || ""),
      mime_type: String(a.mime_type || "application/octet-stream").slice(0, 120),
      file_size: Number(a.file_size) || 0,
    }));

  const cleanAcademic = p.academicItems.slice(0, 5).map((a) => ({
    item_type: a.item_type === "note" ? "note" : "assignment",
    subject_id: String(a.subject_id || "").slice(0, 200),
    assignment_id: a.assignment_id ? String(a.assignment_id).slice(0, 120) : null,
    note_id: a.note_id ? String(a.note_id).slice(0, 200) : null,
    item_payload: a.item_payload && typeof a.item_payload === "object" ? a.item_payload : {},
  }));

  const id = p.messageId || newMessageId();
  const now = nowISO();

  await db
    .prepare("INSERT INTO messages (id, conversation_id, sender, message_type, content, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, conversationId, me, p.type, p.content, 0, now)
    .run();

  for (const a of cleanAttachments) {
    await db
      .prepare("INSERT INTO message_attachments (id, message_id, storage_path, file_name, mime_type, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(uuid(), id, a.storage_path, a.file_name, a.mime_type, a.file_size, now)
      .run();
  }
  for (const a of cleanAcademic) {
    await db
      .prepare("INSERT INTO message_academic_items (id, message_id, item_type, subject_id, assignment_id, note_id, item_payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(uuid(), id, a.item_type, a.subject_id, a.assignment_id, a.note_id, jstringify(a.item_payload), now)
      .run();
  }

  await db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").bind(now, conversationId).run();
  await db.prepare("UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND username = ?").bind(now, conversationId, me).run();
  await db.prepare("UPDATE conversation_members SET hidden_at = NULL WHERE conversation_id = ? AND username = ?").bind(conversationId, me).run();

  const token = await channelTokenOf(db, conversationId);
  return {
    ok: true,
    data: {
      message_id: id,
      conversation_id: conversationId,
      channel_token: token,
      created_at: now,
      new_conversation: newConversation,
      message: { id, sender: me, message_type: p.type, content: p.content, read: 0, created_at: now },
    },
  };
}

async function actionChatRead(db, me, other) {
  const resolved = await resolveConversationId(db, me, other);
  if (!resolved.conversationId) return { ok: true };
  const conversationId = resolved.conversationId;

  await db
    .prepare("UPDATE messages SET read = 1 WHERE conversation_id = ? AND sender <> ? AND read = 0")
    .bind(conversationId, me)
    .run();
  await db
    .prepare("UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND username = ?")
    .bind(nowISO(), conversationId, me)
    .run();
  return { ok: true };
}

async function actionChatPin(db, me, other, body) {
  const resolved = await resolveConversationId(db, me, other);
  if (!resolved.conversationId) return { ok: true, data: { pinned: false } };

  const pinned = !!body.pinned;
  await db
    .prepare("UPDATE conversation_members SET pinned_at = ? WHERE conversation_id = ? AND username = ?")
    .bind(pinned ? nowISO() : null, resolved.conversationId, me)
    .run();
  return { ok: true, data: { pinned } };
}

async function actionChatClear(db, me, other) {
  const resolved = await resolveConversationId(db, me, other);
  if (!resolved.conversationId) return { ok: true };

  const now = nowISO();
  await db
    .prepare("UPDATE conversation_members SET cleared_at = ?, last_read_at = ? WHERE conversation_id = ? AND username = ?")
    .bind(now, now, resolved.conversationId, me)
    .run();
  return { ok: true };
}

async function actionChatDelete(db, me, other) {
  const resolved = await resolveConversationId(db, me, other);
  if (!resolved.conversationId) return { ok: true };

  const now = nowISO();
  await db
    .prepare("UPDATE conversation_members SET cleared_at = ?, hidden_at = ?, pinned_at = NULL, last_read_at = ? WHERE conversation_id = ? AND username = ?")
    .bind(now, now, now, resolved.conversationId, me)
    .run();
  return { ok: true };
}

async function actionChatUploadURL(db, env, me, other, body) {
  const friend = await sonAmigos(db, me, other);
  if (!friend.ok) return { error: "Solo puedes chatear con tus amigos", status: 403 };

  const fileSize = Number(body.file_size) || 0;
  if (fileSize > MAX_FILE_BYTES) return { error: "El archivo supera el límite de 8 MB" };
  if (!env.R2_BUCKET) return { error: "El almacenamiento de adjuntos no está configurado" };

  const conv = await ensureConversation(db, me, other);
  if (!conv.conversation_id) return { error: "No se pudo preparar la subida" };
  const conversationId = conv.conversation_id;

  const messageId = String(body.message_id || newMessageId()).slice(0, 64) || newMessageId();
  const fileName = sanitizeFileName(body.file_name || "archivo");
  const mime = String(body.mime_type || "application/octet-stream").slice(0, 120);
  const storagePath = `chat/${conversationId}/${messageId}/${fileName}`;

  const token = await signPath(env, storagePath, 6 * 60 * 60);
  const channel_token = await channelTokenOf(db, conversationId);

  return {
    ok: true,
    data: {
      conversation_id: conversationId,
      channel_token,
      message_id: messageId,
      storage_path: storagePath,
      upload_url: `/api/chat-upload?path=${encodeURIComponent(storagePath)}&token=${token}`,
      token,
      file_name: fileName,
      mime_type: mime,
    },
  };
}

export async function handler(c) {
  const req = vreq(c);
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });
  const me = await requireUser(c);
  if (!me) return json(c, 401, { error: "Sesión inválida" });
  const username = me.username;
  const db = c.env.DB;

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET") {
    const view = url.searchParams.get("view");
    const other = url.searchParams.get("other");

    if (view === "chat") {
      if (other) {
        const r = await handleChatThread(db, c.env, username, other);
        if (r.needsMigration) return json(c, 200, { data: [], needsMigration: true });
        if (r.error) return json(c, r.status || 500, { error: r.error });
        return json(c, 200, { data: r.data });
      }
      const r = await handleChatList(db, username);
      if (r.needsMigration) return json(c, 200, { data: [], needsMigration: true });
      return json(c, 200, { data: r.data || [] });
    }

    const res = await all(
      db
        .prepare("SELECT * FROM friendships WHERE user_username = ? OR friend_username = ?")
        .bind(username, username)
    );
    if (res.error) return json(c, 500, { error: "No se pudieron cargar las amistades" });
    const data = res.data || [];
    const map = {};
    for (const row of data) {
      const otherUser = row.user_username === username ? row.friend_username : row.user_username;
      map[otherUser] = { status: row.status, requestedBy: row.requested_by };
    }
    return json(c, 200, { data: map });
  }

  if (req.method === "POST") {
    const body = await readBody(c);
    const { action, other } = body;

    if (action === "chatOpen" || action === "chatSend" || action === "chatRead" || action === "chatUploadURL"
      || action === "chatPin" || action === "chatClear" || action === "chatDelete") {
      if (!other || typeof other !== "string") return json(c, 400, { error: "Falta el usuario" });
      if (other === username) return json(c, 400, { error: "No puedes chatear contigo mismo" });

      let r;
      if (action === "chatOpen") r = await actionChatOpen(db, c.env, username, other);
      else if (action === "chatSend") r = await actionChatSend(db, c.env, username, other, body);
      else if (action === "chatRead") r = await actionChatRead(db, username, other);
      else if (action === "chatPin") r = await actionChatPin(db, username, other, body);
      else if (action === "chatClear") r = await actionChatClear(db, username, other);
      else if (action === "chatDelete") r = await actionChatDelete(db, username, other);
      else r = await actionChatUploadURL(db, c.env, username, other, body);

      if (r.needsMigration) return json(c, 200, { ok: false, needsMigration: true, error: "Chat no disponible" });
      if (r.error) return json(c, r.status || 400, { error: r.error });
      return json(c, 200, r);
    }

    if (!other || typeof other !== "string") return json(c, 400, { error: "Falta el usuario" });
    if (other === username) return json(c, 400, { error: "No puedes ser tu propio amigo" });

    const [a, b] = canonicalPair(username, other);

    if (action === "request") {
      try {
        await db
          .prepare(
            "INSERT INTO friendships (user_username, friend_username, status, requested_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) " +
              "ON CONFLICT(user_username, friend_username) DO UPDATE SET status = excluded.status, requested_by = excluded.requested_by, updated_at = excluded.updated_at"
          )
          .bind(a, b, "pendiente", username, nowISO(), nowISO())
          .run();
        return json(c, 200, { ok: true });
      } catch (e) {
        return json(c, 500, { error: "No se pudo enviar la solicitud" });
      }
    }

    if (action === "accept") {
      try {
        await db
          .prepare("UPDATE friendships SET status = ?, updated_at = ? WHERE user_username = ? AND friend_username = ?")
          .bind("aceptado", nowISO(), a, b)
          .run();
        return json(c, 200, { ok: true });
      } catch (e) {
        return json(c, 500, { error: "No se pudo aceptar la solicitud" });
      }
    }

    if (action === "remove") {
      try {
        await db
          .prepare("DELETE FROM friendships WHERE user_username = ? AND friend_username = ?")
          .bind(a, b)
          .run();
        return json(c, 200, { ok: true });
      } catch (e) {
        return json(c, 500, { error: "No se pudo completar la acción" });
      }
    }

    return json(c, 400, { error: "Acción inválida" });
  }

  return json(c, 405, { error: "method" });
}