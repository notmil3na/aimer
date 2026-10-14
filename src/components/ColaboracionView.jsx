import { useState, useEffect, useMemo, useCallback } from "react";
import styles from "./ColaboracionView.module.css";
import {
  IconUsers, IconSearch, IconUserPlus, IconCheck, IconClose, IconWarning,
  IconTrash, IconSchedule, IconStar, IconScale,
} from "./Icons";
import { buildColorMap } from "../utils/horarioHelpers.js";
import { usePhoto } from "../utils/photo";
import {
  fetchUsersBrief, searchUsers, fetchFriendships, sendFriendRequest,
  acceptFriendship, removeFriendship, fetchFriendData,
} from "../utils/friendsApi.js";
import {
  DAY_LABELS, WINDOW_START, WINDOW_END,
  formatHourIdx, buildBusyByDay, cellStatuses,
  commonFreeSlots, unionDias, cursandoMaterias, commonSubjects,
  progressFromMalla, overlappingClasses, overlapHoursByDay,
} from "../utils/scheduleCompare.js";
import { horaIdx, toViewHora } from "../utils/horarioHelpers.js";

const STATUS_LABEL = { libre: "Libre en común", yo: "Solo tú", amigo: "Solo tu amigo", ambos: "Ambos ocupados" };

const NOW_DIA = { 0: "D", 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S" };

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

const STATUS_RANK = { libre: 0, ocupado: 1, nodata: 2, fuera: 3 };

function DisponiblesWidget({ amigos, horarios, loading }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const diaKey = NOW_DIA[now.getDay()];
  const hourIdx = currentHourIdx(now);
  const timeStr = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  const statusOf = (u) => {
    const info = horarios[u];
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
    <div className={styles.dispCard}>
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
            const st = statusOf(u.username);
            const clase = st.clase;
            const key = st.key;
            return (
              <div
                key={u.username}
                className={`${styles.dispChip} ${styles["dispChip" + key.charAt(0).toUpperCase() + key.slice(1)]}`}
                title={clase
                  ? `${clase.materiaId} · ${formatHourIdx(horaIdx(clase.horaInicio))}–${formatHourIdx(horaIdx(clase.horaFin))}`
                  : key === "nodata" ? "Sin horario guardado" : key === "fuera" ? "Fuera de la ventana de clases" : "Disponible ahora"}
              >
                <span className={styles.dispRing}>
                  <Avatar u={u} size={42} />
                </span>
                <span className={styles.dispChipName}>{u.name || u.username}</span>
                <span className={styles.dispChipStatus}>
                  {key === "libre" && (<><IconCheck size={9} /> Disponible</>)}
                  {key === "ocupado" && <span className={styles.dispChipMateria}>{clase.materiaId}</span>}
                  {key === "nodata" && "Sin horario"}
                  {key === "fuera" && "Fuera de horario"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
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

function ComparadorGrid({ myHorario, frHorario }) {
  const myBusy = useMemo(() => buildBusyByDay(myHorario?.clases || []), [myHorario]);
  const frBusy = useMemo(() => buildBusyByDay(frHorario?.clases || []), [frHorario]);
  const statuses = useMemo(() => cellStatuses(myBusy, frBusy), [myBusy, frBusy]);
  const slots = useMemo(() => commonFreeSlots(myBusy, frBusy), [myBusy, frBusy]);
  const dias = useMemo(() => unionDias(myHorario, frHorario), [myHorario, frHorario]);
  const totalHoras = slots.reduce((a, s) => a + s.duracion, 0);
  const horas = [];
  for (let h = WINDOW_START; h < WINDOW_END; h++) horas.push(h);

  const miHorarioVacio = !(myHorario?.clases || []).length;
  const amigoHorarioVacio = !(frHorario?.clases || []).length;

  return (
    <div className={styles.gridCard}>
      <div className={styles.gridHeader}>
        <h4 className={styles.gridTitle}>Huecos en común</h4>
        <div className={styles.legend}>
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <span key={k} className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles["dot" + k[0].toUpperCase() + k.slice(1)]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {(miHorarioVacio || amigoHorarioVacio) && (
        <p className={styles.gridHint}>
          <IconWarning size={12} />
          {miHorarioVacio && amigoHorarioVacio
            ? "Ninguno tiene horario todavía, así que todas las franjas se ven libres."
            : miHorarioVacio
              ? "No tienes horario todavía: se asume que estás libre toda la ventana."
              : "Tu amigo no tiene horario todavía: se asume que está libre toda la ventana."}
        </p>
      )}

      {dias.length === 0 ? (
        <p className={styles.gridEmpty}>Ninguno de los dos tiene clases agendadas aún.</p>
      ) : (
        <div className={styles.gridScroll}>
          <div className={styles.compareGrid} style={{ "--num-horas": horas.length }}>
            <div className={styles.gridCorner} />
            {horas.map((h) => (
              <div key={h} className={styles.gridHourHead}>{formatHourIdx(h)}</div>
            ))}
            {dias.map((d) => (
              <div key={d} className={styles.gridRow} style={{ gridColumn: "1 / -1" }}>
                <div className={styles.gridDay}>{DAY_LABELS[d]}</div>
                {(statuses[d] || []).map((st, h) => (
                  <div
                    key={h}
                    className={`${styles.gridCell} ${styles["cell" + st[0].toUpperCase() + st.slice(1)]}`}
                    title={`${DAY_LABELS[d]} ${formatHourIdx(h)} – ${formatHourIdx(h + 1)} · ${STATUS_LABEL[st]}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.slotStats}>
        <span className={styles.slotStat}>
          <strong>{totalHoras} h</strong> libres en común / semana
        </span>
        <span className={styles.slotStat}>
          <strong>{slots.length}</strong> franja{slots.length !== 1 ? "s" : ""} de ≥ 1 h
        </span>
      </div>

      <div className={styles.slotList}>
        {slots.length === 0 ? (
          <p className={styles.slotEmpty}>No encontraron franjas libres en común de al menos 1 hora.</p>
        ) : (
          slots.map((s, i) => (
            <div key={i} className={styles.slotRow}>
              <span className={styles.slotDay}>{DAY_LABELS[s.dia]}</span>
              <span className={styles.slotRange}>
                {formatHourIdx(s.inicio)} – {formatHourIdx(s.fin)}
              </span>
              <span className={styles.slotDur}>{s.duracion} h</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MiniSchedule({ title, subtitle, clases, dias, horas, colorMap, overlapHours }) {
  const CELL_H = 26;
  const esCoincidencia = (d, s, e) => {
    const set = overlapHours[d];
    if (!set) return false;
    for (let h = s; h < e; h++) if (set.has(h)) return true;
    return false;
  };
  return (
    <div className={styles.miniSched}>
      <div className={styles.miniSchedHead}>
        <span className={styles.miniSchedTitle}>{title}</span>
        <span className={styles.miniSchedSub} title={subtitle}>{subtitle}</span>
      </div>
      <div className={styles.miniSchedScroll}>
        <div className={styles.miniSchedGrid}>
          <div className={styles.miniSchedHourCol}>
            <div className={styles.miniSchedHourHead} />
            {horas.map((h) => (
              <div key={h} className={styles.miniSchedHourCell}>{formatHourIdx(h)}</div>
            ))}
          </div>
          {dias.map((d) => {
            const dayClases = (clases || []).filter((c) => c.dia === d);
            return (
              <div key={d} className={styles.miniSchedDay}>
                <div className={styles.miniSchedDayHead} title={DAY_LABELS[d]}>{d}</div>
                <div className={styles.miniSchedDayBody} style={{ height: horas.length * CELL_H }}>
                  {dayClases.map((c, i) => {
                    const s = horaIdx(c.horaInicio), e = horaIdx(c.horaFin);
                    if (s < 0 || e <= s) return null;
                    const overlap = esCoincidencia(d, s, e);
                    const color = colorMap[c.materiaId] || "var(--accent)";
                    return (
                      <div key={i}
                        className={`${styles.miniSchedBlock} ${overlap ? styles.miniSchedBlockOverlap : ""}`}
                        style={{ top: s * CELL_H, height: (e - s) * CELL_H - 2, "--block-color": color }}
                        title={`${c.materiaId}${c.grupo ? ` - ${c.grupo}` : ""}${c.profesor ? ` · ${c.profesor}` : ""} | ${toViewHora(c.horaInicio)}–${toViewHora(c.horaFin)}${c.salonLabel ? ` | ${c.salonLabel}` : ""}`}>
                        <span className={styles.miniSchedBlockId}>{c.materiaId}{c.grupo ? ` (${c.grupo})` : ""}</span>
                        <span className={styles.miniSchedBlockHora}>{toViewHora(c.horaInicio)}–{toViewHora(c.horaFin)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ComparadorHorarios({ myHorario, frHorario, myMalla, frMalla, myName = "Tú", frName }) {
  const myClases = myHorario?.clases || [];
  const frClases = frHorario?.clases || [];
  const horas = [];
  for (let h = WINDOW_START; h < WINDOW_END; h++) horas.push(h);

  const dias = useMemo(() => unionDias(myHorario, frHorario), [myHorario, frHorario]);
  const overlaps = useMemo(() => overlappingClasses(myClases, frClases), [myClases, frClases]);
  const overlapHours = useMemo(() => overlapHoursByDay(myClases, frClases), [myClases, frClases]);

  const myMaterias = useMemo(() => cursandoMaterias(myMalla), [myMalla]);
  const frMaterias = useMemo(() => cursandoMaterias(frMalla), [frMalla]);
  const myColorMap = useMemo(() => buildColorMap(myMaterias), [myMaterias]);
  const frColorMap = useMemo(() => buildColorMap(frMaterias), [frMaterias]);

  const totalMismaMateria = overlaps.filter((o) => o.mismaMateria).length;
  const totalMismoSalon = overlaps.filter((o) => o.mismoSalon).length;
  const totalHoras = overlaps.reduce((a, o) => a + o.duracion, 0);
  const hayHorarios = myClases.length > 0 || frClases.length > 0;

  return (
    <div className={styles.gridCard}>
      <div className={styles.gridHeader}>
        <h4 className={styles.gridTitle}>Comparar horarios</h4>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <i className={styles.legendDot} style={{ background: "var(--accent)" }} /> Tu horario
          </span>
          <span className={styles.legendItem}>
            <i className={styles.legendDot} style={{ background: "#8A7DA8" }} /> Horario de {frName}
          </span>
          <span className={styles.legendItem}>
            <i className={styles.legendDot} style={{ background: "color-mix(in srgb, #E87098 45%, transparent)", border: "1px solid #E87098" }} /> Coinciden
          </span>
        </div>
      </div>

      {!hayHorarios ? (
        <p className={styles.gridHint}>
          <IconWarning size={12} /> Ninguno tiene clases agendadas todavía, así que no hay nada que comparar.
        </p>
      ) : (
        <div className={styles.horariosDual}>
          <MiniSchedule
            title="Mi horario"
            subtitle={myName}
            clases={myClases}
            dias={dias}
            horas={horas}
            colorMap={myColorMap}
            overlapHours={overlapHours}
          />
          <MiniSchedule
            title="Horario"
            subtitle={frName}
            clases={frClases}
            dias={dias}
            horas={horas}
            colorMap={frColorMap}
            overlapHours={overlapHours}
          />
        </div>
      )}

      <div className={styles.slotStats}>
        <span className={styles.slotStat}>
          <strong>{overlaps.length}</strong> coincidencia{overlaps.length !== 1 ? "s" : ""} de clase
        </span>
        <span className={styles.slotStat}><strong>{totalMismaMateria}</strong> misma materia</span>
        <span className={styles.slotStat}><strong>{totalMismoSalon}</strong> mismo salón</span>
        <span className={styles.slotStat}>
          <strong>{totalHoras} h</strong> coinciden / semana
        </span>
      </div>

      <div className={styles.coincTitle}>Clases a la misma hora</div>
      <div className={styles.slotList}>
        {overlaps.length === 0 ? (
          <p className={styles.slotEmpty}>No tienen clases a la misma hora.</p>
        ) : (
          overlaps.map((o, i) => (
            <div key={i} className={`${styles.coincRow} ${o.mismaMateria ? styles.coincRowMateria : ""}`}>
              <span className={styles.slotDay}>{DAY_LABELS[o.dia]}</span>
              <span className={styles.coincHora}>{formatHourIdx(o.inicio)} – {formatHourIdx(o.fin)}</span>
              <span className={styles.coincDetalle}>
                {o.mismaMateria ? (
                  <>
                    <strong>{o.miClase.materiaId}</strong> · ¡misma materia!
                    {o.miClase.grupo && o.frClase.grupo && o.miClase.grupo !== o.frClase.grupo
                      ? ` (${o.miClase.grupo} vs ${o.frClase.grupo})`
                      : o.miClase.grupo ? ` (${o.miClase.grupo})` : ""}
                  </>
                ) : (
                  <>
                    <strong>{myName}:</strong> {o.miClase.materiaId}{o.miClase.grupo ? ` (${o.miClase.grupo})` : ""}
                    {" · "}
                    <strong>{frName}:</strong> {o.frClase.materiaId}{o.frClase.grupo ? ` (${o.frClase.grupo})` : ""}
                  </>
                )}
                {o.mismoSalon && <span className={styles.coincSalon}> · mismo salón {o.miClase.salonLabel}</span>}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ComparisonSection({ me, perfil, data, myHorario, myMalla, myName, onClose }) {
  const frHorario = data?.horario || { dias: [], clases: [] };
  const frMalla = data?.malla || [];
  const frCursando = useMemo(() => cursandoMaterias(frMalla), [frMalla]);
  const compartidas = useMemo(() => commonSubjects(myMalla, frMalla), [myMalla, frMalla]);
  const progress = useMemo(() => progressFromMalla(frMalla), [frMalla]);
  const nombre = perfil?.name || me;
  const hasMalla = progress.totalCred > 0;
  const [modo, setModo] = useState("horarios");

  return (
    <section className={styles.compareSection}>
      <div className={styles.compareHeader}>
        <div className={styles.compareTitleRow}>
          <Avatar u={perfil || { name: me }} size={44} />
          <div>
            <h3 className={styles.compareName}>{nombre}</h3>
            <p className={styles.compareSub}>
              @{me}
              {perfil?.university ? ` · ${perfil.university}` : ""}
              {perfil?.career ? ` · ${perfil.career}` : ""}
              {perfil?.semester ? ` · Sem. ${perfil.semester}` : ""}
            </p>
          </div>
        </div>
        <button className={styles.btnIcon} title="Cerrar comparación" onClick={onClose}>
          <IconClose size={14} />
        </button>
      </div>

      <div className={styles.compareBody}>
        {}
        <div className={styles.profileCol}>
          <div className={styles.profileBlock}>
            <h4 className={styles.blockTitle}>Materias que comparten</h4>
            {compartidas.length === 0 ? (
              <p className={styles.blockMuted}>
                No tienen materias en común (o tu amigo aún no marca materias como "Cursando").
              </p>
            ) : (
              <div className={styles.sharedChips}>
                {compartidas.map((m) => (
                  <span key={m.id} className={styles.sharedChip}>
                    <IconStar size={10} /> {m.id}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.profileBlock}>
            <h4 className={styles.blockTitle}>Cursando ahora</h4>
            {frCursando.length === 0 ? (
              <p className={styles.blockMuted}>Aún no tiene materias en "Cursando".</p>
            ) : (
              <ul className={styles.frMaterias}>
                {frCursando.map((m) => (
                  <li key={m.id}>
                    <span className={styles.frMateriaId}>{m.id}</span>
                    <span className={styles.frMateriaNombre}>{m.nombre}</span>
                    <span className={styles.frMateriaCred}>{m.creditos} cr</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.profileBlock}>
            <h4 className={styles.blockTitle}>Progreso de carrera</h4>
            {!hasMalla ? (
              <p className={styles.blockMuted}>Todavía no tiene una malla guardada.</p>
            ) : (
              <>
                <div className={styles.progressLabelRow}>
                  <span>{progress.aprobadas} de {progress.total} materias</span>
                  <span>{progress.aprobCred} / {progress.totalCred} cr · {progress.pct}%</span>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${progress.pct}%` }} />
                </div>
              </>
            )}
          </div>
        </div>

        {}
        <div className={styles.comparadorCol}>
          <div className={styles.comparadorTabs}>
            <button
              className={`${styles.comparadorTab} ${modo === "horarios" ? styles.comparadorTabActive : ""}`}
              onClick={() => setModo("horarios")}>
              <IconSchedule size={13} /> Horarios
            </button>
            <button
              className={`${styles.comparadorTab} ${modo === "huecos" ? styles.comparadorTabActive : ""}`}
              onClick={() => setModo("huecos")}>
              <IconScale size={13} /> Huecos en común
            </button>
          </div>
          {modo === "horarios" ? (
            <ComparadorHorarios
              myHorario={myHorario}
              frHorario={frHorario}
              myMalla={myMalla}
              frMalla={frMalla}
              myName={myName}
              frName={nombre}
            />
          ) : (
            <ComparadorGrid myHorario={myHorario} frHorario={frHorario} />
          )}
        </div>
      </div>
    </section>
  );
}

export default function ColaboracionView({
  user, malla, horarioData, onNotify,
}) {
  const [users, setUsers] = useState(null);
  const [friendships, setFriendships] = useState({});
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [friendData, setFriendData] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [friendHorarios, setFriendHorarios] = useState({});
  const [dispLoading, setDispLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const reloadFriendships = useCallback(async () => {
    const res = await fetchFriendships(user.username);
    if (res.missingTable) {
      setTableMissing(true);
      setFriendships({});
      return;
    }
    if (res.error) {
      setLoadError(true);
      setFriendships({});
      return;
    }
    setLoadError(false);
    setTableMissing(false);
    setFriendships(res.data);
  }, [user.username]);

  useEffect(() => {
    let active = true;
    const loadFriendships = async () => {
      const friendshipsRes = await fetchFriendships(user.username);
      if (!active) return;
      if (friendshipsRes.missingTable) {
        setTableMissing(true);
        setFriendships({});
      } else if (friendshipsRes.error) {
        setLoadError(true);
        setFriendships({});
      } else {
        setLoadError(false);
        setTableMissing(false);
        setFriendships(friendshipsRes.data);
      }
      setLoading(false);
    };
    loadFriendships();
    fetchUsersBrief().then((res) => {
      if (active && !res.error) setUsers(res.data);
    }).catch(() => {});
    return () => { active = false; };
  }, [user.username]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearching(false);
      fetchUsersBrief().then((res) => {
        if (!res.error) setUsers(res.data);
      }).catch(() => {});
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await searchUsers(q);
      if (!active) return;
      setSearching(false);
      if (res.error) setLoadError(true);
      else setUsers(res.data);
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  const handleSend = async (u) => {
    const res = await sendFriendRequest(user.username, u);
    if (res.missingTable) return setTableMissing(true);
    if (res.error) return onNotify("No se pudo enviar la solicitud");
    onNotify(`Solicitud enviada a ${u}`);
    reloadFriendships();
  };

  const handleAccept = async (u) => {
    const res = await acceptFriendship(user.username, u);
    if (res.missingTable) return setTableMissing(true);
    if (res.error) return onNotify("No se pudo aceptar la solicitud");
    onNotify(`Ahora ${u} y tú son amigos`);
    reloadFriendships();
  };

  const handleRemove = async (u) => {
    const res = await removeFriendship(user.username, u);
    if (res.missingTable) return setTableMissing(true);
    if (res.error) return onNotify("No se pudo completar la acción");
    onNotify("Amistad eliminada");
    if (selectedUser === u) {
      setSelectedUser(null);
      setFriendData(null);
    }
    reloadFriendships();
  };

  const handleCompare = async (u) => {
    setSelectedUser(u);
    setFriendData(null);
    setComparing(true);
    const res = await fetchFriendData(u);
    setComparing(false);
    if (res.error) {
      onNotify(`No se pudo cargar el horario de ${u}`);
      setSelectedUser(null);
      return;
    }
    setFriendData(res.data);
  };

  const rel = (u) => friendships[u];
  const isIncoming = (u) => rel(u)?.status === "pendiente" && rel(u).requestedBy !== user.username;
  const isOutgoing = (u) => rel(u)?.status === "pendiente" && rel(u).requestedBy === user.username;
  const isFriend = (u) => rel(u)?.status === "aceptado";

  const userList = users || [];
  const amigos = userList.filter((u) => isFriend(u.username));
  const incoming = userList.filter((u) => isIncoming(u.username));
  const outgoing = userList.filter((u) => isOutgoing(u.username));

  const q = query.trim();
  const searchResults = q
    ? (users || []).filter((u) => u.username !== user.username)
    : [];

  const amigosKey = amigos.map((u) => u.username).join(",");

  useEffect(() => {
    if (!amigos.length) {
      setFriendHorarios({});
      setDispLoading(false);
      return;
    }
    let active = true;
    setDispLoading(true);
    Promise.all(
      amigos.map(async (u) => {
        const res = await fetchFriendData(u.username);
        if (res.error) return { u: u.username, horario: null };
        return { u: u.username, horario: res.data?.horario || null };
      })
    )
      .then((results) => {
        if (!active) return;
        const map = {};
        for (const r of results) {
          map[r.u] = r.horario
            ? { busy: buildBusyByDay(r.horario.clases || []), clases: r.horario.clases || [] }
            : { busy: {}, clases: [] };
        }
        setFriendHorarios(map);
        setDispLoading(false);
      })
      .catch(() => { if (active) setDispLoading(false); });
    return () => { active = false; };
  }, [amigosKey, amigos.length, user.username]);

  const selectedProfile = userList.find((u) => u.username === selectedUser);
  const selectedRel = selectedUser ? rel(selectedUser) : null;

  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.loading}><span className={styles.loadingIcon}><IconUsers size={28} /></span>Cargando contactos...</div>
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} view-fade`}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Amigos</h2>
          <p className={styles.subtitle}>Agrega amigos, compara horarios y busca huecos libres para estudiar juntos</p>
        </div>
        <div className={styles.headerBadge}>
          <IconUsers size={14} /> {amigos.length} amigo{amigos.length !== 1 ? "s" : ""}
        </div>
      </div>

      {tableMissing && (
        <div className={styles.migrationCard}>
          <div className={styles.migrationIcon}><IconWarning size={18} /></div>
          <div className={styles.migrationBody}>
            <h3 className={styles.migrationTitle}>Colaboración no disponible</h3>
            <p className={styles.migrationText}>
              Esta funcionalidad aún no está activada. Pronto estará disponible.
            </p>
          </div>
        </div>
      )}

      {loadError && !tableMissing && (
        <p className={styles.errorBanner}><IconWarning size={13} /> No se pudo conectar con la base de datos.</p>
      )}

      {!tableMissing && (<>
        {}
        <div className={styles.section}>
          <DisponiblesWidget amigos={amigos} horarios={friendHorarios} loading={dispLoading} />
        </div>

        {}
        <section className={styles.section}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>Buscar personas</h3>
            <span className={styles.sectionHint}>Agrega por nombre o usuario</span>
          </div>
          <div className={styles.searchRow}>
            <IconSearch size={15} />
            <input
              className={styles.searchInput}
              placeholder="Busca por nombre o usuario…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {query && searching && (
            <p className={styles.usersLoading}><span className={styles.loadingSpinner} /> Buscando usuarios…</p>
          )}

          {query && searchResults.length === 0 && (
            <p className={styles.searchEmpty}>Sin resultados para <strong>"{query}"</strong>.</p>
          )}

          {query && searchResults.length > 0 && (
            <div className={styles.personGrid}>
              {searchResults.map((u) => (
                <div key={u.username} className={styles.personCard}>
                  <Avatar u={u} />
                  <div className={styles.personInfo}>
                    <p className={styles.personName}>{u.name || u.username}</p>
                    <p className={styles.personUser}>@{u.username}</p>
                    <p className={styles.personMeta}>
                      {u.career || "—"}{u.semester ? ` · Sem. ${u.semester}` : ""}
                    </p>
                  </div>
                  <div className={styles.personActions}>
                    {isFriend(u.username) ? (
                      <span className={styles.tagFriend}><IconCheck size={11} /> Amigos</span>
                    ) : isIncoming(u.username) ? (
                      <>
                        <button className={styles.btnPrimary} onClick={() => handleAccept(u.username)}>
                          <IconCheck size={12} /> Aceptar
                        </button>
                        <button className={styles.btnGhost} onClick={() => handleRemove(u.username)}>
                          <IconClose size={12} /> Rechazar
                        </button>
                      </>
                    ) : isOutgoing(u.username) ? (
                      <span className={styles.tagPending}><IconSchedule size={11} /> Pendiente…</span>
                    ) : (
                      <button className={styles.btnPrimary} onClick={() => handleSend(u.username)}>
                        <IconUserPlus size={12} /> Agregar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!query && outgoing.length > 0 && (
            <p className={styles.outgoingNote}>
              <IconWarning size={12} /> {outgoing.length} solicitud{outgoing.length !== 1 ? "es" : ""} enviada{outgoing.length !== 1 ? "s" : ""} esperando respuesta.
            </p>
          )}
        </section>

        {}
        {incoming.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <h3 className={styles.sectionTitle}>Solicitudes pendientes</h3>
              <span className={styles.badgePill}>{incoming.length}</span>
            </div>
            <div className={styles.personGrid}>
              {incoming.map((u) => (
                <div key={u.username} className={styles.personCard}>
                  <Avatar u={u} />
                  <div className={styles.personInfo}>
                    <p className={styles.personName}>{u.name || u.username}</p>
                    <p className={styles.personUser}>@{u.username}</p>
                    <p className={styles.personMeta}>
                      {u.career || "—"}{u.semester ? ` · Sem. ${u.semester}` : ""}
                    </p>
                  </div>
                  <div className={styles.personActions}>
                    <button className={styles.btnPrimary} onClick={() => handleAccept(u.username)}>
                      <IconCheck size={12} /> Aceptar
                    </button>
                    <button className={styles.btnGhost} onClick={() => handleRemove(u.username)}>
                      <IconClose size={12} /> Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {}
        <section className={styles.section}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>Mis amigos</h3>
            <span className={styles.badgePill}>{amigos.length}</span>
          </div>

          {!users ? (
            <p className={styles.usersLoading}><span className={styles.loadingSpinner} /> Cargando lista de usuarios…</p>
          ) : amigos.length === 0 ? (
            <div className={styles.friendsEmpty}>
              <span className={styles.friendsEmptyIcon}><IconUsers size={30} /></span>
              <p>Aún no tienes amigos.</p>
              <p className={styles.friendsEmptySub}>
                Busca a alguien arriba y envíale una solicitud para comparar horarios.
              </p>
            </div>
          ) : (
            <div className={styles.personGrid}>
              {amigos.map((u) => (
                <div key={u.username} className={styles.personCard}>
                  <Avatar u={u} />
                  <div className={styles.personInfo}>
                    <p className={styles.personName}>{u.name || u.username}</p>
                    <p className={styles.personUser}>@{u.username}</p>
                    <p className={styles.personMeta}>
                      {u.career || "—"}{u.semester ? ` · Sem. ${u.semester}` : ""}
                    </p>
                  </div>
                  <div className={styles.personActions}>
                    <button className={styles.btnPrimary} onClick={() => handleCompare(u.username)}>
                      <IconSchedule size={12} /> Comparar
                    </button>
                    <button
                      className={styles.btnIconDanger}
                      title="Quitar amigo"
                      onClick={() => handleRemove(u.username)}
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {}
        {selectedUser && comparing && (
          <div className={styles.comparingCard}>
            <span className={styles.loadingSpinner} /> Cargando horario de {selectedUser}...
          </div>
        )}

        {selectedUser && !comparing && friendData && (
          <ComparisonSection
            me={selectedUser}
            perfil={selectedProfile}
            data={friendData}
            myHorario={horarioData}
            myMalla={malla}
            myName={user.name || user.username}
            onClose={() => { setSelectedUser(null); setFriendData(null); }}
          />
        )}

        {selectedUser && !comparing && !friendData && !selectedRel && (
          <p className={styles.errorBanner}><IconWarning size={13} /> No se pudo cargar la comparación.</p>
        )}
      </>)}
    </div>
  );
}
