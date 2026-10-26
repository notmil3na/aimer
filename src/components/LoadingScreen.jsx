import AnimatedFace from "./AnimatedFace";
import styles from "./LoadingScreen.module.css";

export default function LoadingScreen() {
  return (
    <main className={styles.screen} role="status" aria-live="polite">
      <div className={styles.card}>
        <div className={styles.logoBadge}>
          <AnimatedFace className={styles.face} />
        </div>
        <p className={styles.brand}>Aimer</p>
        <p className={styles.message}>Preparando tu espacio académico</p>
        <span className={styles.progress} aria-hidden="true">
          <span />
        </span>
      </div>
    </main>
  );
}
