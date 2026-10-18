import { useEffect } from "react";

/**
 * Mantiene --app-h con el alto real del viewport visible.
 *
 * En movil el navegador esconde sus barras y 100dvh se queda corto: la
 * diferencia quedaba como una franja al pie que pintaba el canvas del
 * navegador (una barra que cambiaba con el tema). index.html pone el primer
 * valor antes del primer pintado y aqui se sigue actualizando con
 * visualViewport (teclado, barras, rotacion).
 */
export default function useAppHeightFix() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    let lastH = 0;
    const syncHeight = () => {
      const h = Math.round((vv && vv.height) || window.innerHeight || 0);
      if (h && h !== lastH) {
        lastH = h;
        root.style.setProperty("--app-h", `${h}px`);
      }
    };
    syncHeight();

    if (vv) {
      vv.addEventListener("resize", syncHeight);
      vv.addEventListener("scroll", syncHeight);
    }
    window.addEventListener("resize", syncHeight);
    window.addEventListener("orientationchange", syncHeight);

    let raf1 = null;
    let timer = null;

    const nudge = () => {
      window.scrollTo(0, 1);
      raf1 = requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    };

    const onFocusOut = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        syncHeight();
        nudge();
      }, 350);
    };
    document.addEventListener("focusout", onFocusOut, true);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", syncHeight);
        vv.removeEventListener("scroll", syncHeight);
      }
      window.removeEventListener("resize", syncHeight);
      window.removeEventListener("orientationchange", syncHeight);
      document.removeEventListener("focusout", onFocusOut, true);
      if (raf1) cancelAnimationFrame(raf1);
      if (timer) clearTimeout(timer);
    };
  }, []);
}
