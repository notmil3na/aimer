import { useEffect } from "react";
import styles from "./Demo.module.css";

const week = [
  { day: "LUN", date: "16", current: true },
  { day: "MAR", date: "17" },
  { day: "MIÉ", date: "18" },
  { day: "JUE", date: "19" },
  { day: "VIE", date: "20" },
];

const classes = [
  { time: "07:00", title: "Estructuras de datos", detail: "Bloque Sierra · 204", color: "lilac" },
  { time: "09:00", title: "Bases de datos", detail: "Edificio Mar · 301", color: "peach" },
  { time: "14:00", title: "Ingeniería de software", detail: "Bloque Sierra · 108", color: "mint" },
];

const tasks = [
  { title: "Taller de árboles binarios", subject: "Estructuras de datos", due: "Hoy · 11:59 p. m.", color: "lilac" },
  { title: "Modelo entidad-relación", subject: "Bases de datos", due: "Mañana · 8:00 a. m.", color: "peach" },
  { title: "Avance del proyecto", subject: "Ingeniería de software", due: "Viernes · 6:00 p. m.", color: "mint" },
];

export default function Demo() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Vista de demostración · Aimer";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <main className={styles.demo}>
      <aside className={styles.sidebar} aria-label="Navegación de demostración">
        <a className={styles.brand} href="/" aria-label="Aimer, ir al inicio">
          <span className={styles.brandIcon} aria-hidden="true">✳</span>
          <span>Aimer</span>
        </a>
        <div className={styles.profile}>
          <div className={styles.avatar} aria-hidden="true">CT</div>
          <div>
            <strong>Camila Torres</strong>
            <span>Ingeniería de Sistemas</span>
          </div>
          <span className={styles.chevron} aria-hidden="true">⌄</span>
        </div>
        <p className={styles.navLabel}>TU ESPACIO</p>
        <nav className={styles.nav}>
          <a className={styles.navItem} href="#resumen"><span>⌂</span> Resumen</a>
          <a className={`${styles.navItem} ${styles.active}`} href="#horario"><span>▦</span> Mi horario</a>
          <a className={styles.navItem} href="#materias"><span>▤</span> Mi malla</a>
          <a className={styles.navItem} href="#tareas"><span>✓</span> Asignaciones <i>3</i></a>
          <a className={styles.navItem} href="#materias"><span>◷</span> Notas</a>
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.semesterTag}><span /> 2026 · Semestre I</div>
          <p>Un semestre a la vez.<br /><em>Vas muy bien.</em></p>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>Mi espacio <span>/</span> <strong>Resumen</strong></div>
          <div className={styles.topbarRight}>
            <span className={styles.today}>Miércoles, 18 de marzo</span>
            <button type="button" className={styles.iconButton} aria-label="Notificaciones de demostración">♧<i /></button>
            <div className={styles.miniAvatar} aria-hidden="true">CT</div>
          </div>
        </header>

        <div className={styles.content} id="resumen">
          <div className={styles.demoNotice}>
            <span aria-hidden="true">✦</span>
            Vista de demostración <b>·</b> Datos ficticios, sin cuenta ni información real
          </div>

          <section className={styles.welcome}>
            <div>
              <p className={styles.eyebrow}>MIÉRCOLES · SEMANA 8</p>
              <h1>Hola, Camila <span aria-hidden="true">✳</span></h1>
              <p className={styles.subtitle}>Un vistazo a tu semestre. Todo en su lugar, todo bajo control.</p>
            </div>
            <a className={styles.primaryButton} href="/">Empieza tu semestre <span aria-hidden="true">↗</span></a>
          </section>

          <section className={styles.stats} aria-label="Resumen académico ficticio">
            <article className={styles.statCard}>
              <span className={styles.statIcon}>◈</span>
              <div><p>Progreso de carrera</p><strong>42<span>%</span></strong></div>
              <div className={styles.progress}><i style={{ width: "42%" }} /></div>
              <small>18 de 43 materias</small>
            </article>
            <article className={styles.statCard}>
              <span className={`${styles.statIcon} ${styles.peachIcon}`}>▦</span>
              <div><p>Clases esta semana</p><strong>12</strong></div>
              <small className={styles.statNote}>3 hoy · próxima a las 9:00</small>
            </article>
            <article className={styles.statCard}>
              <span className={`${styles.statIcon} ${styles.greenIcon}`}>✓</span>
              <div><p>Promedio acumulado</p><strong>4.2<span>/5</span></strong></div>
              <small className={styles.statNote}>↑ 0.3 este semestre</small>
            </article>
          </section>

          <div className={styles.columns}>
            <section className={`${styles.panel} ${styles.schedule}`} id="horario">
              <div className={styles.panelHeading}>
                <div><p className={styles.eyebrow}>ORGANIZA TU SEMANA</p><h2>Tu horario</h2></div>
                <a href="#horario" className={styles.textLink}>Ver horario <span>↗</span></a>
              </div>
              <div className={styles.week}>
                {week.map(({ day, date, current }) => (
                  <div className={`${styles.weekDay} ${current ? styles.currentDay : ""}`} key={day}>
                    <span>{day}</span><b>{date}</b>{current && <i />}
                  </div>
                ))}
              </div>
              <div className={styles.classList}>
                {classes.map((item) => (
                  <article className={styles.classRow} key={item.title}>
                    <time>{item.time}</time>
                    <div className={`${styles.classCard} ${styles[item.color]}`}>
                      <strong>{item.title}</strong><span>{item.detail}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={`${styles.panel} ${styles.tasks}`} id="tareas">
              <div className={styles.panelHeading}>
                <div><p className={styles.eyebrow}>NO DEJES NADA PARA DESPUÉS</p><h2>Por entregar <span className={styles.count}>3</span></h2></div>
                <a href="#tareas" className={styles.moreLink} aria-label="Ver todas las asignaciones">···</a>
              </div>
              <div className={styles.taskList}>
                {tasks.map((task) => (
                  <article className={styles.task} key={task.title}>
                    <span className={`${styles.taskMark} ${styles[`${task.color}Mark`]}`} aria-hidden="true" />
                    <div><strong>{task.title}</strong><span>{task.subject}</span><small>{task.due}</small></div>
                    <span className={styles.taskArrow} aria-hidden="true">↗</span>
                  </article>
                ))}
              </div>
              <a href="#tareas" className={styles.allTasks}>Ver todas las asignaciones <span>→</span></a>
            </section>
          </div>

          <section className={`${styles.panel} ${styles.subjects}`} id="materias">
            <div className={styles.panelHeading}>
              <div><p className={styles.eyebrow}>SEMESTRE ACTUAL</p><h2>Materias que estás viendo</h2></div>
              <span className={styles.subjectTotal}>5 materias</span>
            </div>
            <div className={styles.subjectGrid}>
              <article><span className={styles.subjectDot} /><div><strong>Estructuras de datos</strong><small>4 créditos · En curso</small></div><b>4.5</b></article>
              <article><span className={`${styles.subjectDot} ${styles.dotPeach}`} /><div><strong>Bases de datos</strong><small>3 créditos · En curso</small></div><b>4.2</b></article>
              <article><span className={`${styles.subjectDot} ${styles.dotGreen}`} /><div><strong>Ingeniería de software</strong><small>3 créditos · En curso</small></div><b>4.7</b></article>
              <article><span className={`${styles.subjectDot} ${styles.dotBlue}`} /><div><strong>Redes de computadores</strong><small>3 créditos · En curso</small></div><b>3.9</b></article>
            </div>
          </section>

          <footer className={styles.footer}>
            <span>Aimer <span aria-hidden="true">✳</span> Tu vida universitaria, más simple.</span>
            <a href="/">Conoce Aimer <span aria-hidden="true">↗</span></a>
          </footer>
        </div>
      </section>
    </main>
  );
}
