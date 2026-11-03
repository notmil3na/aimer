import { useState, useMemo, useEffect, useRef } from "react";
import styles from "./CursandoView.module.css";
import { IconCheck, IconX, IconUser, IconPlus, IconClose, IconChevronUp, IconChevronDown, IconSemester, IconGrades } from "./Icons";
import NotasView from "./NotasView";

const NOTA_MIN  = 0;
const NOTA_MAX  = 500;
const NOTA_PASS = 300;

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

function calcCorteNota(items) {
  if (!items || items.length === 0) return null;
  let suma = 0, contados = 0;
  items.forEach(({ nota }) => {
    const n = parseFloat(nota);
    if (!isNaN(n)) { suma += n; contados++; }
  });
  return contados > 0 ? Number(suma.toFixed(1)) : null;
}

function calcNotaFinal(cortes) {
  if (!cortes || cortes.length === 0) return null;
  let sumaPts = 0, sumaPeso = 0;
  cortes.forEach((c) => {
    const p = parseFloat(c.peso);
    if (!isNaN(p) && p > 0) sumaPeso += p;
    const pts = calcCorteNota(c.items);
    if (pts !== null) sumaPts += pts;
  });
  if (sumaPeso === 0) return null;
  return Number(((sumaPts / sumaPeso) * 500).toFixed(1));
}

function calcPuntosMateria(cortes) {
  let obtenidos = 0;
  let total = 0;
  let tieneNota = false;

  cortes.forEach(corte => {
    (corte.items || []).forEach(item => {
      const nota = parseFloat(item.nota);
      const notaMax = parseFloat(item.notaMax) || parseFloat(corte.peso);
      if (!Number.isNaN(nota)) {
        obtenidos += nota;
        tieneNota = true;
      }
      if (!Number.isNaN(notaMax) && notaMax > 0) total += notaMax;
    });
  });

  return tieneNota || total > 0 ? { obtenidos, total } : null;
}

function colorNota(nota) {
  if (nota === null || nota === undefined || nota === "") return "var(--text-muted)";
  return Number(nota) >= NOTA_PASS ? "#6ec88a" : "#e07070";
}

function calcPonderado(materias, cursandoData) {
  let sumPond = 0, sumCred = 0;
  materias.forEach((m) => {
    const d = cursandoData[m.id];
    if (!d) return;
    const nf = calcNotaFinal(d.cortes || migrateCortes([]));
    if (nf !== null) { sumPond += Number(nf) * m.creditos; sumCred += m.creditos; }
  });
  return sumCred > 0 ? { valor: (sumPond / sumCred).toFixed(1), creditos: sumCred } : null;
}

function CorteItemRow({ item, idx, onChange, onRemove, max }) {
  return (
    <div className={styles.itemRow}>
      <div className={styles.itemIdentity}>
        <span className={styles.itemDot}>{idx + 1}</span>
        <input
          type="text"
          className={styles.itemNameInput}
          value={item.nombre}
          placeholder="Nombre de la evaluación"
          onChange={e => onChange({ ...item, nombre: e.target.value })}
        />
      </div>
      <div className={styles.inputGroup}>
        <label>Valoración</label>
        <input
          type="number" min={1} max={500} step="0.1"
          className={styles.pesoInput}
          value={item.notaMax ?? ""}
          placeholder="—"
          onChange={e => onChange({ ...item, notaMax: e.target.value })}
        />
      </div>
      <div className={styles.inputGroup}>
        <label>Nota obtenida</label>
        <input
          type="number" min={NOTA_MIN} max={item.notaMax || max} step="0.1"
          className={styles.notaInput}
          value={item.nota}
          placeholder="—"
          onChange={e => onChange({ ...item, nota: e.target.value })}
        />
      </div>
      <button className={styles.removeBtn} onClick={onRemove} aria-label="Eliminar evaluación" title="Eliminar item"><IconClose size={11} /></button>
    </div>
  );
}

function CorteRow({ corte, idx, onChange, onRemove, canRemove }) {
  const [expanded, setExpanded] = useState(false);
  const corteNota = calcCorteNota(corte.items);
  const cortePeso = parseFloat(corte.peso) || 0;
  const cortePct = corteNota !== null && cortePeso > 0 ? (corteNota / cortePeso) * 500 : null;

  const updateItem = (i, val) => {
    const items = [...(corte.items || [])];
    items[i] = val;
    onChange({ ...corte, items });
  };
  const addItem = () => {
    onChange({ ...corte, items: [...(corte.items || []), { nombre: "", nota: "", notaMax: "" }] });
  };
  const removeItem = (i) => {
    onChange({ ...corte, items: (corte.items || []).filter((_, idx) => idx !== i) });
  };

  const metaOk = corteNota !== null && cortePeso > 0 && corteNota >= cortePeso;

  return (
    <div className={styles.corteSection}>
      <div className={`${styles.corteHeader} ${expanded ? styles.corteHeaderExpanded : ""}`}>
        <div className={styles.corteHeaderLeft}>
          <button
            type="button"
            className={styles.corteExpandBtn}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Contraer" : "Expandir"} ${corte.nombre || `Corte ${idx + 1}`}`}
            onClick={() => setExpanded(value => !value)}
          >
            {expanded ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
          </button>
          <span className={styles.corteChip}>
            <span className={styles.corteNumber}>{String(idx + 1).padStart(2, "0")}</span>
            <span>Corte {idx + 1}</span>
          </span>
        </div>
        <div className={styles.corteHeaderRight}>
          {!expanded && corteNota !== null && (
            <span className={styles.corteCollapsedScore}>
              {corteNota}<span>/{cortePeso || "—"}</span>
            </span>
          )}
          <div className={styles.inputGroup}>
            <label>Valoración total</label>
            <input
              type="number" min={1} max={500}
              className={styles.pesoInput}
              value={corte.peso}
              onChange={e => onChange({ ...corte, peso: e.target.value })}
            />
          </div>
          {canRemove && (
            <button className={styles.removeBtn} onClick={onRemove} aria-label="Eliminar corte" title="Eliminar corte"><IconClose size={11} /></button>
          )}
        </div>
      </div>

      {expanded && (
        <div className={styles.corteContent}>
          <div className={styles.itemsPanel}>
            {(corte.items || []).length === 0 && (
              <p className={styles.itemsEmpty}>Aún no hay evaluaciones. Agrega una para empezar a sumar puntos.</p>
            )}
            {(corte.items || []).map((item, i) => (
              <CorteItemRow
                key={i} item={item} idx={i}
                max={cortePeso || 500}
                onChange={val => updateItem(i, val)}
                onRemove={() => removeItem(i)}
              />
            ))}
            <button className={styles.addItemBtn} onClick={addItem}><IconPlus size={11} /> Evaluar</button>
          </div>

          {corteNota !== null && (
            <div className={styles.corteTotal} style={{ "--corte-color": colorNota(cortePct) }}>
              <div className={styles.corteTotalInfo}>
                <span className={styles.corteTotalLabel}>Puntos obtenidos</span>
                <span className={styles.corteTotalVal} style={{ color: colorNota(cortePct) }}>
                  {corteNota}
                  <span className={styles.corteTotalMax}> / {cortePeso || "—"} pts</span>
                </span>
              </div>
              <span className={`${styles.corteTotalStatus} ${metaOk ? styles.corteStatusOk : styles.corteStatusLow}`}>
                {metaOk ? "Meta alcanzada" : "Meta no alcanzada"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MateriaCard({ materia, data, onChange, colors, borderRadius, horarioClase }) {
  const [expanded, setExpanded] = useState(false);
  const [profesorExpanded, setProfesorExpanded] = useState(false);
  const rawData = data || {
    profesor: "", grupo: "", salon: "",
    cortes: [],
    repeticiones: [],
  };
  const d = {
    ...rawData,
    cortes: migrateCortes(rawData.cortes),
  };

  const notaFinal = calcNotaFinal(d.cortes);
  const paso   = notaFinal !== null && Number(notaFinal) >= NOTA_PASS;

  const updateCorte = (i, val) => {
    const c = [...d.cortes];
    c[i] = val;
    onChange({ ...d, cortes: c });
  };
  const addCorte = () => {
    if (d.cortes.length >= 3) return;
    onChange({ ...d, cortes: [...d.cortes, { nombre: `Corte ${d.cortes.length + 1}`, peso: PESOS_DEFAULT[d.cortes.length] ?? 100, items: [] }] });
  };
  const removeCorte = (i) => {
    onChange({ ...d, cortes: d.cortes.filter((_, idx) => idx !== i) });
  };

  const autoProf = horarioClase?.profesor || "";
  const autoGrupo = horarioClase?.grupo || "";
  const autoSalon = horarioClase?.salonLabel || "";

  const cardColor = paso ? (colors?.aprobada || "#6ec88a")
    : notaFinal !== null ? "#e07070"
    : (colors?.cursando || "#c8a96e");

  return (
    <div
      className={styles.card}
      style={{ "--card-color": cardColor, borderRadius: `${borderRadius ?? 12}px` }}
    >
      <button className={styles.cardHeader} onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>
        <div className={styles.cardMeta}>
          <div className={styles.cardTop}>
            <span className={styles.cardId}>{materia.id}</span>
            <span className={styles.cardCreditos}>{materia.creditos} cr</span>
          </div>
          <p className={styles.cardNombre}>{materia.nombre}</p>
          {(d.profesor || d.grupo || autoProf) && (
            <p className={styles.cardSub}>
              {d.profesor || autoProf ? <span><IconUser size={11} /> {d.profesor || autoProf}</span> : null}
              {(d.grupo || autoGrupo) ? <span>· Grupo {d.grupo || autoGrupo}</span> : null}
            </p>
          )}
        </div>
        <div className={styles.cardRight}>
          {notaFinal !== null ? (
            <div className={styles.notaDisplay}>
              <span className={styles.notaNum} style={{ color: cardColor }}>{notaFinal}</span>
              <span className={styles.notaMax}>/{NOTA_MAX}</span>
              <span className={styles.notaStatus}>{paso ? "Aprueba" : "Pierde"}</span>
            </div>
          ) : (
            <span className={styles.notaEmpty}>Sin notas</span>
          )}
           <span className={styles.expandIcon}>{expanded ? <IconChevronUp size={10} /> : <IconChevronDown size={10} />}</span>
        </div>
      </button>

      {expanded && (
        <div className={styles.cardBody}>
          <button
            type="button"
            className={styles.profesorToggle}
            aria-expanded={profesorExpanded}
            onClick={() => setProfesorExpanded(value => !value)}
          >
            <span>{profesorExpanded ? "−" : "+"} {d.profesor || d.grupo || d.salon ? "Información del profesor" : "Agregar información del profesor"}</span>
            {profesorExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </button>
          {profesorExpanded && <div className={styles.infoRow}>
            <div className={styles.inputGroup}>
              <label>Profesor</label>
              <input type="text" className={styles.textInput}
                value={d.profesor} placeholder={autoProf || "Nombre del profesor"}
                onChange={e => onChange({ ...d, profesor: e.target.value })} />
            </div>
            <div className={styles.inputGroup}>
              <label>Grupo</label>
              <input type="text" className={styles.textInput}
                value={d.grupo} placeholder={autoGrupo || "01, A, ..."}
                onChange={e => onChange({ ...d, grupo: e.target.value })} />
            </div>
            <div className={styles.inputGroup}>
              <label>Salón</label>
              <input type="text" className={styles.textInput}
                value={d.salon} placeholder={autoSalon || "Salón"}
                onChange={e => onChange({ ...d, salon: e.target.value })} />
            </div>
          </div>}

          <div className={styles.cortesSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Cortes y evaluaciones</span>
              {d.cortes.length < 3 && (
                 <button className={styles.addBtn} onClick={addCorte}><IconPlus size={11} /> Corte</button>
              )}
            </div>
            {d.cortes.map((c, i) => (
              <CorteRow
                key={i} idx={i} corte={c}
                onChange={val => updateCorte(i, val)}
                onRemove={() => removeCorte(i)}
                canRemove={d.cortes.length > 1}
              />
            ))}
            {(() => {
              const sp = d.cortes.reduce((s, c) => s + (parseFloat(c.peso) || 0), 0);
              return sp > 0 && sp !== 500 ? (
                <p className={styles.pesoHint} style={{ color: sp > 500 ? "#e07070" : "var(--text-muted)" }}>
                  Los cortes suman {sp} puntos (debería ser 500)
                </p>
              ) : null;
            })()}
            {notaFinal !== null && (
              <div className={styles.notaFinalRow}>
                <span className={styles.notaFinalLabel}>Nota definitiva</span>
                <span className={styles.notaFinalVal} style={{ color: cardColor }}>
                  {notaFinal}
                  <span className={styles.notaFinalSub}>/{NOTA_MAX}</span>
                </span>
                <span className={styles.notaFinalEquiv}>
                  = {(Number(notaFinal) / 100).toFixed(2)} /5.0
                </span>
                <span
                  className={styles.notaFinalBadge}
                  style={{
                    background: paso ? "rgba(110,200,138,0.15)" : "rgba(224,112,112,0.15)",
                    color: cardColor,
                  }}
                >
                   {paso ? <><IconCheck size={12} /> Aprueba</> : <><IconX size={12} /> Pierde</>}
                </span>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

export default function CursandoView({
  malla, cursandoData, onSave, user, horarioData,
  notas, onSaveNotas,
}) {
  const [data, setData]   = useState(cursandoData || {});
  const [saved, setSaved] = useState(false);
  const [subView, setSubView] = useState("semestre");

  const isLocalEdit = useRef(false);
  const saveTimerRef = useRef(null);

  const horarioClases = horarioData?.clases || [];
  const materiaMap = useMemo(() => {
    const all = malla.flatMap(s => s.materias);
    return Object.fromEntries(all.map(m => [m.id, m]));
  }, [malla]);

  const materiasCursando = useMemo(() => {
    const manual = malla.flatMap(s => s.materias).filter(m => m.estado === "cursando");
    const manualIds = new Set(manual.map(m => m.id));
    const fromHorario = horarioClases
      .map(c => c.materiaId)
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .filter(id => !manualIds.has(id) && materiaMap[id]);
    const horarioMaterias = fromHorario.map(id => materiaMap[id]);
    return [...manual, ...horarioMaterias];
  }, [malla, horarioClases, materiaMap]);

  const getHorarioForMateria = (materiaId) => {
    return horarioClases.find(c => c.materiaId === materiaId);
  };

  const handleChange = (id, val) => {
    isLocalEdit.current = true;
    setData(prev => ({ ...prev, [id]: val }));
  };

  useEffect(() => {
    if (!isLocalEdit.current) return;
    isLocalEdit.current = false;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      onSave(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }, 800);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [data, onSave]);

  const ponderado = calcPonderado(materiasCursando, data);
  const colors       = user?.themeColors || {};
  const borderRadius = user?.borderRadius ?? 12;
  const totalCreditos = materiasCursando.reduce((a, m) => a + m.creditos, 0);
  const totalPuntosMateria = materiasCursando.reduce((totales, materia) => {
    const puntos = calcPuntosMateria(data[materia.id]?.cortes || migrateCortes([]));
    if (puntos) {
      totales.obtenidos += puntos.obtenidos;
      totales.total += puntos.total;
    }
    return totales;
  }, { obtenidos: 0, total: 0 });

  return (
    <div className={styles.wrap}>
      <div className={styles.subNav}>
        <button
          className={`${styles.subNavBtn} ${subView === "semestre" ? styles.subNavActive : ""}`}
          onClick={() => setSubView("semestre")}
        >
          <IconSemester size={13} /> Semestre
        </button>
        <button
          className={`${styles.subNavBtn} ${subView === "notas" ? styles.subNavActive : ""}`}
          onClick={() => setSubView("notas")}
        >
          <IconGrades size={13} /> Notas Generales
        </button>
      </div>

      {subView === "notas" ? (
        <NotasView malla={malla} notas={notas} onSave={onSaveNotas} user={user} />
      ) : (
      <>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Semestre actual</h2>
          <p className={styles.subtitle}>
            {materiasCursando.length} materia{materiasCursando.length !== 1 ? "s" : ""} cursando
            · {totalCreditos} créditos
          </p>
        </div>
        {saved && (
          <span className={styles.saveBtnDone}>
            <IconCheck size={13} /> Guardado
          </span>
        )}
      </div>

      {ponderado && (
        <div className={styles.ponderadoBanner} style={{ borderColor: colorNota(ponderado.valor) }}>
          <div>
            <p className={styles.ponderadoLabel}>Ponderado semestral</p>
            <p className={styles.ponderadoFormula}>
              Σ(nota × créditos) ÷ {ponderado.creditos} cr cursados con nota
            </p>
          </div>
          <div className={styles.ponderadoRight}>
            <span className={styles.ponderadoVal} style={{ color: colorNota(ponderado.valor) }}>
              {ponderado.valor}
            </span>
            <span className={styles.ponderadoMax}>/{NOTA_MAX}</span>
            <span className={styles.ponderadoEquiv}>
              = {(Number(ponderado.valor) / 100).toFixed(2)} /5.0
            </span>
          </div>
        </div>
      )}

      {materiasCursando.length === 0 && (
        <div className={styles.emptyState}>
           <span className={styles.emptyIcon}><IconSemester size={32} /></span>
          <p>No tienes materias en estado <strong>Cursando</strong>.</p>
          <p>Ve a la <strong>Malla</strong> y cambia el estado, o agrega clases en <strong>Horario</strong>.</p>
        </div>
      )}

      <div className={styles.cardsList}>
        {materiasCursando.map(mat => (
          <MateriaCard
            key={mat.id}
            materia={mat}
            data={data[mat.id]}
            onChange={val => handleChange(mat.id, val)}
            colors={colors}
            borderRadius={borderRadius}
            horarioClase={getHorarioForMateria(mat.id)}
          />
        ))}
      </div>

      {materiasCursando.length > 0 && (
        <div className={styles.resumenTable}>
          <h3 className={styles.resumenTitle}>Resumen de materias</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Materia</th>
                  <th>Cr</th>
                  <th>Obtenida</th>
                  <th>Total materia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {materiasCursando.map(m => {
                  const d = data[m.id];
                  const cortes = d?.cortes || migrateCortes([]);
                  const nf = calcNotaFinal(cortes);
                  const puntos = calcPuntosMateria(cortes);
                  const paso = nf !== null && Number(nf) >= NOTA_PASS;
                  return (
                    <tr key={m.id}>
                      <td>
                        <span className={styles.tableId}>{m.id}</span>
                        <span className={styles.tableNombre}>{m.nombre}</span>
                      </td>
                      <td className={styles.tableCenter}>{m.creditos}</td>
                      <td className={styles.tableCenter}>{puntos?.obtenidos.toFixed(1) ?? "—"}</td>
                      <td className={styles.tableCenter}>{puntos?.total.toFixed(1) ?? "—"}</td>
                      <td className={styles.tableCenter}>
                        {nf !== null
                          ? <span className={styles.tableBadge} style={{ color: paso ? "#6ec88a" : "#e07070", background: paso ? "rgba(110,200,138,0.1)" : "rgba(224,112,112,0.1)" }}>
                              {paso ? "Aprueba" : "Pierde"}
                            </span>
                          : <span className={styles.tableNone}>—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className={styles.tableTotal}>
                  <td>Total</td>
                  <td className={styles.tableCenter}>{totalCreditos}</td>
                  <td className={styles.tableCenter}>{totalPuntosMateria.obtenidos.toFixed(1)}</td>
                  <td className={styles.tableCenter}>{totalPuntosMateria.total.toFixed(1)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
