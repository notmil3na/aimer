import { useEffect, useState } from "react";
import { api } from "../api";
import { SECURITY_QUESTIONS } from "../utils/securityQuestions.js";
import styles from "./SecuritySetupModal.module.css";
import { IconShield, IconClose, IconCheck, IconWarning } from "./Icons";
import useBodyScrollLock from "../hooks/useBodyScrollLock";

const SECURITY_MIGRATION_SQL = `ALTER TABLE users ADD COLUMN security_question TEXT;
ALTER TABLE users ADD COLUMN security_answer TEXT;`;

const SET_FLAG = "malla_security_set";
const DISMISSED_FLAG = "malla_security_dismissed";

export default function SecuritySetupModal() {
  const [mode, setMode] = useState("hidden");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useBodyScrollLock(mode !== "hidden");

  useEffect(() => {
    let alive = true;
    if (localStorage.getItem(SET_FLAG) === "1") return;
    api("/auth/security")
      .then((d) => {
        if (!alive) return;
        if (d?.needsMigration) {
          if (sessionStorage.getItem(DISMISSED_FLAG) !== "1") setMode("migration");
          return;
        }
        if (!d?.question) {
          if (sessionStorage.getItem(DISMISSED_FLAG) !== "1") setMode("setup");
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_FLAG, "1");
    setMode("hidden");
  };

  const handleSave = async () => {
    setErr(""); setMsg("");
    if (!question) return setErr("Selecciona una pregunta");
    if (!answer.trim()) return setErr("Escribe la respuesta");
    if (answer.trim().length < 3) return setErr("La respuesta debe tener al menos 3 caracteres");
    setBusy(true);
    try {
      await api("/auth/security", {
        method: "POST",
        body: { question, answer: answer.trim() },
      });
      localStorage.setItem(SET_FLAG, "1");
      setMsg("¡Pregunta guardada! Ya no volverá a aparecer este aviso.");
      setBusy(false);
      setTimeout(() => setMode("hidden"), 1400);
    } catch (e) {
      setBusy(false);
      if (e.needsMigration) {
        setErr("Falta aplicar la migración de seguridad en el servidor.");
        setMode("migration");
      } else {
        setErr(e.message || "No se pudo guardar");
      }
    }
  };

  const copyMigration = () => {
    const doCopy = () => setMsg("Script copiado al portapapeles");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(SECURITY_MIGRATION_SQL).then(doCopy).catch(() => doCopy());
    } else {
      const ta = document.createElement("textarea");
      ta.value = SECURITY_MIGRATION_SQL;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); doCopy(); } catch (_) {}
      document.body.removeChild(ta);
    }
  };

  if (mode === "hidden") return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button type="button" className={styles.close} onClick={dismiss} aria-label="Cerrar">
          <IconClose size={18} />
        </button>

        {mode === "setup" ? (
          <>
            <div className={styles.icon}><IconShield size={26} /></div>
            <h3 className={styles.title}>Configura tu pregunta de seguridad</h3>
            <p className={styles.text}>
              Si algún día olvidas tu contraseña, esta pregunta te permitirá recuperarla.
              Solo debes configurarla una vez.
            </p>
            <div className={styles.field}>
              <label>Pregunta</label>
              <select value={question} onChange={e => setQuestion(e.target.value)} className={styles.select}>
                <option value="">— Selecciona una pregunta —</option>
                {SECURITY_QUESTIONS.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Respuesta</label>
              <input
                type="password"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="La respuesta que solo tú conoces"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
              />
            </div>
            {msg && <p className={styles.ok}><IconCheck size={12} /> {msg}</p>}
            {err && <p className={styles.error}><IconWarning size={12} /> {err}</p>}
            <button type="button" className={styles.btn} onClick={handleSave} disabled={busy}>
              {busy ? "Guardando..." : "Guardar pregunta"}
            </button>
            <button type="button" className={styles.later} onClick={dismiss}>
              Lo haré después
            </button>
          </>
        ) : (
          <>
            <div className={styles.icon}><IconShield size={26} /></div>
            <h3 className={styles.title}>Función no disponible</h3>
            <p className={styles.text}>
              La recuperación de contraseña aún no está disponible en tu cuenta.
              Por favor contacta al administrador para activarla.
            </p>
            <button type="button" className={styles.btn} onClick={dismiss}>Entendido</button>
          </>
        )}
      </div>
    </div>
  );
}
