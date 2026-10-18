import { useState, useMemo } from "react";
import styles from "./AsignacionesView.module.css";
import {
  IconExamen, IconQuiz, IconTarea, IconProyecto, IconForo, IconLaboratorio, IconInforme, IconTaller, IconClose, IconEdit, IconTrash, IconClipboard, IconCheck, IconChevronUp, IconChevronDown
} from "./Icons";
import { HORAS_FORM } from "../utils/horarioHelpers";
import { semesterDatesFor, semesterCorteFor } from "../utils/semesterCountdown";
import { REMINDER_OPTIONS } from "../utils/reminders";
import { uuid } from "../utils/notasClase";
import useBodyScrollLock from "../hooks/useBodyScrollLock";

const NOTA_PASS_PCT = 0.6;

const MESES_CORTOS = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

const HORA_OPTIONS = HORAS_FORM.map((h) => {
  const [time, period] = h.split(" ");
  const [hh, mm] = time.split(":");
  let h24 = Number(hh);
  if (period.startsWith("p") && h24 !== 12) h24 += 12;
  if (period.startsWith("a") && h24 === 12) h24 = 0;
  return { value: `${String(h24).padStart(2, "0")}:${mm}`, label: h };
});

function toISODate(anio, dia, mes) {
  if (!dia || !mes) return "";
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES_CORTOS[m]}`;
}

function getAssignmentStatus(item) {
  if (item.completada) return { label: "Completada", tone: "done" };
  const dueIso = item.fechaExamen || item.fechaEntrega || item.fechaFin;
  if (!dueIso) return { label: "Sin fecha", tone: "neutral" };
  const today = new Date();
  const dueDate = new Date(`${dueIso}T23:59:59`);
  return dueDate < today ? { label: "Vencida", tone: "overdue" } : { label: "Pendiente", tone: "pending" };
}

const TIPO_INFO = {
  examen:      { label: "Examen",      Icon: IconExamen,      color: "#E87098" },
  quiz:        { label: "Quiz",        Icon: IconQuiz,        color: "#B882E8" },
  tarea:       { label: "Tarea",       Icon: IconTarea,       color: "#6BA3E8" },
  proyecto:    { label: "Proyecto",    Icon: IconProyecto,    color: "#E8946B" },
  foro:        { label: "Foro",        Icon: IconForo,        color: "#5CC8A5" },
  laboratorio: { label: "Laboratorio", Icon: IconLaboratorio, color: "#E8B86B" },
  informe:     { label: "Informe",     Icon: IconInforme,     color: "#6B8AE8" },
  taller:      { label: "Taller",      Icon: IconTaller,      color: "#C87CE0" },
};

const PESOS_DEFAULT = [150, 150, 200];

function migrateCortes(cortes) {
  if (!cortes || cortes.length === 0) {
    return PESOS_DEFAULT.map((peso, i) => ({ nombre: `Corte ${i + 1}`, peso, items: [] }));
  }
  const legacyPct = cortes.reduce((s, c) => s + (parseFloat(c.peso) || 0), 0) === 100;
  return cortes.map((c, i) => {
    if (c.items) {
      return legacyPct ? { ...c, peso: PESOS_DEFAULT[i] ?? c.peso } : c;
    }
    const peso = legacyPct ? (PESOS_DEFAULT[i] ?? c.peso) : parseFloat(c.peso) || 100;
    return {
      nombre: c.nombre || `Corte ${i + 1}`,
      peso,
      items: c.nota !== "" && c.nota !== undefined
        ? [{ nombre: "Evaluación", nota: Math.round((Number(c.nota) / 500) * peso), notaMax: peso }]
        : [],
    };
  });
}

function AsignacionCard({ item, allMaterias, onUpdate, onDelete, onEdit, onSyncCalendar, cortesData }) {
  const [expanded, setExpanded] = useState(false);
  const info = TIPO_INFO[item.tipo] || TIPO_INFO.tarea;
  const mat = allMaterias.find(m => m.id === item.materiaId);
  const isExamenQuiz = item.tipo === "examen" || item.tipo === "quiz";
  const status = getAssignmentStatus(item);
  const dueIso = item.fechaExamen || item.fechaEntrega || item.fechaFin;
  const statusClass = status.tone === "done"
    ? styles.cardStatusDone
    : status.tone === "overdue"
      ? styles.cardStatusOverdue
      : status.tone === "pending"
        ? styles.cardStatusPending
        : styles.cardStatusNeutral;

  const toggleTema = (i) => {
    const temas = [...item.temas];
    temas[i] = { ...temas[i], estudiado: !temas[i].estudiado };
    onUpdate({ ...item, temas });
  };
  const addTema = () => {
    onUpdate({ ...item, temas: [...(item.temas || []), { id: uuid(), nombre: "", estudiado: false }] });
  };
  const updateTema = (i, val) => {
    const temas = [...item.temas];
    temas[i] = { ...temas[i], nombre: val };
    onUpdate({ ...item, temas });
  };
  const removeTema = (i) => {
    onUpdate({ ...item, temas: item.temas.filter((_, idx) => idx !== i) });
  };

  const handleGrade = (nota) => {
    const val = Number(item.valoracion) || 100;
    const completada = nota !== "";
    const updated = { ...item, nota: nota === "" ? undefined : Number(nota), completada };
    onUpdate(updated);
    if (item.corteIdx !== undefined && item.materiaId) {
      const corteIdx = item.corteIdx;
      const nombre = `${info.label}${item.titulo ? `: ${item.titulo}` : ""}`;
      const cursando = cortesData[item.materiaId] || { cortes: migrateCortes([]) };
      const cortes = migrateCortes(cursando.cortes);
      if (cortes[corteIdx]) {
        if (nota === "") {
          cortes[corteIdx].items = (cortes[corteIdx].items || []).filter(it => it.nombre !== nombre);
        } else {
          const newItem = { nombre, nota: Number(nota), notaMax: val };
          const existingItemIdx = cortes[corteIdx].items.findIndex(it => it.nombre === nombre);
          if (existingItemIdx >= 0) {
            cortes[corteIdx].items[existingItemIdx] = newItem;
          } else {
            cortes[corteIdx].items.push(newItem);
          }
        }
        onSyncCalendar(item.materiaId, { ...cursando, cortes });
      }
    }
  };

  const temasSorted = [...(item.temas || [])].sort((a, b) => a.estudiado - b.estudiado);
  const temasDone = (item.temas || []).filter(t => t.estudiado).length;
  const temasTotal = (item.temas || []).length;

  return (
    <div className={`${styles.card} ${item.nota ? styles.cardGraded : ""} ${item.completada ? styles.cardCompleted : ""}`} style={{ "--card-color": info.color }}>
      <div className={styles.cardHeader} onClick={() => setExpanded(v => !v)}>
        <div className={styles.cardBody}>
          <div className={styles.cardTop}>
            <span className={styles.cardTipo} style={{ color: info.color }}><info.Icon size={11} /> {info.label}</span>
            <span className={`${styles.cardStatus} ${statusClass}`}>{status.label}</span>
            {dueIso ? <span className={styles.cardDatePill}>{formatDate(dueIso)}</span> : null}
          </div>
          <p className={styles.cardTitle}>{item.titulo || info.label}</p>
          {mat && <p className={styles.cardMateria}>{mat.id} — {mat.nombre}</p>}
          <div className={styles.cardMeta}>
            {item.valoracion && <span className={styles.cardMetaItem}> vale {item.valoracion} pts</span>}
            {isExamenQuiz && item.esBinas && <span className={styles.cardMetaItem}>Binas</span>}
            {item.lugar && <span className={styles.cardMetaItem}>▪ {item.lugar}</span>}
            {item.temas?.length > 0 && (
              <span className={styles.cardMetaItem}>☰ {temasDone}/{temasTotal} temas</span>
            )}
          </div>
        </div>
        <div className={styles.cardRight}>
          {item.nota !== undefined && item.nota !== null ? (
            <span className={styles.cardNota} style={{ color: (item.nota / (Number(item.valoracion) || 100)) >= NOTA_PASS_PCT ? "#6ec88a" : "#e07070" }}>
              {item.nota}
              <span className={styles.cardNotaMax}>/{item.valoracion || "?"}</span>
            </span>
          ) : (
            <span className={styles.cardPendiente}>Pendiente</span>
          )}
          <span className={styles.expandIcon}>{expanded ? <IconChevronUp size={10} /> : <IconChevronDown size={10} />}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.cardExpanded}>
          {item.descripcion && (
                <p className={`${styles.cardDesc} selectable`}>{item.descripcion}</p>
          )}

          <div className={styles.gradeRow}>
            <div className={styles.formField}>
              <label>Nota /{item.valoracion || "?"}</label>
              <input type="number" min={0} max={Number(item.valoracion) || 500} step="0.1"
                className={styles.gradeInput} value={item.nota ?? ""}
                placeholder="—" onChange={e => handleGrade(e.target.value)} />
            </div>
            {item.nota !== undefined && item.nota !== null && (
              <span className={styles.gradeBadge}
                style={{ color: (item.nota / (Number(item.valoracion) || 100)) >= NOTA_PASS_PCT ? "#6ec88a" : "#e07070",
                  background: (item.nota / (Number(item.valoracion) || 100)) >= NOTA_PASS_PCT ? "rgba(110,200,138,0.15)" : "rgba(224,112,112,0.15)" }}>
                = {(item.nota / (Number(item.valoracion) || 100) * 5).toFixed(2)} /5.0
              </span>
            )}
          </div>

          {isExamenQuiz && (
            <div className={styles.temasSection}>
              <div className={styles.temasHeader}>
                <span className={styles.temasLabel}>Temas evaluados</span>
                <span className={styles.temasCount}>{temasDone}/{temasTotal}</span>
              </div>
              <div className={styles.temasList}>
                {temasSorted.map((tema, i) => (
                  <div key={tema.id} className={`${styles.temaRow} ${tema.estudiado ? styles.temaRowDone : ""}`}
                    onClick={() => toggleTema(item.temas.indexOf(tema))}>
                    <span className={styles.temaCheck} onClick={e => e.stopPropagation()}>
                      {tema.estudiado ? <IconCheck size={13} /> : <span className={styles.temaCheckEmpty} />}
                    </span>
                    <input type="text" className={styles.temaInput} value={tema.nombre}
                      placeholder="Tema..."
                      onClick={e => e.stopPropagation()}
                      onChange={e => updateTema(item.temas.indexOf(tema), e.target.value)} />
                    <button className={styles.removeBtn} onClick={e => { e.stopPropagation(); removeTema(item.temas.indexOf(tema)); }}><IconClose size={11} /></button>
                  </div>
                ))}
                <button className={styles.addItemBtn} onClick={addTema}>+ Tema</button>
              </div>
            </div>
          )}

          <div className={styles.cardActions}>
            <button className={styles.editBtn} onClick={() => onEdit(item.id)}><IconEdit size={11} /> Editar</button>
            <button className={styles.deleteBtn} onClick={() => onDelete(item.id)}><IconTrash size={11} /> Eliminar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AsignacionesView({ malla, asignacionesData, onSave, cursandoData, onSaveCursando, calendarioData, onSaveCalendario, semestre }) {
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterMateria, setFilterMateria] = useState("todas");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showCompleted, setShowCompleted] = useState(true);

  const anioSemestre = semesterDatesFor(semestre).start.getFullYear();
  const corteSemestre = semesterCorteFor(semestre);

  const items = asignacionesData?.items || [];
  const allMaterias = malla.flatMap(s => s.materias);
  const cursandoMaterias = allMaterias.filter(m => m.estado === "cursando");

  const sortItems = (arr) => arr.slice().sort((a, b) => {
    const da = a.fechaExamen || a.fechaEntrega || a.fechaFin || "";
    const db = b.fechaExamen || b.fechaEntrega || b.fechaFin || "";
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : da > db ? 1 : 0;
  });

  const filteredItems = useMemo(() => {
    let result = items;
    if (filterTipo !== "todos") result = result.filter(it => it.tipo === filterTipo);
    if (filterMateria !== "todas") result = result.filter(it => it.materiaId === filterMateria);
    return sortItems(result.filter(it => !it.completada));
  }, [items, filterTipo, filterMateria]);

  const completedItems = useMemo(() => {
    let result = items;
    if (filterTipo !== "todos") result = result.filter(it => it.tipo === filterTipo);
    if (filterMateria !== "todas") result = result.filter(it => it.materiaId === filterMateria);
    return sortItems(result.filter(it => it.completada));
  }, [items, filterTipo, filterMateria]);

  const completedCount = completedItems.length;

  const handleAdd = (newItem) => {
    const { diaExamen, mesExamen, diaEntrega, mesEntrega, diaFinEx, mesFinEx, diaFinEn, mesFinEn, ...rest } = newItem;
    const fechaExamen = toISODate(anioSemestre, diaExamen, mesExamen);
    const fechaEntrega = toISODate(anioSemestre, diaEntrega, mesEntrega);
    const isEx = rest.tipo === "examen" || rest.tipo === "quiz";
    const fechaFin = toISODate(anioSemestre, isEx ? diaFinEx : diaFinEn, isEx ? mesFinEx : mesFinEn);
    const created = { ...rest, id: uuid(), temas: rest.temas || [], completada: false, fechaExamen, fechaEntrega, fechaFin };
    const evts = calendarioData?.eventos || [];
    const fecha = isEx ? fechaExamen : fechaEntrega;
    const hora = isEx ? (rest.horaExamen || "") : (rest.horaEntrega || "");
    if (fecha) {
      const calEvent = {
        id: uuid(), tipo: rest.tipo, fecha, hora,
        materiaId: rest.materiaId || "", lugar: rest.lugar || "",
        descripcion: rest.descripcion || "", fechaFin,
        recordatorio: rest.recordatorio ?? 1, notificar: true,
        assignmentId: created.id,
      };
      created.calendarId = calEvent.id;
      onSaveCalendario({ eventos: [...evts, calEvent] });
    }
    onSave({ items: [...items, created] });
    setShowModal(false);
  };

  const handleUpdate = (updated) => {
    const isEx = updated.tipo === "examen" || updated.tipo === "quiz";
    const fecha = isEx ? updated.fechaExamen : updated.fechaEntrega;
    const hora = isEx ? (updated.horaExamen || "") : (updated.horaEntrega || "");
    let next = updated;
    let newEvts = null;
    const evts = calendarioData?.eventos || [];
    if (updated.calendarId) {
      if (fecha) {
        newEvts = evts.map(ev => ev.id === updated.calendarId
          ? { ...ev, tipo: updated.tipo, fecha, hora, titulo: updated.titulo, materiaId: updated.materiaId, lugar: updated.lugar, descripcion: updated.descripcion, esBinas: updated.esBinas, corteIdx: updated.corteIdx, temas: updated.temas, fechaFin: updated.fechaFin, recordatorio: updated.recordatorio ?? 1, notificar: updated.completada ? false : ev.notificar }
          : ev);
      } else {
        newEvts = evts.filter(ev => ev.id !== updated.calendarId);
        next = { ...updated, calendarId: undefined };
      }
    } else if (fecha) {
      const calEvent = {
        id: uuid(), tipo: updated.tipo, fecha, hora,
        materiaId: updated.materiaId || "", lugar: updated.lugar || "",
        descripcion: updated.descripcion || "", esBinas: updated.esBinas,
        corteIdx: updated.corteIdx, temas: updated.temas, fechaFin: updated.fechaFin,
        recordatorio: updated.recordatorio ?? 1, notificar: true,
        assignmentId: updated.id,
      };
      newEvts = [...evts, calEvent];
      next = { ...updated, calendarId: calEvent.id };
    }
    onSave({ items: items.map(it => it.id === updated.id ? next : it) });
    if (newEvts) onSaveCalendario({ eventos: newEvts });
  };

  const handleEdit = (newItem, original) => {
    const { diaExamen, mesExamen, diaEntrega, mesEntrega, diaFinEx, mesFinEx, diaFinEn, mesFinEn, ...rest } = newItem;
    const fechaExamen = toISODate(anioSemestre, diaExamen, mesExamen);
    const fechaEntrega = toISODate(anioSemestre, diaEntrega, mesEntrega);
    const isEx = rest.tipo === "examen" || rest.tipo === "quiz";
    const fechaFin = toISODate(anioSemestre, isEx ? diaFinEx : diaFinEn, isEx ? mesFinEx : mesFinEn);
    const updated = { ...original, ...rest, fechaExamen, fechaEntrega, fechaFin, temas: rest.temas || [] };
    handleUpdate(updated);
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = (id) => {
    const item = items.find(it => it.id === id);
    onSave({ items: items.filter(it => it.id !== id) });
    if (item?.calendarId) {
      const evts = calendarioData?.eventos || [];
      onSaveCalendario({ eventos: evts.filter(ev => ev.id !== item.calendarId) });
    }
  };

  const handleToggleComplete = (id) => {
    const item = items.find(it => it.id === id);
    if (!item) return;
    const completing = !item.completada;
    onSave({ items: items.map(it => it.id === id ? { ...it, completada: completing } : it) });
    if (item.calendarId) {
      const evts = calendarioData?.eventos || [];
      onSaveCalendario({ eventos: evts.map(ev => ev.id === item.calendarId ? { ...ev, notificar: !completing } : ev) });
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerIntro}>
          <span className={styles.headerBadge}><IconClipboard size={13} /> Gestor de tareas</span>
          <h2 className={styles.title}>Asignaciones</h2>
          <p className={styles.subtitle}>{items.length} asignación{items.length !== 1 ? "es" : ""}</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.addBtn} onClick={() => setShowModal(true)}>+ Asignación</button>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Tipo:</span>
          <div className={styles.filterBtns}>
            <button className={`${styles.filterBtn} ${filterTipo === "todos" ? styles.filterBtnActive : ""}`}
              onClick={() => setFilterTipo("todos")}>Todos</button>
            {Object.entries(TIPO_INFO).map(([key, val]) => (
                <button key={key} className={`${styles.filterBtn} ${filterTipo === key ? styles.filterBtnActive : ""}`}
                  style={{ "--f-color": val.color }}
                  onClick={() => setFilterTipo(key)}>
                  <val.Icon size={10} /> {val.label}
                </button>
            ))}
          </div>
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Materia:</span>
          <select className={styles.filterSelect} value={filterMateria} onChange={e => setFilterMateria(e.target.value)}>
            <option value="todas">Todas</option>
            {cursandoMaterias.map(m => <option key={m.id} value={m.id}>{m.id} - {m.nombre}</option>)}
          </select>
        </div>
      </div>

      {filteredItems.length === 0 && completedCount === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><IconClipboard size={32} /></span>
          <p>No hay asignaciones {filterTipo !== "todos" || filterMateria !== "todas" ? "con estos filtros" : "todavía"}</p>
          <p>Toca <strong>+ Asignación</strong> para crear la primera.</p>
        </div>
      )}

      {filteredItems.length > 0 && (
        <div className={styles.cardsList}>
          {filteredItems.map(item => (
            <AsignacionCard
              key={item.id}
              item={item}
              allMaterias={allMaterias}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onEdit={(id) => setEditing(items.find(it => it.id === id))}
              onSyncCalendar={(materiaId, data) => onSaveCursando({ ...cursandoData, [materiaId]: data })}
              cortesData={cursandoData}
            />
          ))}
        </div>
      )}

      {completedCount > 0 && (
        <div className={styles.completedSection}>
          <button className={styles.completedToggle} onClick={() => setShowCompleted(v => !v)}>
            <IconCheck size={14} />
            <span>Completadas ({completedCount})</span>
            <span className={styles.completedChevron}>{showCompleted ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}</span>
          </button>
          {showCompleted && (
            <div className={styles.cardsList}>
              {completedItems.map(item => (
                <AsignacionCard
                  key={item.id}
                  item={item}
                  allMaterias={allMaterias}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onEdit={(id) => setEditing(items.find(it => it.id === id))}
                  onSyncCalendar={(materiaId, data) => onSaveCursando({ ...cursandoData, [materiaId]: data })}
                  cortesData={cursandoData}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {(showModal || editing) && (
        <AddModal
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={editing ? (form) => handleEdit(form, editing) : handleAdd}
          materias={cursandoMaterias}
          cortesData={cursandoData}
          anioSemestre={anioSemestre}
          corteSemestre={corteSemestre}
          initial={editing}
        />
      )}
    </div>
  );
}

function AddModal({ onClose, onSave, materias, cortesData, anioSemestre, corteSemestre, initial }) {
  useBodyScrollLock();
  const fechaEx = initial?.fechaExamen ? initial.fechaExamen.split("-") : [];
  const fechaEn = initial?.fechaEntrega ? initial.fechaEntrega.split("-") : [];
  const fechaFin = initial?.fechaFin ? initial.fechaFin.split("-") : [];
  const hasRangoInitial = !!(initial?.fechaFin);
  const [form, setForm] = useState(initial ? {
    tipo: initial.tipo || "examen", titulo: initial.titulo || "", materiaId: initial.materiaId || "",
    diaExamen: fechaEx[2] || "", mesExamen: fechaEx[1] || "", horaExamen: initial.horaExamen || "",
    diaEntrega: fechaEn[2] || "", mesEntrega: fechaEn[1] || "", horaEntrega: initial.horaEntrega || "",
    diaFinEx: initial.tipo === "examen" || initial.tipo === "quiz" ? (fechaFin[2] || "") : "",
    mesFinEx: initial.tipo === "examen" || initial.tipo === "quiz" ? (fechaFin[1] || "") : "",
    diaFinEn: initial.tipo !== "examen" && initial.tipo !== "quiz" ? (fechaFin[2] || "") : "",
    mesFinEn: initial.tipo !== "examen" && initial.tipo !== "quiz" ? (fechaFin[1] || "") : "",
    lugar: initial.lugar || "", descripcion: initial.descripcion || "", valoracion: initial.valoracion ?? "", esBinas: !!initial.esBinas,
    corteIdx: initial.corteIdx ?? 0, temas: initial.temas || [], recordatorio: initial.recordatorio ?? 1,
  } : {
    tipo: "examen", titulo: "", materiaId: "",
    diaExamen: "", mesExamen: "", horaExamen: "",
    diaEntrega: "", mesEntrega: "", horaEntrega: "",
    diaFinEx: "", mesFinEx: "", diaFinEn: "", mesFinEn: "",
    lugar: "", descripcion: "", valoracion: "", esBinas: false,
    corteIdx: 0, temas: [], recordatorio: 1,
  });
  const [usarRango, setUsarRango] = useState(hasRangoInitial);
  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const isExamenQuiz = form.tipo === "examen" || form.tipo === "quiz";

  const cortesMateria = useMemo(() => {
    if (!form.materiaId || !cortesData?.[form.materiaId]) return [];
    const cur = cortesData[form.materiaId];
    return migrateCortes(cur.cortes);
  }, [form.materiaId, cortesData]);

  const handleMateriaChange = (materiaId) => {
    setForm(p => ({ ...p, materiaId, corteIdx: 0 }));
  };

  const addTema = () => update("temas", [...form.temas, { id: uuid(), nombre: "", estudiado: false }]);
  const updateTema = (i, val) => { const t = [...form.temas]; t[i] = { ...t[i], nombre: val }; update("temas", t); };
  const removeTema = (i) => update("temas", form.temas.filter((_, idx) => idx !== i));

  const fechaLabel = isExamenQuiz ? "Fecha de evaluación" : "Fecha de entrega";
  const diaRango = isExamenQuiz ? "diaFinEx" : "diaFinEn";
  const mesRango = isExamenQuiz ? "mesFinEx" : "mesFinEn";

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{initial ? "Editar asignación" : "Nueva asignación"}</h3>
          <button className={styles.modalClose} onClick={onClose}><IconClose size={14} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formField}>
            <label>Tipo</label>
            <div className={styles.tipoGrid}>
              {Object.entries(TIPO_INFO).map(([key, val]) => (
                <button key={key} className={`${styles.tipoBtn} ${form.tipo === key ? styles.tipoBtnActive : ""}`}
                  style={{ "--t-color": val.color }} onClick={() => update("tipo", key)}>
                  <span><val.Icon size={11} /></span> <span className={styles.tipoLabel}>{val.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formRow2}>
            <div className={styles.formField}>
              <label>Materia</label>
              <select className={styles.select} value={form.materiaId} onChange={e => handleMateriaChange(e.target.value)}>
                <option value="">Seleccionar...</option>
                {materias.map(m => <option key={m.id} value={m.id}>{m.id} - {m.nombre}</option>)}
              </select>
            </div>
            <div className={styles.formField}>
              <label>Título (opcional)</label>
              <input type="text" className={styles.textInput} value={form.titulo}
                placeholder={TIPO_INFO[form.tipo]?.label || "Nombre"} onChange={e => update("titulo", e.target.value)} />
            </div>
          </div>

          <div className={styles.formRow2}>
            <div className={styles.formField}>
              <label>{usarRango ? `${fechaLabel} — Inicio` : fechaLabel}</label>
              <div className={styles.dateRow}>
                <select className={styles.select} value={isExamenQuiz ? form.diaExamen : form.diaEntrega}
                  onChange={e => update(isExamenQuiz ? "diaExamen" : "diaEntrega", e.target.value)}>
                  <option value="">Día</option>
                  {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className={styles.select} value={isExamenQuiz ? form.mesExamen : form.mesEntrega}
                  onChange={e => update(isExamenQuiz ? "mesExamen" : "mesEntrega", e.target.value)}>
                  <option value="">Mes</option>
                  {MESES_CORTOS.filter(Boolean).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <span className={styles.formHint}>Año {anioSemestre} · semestre {corteSemestre}</span>
            </div>
            <div className={styles.formField}>
              <label>Hora</label>
              <select className={styles.select} value={isExamenQuiz ? form.horaExamen : form.horaEntrega}
                onChange={e => update(isExamenQuiz ? "horaExamen" : "horaEntrega", e.target.value)}>
                <option value="">—</option>
                {HORA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {usarRango && (
            <div className={styles.formField}>
              <label>{fechaLabel} — Fin</label>
              <div className={styles.dateRow}>
                <select className={styles.select} value={form[diaRango]} onChange={e => update(diaRango, e.target.value)}>
                  <option value="">Día</option>
                  {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className={styles.select} value={form[mesRango]} onChange={e => update(mesRango, e.target.value)}>
                  <option value="">Mes</option>
                  {MESES_CORTOS.filter(Boolean).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <span className={styles.formHint}>Año {anioSemestre}</span>
            </div>
          )}

          <span className={styles.formHint} role="button" style={{ cursor: "pointer", userSelect: "none" }}
            onClick={() => setUsarRango(v => !v)}>
            {usarRango ? "Usar fecha única" : "¿Rango de fechas?"}
          </span>

          <div className={styles.formRow2}>
            <div className={styles.formField}>
              <label>Puntos máximos</label>
              <input type="number" min={1} className={styles.textInput}
                value={form.valoracion} placeholder="100" onChange={e => update("valoracion", e.target.value)} />
            </div>
            {isExamenQuiz && (
              <div className={styles.formField}>
                <label>En binas</label>
                <button className={`${styles.toggleBtn} ${form.esBinas ? styles.toggleBtnOn : ""}`}
                  onClick={() => update("esBinas", !form.esBinas)}>
                  {form.esBinas ? "Sí" : "No"}
                </button>
              </div>
            )}
          </div>

          <div className={styles.formField}>
            <label>Corte</label>
            <select className={styles.select} value={form.corteIdx} onChange={e => update("corteIdx", Number(e.target.value))}>
              {cortesMateria.length > 0 ? cortesMateria.map((c, i) => (
                <option key={i} value={i}>{c.nombre} ({c.peso} pts)</option>
              )) : (
                <option value={0}>Corte 1</option>
              )}
            </select>
            <span className={styles.formHint}>
              La nota se suma sola al acumulado de este corte en "Semestre"
            </span>
          </div>

          {isExamenQuiz && (
            <div className={styles.formField}>
              <label>Temas evaluados</label>
              <div className={styles.temasList}>
                {form.temas.map((tema, i) => (
                  <div key={tema.id} className={styles.temaRow}>
                    <input type="text" className={styles.textInput} value={tema.nombre}
                      placeholder="Tema..." onChange={e => updateTema(i, e.target.value)} />
                    <button className={styles.removeBtn} onClick={() => removeTema(i)}><IconClose size={11} /></button>
                  </div>
                ))}
                <button className={styles.addItemBtn} onClick={addTema}>+ Tema</button>
              </div>
            </div>
          )}

          <div className={styles.formField}>
            <label>Descripción</label>
            <textarea className={styles.textarea} value={form.descripcion}
              placeholder="Detalles..." rows={3}
              onChange={e => update("descripcion", e.target.value)} />
          </div>

          <div className={styles.formField}>
            <label>Lugar (opcional)</label>
            <input type="text" className={styles.textInput} value={form.lugar}
              placeholder="Salón, edificio..." onChange={e => update("lugar", e.target.value)} />
          </div>

          <div className={styles.formField}>
            <label>Recordatorio</label>
            <select className={styles.select} value={form.recordatorio} onChange={e => update("recordatorio", Number(e.target.value))}>
              {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className={styles.formHint}>Se te notificará antes de la fecha</span>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={() => onSave(form)}>{initial ? "Guardar cambios" : "Crear"}</button>
        </div>
      </div>
    </div>
  );
}
