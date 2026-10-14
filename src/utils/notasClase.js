
export function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function blockUuid() {
  return "b-" + uuid();
}

export const BLOCK_TYPES = [
  { type: "paragraph", label: "Texto", desc: "Bloque de texto plano", icon: "T" },
  { type: "heading", label: "Título", desc: "Encabezado de sección", icon: "H1" },
  { type: "heading3", label: "Subtítulo", desc: "Encabezado más pequeño", icon: "H2" },
  { type: "todo", label: "Tarea", desc: "Casilla de verificación", icon: "✓" },
  { type: "bulleted", label: "Viñeta", desc: "Lista con viñetas", icon: "•" },
  { type: "numbered", label: "Numerada", desc: "Lista numerada", icon: "1." },
  { type: "divider", label: "Divisor", desc: "Línea separadora", icon: "—" },
  { type: "callout", label: "Callout", desc: "Bloque destacado", icon: "✦" },
  { type: "quote", label: "Cita", desc: "Bloque de cita", icon: "❝" },
];

export const MARKDOWN_SHORTCUTS = [
  { re: /^(#{2})\s/, type: "heading3" },
  { re: /^(#{1})\s/, type: "heading" },
  { re: /^\[x\]\s/i, type: "todo", checked: true },
  { re: /^\[ \]\s/, type: "todo", checked: false },
  { re: /^(\d+)\.\s/, type: "numbered" },
  { re: /^(-|\*)\s/, type: "bulleted" },
  { re: /^(>)\s/, type: "quote" },
];

export function matchMarkdownShortcut(text) {
  if (!text) return null;
  for (const s of MARKDOWN_SHORTCUTS) {
    if (s.re.test(text)) {
      if (s.type === "todo") return { type: s.type, checked: !!s.checked };
      return { type: s.type };
    }
  }
  return null;
}

export function makeBlock(type = "paragraph", content = "") {
  return {
    id: blockUuid(),
    type,
    content,
    checked: type === "todo" ? false : undefined,
  };
}

export function toBlocksFromNote(note) {
  if (note && Array.isArray(note.blocks) && note.blocks.length > 0) {
    return note.blocks.map((b) => ({
      id: b.id || blockUuid(),
      type: b.type || "paragraph",
      content: b.content || "",
      checked: b.type === "todo" ? !!b.checked : undefined,
    }));
  }
  const text = (note && note.texto) || "";
  if (!text) return [makeBlock("paragraph", "")];
  return text.split("\n").map((line) => makeBlock("paragraph", line));
}

export function noteToTexto(blocks) {
  return (blocks || []).map((b) => b.content || "").join("\n");
}

export function toISODate(d) {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const DESTINO_LABEL = {
  calendario: "Calendario",
  asignaciones: "Asignaciones",
  cursando: "Semestre",
  apuntes: "Apuntes",
};

export function formatFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}/${String(m).padStart(2, "0")}/${y}`;
}
