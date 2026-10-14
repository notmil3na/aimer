import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import {
  HORAS_FORM,
  LEGACY_HORAS,
  buildColorMap,
  normalizeHora,
  toViewHora,
  horaIdx,
  findConflicts,
  formatRangoHora,
} from "../utils/horarioHelpers.js";
import styles from "./HorarioView.module.css";
import {
  IconMar, IconCienaga, IconSierra, IconInnovacion, IconBloque, IconHangar, IconVirtual,
  IconLocation, IconTrash, IconExternalLink, IconEdit, IconClose,
  IconSchedule, IconStar, IconCheck, IconWarning, IconDownload,
  IconChevronLeft, IconChevronRight
} from "./Icons";
import useBodyScrollLock from "../hooks/useBodyScrollLock";

const HorarioExport = lazy(() => import("./HorarioExport"));
const HorarioWallpaper = lazy(() => import("./HorarioWallpaper"));

const EDIFICIOS = [
  { id:"mar_caribe", nombre:"Mar Caribe", IconComp:IconMar, lados:["Norte","Sur"],
    salones: Array.from({length:28},(_,i)=>`${100*(Math.floor(i/7)+1)+(i%7+1)}`), },
  { id:"cienaga_grande", nombre:"Ciénaga Grande", IconComp:IconCienaga, lados:["Norte","Sur"],
    salones: Array.from({length:18},(_,i)=>`${100*(Math.floor(i/6)+1)+(i%6+1)}`), },
  { id:"sierra_nevada", nombre:"Sierra Nevada", IconComp:IconSierra, lados:["Norte","Sur"],
    salones: Array.from({length:18},(_,i)=>`${100*(Math.floor(i/6)+1)+(i%6+1)}`), },
  { id:"edf_innovacion", nombre:"Edificio de Innovación y Emprendimiento", IconComp:IconInnovacion, lados:null,
    salones:["Lab. de Mecánica I", "Lab. de Calor y Ondas"], },
  { id:"bloque_3", nombre:"Bloque 3", IconComp:IconBloque, lados:null,
    salones: Array.from({length:8},(_,i)=>`${i+1}`), },
  { id:"bloque_8", nombre:"Bloque 8", IconComp:IconBloque, lados:null,
    salones: Array.from({length:8},(_,i)=>`${i+1}`), },
  { id:"hangar_a", nombre:"Hangar A", IconComp:IconHangar, lados:null,
    salones:["Lab. Modelado y Simulación", "Lab. Redes"], },
  { id:"espacio_virtual", nombre:"Espacio Virtual", IconComp:IconVirtual, lados:null,
    salones:[], },
];

const OTRO_SALON_IDS = ["bloque_3", "bloque_8", "hangar_a", "edf_innovacion"];
const CUSTOM_SALONES_KEY = "horario_custom_salones_v1";
function getCustomSalones() {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_SALONES_KEY));
    return raw && typeof raw === "object" ? raw : {};
  } catch { return {}; }
}
function saveCustomSalones(obj) {
  try { localStorage.setItem(CUSTOM_SALONES_KEY, JSON.stringify(obj)); } catch {}
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);
  return isMobile;
}

const TODOS_DIAS = [
  {id:"L",label:"Lunes"},{id:"M",label:"Martes"},{id:"X",label:"Miércoles"},
  {id:"J",label:"Jueves"},{id:"V",label:"Viernes"},{id:"S",label:"Sábado"},
];

const HOY_DIA_MAP = { 0: "D", 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S" };

function parseHoraNum(h) {
  if (!h) return 0;
  if (h.includes(":")) {
    const [time, period] = h.split(" ");
    let [hh, mm] = time.split(":").map(Number);
    if (period && period.includes("p") && hh !== 12) hh += 12;
    if (period && period.includes("a") && hh === 12) hh = 0;
    return hh + mm / 60;
  }
  const [hh, mm] = h.split(":").map(Number);
  return hh + (mm || 0) / 60;
}

function buildSalonLabel(edificioId, lado, salon) {
  const ed = EDIFICIOS.find(e=>e.id===edificioId);
  if (!ed) return "";
  if (!ed.lados) return `${ed.nombre} — ${salon}`;
  return `${ed.nombre} ${lado} ${salon}`;
}

function buildEditando(clases, idx) {
  const clase = clases[idx];
  if (!clase) return null;
  if (clase.pairId) {
    const otherIdx = clases.findIndex((c,i)=> i!==idx && c.pairId===clase.pairId);
    if (otherIdx !== -1) {
      const other = clases[otherIdx];
      return {
        idx1: idx, idx2: otherIdx, pairId: clase.pairId,
        materiaId: clase.materiaId, grupo: clase.grupo||"", profesor: clase.profesor||"",
        notas: clase.notas||"",
        dia: clase.dia, horaInicio: clase.horaInicio, horaFin: clase.horaFin,
        edificio: clase.edificio||"", lado: clase.lado||"", salon: clase.salon||"",
        dia2: other.dia, horaInicio2: other.horaInicio, horaFin2: other.horaFin,
        edificio2: other.edificio||"", lado2: other.lado||"", salon2: other.salon||"",
        segundoDiaActivo: true,
      };
    }
  }
  return {
    idx1: idx,
    materiaId: clase.materiaId, grupo: clase.grupo||"", profesor: clase.profesor||"",
    notas: clase.notas||"",
    dia: clase.dia, horaInicio: clase.horaInicio, horaFin: clase.horaFin,
    edificio: clase.edificio||"", lado: clase.lado||"", salon: clase.salon||"",
    segundoDiaActivo: false,
  };
}

function computeConflictIdxs(clases) {
  const set = new Set();
  for (let i = 0; i < clases.length; i++) {
    for (let j = i + 1; j < clases.length; j++) {
      const a = clases[i], b = clases[j];
      if (!a || !b || a.dia !== b.dia) continue;
      const s1 = horaIdx(a.horaInicio), e1 = horaIdx(a.horaFin);
      const s2 = horaIdx(b.horaInicio), e2 = horaIdx(b.horaFin);
      if (s1 < 0 || e1 <= s1 || s2 < 0 || e2 <= s2) continue;
      if (s1 < e2 && s2 < e1) { set.add(i); set.add(j); }
    }
  }
  return set;
}

function ClaseModal({ materiasDisponibles, allMaterias, existingClases, editIdxSet, prefill, diasActivos, onSave, onClose, editando, onDelete, onNotify }) {
  useBodyScrollLock();
  const [form, setForm] = useState(editando ? {
    materiaId: editando.materiaId||"", grupo: editando.grupo||"", profesor: editando.profesor||"",
    dia: editando.dia||diasActivos[0]||"L",
    horaInicio: normalizeHora(editando.horaInicio)||"07:00 a. m.",
    horaFin: normalizeHora(editando.horaFin)||"09:00 a. m.",
    edificio: editando.edificio||"", lado: editando.lado||"", salon: editando.salon||"",
    segundoDiaActivo: !!editando.segundoDiaActivo,
    dia2: editando.dia2||"",
    horaInicio2: normalizeHora(editando.horaInicio2)||"07:00 a. m.",
    horaFin2: normalizeHora(editando.horaFin2)||"09:00 a. m.",
    edificio2: editando.edificio2||"", lado2: editando.lado2||"", salon2: editando.salon2||"",
    notas: editando.notas||"",
  } : {
    materiaId: prefill?.materiaId
      || materiasDisponibles.find((m) => !m.prereqBlocked)?.id
      || materiasDisponibles[0]?.id || "",
    dia: prefill?.dia || diasActivos[0] || "L",
    horaInicio: normalizeHora(prefill?.horaInicio) || "07:00 a. m.",
    horaFin: normalizeHora(prefill?.horaFin) || "09:00 a. m.",
    edificio: "", lado: "", salon: "", grupo: "", profesor: "",
    segundoDiaActivo: false, dia2: "", horaInicio2: "07:00 a. m.", horaFin2: "09:00 a. m.",
    edificio2: "", lado2: "", salon2: "", notas: "",
  });
  const [customSalones, setCustomSalones] = useState(()=>getCustomSalones());
  const [otroValue, setOtroValue] = useState("");
  const [otroValue2, setOtroValue2] = useState("");

  const materiaById = new Map((allMaterias || []).map((m) => [m.id, m]));

  const pendingClases = [
    { dia: form.dia, horaInicio: form.horaInicio, horaFin: form.horaFin },
    ...(form.segundoDiaActivo && form.dia2 && form.horaInicio2 && form.horaFin2
      ? [{ dia: form.dia2, horaInicio: form.horaInicio2, horaFin: form.horaFin2 }]
      : []),
  ].filter((c) => c.dia && horaIdx(c.horaInicio) >= 0 && horaIdx(c.horaFin) > horaIdx(c.horaInicio));

  const exclude = editIdxSet && editIdxSet.length ? new Set(editIdxSet) : null;
  const baseClases = (existingClases || []).filter((_, i) => !exclude || !exclude.has(i));
  const conflicts = findConflicts(baseClases, pendingClases);
  const conflictClaseIdxs = conflicts.map((c) => baseClases.indexOf(c.clase));

  const selectedMateria = materiasDisponibles.find((m) => m.id === form.materiaId);
  const blockedSelected = selectedMateria?.prereqBlocked;

  const commitOtro = (which) => {
    const val = (which===1?otroValue:otroValue2).trim();
    const edId = which===1?form.edificio:form.edificio2;
    if (!val || !edId) return;
    setCustomSalones(prev=>{
      const list = prev[edId]||[];
      if (list.includes(val)) return prev;
      const next = {...prev, [edId]:[...list, val]};
      saveCustomSalones(next);
      return next;
    });
    if (which===1) { setForm(f=>({...f,salon:val})); setOtroValue(""); }
    else { setForm(f=>({...f,salon2:val})); setOtroValue2(""); }
  };

  const ed  = EDIFICIOS.find(e=>e.id===form.edificio);
  const ed2 = EDIFICIOS.find(e=>e.id===form.edificio2);
  const salonLabel  = form.edificio  ? buildSalonLabel(form.edificio,  form.lado,  form.salon)  : "";
  const salonLabel2 = form.edificio2 ? buildSalonLabel(form.edificio2, form.lado2, form.salon2) : "";

  const handleSave = () => {
    if (!form.materiaId||!form.dia||!form.horaInicio||!form.horaFin) return;
    if (blockedSelected) {
      onNotify?.("Esa materia tiene prerequisitos pendientes");
      return;
    }
    const s=HORAS_FORM.indexOf(form.horaInicio), e=HORAS_FORM.indexOf(form.horaFin);
    if (s<0||e<=s){ onNotify?.("Horario inválido"); return; }
    if (form.segundoDiaActivo){
      if(!form.dia2||!form.horaInicio2||!form.horaFin2) return;
      if(form.dia2===form.dia) return;
      const s2=HORAS_FORM.indexOf(form.horaInicio2), e2=HORAS_FORM.indexOf(form.horaFin2);
      if(s2<0||e2<=s2){ onNotify?.("Horario 2 inválido"); return; }
    }
    const pairId = form.segundoDiaActivo
      ? (form.pairId || `p_${Date.now()}_${Math.random().toString(36).slice(2,8)}`)
      : undefined;
    const clases=[{ materiaId:form.materiaId, dia:form.dia,
      horaInicio:form.horaInicio, horaFin:form.horaFin,
      edificio:form.edificio, lado:form.lado, salon:form.salon, salonLabel,
      grupo:form.grupo, profesor:form.profesor, notas:form.notas,
      ...(pairId?{pairId}:{}) }];
    if (form.segundoDiaActivo) clases.push({
      materiaId:form.materiaId, dia:form.dia2,
      horaInicio:form.horaInicio2, horaFin:form.horaFin2,
      edificio:form.edificio2, lado:form.lado2, salon:form.salon2, salonLabel:salonLabel2,
      grupo:form.grupo, profesor:form.profesor, notas:form.notas,
      pairId,
    });
    onSave({ clases, conChoques: conflicts.length > 0 });
  };

  const saveLabel = conflicts.length > 0
    ? (editando ? "Guardar con choque" : "Añadir con choque")
    : (editando ? "Guardar cambios" : "Añadir clase");

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{editando?"Editar clase":"Nueva clase"}</h3>
          <button className={styles.modalClose} onClick={onClose}><IconClose size={14} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formField}>
            <label>Materia</label>
            <select className={styles.select} value={form.materiaId}
              onChange={e=>setForm(f=>({...f,materiaId:e.target.value}))}>
              <option value="">— Selecciona —</option>
              {materiasDisponibles.map(m=>(
                <option key={m.id} value={m.id} disabled={m.prereqBlocked}>
                  {m.id} — {m.nombre}{m.prereqBlocked ? "  ⚠ prereq. pendiente" : ""}
                </option>
              ))}
            </select>
            {blockedSelected && (
              <div className={styles.blockedHint}>
                <IconWarning size={12} /> Necesitas aprobar antes:{" "}
                {selectedMateria.prereqs
                  .map((pid) => materiaById.get(pid)?.id || pid)
                  .join(", ")}
              </div>
            )}
          </div>
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label>Grupo</label>
              <input type="text" className={styles.input} value={form.grupo}
                placeholder="ej: G2" onChange={e=>setForm(f=>({...f,grupo:e.target.value}))} />
            </div>
            <div className={styles.formField}>
              <label>Profesor</label>
              <input type="text" className={styles.input} value={form.profesor}
                placeholder="ej: Santiago Navarro" onChange={e=>setForm(f=>({...f,profesor:e.target.value}))} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label>Día</label>
              <select className={styles.select} value={form.dia}
                onChange={e=>setForm(f=>({...f,dia:e.target.value}))}>
                {diasActivos.map(id=>{ const d=TODOS_DIAS.find(x=>x.id===id); return <option key={id} value={id}>{d?.label}</option>; })}
              </select>
            </div>
            <div className={styles.formField}>
              <label>Inicio</label>
              <select className={styles.select} value={form.horaInicio}
                onChange={e=>setForm(f=>({...f,horaInicio:e.target.value}))}>
                {HORAS_FORM.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className={styles.formField}>
              <label>Fin</label>
              <select className={styles.select} value={form.horaFin}
                onChange={e=>setForm(f=>({...f,horaFin:e.target.value}))}>
                {HORAS_FORM.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          {}
          {conflicts.length > 0 && (
            <div className={styles.conflictPanel}>
              <div className={styles.conflictTitle}><IconWarning size={13} /> Choque de horario detectado</div>
              {conflicts.map((c, i) => (
                <div key={i} className={styles.conflictRow}>
                  <span className={styles.conflictClase}>{c.clase.materiaId}{c.clase.grupo?` - ${c.clase.grupo}`:""}</span>
                  <span className={styles.conflictDetalle}>
                    {TODOS_DIAS.find((d)=>d.id===c.clase.dia)?.label || c.clase.dia} · {formatRangoHora(c.clase)}
                  </span>
                </div>
              ))}
              <div className={styles.conflictHint}>
                La clase se superpone con lo que ya tienes. Puedes guardarla igual, pero quedará marcada como choque.
              </div>
            </div>
          )}

          {}
          <div className={styles.formField}>
            <label>Edificio (opcional)</label>
            <div className={styles.edificioGrid}>
              {EDIFICIOS.map(edif=>(
                <button key={edif.id}
                  className={`${styles.edificioBtn} ${form.edificio===edif.id?styles.edificioBtnActive:""}`}
                  onClick={()=>setForm(f=>({...f,edificio:edif.id,lado:"",salon:""}))}>
                  <span>{edif.IconComp ? <edif.IconComp size={14} /> : null}</span><span>{edif.nombre}</span>
                </button>
              ))}
            </div>
          </div>
          {ed?.lados && (
            <div className={styles.formField}>
              <label>Lado</label>
              <div className={styles.ladoRow}>
                {ed.lados.map(l=>(
                  <button key={l}
                    className={`${styles.ladoBtn} ${form.lado===l?styles.ladoBtnActive:""}`}
                    onClick={()=>setForm(f=>({...f,lado:l,salon:""}))}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
          {form.edificio && (
            <div className={styles.formField}>
              <label>Salón</label>
              <div className={styles.salonGrid}>
                {[...(ed?.salones||[]), ...(customSalones[form.edificio]||[])].map(s=>(
                  <button key={s}
                    className={`${styles.salonBtn} ${form.salon===s?styles.salonBtnActive:""}`}
                    onClick={()=>setForm(f=>({...f,salon:s}))}>
                    {s}
                  </button>
                ))}
              </div>
              {OTRO_SALON_IDS.includes(form.edificio) && (
                <div className={styles.otroSalonRow}>
                  <input type="text" className={styles.input} value={otroValue}
                    placeholder="Escribe el número o nombre del salón/lab…"
                    onChange={e=>setOtroValue(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); commitOtro(1); } }} />
                  <button type="button" className={styles.btnSecondary} onClick={()=>commitOtro(1)}>+ Agregar</button>
                </div>
              )}
            </div>
          )}
          {salonLabel && <div className={styles.salonPreview}><IconLocation size={12} /> {salonLabel}</div>}

          {}
          <div className={styles.formField}>
            <label>
              <input type="checkbox" checked={form.segundoDiaActivo}
                onChange={e=>setForm(f=>({...f,segundoDiaActivo:e.target.checked}))} />
              {" "}Agregar segundo día de clase
            </label>
          </div>

          {form.segundoDiaActivo && (<>
            <div className={styles.formRow}>
              <div className={styles.formField}>
                <label>Día 2</label>
                <select className={styles.select} value={form.dia2}
                  onChange={e=>setForm(f=>({...f,dia2:e.target.value}))}>
                  <option value="">—</option>
                  {diasActivos.filter(d=>d!==form.dia).map(id=>{
                    const d=TODOS_DIAS.find(x=>x.id===id);
                    return <option key={id} value={id}>{d?.label}</option>;
                  })}
                </select>
              </div>
              <div className={styles.formField}>
                <label>Inicio</label>
                <select className={styles.select} value={form.horaInicio2}
                  onChange={e=>setForm(f=>({...f,horaInicio2:e.target.value}))}>
                  {HORAS_FORM.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className={styles.formField}>
                <label>Fin</label>
                <select className={styles.select} value={form.horaFin2}
                  onChange={e=>setForm(f=>({...f,horaFin2:e.target.value}))}>
                  {HORAS_FORM.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
            {}
            <div className={styles.formField}>
              <label>Edificio día 2 (opcional)</label>
              <div className={styles.edificioGrid}>
                {EDIFICIOS.map(edif=>(
                  <button key={edif.id}
                    className={`${styles.edificioBtn} ${form.edificio2===edif.id?styles.edificioBtnActive:""}`}
                    onClick={()=>setForm(f=>({...f,edificio2:edif.id,lado2:"",salon2:""}))}>
                    <span>{edif.IconComp ? <edif.IconComp size={14} /> : null}</span><span>{edif.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
            {ed2?.lados && (
              <div className={styles.formField}>
                <label>Lado día 2</label>
                <div className={styles.ladoRow}>
                  {ed2.lados.map(l=>(
                    <button key={l}
                      className={`${styles.ladoBtn} ${form.lado2===l?styles.ladoBtnActive:""}`}
                      onClick={()=>setForm(f=>({...f,lado2:l,salon2:""}))}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {form.edificio2 && (
              <div className={styles.formField}>
                <label>Salón día 2</label>
                <div className={styles.salonGrid}>
                  {[...(ed2?.salones||[]), ...(customSalones[form.edificio2]||[])].map(s=>(
                    <button key={s}
                      className={`${styles.salonBtn} ${form.salon2===s?styles.salonBtnActive:""}`}
                      onClick={()=>setForm(f=>({...f,salon2:s}))}>
                      {s}
                    </button>
                  ))}
                </div>
                {OTRO_SALON_IDS.includes(form.edificio2) && (
                  <div className={styles.otroSalonRow}>
                    <input type="text" className={styles.input} value={otroValue2}
                      placeholder="Escribe el número o nombre del salón/lab…"
                      onChange={e=>setOtroValue2(e.target.value)}
                      onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); commitOtro(2); } }} />
                    <button type="button" className={styles.btnSecondary} onClick={()=>commitOtro(2)}>+ Agregar</button>
                  </div>
                )}
              </div>
            )}
            {salonLabel2 && <div className={styles.salonPreview}><IconLocation size={12} /> {salonLabel2}</div>}
          </>)}

          <div className={styles.formField}>
            <label>Notas (opcional)</label>
            <input type="text" className={styles.input} value={form.notas}
              placeholder="ej: Traer portátil..." onChange={e=>setForm(f=>({...f,notas:e.target.value}))} />
          </div>
        </div>
        <div className={styles.modalFooter}>
          {editando && <button className={styles.deleteBtn} onClick={onDelete}><IconTrash size={12} /> Eliminar</button>}
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnPrimary} ${conflicts.length?styles.btnPrimaryWarn:""}`} onClick={handleSave}>
            {conflicts.length > 0 && <IconWarning size={12} />}
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClaseBloque({ clase, materia, color, horaStart, duracion, onClick, isConflict }) {
  const top=horaStart*64, height=duracion*64-4;
  const showName = duracion >= 2;
  return (
    <div className={`${styles.claseBloque} ${isConflict?styles.claseBloqueConflict:""}`}
      style={{top,height,"--clase-color":color}} onClick={onClick}
      title={`${materia?.id||clase.materiaId}${clase.grupo?` - ${clase.grupo}`:""}${clase.profesor?` · ${clase.profesor}`:""} | ${toViewHora(clase.horaInicio)}–${toViewHora(clase.horaFin)} | ${clase.salonLabel||""}`}>
      <div className={styles.claseAccent}/>
      <div className={styles.claseBloqueContent}>
        <span className={styles.claseId}>{materia?.id||clase.materiaId}{clase.grupo ? ` - ${clase.grupo}` : ""}</span>
        {showName && materia?.nombre && <span className={styles.claseNombre}>{materia.nombre}</span>}
        {clase.profesor && <span className={styles.claseProfesor}>{clase.profesor}</span>}
        <span className={styles.claseHora}>
          <IconSchedule size={11} className={styles.claseIcon} />
          {toViewHora(clase.horaInicio)}–{toViewHora(clase.horaFin)}
        </span>
        {clase.salonLabel && (
          <span className={styles.claseSalon} title={clase.salonLabel}>
            <IconLocation size={11} className={styles.claseIcon} />
            {clase.salonLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function MiniHorario({ opcion, priority, colorMap, materiasRef, diasActivos, onEdit, onDelete, onRename, isSelected, onSelect, onAddClase, onTransfer, onMove }) {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(opcion.nombre);

  const clases = opcion.clases || [];
  const diasConClases = [...new Set(clases.map(c=>c.dia))];
  const diasMostrar = TODOS_DIAS.filter(d=>
    diasActivos.includes(d.id) || diasConClases.includes(d.id)
  );

  const usedHoras = clases.flatMap(c=>{
    const s=horaIdx(c.horaInicio), e=horaIdx(c.horaFin);
    return s>=0&&e>s ? Array.from({length:e-s+1},(_,i)=>s+i) : [];
  });
  const minH = usedHoras.length ? Math.max(0, Math.min(...usedHoras)-1) : 1;
  const maxH = usedHoras.length ? Math.min(LEGACY_HORAS.length-1, Math.max(...usedHoras)+1) : 9;
  const visHoras = LEGACY_HORAS.slice(minH, maxH+1);
  const CELL_H = 40;

  const conflictSet = computeConflictIdxs(clases);

  const totalCred = [...new Set(clases.map(c=>c.materiaId))]
    .reduce((sum,id)=>{
      const m=materiasRef.find(x=>x.id===id);
      return sum+(m?.creditos||0);
    },0);

  return (
    <div className={`${styles.miniCard} ${isSelected?styles.miniCardSelected:""}`}
      onClick={onSelect}>
      {}
      <div className={styles.miniCardHeader}>
        <div className={styles.miniCardName}>
          <span className={styles.miniDragHandle} title="Arrastra para reordenar">⠿</span>
          {typeof priority === "number" && <span className={styles.miniCardPriority}>#{priority}</span>}
          {editingName ? (
            <input className={styles.miniCardNameInput} value={tempName} autoFocus
              onClick={e=>e.stopPropagation()}
              onChange={e=>setTempName(e.target.value)}
              onBlur={()=>{ onRename(tempName||opcion.nombre); setEditingName(false); }}
              onKeyDown={e=>{ if(e.key==="Enter"){ onRename(tempName||opcion.nombre); setEditingName(false); } }} />
          ) : (
            <span onDoubleClick={e=>{ e.stopPropagation(); setEditingName(true); }}>
              {opcion.nombre}
            </span>
          )}
          {isSelected && <span className={styles.miniCardBadge}>Activa</span>}
        </div>
        <div className={styles.miniCardActions}>
          <button className={`${styles.miniActionBtn} ${styles.miniMoveBtn}`}
            title="Mover opción hacia atrás"
            onClick={e=>{ e.stopPropagation(); onMove?.(-1); }}><IconChevronLeft size={13} /></button>
          <button className={`${styles.miniActionBtn} ${styles.miniMoveBtn}`}
            title="Mover opción hacia adelante"
            onClick={e=>{ e.stopPropagation(); onMove?.(1); }}><IconChevronRight size={13} /></button>
          <button className={styles.miniActionBtn}
            title={clases.length ? "Transferir: este será tu horario del semestre" : "Agrega clases antes de transferir"}
            disabled={!clases.length}
            onClick={e=>{ e.stopPropagation(); if(clases.length) onTransfer(); }}><IconExternalLink size={13} /></button>
          <button className={styles.miniActionBtn} title="Renombrar"
            onClick={e=>{ e.stopPropagation(); setEditingName(true); }}><IconEdit size={13} /></button>
          <button className={`${styles.miniActionBtn} ${styles.miniActionBtnDanger}`}
            title="Eliminar opción" onClick={e=>{ e.stopPropagation(); onDelete(); }}><IconTrash size={12} /></button>
        </div>
      </div>

      {}
      <div className={styles.miniGridWrap}>
        <div className={styles.miniGridInner} style={{"--num-dias":diasMostrar.length}}>
          {}
          <div>
            <div className={styles.miniHoraColHeader}/>
            {visHoras.map(h=>(
              <div key={h} className={styles.miniHoraColCell}>{h}</div>
            ))}
          </div>
          {}
          {diasMostrar.map(dia=>(
            <div key={dia.id} className={styles.miniDiaCol}>
              <div className={styles.miniDiaHeader}>{dia.id}</div>
              <div className={styles.miniDiaBody}>
                {visHoras.map(h=>( <div key={h} className={styles.miniHoraLine}/> ))}
                {clases.filter(c=>c.dia===dia.id).map((clase,i)=>{
                  const globalIdx = opcion.clases.indexOf(clase);
                  const s=horaIdx(clase.horaInicio)-minH;
                  const dur=horaIdx(clase.horaFin)-horaIdx(clase.horaInicio);
                  if(s<0||dur<=0) return null;
                  const color=colorMap[clase.materiaId]||"var(--accent)";
                  const miniLabel = `${clase.materiaId}${clase.grupo?` - ${clase.grupo}`:""}`;
                  return (
                    <div key={i}
                      className={`${styles.miniBloqueAbs} ${conflictSet.has(globalIdx)?styles.miniBloqueAbsConflict:""}`}
                      style={{top:s*CELL_H, height:dur*CELL_H-2,"--bloque-color":color}}
                      onClick={e=>{ e.stopPropagation(); onEdit(buildEditando(opcion.clases, globalIdx)); }}
                      title={`${miniLabel}${clase.profesor?` · ${clase.profesor}`:""} ${toViewHora(clase.horaInicio)}–${toViewHora(clase.horaFin)}`}>
                      <span className={styles.miniBloqueAbsId}>{miniLabel}</span>
                      <span className={styles.miniBloqueAbsHora}>{toViewHora(clase.horaInicio)}</span>
                      {clase.profesor && dur*CELL_H>=44 && (
                        <span className={styles.miniBloqueAbsProf}>{clase.profesor}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {}
      <div className={styles.miniStats}>
        <span className={styles.miniStat}><strong>{clases.length}</strong> clases</span>
        <span className={styles.miniStat}><strong>{totalCred}</strong> créditos</span>
        <span className={styles.miniStat}>
          <strong>{[...new Set(clases.map(c=>c.dia))].length}</strong> días
        </span>
        {conflictSet.size > 0 && (
          <span className={styles.miniStatConflict}><IconWarning size={10} /> {conflictSet.size} choque{conflictSet.size>1?"s":""}</span>
        )}
      </div>
      <div className={styles.planClaseAddRow}>
        <button className={styles.planClaseAddBtn}
          onClick={e=>{ e.stopPropagation(); onAddClase(); }}>
          + Agregar clase a esta opción
        </button>
      </div>
    </div>
  );
}

function TransferConfirmModal({ nombre, onEnrollMaterias, onCancel, onConfirm }) {
  useBodyScrollLock();
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Transferir a horario</h3>
          <button className={styles.modalClose} onClick={onCancel}><IconClose size={14} /></button>
        </div>
        <div className={styles.modalBody}>
          <p>
            <strong>"{nombre}"</strong> se convertirá en tu <strong>horario de este semestre</strong> (pestaña "Mi horario").
          </p>
          <p style={{color:"var(--text-muted)",fontSize:13}}>
            Esto reemplaza el contenido actual de "Mi horario"
            {onEnrollMaterias ? " y marca las materias de esta opción como \"Cursando\"." : "."}
          </p>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={onConfirm}>Sí, transferir</button>
        </div>
      </div>
    </div>
  );
}

function PlanificadorView({ malla, planData, onSavePlan, user, onNotify, mainDias, onTransferToHorario, onEnrollMaterias }) {
  const allMaterias = useMemo(() => malla.flatMap((s) => s.materias), [malla]);
  const materiasActuales = useMemo(() => allMaterias.filter((m) => m.estado === "cursando"), [allMaterias]);
  const materiasDisponibles = useMemo(() => allMaterias
    .filter((m) => m.estado === "cursando" || m.estado === "faltante")
    .map((m) => ({
      ...m,
      prereqBlocked:
        m.estado === "faltante"
        && m.prereqs?.length > 0
        && m.prereqs.some((pid) => {
          const p = allMaterias.find((x) => x.id === pid);
          return p?.estado !== "aprobada";
        }),
    })), [allMaterias]);
  const colorMap = useMemo(
    () => buildColorMap(materiasDisponibles.length ? materiasDisponibles : materiasActuales),
    [materiasDisponibles, materiasActuales]
  );

  const [opciones, setOpciones] = useState(planData?.opciones || []);
  const [selectedIdx, setSelectedIdx] = useState(planData?.selectedIdx ?? 0);
  const [modalState, setModalState] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [confirmTransferIdx, setConfirmTransferIdx] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    setOpciones(planData?.opciones || []);
    setSelectedIdx(planData?.selectedIdx ?? 0);
  }, [planData]);

  const save = (newOpciones, newSelected) => {
    const d = { opciones: newOpciones, selectedIdx: newSelected??selectedIdx };
    setOpciones(newOpciones);
    onSavePlan(d);
  };

  const addOpcion = () => {
    const nombre = `Opción ${opciones.length+1}`;
    const nueva = { nombre, clases:[], dias:mainDias };
    const next = [...opciones, nueva];
    save(next, next.length-1);
    setSelectedIdx(next.length-1);
    onNotify?.("Nueva opción creada");
  };

  const deleteOpcion = (idx) => {
    const next = opciones.filter((_,i)=>i!==idx);
    const newSel = Math.min(selectedIdx, next.length-1);
    save(next, newSel>=0?newSel:0);
    setSelectedIdx(newSel>=0?newSel:0);
    onNotify?.("Opción eliminada");
  };

  const renameOpcion = (idx, nombre) => {
    const next = opciones.map((o,i)=>i===idx?{...o,nombre}:o);
    save(next);
  };

  const reorderOpciones = (fromIdx, toIdx) => {
    if (fromIdx===toIdx) return;
    const next = [...opciones];
    const [moved] = next.splice(fromIdx,1);
    next.splice(toIdx,0,moved);
    let newSelected = selectedIdx;
    if (selectedIdx===fromIdx) newSelected = toIdx;
    else if (fromIdx<selectedIdx && toIdx>=selectedIdx) newSelected = selectedIdx-1;
    else if (fromIdx>selectedIdx && toIdx<=selectedIdx) newSelected = selectedIdx+1;
    save(next, newSelected);
    setSelectedIdx(newSelected);
    onNotify?.("Orden de prioridad actualizado");
  };

  const handleSaveClase = ({clases:nuevasClases}) => {
    if (!modalState) return;
    const {opcionIdx, editando} = modalState;
    const opcion = opciones[opcionIdx];
    let clasesList = [...(opcion.clases || [])];
    if (editando && editando.idx1 !== undefined) {
      const removeIdxs = new Set([editando.idx1, editando.idx2].filter(i=>i!==undefined));
      clasesList = clasesList.filter((_,i)=>!removeIdxs.has(i));
      clasesList = [...clasesList, ...nuevasClases];
    } else {
      clasesList = [...clasesList, ...nuevasClases];
    }
    const next = opciones.map((o,i)=>i===opcionIdx?{...o,clases:clasesList}:o);
    save(next);
    setModalState(null);
    onNotify?.(editando?"Clase actualizada":"Clase agregada");
  };

  const handleDeleteClase = () => {
    if (!modalState?.editando) return;
    const {opcionIdx, editando} = modalState;
    const removeIdxs = new Set([editando.idx1, editando.idx2].filter(i=>i!==undefined));
    const clases = opciones[opcionIdx].clases.filter((_,i)=>!removeIdxs.has(i));
    const next = opciones.map((o,i)=>i===opcionIdx?{...o,clases}:o);
    save(next);
    setModalState(null);
    onNotify?.("Clase eliminada");
  };

  const diasActivos = mainDias || ["L","M","X","J","V"];

  const handleTransferConfirmed = () => {
    const idx = confirmTransferIdx;
    if (idx==null || !opciones[idx]) return;
    const opcion = opciones[idx];
    const clases = (opcion.clases||[]).map(c=>({...c}));
    const dias = (opcion.dias && opcion.dias.length) ? opcion.dias : diasActivos;

    onTransferToHorario?.({ dias, clases });

    const materiaIds = [...new Set(clases.map(c=>c.materiaId))];
    if (materiaIds.length) onEnrollMaterias?.(materiaIds);

    setConfirmTransferIdx(null);
    onNotify?.(`"${opcion.nombre}" ahora es tu horario de este semestre`);
  };

  return (
    <div className={styles.planWrap}>
      {}
      <div className={styles.planTopBar}>
        <div className={styles.planOpciones}>
          <span className={styles.planOpcionLabel}>Opciones:</span>
          {opciones.map((op,i)=>(
            <button key={i}
              className={`${styles.planOpcionBtn} ${selectedIdx===i?styles.planOpcionBtnActive:""}`}
              onClick={()=>setSelectedIdx(i)}>
              <span className={styles.planOpcionDot}
                style={{background: selectedIdx===i?"var(--accent)":"var(--border)"}}/>
              {op.nombre}
            </button>
          ))}
          <button className={styles.planAddBtn} onClick={addOpcion}>+ Nueva opción</button>
        </div>
      </div>

      {}
      {opciones[selectedIdx] && (() => {
        const opSel = opciones[selectedIdx];
        const clasesSel = opSel.clases || [];
        const mById = new Map(allMaterias.map((m) => [m.id, m]));
        const materiaIds = [...new Set(clasesSel.filter((c) => c.materiaId).map((c) => c.materiaId))];
        const materiasSel = materiaIds.map((id) => mById.get(id)).filter(Boolean);
        const creditosSel = materiasSel.reduce((a, m) => a + (m.creditos || 0), 0);
        const conflictSetSel = computeConflictIdxs(clasesSel);
        const prereqOkSel = (m) =>
          !(m.prereqs || []).some((pid) => mById.get(pid)?.estado !== "aprobada");
        const conObservaciones = materiasSel.some((m) => !prereqOkSel(m) && m.estado !== "cursando") || conflictSetSel.size > 0;
        return (
          <div className={styles.planResumen}>
            <div className={styles.planResumenHeader}>
              <div>
                <span className={styles.planResumenTitle}>Matrícula · {opSel.nombre}</span>
                <span className={styles.planResumenSub}>
                  {materiasSel.length} materia{materiasSel.length !== 1 ? "s" : ""} ·{" "}
                  {creditosSel} créditos
                </span>
              </div>
              <span className={`${styles.planResumenBadge} ${conObservaciones ? styles.planResumenBadgeWarn : styles.planResumenBadgeOk}`}>
                {conObservaciones ? "Con observaciones" : "Listo para matricular"}
              </span>
            </div>
            <div className={styles.planResumenList}>
              {materiasSel.length === 0 && (
                <p className={styles.planResumenEmpty}>
                  Agrega materias a esta opción para ver el resumen de matrícula.
                </p>
              )}
              {materiasSel.map((m) => {
                const faltantes = (m.prereqs || []).filter((pid) => mById.get(pid)?.estado !== "aprobada");
                const ok = m.estado === "cursando" || prereqOkSel(m);
                return (
                  <div key={m.id} className={styles.planResumenMateria}>
                    <span className={`${styles.planResumenDot} ${ok ? styles.planResumenDotOk : styles.planResumenDotWarn}`} />
                    <div className={styles.planResumenMateriaBody}>
                      <span className={styles.planResumenMateriaId}>{m.id}</span>
                      <span className={styles.planResumenMateriaNombre}>{m.nombre}</span>
                    </div>
                    <span className={styles.planResumenMateriaCred}>{m.creditos} cr</span>
                    {!ok && (
                      <span className={styles.planResumenWarn}>
                        <IconWarning size={11} /> Falta: {faltantes.join(", ")}
                      </span>
                    )}
                  </div>
                );
              })}
              {conflictSetSel.size > 0 && (
                <p className={styles.planResumenConflict}>
                  <IconWarning size={12} /> {conflictSetSel.size} choque{conflictSetSel.size > 1 ? "s" : ""} de horario dentro de esta opción.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {}
      {opciones.length === 0 ? (
        <div className={styles.planEmptyState}>
          <span className={styles.planEmptyIcon}><IconSchedule size={36} /></span>
          <p style={{fontWeight:600,marginBottom:6}}>Aún no tienes opciones de horario</p>
          <p style={{fontSize:13}}>Crea varias opciones y compara cuál te queda mejor.</p>
          <button className={styles.planAddBtn} style={{marginTop:16}} onClick={addOpcion}>
            + Crear primera opción
          </button>
        </div>
      ) : (
        <div className={styles.planGrid}>
          {opciones.map((op,i)=>(
            <div key={i}
              className={`${styles.miniCardDragWrap} ${dragIdx===i?styles.miniCardDragging:""} ${dragOverIdx===i&&dragIdx!==null&&dragIdx!==i?styles.miniCardDragOver:""}`}
              draggable={!isMobile}
              onDragStart={()=>setDragIdx(i)}
              onDragOver={e=>{ e.preventDefault(); setDragOverIdx(i); }}
              onDrop={()=>{ if(dragIdx!==null) reorderOpciones(dragIdx,i); setDragIdx(null); setDragOverIdx(null); }}
              onDragEnd={()=>{ setDragIdx(null); setDragOverIdx(null); }}>
              <MiniHorario
                opcion={op}
                priority={i+1}
                colorMap={colorMap}
                materiasRef={allMaterias}
                diasActivos={diasActivos}
                isSelected={selectedIdx===i}
                onSelect={()=>setSelectedIdx(i)}
                onDelete={()=>deleteOpcion(i)}
                onRename={(n)=>renameOpcion(i,n)}
                onEdit={(editando)=>setModalState({opcionIdx:i,editando})}
                onAddClase={()=>setModalState({opcionIdx:i})}
                onTransfer={()=>setConfirmTransferIdx(i)}
                onMove={(dir)=>{ const to=i+dir; if(to>=0 && to<opciones.length) reorderOpciones(i,to); }}
              />
            </div>
          ))}
        </div>
      )}

      {}
      {modalState && (
        <ClaseModal
          materiasDisponibles={materiasDisponibles}
          allMaterias={allMaterias}
          existingClases={opciones[modalState.opcionIdx]?.clases || []}
          editIdxSet={modalState.editando?.idx1!==undefined
            ? [modalState.editando.idx1, modalState.editando.idx2].filter(i=>i!==undefined)
            : []}
          diasActivos={diasActivos}
          editando={modalState.editando?.idx1!==undefined ? modalState.editando : null}
          onSave={handleSaveClase}
          onDelete={handleDeleteClase}
          onNotify={onNotify}
          onClose={()=>setModalState(null)}
        />
      )}

      {}
      {confirmTransferIdx !== null && opciones[confirmTransferIdx] && (
        <TransferConfirmModal
          nombre={opciones[confirmTransferIdx].nombre}
          onEnrollMaterias={onEnrollMaterias}
          onCancel={()=>setConfirmTransferIdx(null)}
          onConfirm={handleTransferConfirmed}
        />
      )}
    </div>
  );
}

function HoyWidget({ horarioData, malla }) {
  const colorMap = useMemo(
    () => buildColorMap(malla.flatMap((s) => s.materias).filter((m) => m.estado === "cursando")),
    [malla]
  );
  const today = new Date();
  const diaKey = HOY_DIA_MAP[today.getDay()];
  if (diaKey === "D" || diaKey === "S") return null;
  const claseHoy = (horarioData?.clases || [])
    .filter(c => c.dia === diaKey)
    .sort((a, b) => parseHoraNum(a.horaInicio) - parseHoraNum(b.horaInicio));
  if (claseHoy.length === 0) return null;
  const allMaterias = malla.flatMap(s => s.materias);
  const materiaMap = Object.fromEntries(allMaterias.map(m => [m.id, m]));
  return (
    <div className={styles.hoyWidget}>
      <div className={styles.hoyList}>
        {claseHoy.map((clase, i) => {
          const mat = materiaMap[clase.materiaId];
          return (
            <div key={i} className={styles.hoyItem}>
              <span className={styles.hoyTime}
                style={{ "--clase-color": colorMap[clase.materiaId] || "var(--accent)" }}>
                {toViewHora(clase.horaInicio)}
              </span>
              <div className={styles.hoyInfo}>
                <div className={styles.hoyTitleRow}>
                  <span className={styles.hoyMateriaId}>{clase.materiaId}</span>
                  {clase.grupo && <span className={styles.hoyGrupo}>{clase.grupo}</span>}
                </div>
                <span className={styles.hoyMateriaNombre}>{mat?.nombre || clase.materiaId}</span>
                <span className={styles.hoyHora}>{toViewHora(clase.horaInicio)} – {toViewHora(clase.horaFin)}</span>
                <span className={styles.hoySalon}>
                  <IconLocation size={11} /> {clase.salonLabel || "Sin salón"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HorarioView({ malla, horarioData, planData, onSave, onSavePlan, user, onNotify, onEnrollMaterias }) {
  const [mode, setMode] = useState("horario");
  const [data, setData] = useState(horarioData || {dias:["L","M","X","J","V"],clases:[]});
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [modalPrefill, setModalPrefill] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);
  const [dragMateriaId, setDragMateriaId] = useState(null);
  const [dragHover, setDragHover] = useState(null);
  const [touchDrag, setTouchDrag] = useState(null);
  const [touchPos, setTouchPos] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    setData(horarioData || {dias:["L","M","X","J","V"],clases:[]});
  }, [horarioData]);

  const allMaterias = useMemo(() => malla.flatMap((s) => s.materias), [malla]);
  const materiasActuales = useMemo(() => allMaterias.filter((m) => m.estado === "cursando"), [allMaterias]);
  const colorMap = useMemo(() => buildColorMap(materiasActuales), [materiasActuales]);

  const toggleDia = (id) => {
    const dias = data.dias.includes(id)
      ? data.dias.filter(d=>d!==id)
      : [...data.dias,id].sort((a,b)=>TODOS_DIAS.findIndex(x=>x.id===a)-TODOS_DIAS.findIndex(x=>x.id===b));
    const updated={...data,dias};
    setData(updated); onSave(updated);
    onNotify?.("Días actualizados");
  };

  const handleAddClase = (clase) => {
    const nuevasClases=clase?.clases||[];
    let clases;
    if (editando && editando.idx1 !== undefined) {
      const removeIdxs = new Set([editando.idx1, editando.idx2].filter(i=>i!==undefined));
      clases = data.clases.filter((_,i)=>!removeIdxs.has(i));
      clases = [...clases, ...nuevasClases];
    } else {
      clases=[...data.clases,...nuevasClases];
    }
    const updated={...data,clases};
    setData(updated); onSave(updated); setShowModal(false); setEditando(null); setModalPrefill(null);
    onNotify?.(
      clase?.conChoques
        ? (editando?"Clase guardada con choque de horario":"Clase agregada con choque de horario")
        : (editando?"Clase actualizada":"Clase agregada")
    );
  };

  const handleDeleteClase=(indices)=>{
    const idxSet = new Set(Array.isArray(indices)?indices:[indices]);
    const clases=data.clases.filter((_,i)=>!idxSet.has(i));
    const updated={...data,clases};
    setData(updated); onSave(updated); setShowModal(false); setEditando(null);
    onNotify?.("Clase eliminada");
  };

  const handleTransferPlanToHorario = ({dias, clases}) => {
    const updated = { dias: dias?.length ? dias : data.dias, clases };
    setData(updated);
    onSave(updated);
    setMode("horario");
  };

  const handleOpenWallpaper = () => {
    setShowExport(false);
    setShowWallpaper(true);
  };

  const diasActivos=TODOS_DIAS.filter(d=>data.dias.includes(d.id));

  const schedule = useMemo(() => {
    const claseIdxs = data.clases.flatMap(c => {
      const s = horaIdx(c.horaInicio), e = horaIdx(c.horaFin);
      if (s < 0 || e <= s) return [];
      const set = new Set();
      for (let i = s; i < e; i++) set.add(i);
      return [...set];
    });
    const usedSet = new Set(claseIdxs);
    const minUsed = usedSet.size ? Math.min(...usedSet) : 1;
    const maxUsed = usedSet.size ? Math.max(...usedSet) : 9;
    const visStart = usedSet.size ? Math.max(0, minUsed - 1) : 1;
    const visEnd = usedSet.size ? Math.min(LEGACY_HORAS.length - 1, maxUsed + 1) : 9;
    return {
      usedSet,
      visStart,
      visEnd,
      visHoras: LEGACY_HORAS.slice(visStart, visEnd + 1),
    };
  }, [data.clases]);

  const conflictSet = useMemo(() => {
    const set = new Set();
    const cs = data.clases;
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i], b = cs[j];
        if (!a || !b || a.dia !== b.dia) continue;
        const s1 = horaIdx(a.horaInicio), e1 = horaIdx(a.horaFin);
        const s2 = horaIdx(b.horaInicio), e2 = horaIdx(b.horaFin);
        if (s1 < 0 || e1 <= s1 || s2 < 0 || e2 <= s2) continue;
        if (s1 < e2 && s2 < e1) { set.add(i); set.add(j); }
      }
    }
    return set;
  }, [data.clases]);

  const handleDragOver = (e, diaId) => {
    if (!dragMateriaId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = Math.max(schedule.visStart, Math.min(schedule.visEnd, Math.floor(y / 64)));
    const end = Math.min(h + 2, schedule.visEnd + 1);
    setDragHover({ dia: diaId, start: h, end });
  };

  const handleDrop = (e, diaId) => {
    e.preventDefault();
    if (!dragMateriaId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = Math.max(schedule.visStart, Math.min(schedule.visEnd, Math.floor(y / 64)));
    const end = Math.min(h + 2, schedule.visEnd + 1);
    setModalPrefill({
      materiaId: dragMateriaId,
      dia: diaId,
      horaInicio: HORAS_FORM[h] || HORAS_FORM[schedule.visStart],
      horaFin: HORAS_FORM[end] || HORAS_FORM[schedule.visEnd],
    });
    setEditando(null);
    setShowModal(true);
    setDragMateriaId(null);
    setDragHover(null);
  };

  const clearDrag = () => {
    setDragMateriaId(null);
    setDragHover(null);
    setTouchDrag(null);
    setTouchPos(null);
  };

  useEffect(() => {
    if (!touchDrag) return;
    const findTarget = (clientX, clientY) => {
      const el = document.elementFromPoint(clientX, clientY);
      const col = el?.closest?.("[data-dia]");
      if (!col) return null;
      const rect = col.getBoundingClientRect();
      const y = clientY - rect.top;
      const h = Math.max(schedule.visStart, Math.min(schedule.visEnd, Math.floor(y / 64)));
      const end = Math.min(h + 2, schedule.visEnd + 1);
      return { dia: col.dataset.dia, start: h, end };
    };

    let rafId = null;
    let pendingCoords = null;

    const onMove = (e) => {
      if (e.pointerType !== "touch") return;
      pendingCoords = { x: e.clientX, y: e.clientY };
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          if (pendingCoords) {
            setTouchPos(pendingCoords);
            setDragHover(findTarget(pendingCoords.x, pendingCoords.y));
          }
          rafId = null;
        });
      }
    };
    const onUp = (e) => {
      if (e.pointerType !== "touch") return;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      const dx = e.clientX - touchDrag.startX;
      const dy = e.clientY - touchDrag.startY;
      if (Math.abs(dx) + Math.abs(dy) < 10) {
        setEditando(null);
        setModalPrefill({ materiaId: touchDrag.materiaId });
        setShowModal(true);
      } else {
        const t = findTarget(e.clientX, e.clientY);
        if (t) {
          setModalPrefill({
            materiaId: touchDrag.materiaId,
            dia: t.dia,
            horaInicio: HORAS_FORM[t.start] || HORAS_FORM[schedule.visStart],
            horaFin: HORAS_FORM[t.end] || HORAS_FORM[schedule.visEnd],
          });
          setEditando(null);
          setShowModal(true);
        }
      }
      setDragMateriaId(null);
      setDragHover(null);
      setTouchPos(null);
      setTouchDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [touchDrag, schedule.visStart, schedule.visEnd]);

  return (
    <div className={styles.wrap}>
      {}
      <HoyWidget horarioData={data} malla={malla} />

      {}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Horario</h2>
          <p className={styles.subtitle}>Semestre actual · {materiasActuales.length} materias</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn} onClick={()=>setShowExport(true)}>
            <IconDownload size={13} /> Exportar
          </button>
          {mode==="horario" && (
            <button className={styles.addBtn} onClick={()=>{ setEditando(null); setModalPrefill(null); setShowModal(true); }}>
              + Añadir clase
            </button>
          )}
        </div>
      </div>

      {}
      <div className={styles.modeBar}>
        <div className={styles.modeToggleGroup}>
          {[{id:"horario",label:"Mi horario",IconComp:IconSchedule},{id:"planificador",label:"Planificar",IconComp:IconStar}].map(m=>(
            <button key={m.id}
              className={`${styles.modeToggleBtn} ${mode===m.id?styles.modeToggleBtnActive:""}`}
              onClick={()=>setMode(m.id)}>
              <m.IconComp size={13} /> {m.label}
            </button>
          ))}
        </div>
      </div>

      {}
      {mode==="horario" && (<>
        <div className={styles.diasRow}>
          <span className={styles.diasLabel}>Días activos:</span>
          {TODOS_DIAS.map(d=>(
            <button key={d.id}
              className={`${styles.diaBtn} ${data.dias.includes(d.id)?styles.diaBtnActive:""}`}
              onClick={()=>toggleDia(d.id)}>
              {d.label}
            </button>
          ))}
        </div>

        {materiasActuales.length>0 && (
          <div className={styles.legendRow} onDragOver={e=>e.preventDefault()} onDrop={e=>e.preventDefault()}>
            <span className={styles.legendDragHint}>
              <IconSchedule size={11} />
              {isMobile ? "Toca una materia para agendarla" : "Arrastra una materia a una franja para agendar"}
            </span>
            {materiasActuales.map(m=>(
              <div key={m.id}
                className={`${styles.legendItem} ${isMobile?styles.legendItemTap:""} ${dragMateriaId===m.id?styles.legendItemDragging:""}`}
                draggable={!isMobile}
                title={isMobile ? `Toca o arrastra ${m.id} a una franja para agendarla` : `Arrastra ${m.id} a una franja del horario`}
                onDragStart={(e)=>{ setDragMateriaId(m.id); e.dataTransfer.effectAllowed="move"; }}
                onDragEnd={clearDrag}
                onPointerDown={(e)=>{
                  if (e.pointerType === "touch") {
                    e.preventDefault();
                    setDragMateriaId(m.id);
                    setTouchDrag({ materiaId: m.id, startX: e.clientX, startY: e.clientY });
                    setTouchPos({ x: e.clientX, y: e.clientY });
                  }
                }}>
                <span className={styles.legendDot} style={{background:colorMap[m.id]}}/>
                <span className={styles.legendId}>{m.id}</span>
                <span className={styles.legendNombre}>{m.nombre}</span>
              </div>
            ))}
          </div>
        )}

        {conflictSet.size > 0 && (
          <div className={styles.conflictBanner}>
            <IconWarning size={13} /> Se detectaron <strong>{conflictSet.size}</strong> choque{conflictSet.size>1?"s":""} en tu horario
          </div>
        )}

        {materiasActuales.length===0 && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}><IconSchedule size={36} /></span>
            <p>No tienes materias en estado <strong>Cursando</strong>.</p>
            <p>Ve a la <strong>Malla</strong> y cambia el estado de tus materias actuales.</p>
          </div>
        )}

        {diasActivos.length>0 && (() => {
          if (schedule.usedSet.size === 0) {
            return (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}><IconSchedule size={36} /></span>
                <p>No hay clases en el horario.</p>
                <p>Toca <strong>+ Añadir clase</strong> o arrastra una materia desde la leyenda.</p>
              </div>
            );
          }
          return (
            <div className={styles.gridWrap}>
              <div className={styles.grid} style={{"--num-dias":diasActivos.length}}>
                <div className={styles.horaCol}>
                  <div className={styles.horaColHeader}/>
                  {schedule.visHoras.map((h, i) => <div key={h} className={styles.horaCell}>{h}</div>)}
                </div>
                {diasActivos.map(dia=>(
                  <div key={dia.id} className={styles.diaCol}>
                    <div className={styles.diaHeader}>
                      <span className={styles.diaLabelCorto}>{dia.id}</span>
                      <span className={styles.diaLabelLargo}>{dia.label}</span>
                    </div>
                    <div className={styles.diaBody} data-dia={dia.id}
                      onDragOver={(e)=>handleDragOver(e, dia.id)}
                      onDrop={(e)=>handleDrop(e, dia.id)}
                      onDragLeave={(e)=>{
                        if (!e.currentTarget.contains(e.relatedTarget)) setDragHover(null);
                      }}>
                      {schedule.visHoras.map(h => <div key={h} className={styles.horaLine}/>)}
                      {dragHover?.dia === dia.id && (
                        <div className={styles.dropPreview}
                          style={{
                            top:(dragHover.start - schedule.visStart)*64,
                            height:(dragHover.end - dragHover.start)*64,
                          }}>
                          <span className={styles.dropPreviewLabel}>
                            <IconCheck size={11} /> Agendar aquí
                          </span>
                        </div>
                      )}
                      {data.clases.filter(c=>c.dia===dia.id).map((clase,i)=>{
                        const globalIdx=data.clases.indexOf(clase);
                        const start=horaIdx(clase.horaInicio), end=horaIdx(clase.horaFin);
                        if(start<0||end<=start) return null;
                        const materia=materiasActuales.find(m=>m.id===clase.materiaId);
                        return (
                          <ClaseBloque key={i} clase={clase} materia={materia}
                            color={colorMap[clase.materiaId]||"var(--accent)"}
                            horaStart={start - schedule.visStart} duracion={end-start}
                            isConflict={conflictSet.has(globalIdx)}
                            onClick={()=>{ setEditando(buildEditando(data.clases, globalIdx)); setModalPrefill(null); setShowModal(true); }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {touchDrag && touchPos && (
          <div className={styles.touchGhost}
            style={{ transform: `translate(${touchPos.x}px, ${touchPos.y}px)` }}>
            <IconSchedule size={11} />
            {materiasActuales.find(m=>m.id===touchDrag.materiaId)?.id || touchDrag.materiaId}
          </div>
        )}
      </>)}

      {}
      {mode==="planificador" && (
        <PlanificadorView
          malla={malla}
          planData={planData}
          onSavePlan={onSavePlan}
          user={user}
          onNotify={onNotify}
          mainDias={data.dias}
          onTransferToHorario={handleTransferPlanToHorario}
          onEnrollMaterias={onEnrollMaterias}
        />
      )}

      {}
      {showModal && (
        <ClaseModal
          materiasDisponibles={materiasActuales}
          allMaterias={allMaterias}
          existingClases={data.clases}
          editIdxSet={editando?.idx1!==undefined ? [editando.idx1, editando.idx2].filter(i=>i!==undefined) : []}
          prefill={modalPrefill}
          diasActivos={data.dias}
          editando={editando?.idx1!==undefined?editando:null}
          onSave={handleAddClase}
          onDelete={()=>handleDeleteClase([editando.idx1, editando.idx2].filter(i=>i!==undefined))}
          onNotify={onNotify}
          onClose={()=>{ setShowModal(false); setEditando(null); setModalPrefill(null); }}
        />
      )}

      {}
      {showExport && (
        <Suspense fallback={null}>
          <HorarioExport
            user={user}
            horarioData={data}
            malla={malla}
            onNotify={onNotify}
            onOpenWallpaper={handleOpenWallpaper}
            onClose={()=>setShowExport(false)}
          />
        </Suspense>
      )}

      {}
      {showWallpaper && (
        <Suspense fallback={null}>
          <HorarioWallpaper
            user={user}
            horarioData={data}
            malla={malla}
            onNotify={onNotify}
            onClose={()=>setShowWallpaper(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
