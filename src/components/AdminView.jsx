import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { CORTES } from "../utils/cortes";
import { SECURITY_QUESTIONS } from "../utils/securityQuestions";
import styles from "./AdminView.module.css";

export default function AdminView() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const userResult = await api("/admin/users");
      setUsers(userResult.users || []);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar la información administrativa.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return users;
    return users.filter((user) =>
      [user.username, user.name, user.university, user.career]
        .some((value) => String(value || "").toLocaleLowerCase().includes(normalized))
    );
  }, [users, query]);

  const saveProfile = async (event) => {
    event.preventDefault();
    const securityQuestion = String(editUser.securityQuestion || "").trim();
    const securityAnswer = String(editUser.securityAnswer || "").trim();
    if (
      securityQuestion &&
      securityQuestion !== editUser.originalSecurityQuestion &&
      securityAnswer.length < 4
    ) {
      setError("Escribe una nueva respuesta de seguridad de al menos 4 caracteres para cambiar la pregunta.");
      return;
    }
    if (securityAnswer && securityAnswer.length < 4) {
      setError("La respuesta de seguridad debe tener al menos 4 caracteres.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await api("/admin/users", {
        method: "POST",
        body: {
          action: "update",
          username: editUser.username,
          user: {
            ...editUser,
            ingresoCorte: editUser.ingreso_corte,
            securityQuestion,
          },
          ...(securityAnswer && { securityAnswer }),
        },
      });
      setEditUser(null);
      setNotice("Perfil actualizado.");
      await loadData();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el perfil.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/users", {
        method: "POST",
        body: { action: "reset-password", username: resetUser.username, newPassword: password },
      });
      setResetUser(null);
      setPassword("");
      setNotice("Contraseña restablecida; se cerraron las sesiones anteriores.");
    } catch (resetError) {
      setError(resetError.message || "No se pudo restablecer la contraseña.");
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`¿Eliminar la cuenta de ${user.username}? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    setError("");
    try {
      await api("/admin/users", { method: "POST", body: { action: "delete", username: user.username } });
      setNotice(`Se eliminó la cuenta ${user.username}.`);
      await loadData();
    } catch (deleteError) {
      setError(deleteError.message || "No se pudo eliminar la cuenta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Espacio de gestión</p>
          <h1>Administrar usuarios</h1>
          <p>Consulta perfiles y realiza acciones sobre las cuentas.</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={loadData} disabled={busy || loading}>
          <span aria-hidden="true">↻</span>
          Actualizar lista
        </button>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon} aria-hidden="true">◉</span>
            <div>
              <h2>Cuentas de usuario</h2>
              <p>{loading ? "Cargando cuentas…" : `${users.length} ${users.length === 1 ? "cuenta registrada" : "cuentas registradas"}`}</p>
            </div>
          </div>
          <input
            className={styles.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por usuario, nombre o carrera"
            aria-label="Buscar cuentas"
          />
        </div>
        <div className={styles.userList}>
          {filteredUsers.map((user) => (
            <article key={user.username} className={styles.userCard}>
              <div className={styles.userIdentity}>
                <span className={styles.userAvatar} aria-hidden="true">
                  {(user.name || user.username || "?")
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("")}
                </span>
                <div className={styles.userSummary}>
                  <div className={styles.userNameLine}>
                    <strong>{user.name || user.username}</strong>
                    {user.is_admin && <span className={styles.adminBadge}>Admin</span>}
                  </div>
                  <span className={styles.username}>@{user.username}</span>
                  <small>
                    {[user.career, user.university, user.semester ? `Semestre ${user.semester}` : ""]
                      .filter(Boolean)
                      .join(" · ") || "Sin información académica"}
                  </small>
                </div>
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.editButton}
                  onClick={() => setEditUser({
                    ...user,
                    securityQuestion: user.security_question || "",
                    originalSecurityQuestion: user.security_question || "",
                    securityAnswer: "",
                  })}
                  disabled={busy}
                >
                  Editar perfil
                </button>
                <button className={styles.resetButton} onClick={() => { setResetUser(user); setPassword(""); }} disabled={busy}>Restablecer clave</button>
                <button className={styles.dangerButton} onClick={() => deleteUser(user)} disabled={busy}>Eliminar</button>
              </div>
            </article>
          ))}
          {!loading && !error && filteredUsers.length === 0 && (
            <p className={styles.empty}>
              {users.length === 0 ? "Aún no hay cuentas para mostrar." : "No hay cuentas que coincidan con la búsqueda."}
            </p>
          )}
        </div>
      </section>

      {editUser && (
        <div className={styles.overlay}>
          <form className={styles.dialog} onSubmit={saveProfile}>
            <h2>Editar @{editUser.username}</h2>
            {[
              ["name", "Nombre"],
              ["university", "Universidad"],
              ["career", "Carrera"],
            ].map(([field, label]) => (
              <label key={field}>
                {label}
                <input
                  type={field === "semester" ? "number" : "text"}
                  min={field === "semester" ? 1 : undefined}
                  max={field === "semester" ? 20 : undefined}
                  value={editUser[field] ?? ""}
                  onChange={(event) => setEditUser({ ...editUser, [field]: event.target.value })}
                />
              </label>
            ))}
            <label>
              Corte de ingreso
              <select
                value={editUser.ingreso_corte || ""}
                onChange={(event) => setEditUser({ ...editUser, ingreso_corte: event.target.value })}
              >
                <option value="">Selecciona un corte</option>
                {!CORTES.includes(editUser.ingreso_corte) && editUser.ingreso_corte && (
                  <option value={editUser.ingreso_corte}>{editUser.ingreso_corte}</option>
                )}
                {CORTES.map((corte) => <option key={corte} value={corte}>{corte}</option>)}
              </select>
            </label>
            <label>
              Semestre
              <input
                type="number"
                min={1}
                max={20}
                value={editUser.semester ?? ""}
                onChange={(event) => setEditUser({ ...editUser, semester: event.target.value })}
              />
            </label>
            <label>
              Pregunta de seguridad
              <select
                value={editUser.securityQuestion}
                onChange={(event) => setEditUser({ ...editUser, securityQuestion: event.target.value })}
              >
                <option value="">Sin pregunta de seguridad</option>
                {!SECURITY_QUESTIONS.includes(editUser.securityQuestion) && editUser.securityQuestion && (
                  <option value={editUser.securityQuestion}>{editUser.securityQuestion}</option>
                )}
                {SECURITY_QUESTIONS.map((question) => <option key={question} value={question}>{question}</option>)}
              </select>
            </label>
            {editUser.securityQuestion && (
              <>
                <p className={styles.fieldHint}>
                  La respuesta guardada está protegida y no se puede consultar. Déjala vacía para conservarla.
                </p>
                <label>
                  {editUser.securityQuestion === editUser.originalSecurityQuestion
                    ? "Nueva respuesta (opcional)"
                    : "Nueva respuesta de seguridad"}
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={4}
                    maxLength={500}
                    value={editUser.securityAnswer}
                    onChange={(event) => setEditUser({ ...editUser, securityAnswer: event.target.value })}
                    required={editUser.securityQuestion !== editUser.originalSecurityQuestion}
                  />
                </label>
              </>
            )}
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setEditUser(null)}>Cancelar</button>
              <button type="submit" disabled={busy}>Guardar</button>
            </div>
          </form>
        </div>
      )}

      {resetUser && (
        <div className={styles.overlay}>
          <form className={styles.dialog} onSubmit={resetPassword}>
            <h2>Restablecer contraseña</h2>
            <p>Cuenta: @{resetUser.username}. La contraseña temporal debe tener al menos 12 caracteres.</p>
            <label>
              Contraseña temporal
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setResetUser(null)}>Cancelar</button>
              <button type="submit" disabled={busy}>Restablecer</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
