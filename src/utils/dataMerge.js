/**
 * dataMerge.js
 * Utilidades para fusionar datos entre dispositivos (resolución de conflictos)
 * y reconciliar la cola offline con el estado más reciente del servidor.
 * Evita la pérdida de ítems (clases, eventos, asignaciones, notas) al fusionar por IDs.
 */

function mergeById(serverList = [], localList = [], idKey = "id") {
  const map = new Map();
  for (const item of (serverList || [])) {
    if (item && item[idKey]) map.set(item[idKey], { ...item });
  }
  for (const item of (localList || [])) {
    if (item && item[idKey]) {
      const prev = map.get(item[idKey]);
      map.set(item[idKey], prev ? { ...prev, ...item } : { ...item });
    }
  }
  return Array.from(map.values());
}

export function mergeHorario(server = {}, local = {}) {
  const sClases = server?.clases || [];
  const lClases = local?.clases || [];

  // Fusionar clases por id o clave materiaId-dia-horaInicio
  const map = new Map();
  const getKey = (c) => c.id || `${c.materiaId || ""}-${c.dia || ""}-${c.horaInicio || ""}`;

  for (const c of sClases) {
    if (c) map.set(getKey(c), { ...c });
  }
  for (const c of lClases) {
    if (c) {
      const k = getKey(c);
      const prev = map.get(k);
      map.set(k, prev ? { ...prev, ...c } : { ...c });
    }
  }

  // Días: unión ordenada de días
  const allDays = ["L", "M", "X", "J", "V", "S", "D"];
  const sDias = new Set(server?.dias || ["L", "M", "X", "J", "V"]);
  const lDias = new Set(local?.dias || []);
  const combinedDias = allDays.filter((d) => sDias.has(d) || lDias.has(d));

  return {
    dias: combinedDias.length > 0 ? combinedDias : ["L", "M", "X", "J", "V"],
    clases: Array.from(map.values()),
  };
}

export function mergeAsignaciones(server = {}, local = {}) {
  const sItems = server?.items || [];
  const lItems = local?.items || [];
  return {
    ...server,
    ...local,
    items: mergeById(sItems, lItems, "id"),
  };
}

export function mergeCalendario(server = {}, local = {}) {
  const sEventos = server?.eventos || [];
  const lEventos = local?.eventos || [];
  return {
    ...server,
    ...local,
    semestre: local?.semestre || server?.semestre || null,
    eventos: mergeById(sEventos, lEventos, "id"),
  };
}

export function mergeNotasClase(server = {}, local = {}) {
  const result = { ...(server || {}) };
  for (const [subjId, lNotes] of Object.entries(local || {})) {
    const sNotes = result[subjId] || [];
    result[subjId] = mergeById(sNotes, lNotes, "id");
  }
  return result;
}

export function mergeKeyedObject(server = {}, local = {}) {
  const result = { ...(server || {}) };
  for (const [key, val] of Object.entries(local || {})) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      result[key] = { ...(result[key] || {}), ...val };
    } else {
      result[key] = val;
    }
  }
  return result;
}

export function mergeMalla(serverMalla = [], localMalla = []) {
  if (!Array.isArray(serverMalla) || serverMalla.length === 0) return localMalla || [];
  if (!Array.isArray(localMalla) || localMalla.length === 0) return serverMalla || [];

  // Mapear estados locales por id de materia
  const localEstados = new Map();
  for (const sem of localMalla) {
    for (const m of sem?.materias || []) {
      if (m?.id && m?.estado) localEstados.set(m.id, m.estado);
    }
  }

  return serverMalla.map((sem) => ({
    ...sem,
    materias: (sem?.materias || []).map((m) => {
      const locEstado = localEstados.get(m.id);
      return locEstado ? { ...m, estado: locEstado } : m;
    }),
  }));
}

export function mergeAjustes(server = {}, local = {}) {
  const result = { ...(server || {}), ...(local || {}) };
  if (server?.push || local?.push) {
    const sSubs = server?.push?.subs || [];
    const lSubs = local?.push?.subs || [];
    const subsMap = new Map();
    for (const s of [...sSubs, ...lSubs]) {
      if (s?.endpoint) subsMap.set(s.endpoint, s);
    }

    const sKeys = new Set(server?.push?.sentKeys || []);
    for (const k of (local?.push?.sentKeys || [])) sKeys.add(k);

    result.push = {
      subs: Array.from(subsMap.values()),
      sentKeys: Array.from(sKeys),
    };
  }
  return result;
}

/**
 * Fusiona los datos de una columna específica.
 */
export function mergeColumnData(column, serverVal, localVal) {
  if (localVal === undefined || localVal === null) return serverVal;
  if (serverVal === undefined || serverVal === null) return localVal;

  switch (column) {
    case "horario":
      return mergeHorario(serverVal, localVal);
    case "asignaciones":
      return mergeAsignaciones(serverVal, localVal);
    case "calendario":
      return mergeCalendario(serverVal, localVal);
    case "notasclase":
      return mergeNotasClase(serverVal, localVal);
    case "cursando":
    case "notas":
    case "plan":
      return mergeKeyedObject(serverVal, localVal);
    case "malla":
      return mergeMalla(serverVal, localVal);
    case "ajustes":
      return mergeAjustes(serverVal, localVal);
    default:
      return typeof localVal === "object" && !Array.isArray(localVal)
        ? { ...serverVal, ...localVal }
        : localVal;
  }
}

/**
 * Fusiona un objeto completo de user_data del servidor con un conjunto de parches o pendientes locales.
 */
export function mergeUserData(serverData = {}, localData = {}) {
  if (!serverData && !localData) return null;
  if (!serverData) return localData;
  if (!localData) return serverData;

  const result = { ...serverData };
  const allColumns = [
    "malla",
    "notas",
    "cursando",
    "horario",
    "plan",
    "calendario",
    "asignaciones",
    "ajustes",
    "notasclase",
  ];

  for (const col of allColumns) {
    if (localData[col] !== undefined) {
      result[col] = mergeColumnData(col, serverData[col], localData[col]);
    }
  }

  // Conservar version y updated_at
  result.version = Math.max(Number(serverData.version || 1), Number(localData.version || 1));
  result.updated_at = localData.updated_at || serverData.updated_at || null;

  return result;
}
