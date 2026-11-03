import { CORTES, corteForSemester } from "../App.jsx";
import {
  MAX_GRADE,
  isEnglishLetterGrade,
  isValidNumericGrade,
} from "./gradeHelpers.js";

export function getObligatorias(malla) {
  return malla.flatMap((sem) =>
    typeof sem.semestre === "number" ? sem.materias : []
  );
}

export function buildSemestreMap(malla) {
  const map = new Map();
  malla.forEach((sem) => {
    if (typeof sem.semestre !== "number") return;
    sem.materias.forEach((m) => map.set(m.id, sem.semestre));
  });
  return map;
}

export function calcGlobalPond(malla, notas) {
  const semestreById = buildSemestreMap(malla);
  const allMaterias = malla.flatMap((s) => s.materias);
  let sumPond = 0, sumCred = 0;
  allMaterias.forEach((m) => {
    const n = notas[m.id];
    if (!n) return;
    const sem = semestreById.get(m.id);
    if (isEnglishLetterGrade(m, sem)) return;

    if (isValidNumericGrade(n.nota)) {
      sumPond += Number(n.nota) * m.creditos;
      sumCred += m.creditos;
    }

    (n.intentos || []).forEach((it) => {
      if (isValidNumericGrade(it.nota)) {
        sumPond += Number(it.nota) * m.creditos;
        sumCred += m.creditos;
      }
    });
  });
  if (sumCred === 0) return null;
  return { valor: sumPond / sumCred, creditos: sumCred, sumPond, sumCred };
}

export function simulateFailMateria(malla, notas, materiaId, opts = {}) {
  const failedGrade = opts.failedGrade !== undefined ? opts.failedGrade : 200;
  const retakeGrade = opts.retakeGrade !== undefined ? opts.retakeGrade : 400;
  const materia = malla.flatMap((s) => s.materias).find((m) => m.id === materiaId);
  if (!materia) return null;

  const current = calcGlobalPond(malla, notas);

  const currentRecord = notas[materiaId] || {};
  const simulated = { ...notas, [materiaId]: {
    ...currentRecord,
    nota: failedGrade,
    intentos: [
      ...(currentRecord.intentos || []),
      { nota: retakeGrade, semestre: "repetida (simulación)" },
    ],
  } };
  const after = calcGlobalPond(malla, simulated);

  const hasNota = isValidNumericGrade(currentRecord.nota);

  return {
    materia,
    currentAvg: current?.valor ?? null,
    newAvg: after?.valor ?? null,
    delta:
      current?.valor !== undefined && after?.valor !== undefined
        ? after.valor - current.valor
        : null,
    currentCred: current?.creditos ?? 0,
    newCred: after?.creditos ?? 0,
    hasNota,
    simulatedFailedGrade: failedGrade,
    simulatedRetakeGrade: retakeGrade,
    pesoMateria: materia.creditos,
  };
}

export function calcCareerTime(user, opts = {}) {
  const ingresoIdx = CORTES.indexOf(user.ingresoCorte || "");
  const currentCorte = opts.currentCorte || corteForSemester(user.ingresoCorte, Number(user.semester) || 1);
  const currentIdx = currentCorte ? CORTES.indexOf(currentCorte) : -1;

  if (ingresoIdx === -1 || currentIdx === -1) {
    return { semesters: 0, totalMonths: 0, years: 0, months: 0, currentCorte };
  }

  const semesters = currentIdx - ingresoIdx + 1;
  const totalMonths = semesters * 6;
  return {
    semesters,
    totalMonths,
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    currentCorte,
  };
}

export function estimateGraduation(malla, user) {
  const allMaterias = malla.flatMap((sem) =>
    sem.materias.map((materia) => ({ ...materia, semestrePlan: sem.semestre }))
  );
  const obligatorias = allMaterias.filter(
    (materia) => typeof materia.semestrePlan === "number" && !materia.optativa
  );
  const optativasElegidas = allMaterias.filter(
    (materia) => materia.optativa && (materia.estado === "aprobada" || materia.estado === "cursando")
  );
  const evaluables = [...obligatorias, ...optativasElegidas];
  const aprobadas = evaluables.filter((materia) => materia.estado === "aprobada");
  const cursando = evaluables.filter((materia) => materia.estado === "cursando");
  const faltantes = obligatorias.filter(
    (materia) => materia.estado !== "aprobada" && materia.estado !== "cursando"
  );

  const creditos = (materias) => materias.reduce((sum, materia) => sum + (Number(materia.creditos) || 0), 0);
  const totalCreditos = creditos(evaluables);
  const creditosAprobados = creditos(aprobadas);
  const creditosPendientes = creditos([...cursando, ...faltantes]);
  const creditsPlanObligatorias = creditos(obligatorias);
  const limiteCreditos = Math.max(
    ...[...new Set(obligatorias.map((materia) => materia.semestrePlan))]
      .map((semestre) => creditos(obligatorias.filter((materia) => materia.semestrePlan === semestre))),
    ...evaluables.map((materia) => Math.ceil(Number(materia.creditos) || 0)),
    1
  );

  if (creditosPendientes === 0) {
    return {
      totalCreditos,
      creditosAprobados,
      creditosPendientes: 0,
      ritmoCreditosPorSemestre: 0,
      semestresEstimados: 0,
      mesesEstimados: 0,
      anosEstimados: 0,
      mesesRestantes: 0,
      mensaje: "¡Carrera obligatoria completada según tu malla!",
    };
  }

  const completed = new Set(aprobadas.map((materia) => materia.id));
  let pending = faltantes.slice();
  let semestresEstimados = 0;
  let progresoPlanCreditos = creditos(
    aprobadas.filter((materia) => typeof materia.semestrePlan === "number")
  );
  const maxSimulatedSemesters = Math.max(40, pending.length + 1);

  const selectWithinCreditLimit = (candidates, limit) => {
    const capacity = Math.max(0, Math.floor(limit));
    const dp = Array.from({ length: capacity + 1 }, () => null);
    dp[0] = candidates.filter((materia) => (Number(materia.creditos) || 0) <= 0);
    const ordered = candidates.slice().sort((a, b) =>
      a.semestrePlan - b.semestrePlan ||
      (Number(a.creditos) || 0) - (Number(b.creditos) || 0) ||
      a.id.localeCompare(b.id)
    );

    ordered.forEach((materia) => {
      const credits = Math.ceil(Number(materia.creditos) || 0);
      if (credits <= 0 || credits > capacity) return;
      for (let used = capacity; used >= credits; used--) {
        const previous = dp[used - credits];
        if (previous && !dp[used]) dp[used] = [...previous, materia];
      }
    });

    for (let used = capacity; used > 0; used--) {
      if (dp[used]) return dp[used];
    }
    return dp[0] || [];
  };

  while (pending.length > 0 && semestresEstimados < maxSimulatedSemesters) {
    const esSemestreActual = semestresEstimados === 0;
    const currentCredits = esSemestreActual ? creditos(cursando) : 0;
    const limitAvailable = Math.max(0, limiteCreditos - currentCredits);
    const eligible = pending.filter((materia) => {
      const prereqsPassed = (materia.prereqs || []).every((id) => completed.has(id));
      const percentageReached = !materia.prereqsPct || creditsPlanObligatorias === 0 ||
        (progresoPlanCreditos / creditsPlanObligatorias) * 100 >= materia.prereqsPct;
      return prereqsPassed && percentageReached;
    });
    let selected = selectWithinCreditLimit(eligible, limitAvailable);

    semestresEstimados++;
    if (selected.length === 0 && (!esSemestreActual || cursando.length === 0)) {
      // Si una malla tiene prerrequisitos que ya no pueden satisfacerse, mantener
      // una estimación útil respetando el límite de créditos evita bloquearla.
      selected = selectWithinCreditLimit(pending, limitAvailable);
    }

    selected.forEach((materia) => {
      completed.add(materia.id);
      progresoPlanCreditos += Number(materia.creditos) || 0;
    });
    if (semestresEstimados === 1) {
      cursando.forEach((materia) => {
        completed.add(materia.id);
        if (typeof materia.semestrePlan === "number") {
          progresoPlanCreditos += Number(materia.creditos) || 0;
        }
      });
    }
    pending = pending.filter((materia) => !completed.has(materia.id));
  }

  if (pending.length > 0) {
    const semestresAdicionales = Math.ceil(creditos(pending) / limiteCreditos);
    semestresEstimados += Math.max(1, semestresAdicionales);
    const mesesEstimados = semestresEstimados * 6;
    return {
      totalCreditos,
      creditosAprobados,
      creditosPendientes,
      ritmoCreditosPorSemestre: creditosPendientes / semestresEstimados,
      semestresEstimados,
      mesesEstimados,
      anosEstimados: Math.floor(mesesEstimados / 12),
      mesesRestantes: mesesEstimados % 12,
      mensaje: null,
    };
  }

  if (semestresEstimados === 0 && cursando.length > 0) semestresEstimados = 1;
  const mesesEstimados = semestresEstimados * 6;
  const ritmoCreditosPorSemestre = semestresEstimados > 0
    ? creditosPendientes / semestresEstimados
    : 0;
  return {
    totalCreditos,
    creditosAprobados,
    creditosPendientes,
    ritmoCreditosPorSemestre,
    semestresEstimados,
    mesesEstimados,
    anosEstimados: Math.floor(mesesEstimados / 12),
    mesesRestantes: mesesEstimados % 12,
    mensaje: null,
  };
}

export function projectDesiredAverage(malla, notas, desiredAvg) {
  const target = Number(desiredAvg);
  if (!desiredAvg || isNaN(target) || target <= 0) return null;

  let sumPond = 0;
  let sumCred = 0;
  const pendingBySem = new Map();

  malla.forEach((sem) => {
    if (typeof sem.semestre !== "number") return;

    sem.materias.forEach((mat) => {
      if (isEnglishLetterGrade(mat, sem.semestre)) return;

      const n = notas[mat.id];
      let hasRecord = false;

      if (n && isValidNumericGrade(n.nota)) {
        sumPond += Number(n.nota) * mat.creditos;
        sumCred += mat.creditos;
        hasRecord = true;
      }

      (n?.intentos || []).forEach((it) => {
        if (isValidNumericGrade(it.nota)) {
          sumPond += Number(it.nota) * mat.creditos;
          sumCred += mat.creditos;
          hasRecord = true;
        }
      });

      if (!hasRecord) {
        if (!pendingBySem.has(sem.semestre)) pendingBySem.set(sem.semestre, []);
        pendingBySem.get(sem.semestre).push(mat);
      }
    });
  });

  const pendingMaterias = [...pendingBySem.values()].flat();
  const pendingCred = pendingMaterias.reduce((a, m) => a + m.creditos, 0);

  if (pendingCred === 0) {
    const currentAvg = sumCred > 0 ? sumPond / sumCred : null;
    return {
      currentAvg,
      pendingCred: 0,
      requiredUniform: null,
      feasible: true,
      pendingBySem,
      message: currentAvg !== null
        ? `Ya tienes nota en todas las materias numéricas. Promedio actual: ${currentAvg.toFixed(1)}`
        : "No hay materias pendientes de nota numérica.",
    };
  }

  const requiredUniform = (target * (sumCred + pendingCred) - sumPond) / pendingCred;
  const feasible = requiredUniform <= MAX_GRADE && requiredUniform >= 0;
  const currentAvg = sumCred > 0 ? sumPond / sumCred : null;

  return {
    currentAvg,
    pendingCred,
    requiredUniform,
    feasible,
    pendingBySem,
    message: !feasible
      ? requiredUniform > MAX_GRADE
        ? `Se necesitaría ${requiredUniform.toFixed(1)} de promedio en lo pendiente (máximo 500). Meta muy alta.`
        : "No se puede calcular una proyección válida con los datos actuales."
      : null,
  };
}
