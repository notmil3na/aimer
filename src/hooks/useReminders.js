import { useEffect, useRef, useState, useCallback } from "react";
import { computeDueNotifications, formatDue } from "../utils/reminders.js";
import { enablePush, disablePush, fetchPushState, markServerNotified, sendTestPush, isStandalone, isIOS } from "../utils/push.js";

const LS_NOTIFIED = "malla_notified_v1";
const LS_DISMISSED = "malla_dismissed_v1";

function loadSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {}
}

export default function useReminders({ items, eventos }) {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [pushEnabled, setPushEnabled] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [pushError, setPushError] = useState(null);
  const [pushFeedback, setPushFeedback] = useState(null);
  const [due, setDue] = useState([]);
  const notifiedRef = useRef(loadSet(LS_NOTIFIED));
  const dismissedRef = useRef(loadSet(LS_DISMISSED));
  const lastKeyRef = useRef("");

  const activatePush = useCallback(async () => {
    setPushError(null);
    setPushFeedback(null);
    const r = await enablePush();
    setPushEnabled(r.ok && isStandalone());
    setSubscribed(r.ok);
    if (!r.ok) setPushError(r.error);
    return r.ok;
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") await activatePush();
  }, [activatePush]);

  const disablePushCb = useCallback(async () => {
    await disablePush();
    setPushEnabled(false);
    setSubscribed(false);
    setPushError(null);
    setPushFeedback(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const state = await fetchPushState();
      if (!mounted) return;
      if (state.sentKeys.length > 0) {
        state.sentKeys.forEach((k) => notifiedRef.current.add(k));
        saveSet(LS_NOTIFIED, notifiedRef.current);
      }
      setPushEnabled(state.subscribed && isStandalone());
      setSubscribed(state.subscribed);
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        !state.subscribed &&
        isStandalone()
      ) {
        const r = await enablePush();
        if (mounted) {
          setPushEnabled(r.ok && isStandalone());
          setSubscribed(r.ok);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const scan = () => {
      const now = new Date();
      const found = computeDueNotifications({ items, eventos }, now);
      const fresh = found.filter(
        (n) => !notifiedRef.current.has(n.key) && !dismissedRef.current.has(n.key)
      );
      if (fresh.length > 0) {
        const first = fresh[0];
        if (lastKeyRef.current !== first.key) {
          lastKeyRef.current = first.key;
          if (permission === "granted" && typeof Notification !== "undefined") {
            try {
              new Notification("Aimer · Recordatorio", {
                body: `${first.titulo} · ${formatDue(first)}`,
                tag: first.key,
              });
            } catch (_) {}
          }
        }
        const keys = fresh.map((n) => n.key);
        keys.forEach((k) => notifiedRef.current.add(k));
        saveSet(LS_NOTIFIED, notifiedRef.current);
        markServerNotified(keys);
      }
      setDue(found.filter((n) => !dismissedRef.current.has(n.key)));
    };
    scan();
    const id = setInterval(scan, 60000);
    return () => clearInterval(id);
  }, [items, eventos, permission]);

  const dismiss = useCallback((key) => {
    dismissedRef.current.add(key);
    saveSet(LS_DISMISSED, dismissedRef.current);
    setDue((prev) => prev.filter((n) => n.key !== key));
  }, []);

  const sendTest = useCallback(async () => {
    if (permission !== "granted" || typeof Notification === "undefined") return;
    if (subscribed) {
      setPushError(null);
      setPushFeedback(null);
      const r = await sendTestPush();
      if (r && r.ok) {
        setPushFeedback("Notificación de prueba enviada a tus dispositivos.");
        return;
      }
      setPushError((r && r.error) || "No se pudo enviar la notificación de prueba.");
      return;
    }
    try {
      new Notification("Aimer · Prueba", {
        body: "¡Las notificaciones funcionan! Esta es una prueba.",
        tag: "malla-test-" + Date.now(),
      });
      setPushFeedback("Notificación mostrada.");
      return;
    } catch (_) {}
    if (isIOS() && !isStandalone()) {
      setPushError("En iPhone/iPad añade la app a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) para recibir notificaciones.");
    }
  }, [permission, subscribed]);

  return { due, permission, requestPermission, dismiss, sendTest, pushEnabled, subscribed, pushError, pushFeedback, activatePush, disablePush: disablePushCb };
}
