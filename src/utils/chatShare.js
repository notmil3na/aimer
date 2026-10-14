import { uuid } from "./notasClase";


export function subjectName(malla, subjectId) {
  if (!malla) return subjectId || "";
  for (const sem of malla) {
    const s = (sem.materias || []).find((m) => m.id === subjectId);
    if (s) return s.nombre || subjectId;
  }
  return subjectId || "";
}

export function buildAssignmentPayload(malla, item, subjectId) {
  const clean = { ...item };
  delete clean.id;
  delete clean.calendarId;
  delete clean.completada;
  delete clean.nota;
  delete clean.recordatorios;
  delete clean.notas;
  if (typeof clean.descripcion === "string") clean.descripcion = clean.descripcion.slice(0, 1200);
  if (typeof clean.enlace === "string") clean.enlace = clean.enlace.slice(0, 300);
  if (typeof clean.ubicacion === "string") clean.ubicacion = clean.ubicacion.slice(0, 200);
  if (Array.isArray(clean.temas)) {
    clean.temas = clean.temas.slice(0, 12).map((t) =>
      typeof t === "string" ? t.slice(0, 300) : t
    );
  }
  return {
    kind: "assignment",
    subjectId: subjectId || item.materiaId || "",
    subjectName: subjectName(malla, subjectId || item.materiaId),
    item: clean,
  };
}

export function assignmentToAddable(payload) {
  const item = payload && payload.item ? { ...payload.item } : {};
  item.id = uuid();
  item.completada = false;
  item.temas = item.temas || [];
  item.materiaId = payload.subjectId || item.materiaId || "";
  return item;
}

export function buildNotePayload(malla, subjectId, note) {
  return {
    kind: "note",
    subjectId,
    subjectName: subjectName(malla, subjectId),
    item: { fecha: note.fecha || "", texto: String(note.texto || "").slice(0, 4000) },
  };
}

export function noteToAddable(payload) {
  const n = payload && payload.item ? payload.item : {};
  return { id: uuid(), texto: n.texto || "", fecha: n.fecha || "" };
}

export function compressImageForChat(dataUrl, maxDim = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (_) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = dataUrl;
  });
}

export function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl).split(",");
  const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || "image/jpeg";
  const bin = atob(parts[1] || "");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function fmtTimeFull(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    if (sameDay) return `${hh}:${mm}`;
    const dd = d.getDate().toString().padStart(2, "0");
    const MM = (d.getMonth() + 1).toString().padStart(2, "0");
    if (d.getFullYear() === today.getFullYear()) return `${dd}/${MM} · ${hh}:${mm}`;
    return `${dd}/${MM}/${d.getFullYear()} · ${hh}:${mm}`;
  } catch {
    return "";
  }
}

export function fmtFecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = d.getDate().toString().padStart(2, "0");
  const MM = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${MM}/${yyyy}`;
}