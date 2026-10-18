import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import styles from "./ChatView.module.css";
import {
  IconSend, IconPaperclip, IconArrowLeft, IconDownload,
  IconClipboard, IconImage, IconUser, IconSparkle, IconCheck, IconClose, IconSearch,
  IconPin, IconEraser, IconTrash,
} from "./Icons";
import { usePhoto } from "../utils/photo";
import { fetchFriendships, fetchUsersBrief } from "../utils/friendsApi";
import {
  fetchChatOverview, fetchThread, openConversation, sendChatMessage,
  markThreadRead, getChatUploadUrl, pinChat, clearChatThread, deleteChatThread,
} from "../utils/chatApi";
import { createConversationStream } from "../utils/chatRealtime";
import {
  buildAssignmentPayload, buildNotePayload, assignmentToAddable, noteToAddable,
  compressImageForChat, dataUrlToBlob, fmtTimeFull, fmtFecha,
  subjectName,
} from "../utils/chatShare";
import { uuid } from "../utils/notasClase";

const POLL_ACTIVE_MS = 15000; // con el broadcast caído: red de seguridad a 15 s
const POLL_IDLE_MS = 90000;   // con el broadcast conectado: red de seguridad a 90 s
const POLL_LIST_MS = 60000;   // lista de chats (no tiene broadcast)

// consulta solo con la pestaña visible y refresca al volver a ella
function usePollingWhileVisible(fn, delay) {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    let timer = null;
    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      timer = setTimeout(async () => {
        await fn();
        schedule();
      }, delay);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fn();
        schedule();
      } else {
        clearTimeout(timer);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fn, delay]);
}


function Avatar({ u, size = 40 }) {
  const username = (u && u.username) || "";
  const initial = (((u && (u.name || username)) || "?").trim()[0] || "?").toUpperCase();
  const photo = usePhoto(username, !!(u && u.hasPhoto));
  const style = { width: size, height: size };
  if (photo) {
    return (
      <div className={styles.avatar} style={style}>
        <img src={photo} alt="" className={styles.avatarImg} />
      </div>
    );
  }
  return (
    <div className={styles.avatar} style={style}>
      <span>{initial}</span>
    </div>
  );
}

function ChatMenu({ x, y, pinned, onPin, onClear, onDelete, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (left + rect.width > vw - 8) left = Math.max(8, vw - rect.width - 8);
    if (top + rect.height > vh - 8) top = Math.max(8, vh - rect.height - 8);
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <>
      <div className={styles.menuBackdrop} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div ref={ref} className={styles.chatMenu} style={pos} onClick={(e) => e.stopPropagation()}>
        <button className={styles.chatMenuItem} onClick={onPin}>
          <IconPin size={15} /> {pinned ? "Desfijar chat" : "Fijar chat"}
        </button>
        <button className={styles.chatMenuItem} onClick={onClear}>
          <IconEraser size={15} /> Vaciar chat
        </button>
        <div className={styles.chatMenuDivider} />
        <button className={`${styles.chatMenuItem} ${styles.chatMenuItemDanger}`} onClick={onDelete}>
          <IconTrash size={15} /> Eliminar chat
        </button>
      </div>
    </>
  );
}

function AssignmentCard({ msg, mine, onAdd }) {
  const p = msg.payload || {};
  const item = p.item || {};
  const due = item.fechaExamen || item.fechaEntrega || item.fechaFin;
  return (
    <div className={styles.academicCard}>
      <div className={styles.academicHead}>
        <span className={styles.academicTag}><IconClipboard size={12} /> Asignación</span>
        <span className={styles.academicSubject}>{p.subjectName || subjectName(undefined, p.subjectId)}</span>
      </div>
      <div className={styles.academicTitle}>{item.titulo || "Sin título"}</div>
      <div className={styles.academicMeta}>
        {item.tipo && <span className={styles.academicChip}>{item.tipo}</span>}
        {due && <span className={styles.academicChip}>Vence {fmtFecha(due)}</span>}
        {item.valoracion && <span className={styles.academicChip}>{item.valoracion} pts</span>}
      </div>
      {!mine && onAdd && (
        <button className={styles.academicAdd} onClick={() => onAdd(p)}>
          <IconCheck size={13} /> Añadir a mis asignaciones
        </button>
      )}
    </div>
  );
}

function NoteCard({ msg, mine, onAdd }) {
  const p = msg.payload || {};
  const item = p.item || {};
  return (
    <div className={styles.academicCard}>
      <div className={styles.academicHead}>
        <span className={styles.academicTag}><IconSparkle size={12} /> Apunte</span>
        <span className={styles.academicSubject}>{p.subjectName || subjectName(undefined, p.subjectId)}</span>
      </div>
      <div className={styles.academicNoteWrap}>
        <span className={styles.academicNoteDate}>{item.fecha ? fmtFecha(item.fecha) : "Hoy"}</span>
        <span className={styles.academicNoteText}>{item.texto || "Sin texto"}</span>
      </div>
      {!mine && onAdd && (
        <button className={styles.academicAdd} onClick={() => onAdd(p)}>
          <IconCheck size={13} /> Añadir a mis apuntes
        </button>
      )}
    </div>
  );
}

function MessageBubble({ msg, mine, sender, onAddAssignment, onAddNote }) {
  const t = msg.message_type;
  const att = msg.attachment || {};
  const openAtt = () => {
    if (att.url) window.open(att.url, "_blank", "noopener");
  };

  return (
    <div className={`${styles.bubbleRow} ${mine ? styles.bubbleRowMine : ""}`}>
      {!mine && (
        <div className={styles.bubbleAvatar}>
          <Avatar u={sender} size={26} />
        </div>
      )}
      <div className={`${styles.bubble} ${mine ? styles.bubbleMine : ""}`}>
                {t === "text" && <div className={`${styles.bubbleText} selectable`}>{msg.content}</div>}

        {t === "image" && (
          <div className={styles.bubbleImgWrap}>
            {att.url ? (
              <img src={att.url} alt={att.file_name || "Imagen adjunta"} className={styles.bubbleImg} onClick={openAtt} />
            ) : (
              <div className={styles.bubbleImgMissing}>Imagen no disponible</div>
            )}
            {att.file_name && <div className={styles.bubbleImgName}>{att.file_name}</div>}
          </div>
        )}

        {t === "file" && (
          <div className={styles.fileCard} onClick={openAtt}>
            <span className={styles.fileIcon}><IconPaperclip size={15} /></span>
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{att.file_name || "Archivo"}</span>
              {att.file_size ? <span className={styles.fileSize}>{(att.file_size / 1024).toFixed(0)} KB</span> : null}
            </div>
            <IconDownload size={14} className={styles.fileDl} />
          </div>
        )}

        {t === "assignment" && <AssignmentCard msg={msg} mine={mine} onAdd={onAddAssignment} />}

        {t === "note" && <NoteCard msg={msg} mine={mine} onAdd={onAddNote} />}

        <div className={`${styles.bubbleMeta} ${mine ? styles.bubbleMetaMine : ""}`}>
          {fmtTimeFull(msg.created_at)}
          {mine && <span className={`${styles.check} ${msg.read ? styles.checkRead : ""}`}>✓✓</span>}
        </div>
      </div>
      {mine && (
        <div className={styles.bubbleAvatar}>
          <Avatar u={sender} size={26} />
        </div>
      )}
    </div>
  );
}

function SharePopover({ open, onClose, myName, shareData, onSendShare, onPickImage, onPickFile, busy }) {
  const { malla, notasClaseData, asignacionesData } = shareData;
  const [tab, setTab] = useState("asignacion");
  const [subjectId, setSubjectId] = useState("");
  const [selected, setSelected] = useState(null);

  const assignmentItems = (asignacionesData && asignacionesData.items) || [];
  const assignmentSubjects = useMemo(() => {
    const set = new Set(assignmentItems.map((i) => i.materiaId).filter(Boolean));
    return [...set];
  }, [assignmentItems]);

  const noteSubjects = useMemo(() => Object.keys(notasClaseData || {}), [notasClaseData]);

  useEffect(() => {
    if (!open) return;
    setTab("asignacion");
    setSelected(null);
    setSubjectId(assignmentSubjects[0] || "");
  }, [open, assignmentSubjects]);

  const subjectsForTab = useMemo(
    () => (tab === "asignacion" ? assignmentSubjects : noteSubjects),
    [tab, assignmentSubjects, noteSubjects]
  );
  const validSubject = (s) => (tab === "asignacion" ? s === "" || subjectsForTab.includes(s) : subjectsForTab.includes(s));
  useEffect(() => {
    if (!open) return;
    if (!validSubject(subjectId)) {
      setSubjectId(subjectsForTab[0] || "");
      setSelected(null);
    }
  }, [open, tab, subjectId, subjectsForTab]);

  const currentItems = useMemo(() => {
    if (tab === "asignacion") return assignmentItems.filter((i) => !subjectId || i.materiaId === subjectId);
    return (notasClaseData && notasClaseData[subjectId]) || [];
  }, [tab, subjectId, assignmentItems, notasClaseData]);

  if (!open) return null;

  const send = () => {
    if (!selected || busy) return;
    let payload = null;
    if (tab === "asignacion") payload = buildAssignmentPayload(malla, selected, subjectId);
    else payload = buildNotePayload(malla, subjectId, selected);
    onSendShare(payload);
  };

  const subjects = subjectsForTab;

  return (
    <>
      <div className={styles.shareBackdrop} onClick={onClose} />
      <div className={styles.sharePopover}>
        <div className={styles.sharePopTitle}>Compartir con {myName}</div>

        <div className={styles.shareTabs}>
          <button className={`${styles.shareTab} ${tab === "asignacion" ? styles.shareTabActive : ""}`} onClick={() => { setTab("asignacion"); setSelected(null); }}>
            Asignación
          </button>
          <button className={`${styles.shareTab} ${tab === "note" ? styles.shareTabActive : ""}`} onClick={() => { setTab("note"); setSelected(null); }}>
            Apunte
          </button>
        </div>

        {subjects.length > 0 ? (
          <>
            <div className={styles.pickRow}>
              <select
                className={styles.pickSelect}
                value={subjectId}
                onChange={(e) => { setSubjectId(e.target.value); setSelected(null); }}
              >
                {(tab === "asignacion" ? ["", ...subjects] : subjects).map((s) => (
                  <option key={s || "todas"} value={s}>
                    {s === "" ? "Todas las materias" : subjectName(malla, s)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.pickList}>
              {currentItems.length === 0 ? (
                <div className={styles.pickEmpty}>No hay nada que compartir aquí todavía.</div>
              ) : (
                currentItems.map((it, i) => {
                  const key = tab === "asignacion" ? (it.id || i) : (it.id || `${it.fecha}-${i}`);
                  const isSel = selected === it;
                  return (
                    <button
                      key={key}
                      className={`${styles.pickItem} ${isSel ? styles.pickItemSel : ""}`}
                      onClick={() => setSelected(isSel ? null : it)}
                    >
                      <span className={styles.pickItemTxt}>
                        {tab === "asignacion"
                          ? (it.titulo || it.tipo || "Asignación")
                          : (it.texto || "Apunte")}
                      </span>
                      <span className={styles.pickItemDate}>
                        {tab === "asignacion"
                          ? fmtFecha(it.fechaExamen || it.fechaEntrega || it.fechaFin)
                          : fmtFecha(it.fecha)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <button className={styles.shareSend} onClick={send} disabled={!selected || busy}>
              {busy ? <span className={styles.busyDot} /> : <IconSend size={13} />} Enviar
            </button>
          </>
        ) : (
          <div className={styles.pickEmpty}>Crea asignaciones o apuntes antes de compartirlos.</div>
        )}

        <div className={styles.shareFiles}>
          <button className={styles.shareFileBtn} onClick={onPickImage} disabled={busy}>
            <IconImage size={15} /> Enviar imagen
          </button>
          <button className={styles.shareFileBtn} onClick={onPickFile} disabled={busy}>
            <IconPaperclip size={15} /> Adjuntar archivo
          </button>
        </div>
      </div>
    </>
  );
}

function ThreadView({ user, friend, onBack, onNotify, onToggleInfo, infoOpen, shareData, onSaveAsignaciones, onSaveNotasClase, onMessages }) {
  const { malla, notasClaseData, asignacionesData } = shareData;
  const me = user.username;
  const other = friend.username;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsMig, setNeedsMig] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [addingMsg, setAddingMsg] = useState(null);
  const [broadcastUp, setBroadcastUp] = useState(false);

  const scrollRef = useRef(null);
  const streamRef = useRef(null);
  const readGuardRef = useRef("");

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const messages = (data && data.messages) || [];
  const channelToken = (data && data.channel_token) || "";

  const notify = useCallback(
    (msg) => { if (onNotify) onNotify(msg); },
    [onNotify]
  );

  const refresh = useCallback(async () => {
    let res = await fetchThread(other);
    if (res.needsMigration) { setNeedsMig(true); setLoading(false); return; }
    if (res.data && res.data.conversation_id) {
      setData(res.data);
      setNeedsMig(false);
      if (onMessages) onMessages(res.data.messages || []);
    } else if (res.data && !res.data.conversation_id) {
      const opened = await openConversation(other);
      if (opened.needsMigration) { setNeedsMig(true); setLoading(false); return; }
      if (!opened.ok) { setError(opened.error || "No se pudo abrir la conversación"); setLoading(false); return; }
      const again = await fetchThread(other);
      if (again.data) { setData(again.data); if (onMessages) onMessages(again.data.messages || []); }
    }
    setLoading(false);
  }, [other, fetchThread, openConversation]);

  useEffect(() => {
    setData(null);
    setLoading(true);
    setError("");
    setInput("");
    refresh();
  }, [other, refresh]);

  // con el broadcast conectado se consulta cada 90 s; si cae, cada 15 s.
  // en ambos casos solo con la pestaña visible (y se refresca al volver).
  usePollingWhileVisible(refresh, broadcastUp ? POLL_IDLE_MS : POLL_ACTIVE_MS);

  useEffect(() => {
    if (!channelToken) { setBroadcastUp(false); return undefined; }
    const stream = createConversationStream(
      channelToken,
      () => refresh(),
      (status) => {
        const up = status === "SUBSCRIBED";
        setBroadcastUp(up);
        if (up) refresh();
      }
    );
    streamRef.current = stream;
    return () => { stream.close(); streamRef.current = null; setBroadcastUp(false); };
  }, [channelToken, refresh]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const root = document.documentElement;
    const onVpChange = () => {
      // alto que tapa el teclado; por debajo de 120px no es teclado (barras / safe-area) -> 0
      const covered = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--kb-inset", covered > 120 ? `${covered}px` : "0px");
      scrollToBottom();
    };
    onVpChange();
    vv.addEventListener("resize", onVpChange);
    vv.addEventListener("scroll", onVpChange);
    return () => {
      vv.removeEventListener("resize", onVpChange);
      vv.removeEventListener("scroll", onVpChange);
      root.style.removeProperty("--kb-inset");
    };
  }, [scrollToBottom]);

  useEffect(() => {
    const unread = messages.filter((m) => m.sender === other && !m.read);
    if (unread.length === 0) return;
    const key = unread.map((m) => m.id).join(",");
    if (readGuardRef.current === key) return;
    readGuardRef.current = key;
    markThreadRead(other).then(() => refresh());
  }, [messages, other, refresh]);

  const broadcastNew = (res) => {
    const tok = res && res.data && res.data.channel_token;
    if (tok && streamRef.current) {
      streamRef.current.send({ kind: "new", from: me });
    }
  };

  const sendText = async () => {
    const texto = input.trim();
    if (!texto || sending) return;
    setSending(true);
    setError("");
    const res = await sendChatMessage(other, { message_type: "text", content: texto });
    if (res.needsMigration) { setNeedsMig(true); setSending(false); return; }
    if (!res.ok) { setError(res.error || "No se pudo enviar el mensaje"); setSending(false); return; }
    setInput("");
    broadcastNew(res);
    setSending(false);
    refresh();
  };

  const uploadAndSend = async (file) => {
    if (!file || sending) return;
    setSending(true);
    setError("");
    let blob = file;
    let name = file.name || "archivo";
    let mime = file.type || "application/octet-stream";
    const isImage = mime.startsWith("image/");

    if (isImage) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
        reader.readAsDataURL(file);
      }).catch(() => null);
      if (!dataUrl) { setSending(false); return; }
      const comp = await compressImageForChat(dataUrl);
      blob = dataUrlToBlob(comp);
      name = (file.name.replace(/\.[^.]+$/, "") || "imagen") + ".jpg";
      mime = "image/jpeg";
    }

    const message_id = uuid();
    const up = await getChatUploadUrl(other, { message_id, file_name: name, mime_type: mime, file_size: blob.size });
    if (up.needsMigration) { setNeedsMig(true); setSending(false); return; }
    if (!up.ok || !up.data) { setError(up.error || "No se pudo preparar la subida"); setSending(false); return; }
    const d = up.data;
    try {
      const put = await fetch(d.upload_url, { method: "PUT", headers: { "Content-Type": mime }, body: blob });
      if (!put.ok) { setError("La subida del archivo falló"); setSending(false); return; }
    } catch (_) {
      setError("No hay conexión para subir el archivo");
      setSending(false);
      return;
    }
    const res = await sendChatMessage(other, {
      message_type: isImage ? "image" : "file",
      message_id,
      content: "",
      attachments: [{ storage_path: d.storage_path, file_name: d.file_name, mime_type: mime, file_size: blob.size }],
    });
    if (res.needsMigration) { setNeedsMig(true); setSending(false); return; }
    if (!res.ok) { setError(res.error || "No se pudo enviar el archivo"); setSending(false); return; }
    broadcastNew(res);
    setSending(false);
    refresh();
  };

  const sendShare = async (payload) => {
    if (!payload) return;
    await sendChatMessage(other, {
      message_type: payload.kind === "note" ? "note" : "assignment",
      content: JSON.stringify(payload),
      academic_items: [{
        item_type: payload.kind === "note" ? "note" : "assignment",
        subject_id: payload.subjectId || "",
        assignment_id: payload.kind === "assignment" && payload.item ? (payload.item.id || "") : "",
        note_id: payload.kind === "note" ? payload.subjectId : "",
        item_payload: payload.kind === "note"
          ? { texto: payload.item.texto || "", fecha: payload.item.fecha || "" }
          : { titulo: payload.item.titulo || "", tipo: payload.item.tipo || "" },
      }],
    });
  };

  const addAssignment = async (payload) => {
    if (addingMsg) return;
    setAddingMsg(payload.kind);
    try {
      const items = [...(((asignacionesData && asignacionesData.items) || []))];
      const nuevo = assignmentToAddable(payload);
      const dup = items.find(
        (i) => i.materiaId === nuevo.materiaId && (i.titulo || "") === (nuevo.titulo || "") && (i.fechaExamen || i.fechaEntrega || i.fechaFin) === (nuevo.fechaExamen || nuevo.fechaEntrega || nuevo.fechaFin)
      );
      if (dup) { notify("Ya tienes esa asignación en tu malla"); return; }
      await onSaveAsignaciones({ ...(asignacionesData || {}), items: [nuevo, ...items] });
      notify("Asignación añadida a tu malla");
    } finally {
      setAddingMsg(null);
    }
  };

  const addNote = async (payload) => {
    if (addingMsg) return;
    setAddingMsg(payload.kind);
    try {
      const key = payload.subjectId || "general";
      const lista = (notasClaseData && notasClaseData[key]) || [];
      const addable = noteToAddable(payload);
      const dup = lista.find((n) => n.texto === addable.texto && n.fecha === addable.fecha);
      if (dup) { notify("Ese apunte ya está guardado"); return; }
      await onSaveNotasClase({ ...(notasClaseData || {}), [key]: [addable, ...lista] });
      notify("Apunte añadido a tus notas de clase");
    } finally {
      setAddingMsg(null);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  if (needsMig) {
    return (
      <div className={styles.threadEmpty}>
        <span className={styles.threadEmptyIcon}><IconSparkle size={26} /></span>
        <p>El chat aún no está activado.</p>
        <p className={styles.threadEmptySub}>Aplica la migración del chat para empezar a usarlo.</p>
        <button className={styles.backToFriends} onClick={onBack}><IconArrowLeft size={14} /> Volver</button>
      </div>
    );
  }

  const adding = addingMsg;

  return (
    <div className={styles.thread}>
      <div className={styles.threadHeader}>
        <button className={styles.threadBack} onClick={onBack} title="Volver"><IconArrowLeft size={17} /></button>
        <Avatar u={friend} size={36} />
        <div className={styles.threadHeadInfo}>
          <span className={styles.threadName}>{friend.name || friend.username}</span>
          <span className={styles.threadStatus}>@{other}</span>
        </div>
        <button className={`${styles.infoToggle} ${infoOpen ? styles.infoToggleOn : ""}`} onClick={onToggleInfo} title="Detalles">
          <IconUser size={16} />
        </button>
      </div>

      <div className={styles.threadBody} ref={scrollRef}>
        {loading ? (
          <div className={styles.threadEmpty}><span className={styles.loadingSpinner} /> Cargando conversación…</div>
        ) : messages.length === 0 ? (
          <div className={styles.threadEmpty}>
            <span className={styles.threadEmptyIcon}><IconSparkle size={26} /></span>
            <p>Este es el inicio de tu conversación.</p>
            <p className={styles.threadEmptySub}>Saluda a {friend.name || "@" + other} y comparte asignaciones o apuntes.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              mine={msg.sender === me}
              sender={msg.sender === me ? user : friend}
              onAddAssignment={addAssignment}
              onAddNote={addNote}
            />
          ))
        )}
      </div>

      {error && <div className={styles.threadError}>{error}</div>}

      <div className={styles.composer}>
        <button
          className={styles.paperclip}
          onClick={() => setShareOpen((v) => !v)}
          title="Compartir o adjuntar"
          disabled={sending}
        >
          {sending ? <span className={styles.busyDot} /> : <IconPaperclip size={17} />}
        </button>
        <textarea
          className={styles.composerInput}
          rows={1}
          value={input}
          placeholder="Mensaje…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onFocus={scrollToBottom}
        />
        <button
          className={styles.sendBtn}
          onClick={sendText}
          disabled={!input.trim() || sending}
          title="Enviar"
        >
          <IconSend size={16} />
        </button>
      </div>

      <SharePopover
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        myName={friend.name || other}
        shareData={shareData}
        onSendShare={(p) => { setShareOpen(false); sendShare(p); }}
        onPickImage={() => { setShareOpen(false); const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = (e) => { const f = e.target.files && e.target.files[0]; if (f) uploadAndSend(f); }; inp.click(); }}
        onPickFile={() => { setShareOpen(false); const inp = document.createElement("input"); inp.type = "file"; inp.onchange = (e) => { const f = e.target.files && e.target.files[0]; if (f) uploadAndSend(f); }; inp.click(); }}
        busy={sending}
      />

      {adding && (
        <div className={styles.addingBadge}><IconCheck size={12} /> Guardando…</div>
      )}
    </div>
  );
}

function InfoPanel({ friend, messages, onClose }) {
  const shared = (messages || []).filter((m) => m.message_type === "image" || m.message_type === "file");
  const academic = (messages || []).filter((m) => m.message_type === "assignment" || m.message_type === "note");

  return (
    <div className={styles.infoPanel}>
      <div className={styles.infoHead}>
        <Avatar u={friend} size={52} />
        <div className={styles.infoName}>{friend.name || friend.username}</div>
        <div className={styles.infoUser}>@{friend.username}</div>
        <button className={styles.infoClose} onClick={onClose} title="Cerrar"><IconClose size={15} /></button>
      </div>

      <div className={styles.infoSection}>
        <span className={styles.infoSectionTitle}>Perfil</span>
        {friend.university ? (
          <div className={styles.infoRow}><b>Universidad</b><span>{friend.university}</span></div>
        ) : null}
        {friend.career ? (
          <div className={styles.infoRow}><b>Carrera</b><span>{friend.career}</span></div>
        ) : null}
        {friend.semester ? (
          <div className={styles.infoRow}><b>Semestre</b><span>{friend.semester}</span></div>
        ) : null}
      </div>

      <div className={styles.infoSection}>
        <span className={styles.infoSectionTitle}>Archivos compartidos</span>
        {shared.length === 0 ? (
          <div className={styles.infoEmpty}>Aún no comparten archivos.</div>
        ) : (
          shared.slice(0, 12).map((m) => (
            <button
              key={m.id}
              className={styles.infoFile}
              onClick={() => m.attachment && m.attachment.url && window.open(m.attachment.url, "_blank", "noopener")}
            >
              <span className={styles.infoFileIcon}>{m.message_type === "image" ? <IconImage size={14} /> : <IconPaperclip size={14} />}</span>
              <span className={styles.infoFileTxt}>
                <span className={styles.infoFileTitle}>{m.attachment && m.attachment.file_name ? m.attachment.file_name : (m.message_type === "image" ? "Imagen" : "Archivo")}</span>
                <span className={styles.infoFileDate}>{fmtTimeFull(m.created_at)}</span>
              </span>
            </button>
          ))
        )}
      </div>

      <div className={styles.infoSection}>
        <span className={styles.infoSectionTitle}>Contenido de la malla</span>
        {academic.length === 0 ? (
          <div className={styles.infoEmpty}>Las asignaciones y apuntes compartidos aparecerán aquí.</div>
        ) : (
          academic.slice(0, 12).map((m) => {
            const p = m.payload || {};
            return (
              <div key={m.id} className={styles.infoAcademic}>
                <span className={styles.infoAcademicType}>
                  {m.message_type === "assignment" ? "📋 Asignación" : "📒 Apunte"}
                </span>
                <span className={styles.infoAcademicTxt}>
                  {p.subjectName || (p.subjectId ? subjectName(undefined, p.subjectId) : "Malla")}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ChatView({ user, malla, notasClaseData, asignacionesData, onSaveAsignaciones, onSaveNotasClase, onNotify }) {
  const [users, setUsers] = useState([]);
  const [friendships, setFriendships] = useState({});
  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [needsMig, setNeedsMig] = useState(false);
  const [activeOther, setActiveOther] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [threadMessages, setThreadMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState(null);
  const [threadNonce, setThreadNonce] = useState(0);

  const pressRef = useRef({ timer: null, x: 0, y: 0 });
  const suppressClickRef = useRef(0);

  useEffect(() => () => clearTimeout(pressRef.current.timer), []);

  useEffect(() => {
    let active = true;
    fetchUsersBrief().then((res) => { if (active && !res.error) setUsers(res.data || []); }).catch(() => {});
    fetchFriendships(user.username).then((res) => { if (active && !res.error) setFriendships(res.data || {}); }).catch(() => {});
    return () => { active = false; };
  }, [user.username]);

  const loadOverview = useCallback(async () => {
    const res = await fetchChatOverview();
    if (res.needsMigration) { setNeedsMig(true); setLoading(false); return; }
    setNeedsMig(false);
    setOverview(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  usePollingWhileVisible(loadOverview, POLL_LIST_MS);

  const amigos = useMemo(
    () => (users || []).filter((u) => friendships[u.username] && friendships[u.username].status === "aceptado"),
    [users, friendships]
  );

  const overviewByPartner = useMemo(() => {
    const map = {};
    (overview || []).forEach((c) => { if (c.partner) map[c.partner] = c; });
    return map;
  }, [overview]);

  const list = useMemo(() => {
    const rows = amigos.map((u) => {
      const c = overviewByPartner[u.username];
      return {
        key: u.username,
        partner: u,
        conversation_id: c ? c.conversation_id : null,
        channel_token: c ? c.channel_token : "",
        last: c ? c.last : null,
        unread: c ? c.unread || 0 : 0,
        pinned: c ? !!c.pinned : false,
        updatedAt: c && c.last ? new Date(c.last.created_at).getTime() : 0,
      };
    });
    rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.unread !== b.unread) return b.unread - a.unread;
      if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
      return (a.partner.name || a.partner.username).localeCompare(b.partner.name || b.partner.username);
    });
    return rows;
  }, [amigos, overviewByPartner]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (row) =>
        (row.partner.name || "").toLowerCase().includes(q) ||
        (row.partner.username || "").toLowerCase().includes(q)
    );
  }, [list, search]);

  const activeFriend = amigos.find((u) => u.username === activeOther) || null;
  const totalUnread = list.reduce((a, r) => a + r.unread, 0);


  const previewOf = (row) => {
    if (!row.last) return "Inicia una conversación";
    const last = row.last;
    if (last.kind === "text") return last.label;
    if (last.kind === "image") return "📷 Foto";
    if (last.kind === "file") return "📎 Archivo";
    if (last.kind === "assignment") return "📋 Compartió una asignación";
    if (last.kind === "note") return "📒 Compartió un apunte";
    return "Mensaje";
  };

  const openMenu = (row, x, y) => {
    suppressClickRef.current = Date.now();
    setMenu({ key: row.key, x, y, pinned: !!row.pinned });
  };

  const startPress = (row, e) => {
    const t = e.touches ? e.touches[0] : e;
    pressRef.current.x = t.clientX;
    pressRef.current.y = t.clientY;
    clearTimeout(pressRef.current.timer);
    pressRef.current.timer = setTimeout(() => {
      openMenu(row, t.clientX, t.clientY);
    }, 480);
  };

  const movePress = (e) => {
    const t = e.touches ? e.touches[0] : e;
    const dx = Math.abs(t.clientX - pressRef.current.x);
    const dy = Math.abs(t.clientY - pressRef.current.y);
    if (dx > 10 || dy > 10) clearTimeout(pressRef.current.timer);
  };

  const endPress = () => clearTimeout(pressRef.current.timer);

  const rowClick = (row) => {
    if (Date.now() - suppressClickRef.current < 700) return;
    setActiveOther(row.key);
  };

  const handlePin = async () => {
    if (!menu) return;
    const key = menu.key;
    const nextPinned = !menu.pinned;
    setMenu(null);
    setOverview((prev) => (prev || []).map((c) => (c.partner === key ? { ...c, pinned: nextPinned } : c)));
    const res = await pinChat(key, nextPinned);
    if (res.needsMigration) { setNeedsMig(true); return; }
    if (!res.ok) { if (onNotify) onNotify(res.error || "No se pudo fijar el chat"); return; }
    loadOverview();
  };

  const handleClear = async () => {
    if (!menu) return;
    const key = menu.key;
    setMenu(null);
    const res = await clearChatThread(key);
    if (res.needsMigration) { setNeedsMig(true); return; }
    if (!res.ok) { if (onNotify) onNotify(res.error || "No se pudo vaciar el chat"); return; }
    if (onNotify) onNotify("Chat vaciado");
    setOverview((prev) => (prev || []).map((c) => (c.partner === key ? { ...c, last: null, unread: 0 } : c)));
    if (activeOther === key) setThreadNonce((n) => n + 1);
    loadOverview();
  };

  const handleDelete = async () => {
    if (!menu) return;
    const key = menu.key;
    setMenu(null);
    const res = await deleteChatThread(key);
    if (res.needsMigration) { setNeedsMig(true); return; }
    if (!res.ok) { if (onNotify) onNotify(res.error || "No se pudo eliminar el chat"); return; }
    if (onNotify) onNotify("Chat eliminado");
    setOverview((prev) => (prev || []).filter((c) => c.partner !== key));
    if (activeOther === key) { setActiveOther(null); setInfoOpen(false); setThreadMessages([]); }
    loadOverview();
  };

  return (
    <div className={`${styles.wrap} view-fade`}>
      <div
        className={`${styles.chatWrap} ${activeOther ? styles.hasActive : ""} ${infoOpen ? styles.hasInfo : ""}`}
      >
        {}
        <div className={styles.chatSidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitleRow}>
              <h2 className={styles.sidebarTitle}>Chats</h2>
              {totalUnread > 0 && (
                <span className={styles.headerBadge}>{totalUnread} sin leer</span>
              )}
            </div>
            <div className={styles.searchRow}>
              <IconSearch size={15} />
              <input
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Busca un chat…"
              />
              {search && (
                <button className={styles.searchClear} onClick={() => setSearch("")} title="Limpiar">
                  <IconClose size={12} />
                </button>
              )}
            </div>
          </div>
          {needsMig ? (
            <div className={styles.chatEmpty}>
              <span className={styles.threadEmptyIcon}><IconSparkle size={26} /></span>
              <p>El chat aún no está activado.</p>
              <p className={styles.threadEmptySub}>Aplica la migración del chat para empezar a usar esta función.</p>
            </div>
          ) : loading && list.length === 0 ? (
            <div className={styles.chatEmpty}><span className={styles.loadingSpinner} /> Cargando…</div>
          ) : amigos.length === 0 ? (
            <div className={styles.chatEmpty}>
              <span className={styles.threadEmptyIcon}><IconUser size={26} /></span>
              <p>Agrega amigos para chatear.</p>
              <p className={styles.threadEmptySub}>Solo puedes conversar con personas que ya son tus amigos.</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className={styles.chatEmpty}>
              <span className={styles.threadEmptyIcon}><IconSearch size={22} /></span>
              <p>Sin resultados para "{search.trim()}"</p>
            </div>
          ) : (
            <div className={styles.convList}>
              {filteredList.map((row) => (
                <button
                  key={row.key}
                  className={`${styles.convRow} ${activeOther === row.key ? styles.convRowActive : ""} ${row.pinned ? styles.convRowPinned : ""}`}
                  onClick={() => rowClick(row)}
                  onContextMenu={(e) => { e.preventDefault(); clearTimeout(pressRef.current.timer); openMenu(row, e.clientX, e.clientY); }}
                  onTouchStart={(e) => startPress(row, e)}
                  onTouchMove={movePress}
                  onTouchEnd={endPress}
                  onTouchCancel={endPress}
                >
                  <span className={styles.convAvatar}>
                    <Avatar u={row.partner} size={46} />
                    {row.unread > 0 && <span className={styles.convUnreadBadge}>{row.unread}</span>}
                  </span>
                  <span className={styles.convInfo}>
                    <span className={styles.convTop}>
                      <span className={styles.convNameWrap}>
                        {row.pinned && <IconPin size={12} className={styles.convPinIcon} />}
                        <span className={styles.convName}>{(row.partner.name || row.partner.username) + (row.unread > 0 ? " •" : "")}</span>
                      </span>
                      {row.last && <span className={styles.convTime}>{fmtTimeFull(row.last.created_at)}</span>}
                    </span>
                    <span className={styles.convPreview}>{previewOf(row)}</span>
                  </span>
                  <span className={styles.convChevron}>›</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {}
        <div className={styles.chatMain}>
          {activeOther && activeFriend ? (
            <ThreadView
              key={`${activeOther}-${threadNonce}`}
              user={user}
              friend={activeFriend}
              onBack={() => { setActiveOther(null); setInfoOpen(false); setThreadMessages([]); loadOverview(); }}
              onNotify={onNotify}
              onToggleInfo={() => setInfoOpen((v) => !v)}
              infoOpen={infoOpen}
              shareData={{ malla, notasClaseData, asignacionesData }}
              onSaveAsignaciones={onSaveAsignaciones}
              onSaveNotasClase={onSaveNotasClase}
              onMessages={setThreadMessages}
            />
          ) : (
            <div className={styles.threadPlaceholder}>
              <span className={styles.threadEmptyIcon}><IconSend size={30} /></span>
              <p>Selecciona un amigo</p>
              <p className={styles.threadEmptySub}>Elige a quién a la izquierda para iniciar el chat.</p>
            </div>
          )}
        </div>

        {}
        <div className={styles.chatInfo}>
          {activeOther && activeFriend && infoOpen ? (
            <InfoPanel
              friend={activeFriend}
              messages={threadMessages}
              onClose={() => setInfoOpen(false)}
            />
          ) : null}
        </div>
      </div>

      {menu && (
        <ChatMenu
          x={menu.x}
          y={menu.y}
          pinned={menu.pinned}
          onPin={handlePin}
          onClear={handleClear}
          onDelete={handleDelete}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}