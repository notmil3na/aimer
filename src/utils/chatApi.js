import { api } from "../api";


export async function fetchChatOverview() {
  try {
    const res = await api("/friendships?view=chat", { soft401: true });
    if (res && res.needsMigration) return { needsMigration: true, data: [] };
    return { needsMigration: false, data: res?.data || [] };
  } catch (err) {
    if (err && err.needsMigration) return { needsMigration: true, data: [] };
    return { needsMigration: false, data: [] };
  }
}

export async function fetchThread(other) {
  try {
    const res = await api(`/friendships?view=chat&other=${encodeURIComponent(other)}`, { soft401: true });
    if (res && res.needsMigration) return { needsMigration: true, data: null };
    return { needsMigration: false, data: res?.data || null };
  } catch (err) {
    if (err && err.needsMigration) return { needsMigration: true, data: null };
    return { needsMigration: false, data: null };
  }
}

export async function openConversation(other) {
  try {
    const res = await api("/friendships", { method: "POST", body: { action: "chatOpen", other } });
    if (res && res.needsMigration) return { ok: false, needsMigration: true, data: null, error: "Chat no disponible" };
    return { ok: !!(res && res.ok), needsMigration: false, data: res?.data || null, error: res?.error || null };
  } catch (err) {
    if (err && err.needsMigration) return { ok: false, needsMigration: true, data: null, error: "Chat no disponible" };
    return { ok: false, needsMigration: false, data: null, error: (err && err.message) || "No se pudo abrir la conversación" };
  }
}

export async function sendChatMessage(other, body) {
  try {
    const res = await api("/friendships", { method: "POST", body: { action: "chatSend", other, ...body } });
    if (res && res.needsMigration) return { ok: false, needsMigration: true, data: null, error: "Chat no disponible" };
    return { ok: !!(res && res.ok), needsMigration: false, data: res?.data || null, error: res?.error || null };
  } catch (err) {
    if (err && err.needsMigration) return { ok: false, needsMigration: true, data: null, error: "Chat no disponible" };
    return { ok: false, needsMigration: false, data: null, error: (err && err.message) || "No se pudo enviar el mensaje" };
  }
}

export async function markThreadRead(other) {
  try {
    await api("/friendships", { method: "POST", body: { action: "chatRead", other }, soft401: true });
    return true;
  } catch (_) {
    return false;
  }
}

export async function pinChat(other, pinned) {
  try {
    const res = await api("/friendships", { method: "POST", body: { action: "chatPin", other, pinned } });
    if (res && res.needsMigration) return { ok: false, needsMigration: true, error: "Chat no disponible" };
    return { ok: !!(res && res.ok), needsMigration: false, error: res?.error || null };
  } catch (err) {
    if (err && err.needsMigration) return { ok: false, needsMigration: true, error: "Chat no disponible" };
    return { ok: false, needsMigration: false, error: (err && err.message) || "No se pudo fijar el chat" };
  }
}

export async function clearChatThread(other) {
  try {
    const res = await api("/friendships", { method: "POST", body: { action: "chatClear", other } });
    if (res && res.needsMigration) return { ok: false, needsMigration: true, error: "Chat no disponible" };
    return { ok: !!(res && res.ok), needsMigration: false, error: res?.error || null };
  } catch (err) {
    if (err && err.needsMigration) return { ok: false, needsMigration: true, error: "Chat no disponible" };
    return { ok: false, needsMigration: false, error: (err && err.message) || "No se pudo vaciar el chat" };
  }
}

export async function deleteChatThread(other) {
  try {
    const res = await api("/friendships", { method: "POST", body: { action: "chatDelete", other } });
    if (res && res.needsMigration) return { ok: false, needsMigration: true, error: "Chat no disponible" };
    return { ok: !!(res && res.ok), needsMigration: false, error: res?.error || null };
  } catch (err) {
    if (err && err.needsMigration) return { ok: false, needsMigration: true, error: "Chat no disponible" };
    return { ok: false, needsMigration: false, error: (err && err.message) || "No se pudo eliminar el chat" };
  }
}

export async function getChatUploadUrl(other, meta) {
  try {
    const res = await api("/friendships", { method: "POST", body: { action: "chatUploadURL", other, ...meta } });
    if (res && res.needsMigration) return { ok: false, needsMigration: true, data: null, error: "Chat no disponible" };
    return { ok: !!(res && res.ok), needsMigration: false, data: res?.data || null, error: res?.error || null };
  } catch (err) {
    if (err && err.needsMigration) return { ok: false, needsMigration: true, data: null, error: "Chat no disponible" };
    return { ok: false, needsMigration: false, data: null, error: (err && err.message) || "No se pudo preparar la subida" };
  }
}
