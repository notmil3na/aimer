import crypto from "node:crypto";
import { admin, envReady, json, readBody, requireUser, writesFrozen, maintenance } from "./_lib.mjs";

function canonicalPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

function isTableMissing(err) {
  if (!err) return false;
  const msg = String(err.message || err.hint || "");
  const code = String(err.code || "");
  return code === "42P01" || code === "PGRST205" || msg.includes("does not exist") || msg.includes("no existe");
}

function isColumnMissing(err) {
  if (!err) return false;
  const msg = String(err.message || err.hint || "");
  const code = String(err.code || "");
  return code === "42703" || (msg.includes("column") && (msg.includes("does not exist") || msg.includes("no existe")));
}

const CHAT_BUCKET = "chat-attachments";
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT = 8000;
const MAX_JSON = 32000;
const MESSAGE_TYPES = ["text", "image", "file", "assignment", "note"];

function newChannelToken() {
  return crypto.randomBytes(24).toString("hex");
}

function newMessageId() {
  return crypto.randomUUID();
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

async function sonAmigos(a, b) {
  const [x, y] = canonicalPair(a, b);
  const { data, error } = await admin
    .from("friendships")
    .select("*")
    .eq("user_username", x)
    .eq("friend_username", y)
    .maybeSingle();
  if (error) return { ok: false, tableMissing: isTableMissing(error) };
  return { ok: !!(data && data.status === "aceptado"), friendRow: data };
}

async function resolveConversationId(me, other) {
  const [a, b] = canonicalPair(me, other);
  const { data, error } = await admin
    .from("conversation_pairs")
    .select("conversation_id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (error) return { conversationId: null, tableMissing: isTableMissing(error) };
  return { conversationId: data ? data.conversation_id : null, tableMissing: false };
}

async function ensureConversation(me, other) {
  const [a, b] = canonicalPair(me, other);

  const existing = await resolveConversationId(me, other);
  if (existing.conversationId) return { conversation_id: existing.conversationId, error: null };
  if (existing.tableMissing) return { conversation_id: null, tableMissing: true, error: null };

  const now = new Date().toISOString();
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .insert({ channel_token: newChannelToken() })
    .select("id, channel_token")
    .single();
  if (convErr) return { conversation_id: null, tableMissing: isTableMissing(convErr), error: convErr };

  await admin.from("conversation_members").insert([
    { conversation_id: conv.id, username: a, last_read_at: now },
    { conversation_id: conv.id, username: b },
  ]);

  const { error: pairErr } = await admin
    .from("conversation_pairs")
    .insert({ conversation_id: conv.id, user_a: a, user_b: b });

  if (pairErr && pairErr.code === "23505") {
    await admin.from("conversation_members").delete().eq("conversation_id", conv.id);
    await admin.from("conversations").delete().eq("id", conv.id);
    const again = await resolveConversationId(me, other);
    if (again.conversationId) return { conversation_id: again.conversationId, error: null };
    return { conversation_id: null, error: pairErr };
  }
  if (pairErr) return { conversation_id: null, tableMissing: isTableMissing(pairErr), error: pairErr };

  return { conversation_id: conv.id, error: null };
}

async function membersOf(conversationId) {
  const { data, error } = await admin
    .from("conversation_members")
    .select("*")
    .eq("conversation_id", conversationId);
  if (error) return { members: [], error };
  return { members: data || [], error: null };
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

async function usersInfo(usernames) {
  const uniq = [...new Set(usernames)];
  if (uniq.length === 0) return {};
  const { data, error } = await admin
    .from("users")
    .select("username, name, university, career, semester, photo")
    .in("username", uniq);
  if (error) return {};
  const map = {};
  (data || []).forEach((u) => { map[u.username] = userPublicInfo(u); });
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

async function signedUrlFor(absPath) {
  if (!absPath) return { url: null, name: "" };
  const { data, error } = await admin.storage.from(CHAT_BUCKET).createSignedUrl(absPath, 6 * 60 * 60);
  if (error || !data) return { url: null, name: "" };
  const parts = String(absPath).split("/").pop() || "";
  return { url: data.signedUrl, name: parts };
}

async function handleChatList(me) {
  const { data: mine, error: mineErr } = await admin
    .from("conversation_members")
    .select("*")
    .eq("username", me);
  if (mineErr) return { needsMigration: isTableMissing(mineErr) };
  const myConvs = mine || [];
  const convIds = myConvs.map((c) => c.conversation_id);
  if (convIds.length === 0) return { data: [] };

  const clearedByConv = {};
  const hiddenByConv = {};
  const pinnedByConv = {};
  for (const c of myConvs) {
    if (c.cleared_at) clearedByConv[c.conversation_id] = new Date(c.cleared_at).getTime();
    if (c.hidden_at) hiddenByConv[c.conversation_id] = new Date(c.hidden_at).getTime();
    pinnedByConv[c.conversation_id] = !!c.pinned_at;
  }

  const { data: convRows, error: convsErr } = await admin
    .from("conversations")
    .select("id, channel_token, updated_at")
    .in("id", convIds);
  if (convsErr) return { needsMigration: isTableMissing(convsErr) };
  const convMap = {};
  (convRows || []).forEach((c) => { convMap[c.id] = c; });

  const { data: memberRows, error: membersErr } = await admin
    .from("conversation_members")
    .select("conversation_id, username")
    .in("conversation_id", convIds);
  if (membersErr) return { needsMigration: isTableMissing(membersErr) };
  const partnerByConv = {};
  const partnerUsernames = [];
  (memberRows || []).forEach((m) => {
    if (m.username === me) return;
    partnerByConv[m.conversation_id] = m.username;
    partnerUsernames.push(m.username);
  });

  const { data: msgRows, error: msgsErr } = await admin
    .from("messages")
    .select("id, conversation_id, sender, message_type, content, read, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false });
  if (msgsErr) return { needsMigration: isTableMissing(msgsErr) };

  const lastByConv = {};
  const unreadByConv = {};
  const visibleAfterHidden = new Set();
  for (const m of msgRows || []) {
    const createdMs = new Date(m.created_at).getTime();
    const clearedMs = clearedByConv[m.conversation_id];
    if (clearedMs && createdMs <= clearedMs) continue;
    const hiddenMs = hiddenByConv[m.conversation_id];
    if (hiddenMs && createdMs > hiddenMs) visibleAfterHidden.add(m.conversation_id);
    if (lastByConv[m.conversation_id] === undefined) lastByConv[m.conversation_id] = m;
    if (m.sender !== me && !m.read) unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id] || 0) + 1;
  }

  const info = await usersInfo(partnerUsernames);

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

async function handleChatThread(me, other) {
  const friend = await sonAmigos(me, other);
  if (friend.tableMissing) return { needsMigration: true };
  if (!friend.ok) return { error: "Solo puedes chatear con tus amigos", status: 403 };

  const resolved = await resolveConversationId(me, other);
  if (resolved.tableMissing) return { needsMigration: true };
  if (!resolved.conversationId) {
    return {
      data: { conversation_id: null, channel_token: null, participants: [], messages: [] },
    };
  }
  const conversationId = resolved.conversationId;

  const { members, error: membErr } = await membersOf(conversationId);
  if (membErr) return { needsMigration: isTableMissing(membErr) };
  const usernames = members.map((m) => m.username);
  if (!usernames.includes(me)) return { error: "No tienes acceso a esta conversación", status: 403 };

  const myMember = members.find((m) => m.username === me) || {};
  const clearedMs = myMember.cleared_at ? new Date(myMember.cleared_at).getTime() : 0;

  const { data: msgs, error: msgsErr } = await admin
    .from("messages")
    .select("id, sender, message_type, content, read, created_at, deleted_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (msgsErr) return { needsMigration: isTableMissing(msgsErr) };

  const visible = (msgs || []).filter(
    (m) => !m.deleted_at && (!clearedMs || new Date(m.created_at).getTime() > clearedMs)
  );
  const ids = visible.map((m) => m.id);

  let attachments = [];
  if (ids.length) {
    const { data: att, error: attErr } = await admin
      .from("message_attachments")
      .select("*")
      .in("message_id", ids)
      .order("created_at", { ascending: true });
    if (!attErr) attachments = att || [];
  }
  let academicItems = [];
  if (ids.length) {
    const { data: ai, error: aiErr } = await admin
      .from("message_academic_items")
      .select("*")
      .in("message_id", ids)
      .order("created_at", { ascending: true });
    if (!aiErr) academicItems = ai || [];
  }

  const attByMsg = {};
  const signedUrls = {};
  for (const att of attachments || []) {
    attByMsg[att.message_id] = att;
    const s = await signedUrlFor(att.storage_path);
    signedUrls[att.message_id] = { ...s, mime_type: att.mime_type, file_size: att.file_size, file_name: att.file_name || s.name };
  }
  const aiByMsg = {};
  for (const item of academicItems || []) aiByMsg[item.message_id] = item;

  const { data: convRow } = await admin
    .from("conversations")
    .select("channel_token")
    .eq("id", conversationId)
    .single();

  const info = await usersInfo(usernames);

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
      read: m.read,
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
      channel_token: convRow ? convRow.channel_token : "",
      participants,
      messages,
    },
  };
}

async function actionChatOpen(me, other) {
  const friend = await sonAmigos(me, other);
  if (friend.tableMissing) return { needsMigration: true };
  if (!friend.ok) return { error: "Solo puedes chatear con tus amigos", status: 403 };

  const conv = await ensureConversation(me, other);
  if (conv.tableMissing) return { needsMigration: true };
  if (!conv.conversation_id) return { error: "No se pudo abrir la conversación" };

  const { data: convRow } = await admin
    .from("conversations")
    .select("channel_token")
    .eq("id", conv.conversation_id)
    .single();

  return { ok: true, data: { conversation_id: conv.conversation_id, channel_token: convRow ? convRow.channel_token : "" } };
}

async function actionChatSend(me, other, body) {
  const p = msgParams(body);
  if (!MESSAGE_TYPES.includes(p.type)) return { error: "Tipo de mensaje inválido" };
  if (!p.content && p.type === "text") return { error: "El mensaje no puede estar vacío" };
  if ((p.type === "image" || p.type === "file") && p.attachments.length === 0) {
    return { error: "El mensaje necesita un archivo adjunto" };
  }
  if (p.type === "text" && !p.content.trim()) return { error: "El mensaje no puede estar vacío" };

  const friend = await sonAmigos(me, other);
  if (friend.tableMissing) return { needsMigration: true };
  if (!friend.ok) return { error: "Solo puedes chatear con tus amigos", status: 403 };

  let conv = await resolveConversationId(me, other);
  if (conv.tableMissing) return { needsMigration: true };
  let newConversation = false;
  if (!conv.conversationId) {
    const made = await ensureConversation(me, other);
    if (made.tableMissing) return { needsMigration: true };
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
  const now = new Date().toISOString();

  const { data: inserted, error: msgErr } = await admin
    .from("messages")
    .insert({
      id,
      conversation_id: conversationId,
      sender: me,
      message_type: p.type,
      content: p.content,
      read: false,
      created_at: now,
    })
    .select("id, sender, message_type, content, read, created_at");
  if (msgErr) return { error: "No se pudo guardar el mensaje" };

  if (cleanAttachments.length) {
    const { error: attErr } = await admin
      .from("message_attachments")
      .insert(cleanAttachments.map((a) => ({ message_id: id, ...a })));
    if (attErr) return { error: "No se pudieron guardar los adjuntos" };
  }
  if (cleanAcademic.length) {
    const { error: aiErr } = await admin
      .from("message_academic_items")
      .insert(cleanAcademic.map((a) => ({ message_id: id, ...a })));
    if (aiErr) return { error: "No se pudo guardar el contenido" };
  }

  await admin.from("conversations").update({ updated_at: now }).eq("id", conversationId);
  await admin.from("conversation_members").update({ last_read_at: now }).eq("conversation_id", conversationId).eq("username", me);
  await admin.from("conversation_members").update({ hidden_at: null }).eq("conversation_id", conversationId).eq("username", me);

  const { data: convRow } = await admin
    .from("conversations")
    .select("channel_token")
    .eq("id", conversationId)
    .single();

  return {
    ok: true,
    data: {
      message_id: id,
      conversation_id: conversationId,
      channel_token: convRow ? convRow.channel_token : "",
      created_at: now,
      new_conversation: newConversation,
      message: inserted ? inserted[0] : null,
    },
  };
}

async function actionChatRead(me, other) {
  const resolved = await resolveConversationId(me, other);
  if (resolved.tableMissing) return { needsMigration: true };
  if (!resolved.conversationId) return { ok: true };
  const conversationId = resolved.conversationId;

  await admin
    .from("messages")
    .update({ read: true })
    .eq("conversation_id", conversationId)
    .neq("sender", me)
    .eq("read", false);
  await admin
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("username", me);
  return { ok: true };
}

async function actionChatPin(me, other, body) {
  const resolved = await resolveConversationId(me, other);
  if (resolved.tableMissing) return { needsMigration: true };
  if (!resolved.conversationId) return { ok: true, data: { pinned: false } };

  const pinned = !!body.pinned;
  const { error } = await admin
    .from("conversation_members")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("conversation_id", resolved.conversationId)
    .eq("username", me);
  if (error) {
    if (isColumnMissing(error)) return { needsMigration: true };
    return { error: "No se pudo fijar el chat" };
  }
  return { ok: true, data: { pinned } };
}

async function actionChatClear(me, other) {
  const resolved = await resolveConversationId(me, other);
  if (resolved.tableMissing) return { needsMigration: true };
  if (!resolved.conversationId) return { ok: true };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("conversation_members")
    .update({ cleared_at: now, last_read_at: now })
    .eq("conversation_id", resolved.conversationId)
    .eq("username", me);
  if (error) {
    if (isColumnMissing(error)) return { needsMigration: true };
    return { error: "No se pudo vaciar el chat" };
  }
  return { ok: true };
}

async function actionChatDelete(me, other) {
  const resolved = await resolveConversationId(me, other);
  if (resolved.tableMissing) return { needsMigration: true };
  if (!resolved.conversationId) return { ok: true };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("conversation_members")
    .update({ cleared_at: now, hidden_at: now, pinned_at: null, last_read_at: now })
    .eq("conversation_id", resolved.conversationId)
    .eq("username", me);
  if (error) {
    if (isColumnMissing(error)) return { needsMigration: true };
    return { error: "No se pudo eliminar el chat" };
  }
  return { ok: true };
}

async function actionChatUploadURL(me, other, body) {
  const friend = await sonAmigos(me, other);
  if (friend.tableMissing) return { needsMigration: true };
  if (!friend.ok) return { error: "Solo puedes chatear con tus amigos", status: 403 };

  const fileSize = Number(body.file_size) || 0;
  if (fileSize > MAX_FILE_BYTES) return { error: "El archivo supera el límite de 8 MB" };

  const conv = await ensureConversation(me, other);
  if (conv.tableMissing) return { needsMigration: true };
  if (!conv.conversation_id) return { error: "No se pudo preparar la subida" };
  const conversationId = conv.conversation_id;

  const messageId = String(body.message_id || newMessageId()).slice(0, 64) || newMessageId();
  const fileName = sanitizeFileName(body.file_name || "archivo");
  const mime = String(body.mime_type || "application/octet-stream").slice(0, 120);
  const storagePath = `chat/${conversationId}/${messageId}/${fileName}`;

  const { error: bucketErr } = await admin.storage.getBucket(CHAT_BUCKET);
  if (bucketErr) {
    const { error: createErr } = await admin.storage.createBucket(CHAT_BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_BYTES,
    });
    if (createErr && String(createErr.message || "").includes("already")) {
    } else if (createErr) {
      return { error: "No se pudo preparar el almacenamiento de adjuntos" };
    }
  }

  const { data: up, error: upErr } = await admin.storage
    .from(CHAT_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: true });
  if (upErr || !up) return { error: "No se pudo generar la URL de subida" };

  const { data: convRow } = await admin
    .from("conversations")
    .select("channel_token")
    .eq("id", conversationId)
    .single();

  return {
    ok: true,
    data: {
      conversation_id: conversationId,
      channel_token: convRow ? convRow.channel_token : "",
      message_id: messageId,
      storage_path: storagePath,
      upload_url: up.signedUrl,
      token: up.token,
      file_name: fileName,
      mime_type: mime,
    },
  };
}

export default async function handler(req, res) {
  if (writesFrozen(req)) return maintenance(res);
  if (!envReady() || !admin) return json(res, 500, { error: "Configuración del servidor incompleta" });
  const me = requireUser(req);
  if (!me) return json(res, 401, { error: "Sesión inválida" });
  const username = me.username;

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET") {
    const view = url.searchParams.get("view");
    const other = url.searchParams.get("other");

    if (view === "chat") {
      if (other) {
        const r = await handleChatThread(username, other);
        if (r.needsMigration) return json(res, 200, { data: [], needsMigration: true });
        if (r.error) return json(res, r.status || 500, { error: r.error });
        return json(res, 200, { data: r.data });
      }
      const r = await handleChatList(username);
      if (r.needsMigration) return json(res, 200, { data: [], needsMigration: true });
      return json(res, 200, { data: r.data || [] });
    }

    const { data, error } = await admin
      .from("friendships")
      .select("*")
      .or(`user_username.eq.${username},friend_username.eq.${username}`);
    if (error) return json(res, 500, { error: "No se pudieron cargar las amistades" });

    const map = {};
    for (const row of data || []) {
      const otherUser = row.user_username === username ? row.friend_username : row.user_username;
      map[otherUser] = { status: row.status, requestedBy: row.requested_by };
    }
    return json(res, 200, { data: map });
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const { action, other } = body;

    if (action === "chatOpen" || action === "chatSend" || action === "chatRead" || action === "chatUploadURL"
      || action === "chatPin" || action === "chatClear" || action === "chatDelete") {
      if (!other || typeof other !== "string") return json(res, 400, { error: "Falta el usuario" });
      if (other === username) return json(res, 400, { error: "No puedes chatear contigo mismo" });

      let r;
      if (action === "chatOpen") r = await actionChatOpen(username, other);
      else if (action === "chatSend") r = await actionChatSend(username, other, body);
      else if (action === "chatRead") r = await actionChatRead(username, other);
      else if (action === "chatPin") r = await actionChatPin(username, other, body);
      else if (action === "chatClear") r = await actionChatClear(username, other);
      else if (action === "chatDelete") r = await actionChatDelete(username, other);
      else r = await actionChatUploadURL(username, other, body);

      if (r.needsMigration) return json(res, 200, { ok: false, needsMigration: true, error: "Chat no disponible" });
      if (r.error) return json(res, r.status || 400, { error: r.error });
      return json(res, 200, r);
    }

    if (!other || typeof other !== "string") return json(res, 400, { error: "Falta el usuario" });
    if (other === username) return json(res, 400, { error: "No puedes ser tu propio amigo" });

    const [a, b] = canonicalPair(username, other);

    if (action === "request") {
      const { error } = await admin
        .from("friendships")
        .upsert(
          { user_username: a, friend_username: b, status: "pendiente", requested_by: username },
          { onConflict: "user_username,friend_username" }
        );
      if (error) return json(res, 500, { error: "No se pudo enviar la solicitud" });
      return json(res, 200, { ok: true });
    }

    if (action === "accept") {
      const { error } = await admin
        .from("friendships")
        .update({ status: "aceptado", updated_at: new Date().toISOString() })
        .eq("user_username", a)
        .eq("friend_username", b);
      if (error) return json(res, 500, { error: "No se pudo aceptar la solicitud" });
      return json(res, 200, { ok: true });
    }

    if (action === "remove") {
      const { error } = await admin
        .from("friendships")
        .delete()
        .eq("user_username", a)
        .eq("friend_username", b);
      if (error) return json(res, 500, { error: "No se pudo completar la acción" });
      return json(res, 200, { ok: true });
    }

    return json(res, 400, { error: "Acción inválida" });
  }

  return json(res, 405, { error: "method" });
}