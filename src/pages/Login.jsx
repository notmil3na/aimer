import { useState, useEffect, useRef, useId } from "react";
import { CORTES } from "../utils/cortes";
import { SEMESTER_CORTE } from "../utils/semesterCountdown";
import { UNIVERSITIES, autoSemester } from "../utils/academic";
import { api, prewarm } from "../api";
import styles from "./Login.module.css";
import { IconCheck, IconWarning } from "../components/Icons";
import useBodyScrollLock from "../hooks/useBodyScrollLock";

const DEFAULT_THEME_COLORS = {
  cursando: "#c8a96e",
  aprobada: "#6ec88a",
  faltante: "#7c8cff",
};

// Preguntas de seguridad para la recuperación de cuenta (paso 2 del registro).
const SECURITY_QUESTIONS = [
  "¿Cómo se llamaba tu primera mascota?",
  "¿En qué ciudad nació tu mamá?",
  "¿Cuál era el nombre de tu colegio?",
  "¿Cuál es tu comida favorita de la infancia?",
  "¿Cómo se llamaba tu mejor amigo de la infancia?",
];

function EyeIcon({ off }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

/* Marca verde que aparece cuando el campo ya tiene un valor válido.
   Es solo un apoyo visual: la validación real sigue en validateStep1/2. */
function FieldCheck() {
  return (
    <span className={styles.fieldCheck} aria-hidden="true">
      <IconCheck size={15} />
    </span>
  );
}

/* ---------- Modal: recuperar contraseña ---------- */

function ForgotPasswordModal({ onClose }) {
  const uid = useId();
  const [step, setStep] = useState("username");
  const [username, setUsername] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useBodyScrollLock(true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleUsername = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) return setError("Escribe tu usuario");
    setLoading(true);
    try {
      const res = await api("/auth/forgot-password", {
        method: "POST", skipAuth: true,
        body: { username: username.trim() },
      });
      setLoading(false);
      if (res.question) {
        setQuestion(res.question);
        setStep("answer");
      } else {
        setError("No se pudo recuperar la cuenta");
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || "No se pudo recuperar la cuenta");
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    if (!answer.trim()) return setError("Escribe la respuesta");
    if (newPassword.length < 6) return setError("La contraseña debe tener al menos 6 caracteres");
    setLoading(true);
    try {
      await api("/auth/forgot-password", {
        method: "POST", skipAuth: true,
        body: { username: username.trim(), answer: answer.trim(), newPassword },
      });
      setLoading(false);
      setSuccess("¡Contraseña restablecida! Ya puedes iniciar sesión.");
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setLoading(false);
      setError(err.message || "La respuesta no coincide");
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Cerrar">&times;</button>
        <h3 id={`${uid}-title`} className={styles.modalTitle}>
          Recuperar <em>contraseña</em>
        </h3>

        {step === "username" && (
          <form onSubmit={handleUsername} className={styles.modalForm}>
            <p className={styles.modalText}>Escribe tu usuario para ver tu pregunta de seguridad.</p>
            <div className={styles.field}>
              <label htmlFor={`${uid}-user`}>Usuario</label>
              <div className={styles.inputWrap}>
                <input id={`${uid}-user`} value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="tu usuario" autoComplete="username" autoFocus />
                {username.trim() && <FieldCheck />}
              </div>
            </div>
            {error && <p className={styles.error} role="alert"><IconWarning size={12} /> {error}</p>}
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? "Buscando..." : "Continuar"}
            </button>
          </form>
        )}

        {step === "answer" && (
          <form onSubmit={handleReset} className={styles.modalForm}>
            <p className={styles.modalText}>{question}</p>
            <div className={styles.field}>
              <label htmlFor={`${uid}-answer`}>Tu respuesta</label>
              <div className={styles.inputWrap}>
                <input id={`${uid}-answer`} type="password" value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="la que configuraste" autoComplete="off" autoFocus />
                {answer.trim().length >= 4 && <FieldCheck />}
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor={`${uid}-newpw`}>Nueva contraseña</label>
              <div className={styles.inputWrap}>
                <input id={`${uid}-newpw`} type="password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="mín. 6 caracteres" autoComplete="new-password" />
                {newPassword.length >= 6 && <FieldCheck />}
              </div>
            </div>
            {error && <p className={styles.error} role="alert"><IconWarning size={12} /> {error}</p>}
            {success && <p className={styles.successMsg} role="status"><IconCheck size={12} /> {success}</p>}
            <button type="submit" className={styles.btn} disabled={loading || !!success}>
              {loading ? "Restableciendo..." : "Restablecer contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------- Pantalla principal ---------- */

export default function Login({ onLogin }) {
  const uid = useId();
  const fid = (n) => `${uid}-${n}`;

  const [tab, setTab] = useState("login");        // "login" | "register"
  const [step, setStep] = useState(1);            // paso del registro: 1 | 2
  const [form, setForm] = useState({
    username: "", password: "", confirm: "",
    name: "", university: "Universidad del Magdalena", career: "",
    ingresoCorte: "2023-2",
    securityQuestion: "", securityAnswer: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState("idle");
  const usernameTimerRef = useRef(null);

  const isRegister = tab === "register";

  useEffect(() => {
    prewarm();
    import("../pages/Dashboard");
    import("../components/UpdatePrompt");
    import("../components/HorarioView");
  }, []);

  useEffect(() => {
    if (!isRegister || !form.username.trim()) {
      setUsernameStatus("idle");
      return;
    }
    const u = form.username.trim();
    if (u.length < 2 || /\s/.test(u)) { setUsernameStatus("idle"); return; }
    setUsernameStatus("checking");
    clearTimeout(usernameTimerRef.current);
    usernameTimerRef.current = setTimeout(async () => {
      try {
        const res = await api(`/users?check=${encodeURIComponent(u)}`, { skipAuth: true });
        setUsernameStatus(res.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);
    return () => clearTimeout(usernameTimerRef.current);
  }, [form.username, isRegister]);

  const triggerError = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const switchTab = (next) => {
    setTab(next);
    setStep(1);
    setError("");
    setSuccess("");
    setShowPw(false);
  };

  /* --- login --- */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.username || !form.password) return triggerError("Completa todos los campos");
    setLoading(true);
    try {
      const auth = await api("/auth/login", {
        method: "POST",
        skipAuth: true,
        body: { username: form.username, password: form.password },
      });
      onLogin(auth, remember);
    } catch (err) {
      setLoading(false);
      return triggerError(err.message || "Error al iniciar sesión");
    }
  };

  /* --- registro --- */
  const newUserSemester = autoSemester(form.ingresoCorte);

  const validateStep1 = () => {
    if (!form.username || !form.password || !form.name)
      return "Nombre, usuario y contraseña son obligatorios";
    if (/\s/.test(form.username)) return "El usuario no puede tener espacios";
    if (form.password !== form.confirm) return "Las contraseñas no coinciden";
    if (form.password.length < 6) return "La contraseña debe tener al menos 6 caracteres";
    if (usernameStatus === "taken") return "Ese usuario ya está en uso";
    return "";
  };

  const validateStep2 = () => {
    const q = form.securityQuestion;
    const a = form.securityAnswer.trim();
    if ((q && !a) || (!q && a)) return "Elige una pregunta y escribe su respuesta, o deja ambas vacías";
    if (q && a.length < 4) return "La respuesta de seguridad debe tener al menos 4 caracteres";
    return "";
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (step === 1) {
      const msg = validateStep1();
      if (msg) return triggerError(msg);
      setStep(2);
      return;
    }

    const msg = validateStep1() || validateStep2();
    if (msg) {
      if (validateStep1()) setStep(1);
      return triggerError(msg);
    }

    const newUser = {
      username:     form.username,
      password:     form.password,
      name:         form.name,
      university:   form.university || "",
      career:       form.career || "",
      semester:     autoSemester(form.ingresoCorte),
      ingresoCorte: form.ingresoCorte || "2023-2",
      photo:        null,
      appMode:      "light",
      appTheme:     "ambar",
      themeColors:  DEFAULT_THEME_COLORS,
      borderRadius: 12,
      fontScale:    1,
      fontBody:     "Overused Grotesk",
    };
    if (form.securityQuestion && form.securityAnswer.trim()) {
      newUser.securityQuestion = form.securityQuestion;
      newUser.securityAnswer = form.securityAnswer.trim();
    }

    setLoading(true);
    try {
      await api("/auth/register", { method: "POST", skipAuth: true, body: newUser });
      setLoading(false);
      switchTab("login");
      setSuccess("¡Cuenta creada! Inicia sesión.");
      setForm((f) => ({ ...f, password: "", confirm: "", securityAnswer: "" }));
    } catch (err) {
      setLoading(false);
      return triggerError(err.message || "No se pudo crear la cuenta");
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const availableCareers = UNIVERSITIES[form.university] || [];

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>

        {/* ===== Panel de bienvenida ===== */}
        <aside className={styles.panel}>
          <span className={styles.panelGlow} aria-hidden="true" />
          <p className={styles.welcome}>Bienvenido a</p>

          <div className={styles.hero}>
            <div className={styles.logoBadge}>
              <img src="/aimer.svg" alt="" width="96" height="96" />
            </div>
            <h1 className={styles.brand}>Aimer</h1>
            <p className={styles.tagline}>
              Sobrevive al semestre con un poquito más de orden
            </p>
          </div>

          <p className={styles.heroFoot}>por y para estudiantes</p>
          <span className={styles.wave} aria-hidden="true" />
        </aside>

        {/* ===== Panel del formulario ===== */}
        <main className={styles.formSide}>
          <div className={`${styles.formInner} ${shake ? styles.shake : ""}`}>
            {!isRegister ? (
              <>
                <h2 className={styles.title}>Hola, <em>de nuevo</em></h2>
                <p className={styles.sub}>Entra para seguir donde lo dejaste.</p>
              </>
            ) : (
              <>
                <h2 className={styles.title}>Crea tu <em>cuenta</em></h2>
                <p className={styles.sub}>Solo toma un minuto.</p>
                <div className={styles.steps} aria-label={`Paso ${step} de 2`}>
                  <span>Paso {step} de 2</span>
                  <div className={styles.stepBars} aria-hidden="true">
                    <i className={styles.stepOn} />
                    <i className={step === 2 ? styles.stepOn : ""} />
                  </div>
                </div>
              </>
            )}

            {success && <p className={styles.successMsg} role="status"><IconCheck size={13} /> {success}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}

            {/* ---------- LOGIN ---------- */}
            {!isRegister && (
              <form onSubmit={handleLogin} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor={fid("l-user")}>Usuario</label>
                  <div className={styles.inputWrap}>
                    <input id={fid("l-user")} value={form.username} onChange={set("username")}
                      placeholder="tu usuario" autoComplete="username" />
                    {form.username.trim() && <FieldCheck />}
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor={fid("l-pw")}>Contraseña</label>
                  <div className={styles.pwWrap}>
                    <input id={fid("l-pw")} type={showPw ? "text" : "password"} value={form.password}
                      onChange={set("password")} placeholder="tu contraseña" autoComplete="current-password" />
                    {form.password.length >= 6 && <FieldCheck />}
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPw}>
                      <EyeIcon off={showPw} />
                    </button>
                  </div>
                </div>

                <div className={styles.metaRow}>
                  <label className={styles.remember} htmlFor={fid("l-remember")}>
                    <input id={fid("l-remember")} type="checkbox" checked={remember}
                      onChange={(e) => setRemember(e.target.checked)} />
                    Mantener sesión
                  </label>
                  <button type="button" className={styles.forgotLink} onClick={() => setShowForgot(true)}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <div className={styles.btnRow}>
                  <button type="submit" className={styles.btn} disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </button>
                  <button type="button" className={styles.btnGhost} onClick={() => switchTab("register")}>
                    Crear cuenta
                  </button>
                </div>
              </form>
            )}

            {/* ---------- REGISTRO ---------- */}
            {isRegister && (
              <form onSubmit={handleRegister} className={styles.form} noValidate>
                {step === 1 && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor={fid("r-name")}>Nombre</label>
                      <div className={styles.inputWrap}>
                        <input id={fid("r-name")} value={form.name} onChange={set("name")}
                          placeholder="tu nombre" autoComplete="name" />
                        {form.name.trim() && <FieldCheck />}
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor={fid("r-user")}>Usuario</label>
                      <div className={styles.inputWrap}>
                        <input id={fid("r-user")} value={form.username} onChange={set("username")}
                          placeholder="sin espacios" autoComplete="username" />
                        {usernameStatus === "available" && <FieldCheck />}
                      </div>
                      {usernameStatus === "checking" && <span className={styles.hint}>Verificando...</span>}
                      {usernameStatus === "available" && <span className={styles.hintOk}>Usuario disponible</span>}
                      {usernameStatus === "taken" && <span className={styles.hintError}>Ese usuario ya está en uso</span>}
                    </div>

                    <div className={styles.field}>
                      <label htmlFor={fid("r-pw")}>Contraseña</label>
                      <div className={styles.pwWrap}>
                        <input id={fid("r-pw")} type={showPw ? "text" : "password"} value={form.password}
                          onChange={set("password")} placeholder="mín. 6 caracteres" autoComplete="new-password" />
                        {form.password.length >= 6 && <FieldCheck />}
                        <button type="button" className={styles.eyeBtn} onClick={() => setShowPw((v) => !v)}
                          aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPw}>
                          <EyeIcon off={showPw} />
                        </button>
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor={fid("r-pc")}>Confirmar contraseña</label>
                      <div className={styles.inputWrap}>
                        <input id={fid("r-pc")} type="password" value={form.confirm} onChange={set("confirm")}
                          placeholder="repítela" autoComplete="new-password" />
                        {form.confirm && form.confirm === form.password && <FieldCheck />}
                      </div>
                    </div>

                    <div className={styles.btnRow}>
                      <button type="submit" className={styles.btn}>Continuar</button>
                      <button type="button" className={styles.btnGhost} onClick={() => switchTab("login")}>
                        Iniciar sesión
                      </button>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor={fid("r-career")}>Carrera</label>
                      <select id={fid("r-career")} value={form.career} onChange={set("career")} className={styles.selectInput}>
                        <option value="">— Selecciona tu carrera —</option>
                        {availableCareers.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor={fid("r-corte")}>Corte de ingreso</label>
                      <select id={fid("r-corte")} value={form.ingresoCorte} onChange={set("ingresoCorte")} className={styles.selectInput}>
                        {CORTES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <small className={styles.hint}>
                        Estás en semestre {newUserSemester} ({SEMESTER_CORTE}) — se calcula solo.
                      </small>
                    </div>

                    <div className={styles.divider} />

                    <div className={styles.field}>
                      <label htmlFor={fid("r-sq")}>Pregunta de seguridad</label>
                      <select id={fid("r-sq")} value={form.securityQuestion} onChange={set("securityQuestion")} className={styles.selectInput}>
                        <option value="">— Para recuperar tu cuenta —</option>
                        {SECURITY_QUESTIONS.map((q) => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor={fid("r-sa")}>Tu respuesta</label>
                      <div className={styles.inputWrap}>
                        <input id={fid("r-sa")} type="password" value={form.securityAnswer} onChange={set("securityAnswer")}
                          placeholder="mín. 4 caracteres" autoComplete="off" />
                        {form.securityAnswer.trim().length >= 4 && <FieldCheck />}
                      </div>
                    </div>

                    <div className={styles.btnRow}>
                      <button type="submit" className={styles.btn} disabled={loading}>
                        {loading ? "Creando..." : "Crear cuenta"}
                      </button>
                      <button type="button" className={styles.btnGhost} onClick={() => { setStep(1); setError(""); }}>
                        Atrás
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        </main>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}
