import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import styles from "./NotasView.module.css";
import {
  MAX_GRADE,
  PASS_GRADE,
  isEnglishLetterGrade,
  isGradePassed,
  isGradeFailed,
  isValidNumericGrade,
  sanitizeNumericGrade,
} from "../utils/gradeHelpers.js";
import { projectDesiredAverage, calcGlobalPond, simulateFailMateria } from "../utils/careerProgress.js";
import { IconCheck, IconX, IconClose, IconWarning } from "./Icons";

function calcPonderado(materias, notasMap, semestreById) {
  let sumPond = 0, sumCred = 0;
  materias.forEach((m) => {
    const n = notasMap[m.id];
    const sem = semestreById.get(m.id);
    if (isEnglishLetterGrade(m, sem)) return;
    const nota = n?.nota !== undefined ? Number(n.nota) : null;
    if (nota !== null && !isNaN(nota)) {
      sumPond += nota * m.creditos;
      sumCred += m.creditos;
    }
  });
  if (sumCred === 0) return null;
  return { valor: sumPond / sumCred, creditos: sumCred, sumPond };
}

function buildSemestreMap(malla) {
  const map = new Map();
  malla.forEach((sem) => {
    if (typeof sem.semestre !== "number") return;
    sem.materias.forEach((m) => map.set(m.id, sem.semestre));
  });
  return map;
}


function GradeInput({ value, onChange, placeholder = "0 – 500" }) {
  return (
    <input
      className={styles.gradeInput}
      type="number" min="0" max={MAX_GRADE}
      value={value ?? ""}
      onChange={(e) => onChange(sanitizeNumericGrade(e.target.value))}
      placeholder={placeholder}
    />
  );
}

function LetterGradeSelect({ value, onChange }) {
  return (
    <select
      className={styles.letterSelect}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">—</option>
      <option value="A">A — Aprobado</option>
      <option value="I">I — Insuficiente</option>
    </select>
  );
}

function GradeBadge({ mat, semestre, nota }) {
  if (nota === undefined || nota === null || nota === "") return null;
  const passed = isGradePassed(mat, semestre, nota);
  const failed = isGradeFailed(mat, semestre, nota);
  if (!passed && !failed) return null;

  const label = isEnglishLetterGrade(mat, semestre)
    ? <>{passed ? <IconCheck size={11} /> : <IconX size={11} />} {passed ? "Aprobado" : "Insuficiente"}</>
    : <>{passed ? <IconCheck size={11} /> : <IconX size={11} />} {passed ? "Aprobó" : "Asignatura perdida"}</>;

  return (
    <span className={`${styles.gradeBadge} ${passed ? styles.gradeBadgePass : styles.gradeBadgeFail}`}>
      {label}
    </span>
  );
}

function MateriaRow({ mat, semestre, notaData, onChange, colorAprobada, colorCursando, colorFaltante }) {
  const estado = mat.estado;
  const nota   = notaData?.nota;
  const letterGrade = isEnglishLetterGrade(mat, semestre);
  const passed = isGradePassed(mat, semestre, nota);
  const failed = isGradeFailed(mat, semestre, nota);
  const intentos = notaData?.intentos || [];

  const color = estado === "aprobada" ? colorAprobada : estado === "cursando" ? colorCursando : colorFaltante;

  const updateField = (field, val) => onChange({ ...notaData, [field]: val });
  const updateIntento = (idx, field, val) => {
    const newIntentos = intentos.map((it, i) => i === idx ? { ...it, [field]: val } : it);
    onChange({ ...notaData, intentos: newIntentos });
  };
  const addIntento = () => onChange({ ...notaData, intentos: [...intentos, { nota: undefined, semestre: "" }] });
  const removeIntento = (idx) => onChange({ ...notaData, intentos: intentos.filter((_, i) => i !== idx) });

  const showGradeFields = estado === "cursando" || estado === "aprobada";

  return (
    <div className={`${styles.materiaRow} ${failed ? styles.materiaFailed : ""}`}>
      <div className={styles.materiaBar} style={{ background: color }} />

      <div className={styles.materiaBody}>
        <div className={styles.materiaTop}>
          <div>
            <span className={styles.materiaId}>{mat.id}</span>
            <span className={styles.materiaNombre}>{mat.nombre}</span>
            {estado === "cursando" && (
              <span className={styles.cursandoTag}>Cursando actualmente</span>
            )}
          </div>
          <span className={styles.materiaCreditos}>{mat.creditos} cr</span>
        </div>

        {showGradeFields && (
          <div className={styles.aprobadaFields}>
            {estado === "cursando" && (
              <div className={styles.cursandoFields}>
                <div className={styles.fieldGroup}>
                  <label>Profesor</label>
                  <input
                    className={styles.textInput}
                    value={notaData?.profesor || ""}
                    onChange={(e) => updateField("profesor", e.target.value)}
                    placeholder="Nombre del profesor"
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Grupo</label>
                  <input
                    className={styles.textInput}
                    value={notaData?.grupo || ""}
                    onChange={(e) => updateField("grupo", e.target.value)}
                    placeholder="Ej: G01"
                  />
                </div>
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label>Nota definitiva</label>
              <div className={styles.gradeWrap}>
                {letterGrade ? (
                  <LetterGradeSelect value={notaData?.nota} onChange={(v) => updateField("nota", v)} />
                ) : (
                  <GradeInput value={notaData?.nota} onChange={(v) => updateField("nota", v)} />
                )}
                <GradeBadge mat={mat} semestre={semestre} nota={nota} />
              </div>
            </div>

            {failed && (
              <div className={styles.repeticionSection}>
                <div className={styles.repeticionHeader}>
                  <span className={styles.repeticionLabel}>Intentos adicionales</span>
                  <button type="button" className={styles.addBtn} onClick={addIntento}>+ Agregar intento</button>
                </div>
                {intentos.map((it, idx) => (
                  <div key={idx} className={styles.intentoRow}>
                    <div className={styles.fieldGroup}>
                      <label>Semestre cursado</label>
                      <input
                        className={styles.textInput}
                        value={it.semestre || ""}
                        onChange={(e) => updateIntento(idx, "semestre", e.target.value)}
                        placeholder="Ej: 2024-2"
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label>Nota</label>
                      <div className={styles.gradeWrap}>
                        {letterGrade ? (
                          <LetterGradeSelect
                            value={it.nota}
                            onChange={(v) => updateIntento(idx, "nota", v)}
                          />
                        ) : (
                          <GradeInput
                            value={it.nota}
                            onChange={(v) => updateIntento(idx, "nota", v)}
                          />
                        )}
                        <GradeBadge mat={mat} semestre={semestre} nota={it.nota} />
                      </div>
                    </div>
                     <button type="button" className={styles.removeBtn} aria-label="Eliminar intento" onClick={() => removeIntento(idx)}><IconClose size={11} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotasView({ malla, notas, onSave, user }) {
  const [localNotas, setLocalNotas] = useState(notas || {});
  const [savedMsg, setSavedMsg]     = useState(false);
  const [view, setView]             = useState("semestres");
  const [showDesiredMode, setShowDesiredMode] = useState(false);
  const [desiredAvg, setDesiredAvg]           = useState("");
  const [showFailSim, setShowFailSim]         = useState(false);
  const [failSimId, setFailSimId]             = useState("");
  const [failGrade, setFailGrade]             = useState("200");
  const [retakeGrade, setRetakeGrade]         = useState("400");

  const colors = user.themeColors || {};
  const colorA = colors.aprobada || "#6ec88a";
  const colorC = colors.cursando || "#c8a96e";
  const colorF = colors.faltante || "#3a3a52";

  const semestreById = useMemo(() => buildSemestreMap(malla), [malla]);

  const isLocalEdit = useRef(false);
  const saveTimerRef = useRef(null);

  const updateNota = useCallback((id, data) => {
    isLocalEdit.current = true;
    setLocalNotas((prev) => ({ ...prev, [id]: data }));
  }, []);

  useEffect(() => {
    if (!isLocalEdit.current) return;
    isLocalEdit.current = false;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      onSave(localNotas);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 1800);
    }, 800);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [localNotas, onSave]);

  const activeSemesters = useMemo(() => malla.filter((sem) =>
    typeof sem.semestre === "number"
    && sem.materias.some((m) => m.estado === "cursando" || m.estado === "aprobada")
  ), [malla]);

  const allMaterias = useMemo(() => malla.flatMap((s) => s.materias), [malla]);
  const globalPond  = useMemo(() => calcGlobalPond(malla, localNotas), [malla, localNotas]);

  const totalCreditos = useMemo(() => allMaterias.reduce((a, m) => a + m.creditos, 0), [allMaterias]);
  const creditosAprobados = useMemo(() => allMaterias.reduce((acc, m) => {
    const n = localNotas[m.id];
    if (!n) return acc;
    const sem = semestreById.get(m.id);
    const notaMain = n.nota;
    const intentos = n.intentos || [];
    const aprobadoMain = isGradePassed(m, sem, notaMain);
    const tieneIntentoAprobado = intentos.some((i) => isGradePassed(m, sem, i.nota));
    if (aprobadoMain || tieneIntentoAprobado) return acc + m.creditos;
    return acc;
  }, 0), [allMaterias, localNotas, semestreById]);
  const pctAprobados = totalCreditos > 0 ? Math.round((creditosAprobados / totalCreditos) * 100) : 0;

  const formatNotaResumen = (m, nota) => {
    if (nota === undefined || nota === null || nota === "") return "—";
    return nota;
  };

  const projection = useMemo(() => (showDesiredMode && desiredAvg !== ""
    ? projectDesiredAverage(malla, localNotas, desiredAvg)
    : null), [showDesiredMode, desiredAvg, malla, localNotas]);

  const simulables = useMemo(() => allMaterias
    .filter((m) => {
      if (m.estado !== "cursando") return false;
      if (isEnglishLetterGrade(m, semestreById.get(m.id))) return false;
      return true;
    })
    .sort((a, b) => (semestreById.get(a.id) ?? 99) - (semestreById.get(b.id) ?? 99)),
    [allMaterias, semestreById]);

  const failSim = useMemo(() => (showFailSim && failSimId
    ? simulateFailMateria(malla, localNotas, failSimId, {
        failedGrade: failGrade !== "" ? Number(failGrade) : undefined,
        retakeGrade: retakeGrade !== "" ? Number(retakeGrade) : undefined,
      })
    : null), [showFailSim, failSimId, malla, localNotas, failGrade, retakeGrade]);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Notas y <em>Promedios</em></h2>
          <p className={styles.subtitle}>{user.career} · {user.university}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle}>
            <button className={`${styles.toggleBtn} ${view === "semestres" ? styles.toggleActive : ""}`} onClick={() => setView("semestres")}>
              Por semestre
            </button>
            <button className={`${styles.toggleBtn} ${view === "resumen" ? styles.toggleActive : ""}`} onClick={() => setView("resumen")}>
              Resumen global
            </button>
          </div>
          {savedMsg && (
            <span className={styles.saveBtnDone}>
              <IconCheck size={12} /> Guardado
            </span>
          )}
        </div>
      </div>

      <div className={styles.globalBanner} style={{ borderColor: colorA }}>
        <div>
          <p className={styles.globalLabel}>Promedio ponderado global</p>
          <p className={styles.globalSub}>
            {globalPond ? `${globalPond.creditos} créditos con nota registrada` : "Todavía sin notas registradas"}
          </p>
        </div>
        <div className={styles.creditStats}>
          <div className={styles.creditStat}>
            <p className={styles.creditStatLabel}>Créditos aprobados</p>
            <p className={styles.creditStatVal} style={{ color: colorA }}>
              {creditosAprobados}
              <span className={styles.creditStatSuffix}>/ {totalCreditos}</span>
            </p>
            <p className={styles.creditStatSub}>{pctAprobados}% del total</p>
          </div>
          {globalPond && (
            <span className={styles.globalVal} style={{ color: colorA }}>
              {globalPond.valor.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <div className={styles.desiredBar}>
        <label className={styles.desiredToggle}>
          <input
            type="checkbox"
            checked={showDesiredMode}
            onChange={(e) => setShowDesiredMode(e.target.checked)}
          />
          <span>Modo promedio deseado</span>
        </label>
        {showDesiredMode && (
          <div className={styles.desiredInputWrap}>
            <label className={styles.desiredInputLabel}>Promedio meta</label>
            <input
              className={styles.desiredInput}
              type="number"
              min="0"
              max={MAX_GRADE}
              step="0.1"
              value={desiredAvg}
              onChange={(e) => setDesiredAvg(e.target.value)}
              placeholder="Ej: 380"
            />
          </div>
        )}
      </div>

      {showDesiredMode && projection && (
        <div className={`${styles.projectionPanel} ${!projection.feasible ? styles.projectionWarn : ""}`}>
          <div className={styles.projectionHeader}>
            <h3 className={styles.projectionTitle}>Proyección hacia tu meta</h3>
            {projection.currentAvg !== null && (
              <span className={styles.projectionCurrent}>
                Promedio actual: <strong>{projection.currentAvg.toFixed(1)}</strong>
              </span>
            )}
          </div>
          {projection.message && (
            <p className={styles.projectionMessage}>{projection.message}</p>
          )}
          {projection.feasible && projection.requiredUniform !== null && (
            <>
              <p className={styles.projectionSummary}>
                Necesitas un promedio de <strong>{projection.requiredUniform.toFixed(1)}</strong> en los
                {" "}<strong>{projection.pendingCred}</strong> créditos que aún no tienen nota
                {projection.requiredUniform >= PASS_GRADE ? " (aprobatorio)" : " (por debajo del mínimo 300)"}.
              </p>
              {[...projection.pendingBySem.entries()]
                .sort(([a], [b]) => a - b)
                .map(([semNum, mats]) => (
                  <div key={semNum} className={styles.projectionSem}>
                    <p className={styles.projectionSemTitle}>Semestre {semNum}</p>
                    <div className={styles.projectionList}>
                      {mats.map((m) => (
                        <div key={m.id} className={styles.projectionRow}>
                          <span className={styles.projectionNombre}>{m.nombre}</span>
                          <span className={styles.projectionCred}>{m.creditos} cr</span>
                          <span className={styles.projectionNota}>
                            {projection.requiredUniform.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      )}

      <div className={styles.desiredBar}>
        <label className={styles.desiredToggle}>
          <input
            type="checkbox"
            checked={showFailSim}
            onChange={(e) => {
              setShowFailSim(e.target.checked);
              if (!e.target.checked) setFailSimId("");
            }}
          />
          <span>¿Y si repruebo esta materia?</span>
        </label>
        {showFailSim && (
          <div className={styles.failSimWrap}>
            <select
              className={styles.failSimSelect}
              value={failSimId}
              onChange={(e) => setFailSimId(e.target.value)}
            >
              <option value="">Elige una materia…</option>              {simulables.map((m) => {
                const n = localNotas[m.id];
                const notaActual = n
                  ? isValidNumericGrade(n.nota)
                    ? n.nota
                    : (n.intentos || []).find((it) => isValidNumericGrade(it.nota))?.nota
                  : undefined;
                return (
                  <option key={m.id} value={m.id}>
                    {m.id} · {m.nombre} (actual: {notaActual ?? "—"})
                  </option>
                );
              })}
            </select>
            {failSimId && (
              <>
                <label className={styles.desiredInputLabel}>Nota de pérdida</label>
                <input
                  className={styles.desiredInput}
                  type="number"
                  min="0"
                  max={MAX_GRADE}
                  value={failGrade}
                  onChange={(e) => setFailGrade(e.target.value)}
                  placeholder="200"
                />
                <label className={styles.desiredInputLabel}>Habilitación</label>
                <input
                  className={styles.desiredInput}
                  type="number"
                  min="0"
                  max={MAX_GRADE}
                  value={retakeGrade}
                  onChange={(e) => setRetakeGrade(e.target.value)}
                  placeholder="400"
                />
              </>
            )}
          </div>
        )}
      </div>

      {failSim && (
        <div className={`${styles.projectionPanel} ${failSim.delta !== null && failSim.delta < 0 ? styles.projectionWarn : ""}`}>
          <div className={styles.projectionHeader}>
            <h3 className={styles.projectionTitle}>
              <IconWarning size={13} /> Simulación de repitencia
            </h3>
            <span className={styles.projectionCurrent}>
              {failSim.materia.id} · <strong>{failSim.materia.nombre}</strong>
            </span>
          </div>
          {failSim.hasNota ? (
            <>
              <div className={styles.failSimRow}>
                <div className={styles.failSimAvg}>
                  <span className={styles.failSimLabel}>Promedio actual</span>
                  <strong>{failSim.currentAvg !== null ? failSim.currentAvg.toFixed(1) : "—"}</strong>
                </div>
                <span className={styles.failSimArrow}>→</span>
                <div className={styles.failSimAvg}>
                  <span className={styles.failSimLabel}>Si repruebas</span>
                  <strong>{failSim.newAvg !== null ? failSim.newAvg.toFixed(1) : "—"}</strong>
                </div>
              </div>
              {failSim.delta !== null && (
                <p className={styles.failSimDelta}>
                  Cambio: <strong>{failSim.delta > 0 ? "+" : ""}{failSim.delta.toFixed(2)}</strong> puntos
                  <span className={failSim.delta < 0 ? styles.failSimDeltaNeg : styles.failSimDeltaPos}>
                    {failSim.delta < 0 ? " · baja tu promedio" : " · sube tu promedio"}
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className={styles.projectionMessage}>Esta materia aún no tiene nota registrada.</p>
          )}
          <p className={styles.failSimHint}>
            En este modelo, la nota perdida ({failSim.simulatedFailedGrade}) y la habilitación ({failSim.simulatedRetakeGrade}) cuentan ambas en el ponderado global.
          </p>
        </div>
      )}

      {view === "semestres" && activeSemesters.map((sem) => {
        const activas = sem.materias.filter((m) => m.estado === "cursando" || m.estado === "aprobada");
        const pond = calcPonderado(activas, localNotas, semestreById);

        return (
          <div key={sem.semestre} className={styles.semCard}>
            <div className={styles.semHeader}>
              <div className={styles.semTitle}>
                <span className={styles.semNum}>Semestre {sem.semestre}</span>
                <span className={styles.semCreditos}>{activas.reduce((a, m) => a + m.creditos, 0)} créditos</span>
              </div>
              {pond && (
                <div className={styles.semPond}>
                  <span className={styles.semPondLabel}>Ponderado semestral</span>
                  <span className={styles.semPondVal} style={{ color: colorA }}>{pond.valor.toFixed(1)}</span>
                </div>
              )}
            </div>

            <div className={styles.materiasList}>
              {activas.map((mat) => (
                <MateriaRow
                  key={mat.id}
                  mat={mat}
                  semestre={sem.semestre}
                  notaData={localNotas[mat.id]}
                  onChange={(data) => updateNota(mat.id, data)}
                  colorAprobada={colorA}
                  colorCursando={colorC}
                  colorFaltante={colorF}
                />
              ))}
            </div>

            {pond && (
              <div className={styles.semFooter}>
                <span>Suma ponderaciones: <strong>{pond.sumPond.toFixed(1)}</strong></span>
                <span>÷</span>
                <span>Créditos: <strong>{pond.creditos}</strong></span>
                <span>=</span>
                <span className={styles.semFooterResult} style={{ color: colorA }}>
                  <strong>{pond.valor.toFixed(1)}</strong>
                </span>
              </div>
            )}
          </div>
        );
      })}

      {view === "resumen" && (
        <div className={styles.resumenWrap}>
          {activeSemesters.map((sem) => {
            const activas = sem.materias.filter((m) => m.estado === "cursando" || m.estado === "aprobada");
            const pond    = calcPonderado(activas, localNotas, semestreById);
            return (
              <div key={sem.semestre} className={styles.resumenRow}>
                <div className={styles.resumenLeft}>
                  <span className={styles.resumenSem}>Semestre {sem.semestre}</span>
                  <div className={styles.resumenMaterias}>
                    {activas.map((m) => {
                      const n    = localNotas[m.id];
                      const nota = n?.nota;
                      const passed = isGradePassed(m, sem.semestre, nota);
                      const failed = isGradeFailed(m, sem.semestre, nota);
                      const intentos = n?.intentos || [];
                      const lastApproved = intentos.filter((i) => isGradePassed(m, sem.semestre, i.nota)).slice(-1)[0];
                      return (
                        <div key={m.id} className={styles.resumenMateria}>
                          <span className={styles.resumenDot}
                            style={{ background: m.estado === "cursando" ? colorC : colorA }} />
                          <span className={styles.resumenNombre}>{m.nombre}</span>
                          <span className={styles.resumenCred}>{m.creditos}cr</span>
                          {nota !== undefined && nota !== "" ? (
                            <span className={`${styles.resumenNota} ${passed ? styles.resumenPass : styles.resumenFail}`}>
                              {formatNotaResumen(m, nota)}
                              {failed && lastApproved && (
                                 <span className={styles.resumenRetake}> → {formatNotaResumen(m, lastApproved.nota)} <IconCheck size={10} /></span>
                              )}
                            </span>
                          ) : (
                            <span className={styles.resumenSinNota}>—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className={styles.resumenRight}>
                  {pond ? (
                    <>
                      <span className={styles.resumenPondLabel}>Ponderado</span>
                      <span className={styles.resumenPondVal} style={{ color: colorA }}>{pond.valor.toFixed(1)}</span>
                      <span className={styles.resumenPondCred}>{pond.creditos} cr</span>
                    </>
                  ) : (
                    <span className={styles.resumenSinNota}>Sin notas</span>
                  )}
                </div>
              </div>
            );
          })}

          {globalPond && (
            <div className={styles.resumenTotal} style={{ borderColor: colorA }}>
              <span>Promedio ponderado total</span>
              <span className={styles.resumenTotalVal} style={{ color: colorA }}>
                {globalPond.valor.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      )}

      {activeSemesters.length === 0 && (
        <div className={styles.emptyState}>
          <p>No tienes materias aprobadas o en curso todavía.</p>
          <p>Ve a <strong>Mi Perfil</strong> y configura tu semestre actual.</p>
        </div>
      )}
    </div>
  );
}
