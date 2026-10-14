import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const dispatchUpdate = () => window.dispatchEvent(new Event("mimalla:swupdate"));

  const shouldPromptUpdate = (reg) =>
    !!(reg?.waiting && navigator.serviceWorker.controller);

  const checkWaiting = (reg) => {
    if (shouldPromptUpdate(reg)) dispatchUpdate();
  };

  const trackWorker = (worker, reg) => {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        dispatchUpdate();
      }
      if (worker.state === "installed" && reg?.waiting) {
        checkWaiting(reg);
      }
    });
  };

  const registerSw = () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none", scope: "/" })
      .then((reg) => {
        trackWorker(reg.installing, reg);
        reg.addEventListener("updatefound", () => trackWorker(reg.installing, reg));
        checkWaiting(reg);

        const check = () =>
          reg.update().then(() => checkWaiting(reg)).catch(() => {});

        check();

        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const intervalMs = isMobile ? 60 * 1000 : 5 * 60 * 1000;
        setInterval(() => {
          if (document.visibilityState === "visible") check();
        }, intervalMs);

        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check();
        });
        window.addEventListener("focus", check);
        window.addEventListener("online", check);
        window.addEventListener("pageshow", (ev) => {
          checkWaiting(reg);
          if (ev.persisted) check();
        });
      })
      .catch(() => {});
  };

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "SW_WAITING") dispatchUpdate();
  });

  if (document.readyState === "complete") registerSw();
  else window.addEventListener("load", registerSw, { once: true });
}
