import { useEffect, useState } from "react";
import styles from "./AvailableFriends.module.css";
import { IconSchedule, IconCheck } from "./Icons";
import { usePhoto } from "../utils/photo";
import { formatHourIdx, WINDOW_START, WINDOW_END } from "../utils/scheduleCompare";
import { horaIdx } from "../utils/horarioHelpers";

const NOW_DIA = { 0: "D", 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S" };
const STATUS_RANK = { libre: 0, ocupado: 1, nodata: 2, fuera: 3 };

function currentHourIdx(now) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const idx = Math.floor((mins - 360) / 60);
  if (idx < WINDOW_START || idx >= WINDOW_END) return -1;
  return idx;
}

function claseAhora(clases, diaKey, hourIdx) {
  if (hourIdx < 0) return null;
  return (clases || []).find(
    (c) => c.dia === diaKey && horaIdx(c.horaInicio) <= hourIdx && horaIdx(c.horaFin) > hourIdx
  );
}

function Avatar({ u, size = 40 }) {
  const initial = ((u?.name || u?.username || "?").trim()[0] || "?").toUpperCase();
  const photo = usePhoto(u?.username, !!u?.hasPhoto);
  if (photo) {
    return (
      <div className={styles.avatar} style={{ width: size, height: size }}>
        <img src={photo} alt="" className={styles.avatarImg} />
      </div>
    );
  }
  return (
    <div className={styles.avatar} style={{ width: size, height: size }}>
      <span>{initial}</span>
    </div>
  );
}

export default function AvailableFriends({ amigos, horarios, loading, onSelect, compact = false }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const diaKey = NOW_DIA[now.getDay()];
  const hourIdx = currentHourIdx(now);
  const timeStr = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  const statusOf = (u) => {
    const username = typeof u === "string" ? u : u?.username;
    const info = horarios[username];
    const hayDatos = !!(info && (info.clases || []).length > 0);
    if (hourIdx < 0) return { key: "fuera", hayDatos };
    if (!hayDatos) return { key: "nodata" };
    const ocupado = info.busy[diaKey] && info.busy[diaKey].some(([s, e]) => s <= hourIdx && hourIdx < e);
    if (ocupado) return { key: "ocupado", clase: claseAhora(info.clases, diaKey, hourIdx) };
    return { key: "libre" };
  };

  const sorted = [...amigos].sort((a, b) => {
    const ra = STATUS_RANK[statusOf(a).key];
    const rb = STATUS_RANK[statusOf(b).key];
    if (ra !== rb) return ra - rb;
    return (a.name || a.username).localeCompare(b.name || b.username);
  });

  const libres = amigos.filter((u) => statusOf(u).key === "libre").length;
  const resumen = hourIdx < 0
    ? "fuera de horario"
    : amigos.length > 0
      ? `${libres} de ${amigos.length} libres`
      : "";

  return (
    <div className={`${styles.dispCard} ${compact ? styles.dispCompact : ""}`}>
      <div className={styles.dispHeader}>
        <div className={styles.dispHeaderMain}>
          <span className={styles.dispIcon}><IconSchedule size={15} /></span>
          <div>
            <span className={styles.dispTitle}>¿Quién está <em>disponible</em>?</span>
            <span className={styles.dispSub}>
              Ahora · {timeStr}{resumen ? ` · ${resumen}` : ""}
            </span>
          </div>
        </div>
        <span className={styles.dispLive}><span className={styles.dispLiveDot} /> En vivo</span>
      </div>
      <div className={styles.dispWall}>
        {amigos.length === 0 ? (
          <p className={styles.dispEmpty}>Agrega amigos para ver quién está disponible.</p>
        ) : loading ? (
          <p className={styles.dispEmpty}><span className={styles.loadingSpinner} /> Consultando horarios…</p>
        ) : (
          sorted.map((u) => {
            const st = statusOf(u);
            const clase = st.clase;
            const key = st.key;
            const title = clase
              ? `${clase.materiaId} · ${formatHourIdx(horaIdx(clase.horaInicio))}–${formatHourIdx(horaIdx(clase.horaFin))}`
              : key === "nodata" ? "Sin horario guardado" : key === "fuera" ? "Fuera de la ventana de clases" : "Disponible ahora";
            const content = (
              <>
                <span className={styles.dispRing}>
                  <Avatar u={u} size={compact ? 38 : 42} />
                </span>
                <span className={styles.dispChipName}>{u.name || u.username}</span>
                <span className={styles.dispChipStatus}>
                  {key === "libre" && (<><IconCheck size={9} /> Disponible</>)}
                  {key === "ocupado" && <span className={styles.dispChipMateria}>{clase.materiaId}</span>}
                  {key === "nodata" && "Sin horario"}
                  {key === "fuera" && "Fuera de horario"}
                </span>
              </>
            );
            const className = `${styles.dispChip} ${styles["dispChip" + key.charAt(0).toUpperCase() + key.slice(1)]} ${onSelect ? styles.dispChipButton : ""}`;

            if (onSelect) {
              return (
                <button
                  key={u.username}
                  type="button"
                  className={className}
                  title={title}
                  onClick={() => onSelect(u)}
                >
                  {content}
                </button>
              );
            }
            return (
              <div key={u.username} className={className} title={title}>
                {content}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
