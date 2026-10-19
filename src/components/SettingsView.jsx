import { useState, useEffect, useRef, useCallback } from "react";
import { CORTES, APP_THEMES } from "../App";
import { SEMESTER_CORTE } from "../utils/semesterCountdown";
import { UNIVERSITIES, autoSemester } from "../utils/academic";
import { calcCareerTime, estimateGraduation } from "../utils/careerProgress.js";
import { semesterDatesFor, semesterCorteFor } from "../utils/semesterCountdown.js";
import { getPhoto, compressPhoto, setPhotoCache } from "../utils/photo";
import { ensureFont, FONT_OPTIONS } from "../utils/fonts";
import styles from "./SettingsView.module.css";
import {
  IconCamera, IconWarning, IconSemester, IconCalendar, IconCheck, IconChevronDown, IconChevronUp,
  IconSun, IconMoon, IconPaint, IconUser
} from "./Icons";

const MALLA_PRESETS = [
  { name: "Aurora",          colors: { cursando: "#B882E8", aprobada: "#6EC8A8", faltante: "#7C8CFF" }, borderRadius: 12 },
  { name: "Océano profundo", colors: { cursando: "#6BA3E8", aprobada: "#6EC8B4", faltante: "#6E8DFF" }, borderRadius: 10 },
  { name: "Jardín",          colors: { cursando: "#D4A84B", aprobada: "#6EC88A", faltante: "#7A9BFF" }, borderRadius: 14 },
  { name: "Crepúsculo",      colors: { cursando: "#E8946B", aprobada: "#E8C86B", faltante: "#8A7CFF" }, borderRadius: 8 },
  { name: "Hielo",           colors: { cursando: "#A0C8E8", aprobada: "#E0E8F0", faltante: "#7FA3FF" }, borderRadius: 16 },
];

function isLightColor(hex) {
  if (typeof hex !== "string") return false;
  const clean = hex.replace("#", "");
  if (clean.length < 6) return false;
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

// los colores de la malla vienen de la base como texto json: si llega el texto
// (versiones anteriores del worker lo devolvían sin parsear) se desenvuelve y se
// completa con los colores por defecto, para que nunca falte una clave.
function toColorMap(raw) {
  let value = raw;
  for (let i = 0; i < 3 && typeof value === "string"; i++) {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
      break;
    }
  }
  const colors = value && typeof value === "object" ? value : {};
  return { ...MALLA_PRESETS[0].colors, ...colors };
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const INTERNAL_TABS = [
  { id: "cuenta",      label: "Cuenta",      Icon: IconUser },
  { id: "apariencia",  label: "Apariencia",  Icon: IconPaint },
];

export default function SettingsView({ user, onUpdate, malla, semestre, onSaveSemestre }) {
  const [activeSection, setActiveSection] = useState("cuenta");

  useEffect(() => { ensureFont(user.fontBody); }, [user.fontBody]);

  const [form, setForm] = useState({
    name:         user.name         || "",
    university:   user.university   || "",
    career:       user.career       || "",
    semester:     user.semester     || 1,
    ingresoCorte: user.ingresoCorte || "2023-2",
    photo:        null,
  });
  const [saved, setSaved] = useState(false);
  const photoLoadedRef = useRef(false);
  const autoSaveTimer = useRef(null);
  const lastSavedRef = useRef(null);
  const skipNextSave = useRef(true);

  const semDates = semesterDatesFor(semestre);
  const [semInicio, setSemInicio] = useState(() => toISO(semDates.start));
  const [semFin, setSemFin] = useState(() => toISO(semDates.end));
  const [semOpen, setSemOpen] = useState(false);

  const doSave = useCallback(() => {
    const newSem = Number(form.semester);
    if (newSem < 1 || newSem > 12) return;
    if (skipNextSave.current) {
      lastSavedRef.current = JSON.stringify({ ...user, ...form, semester: newSem, photo: null });
      skipNextSave.current = false;
      return;
    }
    // Cambiar el semestre no toca la malla: los estados que el usuario marcó se
    // quedan como están. El auto-aprobado solo aplica a cuentas sin malla guardada.
    const payload = { ...user, ...form, semester: newSem };
    if (!photoLoadedRef.current) {
      delete payload.photo;
    } else {
      payload.hasPhoto = !!payload.photo;
    }
    const key = JSON.stringify({ ...payload, photo: null });
    if (key === lastSavedRef.current) return;
    lastSavedRef.current = key;
    onUpdate(payload);
    if (form.photo) setPhotoCache(user.username, form.photo);
    if (semInicio && semFin && semInicio <= semFin) {
      onSaveSemestre({ inicio: semInicio, fin: semFin });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [form, user, semInicio, semFin, onUpdate, onSaveSemestre]);

  useEffect(() => {
    window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(doSave, 1000);
    return () => window.clearTimeout(autoSaveTimer.current);
  }, [doSave]);

  useEffect(() => {
    if (!user.hasPhoto) { photoLoadedRef.current = true; return; }
    let on = true;
    getPhoto(user.username).then((p) => {
      if (on) {
        photoLoadedRef.current = true;
        setForm((f) => ({ ...f, photo: p }));
      }
    });
    return () => { on = false; };
  }, [user.username, user.hasPhoto]);

  const materiasActuales = (malla || [])
    .flatMap(s => s.materias)
    .filter(m => m.estado === "cursando");
  const totalCreditosCursando = materiasActuales.reduce((a, m) => a + m.creditos, 0);
  const corteActual = semesterCorteFor(semestre);
  const careerTime = calcCareerTime(
    { ...user, ...form, semester: Number(form.semester) },
    { currentCorte: corteActual }
  );
  const graduation = estimateGraduation(malla, { ...user, ...form, semester: Number(form.semester) });

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const small = await compressPhoto(reader.result);
      setForm(f => ({ ...f, photo: small }));
    };
    reader.readAsDataURL(file);
  };

  const initial = form.name ? form.name[0].toUpperCase() : "?";
  const availableCareers = form.university ? (UNIVERSITIES[form.university] || []) : [];

  const [colors, setColors]             = useState(() => toColorMap(user.themeColors));
  const [borderRadius, setBorderRadius] = useState(user.borderRadius ?? 12);
  const [fontScale, setFontScale]       = useState(user.fontScale ?? 1);
  const [appMode, setAppMode]           = useState(user.appMode || "light");
  const [appTheme, setAppTheme]         = useState(user.appTheme || "ambar");
  const [fontBody, setFontBody]         = useState(user.fontBody && user.fontBody !== "DM Sans" ? user.fontBody : "Overused Grotesk");
  const [aparienciaSaved, setAparienciaSaved] = useState(false);

  const doSaveApariencia = useCallback(() => {
    onUpdate({ ...user, themeColors: colors, borderRadius, fontScale, appMode, appTheme, fontBody });
    setAparienciaSaved(true);
    setTimeout(() => setAparienciaSaved(false), 2000);
  }, [user, colors, borderRadius, fontScale, appMode, appTheme, fontBody, onUpdate]);

  const aparienciaTimer = useRef(null);
  const aparienciaLastRef = useRef(null);

  useEffect(() => {
    window.clearTimeout(aparienciaTimer.current);
    aparienciaTimer.current = window.setTimeout(() => {
      const key = JSON.stringify({ colors, borderRadius, fontScale, appMode, appTheme, fontBody });
      if (key === aparienciaLastRef.current) return;
      aparienciaLastRef.current = key;
      doSaveApariencia();
    }, 800);
    return () => window.clearTimeout(aparienciaTimer.current);
  }, [colors, borderRadius, fontScale, appMode, appTheme, fontBody, doSaveApariencia]);

  const applyPreset = (p) => { setColors(p.colors); setBorderRadius(p.borderRadius); };

  const colorFields = [
    { key: "cursando", label: "Cursando" },
    { key: "aprobada", label: "Aprobada" },
    { key: "faltante", label: "Faltante" },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h2 className={styles.title}>Configuración</h2>
        <p className={styles.subtitle}>Tu perfil, cuenta y apariencia</p>
      </div>

      {}
      <div className={styles.sectionTabs}>
        {INTERNAL_TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.sectionTab} ${activeSection === t.id ? styles.sectionTabActive : ""}`}
            onClick={() => setActiveSection(t.id)}
          >
            <t.Icon size={15} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {}
      {activeSection === "cuenta" && (
        <div className={styles.sectionContent}>

          {}
          <div className={styles.careerCard}>
            <h3 className={styles.careerTitle}>Trayectoria académica</h3>
            <div className={styles.careerGrid}>
              <div className={styles.careerStat}>
                <span className={styles.careerLabel}>Tiempo en la carrera</span>
                <span className={styles.careerVal}>
                  {careerTime.years > 0 ? `${careerTime.years} año${careerTime.years !== 1 ? "s" : ""}` : ""}
                  {careerTime.years > 0 && careerTime.months > 0 ? " y " : ""}
                  {careerTime.months > 0 ? `${careerTime.months} mes${careerTime.months !== 1 ? "es" : ""}` : careerTime.years === 0 ? `${careerTime.totalMonths} meses` : ""}
                </span>
                <span className={styles.careerSub}>
                  Desde corte {form.ingresoCorte}
                  {careerTime.currentCorte ? ` · Corte actual ${careerTime.currentCorte}` : ""}
                  {careerTime.semesters > 0 ? ` · ${careerTime.semesters} semestre${careerTime.semesters !== 1 ? "s" : ""}` : ""}
                </span>
              </div>
              <div className={styles.careerStat}>
                <span className={styles.careerLabel}>Estimado para graduarse</span>
                {graduation.mensaje ? (
                  <span className={styles.careerValSmall}>{graduation.mensaje}</span>
                ) : (
                  <>
                    <span className={styles.careerVal}>
                      {graduation.anosEstimados > 0 ? `${graduation.anosEstimados} año${graduation.anosEstimados !== 1 ? "s" : ""}` : ""}
                      {graduation.anosEstimados > 0 && graduation.mesesRestantes > 0 ? " y " : ""}
                      {graduation.mesesRestantes > 0 ? `${graduation.mesesRestantes} mes${graduation.mesesRestantes !== 1 ? "es" : ""}` : graduation.anosEstimados === 0 ? `${graduation.mesesEstimados} meses` : ""}
                    </span>
                    <span className={styles.careerSub}>
                      Ritmo: {graduation.ritmoCreditosPorSemestre.toFixed(1)} cr/semestre
                      · Faltan {graduation.creditosPendientes} cr ({graduation.semestresEstimados} semestre{graduation.semestresEstimados !== 1 ? "s" : ""})
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={styles.twoCol}>
            {}
            <div className={styles.card}>
              <div className={styles.avatarSection}>
                <div className={styles.avatar}>
                  {form.photo
                    ? <img src={form.photo} alt="foto" className={styles.avatarImg} />
                    : <span className={styles.avatarInitial}>{initial}</span>
                  }
                  <label className={styles.avatarEdit} title="Cambiar foto">
                    <input type="file" accept="image/*" onChange={handlePhoto} hidden />
                     <IconCamera size={28} />
                  </label>
                </div>
                <div>
                  <p className={styles.avatarName}>{form.name || "Sin nombre"}</p>
                  <p className={styles.avatarSub}>{form.career || "—"}</p>
                  {corteActual && (
                    <p className={styles.avatarCorte}>Corte {corteActual}</p>
                  )}
                </div>
              </div>

              <div className={styles.divider} />

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>Nombre completo</label>
                  <input value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Tu nombre" />
                </div>

                <div className={styles.field}>
                  <label>Universidad</label>
                  <select
                    value={form.university}
                    onChange={e => setForm({ ...form, university: e.target.value, career: "" })}
                    className={styles.selectInput}
                  >
                    <option value="">— Selecciona —</option>
                    {Object.keys(UNIVERSITIES).map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label>Carrera</label>
                  <select
                    value={form.career}
                    onChange={e => setForm({ ...form, career: e.target.value })}
                    className={styles.selectInput}
                    disabled={!form.university}
                  >
                    <option value="">— Selecciona —</option>
                    {availableCareers.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label>Corte de ingreso</label>
                  <select
                    value={form.ingresoCorte}
                    onChange={e => {
                      const newCorte = e.target.value;
                      const newSem = autoSemester(newCorte);
                      setForm({ ...form, ingresoCorte: newCorte, semester: newSem });
                    }}
                    className={styles.selectInput}
                  >
                    {CORTES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label>Semestre actual</label>
                  <input
                    type="number" min="1" max="12"
                    value={form.semester}
                    onChange={e => setForm({ ...form, semester: e.target.value })}
                  />
                  <small className={styles.hint}>
                    Calculado desde corte {form.ingresoCorte} · {SEMESTER_CORTE}
                  </small>
                  {Number(form.semester) !== user.semester && Number(form.semester) >= 1 && Number(form.semester) <= 12 && (
                    <small className={styles.hint}>
                      Al guardar se actualiza tu semestre actual. Los estados de tu malla se quedan como los tengas.
                    </small>
                  )}
                </div>
              </div>

              <div className={`${styles.autoSave} ${saved ? styles.autoSaveSaved : ""}`}>
                <IconCheck size={12} />
                {saved ? "Guardado automáticamente" : "Se guarda automáticamente"}
              </div>
            </div>

            {}
            <div className={styles.cursandoCol}>
              <div className={styles.cursandoHeader}>
                <span className={styles.cursandoTitle}>Materias cursando</span>
                <span className={styles.cursandoBadge}>
                  {materiasActuales.length} materia{materiasActuales.length !== 1 ? "s" : ""}
                  · {totalCreditosCursando} cr
                </span>
              </div>

              {corteActual && (
                <div className={styles.corteChip}>
                   <IconSemester size={13} /> Corte actual: <strong>{corteActual}</strong>
                </div>
              )}

              {materiasActuales.length === 0 ? (
                <div className={styles.cursandoEmpty}>
                  <p>No tienes materias marcadas como <strong>Cursando</strong>.</p>
                  <p>Ve a la <strong>Malla</strong> para actualizar los estados.</p>
                </div>
              ) : (
                <div className={styles.cursandoList}>
                  {materiasActuales.map(m => (
                    <div key={m.id} className={styles.cursandoItem}>
                      <div className={styles.cursandoItemBody}>
                        <span className={styles.cursandoItemId}>{m.id}</span>
                        <span className={styles.cursandoItemNombre}>{m.nombre}</span>
                      </div>
                      <span className={styles.cursandoItemCred}>{m.creditos} cr</span>
                    </div>
                  ))}
                  <div className={styles.cursandoTotal}>
                    <span>Total créditos</span>
                    <span className={styles.cursandoTotalVal}>{totalCreditosCursando}</span>
                  </div>
                </div>
              )}

              <button type="button" className={`${styles.semDateToggle} ${semOpen ? styles.semDateToggleOpen : ""}`} onClick={() => setSemOpen(o => !o)} aria-expanded={semOpen}>
                <IconCalendar size={13} /> Fechas del semestre
                {semOpen ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
              </button>
              {semOpen && (
                <div className={styles.semDateMenu}>
                  <div className={styles.semDateRow}>
                    <label>Inicio</label>
                    <input type="date" value={semInicio} onChange={e => setSemInicio(e.target.value)} />
                  </div>
                  <div className={styles.semDateRow}>
                    <label>Fin</label>
                    <input type="date" value={semFin} onChange={e => setSemFin(e.target.value)} />
                  </div>
                  {semInicio && semFin && semInicio > semFin && (
                    <p className={styles.semesterHint}>
                       <IconWarning size={12} /> Inicio debe ser anterior a fin.
                    </p>
                  )}
                  {semInicio && semFin && semInicio <= semFin && (
                    <p className={styles.semesterOk}>
                       <IconCalendar size={12} />
                      Corte {semesterCorteFor({ inicio: semInicio, fin: semFin })} · {semInicio} → {semFin}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {}
      {activeSection === "apariencia" && (
        <div className={styles.sectionContent}>

          {}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Modo de pantalla</h3>
            <div className={styles.modeRow}>
              {[
                { id: "dark",  Icon: IconMoon, label: "Oscuro" },
                { id: "light", Icon: IconSun,  label: "Claro"  },
              ].map(m => (
                <button key={m.id}
                  className={`${styles.modeBtn} ${appMode === m.id ? styles.modeBtnActive : ""}`}
                  onClick={() => setAppMode(m.id)}>
                  <span className={styles.modeIcon}><m.Icon size={18} /></span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </section>

          {}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Tema de la aplicación</h3>
            <div className={styles.appThemeGrid}>
              {Object.entries(APP_THEMES).map(([key, t]) => (
                <button key={key}
                  className={`${styles.appThemeBtn} ${appTheme === key ? styles.appThemeBtnActive : ""}`}
                  onClick={() => setAppTheme(key)}
                  style={{ "--t-accent": t.accent }}>
                  <span className={styles.appThemeDot} style={{ background: t.accent }} />
                  <span>{t.name}</span>
                  {appTheme === key && <span className={styles.appThemeCheck}><IconCheck size={13} /></span>}
                </button>
              ))}
            </div>
          </section>

          {}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Fuente de texto</h3>
            <div className={styles.fontGrid}>
              {FONT_OPTIONS.map(f => (
                <button key={f.value}
                  className={`${styles.fontOptionBtn} ${fontBody === f.value ? styles.fontOptionActive : ""}`}
                  onClick={() => { ensureFont(f.value); setFontBody(f.value); }}
                  style={{ fontFamily: `'${f.value}', system-ui, sans-serif` }}>
                  <span className={styles.fontOptionName}>{f.label}</span>
                  <span className={styles.fontOptionSample}>{f.sample}</span>
                   {fontBody === f.value && <span className={styles.fontOptionCheck}><IconCheck size={13} /></span>}
                </button>
              ))}
            </div>
          </section>

          {}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Presets de la malla</h3>
            <div className={styles.presets}>
              {MALLA_PRESETS.map(p => (
                <button key={p.name} className={styles.presetBtn} onClick={() => applyPreset(p)}>
                  <div className={styles.presetSwatches}>
                    {Object.values(p.colors).map((c, i) => (
                      <span key={i} className={styles.swatch} style={{ background: c, borderRadius: p.borderRadius }} />
                    ))}
                  </div>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </section>

          {}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Colores de estado en la malla</h3>
            <div className={styles.colorGrid}>
              {colorFields.map(f => (
                <div key={f.key} className={styles.colorField}>
                  <label>{f.label}</label>
                  <div className={styles.colorInputWrap}>
                    <input type="color" value={colors[f.key]}
                      onChange={e => setColors({ ...colors, [f.key]: e.target.value })}
                      className={styles.colorPicker} />
                    <span className={styles.colorHex}>{colors[f.key]}</span>
                    <div className={styles.colorPreviewCard} style={{ background: colors[f.key], borderRadius, color: isLightColor(colors[f.key]) ? "#1a1520" : "#f0edf8" }}>
                      <span>Vista previa</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Radio de bordes</h3>
            <div className={styles.borderPreviewRow}>
              {[0, 4, 8, 12, 16, 24].map(r => (
                <button key={r}
                  className={`${styles.borderBtn} ${borderRadius === r ? styles.borderBtnActive : ""}`}
                  style={{ borderRadius: `${r}px` }}
                  onClick={() => setBorderRadius(r)}>
                  {r}px
                </button>
              ))}
            </div>
            <input type="range" min={0} max={24} value={borderRadius}
              onChange={e => setBorderRadius(Number(e.target.value))}
              className={styles.rangeInput} />
          </section>

          {}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Tamaño de texto</h3>
            <div className={styles.fontScaleRow}>
              {[{ v: 0.85, l: "Pequeño" }, { v: 1, l: "Normal" }, { v: 1.1, l: "Grande" }, { v: 1.2, l: "Extra" }].map(s => (
                <button key={s.v}
                  className={`${styles.fontBtn} ${fontScale === s.v ? styles.fontBtnActive : ""}`}
                  style={{ fontSize: `${11 * s.v}px` }}
                  onClick={() => setFontScale(s.v)}>
                  {s.l}
                </button>
              ))}
            </div>
          </section>

          {}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Vista previa de tarjetas</h3>
            <div className={styles.preview}>
              {colorFields.map(f => (
                <div key={f.key} className={styles.previewCard}
                  style={{ borderRadius, "--card-color": colors[f.key], fontSize: `${11 * fontScale}px`, fontFamily: `'${fontBody}', system-ui` }}>
                  <div className={styles.previewBar} style={{ background: colors[f.key], borderRadius: `${borderRadius}px ${borderRadius}px 0 0` }} />
                  <div className={styles.previewContent}>
                    <span style={{ color: colors[f.key], fontWeight: 700, fontSize: "0.85em" }}>MAT101</span>
                    <p style={{ fontSize: "0.9em" }}>{f.label}</p>
                    <span style={{ fontSize: "0.75em", color: "var(--text-muted)" }}>3cr</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className={`${styles.autoSave} ${aparienciaSaved ? styles.autoSaveSaved : ""}`}>
            <IconCheck size={12} />
            {aparienciaSaved ? "Cambios aplicados" : "Los cambios se aplican automáticamente"}
          </div>
        </div>
      )}
    </div>
  );
}
