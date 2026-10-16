import { memo } from "react";
import { ESTADOS } from "../data/malla.js";
import styles from "./MateriaCard.module.css";
import { IconCircleDash, IconCircleHalf, IconStar, IconMalla } from "./Icons";

const ESTADO_GLYPH = {
  faltante: IconCircleDash,
  cursando: IconCircleHalf,
  aprobada: IconStar,
};

function MateriaCardInner({
  materia, color, isSelected, isHighlightedPrereq, isHighlightedUnlock,
  isMatriculable, isDimmed, borderRadius, fontScale, onClick
}) {
  const br = borderRadius ?? 12;
  const fs = fontScale ?? 1;

  let cardClass = styles.card;
  if (isSelected) cardClass += " " + styles.selected;
  else if (isHighlightedPrereq) cardClass += " " + styles.highlighted;
  else if (isHighlightedUnlock) cardClass += " " + styles.unlocked;
  else if (isMatriculable) cardClass += " " + styles.matriculable;
  else if (isDimmed) cardClass += " " + styles.dimmed;

  const GlyphIcon = ESTADO_GLYPH[materia.estado] || ESTADO_GLYPH.faltante;

  return (
    <div
      className={cardClass}
      role="button"
      tabIndex={0}
      aria-label={`${materia.nombre}, ${ESTADOS[materia.estado]?.label || materia.estado}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
      style={{
        "--card-color": color,
        borderRadius: `${br}px`,
        fontSize: `calc(12px * ${fs})`,
      }}
      onClick={onClick}
    >
      <span className={styles.estadoGlyph} style={{ color }}><GlyphIcon size={14} /></span>
      <div className={styles.content}>
        <div className={styles.top}>
          <span className={styles.id}>{materia.id}</span>
        </div>
        <p className={styles.nombre}>{materia.nombre}</p>
        {isMatriculable && (
          <div className={styles.matriculableBadge}><IconStar size={10} /> Puedes matricular</div>
        )}
        <div className={styles.meta}>
          <span className={styles.creditos} style={{ borderColor: color, color }}>
            {materia.creditos} cr
          </span>
          {materia.prereqs?.length > 0 && (
            <div className={styles.prereqBadge}>
              <IconMalla size={10} /> {materia.prereqs.length} prereq{materia.prereqs.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(MateriaCardInner);