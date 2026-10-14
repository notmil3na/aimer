import { CORTES } from "../App";
import { SEMESTER_CORTE } from "./semesterCountdown";

export const UNIVERSITIES = {
  "Universidad del Magdalena": ["Ingeniería de Sistemas", "Hotelería y Turismo", "Ingeniería Industrial", "Negocios Internacionales"],
};

export function autoSemester(ingresoCorte) {
  const idx = CORTES.indexOf(ingresoCorte);
  const cur = CORTES.indexOf(SEMESTER_CORTE);
  if (idx === -1 || cur === -1) return 1;
  return Math.max(1, cur - idx + 1);
}
