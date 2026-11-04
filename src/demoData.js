import { MALLA_SISTEMAS } from "./data/malla.js";

export const DEMO_USER = {
  id: 0,
  username: "camila-demo",
  name: "Camila Torres",
  university: "Universidad del Magdalena",
  career: "Ingeniería de Sistemas",
  semester: 6,
  ingresoCorte: "2023-1",
  appMode: "light",
  appTheme: "ambar",
  hasPhoto: false,
  isAdmin: false,
};

const demoMalla = MALLA_SISTEMAS.map((sem) => ({
  ...sem,
  materias: sem.materias.map((materia) => ({
    ...materia,
    estado: sem.semestre < DEMO_USER.semester
      ? "aprobada"
      : sem.semestre === DEMO_USER.semester
        ? "cursando"
        : "faltante",
  })),
}));

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export const DEMO_USER_DATA = {
  version: 1,
  malla: demoMalla,
  notas: {},
  cursando: {},
  horario: {
    dias: ["L", "M", "X", "J", "V"],
    clases: [
      { materiaId: "EDA2", dia: "L", horaInicio: "07:00 a. m.", horaFin: "09:00 a. m.", edificio: "sierra_nevada", lado: "Norte", salon: "204", grupo: "01" },
      { materiaId: "BDA1", dia: "M", horaInicio: "09:00 a. m.", horaFin: "11:00 a. m.", edificio: "mar_caribe", lado: "Sur", salon: "301", grupo: "02" },
      { materiaId: "ISW1", dia: "X", horaInicio: "02:00 p. m.", horaFin: "04:00 p. m.", edificio: "edf_innovacion", salon: "Lab. Modelado y Simulación", grupo: "01" },
      { materiaId: "ANM1", dia: "J", horaInicio: "11:00 a. m.", horaFin: "01:00 p. m.", edificio: "cienaga_grande", lado: "Norte", salon: "202", grupo: "01" },
      { materiaId: "COM1", dia: "V", horaInicio: "07:00 a. m.", horaFin: "09:00 a. m.", edificio: "sierra_nevada", lado: "Sur", salon: "103", grupo: "03" },
    ],
  },
  plan: null,
  calendario: { eventos: [], semestre: null },
  asignaciones: {
    items: [
      { id: "demo-task-1", titulo: "Taller de árboles binarios", materiaId: "EDA2", tipo: "Taller", fechaEntrega: daysFromNow(2), completada: false },
      { id: "demo-task-2", titulo: "Modelo entidad-relación", materiaId: "BDA1", tipo: "Proyecto", fechaEntrega: daysFromNow(4), completada: false },
      { id: "demo-task-3", titulo: "Avance del proyecto", materiaId: "ISW1", tipo: "Entrega", fechaEntrega: daysFromNow(7), completada: false },
    ],
  },
  notasclase: {},
};

export const DEMO_FRIENDS = [
  { username: "valeria-demo", name: "Valeria Ríos", career: "Ingeniería de Sistemas", semester: 6, hasPhoto: false },
  { username: "mateo-demo", name: "Mateo Díaz", career: "Ingeniería de Sistemas", semester: 5, hasPhoto: false },
  { username: "lucia-demo", name: "Lucía Herrera", career: "Ingeniería Industrial", semester: 7, hasPhoto: false },
];

export function cloneDemoData(value) {
  return JSON.parse(JSON.stringify(value));
}
