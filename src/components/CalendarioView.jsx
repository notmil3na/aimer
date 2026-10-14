import { useState, useMemo, useCallback, useEffect } from "react";
import styles from "./CalendarioView.module.css";
import { semesterDatesFor } from "../utils/semesterCountdown.js";
import { REMINDER_OPTIONS } from "../utils/reminders";
import { uuid } from "../utils/notasClase";
import useBodyScrollLock from "../hooks/useBodyScrollLock";
import {
  IconExamen, IconQuiz, IconTarea, IconProyecto, IconForo, IconLaboratorio, IconInforme, IconTaller, IconEvento,
  IconInicio, IconFin, IconClose, IconEdit, IconChevronLeft, IconChevronRight
} from "./Icons";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_CORTOS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const TIPO_EVENTO = [
  { id: "examen",      label: "Examen",       Icon: IconExamen, color: "#E87098" },
  { id: "quiz",        label: "Quiz",          Icon: IconQuiz, color: "#B882E8" },
  { id: "tarea",       label: "Tarea",         Icon: IconTarea, color: "#6BA3E8" },
  { id: "proyecto",    label: "Proyecto",      Icon: IconProyecto, color: "#E8946B" },
  { id: "foro",        label: "Foro",          Icon: IconForo, color: "#5CC8A5" },
  { id: "laboratorio", label: "Laboratorio",   Icon: IconLaboratorio, color: "#E8B86B" },
  { id: "informe",     label: "Informe",       Icon: IconInforme, color: "#6B8AE8" },
  { id: "taller",      label: "Taller",        Icon: IconTaller, color: "#C87CE0" },
  { id: "evento",      label: "Evento",        Icon: IconEvento, color: "#6EC8A8" },
  { id: "inicio_semestre", label: "Inicio semestre", Icon: IconInicio, color: "#6EC88A" },
  { id: "fin_semestre", label: "Fin semestre",  Icon: IconFin, color: "#e07070" },
];

function toISODate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseISODate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const MESES_CORTOS = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function formatTime(h) {
  if (!h) return "";
  const [hh, mm] = h.split(":").map(Number);
  const period = hh >= 12 ? "p.m." : "a.m.";
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return mm === 0 ? `${h12} ${period}` : `${h12}:${String(mm).padStart(2, "0")} ${period}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDiasEnMes(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getPrimerDiaLunes(year, month) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function EventoBadge({ evento, materias }) {
  const tipo = TIPO_EVENTO.find(t => t.id === evento.tipo) || TIPO_EVENTO[4];
  const mat = materias.find(m => m.id === evento.materiaId);
  return (
    <div className={styles.eventoBadge} style={{ "--ev-color": tipo.color }}>
      <span className={styles.eventoIcon}><tipo.Icon size={14} /></span>
      <div className={styles.eventoBadgeInfo}>
        <span className={styles.eventoBadgeTitle}>{evento.titulo || tipo.label}</span>
        {mat && <span className={styles.eventoBadgeMateria}>{mat.id} - {mat.nombre}</span>}
        {evento.hora || evento.horaInicio ? <span className={styles.eventoBadgeHora}>{formatTime(evento.hora || evento.horaInicio)}{evento.horaFin ? ` – ${formatTime(evento.horaFin)}` : ""}</span> : null}
        {evento.lugar && <span className={styles.eventoBadgeLugar}>{evento.lugar}</span>}
      </div>
    </div>
  );
}

function EventoModal({ onClose, onSave, evento, materias, cortes }) {
  useBodyScrollLock();
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(evento ? {
    ...evento,
    hora: evento.hora || evento.horaInicio || "",
    notificar: evento.notificar !== false,
    recordatorio: evento.recordatorio ?? 1,
  } : {
    id: uuid(), tipo: "examen", fecha: toISODate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()),
    hora: "", materiaId: "", lugar: "", descripcion: "",
    esBinas: false, corteIdx: 0, temas: [], recordatorio: 1, notificar: true,
  });

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const isExamenQuiz = form.tipo === "examen" || form.tipo === "quiz";
  const tipoInfo = TIPO_EVENTO.find(t => t.id === form.tipo);

  const handleSubmit = () => {
    const e = {};
    if (isExamenQuiz && !form.materiaId) e.materia = "Selecciona una materia";
    if (!form.fecha) e.fecha = "Selecciona la fecha";
    if (isExamenQuiz && !form.hora) e.hora = "Selecciona la hora";
    setErrors(e);
    if (Object.keys(e).length === 0) onSave(form);
  };

  const addTema = () => {
    update("temas", [...(form.temas || []), { id: uuid(), nombre: "", estudiado: false }]);
  };
  const updateTema = (i, field, val) => {
    const t = [...form.temas];
    t[i] = { ...t[i], [field]: val };
    update("temas", t);
  };
  const removeTema = (i) => {
    update("temas", form.temas.filter((_, idx) => idx !== i));
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{evento?.id ? "Editar" : "Nuevo"} evento</h3>
          <button className={styles.modalClose} onClick={onClose}><IconClose size={14} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label>Tipo</label>
              <div className={styles.tipoGrid}>
                {TIPO_EVENTO.filter(t => !["inicio_semestre","fin_semestre"].includes(t.id)).map(t => (
                  <button key={t.id}
                    className={`${styles.tipoBtn} ${form.tipo === t.id ? styles.tipoBtnActive : ""}`}
                    style={{ "--t-color": t.color }}
                    onClick={() => update("tipo", t.id)}
                  >
                    <span><t.Icon size={13} /></span> <span className={styles.tipoLabel}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(form.tipo === "evento" || form.tipo === "tarea" || form.tipo === "proyecto") && (
            <div className={styles.formField}>
              <label>Nombre</label>
              <input type="text" className={styles.textInput} value={form.titulo}
                placeholder={tipoInfo?.label || "Nombre del evento"}
                onChange={e => update("titulo", e.target.value)} />
            </div>
          )}

          <div className={styles.formField}>
            <label>Materia</label>
            <select className={styles.select} value={form.materiaId}
              aria-invalid={errors.materia ? "true" : undefined}
              onChange={e => update("materiaId", e.target.value)}>
              <option value="">Seleccionar...</option>
              {materias.map(m => <option key={m.id} value={m.id}>{m.id} - {m.nombre}</option>)}
            </select>
            {errors.materia && <span className={styles.formError}>{errors.materia}</span>}
          </div>

          <div className={styles.formRow2}>
            <div className={styles.formField}>
              <label>Fecha</label>
              <input type="date" className={styles.textInput} value={form.fecha}
                aria-invalid={errors.fecha ? "true" : undefined}
                onChange={e => update("fecha", e.target.value)} />
              {errors.fecha && <span className={styles.formError}>{errors.fecha}</span>}
            </div>
            <div className={styles.formField}>
              <label>Hora</label>
              <input type="time" className={styles.textInput} value={form.hora}
                aria-invalid={errors.hora ? "true" : undefined}
                onChange={e => update("hora", e.target.value)} />
              {errors.hora && <span className={styles.formError}>{errors.hora}</span>}
            </div>
          </div>

          <div className={styles.formField}>
            <label>Lugar</label>
            <input type="text" className={styles.textInput} value={form.lugar}
              placeholder="Salón, edificio..." onChange={e => update("lugar", e.target.value)} />
          </div>

          <div className={styles.formField}>
            <label>Notificación del evento</label>
            <div className={styles.notifyRow}>
              <button type="button"
                className={`${styles.toggleBtn} ${form.notificar ? styles.toggleBtnOn : ""}`}
                onClick={() => update("notificar", !form.notificar)}>
                {form.notificar ? "Notificar" : "Sin notificación"}
              </button>
              <select className={styles.select} value={form.recordatorio ?? 1}
                disabled={!form.notificar}
                onChange={e => update("recordatorio", Number(e.target.value))}>
                {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.formField}>
            <label>Nota</label>
            <textarea className={styles.textarea} value={form.descripcion}
              placeholder="Notas, detalles..." rows={3}
              onChange={e => update("descripcion", e.target.value)} />
          </div>

          {isExamenQuiz && (
            <>
              <div className={styles.formRow2}>
                <div className={styles.formField}>
                  <label>En binas</label>
                  <button className={`${styles.toggleBtn} ${form.esBinas ? styles.toggleBtnOn : ""}`}
                    onClick={() => update("esBinas", !form.esBinas)}>
                    {form.esBinas ? "Sí" : "No"}
                  </button>
                </div>
                <div className={styles.formField}>
                  <label>Corte</label>
                  <select className={styles.select} value={form.corteIdx ?? 0}
                    onChange={e => update("corteIdx", Number(e.target.value))}>
                    {cortes.map((c, i) => <option key={i} value={i}>{c.nombre || `Corte ${i + 1}`}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.formField}>
                <label>Temas evaluados</label>
                <div className={styles.temasList}>
                  {(form.temas || []).map((tema, i) => (
                    <div key={tema.id} className={styles.temaRow}>
                      <input type="text" className={styles.textInput} value={tema.nombre}
                        placeholder="Tema..." onChange={e => updateTema(i, "nombre", e.target.value)} />
                      <button className={styles.removeBtn} onClick={() => removeTema(i)}>×</button>
                    </div>
                  ))}
                  <button className={styles.addItemBtn} onClick={addTema}>+ Tema</button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSubmit}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarioView({ malla, calendarioData, onSave, asignacionesData, onSaveAsignaciones }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [modalEvent, setModalEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const eventos = calendarioData?.eventos || [];
  const allAsignaciones = asignacionesData?.items || [];
  const semestreCfg = calendarioData?.semestre || null;
  const semStart = semesterDatesFor(semestreCfg).start;
  const semEnd = semesterDatesFor(semestreCfg).end;
  const allMaterias = malla.flatMap(s => s.materias);
  const cortesMaterias = malla.flatMap(s => s.materias).filter(m => m.estado === "cursando");

  const semStartISO = toISODate(semStart.getFullYear(), semStart.getMonth(), semStart.getDate());
  const semEndISO = toISODate(semEnd.getFullYear(), semEnd.getMonth(), semEnd.getDate());

  const syncSemesterEvents = useCallback(() => {
    const evts = [...eventos];
    let changed = false;

    const setEvent = (tipo, titulo, fecha) => {
      const idx = evts.findIndex(e => e.tipo === tipo);
      if (idx >= 0) {
        if (evts[idx].fecha !== fecha) {
          evts[idx] = { ...evts[idx], fecha };
          changed = true;
        }
      } else {
        evts.push({ id: uuid(), tipo, titulo, fecha });
        changed = true;
      }
    };

    setEvent("inicio_semestre", "Inicio de semestre", semStartISO);
    setEvent("fin_semestre", "Fin de semestre", semEndISO);

    if (changed) onSave({ eventos: evts, ...(semestreCfg ? { semestre: semestreCfg } : {}) });
  }, [eventos, onSave, semStartISO, semEndISO, semestreCfg]);

  useEffect(() => { syncSemesterEvents(); }, [syncSemesterEvents]);

  const eventosPorFecha = useMemo(() => {
    const map = {};
    eventos.forEach(ev => {
      if (!map[ev.fecha]) map[ev.fecha] = [];
      map[ev.fecha].push(ev);
    });
    return map;
  }, [eventos]);

  const rangoEventosPorFecha = useMemo(() => {
    const map = {};
    for (const ev of eventos) {
      if (!ev.fecha || !ev.fechaFin || ev.fechaFin <= ev.fecha) continue;
      const [y0, m0, d0] = ev.fecha.split("-").map(Number);
      const [y1, m1, d1] = ev.fechaFin.split("-").map(Number);
      if (!y0 || !m0 || !d0 || !y1 || !m1 || !d1) continue;
      const start = new Date(y0, m0 - 1, d0);
      const end = new Date(y1, m1 - 1, d1);
      if ((end - start) / 86400000 > 366) continue;
      for (let cur = start; cur <= end; cur.setDate(cur.getDate() + 1)) {
        const key = toISODate(cur.getFullYear(), cur.getMonth(), cur.getDate());
        if (!map[key]) map[key] = [];
        map[key].push(ev);
      }
    }
    return map;
  }, [eventos]);

  const diasEnMes = getDiasEnMes(year, month);
  const primerLunes = getPrimerDiaLunes(year, month);
  const celdas = [];
  for (let i = 0; i < primerLunes; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const eventosSeleccionados = selectedDay ? (eventosPorFecha[toISODate(year, month, selectedDay)] || []) : [];

  const proximosEventos = useMemo(() => {
    const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());
    return eventos
      .filter(ev => ev.fecha >= todayISO)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 12);
  }, [eventos]);

  const handleSaveEvento = (ev) => {
    const exists = eventos.findIndex(e => e.id === ev.id);
    const prev = exists >= 0 ? eventos[exists] : null;
    const isAsignacion = ev.tipo === "examen" || ev.tipo === "quiz" || ev.tipo === "tarea" || ev.tipo === "proyecto" || ev.tipo === "foro" || ev.tipo === "laboratorio" || ev.tipo === "informe" || ev.tipo === "taller";

    const evFinal = { ...ev };
    let items = [...allAsignaciones];
    if (isAsignacion) {
      const prevAsign = prev?.assignmentId ? allAsignaciones.find(a => a.id === prev.assignmentId) : null;
      const newItem = {
        id: prevAsign?.id || ev.assignmentId || uuid(),
        calendarId: evFinal.id,
        tipo: ev.tipo, titulo: ev.titulo || "", materiaId: ev.materiaId || "",
        lugar: ev.lugar || "", descripcion: ev.descripcion || "",
        esBinas: !!ev.esBinas, corteIdx: ev.corteIdx ?? 0, temas: ev.temas || [],
        recordatorio: ev.recordatorio ?? 1, notificar: ev.notificar !== false,
        completada: prevAsign?.completada || false,
        valoracion: prevAsign?.valoracion ?? "",
        nota: prevAsign?.nota,
        fechaFin: ev.fechaFin || "",
      };
      if (ev.tipo === "examen" || ev.tipo === "quiz") {
        newItem.fechaExamen = ev.fecha || "";
        newItem.fechaEntrega = "";
        newItem.horaExamen = ev.hora || "";
        newItem.horaEntrega = "";
      } else {
        newItem.fechaExamen = "";
        newItem.fechaEntrega = ev.fecha || "";
        newItem.horaExamen = "";
        newItem.horaEntrega = ev.hora || "";
      }
      evFinal.assignmentId = newItem.id;
      if (prevAsign) items = items.map(a => a.id === prevAsign.id ? newItem : a);
      else items = [...items, newItem];
    } else if (prev?.assignmentId) {
      items = items.filter(a => a.id !== prev.assignmentId);
    }

    const updated = exists >= 0 ? eventos.map((e, i) => i === exists ? evFinal : e) : [...eventos, evFinal];
    onSave({ eventos: updated, ...(semestreCfg ? { semestre: semestreCfg } : {}) });
    if (isAsignacion || prev?.assignmentId) onSaveAsignaciones({ items });
    setShowModal(false);
    setModalEvent(null);
  };

  const handleDeleteEvento = (id) => {
    const ev = eventos.find(e => e.id === id);
    onSave({ eventos: eventos.filter(e => e.id !== id), ...(semestreCfg ? { semestre: semestreCfg } : {}) });
    if (ev?.assignmentId) {
      onSaveAsignaciones({ items: allAsignaciones.filter(a => a.id !== ev.assignmentId) });
    }
    setShowModal(false);
    setModalEvent(null);
    setSelectedDay(null);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Calendario</h2>
          <p className={styles.subtitle}>{MESES[month]} {year}</p>
        </div>
        <button className={styles.addBtn} onClick={() => { setModalEvent(null); setShowModal(true); }}>
          + Evento
        </button>
      </div>

      <div className={styles.layout}>
        <div className={styles.calendarPanel}>
          <div className={styles.calNav}>
            <button className={styles.navBtn} onClick={prevMonth}><IconChevronLeft size={12} /></button>
            <span className={styles.navTitle}>{MESES[month]} {year}</span>
            <button className={styles.navBtn} onClick={nextMonth}><IconChevronRight size={12} /></button>
          </div>

          <div className={styles.calGrid}>
            {DIAS_CORTOS.map(d => (
              <div key={d} className={styles.calDayHeader}>{d}</div>
            ))}
            {celdas.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} className={styles.calCellEmpty} />;
              const fecha = toISODate(year, month, day);
              const evs = eventosPorFecha[fecha] || [];
              const rangeEvs = rangoEventosPorFecha[fecha] || [];
              const rangeTipo = rangeEvs[0] ? (TIPO_EVENTO.find(t => t.id === rangeEvs[0].tipo) || TIPO_EVENTO[4]) : null;
              const isToday = isCurrentMonth && today.getDate() === day;
              const isSelected = selectedDay === day;
              return (
                <div
                  key={day}
                  className={`${styles.calCell} ${isToday ? styles.calCellToday : ""} ${isSelected ? styles.calCellSelected : ""} ${rangeTipo ? styles.calCellRange : ""}`}
                  style={rangeTipo ? { "--range-color": rangeTipo.color } : undefined}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                >
                  <span className={styles.calDayNum}>{day}</span>
                  <div className={styles.calDots}>
                    {evs.slice(0, 3).map((ev, j) => {
                      const tipo = TIPO_EVENTO.find(t => t.id === ev.tipo) || TIPO_EVENTO[4];
                      return <span key={j} className={styles.calDot} style={{ background: tipo.color }} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedDay && (
            <div className={styles.selectedDayPanel}>
              <div className={styles.selectedDayHeader}>
                <h3 className={styles.selectedDayTitle}>
                  {selectedDay} de {MESES[month]}
                </h3>
                <button className={styles.addSmallBtn} onClick={() => {
                  setModalEvent({ id: uuid(), tipo: "examen", fecha: toISODate(year, month, selectedDay), hora: "", materiaId: "", lugar: "", descripcion: "", esBinas: false, corteIdx: 0, temas: [], recordatorio: 1, notificar: true });
                  setShowModal(true);
                }}>+ Agregar</button>
              </div>
              {eventosSeleccionados.length === 0 && (
                <p className={styles.noEvents}>Sin eventos este día</p>
              )}
              {eventosSeleccionados.map(ev => (
                <div key={ev.id} className={styles.selectedEvento}>
                  <EventoBadge evento={ev} materias={allMaterias} />
                  <div className={styles.selectedEventoActions}>
                    <button className={styles.editBtn} onClick={() => { setModalEvent(ev); setShowModal(true); }}><IconEdit size={13} /></button>
                    <button className={styles.deleteBtn} onClick={() => handleDeleteEvento(ev.id)}><IconClose size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>Próximos eventos</h3>
          {proximosEventos.length === 0 && (
            <p className={styles.sidebarEmpty}>Todavía no hay eventos próximos</p>
          )}
          <div className={styles.sidebarList}>
            {proximosEventos.map(ev => {
              const tipo = TIPO_EVENTO.find(t => t.id === ev.tipo) || TIPO_EVENTO[4];
              const mat = allMaterias.find(m => m.id === ev.materiaId);
              const fecha = parseISODate(ev.fecha);
              return (
                <div key={ev.id} className={styles.sidebarItem} onClick={() => { setModalEvent(ev); setShowModal(true); }}>
                  <div className={styles.sidebarItemDot} style={{ background: tipo.color }} />
                  <div className={styles.sidebarItemInfo}>
                    <span className={styles.sidebarItemTitle}>{ev.titulo || tipo.label}</span>
                    {mat && <span className={styles.sidebarItemMateria}>{mat.id}</span>}
                    <span className={styles.sidebarItemDate}>
                      {fecha.getDate()} {MESES_CORTOS[fecha.getMonth() + 1]}
                      {ev.hora || ev.horaInicio ? ` · ${formatTime(ev.hora || ev.horaInicio)}` : ""}
                    </span>
                  </div>
                   <span className={styles.sidebarItemIcon}><tipo.Icon size={13} /></span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showModal && (
        <EventoModal
          onClose={() => { setShowModal(false); setModalEvent(null); }}
          onSave={handleSaveEvento}
          evento={modalEvent}
          materias={cortesMaterias}
          cortes={cortesMaterias.length > 0 ? [{ nombre: "Corte 1", peso: 33 }, { nombre: "Corte 2", peso: 33 }, { nombre: "Corte 3", peso: 34 }] : []}
        />
      )}
    </div>
  );
}
