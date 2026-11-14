import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./NotificationBell.module.css";
import { IconBell, IconClose, IconWarning, IconCheck } from "./Icons";
import { formatDue, labelFromTipo } from "../utils/reminders.js";
import { isStandalone, isMobileDevice } from "../utils/push.js";

function dropdownPos(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const isMobile = window.innerWidth <= 900;
  const width = isMobile ? Math.min(360, window.innerWidth - 24) : 320;
  const left = Math.max(
    width / 2 + 12,
    Math.min(r.left + r.width / 2, window.innerWidth - width / 2 - 12)
  );
  return { top: r.bottom + 10, left };
}

export default function NotificationBell({ due, permission, requestPermission, dismiss, sendTest, pushEnabled, subscribed, pushError, pushFeedback, activatePush, disablePush }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const dropdownRef = useRef(null);
  const standalone = isStandalone();
  const isPhone = isMobileDevice();

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && wrapRef.current.contains(e.target)) return;
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const update = () => setPos(dropdownPos(wrapRef.current));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const toggle = () => {
    if (!open) setPos(dropdownPos(wrapRef.current));
    setOpen((v) => !v);
  };

  return (
    <div className={styles.bellWrap} ref={wrapRef}>
      <button
        className={`${styles.bellBtn} ${open ? styles.bellBtnOpen : ""}`}
        onClick={toggle}
        aria-label={`Recordatorios${due.length > 0 ? `, ${due.length} pendiente${due.length > 1 ? "s" : ""}` : ""}`}
        title="Recordatorios"
      >
        <IconBell size={18} />
        {due.length > 0 && <span className={styles.badge}>{due.length}</span>}
      </button>

      {createPortal(open && (
        <div ref={dropdownRef} className={styles.dropdown} style={{ top: pos?.top ?? 8, left: pos?.left ?? 8 }}>
          <div className={styles.header}>
            <span className={styles.title}>Recordatorios</span>
            {due.length > 0 && <span className={styles.count}>{due.length}</span>}
          </div>

          {permission === "unsupported" && (
            <p className={styles.notice}>
              <IconWarning size={12} /> Tu navegador no soporta notificaciones.
            </p>
          )}
          {!isPhone && permission !== "granted" && permission !== "unsupported" && (
            <div className={styles.enableRow}>
              <span>Recibe alertas del navegador</span>
              <button className={styles.enableBtn} onClick={requestPermission}>
                Activar
              </button>
            </div>
          )}
          {permission === "granted" && (
            <div className={styles.testRow}>
              <span>¿Se ven bien en tu teléfono?</span>
              <button className={styles.testBtn} onClick={sendTest}>
                Probar
              </button>
            </div>
          )}
          {isPhone && standalone && permission === "granted" && (
            <div className={styles.pushRow}>
              {pushEnabled ? (
                <>
                  <span>Push activo · avisos con la app cerrada</span>
                  <button className={styles.pushBtn} onClick={disablePush}>
                    Desactivar
                  </button>
                </>
              ) : (
                <>
                  <span>Recibe avisos con la app cerrada</span>
                  <button className={styles.pushBtn} onClick={activatePush}>
                    Activar push
                  </button>
                </>
              )}
            </div>
          )}
          {pushError && (
            <p className={styles.pushErr}>
              <IconWarning size={12} /> {pushError}
            </p>
          )}
          {pushFeedback && (
            <p className={styles.pushOk}>
              <IconCheck size={12} /> {pushFeedback}
            </p>
          )}

          {due.length === 0 ? (
            <p className={styles.empty}>No hay recordatorios pendientes.</p>
          ) : (
            <div className={styles.list}>
              {due.map((n) => (
                <div key={n.key} className={styles.item}>
                  <div className={styles.itemBody}>
                    <span className={styles.itemTipo}>
                      {labelFromTipo(n.tipo)} · {formatDue(n)}
                      {n.atrasado && <em className={styles.atrasado}> (con retraso)</em>}
                    </span>
                    <span className={styles.itemTitle}>{n.titulo}</span>
                    <span className={styles.itemFecha}>{n.fecha}</span>
                  </div>
                  <button
                    className={styles.dismiss}
                    title="Descartar"
                    onClick={() => dismiss(n.key)}
                  >
                    <IconClose size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ), document.body)}
    </div>
  );
}
