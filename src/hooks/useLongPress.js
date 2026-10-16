import { useRef, useCallback } from "react";

export function useLongPress(onLongPress, { delay = 450, tolerance = 10 } = {}) {
  const timer = useRef(null);
  const start = useRef({ x: 0, y: 0 });
  const fired = useRef(false);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const onPointerDown = useCallback((e) => {
    fired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      fired.current = true;
      navigator.vibrate?.(12);
      onLongPress(e);
    }, delay);
  }, [onLongPress, delay]);

  const onPointerMove = useCallback((e) => {
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > tolerance) clear();
  }, [clear, tolerance]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => e.preventDefault(),
    onClickCapture: (e) => { if (fired.current) { e.stopPropagation(); e.preventDefault(); } },
  };
}
