import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { horaIdx, toViewHora } from "../utils/horarioHelpers.js";
import { IconClose, IconDownload, IconImage } from "./Icons";
import styles from "./HorarioWallpaper.module.css";
import useBodyScrollLock from "../hooks/useBodyScrollLock";

const FORMATS = {
  iphone:  { label: "iPhone",  w: 1170, h: 2532 },
  android: { label: "Android", w: 1080, h: 2400 },
};

const DAYS = [
  { id: "L", nombre: "Lunes",     lines: ["LU", "NES"] },
  { id: "M", nombre: "Martes",    lines: ["MAR", "TES"] },
  { id: "X", nombre: "Miércoles", lines: ["MIÉR", "COLES"] },
  { id: "J", nombre: "Jueves",    lines: ["JUE", "VES"] },
  { id: "V", nombre: "Viernes",   lines: ["VIER", "NES"] },
  { id: "S", nombre: "Sábado",    lines: ["SÁ", "BADO"] },
];

const PALETAS = ["#C8A96E", "#B882E8", "#6BA3E8", "#6EC8A8", "#E87098"];
const BG_PALETAS = ["#0A0A0A", "#1E3A5F", "#F6F1E7", "#FFFFFF", "#2E3440"];
const BG_TRANSPARENT = "transparent";
const TEXT_PALETAS = ["#1A1A1A", "#FFFFFF", "#C8A96E", "#B882E8", "#6BA3E8", "#E87098"];
const SHADOW_PALETAS = ["#0A0612", "#000000", "#2A143D", "#1E293B", "#FFFFFF"];

const STORAGE_KEY = "malla_wallpaper_config";
function loadSavedConfig() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
  catch { return null; }
}

function hexToRgb(hex) {
  let h = (hex || "#000000").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(f(h + 1 / 3) * 255),
    g: Math.round(f(h) * 255),
    b: Math.round(f(h - 1 / 3) * 255),
  };
}

function hslToHex(h, s, l) {
  const { r, g, b } = hslToRgb(h, s, l);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function getContrastColor(hexColor) {
  return luminance(hexColor) > 0.5 ? "#1a1a1a" : "#F5F0E8";
}

function buildPalette(solid) {
  const [h, s, l] = rgbToHsl(hexToRgb(solid));
  return {
    pastel:     hslToHex(h, Math.max(0.12, s - 0.32), Math.min(0.9, l + 0.2)),
    dark:       hslToHex(h, Math.min(1, Math.max(0.15, s * 0.75)), 0.24),
    muted:      hslToHex(h, Math.min(0.5, Math.max(0.18, s * 0.4)), 0.4),
    solidText:  getContrastColor(solid),
  };
}

function buildBgGradient(bg) {
  const [h, s, l] = rgbToHsl(hexToRgb(bg));
  const top = hslToHex(h, s, Math.min(1, l + 0.05));
  const bottom = hslToHex(h, s, Math.max(0, l - 0.08));
  return `linear-gradient(180deg, ${top} 0%, ${bg} 55%, ${bottom} 100%)`;
}

function zigzagUri(color, w = 20, h = 40) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<path d="M0 0 L${w} ${h / 4} L0 ${h / 2} L${w} ${(3 * h) / 4} L0 ${h} Z" fill="${color}"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function computeLayout(dias, W, H, s) {
  const padX = 96 * s;
  const gap = 30 * s;
  const rowH = 62 * s;
  const basePill = 56 * s;
  const n = Math.max(1, dias.length);
  const maxClases = Math.max(1, ...dias.map((d) => d.clases.length));
  const needH = basePill + maxClases * rowH;
  const top = 20 * s;
  const bottom = H * 0.09;
  const avail = H - top - bottom;
  const pillH = Math.max(150 * s, Math.min(needH, (avail - gap * (n - 1)) / n));
  return { padX, gap, pillH, top, bottom };
}

function measureTextWidth(text, font) {
  if (!text) return 0;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  return ctx.measureText(text).width;
}

function computePillMetrics(dias, s, W, padX, fontFam) {
  const gap = 14 * s;
  const badgePad = 24 * s;
  const ghostW = 58 * s;
  const paddingX = 112 * s;
  const w = (t, size, weight) => measureTextWidth(t, `${weight} ${size}px ${fontFam}`);
  let horaColW = 0;
  for (const d of dias) {
    for (const c of d.clases) {
      for (const part of (c.hora || "").split("–")) {
        horaColW = Math.max(horaColW, w(part, 15 * s, 800));
      }
    }
  }
  horaColW = Math.ceil(horaColW) + 2 * s;
  let maxLine = 0;
  for (const d of dias) {
    let dayMax = 0;
    for (const c of d.clases) {
      const badgeW = c.grupo ? Math.max(44 * s, w(c.grupo, 15 * s, 800) + badgePad) : ghostW;
      const textoW = Math.max(w(c.nombre, 22 * s, 600), w(c.salonLabel, 16 * s, 400));
      dayMax = Math.max(dayMax, badgeW + gap + horaColW + gap + textoW);
    }
    maxLine = Math.max(maxLine, dayMax);
  }
  const pastelW = maxLine + paddingX + 16 * s;
  const avail = Math.max(1, W - 2 * padX);
  return { pillW: Math.min(Math.round(pastelW / 0.68), avail), horaColW };
}

function DayPill({ day, pillH, zigUri, radius, shadow, pillW, horaColW }) {
  const solidLeft = day.side === "left";
  const solidHalf = (
    <div className={styles.solid}>
      <span className={styles.dayLine1}>{day.lines[0]}</span>
      <span className={styles.dayLine2}>{day.lines[1]}</span>
    </div>
  );
  const zigzag = (
    <div
      className={styles.zigzag}
      style={{
        backgroundImage: `url("${zigUri}")`,
        ...(solidLeft ? { left: 0 } : { right: 0, transform: "scaleX(-1)" }),
      }}
    />
  );
  const pastelHalf = (
    <div className={styles.pastel}>
      {zigzag}
      {day.clases.length === 0 ? (
        <span className={styles.emptyRow}>Día libre</span>
      ) : (
        day.clases.map((c, i) => {
          const [horaIni, horaFin] = (c.hora || "").split("–");
          return (
            <div
              className={`${styles.row} ${solidLeft ? styles.rowReverse : ""}`}
              key={i}
            >
              {c.grupo ? <span className={styles.badge}>{c.grupo}</span> : <span className={styles.badgeGhost} />}
              <span
                className={styles.rowHoraCol}
                style={horaColW ? { width: horaColW } : undefined}
              >
                <span>{horaIni}</span>
                {horaFin ? <span>{horaFin}</span> : null}
              </span>
              <div className={styles.rowInfo}>
                <span className={styles.rowMateria}>{c.nombre}</span>
                {c.salonLabel ? <span className={styles.rowSalon}>{c.salonLabel}</span> : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
  return (
    <div
      className={styles.day}
      style={{
        height: pillH,
        borderRadius: radius,
        "--shadow": shadow,
        ...(pillW ? { width: pillW } : {}),
      }}
    >
      {solidLeft ? <>{solidHalf}{pastelHalf}</> : <>{pastelHalf}{solidHalf}</>}
    </div>
  );
}

export default function HorarioWallpaper({ user, horarioData, malla, onClose, onNotify }) {
  useBodyScrollLock();
  const wallRef = useRef(null);
  const saved = useMemo(() => loadSavedConfig(), []);
  const [formato, setFormato] = useState(saved?.formato ?? "iphone");
  const [solidColor, setSolidColor] = useState(saved?.solidColor ?? PALETAS[0]);
  const [bgColor, setBgColor] = useState(saved?.bgColor ?? BG_PALETAS[0]);
  const [pastelOverride, setPastelOverride] = useState(saved?.pastelOverride ?? null);
  const [textColor, setTextColor] = useState(saved?.textColor ?? null);
  const [radiusPct, setRadiusPct] = useState(saved?.radiusPct ?? 50);
  const [shadowColor, setShadowColor] = useState(saved?.shadowColor ?? SHADOW_PALETAS[0]);
  const [bgStyle, setBgStyle] = useState(saved?.bgStyle ?? "gradient");
  const [pillW, setPillW] = useState(0);
  const [horaColW, setHoraColW] = useState(0);
  const [posY, setPosY] = useState(saved?.posY ?? 50);
  const [gapPct, setGapPct] = useState(saved?.gapPct ?? 30);
  const [bgImage, setBgImage] = useState(saved?.bgImage ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        formato, solidColor, bgColor, pastelOverride, textColor,
        radiusPct, shadowColor, bgStyle, posY, gapPct, bgImage,
      }));
    } catch {}
  }, [formato, solidColor, bgColor, pastelOverride, textColor, radiusPct, shadowColor, bgStyle, posY, gapPct, bgImage]);

  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 1080;
        let w = img.width, h = img.height;
        if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        setBgImage(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const clases = horarioData?.clases || [];
  const materias = useMemo(() => malla.flatMap((s) => s.materias), [malla]);
  const materiaMap = useMemo(() => Object.fromEntries(materias.map((m) => [m.id, m])), [materias]);

  const dias = useMemo(() => {
    const activos = horarioData?.dias || [];
    return DAYS
      .filter((d) => activos.includes(d.id) && clases.some((c) => c.dia === d.id))
      .map((d) => ({
        ...d,
        clases: clases
          .filter((c) => c.dia === d.id)
          .sort((a, b) => horaIdx(a.horaInicio) - horaIdx(b.horaInicio))
          .map((c) => ({
            ...c,
            nombre: materiaMap[c.materiaId]?.nombre || c.materiaId,
            hora: `${toViewHora(c.horaInicio)}–${toViewHora(c.horaFin)}`,
          })),
      }));
  }, [clases, horarioData?.dias, materiaMap]);

  const pal = useMemo(() => buildPalette(solidColor), [solidColor]);
  const pastelColor = pastelOverride || pal.pastel;
  const zigUri = useMemo(() => zigzagUri(solidColor), [solidColor]);

  const format = FORMATS[formato];
  const W = format.w, H = format.h;
  const s = W / 1170;
  const ps = 300 / W;
  const layout = useMemo(() => computeLayout(dias, W, H, s), [dias, W, H, s]);
  const radius = Math.round((layout.pillH * radiusPct) / 100);
  const dayShadow = rgba(shadowColor, 0.55);

  const gapX = gapPct * s;
  const nDays = Math.max(1, dias.length);
  const contentH = nDays * layout.pillH + (nDays - 1) * gapX;
  const topY = (posY / 100) * Math.max(0, H - contentH);

  useLayoutEffect(() => {
    if (!dias.length) return;
    let alive = true;
    const compute = () => {
      const fontFam = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
      return computePillMetrics(dias, s, W, layout.padX, fontFam);
    };
    const apply = () => {
      const m = compute();
      setPillW(m.pillW);
      setHoraColW(m.horaColW);
    };
    apply();
    (async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      if (!alive) return;
      apply();
    })();
    return () => {
      alive = false;
    };
  }, [dias, s, W, layout.padX]);

  const canDownload = dias.length > 0 && !busy;
  const safeName = (user.username || "estudiante").replace(/[^\w.-]/g, "_");

  const handleDownload = async () => {
    const node = wallRef.current;
    if (!node || busy || !dias.length) return;
    setBusy(true);
    const holder = document.createElement("div");
    holder.style.cssText = `position:absolute; left:-9999px; top:0; width:${W}px;`;
    holder.setAttribute("aria-hidden", "true");
    holder.appendChild(node.cloneNode(true));
    document.body.appendChild(holder);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 80));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const target = holder.firstElementChild;
      const dataUrl = await toPng(target, { pixelRatio: 1, cacheBust: true });
      const link = document.createElement("a");
      link.download = `fondo_horario_${safeName}_${formato}.png`;
      link.href = dataUrl;
      link.click();
      onNotify?.("Fondo de pantalla descargado");
    } catch {
      onNotify?.("No se pudo generar el fondo de pantalla");
    } finally {
      holder.remove();
      setBusy(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-wallpaper-title">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 id="modal-wallpaper-title" className={styles.modalTitle}>Descargar fondo de pantalla</h3>
            <p className={styles.modalSub}>
              Tu horario semanal estilo widget de lock screen. Personaliza colores y formato.
            </p>
          </div>
          <button className={styles.modalClose} onClick={onClose}><IconClose size={14} /></button>
        </div>

        <div className={styles.body}>
          {dias.length === 0 ? (
            <p className={styles.emptyMsg}>No hay clases en tu horario para generar el fondo.</p>
          ) : (
            <div className={styles.grid}>
              <div className={styles.controls}>
                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Formato</span>
                  <div className={styles.formatRow}>
                    {Object.entries(FORMATS).map(([id, f]) => (
                      <button
                        key={id}
                        aria-pressed={formato === id}
                        className={`${styles.formatBtn} ${formato === id ? styles.formatBtnActive : ""}`}
                        onClick={() => setFormato(id)}
                      >
                        <span className={styles.formatName}>{f.label}</span>
                        <span className={styles.formatDim}>{f.w} × {f.h}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Color de fondo</span>
                  <div className={styles.swatches}>
                    <button
                      title="Transparente"
                      aria-label="Fondo transparente"
                      aria-pressed={bgColor === BG_TRANSPARENT}
                      className={`${styles.swatch} ${styles.swatchTransparent} ${bgColor === BG_TRANSPARENT ? styles.swatchActive : ""}`}
                      onClick={() => setBgColor(BG_TRANSPARENT)}
                    />
                    {BG_PALETAS.map((c) => (
                      <button
                        key={c}
                        title={c}
                        aria-label={`Fondo ${c}`}
                        className={`${styles.swatch} ${bgColor.toUpperCase() === c ? styles.swatchActive : ""}`}
                        style={{ background: c }}
                        onClick={() => setBgColor(c)}
                      />
                    ))}
                    {bgColor !== BG_TRANSPARENT && (
                      <input
                        type="color"
                        className={styles.colorInput}
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        aria-label="Elegir color de fondo"
                      />
                    )}
                  </div>
                  <label className={styles.imgUploadBtn} style={{ marginTop: 8 }}>
                    <IconImage size={14} /> {bgImage ? "Cambiar imagen" : "Usar imagen"}
                    <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                  </label>
                  {bgImage && (
                    <div className={styles.imgPreview}>
                      <img src={bgImage} alt="Fondo" className={styles.imgPreviewThumb} />
                      <button className={styles.imgRemoveBtn} onClick={() => setBgImage(null)} aria-label="Quitar imagen">✕</button>
                    </div>
                  )}
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Color base</span>
                  <div className={styles.swatches}>
                    {PALETAS.map((c) => (
                      <button
                        key={c}
                        title={c}
                        aria-label={`Paleta ${c}`}
                        className={`${styles.swatch} ${solidColor.toUpperCase() === c ? styles.swatchActive : ""}`}
                        style={{ background: c }}
                        onClick={() => setSolidColor(c)}
                      />
                    ))}
                    <input
                      type="color"
                      className={styles.colorInput}
                      value={solidColor}
                      onChange={(e) => setSolidColor(e.target.value)}
                      aria-label="Elegir color base"
                    />
                  </div>
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Tono pastel de las materias</span>
                  <div className={styles.swatches}>
                    <span className={styles.pastelSwatch} style={{ background: pastelColor }} />
                    <input
                      type="color"
                      className={styles.colorInput}
                      value={pastelColor}
                      onChange={(e) => setPastelOverride(e.target.value)}
                      aria-label="Tono pastel"
                    />
                    <span className={styles.pastelHint}>
                      {pastelOverride
                        ? "Personalizado"
                        : "Automático: mismo tono, saturación menor y más luz"}
                    </span>
                  </div>
                  {pastelOverride && (
                    <button className={styles.restoreBtn} onClick={() => setPastelOverride(null)}>
                      Restaurar automático
                    </button>
                  )}
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Color del texto de materias y edificios</span>
                  <div className={styles.swatches}>
                    {TEXT_PALETAS.map((c) => (
                      <button
                        key={c}
                        title={c}
                        aria-label={`Texto ${c}`}
                        className={`${styles.swatch} ${textColor === c ? styles.swatchActive : ""}`}
                        style={{ background: c }}
                        onClick={() => setTextColor(c)}
                      />
                    ))}
                    <input
                      type="color"
                      className={styles.colorInput}
                      value={textColor || "#1A1A1A"}
                      onChange={(e) => setTextColor(e.target.value)}
                      aria-label="Elegir color del texto de materias"
                    />
                  </div>
                  {textColor && (
                    <button className={styles.restoreBtn} onClick={() => setTextColor(null)}>
                      Restaurar automático
                    </button>
                  )}
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Redondez de las pastillas</span>
                  <div className={styles.radiusRow}>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={1}
                      value={radiusPct}
                      onChange={(e) => setRadiusPct(Number(e.target.value))}
                      aria-label="Redondez de las pastillas"
                    />
                    <span className={styles.radiusVal}>{radiusPct}%</span>
                  </div>
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Color de sombra</span>
                  <div className={styles.swatches}>
                    {SHADOW_PALETAS.map((c) => (
                      <button
                        key={c}
                        title={c}
                        aria-label={`Sombra ${c}`}
                        className={`${styles.swatch} ${shadowColor.toUpperCase() === c ? styles.swatchActive : ""}`}
                        style={{ background: c }}
                        onClick={() => setShadowColor(c)}
                      />
                    ))}
                    <input
                      type="color"
                      className={styles.colorInput}
                      value={shadowColor}
                      onChange={(e) => setShadowColor(e.target.value)}
                      aria-label="Elegir color de sombra"
                    />
                  </div>
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Fondo</span>
                  <div className={styles.segRow}>
                    <button
                      aria-pressed={bgStyle === "gradient"}
                      className={`${styles.segBtn} ${bgStyle === "gradient" ? styles.segBtnActive : ""}`}
                      onClick={() => setBgStyle("gradient")}
                    >
                      Gradiente
                    </button>
                    <button
                      aria-pressed={bgStyle === "plano"}
                      className={`${styles.segBtn} ${bgStyle === "plano" ? styles.segBtnActive : ""}`}
                      onClick={() => setBgStyle("plano")}
                    >
                      Plano
                    </button>
                  </div>
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Posición vertical</span>
                  <div className={styles.radiusRow}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={posY}
                      onChange={(e) => setPosY(Number(e.target.value))}
                      aria-label="Posición vertical de las pastillas"
                    />
                    <span className={styles.radiusVal}>{posY}%</span>
                  </div>
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Separación entre pastillas</span>
                  <div className={styles.radiusRow}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={gapPct}
                      onChange={(e) => setGapPct(Number(e.target.value))}
                      aria-label="Separación entre pastillas"
                    />
                    <span className={styles.radiusVal}>{gapPct}%</span>
                  </div>
                </div>
              </div>

              <div className={styles.previewCol}>
                <div className={styles.previewBox}>
                  <div className={styles.previewFrame} style={{ width: W * ps, height: H * ps }}>
                    {bgColor === BG_TRANSPARENT && (
                      <div className={styles.checker} style={{ width: W * ps, height: H * ps }} />
                    )}
                    <div style={{ width: W, height: H, transform: `scale(${ps})`, transformOrigin: "top left", position: "relative", zIndex: 1 }}>
                      {}
                      <div
                        ref={wallRef}
                        className={styles.wall}
                        style={{
                          width: W,
                          height: H,
                          background: bgImage
                            ? `url(${bgImage}) center/cover no-repeat`
                            : bgColor === BG_TRANSPARENT
                              ? "transparent"
                              : bgStyle === "plano"
                                ? bgColor
                                : buildBgGradient(bgColor),
                          "--s": s,
                          "--solid": solidColor,
                          "--pastel": pastelColor,
                          "--dark": pal.dark,
                          "--muted": pal.muted,
                          "--solid-text": pal.solidText,
                          "--text-mat": textColor || pal.dark,
                          "--text-sal": textColor || pal.muted,
                        }}
                      >
                        <div
                          className={styles.days}
                          style={{
                            left: 0,
                            top: topY,
                            width: W,
                            gap: gapX,
                          }}
                        >
                          {dias.map((d, i) => (
                            <DayPill
                              key={d.id}
                              day={{ ...d, side: i % 2 === 0 ? "left" : "right" }}
                              pillH={layout.pillH}
                              zigUri={zigUri}
                              radius={radius}
                              shadow={dayShadow}
                              pillW={pillW}
                              horaColW={horaColW}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className={styles.previewCaption}>
                  Vista previa en vivo · {format.label} {format.w} × {format.h}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleDownload} disabled={!canDownload}>
            <IconDownload size={13} /> {busy ? "Generando…" : "Descargar fondo de pantalla"}
          </button>
        </div>
      </div>
    </div>
  );
}
