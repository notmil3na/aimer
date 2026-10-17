// Cortes académicos (semestres). Vive aparte para que Login y otros módulos
// no tengan que importar desde App.jsx (evita el import circular).

export function generateCortes(from = "2023-2", to = "2028-1") {
  const cortes = [];
  let [year, sem] = from.split("-").map(Number);
  const [toYear, toSem] = to.split("-").map(Number);
  while (year < toYear || (year === toYear && sem <= toSem)) {
    cortes.push(`${year}-${sem}`);
    if (sem === 1) sem = 2;
    else { sem = 1; year++; }
  }
  return cortes;
}

export const CORTES = generateCortes("2022-1", "2028-1");

export function corteForSemester(ingresoCorte, semNum) {
  const idx = CORTES.indexOf(ingresoCorte);
  if (idx === -1) return null;
  const target = idx + (semNum - 1);
  return CORTES[target] || null;
}
