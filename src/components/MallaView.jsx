import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { MALLA, ESTADOS } from "../data/malla.js";
import { getSemesterCountdown, semesterCorteFor, semesterDatesFor } from "../utils/semesterCountdown.js";
import { canEnrollMateria } from "../utils/gradeHelpers.js";
import { buildMallaTxt, downloadTxt } from "../utils/mallaExport.js";
import { IconClose, IconLightbulb, IconWarning } from "./Icons";
import { getObligatorias } from "../utils/careerProgress.js";
import MateriaCard from "./MateriaCard";
import styles from "./MallaView.module.css";

function applyAutoApprove(malla, currentSemester) {
  return malla.map((sem) => ({
    ...sem,
    materias: sem.materias.map((m) => {
      if (typeof sem.semestre !== "number") return m;
      if (sem.semestre < currentSemester && m.estado === "faltante")
        return { ...m, estado: "aprobada" };
      if (sem.semestre === currentSemester && m.estado === "faltante")
        return { ...m, estado: "cursando" };
      return m;
    }),
  }));
}

export default function MallaView({ malla: initialMalla, notas, onSave, user, onNotify, semestre }) {
  const [malla, setMalla] = useState(() =>
    applyAutoApprove(initialMalla || MALLA, user.semester || 1)
  );
  const [selected, setSelected]               = useState(null);
  const [highlightedPrereqs, setHighlightedPrereqs] = useState([]);
  const [highlightedUnlocks, setHighlightedUnlocks] = useState([]);
  const [showMatriculables, setShowMatriculables] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key !== "Escape") return;
      if (confirm) { setConfirm(null); return; }
      if (selected) {
        setSelected(null);
        setHighlightedPrereqs([]);
        setHighlightedUnlocks([]);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [confirm, selected]);

  useEffect(() => {
    if (confirm && confirmBtnRef.current) confirmBtnRef.current.focus();
  }, [confirm]);

  const colors = user.themeColors || {};
  const br     = user.borderRadius ?? 12;
  const fs     = user.fontScale ?? 1;

  const allMaterias = useMemo(() => malla.flatMap((s) => s.materias), [malla]);
  const materiaById = useMemo(() => new Map(allMaterias.map(m => [m.id, m])), [allMaterias]);
  const obligatorias = useMemo(() => getObligatorias(malla), [malla]);

  const getColor = useCallback((estado) => {
    if (estado === "aprobada") return colors.aprobada || "#6ec88a";
    if (estado === "cursando") return colors.cursando || "#c8a96e";

    const isDarkMode = typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme") !== "light"
      : (user?.appMode || "light") === "dark";

    const fallback = isDarkMode ? "#7c8cff" : "#5b6cdf";
    const rawColor = colors.faltante || "#3a3a52";

    if (!isDarkMode || typeof rawColor !== "string" || !rawColor.startsWith("#")) {
      return rawColor;
    }

    const hex = rawColor.replace("#", "");
    const normalized = hex.length === 3
      ? hex.split("").map((ch) => ch + ch).join("")
      : hex;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance < 0.34 ? fallback : rawColor;
  }, [colors.aprobada, colors.cursando, colors.faltante, user?.appMode]);

  const handleSelect = useCallback((materia) => {
    if (selected?.id === materia.id) {
      setSelected(null);
      setHighlightedPrereqs([]);
      setHighlightedUnlocks([]);
      return;
    }
    setSelected(materia);

    const prereqTree = [];
    const collectPrereqs = (ids) => {
      ids.forEach((id) => {
        if (!prereqTree.includes(id)) {
          prereqTree.push(id);
          const m = materiaById.get(id);
          if (m) collectPrereqs(m.prereqs);
        }
      });
    };
    collectPrereqs(materia.prereqs);
    setHighlightedPrereqs(prereqTree);

    const unlockTree = [];
    const collectUnlocks = (materiaId) => {
      allMaterias.forEach((m) => {
        if (m.prereqs.includes(materiaId) && !unlockTree.includes(m.id)) {
          unlockTree.push(m.id);
          collectUnlocks(m.id);
        }
      });
    };
    collectUnlocks(materia.id);
    setHighlightedUnlocks(unlockTree);
  }, [selected, materiaById, allMaterias]);

  const applyEstadoChange = useCallback((materiaId, newEstado, { autoApprovePrereqs, extraChanges } = {}) => {
    const updated = malla.map((s) => ({
      ...s,
      materias: s.materias.map((m) => {
        if (extraChanges?.has(m.id)) return { ...m, estado: extraChanges.get(m.id) };
        if (m.id === materiaId) return { ...m, estado: newEstado };
        if (autoApprovePrereqs && newEstado === "aprobada") {
          const materia = materiaById.get(materiaId);
          if (materia && materia.prereqs.includes(m.id) && m.estado !== "aprobada") {
            return { ...m, estado: "aprobada" };
          }
        }
        return m;
      }),
    }));
    setMalla(updated);
    onSave(updated);
    if (selected) {
      const updatedSelected = updated.flatMap((s) => s.materias).find((m) => m.id === selected.id);
      if (updatedSelected) setSelected(updatedSelected);
    }
  }, [malla, onSave, selected, materiaById]);

  const handleEstadoChange = useCallback((materiaId, newEstado) => {
    const materia = materiaById.get(materiaId);
    if (!materia) return;

    if (newEstado === "faltante") {
      const dependents = new Map();
      malla.flatMap((s) => s.materias).forEach((m) => {
        (m.prereqs || []).forEach((pid) => {
          if (!dependents.has(pid)) dependents.set(pid, []);
          dependents.get(pid).push(m.id);
        });
      });
      const affected = new Set();
      const toVisit = [materiaId];
      while (toVisit.length > 0) {
        const pid = toVisit.pop();
        (dependents.get(pid) || []).forEach((depId) => {
          if (!affected.has(depId)) {
            affected.add(depId);
            toVisit.push(depId);
          }
        });
      }
      const affectedList = malla.flatMap((s) => s.materias).filter(
        (m) => affected.has(m.id) && (m.estado === "aprobada" || m.estado === "cursando")
      );
      if (affectedList.length > 0) {
        const extraChanges = new Map();
        extraChanges.set(materiaId, newEstado);
        affectedList.forEach((m) => extraChanges.set(m.id, "faltante"));
        setConfirm({
          title: "Cambiar a faltante",
          message: `Si cambias "${materia.nombre}" a faltante, estas materias que dependen de ella también pasarán a faltante:`,
          affected: affectedList,
          buttonLabel: "Cambiar todo",
          onConfirm: () => applyEstadoChange(materiaId, newEstado, { extraChanges }),
        });
        return;
      }
    }

    if (newEstado === "aprobada") {
      const missingPrereqs = (materia.prereqs || [])
        .map((pid) => materiaById.get(pid))
        .filter((pm) => pm && pm.estado !== "aprobada");
      if (missingPrereqs.length > 0) {
        setConfirm({
          title: "Aprobar materia",
          message: `Para aprobar "${materia.nombre}", primero debes aprobar sus prerequisitos. ¿Aprobar automáticamente?`,
          affected: missingPrereqs,
          buttonLabel: "Aprobar prerequisitos y continuar",
          onConfirm: () => applyEstadoChange(materiaId, newEstado, { autoApprovePrereqs: true }),
        });
        return;
      }
    }

    applyEstadoChange(materiaId, newEstado);
  }, [malla, materiaById, applyEstadoChange]);

  const stats = useMemo(() => ({
    total:     obligatorias.length,
    aprobadas: obligatorias.filter((m) => m.estado === "aprobada").length,
    cursando:  obligatorias.filter((m) => m.estado === "cursando").length,
    faltantes: obligatorias.filter((m) => m.estado === "faltante").length,
  }), [obligatorias]);
  const progress = stats.total > 0 ? Math.round((stats.aprobadas / stats.total) * 100) : 0;

  const creditStats = useMemo(() => {
    const total = obligatorias.reduce((a, m) => a + m.creditos, 0);
    const aprobados = obligatorias
      .filter((m) => m.estado === "aprobada")
      .reduce((a, m) => a + m.creditos, 0);
    const cursando = obligatorias
      .filter((m) => m.estado === "cursando")
      .reduce((a, m) => a + m.creditos, 0);
    const pct = total > 0 ? Math.round((aprobados / total) * 100) : 0;
    return { total, aprobados, cursando, pct };
  }, [obligatorias]);

  const pendingPrereqs = useMemo(() => {
    const alerts = [];
    obligatorias.forEach((m) => {
      if (m.estado !== "faltante") return;
      const missing = (m.prereqs || []).filter(
        (pid) => materiaById.get(pid)?.estado !== "aprobada"
      );
      if (missing.length > 0) {
        alerts.push({
          materia: m,
          missing: missing.map((pid) => materiaById.get(pid)?.nombre || pid),
        });
      }
    });
    return alerts;
  }, [obligatorias, materiaById]);

  const selectedMissingPrereqs = useMemo(() => {
    if (!selected) return [];
    return (selected.prereqs || []).filter(
      (pid) => materiaById.get(pid)?.estado !== "aprobada"
    );
  }, [selected, materiaById]);

  const handleDownload = () => {
    const content = buildMallaTxt({ user, malla, notas: notas || {} });
    const safeName = (user.username || "estudiante").replace(/[^\w.-]/g, "_");
    downloadTxt(`malla_${safeName}.txt`, content);
    onNotify?.("Malla descargada");
  };
  const semester = useMemo(() => getSemesterCountdown(semestre), [semestre]);
  const semDates = useMemo(() => semesterDatesFor(semestre), [semestre]);
  const MESES_CORTOS_M = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const fmtSemDate = (d) => `${d.getDate()} ${MESES_CORTOS_M[d.getMonth()]} ${d.getFullYear()}`;
  const semRange = `${fmtSemDate(semDates.start)} – ${fmtSemDate(semDates.end)}`;
  const matriculables = useMemo(() => allMaterias.filter((m) => canEnrollMateria(m, allMaterias)), [allMaterias]);
  const matriculableIds = useMemo(() => new Set(matriculables.map((m) => m.id)), [matriculables]);

  return (
    <div className={styles.wrap} style={{ "--fs": fs }}>
      {}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div>
            <h2 className={styles.title}>Malla <em>Curricular</em></h2>
            <p className={styles.subtitle}>{user.career} · {user.university}</p>
          </div>
          <button type="button" className={styles.downloadBtn} onClick={handleDownload}>
            ↓ Descargar malla (.txt)
          </button>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.stats}>
          {[
            { label: "Aprobadas", val: stats.aprobadas, color: colors.aprobada || "#6ec88a" },
            { label: "Cursando",  val: stats.cursando,  color: colors.cursando  || "#c8a96e" },
            { label: "Faltantes", val: stats.faltantes, color: colors.faltante  || "#3a3a52" },
          ].map((s) => (
            <div key={s.label} className={styles.stat}>
              <span className={styles.statDot} style={{ background: s.color }} />
              <span className={styles.statVal}>{s.val}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
          </div>
        </div>
      </div>

      {}
      <div className={styles.progressWrap}>
        <div className={styles.progressInfo}>
          <span>Progreso académico</span><span>{progress}%</span>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%`, background: colors.aprobada || "#6ec88a" }} />
        </div>
      </div>

      <div className={styles.progressWrap}>
        <div className={styles.progressInfo}>
          <span>Progreso por créditos</span>
          <span>{creditStats.aprobados} / {creditStats.total} cr · {creditStats.pct}%</span>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${creditStats.pct}%`, background: "var(--accent)" }} />
        </div>
        {creditStats.cursando > 0 && (
          <div className={styles.progressInfo}>
            <span>En curso ahora</span><span>{creditStats.cursando} cr</span>
          </div>
        )}
      </div>

      {pendingPrereqs.length > 0 && (
        <div className={styles.prereqAlertBanner}>
          <IconWarning size={16} />
          <div className={styles.prereqAlertText}>
            <strong>{pendingPrereqs.length} materias bloqueadas</strong> por prerequisitos sin aprobar. Aprueba las anteriores para desbloquearlas.
          </div>
        </div>
      )}

      <div className={styles.semesterWidget}>
        <div className={styles.semesterWidgetAccent} />
        <div className={styles.semesterWidgetTop}>
          <div>
            <p className={styles.semesterWidgetLabel}>
              Cuenta regresiva · Corte {semesterCorteFor(semestre)}
            </p>
            <p className={styles.semesterWidgetRange}>{semRange}</p>
          </div>
          <span className={styles.semesterWidgetStatus}>{semester.status}</span>
        </div>
        <div className={styles.semesterWidgetMain}>
          <div className={styles.semesterWidgetCounter}>
            <span className={styles.semesterWidgetDays}>{semester.days}</span>
            <span className={styles.semesterWidgetText}>{semester.daysText}</span>
          </div>
        </div>
        {semester.showProgress && (
          <>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${semester.progress}%`, background: "var(--accent)" }}
              />
            </div>
            {semester.progressInfo && (
              <div className={styles.progressInfo}>
                <span>{semester.progressInfo.left}</span>
                <span>{semester.progressInfo.right}</span>
              </div>
            )}
          </>
        )}
      </div>

      {}
      <div className={styles.legend}>
        <span className={styles.legendHint}><IconLightbulb size={13} /> Toca una materia para ver sus prerequisitos</span>
        <div className={styles.legendItems}>
          {Object.entries(ESTADOS).map(([k, v]) => (
            <div key={k} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: getColor(k) }} />
              <span>{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {}
      <div className={styles.grid}>
        {malla.map((sem, si) => {
          const isOptativas = sem.semestre === "opt";
          const optColumns = isOptativas
            ? [sem.materias.slice(0, 6), sem.materias.slice(6, 12), sem.materias.slice(12, 15)]
            : null;

          const renderCard = (mat) => (
            <MateriaCard
              key={mat.id}
              materia={mat}
              color={getColor(mat.estado)}
              isSelected={selected?.id === mat.id}
              isHighlightedPrereq={highlightedPrereqs.includes(mat.id)}
              isHighlightedUnlock={highlightedUnlocks.includes(mat.id)}
              isMatriculable={showMatriculables && matriculableIds.has(mat.id)}
              isDimmed={
                (selected
                  && selected.id !== mat.id
                  && !highlightedPrereqs.includes(mat.id)
                  && !highlightedUnlocks.includes(mat.id))
                || (showMatriculables
                  && !selected
                  && !matriculableIds.has(mat.id)
                  && mat.estado === "faltante")
              }
              borderRadius={br}
              fontScale={fs}
              onClick={() => handleSelect(mat)}
            />
          );

          return (
            <div key={si} className={`${styles.semestre} ${isOptativas ? styles.semestreOpt : ""}`}>
              <div className={styles.semestreHeader}>
                <span className={styles.semestreNum}>
                  {typeof sem.semestre === "number" ? `S${sem.semestre}` : "OPT"}
                </span>
                <span className={styles.semestreLabel}>
                  {sem.label || `Semestre ${sem.semestre}`}
                </span>
                <span className={styles.semestreCreditos}>
                  {sem.materias.reduce((a, m) => a + m.creditos, 0)} cr
                </span>
              </div>
              {isOptativas ? (
                <div className={styles.materiasOptColumns}>
                  {optColumns.map((col, ci) => (
                    <div key={ci} className={styles.materiasOptCol}>
                      {col.map((mat) => renderCard(mat))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.materias}>
                  {sem.materias.map((mat) => renderCard(mat))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.matriculablesBar}>
        <label className={styles.matriculablesToggle}>
          <input
            type="checkbox"
            checked={showMatriculables}
            onChange={(e) => setShowMatriculables(e.target.checked)}
          />
          <span>Ver qué puedo matricular este semestre</span>
          {showMatriculables && (
            <span className={styles.matriculablesCount}>{matriculables.length} disponibles</span>
          )}
        </label>
      </div>

      {showMatriculables && (
        <div className={styles.matriculablesPanel}>
          <div className={styles.matriculablesPanelHeader}>
            <h3 className={styles.matriculablesTitle}>Puedes matricular este semestre</h3>
            <p className={styles.matriculablesSub}>
              Materias faltantes con todos los prerequisitos aprobados
            </p>
          </div>
          {matriculables.length > 0 ? (
            <div className={styles.matriculablesList}>
              {matriculables.map((mat) => (
                <button
                  key={mat.id}
                  type="button"
                  className={styles.matriculableItem}
                  onClick={() => handleSelect(mat)}
                >
                  <span className={styles.matriculableId}>{mat.id}</span>
                  <span className={styles.matriculableNombre}>{mat.nombre}</span>
                  <span className={styles.matriculableCred}>{mat.creditos} cr</span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.matriculablesEmpty}>
              No hay materias disponibles por ahora. Aprueba los prerequisitos pendientes y listo.
            </p>
          )}
        </div>
      )}

      {}
      {selected && (
        <div className={styles.detailPanel} role="dialog" aria-modal="true" aria-label={`Detalle de ${selected.nombre}`}>
          <div className={styles.detailHeader}>
            <div>
              <span className={styles.detailEstado} style={{ background: getColor(selected.estado), color: "#0e0e14" }}>
                {ESTADOS[selected.estado]?.label}
              </span>
              <h3 className={styles.detailName}>{selected.nombre}</h3>
              <p className={styles.detailId}>{selected.id} · {selected.creditos} créditos</p>
            </div>
            <button className={styles.detailClose} aria-label="Cerrar detalle" onClick={() => {
              setSelected(null);
              setHighlightedPrereqs([]);
              setHighlightedUnlocks([]);
            }}><IconClose size={14} /></button>
          </div>
          <div className={styles.detailBody}>
            {selectedMissingPrereqs.length > 0 && (
              <div className={styles.prereqAlertDetail}>
                <IconWarning size={14} />
                <span>
                  <strong>Prerequisito(s) pendiente(s):</strong>{" "}
                  {selectedMissingPrereqs.map((pid) => materiaById.get(pid)?.nombre || pid).join(", ")}.
                  Aún no toca cursar esta materia.
                </span>
              </div>
            )}
            <div className={styles.detailSection}>
              <p className={styles.detailSectionLabel}>Cambiar estado:</p>
              <div className={styles.estadoBtns}>
                {Object.entries(ESTADOS).map(([k, v]) => (
                  <button
                    key={k}
                    className={`${styles.estadoBtn} ${selected.estado === k ? styles.estadoBtnActive : ""}`}
                    style={selected.estado === k ? { background: getColor(k), color: "#0e0e14" } : {}}
                    onClick={() => {
                      handleEstadoChange(selected.id, k);
                    }}
                  >
                    {v.emoji} {v.label}
                  </button>
                ))}
              </div>
            </div>
            {selected.prereqs.length > 0 && (
              <div className={styles.detailSection}>
                <p className={styles.detailSectionLabel}>Prerequisitos:</p>
                <div className={styles.prereqList}>
                  {selected.prereqs.map((pid) => {
                    const pm = materiaById.get(pid);
                    return pm ? (
                      <div key={pid} className={styles.prereqItem} style={{ borderColor: getColor(pm.estado) }}>
                        <span className={styles.prereqDot} style={{ background: getColor(pm.estado) }} />
                        <span className={styles.prereqName}>{pm.nombre}</span>
                        <span className={styles.prereqStatus}>{ESTADOS[pm.estado]?.label}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            {highlightedUnlocks.length > 0 && (
              <div className={styles.detailSection}>
                <p className={styles.detailSectionLabel}>Desbloquea:</p>
                <div className={styles.prereqList}>
                  {highlightedUnlocks.map((uid) => {
                    const um = materiaById.get(uid);
                    return um ? (
                      <div key={uid} className={`${styles.prereqItem} ${styles.unlockItem}`} style={{ borderColor: getColor(um.estado) }}>
                        <span className={styles.prereqDot} style={{ background: getColor(um.estado) }} />
                        <span className={styles.prereqName}>{um.nombre}</span>
                        <span className={styles.prereqStatus}>{ESTADOS[um.estado]?.label}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {confirm && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={() => setConfirm(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmHeader}>
              <IconWarning size={18} />
              <h3 id="confirm-title" className={styles.confirmTitle}>{confirm.title}</h3>
            </div>
            <p className={styles.confirmMsg}>{confirm.message}</p>
            <div className={styles.confirmList}>
              {confirm.affected.map((m) => (
                <div key={m.id} className={styles.confirmItem}>
                  <span className={styles.confirmItemId}>{m.id}</span>
                  <span className={styles.confirmItemName}>{m.nombre}</span>
                  <span className={styles.confirmItemBadge} style={{ background: getColor(m.estado), color: "#0e0e14" }}>
                    {ESTADOS[m.estado]?.label}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setConfirm(null)}>
                Cancelar
              </button>
              <button className={styles.confirmBtn} ref={confirmBtnRef} onClick={() => {
                const action = confirm.onConfirm;
                setConfirm(null);
                action();
              }}>
                {confirm.buttonLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
