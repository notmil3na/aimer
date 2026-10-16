import { useRef, useState, useMemo } from "react";
import { toPng } from "html-to-image";
import {
  buildColorMap,
  LEGACY_HORAS,
  horaIdx,
  toViewHora,
} from "../utils/horarioHelpers.js";
import { IconClose, IconDownload } from "./Icons";
import styles from "./HorarioExport.module.css";
import useBodyScrollLock from "../hooks/useBodyScrollLock";

const DIA_NAMES = {
  L: "Lunes", M: "Martes", X: "Miércoles",
  J: "Jueves", V: "Viernes", S: "Sábado",
};

function buildGridInfo(clases, dias) {
  const usedHoras = clases.flatMap((c) => {
    const s = horaIdx(c.horaInicio), e = horaIdx(c.horaFin);
    return s >= 0 && e > s ? Array.from({ length: e - s + 1 }, (_, i) => s + i) : [];
  });
  const minH = usedHoras.length ? Math.max(0, Math.min(...usedHoras) - 1) : 1;
  const maxH = usedHoras.length
    ? Math.min(LEGACY_HORAS.length - 1, Math.max(...usedHoras) + 1)
    : 9;
  const visHoras = LEGACY_HORAS.slice(minH, maxH + 1);
  const diasMostrar = (dias || []).filter((id) => id && DIA_NAMES[id]);
  return { visHoras, minH, diasMostrar };
}

export default function HorarioExport({ user, horarioData, malla, onClose, onNotify, onOpenWallpaper }) {
  useBodyScrollLock();
  const sheetRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const clases = horarioData?.clases || [];
  const materias = useMemo(() => malla.flatMap((s) => s.materias), [malla]);
  const materiaMap = useMemo(() => Object.fromEntries(materias.map((m) => [m.id, m])), [materias]);
  const colorMap = useMemo(
    () => buildColorMap(materias.filter((m) => m.estado === "cursando")),
    [materias]
  );

  const { visHoras, minH, diasMostrar } = useMemo(
    () => buildGridInfo(clases, horarioData?.dias),
    [clases, horarioData?.dias]
  );
  const CELL_H = 46;

  const materiaIds = useMemo(
    () => [...new Set(clases.map((c) => c.materiaId))],
    [clases]
  );

  const totalCred = useMemo(
    () => materiaIds.reduce((a, id) => a + (materiaMap[id]?.creditos || 0), 0),
    [materiaIds, materiaMap]
  );

  const safeName = (user.username || "estudiante").replace(/[^\w.-]/g, "_");
  const now = new Date();

  const download = (url, ext) => {
    const link = document.createElement("a");
    link.download = `horario_${safeName}.${ext}`;
    link.href = url;
    link.click();
  };

  const handlePng = async () => {
    const node = sheetRef.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2 });
      download(dataUrl, "png");
      onNotify?.("Horario descargado como PNG");
    } catch {
      onNotify?.("No se pudo exportar la imagen");
    } finally {
      setBusy(false);
    }
  };

  const handlePdf = async () => {
    const node = sheetRef.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      const [{ jsPDF }, dataUrl] = await Promise.all([
        import("jspdf"),
        toPng(node, { pixelRatio: 2 }),
      ]);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });
      const wPx = img.width, hPx = img.height;
      const pxToMm = 25.4 / 96;
      const w = Math.round(wPx * pxToMm), h = Math.round(hPx * pxToMm);
      const pdf = new jsPDF({
        orientation: wPx > hPx ? "landscape" : "portrait",
        unit: "mm",
        format: [w, h],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, w, h, undefined, "FAST");
      pdf.save(`horario_${safeName}.pdf`);
      onNotify?.("Horario descargado como PDF");
    } catch {
      onNotify?.("No se pudo exportar el PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-export-title">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 id="modal-export-title" className={styles.modalTitle}>Exportar horario</h3>
            <p className={styles.modalSub}>
              Vista previa del diseño que se compartirá o imprimirá.
            </p>
          </div>
          <div className={styles.modalActions}>
            {onOpenWallpaper && (
              <button type="button" className={styles.btnSecondary} onClick={onOpenWallpaper} disabled={busy}>
                <IconDownload size={13} /> Fondo de pantalla
              </button>
            )}
            <button type="button" className={styles.btnSecondary} onClick={handlePdf} disabled={busy}>
              <IconDownload size={13} /> PDF
            </button>
            <button type="button" className={styles.btnPrimary} onClick={handlePng} disabled={busy}>
              <IconDownload size={13} /> {busy ? "Generando…" : "Imagen PNG"}
            </button>
            <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Cerrar modal">
              <IconClose size={14} />
            </button>
          </div>
        </div>
        <div className={styles.preview}>
          <div className={styles.sheetWrap}>
            <div ref={sheetRef} className={styles.sheet}>
              <div className={styles.sheetHeader}>
                <div className={styles.sheetBrand}>
                  <span className={styles.sheetBrandStar}>✦</span>
                  <span>Aimer</span>
                </div>
                <h1 className={styles.sheetTitle}>Mi Horario</h1>
                <p className={styles.sheetMeta}>
                  {user.name || user.username}
                  {user.career ? ` · ${user.career}` : ""}
                  {user.university ? ` · ${user.university}` : ""}
                </p>
                <p className={styles.sheetMetaLight}>
                  Semestre {user.semester || "—"}
                  {user.ingresoCorte ? ` · Ingreso ${user.ingresoCorte}` : ""}
                  {" · "}Generado el {now.toLocaleDateString("es-CO")}
                </p>
              </div>

              <div className={styles.sheetGridWrap}>
                <div className={styles.grid} style={{ "--num-dias": diasMostrar.length || 1 }}>
                  <div className={styles.horaCol}>
                    <div className={styles.horaColHeader} />
                    {visHoras.map((h) => (
                      <div key={h} className={styles.horaCell}>{h}</div>
                    ))}
                  </div>
                  {diasMostrar.map((dia) => (
                    <div key={dia} className={styles.diaCol}>
                      <div className={styles.diaHeader}>
                        <span className={styles.diaShort}>{dia}</span>
                        <span className={styles.diaFull}>{DIA_NAMES[dia]}</span>
                      </div>
                      <div className={styles.diaBody}>
                        {visHoras.map((h) => (
                          <div key={h} className={styles.horaLine} />
                        ))}
                        {clases.filter((c) => c.dia === dia).map((clase, i) => {
                          const s = horaIdx(clase.horaInicio) - minH;
                          const dur = horaIdx(clase.horaFin) - horaIdx(clase.horaInicio);
                          if (s < 0 || dur <= 0) return null;
                          const color = colorMap[clase.materiaId] || "#c8a96e";
                          const m = materiaMap[clase.materiaId];
                          return (
                            <div
                              key={i}
                              className={styles.bloque}
                              style={{ top: s * CELL_H, height: dur * CELL_H - 3, background: color }}
                            >
                              <span className={styles.bloqueId}>
                                {clase.materiaId}{clase.grupo ? ` · ${clase.grupo}` : ""}
                              </span>
                              {dur >= 2 && m?.nombre && (
                                <span className={styles.bloqueNombre}>{m.nombre}</span>
                              )}
                              <span className={styles.bloqueHora}>
                                {toViewHora(clase.horaInicio)}–{toViewHora(clase.horaFin)}
                              </span>
                              {clase.salonLabel && dur >= 2 && (
                                <span className={styles.bloqueSalon}>{clase.salonLabel}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {materiaIds.length > 0 && (
                <div className={styles.sheetLegend}>
                  {materiaIds.map((id) => (
                    <div key={id} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: colorMap[id] || "#c8a96e" }} />
                      <span className={styles.legendId}>{id}</span>
                      <span className={styles.legendNombre}>{materiaMap[id]?.nombre || ""}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.sheetFooter}>
                <div className={styles.sheetStats}>
                  <span className={styles.stat}><strong>{clases.length}</strong> clases</span>
                  <span className={styles.stat}><strong>{materiaIds.length}</strong> materias</span>
                  <span className={styles.stat}><strong>{totalCred}</strong> créditos</span>
                  <span className={styles.stat}><strong>{diasMostrar.length}</strong> días</span>
                </div>
                <span className={styles.sheetCredit}>Generado con Aimer ✦</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
