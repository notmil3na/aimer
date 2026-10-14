import { useEffect, useRef } from "react";
import styles from "./CustomCursor.module.css";

const TWINKLE_INTERVAL = 300;
const MAX_TWINKLES = 8;

export default function CustomCursor() {
  const dotRef = useRef(null);
  const poolRef = useRef([]);
  const mouseRef = useRef({ x: -100, y: -100 });
  const rafRef = useRef(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    if (!mq.matches) return;

    const onMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      if (!pendingRef.current) {
        pendingRef.current = true;
        rafRef.current = requestAnimationFrame(() => {
          pendingRef.current = false;
          if (dotRef.current) {
            dotRef.current.style.translate =
              mouseRef.current.x + "px " + mouseRef.current.y + "px";
          }
        });
      }
    };
    document.addEventListener("mousemove", onMove, { passive: true });

    const twinkleTimer = setInterval(() => {
      let el;
      if (poolRef.current.length > 0) {
        el = poolRef.current.pop();
      } else {
        el = document.createElement("div");
        el.className = styles.twinkle;
      }

      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 22;
      const rot = Math.random() * 360;
      const size = 6 + Math.random() * 6;
      const x = mouseRef.current.x + Math.cos(angle) * dist;
      const y = mouseRef.current.y + Math.sin(angle) * dist;

      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.setProperty("--rot", rot + "deg");

      document.body.appendChild(el);

      setTimeout(() => {
        el.remove();
        if (poolRef.current.length < MAX_TWINKLES) {
          poolRef.current.push(el);
        }
      }, 800);
    }, TWINKLE_INTERVAL);

    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
      clearInterval(twinkleTimer);
    };
  }, []);

  return <div ref={dotRef} className={styles.cursor} />;
}
