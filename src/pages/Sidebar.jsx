import { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import { APP_THEMES } from "../App";
import styles from "./Sidebar.module.css";
import { IconStar, IconSun, IconMoon, IconLogout } from "../components/Icons";
import { usePhoto } from "../utils/photo";

export default function Sidebar({ user, tabs, activeTab, onTabChange, onLogout, onUpdateUser, bell }) {
  const initial = user.name ? user.name[0].toUpperCase() : "U";
  const photo   = usePhoto(user.username, !!user.hasPhoto);
  const mode    = user.appMode || "light";
  const theme   = APP_THEMES[user.appTheme] || APP_THEMES.ambar;

  const toggleMode = () => {
    const next = mode === "dark" ? "light" : "dark";
    onUpdateUser({ ...user, appMode: next });
  };

  // ── Barra inferior (móvil): indicador deslizante ──────────────────────────
  const navRef  = useRef(null);   // contenedor con scroll horizontal
  const btnRefs = useRef({});     // un ref por botón, indexado por tab.id
  const [pill, setPill] = useState({ x: 0, w: 0, ready: false });

  const measure = useCallback(() => {
    const btn = btnRefs.current[activeTab];
    const nav = navRef.current;
    if (!btn || !nav || btn.offsetWidth === 0) return; // en escritorio la barra está oculta
    setPill({ x: btn.offsetLeft, w: btn.offsetWidth, ready: true });
    // centra la pestaña activa dentro de la barra
    const target = btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeTab]);

  useLayoutEffect(() => { measure(); }, [measure, tabs]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // ── Ocultar la barra al bajar, mostrarla al subir ─────────────────────────
  const wrapRef = useRef(null);
  const [navHidden, setNavHidden] = useState(false);

  useEffect(() => {
    const lastTop = new WeakMap(); // último scrollTop visto, por cada elemento con scroll
    const onScroll = (e) => {
      const el = e.target;
      if (!(el instanceof Element)) return;          // ignora el scroll del documento
      if (wrapRef.current?.contains(el)) return;     // ignora el scroll horizontal de la propia barra
      const top  = el.scrollTop;
      const prev = lastTop.get(el) ?? top;
      const delta = top - prev;
      if (Math.abs(delta) < 8) return;               // evita parpadeos por movimientos mínimos
      lastTop.set(el, top);
      if (top < 40) setNavHidden(false);             // cerca del inicio: siempre visible
      else setNavHidden(delta > 0);                  // bajando = oculta, subiendo = muestra
    };
    // scroll no "burbujea", pero sí se puede escuchar en fase de captura
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  useEffect(() => { setNavHidden(false); }, [activeTab]); // al cambiar de pestaña, reaparece

  // ── Encabezado flotante (móvil): reserva su altura en el contenido ────────
  // Como flota sobre la página, el contenido necesita saber cuánto espacio dejarle.
  // Se mide su alto real y se publica en la variable CSS --top-nav-h.
  const asideRef = useRef(null);
  useLayoutEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const root = document.documentElement;
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => {
      if (!mq.matches) { root.style.removeProperty("--top-nav-h"); return; } // escritorio: sin reserva
      const marginTop = parseFloat(getComputedStyle(el).marginTop) || 0;
      root.style.setProperty("--top-nav-h", `${Math.ceil(el.offsetHeight + marginTop) + 12}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    mq.addEventListener("change", update);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", update);
      root.style.removeProperty("--top-nav-h");
    };
  }, []);

  return (
    <>
    <aside ref={asideRef} className={`${styles.sidebar} ${navHidden ? styles.sidebarHidden : ""}`}>
      {}
      <div className={styles.brandRow}>
        <div className={styles.brand}>
          <span className={styles.brandText}>Aimer</span>
          <span className={styles.brandIcon}><IconStar size={26} /></span>
        </div>
        <div className={styles.brandActions}>
          {bell}
          <button className={styles.modeToggle} onClick={toggleMode} title={mode === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
            {mode === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>
        </div>
      </div>

      {}
      <div className={styles.themeIndicator}>
        <span className={styles.themeDot} style={{ background: theme.accent }} />
        <span className={styles.themeLabel}>{theme.name}</span>
      </div>

      {}
      <div className={styles.profile}>
        <div className={styles.avatar}>
          {photo
            ? <img src={photo} alt={user.name} className={styles.avatarImg} />
            : <span>{initial}</span>
          }
          <div className={styles.avatarRing} />
        </div>
        <div className={styles.profileInfo}>
          <p className={styles.profileName}>{user.name}</p>
          <p className={styles.profileSub}>Semestre {user.semester}</p>
        </div>
        <button
          className={styles.profileLogout}
          onClick={() => { if (window.confirm("¿Cerrar sesión?")) onLogout(); }}
          title="Cerrar sesión"
        >
          <IconLogout size={14} />
        </button>
      </div>

      {}
      <nav className={styles.nav}>
        {tabs.map(t => {
          const IconComp = t.icon;
          return (
            <button
              key={t.id}
              className={`${styles.navBtn} ${activeTab === t.id ? styles.active : ""}`}
              onClick={() => onTabChange(t.id)}
              aria-current={activeTab === t.id ? "page" : undefined}
            >
              <span className={styles.navIcon}>
                {IconComp ? <IconComp size={16} /> : t.icon}
              </span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>

    {/* Barra inferior: solo se muestra en pantallas ≤ 900px (ver CSS) */}
    <div ref={wrapRef} className={`${styles.bottomWrap} ${navHidden ? styles.bottomHidden : ""}`}>
      <nav className={styles.bottomNav} ref={navRef} aria-label="Navegación principal">
        <div className={styles.bottomTrack}>
          <span
            className={styles.bottomIndicator}
            aria-hidden="true"
            style={{
              width: pill.w,
              transform: `translateX(${pill.x}px)`,
              opacity: pill.ready ? 1 : 0,
            }}
          />
          {tabs.map(t => {
            const IconComp = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                ref={el => { btnRefs.current[t.id] = el; }}
                className={`${styles.bottomBtn} ${isActive ? styles.bottomActive : ""}`}
                onClick={() => onTabChange(t.id)}
                aria-current={isActive ? "page" : undefined}
                aria-label={t.label}
                title={t.label}
              >
                {IconComp ? <IconComp size={18} /> : t.icon}
                {isActive && <span className={styles.bottomLabel}>{t.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
    </>
  );
}
