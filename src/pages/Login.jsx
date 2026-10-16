import { useState, useEffect, useRef } from "react";
import { CORTES } from "../App";
import { SEMESTER_CORTE } from "../utils/semesterCountdown";
import { UNIVERSITIES, autoSemester } from "../utils/academic";
import { api, prewarm } from "../api";
import styles from "./Login.module.css";
import { IconCheck, IconChevronRight, BrandStar, IconWarning } from "../components/Icons";
import WebGLBackground from "../components/WebGLBackground";
import useBodyScrollLock from "../hooks/useBodyScrollLock";

const DEFAULT_THEME_COLORS = {
  cursando: "#c8a96e",
  aprobada: "#6ec88a",
  faltante: "#7c8cff",
};

function ForgotPasswordModal({ onClose }) {
  const [step, setStep] = useState("username");
  const [username, setUsername] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useBodyScrollLock(true);

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
      if (err.notConfigured) {
        setError("Tu cuenta no tiene pregunta de seguridad configurada. Contacta al administrador.");
      } else {
        setError(err.message || "Usuario no encontrado");
      }
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
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose} aria-label="Cerrar">&times;</button>
        <h3 className={styles.modalTitle}>Recuperar contraseña</h3>

        {step === "username" && (
          <form onSubmit={handleUsername} className={styles.modalForm}>
            <p className={styles.modalText}>Escribe tu usuario para ver tu pregunta de seguridad.</p>
            <div className={styles.field}>
              <label>Usuario</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Tu usuario" autoFocus />
            </div>
            {error && <p className={styles.error}><IconWarning size={12} /> {error}</p>}
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? "Buscando..." : "Continuar"}
            </button>
          </form>
        )}

        {step === "answer" && (
          <form onSubmit={handleReset} className={styles.modalForm}>
            <p className={styles.modalText}>{question}</p>
            <div className={styles.field}>
              <label>Tu respuesta</label>
              <input type="password" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="La respuesta que configuraste" autoFocus />
            </div>
            <div className={styles.field}>
              <label>Nueva contraseña</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mín. 6 caracteres" />
            </div>
            {error && <p className={styles.error}><IconWarning size={12} /> {error}</p>}
            {success && <p className={styles.successMsg}><IconCheck size={12} /> {success}</p>}
            <button type="submit" className={styles.btn} disabled={loading || !!success}>
              {loading ? "Restableciendo..." : "Restablecer contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Login({ onLogin }) {
  const [tab, setTab]       = useState("login");
  const [form, setForm]     = useState({
    username: "", password: "", confirm: "",
    name: "", university: "Universidad del Magdalena", career: "",
    ingresoCorte: "2023-2",
  });
  const [error, setError]     = useState("");
  const [shake, setShake]     = useState(false);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState("idle");
  const usernameTimerRef = useRef(null);

  useEffect(() => {
    prewarm();
    import("../pages/Dashboard");
    import("../components/UpdatePrompt");
    import("../components/HorarioView");
  }, []);

  useEffect(() => {
    if (tab !== "register" || !form.username.trim()) {
      setUsernameStatus("idle");
      return;
    }
    const u = form.username.trim();
    if (u.length < 2) { setUsernameStatus("idle"); return; }
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
  }, [form.username, tab]);

  const triggerError = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

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
      onLogin(auth);
    } catch (err) {
      setLoading(false);
      return triggerError(err.message || "Error al iniciar sesión");
    }
  };

  const newUserSemester = autoSemester(form.ingresoCorte);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.username || !form.password || !form.name)
      return triggerError("Nombre, usuario y contraseña son obligatorios");
    if (form.password !== form.confirm) return triggerError("Las contraseñas no coinciden");
    if (form.password.length < 6) return triggerError("La contraseña debe tener al menos 6 caracteres");
    if (usernameStatus === "taken") return triggerError("Ese usuario ya está en uso");

    const newUser = {
      username:     form.username,
      password:     form.password,
      name:         form.name,
      university:   form.university   || "",
      career:       form.career       || "",
      semester:     autoSemester(form.ingresoCorte),
      ingresoCorte: form.ingresoCorte || "2023-2",
      photo:        null,
      appMode:      "light",
      appTheme:     "ambar",
      themeColors:  DEFAULT_THEME_COLORS,
      borderRadius: 12,
      fontScale:    1,
      fontBody:     "DM Sans",
    };

    setLoading(true);
    try {
      await api("/auth/register", { method: "POST", skipAuth: true, body: newUser });
      setLoading(false);
      setSuccess("¡Cuenta creada! Inicia sesión.");
      setTab("login");
      setForm(f => ({ ...f, password: "", confirm: "" }));
    } catch (err) {
      setLoading(false);
      return triggerError(err.message || "No se pudo crear la cuenta");
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const availableCareers = UNIVERSITIES[form.university] || [];

  const handleBtnGlow = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - rect.top}px`);
  };

  return (
    <div className={styles.wrap}>
      <WebGLBackground />
      <div className={styles.noise} />
      <div className={`${styles.card} ${shake ? styles.shake : ""}`}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}><BrandStar size={26} /></span>
          <h1 className={styles.logoText}>Aimer</h1>
        </div>
        <p className={styles.sub}>Mi plan de <em>estudio</em> {"<3"}.</p>

        <div className={styles.tabs}>
          <button className={`${styles.tabBtn} ${tab === "login" ? styles.tabActive : ""}`}
            onClick={() => { setTab("login"); setError(""); setSuccess(""); }}>
            Iniciar sesión
          </button>
          <button className={`${styles.tabBtn} ${tab === "register" ? styles.tabActive : ""}`}
            onClick={() => { setTab("register"); setError(""); setSuccess(""); }}>
            Registrarse
          </button>
        </div>

        {success && <p className={styles.successMsg}><IconCheck size={13} /> {success}</p>}
        {error   && <p className={styles.error}>{error}</p>}

        {tab === "login" && (
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.field}>
              <label>Usuario</label>
              <input value={form.username} onChange={set("username")} placeholder="Tu usuario" autoComplete="username" />
            </div>
            <div className={styles.field}>
              <label>Contraseña</label>
              <input type="password" value={form.password} onChange={set("password")} placeholder="••••••" autoComplete="current-password" />
            </div>
            <button type="button" className={styles.forgotBtn} onClick={() => setShowForgot(true)}>
              ¿Olvidaste tu contraseña?
            </button>
            <button type="submit" className={styles.btn} disabled={loading} onMouseMove={handleBtnGlow}>
              {loading ? "Cargando..." : <><IconChevronRight size={13} /> Entrar</>}
            </button>
          </form>
        )}

        {tab === "register" && (
          <form onSubmit={handleRegister} className={styles.form}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label>Nombre completo *</label>
                <input value={form.name} onChange={set("name")} placeholder="Tu nombre" />
              </div>
              <div className={styles.field}>
                <label>Usuario *</label>
                <input value={form.username} onChange={set("username")} placeholder="sin espacios" autoComplete="username" />
                {usernameStatus === "checking" && <span className={styles.fieldHint}>Verificando...</span>}
                {usernameStatus === "available" && <span className={styles.fieldOk}>Disponible</span>}
                {usernameStatus === "taken" && <span className={styles.fieldError}>Ya está en uso</span>}
              </div>
            </div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label>Contraseña *</label>
                <input type="password" value={form.password} onChange={set("password")} placeholder="mín. 6 caracteres" autoComplete="new-password" />
              </div>
              <div className={styles.field}>
                <label>Confirmar *</label>
                <input type="password" value={form.confirm} onChange={set("confirm")} placeholder="repite la contraseña" autoComplete="new-password" />
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.field}>
              <label>Carrera</label>
              <select value={form.career} onChange={set("career")}
                className={styles.selectInput}>
                <option value="">— Selecciona tu carrera —</option>
                {availableCareers.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>Corte de ingreso</label>
              <select value={form.ingresoCorte} onChange={set("ingresoCorte")} className={styles.selectInput}>
                {CORTES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <small className={styles.hint}>
                Estás en semestre {newUserSemester} ({SEMESTER_CORTE}) — se calcula solo.
              </small>
            </div>

            <button type="submit" className={styles.btn} disabled={loading}>
               {loading ? "Creando cuenta..." : <><IconChevronRight size={13} /> Crear cuenta</>}
            </button>
          </form>
        )}
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}
