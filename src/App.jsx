import { Suspense, lazy, useState, useEffect, useRef, useCallback } from "react";
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const UpdatePrompt = lazy(() => import("./components/UpdatePrompt"));
import { api, saveSession, clearSession, getSession, logout, prewarm } from "./api";
import { getPhoto } from "./utils/photo";
import useGlobalSiteText from "./hooks/useGlobalSiteText";
import LoadingScreen from "./components/LoadingScreen";
import "./App.css";

export const APP_THEMES = {
  rojo: {
    name: "Rojo",
    accent: "#E10600",
    accent2: "#A80000",
    accentRgb: "225,6,0",
    accentInk: "#FFF5F4",
  },
  burdeos: {
    name: "Burdeos",
    accent: "#800020",
    accent2: "#560016",
    accentRgb: "128,0,32",
    accentInk: "#FFF5F4",
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
    accentText: "#805000",
    accentBorder: "#805000",
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
    accent: "#FF2A6D",
    accent2: "#D6245C",
    accentRgb: "255,42,109",
  },
  gris: {
    name: "Gris",
    accent: "#9AA5B8",
    accent2: "#5F6B82",
    accentRgb: "154,165,184",
  },
};

export { generateCortes, CORTES, corteForSemester } from "./utils/cortes";

function accentLuminance(hex) {
  const raw = String(hex || "").replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function applyTheme(themeKey, mode, fontBody) {
  const t = APP_THEMES[themeKey] || APP_THEMES.ambar;
  const m = mode || "light";
  const root = document.documentElement;
  const accentInk = t.accentInk || "#14101F";
  root.setAttribute("data-theme", m);
  root.style.setProperty("--accent",     t.accent);
  root.style.setProperty("--accent2",    t.accent2);
  root.style.setProperty("--accent-rgb", t.accentRgb);
  root.style.setProperty("--accent-ink", accentInk);
  // En modo oscuro un acento muy oscuro (burdeos) desaparece como texto. En ese
  // caso el texto usa el color de contraste claro del tema.
  const accentText = m === "dark"
    ? (accentLuminance(t.accent) < 0.12 ? accentInk : t.accent)
    : (t.accentText || t.accent);
  root.style.setProperty("--accent-text", accentText);
  root.style.setProperty("--accent-border", m === "dark" ? t.accent : (t.accentBorder || t.accent));
  if (fontBody) {
    root.style.setProperty("--font-body", `'${fontBody}', system-ui, sans-serif`);
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
  const [boot, setBoot] = useState(true);
  const publicScopeRef = useRef(null);
  const finishBoot = useCallback(() => setBoot(false), []);
  useGlobalSiteText(user ? "" : "login", publicScopeRef, false);

  useEffect(() => {
    let cancelled = false;
    prewarm();
    (async () => {
      // las preferencias guardadas permiten pintar el tema al instante; la
      // sesión real la valida la cookie contra /auth/me.
      const saved = getSession();
      if (saved?.user) {
        applyTheme(saved.user.appTheme || "ambar", saved.user.appMode || "light", saved.user.fontBody);
        if (!cancelled) setUser(saved.user);
      }
      try {
        const { user: serverUser } = await api("/auth/me", { soft401: true });
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
      } catch (err) {
        // sin cookie válida (o caducada) volvemos al login.
        // Solo limpiamos si el servidor confirma que la sesión expiró (401).
        // En caso de fallo de red (offline) o 500 transitorio, conservamos la sesión
        // y los datos en caché para permitir el funcionamiento offline.
        if (!cancelled && err?.status === 401) {
          clearSession();
          setUser(null);
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = (auth, remember = true) => {
    if (!auth?.user) return;
    saveSession(auth.user, auth.data, remember);
    setUser(auth.user);
    applyTheme(auth.user.appTheme || "ambar", auth.user.appMode || "light", auth.user.fontBody);
  };

  const handleLogout = () => {
    const currentMode  = user?.appMode  || "light";
    const currentTheme = user?.appTheme || "ambar";
    setUser(null);
    applyTheme(currentTheme, currentMode);
    logout();
  };

  const handleUpdateUser = async (updated) => {
    saveSession(updated);
    setUser(updated);
    applyTheme(updated.appTheme || "ambar", updated.appMode || "light", updated.fontBody);
    await saveUser(updated);
  };

  return (
    <>
      {ready && (
        <Suspense fallback={<LoadingScreen progress={90} />}>
          {user ? (
            <Dashboard
              user={user}
              onLogout={handleLogout}
              onUpdateUser={handleUpdateUser}
              appBooting={boot}
            />
          ) : (
            <div
              ref={publicScopeRef}
              className="loginScope"
              data-site-text-scope="login"
            >
              <Login onLogin={handleLogin} />
            </div>
          )}
          {user && <UpdatePrompt />}
        </Suspense>
      )}
      {boot && <LoadingScreen ready={ready} onDone={finishBoot} />}
    </>
  );
}
