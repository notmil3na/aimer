// Plan de estudios 2022-1 de Ingeniería de Sistemas (Universidad del Magdalena).
// Es el plan que le corresponde a quienes ingresaron en ese corte: se muestra
// por defecto y se edita como cualquier malla. Para el resto del programa la app
// sigue usando el plan actual (src/data/malla.js).

import { MALLA_SISTEMAS } from "./malla.js";

export const PLAN_2022 = {
  label: "Plan 2022-1",
  carrera: "Ingeniería de Sistemas",
  corte: "2022-1",
};

export function aplicaPlan2022(user) {
  return !!user && user.career === PLAN_2022.carrera && user.ingresoCorte === PLAN_2022.corte;
}

export const MALLA_SISTEMAS_2022 = [
  {
    semestre: 1,
    materias: [
      { id: "011401", codigo: "011401", nombre: "Cálculo Diferencial",                    creditos: 4, estado: "faltante", prereqs: [] },
      { id: "011440", codigo: "011440", nombre: "Formación Humanística y Ciudadana",      creditos: 2, estado: "faltante", prereqs: [] },
      { id: "011415", codigo: "011415", nombre: "Introducción a la Ingeniería de Sistemas", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "011412", codigo: "011412", nombre: "Matemáticas Discretas",                  creditos: 4, estado: "faltante", prereqs: [] },
      { id: "011438", codigo: "011438", nombre: "Procesos Lectores y Escriturales",       creditos: 2, estado: "faltante", prereqs: [] },
      { id: "011439", codigo: "011439", nombre: "Razonamiento y Representación Matemática", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "011437", codigo: "011437", nombre: "Vida Universitaria",                     creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
  {
    semestre: 2,
    materias: [
      { id: "011403", codigo: "011403", nombre: "Álgebra Lineal",                         creditos: 3, estado: "faltante", prereqs: ["011439"] },
      { id: "011416", codigo: "011416", nombre: "Algoritmos y Programación",              creditos: 4, estado: "faltante", prereqs: ["011412"] },
      { id: "011402", codigo: "011402", nombre: "Cálculo Integral",                       creditos: 4, estado: "faltante", prereqs: ["011401"] },
      { id: "OPTL0474", codigo: "OPTL0474", nombre: "Creando Bienestar",                  creditos: 0, estado: "faltante", prereqs: [] },
      { id: "011409", codigo: "011409", nombre: "Estadística I",                          creditos: 3, estado: "faltante", prereqs: ["011401"] },
      { id: "011441", codigo: "011441", nombre: "Expresión Oral y Argumentación",         creditos: 2, estado: "faltante", prereqs: ["011438"] },
      { id: "011443", codigo: "011443", nombre: "Teoría y Filosofía del Conocimiento",    creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
  {
    semestre: 3,
    materias: [
      { id: "011404", codigo: "011404", nombre: "Cálculo Vectorial",                      creditos: 4, estado: "faltante", prereqs: ["011402", "011403"] },
      { id: "011417", codigo: "011417", nombre: "Estructura de Datos I",                  creditos: 4, estado: "faltante", prereqs: ["011416"] },
      { id: "011406", codigo: "011406", nombre: "Mecánica",                               creditos: 4, estado: "faltante", prereqs: ["011401"] },
      { id: "011427", codigo: "011427", nombre: "Pensamiento de Sistemas",                creditos: 2, estado: "faltante", prereqs: [] },
      { id: "011424", codigo: "011424", nombre: "Sistemas Digitales",                     creditos: 4, estado: "faltante", prereqs: ["011412"] },
    ],
  },
  {
    semestre: 4,
    materias: [
      { id: "011425", codigo: "011425", nombre: "Arquitectura de Computadores",           creditos: 3, estado: "faltante", prereqs: ["011424"] },
      { id: "011408", codigo: "011408", nombre: "Calor y Ondas",                          creditos: 4, estado: "faltante", prereqs: ["011406"] },
      { id: "011405", codigo: "011405", nombre: "Ecuaciones Diferenciales",               creditos: 3, estado: "faltante", prereqs: ["011404"] },
      { id: "011410", codigo: "011410", nombre: "Estadística II",                         creditos: 3, estado: "faltante", prereqs: ["011409"] },
      { id: "011419", codigo: "011419", nombre: "Estructura de Datos II",                 creditos: 4, estado: "faltante", prereqs: ["011417"] },
      { id: "011445", codigo: "011445", nombre: "Seminario I",                            creditos: 2, estado: "faltante", prereqs: ["011443"] },
    ],
  },
  {
    semestre: 5,
    materias: [
      { id: "011422", codigo: "011422", nombre: "Bases de Datos",                         creditos: 4, estado: "faltante", prereqs: ["011419"] },
      { id: "011421", codigo: "011421", nombre: "Compiladores",                           creditos: 4, estado: "faltante", prereqs: ["011419"] },
      { id: "011431", codigo: "011431", nombre: "Diseño Organizacional TI",               creditos: 4, estado: "faltante", prereqs: ["011427"] },
      { id: "011407", codigo: "011407", nombre: "Electricidad y Magnetismo",              creditos: 4, estado: "faltante", prereqs: ["011408"] },
      { id: "011436", codigo: "011436", nombre: "Ética Profesional",                      creditos: 2, estado: "faltante", prereqs: [], prereqsPct: 40 },
    ],
  },
  {
    semestre: 6,
    materias: [
      { id: "011414", codigo: "011414", nombre: "Análisis Numérico",                      creditos: 3, estado: "faltante", prereqs: ["011405"] },
      { id: "011429", codigo: "011429", nombre: "Ingeniería del Software",                creditos: 4, estado: "faltante", prereqs: ["011422", "011431"] },
      { id: "011434", codigo: "011434", nombre: "Ingeniería Económica",                   creditos: 3, estado: "faltante", prereqs: ["011410"] },
      { id: "011413", codigo: "011413", nombre: "Matemáticas Especiales",                 creditos: 3, estado: "faltante", prereqs: ["011405"] },
      { id: "011418", codigo: "011418", nombre: "Programación Orientada a Objetos",       creditos: 4, estado: "faltante", prereqs: ["011422"] },
    ],
  },
  {
    semestre: 7,
    materias: [
      { id: "011430", codigo: "011430", nombre: "Arquitectura de Software",               creditos: 4, estado: "faltante", prereqs: ["011429"] },
      { id: "011435", codigo: "011435", nombre: "Gestión de Proyectos",                   creditos: 3, estado: "faltante", prereqs: ["011434"] },
      { id: "011444", codigo: "011444", nombre: "Metodología de la Investigación",        creditos: 2, estado: "faltante", prereqs: ["011445"] },
      { id: "011420", codigo: "011420", nombre: "Programación para Web",                  creditos: 4, estado: "faltante", prereqs: ["011418"] },
      { id: "011426", codigo: "011426", nombre: "Sistemas Operativos",                    creditos: 4, estado: "faltante", prereqs: ["011425", "011419"] },
    ],
  },
  {
    semestre: 8,
    materias: [
      { id: "011423", codigo: "011423", nombre: "Inteligencia Artificial",                creditos: 4, estado: "faltante", prereqs: ["011410", "011421"] },
      { id: "011411", codigo: "011411", nombre: "Investigación de Operaciones",           creditos: 3, estado: "faltante", prereqs: ["011403", "011410"] },
      { id: "011432", codigo: "011432", nombre: "Legislación Informática",                creditos: 2, estado: "faltante", prereqs: ["011436"] },
      { id: "011446", codigo: "011446", nombre: "Seminario II",                           creditos: 2, estado: "faltante", prereqs: ["011444"] },
    ],
  },
  {
    semestre: 9,
    materias: [
      { id: "011442", codigo: "011442", nombre: "Cátedra del Caribe",                     creditos: 2, estado: "faltante", prereqs: [], prereqsPct: 70 },
      { id: "011428", codigo: "011428", nombre: "Dinámica de Sistemas",                   creditos: 4, estado: "faltante", prereqs: ["011427", "011405"] },
      { id: "011433", codigo: "011433", nombre: "Redes",                                  creditos: 4, estado: "faltante", prereqs: ["011426"] },
      { id: "011447", codigo: "011447", nombre: "Seminario III",                          creditos: 2, estado: "faltante", prereqs: ["011446"] },
    ],
  },
  {
    semestre: "opt",
    label: "Optativos",
    materias: [
      { id: "OPT_0001", codigo: "OPT_0001", nombre: "Análisis Automático de Imágenes",           creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0004", codigo: "OPT_0004", nombre: "Análisis, Modelado y Visualización de Datos", creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0010", codigo: "OPT_0010", nombre: "Bases de Datos No Relacionales",             creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0011", codigo: "OPT_0011", nombre: "Bodegas de Datos",                           creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0008", codigo: "OPT_0008", nombre: "DevOps",                                     creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0006", codigo: "OPT_0006", nombre: "Diseño de Interfaces",                       creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0005", codigo: "OPT_0005", nombre: "Gobierno de TI",                             creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0007", codigo: "OPT_0007", nombre: "Hacking Ético",                              creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0015", codigo: "OPT_0015", nombre: "Innovación Empresarial",                     creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0012", codigo: "OPT_0012", nombre: "Microprocesamiento",                         creditos: 3, estado: "faltante", prereqs: ["011425"], optativa: true },
      { id: "OPT_0009", codigo: "OPT_0009", nombre: "Microservicios",                             creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0014", codigo: "OPT_0014", nombre: "MLOps",                                      creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0003", codigo: "OPT_0003", nombre: "Modelado y Simulación",                      creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0002", codigo: "OPT_0002", nombre: "Procesamiento de Imágenes Médicas",          creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0013", codigo: "OPT_0013", nombre: "Sistema de Información Geográfica",          creditos: 3, estado: "faltante", prereqs: [], optativa: true },
    ],
  },
];

// Materias equivalentes entre el plan 2022-1 y el plan actual (el orden del par
// da igual). Sirven para llevar el avance de un plan al otro por nombre.
const PARES_EQUIVALENTES = [
  ["MECANICA", "FISICA MECANICA"],
  ["ESTADISTICA I", "PROBABILIDAD Y ESTADISTICA"],
  ["ESTADISTICA II", "ESTADISTICA INFERENCIAL"],
  ["ETICA PROFESIONAL", "ETICA EN INGENIERIA DE SISTEMAS"],
  ["MATEMATICAS ESPECIALES", "MATEMATICAS AVANZADAS"],
  ["INVESTIGACION DE OPERACIONES", "INVESTIGACION DE OPERACIONES DETERMINISTICAS"],
  ["DISENO ORGANIZACIONAL TI", "DISENO ORGANIZACIONAL DE TI"],
  ["INGENIERIA DEL SOFTWARE", "INGENIERIA DE SOFTWARE"],
];

export function normalizarNombre(nombre) {
  return String(nombre || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const GRUPOS = new Map();
PARES_EQUIVALENTES.forEach(([a, b], i) => {
  GRUPOS.set(normalizarNombre(a), `equivalente-${i}`);
  GRUPOS.set(normalizarNombre(b), `equivalente-${i}`);
});

// Clave con la que se empareja una materia entre planes: su nombre normalizado,
// o el grupo si es una equivalencia conocida.
export function claveEstado(nombre) {
  const normalizado = normalizarNombre(nombre);
  return GRUPOS.get(normalizado) || normalizado;
}

// --- Traducción de los datos guardados con los ids del plan actual ---
// Quien ingresó en 2022-1 usó hasta ahora el plan actual, así que sus notas,
// materias cursando, horario y asignaciones están guardados con esos ids. Al
// pasar al plan 2022-1 se traducen por materia equivalente para no perderlos.

const NOMBRE_POR_ID_ACTUAL = new Map(
  MALLA_SISTEMAS.flatMap((s) => s.materias).map((m) => [m.id, m.nombre])
);
const ID_2022_POR_CLAVE = new Map(
  MALLA_SISTEMAS_2022.flatMap((s) => s.materias).map((m) => [claveEstado(m.nombre), m.id])
);

// id del plan actual -> id del plan 2022-1, para la misma materia. Un id que ya
// es del plan 2022-1 (o se desconoce) se devuelve igual.
export function idEnPlan2022(id) {
  const nombre = NOMBRE_POR_ID_ACTUAL.get(String(id));
  if (!nombre) return id;
  return ID_2022_POR_CLAVE.get(claveEstado(nombre)) || id;
}

// Columnas guardadas como mapa id de materia -> datos.
const COLUMNAS_POR_MATERIA = ["notas", "cursando", "notasclase"];

function traducirCamposMateria(valor) {
  if (Array.isArray(valor)) return valor.map(traducirCamposMateria);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [
      k,
      k === "materiaId" && typeof v === "string" ? idEnPlan2022(v) : traducirCamposMateria(v),
    ]));
  }
  return valor;
}

// Copia los datos guardados con los ids de materia traducidos al plan 2022-1.
export function traducirDatosGuardados(datos) {
  if (!datos || typeof datos !== "object") return datos;
  const out = { ...datos };
  COLUMNAS_POR_MATERIA.forEach((col) => {
    const valor = out[col];
    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
      out[col] = Object.fromEntries(
        Object.entries(valor).map(([k, v]) => [idEnPlan2022(k), v])
      );
    }
  });
  ["horario", "plan", "calendario", "asignaciones"].forEach((col) => {
    if (out[col]) out[col] = traducirCamposMateria(out[col]);
  });
  return out;
}

// Copia un plan con los estados que hay en otra malla, emparejando por nombre
// (con equivalencias). Sirve en los dos sentidos (2022-1 -> actual y al revés).
// Lo que no tiene equivalente se queda como está. No modifica el plan original.
export function aplicarAvance(plan, mallaOrigen) {
  const estados = new Map();
  (mallaOrigen || []).forEach((sem) => {
    (sem.materias || []).forEach((m) => {
      estados.set(claveEstado(m.nombre), m.estado || "faltante");
    });
  });

  return plan.map((sem) => ({
    ...sem,
    materias: sem.materias.map((m) => {
      const estado = estados.get(claveEstado(m.nombre));
      return estado ? { ...m, estado } : { ...m };
    }),
  }));
}
