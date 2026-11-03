import { useEffect } from "react";
import { api } from "../api";

export default function useGlobalSiteText(pagePath, rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !pagePath) return undefined;
    let active = true;
    let texts = [];

    const applyTexts = () => {
      if (!active) return;
      for (const item of texts) {
        try {
          const element = root.querySelector(item.selector);
          if (!element || element.textContent === item.text) continue;
          if (element.textContent !== item.source_text) continue;
          element.textContent = item.text;
        } catch (error) {
          console.error("No se pudo aplicar un texto global", error);
        }
      }
    };

    api(`/site-content?path=${encodeURIComponent(pagePath)}`, { skipAuth: true })
      .then(({ items }) => {
        if (!active) return;
        texts = Array.isArray(items) ? items : [];
        applyTexts();
      })
      .catch((error) => console.error("No se pudieron cargar los textos globales", error));

    const observer = new MutationObserver(applyTexts);
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [pagePath, rootRef]);
}
