import { APP_THEMES } from "../App";
import styles from "./Sidebar.module.css";
import { IconStar, IconSun, IconMoon, IconLogout } from "./Icons";
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

  return (
    <aside className={styles.sidebar}>
      {}
      <div className={styles.brandRow}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}><IconStar size={20} /></span>
          <span className={styles.brandText}>Mi<em>Malla</em></span>
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
        <span className={styles.themeLabel}>Tema {theme.name}</span>
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
  );
}
