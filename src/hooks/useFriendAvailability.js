import { useEffect, useState } from "react";
import { fetchFriendData } from "../utils/friendsApi";
import { buildBusyByDay } from "../utils/scheduleCompare";

// Horario de cada amigo para saber quién está libre ahora. Lo usan tanto la
// vista de Amigos como la de Chats en el teléfono.
export default function useFriendAvailability(amigos) {
  const [horarios, setHorarios] = useState({});
  const [loading, setLoading] = useState(false);
  const key = amigos.map((u) => u.username).join("|");

  useEffect(() => {
    if (!amigos.length) {
      setHorarios({});
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
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
        setHorarios(map);
        setLoading(false);
      })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // solo se recarga cuando cambia la lista de amigos, no en cada render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { horarios, loading };
}
