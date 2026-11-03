import { useEffect, useState } from "react";
import s from "./LoadingScreen.module.css";

/**
 * Pantalla de carga de Aimer.
 * Uso 1 (progreso real):  <LoadingScreen progress={42} onDone={() => setBoot(false)} />
 * Uso 2 (simulado):       <LoadingScreen ready={datosListos} onDone={() => setBoot(false)} />
 */
export default function LoadingScreen({
  progress,
  ready = false,
  onDone,
  label = "Preparando tu semestre",
}) {
  const controlled = typeof progress === "number";
  const [sim, setSim] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const value = Math.round(
    controlled ? Math.min(100, Math.max(0, progress)) : sim
  );

  useEffect(() => {
    if (controlled) return;
    const id = setInterval(() => {
      setSim((p) =>
        ready ? Math.min(100, p + (100 - p) * 0.3 + 1) : p + (90 - p) * 0.04
      );
    }, 120);
    return () => clearInterval(id);
  }, [controlled, ready]);

  useEffect(() => {
    if (value < 100) return;
    const t1 = setTimeout(() => setLeaving(true), 350);
    const t2 = setTimeout(() => onDone && onDone(), 850);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [value, onDone]);

  return (
    <div
      className={`${s.root} ${leaving ? s.leaving : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div className={s.mesh} aria-hidden="true" />
      <div className={s.grain} aria-hidden="true" />

      <div className={s.center}>
        <div className={s.wordmark}>Aimer</div>

        <div className={s.barWrap}>
          <div className={s.track}>
            <div className={s.fill} style={{ width: `${value}%` }} />
          </div>

          {/* Perla dorada en la punta de la barra */}
          <div
            className={s.tip}
            style={{ left: `${value}%`, opacity: value < 2 ? 0 : 1 }}
            aria-hidden="true"
          />

          {/* Blob que salta sobre la punta */}
          <div className={s.rider} style={{ left: `${value}%` }}>
            <div className={s.hop}>
              <svg viewBox="0 0 100 92" className={s.blob} aria-hidden="true">
                <defs>
                  <clipPath id="aimer-body">
                    <path d="M50 5C70 5 90 18 93 42C96 66 80 85 52 85C24 85 4 70 7 45C10 20 30 5 50 5Z" />
                  </clipPath>
                </defs>

                <g clipPath="url(#aimer-body)">
                  <rect width="100" height="92" fill="#9c2029" />
                  <rect
                    x="-5"
                    y="57"
                    width="110"
                    height="11"
                    fill="#d6ae63"
                    transform="rotate(-6 50 62)"
                  />
                </g>

                <ellipse cx="22" cy="52" rx="7" ry="4.2" fill="#edc8bd" opacity="0.65" />
                <ellipse cx="78" cy="52" rx="7" ry="4.2" fill="#edc8bd" opacity="0.65" />

                <g className={s.eyes}>
                  <ellipse cx="36" cy="40" rx="6" ry="9.2" fill="#edc8bd" />
                  <ellipse cx="64" cy="40" rx="6" ry="9.2" fill="#edc8bd" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        <div className={s.meta}>
          <span className={s.label}>{label}</span>
          <span className={s.pct}>{value}%</span>
        </div>
      </div>
    </div>
  );
}
