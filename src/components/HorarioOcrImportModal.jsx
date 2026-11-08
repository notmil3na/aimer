import { useState } from "react";
import { HORAS_FORM, horaIdx } from "../utils/horarioHelpers.js";
import { readScheduleImages } from "../utils/horarioOcr.js";
import useBodyScrollLock from "../hooks/useBodyScrollLock";
import { IconClose, IconWarning } from "./Icons";
import styles from "./HorarioOcrImportModal.module.css";

const DAYS = [
  ["L", "Lunes"], ["M", "Martes"], ["X", "Miércoles"],
  ["J", "Jueves"], ["V", "Viernes"], ["S", "Sábado"],
];

function normalizeCourseName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findCourse(name, courses) {
  const key = normalizeCourseName(name);
  return courses.find((course) => normalizeCourseName(course.nombre) === key);
}

function selectedMeetings(rows) {
  return rows.flatMap((row) => row.meetings.map((meeting) => ({ row, meeting })));
}

function getConflicts(rows) {
  const meetings = selectedMeetings(rows);
  const conflicts = new Set();
  meetings.forEach(({ meeting: a }, i) => {
    meetings.slice(i + 1).forEach(({ meeting: b }, offset) => {
      if (a.dia !== b.dia) return;
      const startA = horaIdx(a.horaInicio), endA = horaIdx(a.horaFin);
      const startB = horaIdx(b.horaInicio), endB = horaIdx(b.horaFin);
      if (startA >= 0 && startB >= 0 && startA < endB && startB < endA) {
        conflicts.add(i);
        conflicts.add(i + offset + 1);
      }
    });
  });
  return conflicts.size;
}

export default function HorarioOcrImportModal({ materias, existingCount = 0, onClose, onImport }) {
  useBodyScrollLock();
  const [scheduleFile, setScheduleFile] = useState(null);
  const [locationFile, setLocationFile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState("");
  const [markCurrent, setMarkCurrent] = useState(false);
  const [replaceCurrent, setReplaceCurrent] = useState(false);

  const scan = async () => {
    setError("");
    setDraft(null);
    setBusy(true);
    setProgress(0.02);
    try {
      const result = await readScheduleImages(scheduleFile, locationFile, (value, label) => {
        setProgress(value);
        setProgressLabel(label);
      });
      setDraft(result.rows.map((row, rowIndex) => {
        const match = findCourse(row.nombre, materias);
        return {
          ...row,
          key: `ocr-row-${rowIndex}`,
          matchId: match?.id || "__custom__",
          meetings: row.meetings.filter((meeting) => meeting.dia !== "D").map((meeting, index) => ({
            ...meeting,
            key: `ocr-meeting-${rowIndex}-${index}`,
          })),
        };
      }).filter((row) => row.meetings.length));
      setWarnings(result.warnings);
    } catch (scanError) {
      setError(scanError?.message || "No pude leer esa imagen. Prueba con una captura más nítida.");
    } finally {
      setBusy(false);
    }
  };

  const updateRow = (rowKey, patch) => {
    setDraft((rows) => rows.map((row) => row.key === rowKey ? { ...row, ...patch } : row));
  };

  const updateMeeting = (rowKey, meetingKey, patch) => {
    setDraft((rows) => rows.map((row) => row.key === rowKey
      ? { ...row, meetings: row.meetings.map((meeting) => meeting.key === meetingKey ? { ...meeting, ...patch } : meeting) }
      : row));
  };

  const removeMeeting = (rowKey, meetingKey) => {
    setDraft((rows) => rows
      .map((row) => row.key === rowKey ? { ...row, meetings: row.meetings.filter((meeting) => meeting.key !== meetingKey) } : row)
      .filter((row) => row.meetings.length));
  };

  const importDraft = () => {
    if (!draft?.length) return;
    const classes = draft.flatMap((row) => {
      const materia = row.matchId === "__custom__"
        ? String(row.nombre || "Materia importada").trim()
        : row.matchId;
      if (!materia) return [];
      const pairId = row.meetings.length === 2 ? `ocr-${row.key}` : "";
      return row.meetings.map(({ key, ...meeting }) => ({
        materiaId: materia,
        dia: meeting.dia,
        horaInicio: meeting.horaInicio,
        horaFin: meeting.horaFin,
        grupo: String(row.grupo || "").trim(),
        profesor: String(row.profesor || "").trim(),
        edificio: meeting.edificio || "",
        lado: meeting.lado || "",
        salon: meeting.salon || "",
        salonLabel: String(meeting.salonLabel || "").trim(),
        notas: "",
        ...(pairId ? { pairId } : {}),
      }));
    });
    if (!classes.length) {
      setError("No hay clases válidas para importar.");
      return;
    }
    const mappedIds = [...new Set(draft.map((row) => row.matchId).filter((id) => id && id !== "__custom__"))];
    onImport(classes, markCurrent ? mappedIds : [], replaceCurrent);
  };

  const conflictCount = draft ? getConflicts(draft) : 0;

  return (
    <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="horario-ocr-title">
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Importación inteligente</span>
            <h2 id="horario-ocr-title">Leer horario desde imágenes</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} disabled={busy} aria-label="Cerrar">
            <IconClose size={16} />
          </button>
        </header>

        <div className={styles.body}>
          {!draft && (
            <>
              <p className={styles.intro}>
                Sube la tabla de materias, docentes y horas. Si tienes la tabla de salones, añádela también para completar los lugares.
              </p>
              <label className={styles.fileField}>
                <span className={styles.fileTitle}>1. Tabla de materias y horas <b>Obligatoria</b></span>
                <span className={styles.fileHint}>{scheduleFile?.name || "Elige una captura PNG, JPG o WebP"}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setScheduleFile(event.target.files?.[0] || null)} />
              </label>
              <label className={styles.fileField}>
                <span className={styles.fileTitle}>2. Tabla de salones <b>Opcional</b></span>
                <span className={styles.fileHint}>{locationFile?.name || "Las filas deben conservar el mismo orden"}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLocationFile(event.target.files?.[0] || null)} />
              </label>
              <p className={styles.privacy}>Las imágenes se procesan en este dispositivo. La primera vez se descargan el motor OCR y el idioma español.</p>
              {busy && (
                <div className={styles.progressBox}>
                  <div className={styles.progressTrack}><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                  <span>{progressLabel || "Preparando OCR…"} {Math.round(progress * 100)}%</span>
                </div>
              )}
            </>
          )}

          {draft && (
            <>
              <div className={styles.reviewIntro}>
                <strong>{draft.length} materias · {selectedMeetings(draft).length} clases</strong>
                <span>Revisa los campos detectados y corrige cualquier error antes de importar.</span>
              </div>
              {warnings.map((warning) => <p className={styles.warning} key={warning}><IconWarning size={14} /> {warning}</p>)}
              {conflictCount > 0 && <p className={styles.warning}><IconWarning size={14} /> El borrador tiene posibles choques de horario. Puedes importarlo y revisarlo después.</p>}

              <div className={styles.courseList}>
                {draft.map((row, rowIndex) => (
                  <article className={styles.courseCard} key={row.key}>
                    <div className={styles.courseHeader}><span>{String(rowIndex + 1).padStart(2, "0")}</span><strong>Materia detectada</strong></div>
                    <label className={styles.field}>
                      Nombre leído
                      <input value={row.nombre} onChange={(event) => updateRow(row.key, { nombre: event.target.value })} />
                    </label>
                    <label className={styles.field}>
                      Asociar con tu malla
                      <select value={row.matchId} onChange={(event) => updateRow(row.key, { matchId: event.target.value })}>
                        <option value="__custom__">Usar el nombre leído</option>
                        {materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.id} · {materia.nombre}</option>)}
                      </select>
                    </label>
                    <div className={styles.twoFields}>
                      <label className={styles.field}>Grupo<input value={row.grupo} onChange={(event) => updateRow(row.key, { grupo: event.target.value })} /></label>
                      <label className={styles.field}>Docente<input value={row.profesor} onChange={(event) => updateRow(row.key, { profesor: event.target.value })} /></label>
                    </div>
                    <div className={styles.meetings}>
                      {row.meetings.map((meeting) => (
                        <div className={styles.meeting} key={meeting.key}>
                          <div className={styles.meetingTop}>
                            <label className={styles.field}>Día
                              <select value={meeting.dia} onChange={(event) => updateMeeting(row.key, meeting.key, { dia: event.target.value })}>
                                {DAYS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                              </select>
                            </label>
                            <label className={styles.field}>Inicio
                              <select value={meeting.horaInicio} onChange={(event) => updateMeeting(row.key, meeting.key, { horaInicio: event.target.value })}>
                                {HORAS_FORM.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                              </select>
                            </label>
                            <label className={styles.field}>Fin
                              <select value={meeting.horaFin} onChange={(event) => updateMeeting(row.key, meeting.key, { horaFin: event.target.value })}>
                                {HORAS_FORM.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                              </select>
                            </label>
                            <button type="button" className={styles.removeMeeting} onClick={() => removeMeeting(row.key, meeting.key)} aria-label="Quitar esta clase">×</button>
                          </div>
                          <label className={styles.field}>Lugar
                            <input value={meeting.salonLabel} placeholder="Opcional" onChange={(event) => updateMeeting(row.key, meeting.key, { salonLabel: event.target.value })} />
                          </label>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <label className={styles.enrollToggle}>
                <input type="checkbox" checked={markCurrent} onChange={(event) => setMarkCurrent(event.target.checked)} />
                <span>Marcar las materias asociadas como <strong>Cursando</strong> al importar.</span>
              </label>
              {markCurrent && <p className={styles.enrollWarning}>Esto actualizará el estado de las materias de tu malla para que coincida con las asociadas al horario.</p>}
              {existingCount > 0 && (
                <>
                  <label className={styles.enrollToggle}>
                    <input type="checkbox" checked={replaceCurrent} onChange={(event) => setReplaceCurrent(event.target.checked)} />
                    <span>Reemplazar las {existingCount} clases que ya están en el horario.</span>
                  </label>
                  {!replaceCurrent && <p className={styles.enrollWarning}>Se conservarán las clases actuales y se agregarán las detectadas. Las repetidas con mismo día y hora se omitirán.</p>}
                  {replaceCurrent && <p className={styles.enrollWarning}>Al importar, se borrarán las clases actuales de este horario.</p>}
                </>
              )}
              <button type="button" className={styles.retake} onClick={() => { setDraft(null); setWarnings([]); setError(""); }}>Elegir otras imágenes</button>
            </>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.cancel} onClick={onClose} disabled={busy}>Cancelar</button>
          {!draft ? (
            <button type="button" className={styles.primary} onClick={scan} disabled={busy || !scheduleFile}>
              {busy ? "Leyendo imágenes…" : "Reconocer horario"}
            </button>
          ) : (
            <button type="button" className={styles.primary} onClick={importDraft} disabled={!draft.length}>
              Importar {selectedMeetings(draft).length} clases
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
