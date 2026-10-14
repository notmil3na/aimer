import { HORAS_FORM, horaIdx, toViewHora } from "./horarioHelpers.js";

export const WINDOW_START = 0;
export const WINDOW_END   = HORAS_FORM.length;

export const DAY_ORDER = ["L", "M", "X", "J", "V", "S"];
export const DAY_LABELS = { L: "Lunes", M: "Martes", X: "Miércoles", J: "Jueves", V: "Viernes", S: "Sábado" };

export function formatHourIdx(idx) {
  const h = idx + 6;
  return `${h}:00`;
}

export function compactHour(hora) {
  const idx = horaIdx(hora);
  if (idx < 0) return toViewHora(hora) || "";
  const h = idx + 6;
  return `${h}:00`;
}

export function buildBusyByDay(clases) {
  const byDay = {};
  for (const c of clases || []) {
    if (!c || !c.dia) continue;
    const s = horaIdx(c.horaInicio);
    const e = horaIdx(c.horaFin);
    if (s < WINDOW_START || e > WINDOW_END || s >= e) continue;
    (byDay[c.dia] = byDay[c.dia] || []).push([s, e]);
  }
  for (const d in byDay) {
    byDay[d].sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [s, e] of byDay[d]) {
      const last = merged[merged.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    }
    byDay[d] = merged;
  }
  return byDay;
}

export function freeSlotsPerDay(busy) {
  const out = {};
  for (const d of DAY_ORDER) {
    const ints = busy[d] || [];
    const slots = [];
    let cursor = WINDOW_START;
    for (const [s, e] of ints) {
      if (s > cursor) slots.push([cursor, s]);
      cursor = Math.max(cursor, e);
    }
    if (cursor < WINDOW_END) slots.push([cursor, WINDOW_END]);
    out[d] = slots;
  }
  return out;
}

export function commonFreeSlots(myBusy, friendBusy, minDuracion = 1) {
  const aFree = freeSlotsPerDay(myBusy || {});
  const bFree = freeSlotsPerDay(friendBusy || {});
  const result = [];
  for (const d of DAY_ORDER) {
    const a = aFree[d] || [];
    const b = bFree[d] || [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      const s = Math.max(a[i][0], b[j][0]);
      const e = Math.min(a[i][1], b[j][1]);
      if (s < e && e - s >= minDuracion) {
        result.push({ dia: d, inicio: s, fin: e, duracion: e - s });
      }
      if (a[i][1] < b[j][1]) i++;
      else j++;
    }
  }
  result.sort(
    (x, y) =>
      y.duracion - x.duracion ||
      DAY_ORDER.indexOf(x.dia) - DAY_ORDER.indexOf(y.dia) ||
      x.inicio - y.inicio
  );
  return result;
}

function hourSetByDay(clases) {
  const out = {};
  for (const c of clases || []) {
    if (!c || !c.dia) continue;
    const s = horaIdx(c.horaInicio);
    const e = horaIdx(c.horaFin);
    if (s < WINDOW_START || e > WINDOW_END || s >= e) continue;
    (out[c.dia] = out[c.dia] || new Set());
    for (let h = s; h < e; h++) out[c.dia].add(h);
  }
  return out;
}

export function overlapHoursByDay(myClases, frClases) {
  const mine = hourSetByDay(myClases || []);
  const theirs = hourSetByDay(frClases || []);
  const out = {};
  for (const d of DAY_ORDER) {
    const a = mine[d], b = theirs[d];
    if (!a || !b) continue;
    const set = new Set();
    for (const h of a) if (b.has(h)) set.add(h);
    if (set.size) out[d] = set;
  }
  return out;
}

export function overlappingClasses(myClases, frClases) {
  const valid = (c) => c && c.dia && horaIdx(c.horaInicio) >= 0 && horaIdx(c.horaFin) > horaIdx(c.horaInicio);
  const mine = (myClases || []).filter(valid);
  const theirs = (frClases || []).filter(valid);
  const result = [];
  for (const a of mine) {
    for (const b of theirs) {
      if (a.dia !== b.dia) continue;
      const s1 = horaIdx(a.horaInicio), e1 = horaIdx(a.horaFin);
      const s2 = horaIdx(b.horaInicio), e2 = horaIdx(b.horaFin);
      if (!(s1 < e2 && s2 < e1)) continue;
      result.push({
        dia: a.dia,
        inicio: Math.max(s1, s2),
        fin: Math.min(e1, e2),
        duracion: Math.min(e1, e2) - Math.max(s1, s2),
        mismaMateria: !!a.materiaId && a.materiaId === b.materiaId,
        mismoSalon: !!a.salonLabel && a.salonLabel === b.salonLabel,
        miClase: a,
        frClase: b,
      });
    }
  }
  result.sort(
    (x, y) =>
      DAY_ORDER.indexOf(x.dia) - DAY_ORDER.indexOf(y.dia) ||
      x.inicio - y.inicio ||
      (x.mismaMateria === y.mismaMateria ? 0 : x.mismaMateria ? -1 : 1)
  );
  return result;
}

export function cellStatuses(myBusy, friendBusy) {
  const toSet = (intervals) => {
    const set = new Set();
    for (const [s, e] of intervals || []) {
      for (let h = s; h < e; h++) set.add(h);
    }
    return set;
  };
  const out = {};
  for (const d of DAY_ORDER) {
    const mine = toSet((myBusy || {})[d]);
    const theirs = toSet((friendBusy || {})[d]);
    const row = [];
    for (let h = WINDOW_START; h < WINDOW_END; h++) {
      const m = mine.has(h);
      const t = theirs.has(h);
      row.push(m && t ? "ambos" : m ? "yo" : t ? "amigo" : "libre");
    }
    out[d] = row;
  }
  return out;
}

export function unionDias(horarioA, horarioB) {
  const set = new Set();
  for (const h of [horarioA, horarioB]) {
    for (const d of h?.dias || []) set.add(d);
    for (const c of h?.clases || []) if (c?.dia) set.add(c.dia);
  }
  return DAY_ORDER.filter((d) => set.has(d));
}

export function cursandoMaterias(malla) {
  return (malla || []).flatMap((s) => s.materias || []).filter((m) => m.estado === "cursando");
}

export function commonSubjects(myMalla, friendMalla) {
  const mine = new Set(cursandoMaterias(myMalla).map((m) => m.id));
  return cursandoMaterias(friendMalla).filter((m) => mine.has(m.id));
}

export function progressFromMalla(malla) {
  const materias = (malla || [])
    .filter((s) => typeof s.semestre === "number")
    .flatMap((s) => s.materias || []);
  const aprobadas = materias.filter((m) => m.estado === "aprobada");
  const totalCred = materias.reduce((a, m) => a + (m.creditos || 0), 0);
  const aprobCred = aprobadas.reduce((a, m) => a + (m.creditos || 0), 0);
  return {
    total: materias.length,
    aprobadas: aprobadas.length,
    totalCred,
    aprobCred,
    pct: totalCred ? Math.round((aprobCred / totalCred) * 100) : 0,
  };
}
