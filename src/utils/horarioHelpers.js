export const ACCENT_COLORS = [
  "#B882E8","#6BA3E8","#E87098","#6EC8A8","#E8946B","#EECE7B",
  "#82B8E8","#E882B8","#82E8B8","#E8B882",
];

export function buildColorMap(materias) {
  const map = {};
  (materias || []).forEach((m, i) => {
    map[m.id] = ACCENT_COLORS[i % ACCENT_COLORS.length];
  });
  return map;
}

export const HORAS_FORM = [
  "06:00 a. m.","07:00 a. m.","08:00 a. m.","09:00 a. m.","10:00 a. m.","11:00 a. m.",
  "12:00 p. m.","01:00 p. m.","02:00 p. m.","03:00 p. m.","04:00 p. m.","05:00 p. m.",
  "06:00 p. m.","07:00 p. m.","08:00 p. m.","09:00 p. m.","10:00 p. m.",
];
export const LEGACY_HORAS = [
  "06:00","07:00","08:00","09:00","10:00","11:00",
  "12:00","1:00","2:00","3:00","4:00","5:00","6:00","7:00","8:00","9:00","10:00",
];

export function normalizeHora(hora) {
  if (!hora) return hora;
  if (HORAS_FORM.includes(hora)) return hora;
  const idx = LEGACY_HORAS.indexOf(hora);
  return idx >= 0 ? HORAS_FORM[idx] : hora;
}

export function toViewHora(hora) {
  const n = normalizeHora(hora);
  const idx = HORAS_FORM.indexOf(n);
  return idx >= 0 ? LEGACY_HORAS[idx] : hora;
}

export function horaIdx(h) {
  return HORAS_FORM.indexOf(normalizeHora(h));
}

export function findConflicts(clases, pending) {
  const conflicts = [];
  const pendientes = pending.filter((c) =>
    c && c.dia && horaIdx(c.horaInicio) >= 0 && horaIdx(c.horaFin) > horaIdx(c.horaInicio)
  );
  (clases || []).forEach((clase) => {
    const s1 = horaIdx(clase.horaInicio);
    const e1 = horaIdx(clase.horaFin);
    if (s1 < 0 || e1 <= s1) return;
    const chocaCon = pendientes.filter((c) => {
      const s2 = horaIdx(c.horaInicio);
      const e2 = horaIdx(c.horaFin);
      return c.dia === clase.dia && s2 >= 0 && e2 > s2 && s1 < e2 && s2 < e1;
    });
    if (chocaCon.length) {
      conflicts.push({ clase, chocaCon });
    }
  });
  return conflicts;
}

export function formatRangoHora(clase) {
  return `${toViewHora(clase.horaInicio)}–${toViewHora(clase.horaFin)}`;
}
