import { useEffect, useState, useRef } from "react";
import styles from "./UpdatePrompt.module.css";
import { BrandStar } from "./Icons";
import useBodyScrollLock from "../hooks/useBodyScrollLock";

export default function UpdatePrompt() {
  const [show, setShow] = useState(false);
  const btnRef = useRef(null);

  useBodyScrollLock(show);

  useEffect(() => {
    const onUpdate = () => setShow(true);
    window.addEventListener("aimer:swupdate", onUpdate);
    return () => window.removeEventListener("aimer:swupdate", onUpdate);
  }, []);

  useEffect(() => {
    if (!show) return;
    const handleEscape = (e) => { if (e.key === "Escape") setShow(false); };
    document.addEventListener("keydown", handleEscape);
    btnRef.current?.focus();
    return () => document.removeEventListener("keydown", handleEscape);
  }, [show]);

  const reload = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      await new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        navigator.serviceWorker.addEventListener("controllerchange", finish, { once: true });
        setTimeout(finish, 2500);
      });
    } catch (_) {}
    const url = new URL(window.location.href);
    url.searchParams.set("_sw", Date.now().toString());
    window.location.replace(url.pathname + url.search + url.hash);
  };

  if (!show) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Actualización disponible">
      <div className={styles.logo}><BrandStar size={30} /></div>
      <h2 className={styles.title}>Actualización <em>disponible</em></h2>
      <p className={styles.text}>
        Se descargó una versión nueva de Aimer con mejoras y correcciones.
        Recarga la página para ver los últimos cambios.
      </p>
      <button className={styles.btn} ref={btnRef} onClick={reload}>Recargar ahora</button>
      <button className={styles.btnGhost} onClick={() => setShow(false)}>Ahora no</button>
      <p className={styles.note}>Tus datos están a salvo: solo se actualiza la interfaz.</p>
    </div>
  );
}
