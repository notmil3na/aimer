import { ESTADOS } from "../data/malla.js";
import {
  isEnglishLetterGrade,
  isGradePassed,
  isGradeFailed,
} from "./gradeHelpers.js";

function formatNotaLine(materia, semestre, nota) {
  if (nota === undefined || nota === null || nota === "") return null;
  if (isEnglishLetterGrade(materia, semestre)) {
    if (nota === "A") return `    · Nota: A — Aprobado`;
    if (nota === "I") return `    · Nota: I — Insuficiente`;
    return `    · Nota: ${nota}`;
  }
  const num = Number(nota);
  if (isNaN(num)) return `    · Nota: ${nota}`;
  if (isGradePassed(materia, semestre, nota)) return `    · Nota: ${num} — Aprobó`;
  if (isGradeFailed(materia, semestre, nota)) return `    · Nota: ${num} — Perdió`;
  return `    · Nota: ${num}`;
}

function formatPrereqs(materia, allMaterias) {
  if (!materia.prereqs?.length) return "    Prerequisitos: ninguno";
  const names = materia.prereqs.map((pid) => {
    const p = allMaterias.find((x) => x.id === pid);
    return p ? `${p.id} (${p.nombre})` : pid;
  });
  return `    Prerequisitos: ${names.join(", ")}`;
}

function formatMateriaBlock(materia, semestre, notasMap, allMaterias) {
  const lines = [];
  const estadoLabel = ESTADOS[materia.estado]?.label || materia.estado;
  const codigo = materia.codigo ? `${materia.codigo} · ` : "";

  lines.push(`${codigo}${materia.id} — ${materia.nombre} (${materia.creditos} cr)`);
  lines.push(`    Estado en malla: ${estadoLabel}`);
  lines.push(formatPrereqs(materia, allMaterias));

  const n = notasMap[materia.id];
  if (!n) {
    lines.push("    Notas: sin registrar");
    return lines;
  }

  const mainLine = formatNotaLine(materia, semestre, n.nota);
  if (mainLine) lines.push(`    Nota definitiva: ${mainLine.replace("    · Nota: ", "")}`);
  else lines.push("    Nota definitiva: —");

  if (n.profesor) lines.push(`    Profesor: ${n.profesor}`);
  if (n.grupo) lines.push(`    Grupo: ${n.grupo}`);

  (n.intentos || []).forEach((it, i) => {
    const attemptLine = formatNotaLine(materia, semestre, it.nota);
    const semLabel = it.semestre ? ` (${it.semestre})` : "";
    if (attemptLine) {
      lines.push(`    Intento ${i + 1}${semLabel}: ${attemptLine.replace("    · Nota: ", "")}`);
    }
  });

  return lines;
}

export function buildMallaTxt({ user, malla, notas }) {
  const allMaterias = malla.flatMap((s) => s.materias);
  const lines = [];

  lines.push("MALLA CURRICULAR — EXPORTACIÓN");
  lines.push("=".repeat(50));
  lines.push(`Estudiante: ${user.name || user.username}`);
  lines.push(`Universidad: ${user.university || "—"}`);
  lines.push(`Carrera: ${user.career || "—"}`);
  lines.push(`Corte de ingreso: ${user.ingresoCorte || "—"}`);
  lines.push(`Semestre actual: ${user.semester || "—"}`);
  lines.push(`Generado: ${new Date().toLocaleString("es-CO")}`);
  lines.push("");

  malla.forEach((sem) => {
    const title = sem.label
      ? sem.label.toUpperCase()
      : typeof sem.semestre === "number"
        ? `SEMESTRE ${sem.semestre}`
        : String(sem.semestre).toUpperCase();

    lines.push("─".repeat(50));
    lines.push(title);
    lines.push(`Créditos del bloque: ${sem.materias.reduce((a, m) => a + m.creditos, 0)}`);
    lines.push("");

    sem.materias.forEach((mat) => {
      const semNum = typeof sem.semestre === "number" ? sem.semestre : null;
      formatMateriaBlock(mat, semNum, notas || {}, allMaterias).forEach((l) => lines.push(l));
      lines.push("");
    });
  });

  return lines.join("\n");
}

export function downloadTxt(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
