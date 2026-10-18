import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  uuid, toISODate, DESTINO_LABEL, formatFecha,
  makeBlock, toBlocksFromNote, noteToTexto, BLOCK_TYPES,
  matchMarkdownShortcut,
} from "../utils/notasClase";
import {
  IconSparkle, IconTrash, IconCheck, IconPlus, IconSearch,
  IconClose, IconChevronLeft, IconChevronUp, IconChevronDown,
  IconSemester, IconGrip, IconDuplicate, IconStar,
} from "./Icons";
import styles from "./NotasClaseView.module.css";

const PLACEHOLDERS = {
  paragraph: "Escribe algo o presiona '/' para comandos…",
  heading: "Encabezado",
  heading3: "Subtítulo",
  todo: "Tarea",
  bulleted: "Elemento",
  numbered: "Elemento",
  callout: "Callout",
  quote: "Cita",
};


function placeCaretAtEnd(el) {
  if (!el) return;
  el.focus();
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function placeCaretAt(el, offset) {
  if (!el) return;
  el.focus();
  if (offset === "start") offset = 0;
  if (offset === "end" || offset == null) { placeCaretAtEnd(el); return; }
  const range = document.createRange();
  const sel = window.getSelection();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
  const node = walker.nextNode();
  if (node) {
    const length = node.length;
    const target = Math.min(Math.max(0, offset), length);
    range.setStart(node, target);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }
  range.selectNodeContents(el);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function getNumberedIndex(blocks, blockId) {
  let count = 0;
  for (const b of blocks) {
    if (b.type === "numbered") {
      count++;
      if (b.id === blockId) return count;
    } else {
      count = 0;
    }
  }
  return 1;
}

function computeSlashPos(rowEl) {
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = document.documentElement.clientHeight || window.innerHeight;

  let top;
  let left;
  const sel = window.getSelection();
  const caretRect = sel && sel.rangeCount > 0
    ? sel.getRangeAt(0).getBoundingClientRect()
    : null;

  if (caretRect && caretRect.height > 0) {
    top = caretRect.bottom + 6;
    left = caretRect.left + 2;
  } else {
    const rect = rowEl.getBoundingClientRect();
    top = rect.bottom + 6;
    left = rect.left + 12;
  }

  top = Math.max(8, Math.min(top, vh - 300));
  left = Math.max(12, Math.min(left, vw - 280));
  return { top, left };
}

function SlashMenu({ onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const filtered = useMemo(
    () => BLOCK_TYPES.filter(
      (bt) => bt.label.toLowerCase().includes(query.toLowerCase())
        || bt.desc.toLowerCase().includes(query.toLowerCase())
    ),
    [query]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
      else if (e.key === "Enter") {
        if (filtered.length > 0) { e.preventDefault(); onSelect(filtered[highlighted]); }
        else onClose();
      }
      else if (e.key.length === 1) { setQuery((q) => q + e.key); }
      else if (e.key === "Backspace") { setQuery((q) => q.slice(0, -1)); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [filtered, highlighted, onSelect, onClose]);

  if (filtered.length === 0) {
    return (
      <div className={styles.slashEmpty}>
        <span>Sin resultados para “{query}”</span>
        <button onClick={onClose} aria-label="Cerrar menú"><IconClose size={12} /></button>
      </div>
    );
  }

  return (
    <div className={styles.slashMenu}>
      <div className={styles.slashQuery}><span>Comandos</span><span>/</span></div>
      <div className={styles.slashList}>
        {filtered.map((bt, i) => (
          <button
            key={bt.type}
            className={`${styles.slashItem} ${i === highlighted ? styles.slashItemActive : ""}`}
            onMouseEnter={() => setHighlighted(i)}
            onClick={() => onSelect(bt)}
          >
            <span className={styles.slashItemIcon}>{bt.icon}</span>
            <span className={styles.slashItemText}>
              <span className={styles.slashItemLabel}>{bt.label}</span>
              <span className={styles.slashItemDesc}>{bt.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockMenu({ x, y, activeType, onConvert, onMoveUp, onMoveDown, onDuplicate, onDelete, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className={styles.blockMenu} style={{ top: y, left: x }} onClick={(e) => e.stopPropagation()}>
      <p className={styles.blockMenuLabel}>Convertir en</p>
      <div className={styles.blockMenuList}>
        {BLOCK_TYPES.map((bt) => (
          <button
            key={bt.type}
            className={`${styles.blockMenuItem} ${bt.type === activeType ? styles.blockMenuItemActive : ""}`}
            onClick={() => onConvert(bt.type)}
            aria-label={bt.label}
          >
            <span className={styles.blockMenuItemIcon}>{bt.icon}</span>
            <span>{bt.label}</span>
          </button>
        ))}
      </div>
      <div className={styles.blockMenuDivider} />
      <button className={styles.blockMenuAction} onClick={onMoveUp}><IconChevronUp size={13} /> Mover arriba</button>
      <button className={styles.blockMenuAction} onClick={onMoveDown}><IconChevronDown size={13} /> Mover abajo</button>
      <button className={styles.blockMenuAction} onClick={onDuplicate}><IconDuplicate size={13} /> Duplicar</button>
      <button className={`${styles.blockMenuAction} ${styles.blockMenuActionDanger}`} onClick={onDelete}>
        <IconTrash size={13} /> Eliminar
      </button>
    </div>
  );
}

function BlockRow({ block, blocks, isActive, focusHint, focusNonce, onFocus, onAddAfter, onToggleChecked, onDragStart, dragging }) {
  const ref = useRef();

  useEffect(() => {
    if (ref.current && ref.current.textContent !== block.content) {
      ref.current.textContent = block.content;
    }
  });

  useEffect(() => {
    if (!isActive || !ref.current) return;
    if (focusHint && focusHint.blockId === block.id) {
      placeCaretAt(ref.current, focusHint.offset);
    } else {
      placeCaretAtEnd(ref.current);
    }
  }, [isActive, focusNonce, focusHint?.nonce]);

  const typeClass = {
    paragraph: styles.typeParagraph,
    heading: styles.typeHeading,
    heading3: styles.typeHeading3,
    todo: styles.typeTodo,
    bulleted: styles.typeBulleted,
    numbered: styles.typeNumbered,
    callout: styles.typeCallout,
    quote: styles.typeQuote,
  }[block.type] || styles.typeParagraph;

  const isDivider = block.type === "divider";

  return (
    <div
      className={`${styles.blockRow} ${isActive ? styles.blockRowActive : ""} ${dragging ? styles.rowDragging : ""}`}
      data-block-id={block.id}
    >
      <div className={styles.blockControls}>
        <button
          className={styles.blockAddBtn}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAddAfter(block.id); }}
          title="Añadir bloque debajo"
          tabIndex={-1}
        >
          <IconPlus size={13} />
        </button>
        <button
          className={styles.blockHandleBtn}
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onDragStart(block.id, e); }}
          title="Arrastrar para mover · clic para opciones"
          aria-label="Opciones del bloque"
          tabIndex={-1}
        >
          <IconGrip size={12} />
        </button>
      </div>

      {block.type === "todo" && (
        <button
          className={`${styles.checkbox} ${block.checked ? styles.checkboxChecked : ""}`}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onToggleChecked(block.id); }}
          tabIndex={-1}
          aria-label={block.checked ? "Marcar como no hecha" : "Marcar como hecha"}
        >
          {block.checked && <IconCheck size={11} />}
        </button>
      )}

      {block.type === "bulleted" && <span className={styles.bulletMarker}>•</span>}
      {block.type === "numbered" && <span className={styles.numberMarker}>{getNumberedIndex(blocks, block.id)}</span>}
      {block.type === "callout" && <span className={styles.calloutEmoji} aria-hidden="true">✦</span>}

      {isDivider ? (
        <hr className={styles.dividerHr} />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          className={`${styles.blockContent} ${typeClass} ${block.checked ? styles.blockChecked : ""}`}
          data-placeholder={PLACEHOLDERS[block.type] || "…"}
          onFocus={() => onFocus(block.id)}
        />
      )}
    </div>
  );
}

export default function NotasClaseView({
  materiasAll, cursandoIds,
  notasClaseData, onSaveNotasClase,
}) {
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorBlocks, setEditorBlocks] = useState([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [mobileView, setMobileView] = useState("list");
  const [saved, setSaved] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const [menu, setMenu] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null);

  const blocksRef = useRef(null);
  const titleRef = useRef(null);
  const isLocalEdit = useRef(false);
  const saveTimerRef = useRef(null);
  const dragInfoRef = useRef({ moved: false, startX: 0, startY: 0, target: null, place: null });
  const editingRef = useRef(null);
  editingRef.current = editingNote;
  const titleStateRef = useRef(editorTitle);
  titleStateRef.current = editorTitle;
  const blocksStateRef = useRef(editorBlocks);
  blocksStateRef.current = editorBlocks;
  const focusHintRef = useRef(null);

  const materiasCursando = useMemo(
    () => (materiasAll || []).filter((m) => cursandoIds.has(m.id)),
    [materiasAll, cursandoIds]
  );

  const subjectLabels = useMemo(() => {
    const map = {};
    for (const m of materiasAll || []) map[m.id] = `${m.id} — ${m.nombre}`;
    return map;
  }, [materiasAll]);

  const materiaNombre = (id) =>
    id === "general" ? "General" : (subjectLabels[id] || id);

  const allNotes = useMemo(() => {
    const notes = [];
    for (const [key, lista] of Object.entries(notasClaseData || {})) {
      for (const n of lista || []) notes.push({ ...n, subjectId: key });
    }
    return notes.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [notasClaseData]);

  const filteredNotes = useMemo(() => {
    let notes = allNotes;
    if (selectedSubject) notes = notes.filter((n) => n.subjectId === selectedSubject);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      notes = notes.filter((n) =>
        (n.title || "").toLowerCase().includes(q)
        || (n.texto || "").toLowerCase().includes(q)
      );
    }
    return notes;
  }, [allNotes, selectedSubject, searchQuery]);

  const subjectCounts = useMemo(() => {
    const counts = {};
    for (const [key, lista] of Object.entries(notasClaseData || {})) {
      counts[key] = (lista || []).length;
    }
    return counts;
  }, [notasClaseData]);

  const totalRegistros = allNotes.length;

  const doSave = useCallback(() => {
    const edit = editingRef.current;
    if (!edit) return;
    const { subjectId, noteId } = edit;
    const lista = notasClaseData?.[subjectId] || [];
    const texto = noteToTexto(blocksStateRef.current);
    const updated = lista.map((n) =>
      n.id === noteId
        ? { ...n, title: titleStateRef.current, blocks: blocksStateRef.current, texto }
        : n
    );
    onSaveNotasClase({ ...(notasClaseData || {}), [subjectId]: updated });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }, [notasClaseData, onSaveNotasClase]);

  useEffect(() => {
    if (!isLocalEdit.current) return;
    isLocalEdit.current = false;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(doSave, 800);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [editorTitle, editorBlocks, doSave]);

  const markEdit = () => { isLocalEdit.current = true; };

  useEffect(() => {
    if (!slashOpen) return;
    const reposition = () => {
      if (!activeBlockId) return;
      const el = blocksRef.current?.querySelector(`[data-block-id="${activeBlockId}"]`);
      if (el) setSlashPos(computeSlashPos(el));
    };
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("scroll", reposition, true);
    };
  }, [slashOpen, activeBlockId]);

  const focusBlock = (blockId, offset) => {
    focusHintRef.current = { blockId, offset, nonce: Date.now() };
    setActiveBlockId(blockId);
    setFocusNonce((n) => n + 1);
  };

  const onChangeBlocksText = (updater) => {
    markEdit();
    setEditorBlocks(updater);
  };

  const addBlockAfter = useCallback((afterId, content = "", type = "paragraph") => {
    const newBlock = makeBlock(type, content);
    onChangeBlocksText((prev) => {
      const idx = prev.findIndex((b) => b.id === afterId);
      if (idx === -1) return [...prev, newBlock];
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
    focusBlock(newBlock.id, "start");
    return newBlock;
  }, []);

  const toggleChecked = useCallback((blockId) => {
    onChangeBlocksText((prev) => prev.map((b) =>
      b.id === blockId ? { ...b, checked: !b.checked } : b
    ));
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const convertBlock = useCallback((blockId, newType) => {
    let after = null;
    if (newType === "divider") after = makeBlock("paragraph", "");
    onChangeBlocksText((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx === -1) return prev;
      const next = prev.map((b) =>
        b.id === blockId
          ? { ...b, type: newType, checked: newType === "todo" ? false : undefined }
          : b
      );
      if (after) next.splice(idx + 1, 0, after);
      return next;
    });
    closeMenu();
    focusBlock(after ? after.id : blockId, after ? "start" : "end");
  }, [closeMenu]);

  const duplicateBlock = useCallback((blockId) => {
    const src = blocksStateRef.current.find((b) => b.id === blockId);
    if (!src) return;
    const copy = makeBlock(src.type, src.content);
    if (src.type === "todo") copy.checked = src.checked;
    onChangeBlocksText((prev) => {
      const i = prev.findIndex((b) => b.id === blockId);
      if (i === -1) return prev;
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next;
    });
    closeMenu();
    focusBlock(copy.id, "start");
  }, [closeMenu]);

  const deleteBlockById = useCallback((blockId) => {
    const blocks = blocksStateRef.current;
    if (blocks.length <= 1) {
      onChangeBlocksText((prev) => prev.map((b) =>
        b.id === blockId ? { ...b, type: "paragraph", content: "" } : b
      ));
      closeMenu();
      focusBlock(blockId, "start");
      return;
    }
    const idx = blocks.findIndex((b) => b.id === blockId);
    const fallback = blocks[idx - 1] || blocks[idx + 1];
    onChangeBlocksText((prev) => prev.filter((b) => b.id !== blockId));
    closeMenu();
    focusBlock(fallback.id, "start");
  }, [closeMenu]);

  const reorderBlockBy = useCallback((blockId, delta) => {
    onChangeBlocksText((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx === -1) return prev;
      const next = [...prev];
      const [blk] = next.splice(idx, 1);
      const dest = Math.max(0, Math.min(next.length, idx + delta));
      next.splice(dest, 0, blk);
      return next;
    });
  }, []);

  const moveBlockTo = useCallback((fromId, toId, place) => {
    const blocks = blocksStateRef.current;
    const fromIdx = blocks.findIndex((b) => b.id === fromId);
    if (fromIdx === -1) return;
    const targetIdx = blocks.findIndex((b) => b.id === toId);
    if (targetIdx === -1) return;
    const next = blocks.filter((b) => b.id !== fromId);
    let insertAt = next.findIndex((b) => b.id === toId);
    if (place === "after") insertAt += 1;
    next.splice(Math.max(0, insertAt), 0, blocks[fromIdx]);
    onChangeBlocksText(() => next);
    focusBlock(fromId, "start");
  }, []);

  const showBlockMenuAt = useCallback((blockId, rect) => {
    const type = blocksStateRef.current.find((b) => b.id === blockId)?.type || "paragraph";
    setMenu({
      blockId,
      blockType: type,
      x: Math.max(8, Math.min(rect.left, window.innerWidth - 252)),
      y: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 430)),
    });
  }, []);

  useEffect(() => {
    if (dragId) {
      document.body.classList.add(styles.dragBody);
      return () => document.body.classList.remove(styles.dragBody);
    }
  }, [dragId]);

  const computeDropTarget = useCallback((clientY) => {
    const container = blocksRef.current;
    if (!container) return null;
    const rows = [...container.querySelectorAll("[data-block-id]")];
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) {
        return {
          blockId: row.getAttribute("data-block-id"),
          place: clientY < r.top + r.height / 2 ? "before" : "after",
        };
      }
    }
    return null;
  }, []);

  const startBlockDrag = useCallback((blockId, e) => {
    const info = dragInfoRef.current;
    const handleRect = e.currentTarget.getBoundingClientRect();
    info.moved = false;
    info.startX = e.clientX;
    info.startY = e.clientY;
    info.target = null;
    info.place = null;

    const move = (ev) => {
      const dx = ev.clientX - info.startX;
      const dy = ev.clientY - info.startY;
      if (!info.moved && Math.hypot(dx, dy) > 5) {
        info.moved = true;
        setDragId(blockId);
      }
      if (!info.moved) return;
      ev.preventDefault();
      const scrollEl = blocksRef.current?.parentElement;
      if (scrollEl) {
        const sr = scrollEl.getBoundingClientRect();
        if (ev.clientY < sr.top + 56) scrollEl.scrollTop -= 18;
        else if (ev.clientY > sr.bottom - 56) scrollEl.scrollTop += 18;
      }
      const hit = computeDropTarget(ev.clientY);
      if (hit && hit.blockId !== blockId) {
        info.target = hit.blockId;
        info.place = hit.place;
        const container = blocksRef.current;
        const targetEl = container?.querySelector(`[data-block-id="${hit.blockId}"]`);
        if (container && targetEl) {
          const cr = container.getBoundingClientRect();
          const tr = targetEl.getBoundingClientRect();
          setDropIndicator({ top: (hit.place === "before" ? tr.top : tr.bottom) - cr.top, target: hit.blockId, place: hit.place });
        }
      } else {
        info.target = null;
        info.place = null;
        setDropIndicator(null);
      }
    };

    const up = () => {
      if (info.moved) {
        if (info.target) moveBlockTo(blockId, info.target, info.place);
        document.body.classList.remove(styles.dragBody);
      } else {
        showBlockMenuAt(blockId, handleRect);
      }
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      setDragId(null);
      setDropIndicator(null);
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }, [computeDropTarget, moveBlockTo, showBlockMenuAt]);

  const handleEnter = (blockId, contentEl) => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    const preRange = range.cloneRange();
    preRange.selectNodeContents(contentEl);
    preRange.setEnd(range.startContainer, range.startOffset);
    const textBefore = preRange.toString();

    const postRange = range.cloneRange();
    postRange.selectNodeContents(contentEl);
    postRange.setStart(range.endContainer, range.endOffset);
    const textAfter = postRange.toString();

    const current = blocksStateRef.current.find((b) => b.id === blockId);
    const blockType = current?.type || "paragraph";
    const isList = blockType === "bulleted" || blockType === "numbered" || blockType === "todo";

    if (textBefore === "" && isList) {
      onChangeBlocksText((prev) => prev.map((b) =>
        b.id === blockId ? { ...b, type: "paragraph", checked: undefined } : b
      ));
      return;
    }

    const newBlock = makeBlock(isList ? blockType : "paragraph", textAfter);
    onChangeBlocksText((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], content: textBefore };
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
    focusBlock(newBlock.id, "start");
  };

  const handleBackspace = (blockId, contentEl) => {
    const blocks = blocksStateRef.current;
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    const currentContent = contentEl.textContent || "";

    if (currentContent === "") {
      if (blocks.length <= 1) return;
      const prevBlock = blocks[idx - 1];
      onChangeBlocksText((prev) => prev.filter((b) => b.id !== blockId));
      focusBlock(prevBlock.id, "end");
      return;
    }

    if (idx > 0) {
      const prevBlock = blocks[idx - 1];
      const merged = prevBlock.content + currentContent;
      const mergeOffset = prevBlock.content.length;
      onChangeBlocksText((prev) => {
        const i = prev.findIndex((b) => b.id === blockId);
        if (i === -1) return prev;
        const next = prev.filter((_, j) => j !== i);
        next[i - 1] = { ...next[i - 1], content: merged };
        return next;
      });
      focusBlock(prevBlock.id, mergeOffset);
    }
  };

  const handleEditorKeyDown = (e) => {
    if (slashOpen) return;
    const contentEl = e.target.closest("[contenteditable]");
    if (!contentEl) return;
    const row = contentEl.closest("[data-block-id]");
    if (!row) return;
    const blockId = row.dataset.blockId;
    const blocks = blocksStateRef.current;
    const idx = blocks.findIndex((b) => b.id === blockId);

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      reorderBlockBy(blockId, e.key === "ArrowUp" ? -1 : 1);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEnter(blockId, contentEl);
      return;
    }

    if (e.key === "Backspace") {
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.toString()) return;
      const pre = sel.getRangeAt(0).cloneRange();
      pre.selectNodeContents(contentEl);
      pre.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
      if (pre.toString() === "") {
        e.preventDefault();
        handleBackspace(blockId, contentEl);
      }
      return;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const sel = window.getSelection();
      if (!sel.rangeCount || idx === -1) return;
      const r = sel.getRangeAt(0);
      const pre = r.cloneRange();
      pre.selectNodeContents(contentEl);
      pre.setEnd(r.startContainer, r.startOffset);
      const post = r.cloneRange();
      post.selectNodeContents(contentEl);
      post.setStart(r.endContainer, r.endOffset);
      if (e.key === "ArrowUp" && pre.toString() === "" && idx > 0) {
        e.preventDefault();
        focusBlock(blocks[idx - 1].id, "end");
      } else if (e.key === "ArrowDown" && post.toString() === "" && idx < blocks.length - 1) {
        e.preventDefault();
        focusBlock(blocks[idx + 1].id, "start");
      }
    }
  };

  const handleEditorInput = (e) => {
    const contentEl = e.target.closest("[contenteditable]");
    if (!contentEl) return;
    const row = contentEl.closest("[data-block-id]");
    const text = contentEl.textContent || "";

    if (row) {
      const md = matchMarkdownShortcut(text);
      if (md) {
        const blockId = row.dataset.blockId;
        onChangeBlocksText((prev) => prev.map((b) =>
          b.id === blockId
            ? { ...b, type: md.type, content: "", checked: md.type === "todo" ? !!md.checked : undefined }
            : b
        ));
        focusBlock(blockId, "start");
        return;
      }
    }

    if (row && text.startsWith("/") && !text.includes("\n")) {
      setSlashPos(computeSlashPos(row));
      setSlashOpen(true);
      setActiveBlockId(row.dataset.blockId);
    } else if (slashOpen) {
      setSlashOpen(false);
    }

    const blockId = row && row.dataset.blockId;
    if (blockId) {
      onChangeBlocksText((prev) => prev.map((b) =>
        b.id === blockId ? { ...b, content: text } : b
      ));
    }
  };

  const handleSlashPick = useCallback((bt) => {
    setSlashOpen(false);
    convertBlock(activeBlockId, bt.type);
  }, [activeBlockId, convertBlock]);

  const openNote = (subjectId, noteId) => {
    const note = notasClaseData?.[subjectId]?.find((n) => n.id === noteId);
    if (!note) return;
    setEditingNote({ subjectId, noteId });
    setEditorTitle(note.title || "");
    setEditorBlocks(toBlocksFromNote(note));
    setActiveBlockId(null);
    setSlashOpen(false);
    setMobileView("editor");
  };

  const createNewNote = () => {
    const subjectId = selectedSubject || materiasCursando[0]?.id || "general";
    const newNote = {
      id: uuid(),
      title: "",
      blocks: [makeBlock("paragraph", "")],
      fecha: toISODate(new Date()),
      texto: "",
      destino: "apuntes",
    };
    const prev = notasClaseData?.[subjectId] || [];
    onSaveNotasClase({ ...(notasClaseData || {}), [subjectId]: [newNote, ...prev] });
    setEditingNote({ subjectId, noteId: newNote.id });
    setEditorTitle("");
    setEditorBlocks(newNote.blocks);
    setActiveBlockId(null);
    setSlashOpen(false);
    setMobileView("editor");
    window.setTimeout(() => titleRef.current?.focus(), 60);
  };

  const deleteNote = (subjectId, noteId) => {
    const lista = notasClaseData?.[subjectId] || [];
    onSaveNotasClase({ ...(notasClaseData || {}), [subjectId]: lista.filter((n) => n.id !== noteId) });
    if (editingNote && editingNote.subjectId === subjectId && editingNote.noteId === noteId) {
      setEditingNote(null);
      setMobileView("list");
    }
  };

  const goBack = () => {
    setEditingNote(null);
    setMobileView("list");
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const first = blocksStateRef.current[0];
      if (first) focusBlock(first.id, "start");
    }
  };

  const sidebarNavBtn = (id, icon, label, count) => (
    <button
      key={id || "__all__"}
      className={`${styles.navItem} ${selectedSubject === id ? styles.navItemActive : ""}`}
      onClick={() => setSelectedSubject(id)}
    >
      <span className={styles.navItemIcon}>{icon}</span>
      <span className={styles.navItemLabel}>{label}</span>
      <span className={styles.navItemCount}>{count}</span>
    </button>
  );

  return (
    <div className={styles.wrap}>
      {}
      <aside className={`${styles.sidebar} ${mobileView === "editor" ? styles.sidebarHiddenMobile : ""}`}>
        <div className={styles.brandRow}>
          <span className={styles.brandMark}><IconSparkle size={14} /></span>
          <div className={styles.brandText}>
            <p className={styles.brandTitle}>Cuadernos</p>
            <p className={styles.brandSub}>{totalRegistros} apunte{totalRegistros !== 1 ? "s" : ""}</p>
          </div>
          <button className={styles.newNoteBtn} onClick={createNewNote} title="Nueva nota" aria-label="Nueva nota">
            <IconPlus size={15} />
          </button>
        </div>

        <div className={styles.searchWrap}>
          <IconSearch size={13} />
          <input
            className={styles.searchInput}
            placeholder="Buscar en apuntes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar en apuntes"
          />
          {searchQuery && (
            <button className={styles.searchClear} onClick={() => setSearchQuery("")} aria-label="Limpiar búsqueda">
              <IconClose size={12} />
            </button>
          )}
        </div>

        <nav className={styles.sidebarNav} aria-label="Materias">
          <p className={styles.sectionLabel}>Materias</p>
          {sidebarNavBtn(null, <IconStar size={14} />, "Todas", allNotes.length)}
          {sidebarNavBtn("general", <IconSparkle size={14} />, "General", subjectCounts["general"] || 0)}
          {materiasCursando.map((m) => sidebarNavBtn(m.id, <IconSemester size={14} />, m.id, subjectCounts[m.id] || 0))}
        </nav>
      </aside>

      {}
      <main className={styles.main}>
        {!editingNote ? (
          <div className={styles.listView}>
            <div className={styles.listHeader}>
              <div className={styles.listHeaderText}>
                <h2 className={styles.pageTitle}>
                  {searchQuery ? "Resultados" : (selectedSubject ? materiaNombre(selectedSubject) : "Todas las notas")}
                </h2>
                <p className={styles.pageSub}>
                  {filteredNotes.length} nota{filteredNotes.length !== 1 ? "s" : ""}
                  {searchQuery ? ` · “${searchQuery}”` : ""}
                </p>
              </div>
              <button className={styles.primaryBtn} onClick={createNewNote}>
                <IconPlus size={14} /> Nueva nota
              </button>
            </div>

            {filteredNotes.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}><IconSparkle size={30} /></span>
                <p className={styles.emptyTitle}>{searchQuery ? "Sin resultados" : "Aún no hay notas"}</p>
                <p className={styles.emptySub}>
                  {searchQuery ? "Prueba con otra búsqueda." : "Empieza a escribir: tus apuntes se guardan automáticamente."}
                </p>
                {!searchQuery && (
                  <button className={styles.primaryBtn} onClick={createNewNote}>
                    <IconPlus size={14} /> Crear primera nota
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.noteList}>
                {filteredNotes.map((n) => (
                  <div
                    key={n.id}
                    className={styles.noteRow}
                    onClick={() => openNote(n.subjectId, n.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") openNote(n.subjectId, n.id); }}
                  >
                    <span className={styles.noteRowIcon}>
                      {n.destino === "asignacion" ? <IconSemester size={14} /> : <IconSparkle size={14} />}
                    </span>
                    <span className={styles.noteRowBody}>
                      <span className={styles.noteRowTitle}>{n.title || "Sin título"}</span>
                      <span className={styles.noteRowPreview}>
                        {(DESTINO_LABEL[n.destino] && n.destino !== "apuntes" ? `${DESTINO_LABEL[n.destino]} · ` : "")}
                        {(n.texto || "").slice(0, 140) || "Nota vacía"}
                      </span>
                    </span>
                    <span className={styles.noteRowMeta}>
                      <span className={styles.noteRowDate}>{formatFecha(n.fecha)}</span>
                      <button
                        className={styles.noteRowDelete}
                        onClick={(e) => { e.stopPropagation(); deleteNote(n.subjectId, n.id); }}
                        title="Eliminar nota"
                        aria-label="Eliminar nota"
                      >
                        <IconTrash size={13} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.editorView}>
            <div className={styles.editorTopbar}>
              <button className={styles.backBtn} onClick={goBack}>
                <IconChevronLeft size={15} /> Cuadernos
              </button>
              <span className={styles.editorCrumb}>
                <IconSemester size={12} /> {materiaNombre(editingNote.subjectId)}
              </span>
              {saved && (
                <span className={styles.savedBadge}>
                  <IconCheck size={12} /> Guardado
                </span>
              )}
            </div>

            <div className={styles.editorCanvas}>
              <input
                ref={titleRef}
                className={styles.titleInput}
                placeholder="Sin título"
                value={editorTitle}
                onChange={(e) => { markEdit(); setEditorTitle(e.target.value); }}
                onKeyDown={handleTitleKeyDown}
                aria-label="Título de la nota"
              />

              <div
                className={styles.blocksContainer}
                ref={blocksRef}
                onKeyDown={handleEditorKeyDown}
                onInput={handleEditorInput}
              >
                {editorBlocks.map((block) => (
                  <BlockRow
                    key={block.id}
                    block={block}
                    blocks={editorBlocks}
                    isActive={activeBlockId === block.id}
                    focusHint={focusHintRef.current}
                    focusNonce={focusNonce}
                    onFocus={(id) => setActiveBlockId(id)}
                    onAddAfter={addBlockAfter}
                    onToggleChecked={toggleChecked}
                    onDragStart={startBlockDrag}
                    dragging={dragId === block.id}
                  />
                ))}
                {dropIndicator && (
                  <div
                    className={styles.dropIndicator}
                    style={{ top: dropIndicator.top }}
                    aria-hidden="true"
                  />
                )}
              </div>

              <p className={styles.editorHint}>
                <kbd>/</kbd> comandos de bloque · arrastra <IconGrip size={13} /> para mover · <kbd>⌘/Ctrl</kbd>+<kbd>Mayús</kbd>+<kbd>↑/↓</kbd> reordena
              </p>
            </div>

            {slashOpen && (
              <div className={styles.slashOverlay} onClick={() => setSlashOpen(false)}>
                <div
                  className={styles.slashAnchor}
                  style={{ top: slashPos.top, left: slashPos.left }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <SlashMenu
                    onSelect={handleSlashPick}
                    onClose={() => setSlashOpen(false)}
                  />
                </div>
              </div>
            )}

            {menu && (
              <div className={styles.menuBackdrop} onClick={closeMenu}>
                <BlockMenu
                  x={menu.x}
                  y={menu.y}
                  activeType={menu.blockType}
                  onConvert={(t) => convertBlock(menu.blockId, t)}
                  onMoveUp={() => { reorderBlockBy(menu.blockId, -1); closeMenu(); }}
                  onMoveDown={() => { reorderBlockBy(menu.blockId, 1); closeMenu(); }}
                  onDuplicate={() => duplicateBlock(menu.blockId)}
                  onDelete={() => deleteBlockById(menu.blockId)}
                  onClose={closeMenu}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}