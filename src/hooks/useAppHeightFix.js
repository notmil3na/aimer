import { useEffect } from "react";

export default function useAppHeightFix() {
  useEffect(() => {
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
      timer = setTimeout(nudge, 350);
    };
    document.addEventListener("focusout", onFocusOut, true);

    return () => {
      document.removeEventListener("focusout", onFocusOut, true);
      if (raf1) cancelAnimationFrame(raf1);
      if (timer) clearTimeout(timer);
    };
  }, []);
}
