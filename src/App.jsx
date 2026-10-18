import { Suspense, lazy, useState, useEffect } from "react";
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const UpdatePrompt = lazy(() => import("./components/UpdatePrompt"));
const CustomCursor = lazy(() => import("./components/CustomCursor"));
import { api, saveSession, clearSession, getToken, prewarm } from "./api";
import { ensureFont } from "./utils/fonts";
import { getPhoto } from "./utils/photo";
import "./App.css";

export const APP_THEMES = {
  rojo: {
    name: "Rojo",
    accent: "#FF3B4D",
    accent2: "#D1212F",
    accentRgb: "255,59,77",
  },
  naranja: {
    name: "Naranja",
    accent: "#FF7A1A",
    accent2: "#E35E00",
    accentRgb: "255,122,26",
  },
  ambar: {
    name: "Ámbar",
    accent: "#FFC94D",
    accent2: "#F2A900",
    accentRgb: "255,201,77",
  },
  verde: {
    name: "Verde",
    accent: "#2BD06E",
    accent2: "#0FA84F",
    accentRgb: "43,208,110",
  },
  turquesa: {
    name: "Turquesa",
    accent: "#00D1B2",
    accent2: "#00A28A",
    accentRgb: "0,209,178",
  },
  azul: {
    name: "Azul",
    accent: "#3B82F6",
    accent2: "#1D4ED8",
    accentRgb: "59,130,246",
  },
  violeta: {
    name: "Violeta",
    accent: "#8B5CF6",
    accent2: "#6D28D9",
    accentRgb: "139,92,246",
  },
  rosa: {
    name: "Rosa",
    accent: "#FF4D8D",
    accent2: "#E02A6D",
    accentRgb: "255,77,141",
  },
  gris: {
    name: "Gris",
    accent: "#9AA5B8",
    accent2: "#5F6B82",
    accentRgb: "154,165,184",
  },
};

export { generateCortes, CORTES, corteForSemester } from "./utils/cortes";

export function applyTheme(themeKey, mode, fontBody) {
  const t = APP_THEMES[themeKey] || APP_THEMES.ambar;
  const m = mode || "dark";
  const root = document.documentElement;
  root.setAttribute("data-theme", m);
  root.style.setProperty("--accent",     t.accent);
  root.style.setProperty("--accent2",    t.accent2);
  root.style.setProperty("--accent-rgb", t.accentRgb);
  if (fontBody) {
    root.style.setProperty("--font-body", `'${fontBody}', system-ui, sans-serif`);
    ensureFont(fontBody);
  } else {
    root.style.removeProperty("--font-body");
  }
}

export async function saveUser(userData) {
  const body = {
    name:         userData.name,
    university:   userData.university,
    career:       userData.career,
    semester:     userData.semester,
    ingresoCorte: userData.ingresoCorte,
    birthdate:    userData.birthdate,
    appMode:      userData.appMode,
    appTheme:     userData.appTheme,
    themeColors:  userData.themeColors,
    borderRadius: userData.borderRadius,
    fontScale:    userData.fontScale,
    fontBody:     userData.fontBody,
  };
  if ("photo" in userData) body.photo = userData.photo || null;
  const attempt = async () => {
    await api("/users", { method: "POST", body });
  };
  try {
    await attempt();
    return { ok: true };
  } catch (error) {
    try {
      await new Promise((r) => setTimeout(r, 1500));
      await attempt();
      return { ok: true };
    } catch (error2) {
      return { ok: false, error: error2 };
    }
  }
}

export default function App() {
  const [user, setUser]   = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    prewarm();
    (async () => {
      try {
        const saved = localStorage.getItem("malla_session");
        if (saved) {
          const s = JSON.parse(saved);
          if (s?.token && s?.user) {
            applyTheme(s.user.appTheme || "ambar", s.user.appMode || "light", s.user.fontBody);
            if (!cancelled) setUser(s.user);
            api("/auth/me", { soft401: true })
              .then(({ user: serverUser }) => {
                if (cancelled) return;
                setUser((prev) => {
                  if (!prev) return serverUser;
                  if (prev.hasPhoto && !serverUser.hasPhoto) {
                    getPhoto(prev.username).then((p) => {
                      if (cancelled) return;
                      if (p) {
                        api("/users", { method: "POST", body: { photo: p } }).catch(() => {});
                      }
                    });
                    return { ...serverUser, hasPhoto: true };
                  }
                  return serverUser;
                });
              })
              .catch(() => { if (!cancelled) { clearSession(); setUser(null); } });
          }
        }
      } catch (_) {}
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = (auth) => {
    if (!auth?.token || !auth?.user) return;
    saveSession(auth.token, auth.user, auth.data);
    setUser(auth.user);
    applyTheme(auth.user.appTheme || "ambar", auth.user.appMode || "light", auth.user.fontBody);
  };

  const handleLogout = () => {
    const currentMode  = user?.appMode  || "light";
    const currentTheme = user?.appTheme || "ambar";
    clearSession();
    setUser(null);
    applyTheme(currentTheme, currentMode);
  };

  const handleUpdateUser = async (updated) => {
    saveSession(getToken(), updated);
    setUser(updated);
    applyTheme(updated.appTheme || "ambar", updated.appMode || "light", updated.fontBody);
    await saveUser(updated);
  };

  if (!ready) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        flex: 1, minHeight: 0, color: "var(--text-muted)", fontFamily: "var(--font-body)",
        flexDirection: "column", gap: "12px",
      }}>
        <span style={{ fontSize: "28px", color: "var(--accent)" }}>✦</span>
        <span>Cargando aplicación...</span>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        flex: 1, minHeight: 0, color: "var(--text-muted)", fontFamily: "var(--font-body)",
        flexDirection: "column", gap: "12px",
      }}>
        <span style={{ fontSize: "28px", color: "var(--accent)" }}>✦</span>
        <span>Cargando aplicación...</span>
      </div>
    }>
      {user ? (
        <Dashboard
          user={user}
          onLogout={handleLogout}
          onUpdateUser={handleUpdateUser}
        />
      ) : (
        <Login onLogin={handleLogin} />
      )}
      {user && <UpdatePrompt />}
      <CustomCursor />
    </Suspense>
  );
}
