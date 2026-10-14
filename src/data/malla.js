export const MALLA_SISTEMAS = [
  {
    semestre: 1,
    materias: [
      { id: "ALG1", codigo: "01011403", nombre: "Algoritmos y Programación",               creditos: 4, estado: "faltante", prereqs: [] },
      { id: "CAL1", codigo: "01011401", nombre: "Cálculo Diferencial",                     creditos: 4, estado: "faltante", prereqs: [] },
      { id: "ENG1", codigo: "01011406", nombre: "General English I",                       creditos: 2, estado: "faltante", prereqs: [] },
      { id: "IIS1", codigo: "01011404", nombre: "Introducción a la Ingeniería de Sistemas", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "MAD1", codigo: "01011402", nombre: "Matemáticas Discretas",                   creditos: 4, estado: "faltante", prereqs: [] },
      { id: "PLE1", codigo: "01011405", nombre: "Procesos Lectores y Escriturales",        creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
  {
    semestre: 2,
    materias: [
      { id: "ALI1", codigo: "02011408", nombre: "Álgebra Lineal",                          creditos: 3, estado: "faltante", prereqs: [] },
      { id: "CAL2", codigo: "02011407", nombre: "Cálculo Integral",                        creditos: 4, estado: "faltante", prereqs: ["CAL1"] },
      { id: "EDA1", codigo: "02011409", nombre: "Estructura de Datos I",                   creditos: 4, estado: "faltante", prereqs: ["ALG1"] },
      { id: "ENG2", codigo: "02011411", nombre: "General English II",                      creditos: 2, estado: "faltante", prereqs: ["ENG1"] },
      { id: "POO1", codigo: "02011410", nombre: "Programación Orientada a Objetos",        creditos: 4, estado: "faltante", prereqs: ["ALG1"] },
    ],
  },
  {
    semestre: 3,
    materias: [
      { id: "CAV1", codigo: "03011412", nombre: "Cálculo Vectorial",                        creditos: 4, estado: "faltante", prereqs: ["CAL2", "ALI1"] },
      { id: "EDA2", codigo: "03011415", nombre: "Estructura de Datos II",                  creditos: 4, estado: "faltante", prereqs: ["EDA1"] },
      { id: "EOA1", codigo: "03011416", nombre: "Expresión Oral y Argumentación",          creditos: 2, estado: "faltante", prereqs: ["PLE1"] },
      { id: "ENG3", codigo: "03011417", nombre: "General English III",                     creditos: 2, estado: "faltante", prereqs: ["ENG2"] },
      { id: "PES1", codigo: "03011414", nombre: "Pensamiento de Sistemas",                 creditos: 2, estado: "faltante", prereqs: [] },
      { id: "PRE1", codigo: "03011413", nombre: "Probabilidad y Estadística",              creditos: 3, estado: "faltante", prereqs: ["CAL2"] },
    ],
  },
  {
    semestre: 4,
    materias: [
      { id: "BDA1", codigo: "04011420", nombre: "Bases de Datos",                            creditos: 4, estado: "faltante", prereqs: ["EDA2"] },
      { id: "EDI1", codigo: "04011418", nombre: "Ecuaciones Diferenciales",                  creditos: 3, estado: "faltante", prereqs: ["CAL2"] },
      { id: "EST2", codigo: "04011419", nombre: "Estadística Inferencial",                   creditos: 3, estado: "faltante", prereqs: ["PRE1"] },
      { id: "FHC1", codigo: "04011422", nombre: "Formación Humanística y Ciudadana",       creditos: 2, estado: "faltante", prereqs: [] },
      { id: "ENG4", codigo: "04011423", nombre: "General English IV",                      creditos: 2, estado: "faltante", prereqs: ["ENG3"] },
      { id: "SID1", codigo: "04011421", nombre: "Sistemas Digitales",                      creditos: 4, estado: "faltante", prereqs: ["MAD1"] },
    ],
  },
  {
    semestre: 5,
    materias: [
      { id: "ANM1", codigo: "06011430", nombre: "Análisis Numérico",                           creditos: 3, estado: "faltante", prereqs: ["EDI1"] },
      { id: "ARC1", codigo: "05011429", nombre: "Arquitectura de Computadores",                creditos: 3, estado: "faltante", prereqs: [] },
      { id: "ENG5", codigo: "05011431", nombre: "General English V",                           creditos: 2, estado: "faltante", prereqs: ["ENG4"] },
      { id: "IOD1", codigo: "05011425", nombre: "Investigación de Operaciones Determinísticas", creditos: 3, estado: "faltante", prereqs: ["ALI1"] },
      { id: "MAV1", codigo: "07011435", nombre: "Matemáticas Avanzadas",                       creditos: 3, estado: "faltante", prereqs: ["EDI1"] },
      { id: "PWB1", codigo: "05011427", nombre: "Programación para Web",                        creditos: 4, estado: "faltante", prereqs: ["POO1", "BDA1"] },
    ],
  },
  {
    semestre: 6,
    materias: [
      { id: "COM1", codigo: "06011433", nombre: "Compiladores",                             creditos: 4, estado: "faltante", prereqs: ["EDA2"] },
      { id: "FIM1", codigo: "07011436", nombre: "Física Mecánica",                          creditos: 4, estado: "faltante", prereqs: ["CAL1"] },
      { id: "ISW1", codigo: "06011432", nombre: "Ingeniería de Software",                   creditos: 4, estado: "faltante", prereqs: ["PWB1"] },
      { id: "IEC1", codigo: "06011450", nombre: "Ingeniería Económica",                     creditos: 3, estado: "faltante", prereqs: ["EST2"] },
      { id: "PDP1", codigo: "06011434", nombre: "Proyecto de Diseño y Prototipado",         creditos: 2, estado: "faltante", prereqs: ["PWB1"] },
    ],
  },
  {
    semestre: 7,
    materias: [
      { id: "ASW1", codigo: "07011438", nombre: "Arquitectura de Software",                 creditos: 4, estado: "faltante", prereqs: ["ISW1"] },
      { id: "CYO1", codigo: "08011440", nombre: "Calor y Ondas",                            creditos: 4, estado: "faltante", prereqs: ["FIM1"] },
      { id: "DOT1", codigo: "07011437", nombre: "Diseño Organizacional de TI",              creditos: 4, estado: "faltante", prereqs: ["PES1"] },
      { id: "LEG1", codigo: "09011448", nombre: "Legislación Informática",                  creditos: 2, estado: "faltante", prereqs: [] },
      { id: "SIS1", codigo: "08011442", nombre: "Sistemas Operativos",                      creditos: 4, estado: "faltante", prereqs: ["ARC1", "COM1"] },
    ],
  },
  {
    semestre: 8,
    materias: [
      { id: "EPR1", codigo: "08011466", nombre: "Electiva de Profundización I",             creditos: 3, estado: "faltante", prereqs: [] },
      { id: "EYM1", codigo: "08011441", nombre: "Electricidad y Magnetismo",                creditos: 4, estado: "faltante", prereqs: ["CYO1"] },
      { id: "ETI1", codigo: "09011446", nombre: "Ética en Ingeniería de Sistemas",          creditos: 2, estado: "faltante", prereqs: [] },
      { id: "GPR1", codigo: "09011447", nombre: "Gestión de Proyectos",                     creditos: 3, estado: "faltante", prereqs: ["IEC1"] },
      { id: "IAR1", codigo: "06011431", nombre: "Inteligencia Artificial",                  creditos: 4, estado: "faltante", prereqs: ["EST2", "ANM1", "COM1"] },
    ],
  },
  {
    semestre: 9,
    materias: [
      { id: "DIS1", codigo: "09011444", nombre: "Dinámica de Sistemas",                     creditos: 4, estado: "faltante", prereqs: ["PES1", "EDI1"] },
      { id: "EPR2", codigo: "09011467", nombre: "Electiva de Profundización II",            creditos: 3, estado: "faltante", prereqs: [] },
      { id: "EPR3", codigo: "09011469", nombre: "Electiva de Profundización III",           creditos: 3, estado: "faltante", prereqs: [] },
      { id: "EFD1", codigo: "09011462", nombre: "Experiencia Final de Diseño en Ingeniería", creditos: 4, estado: "faltante", prereqs: ["PDP1", "ASW1", "IAR1"] },
      { id: "RED1", codigo: "09011445", nombre: "Redes",                                    creditos: 4, estado: "faltante", prereqs: ["SIS1"] },
    ],
  },
  {
    semestre: 10,
    materias: [
      { id: "EPR4", codigo: "09011468", nombre: "Electiva de Profundización IV",            creditos: 3, estado: "faltante", prereqs: [] },
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
      { id: "OPT_0012", codigo: "OPT_0012", nombre: "Microprocesamiento",                         creditos: 3, estado: "faltante", prereqs: ["ARC1"], optativa: true },
      { id: "OPT_0009", codigo: "OPT_0009", nombre: "Microservicios",                             creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0014", codigo: "OPT_0014", nombre: "MLOps",                                      creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0003", codigo: "OPT_0003", nombre: "Modelado y Simulación",                      creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0002", codigo: "OPT_0002", nombre: "Procesamiento de Imágenes Médicas",          creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0013", codigo: "OPT_0013", nombre: "Sistema de Información Geográfica",          creditos: 3, estado: "faltante", prereqs: [], optativa: true },
    ],
  },
];

export const MALLA_HOTELERIA_TURISMO = [
  {
    semestre: 1,
    materias: [
      { id: "BTA1", nombre: "Bebidas Tradicionales, Ancestrales y Artesanales", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "RRM1", nombre: "Razonamiento y Representación Matemática", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "PLE1", nombre: "Procesos Lectores y Escriturales", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "CCA1", nombre: "Cátedra del Caribe", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "LET1", nombre: "Legislación Turística", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "IAT1", nombre: "Introducción a la Actividad Turística y Hotelera", creditos: 3, estado: "faltante", prereqs: [] },
      { id: "EPR1", nombre: "Etiqueta, Protocolo y Relaciones Públicas", creditos: 3, estado: "faltante", prereqs: [] },
      { id: "ENG1", nombre: "General English I", creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
  {
    semestre: 2,
    materias: [
      { id: "EOA1", nombre: "Expresión Oral y Argumentación", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "CGF1", nombre: "Contabilidad General y Financiera", creditos: 3, estado: "faltante", prereqs: [] },
      { id: "EST1", nombre: "Estadística I", creditos: 3, estado: "faltante", prereqs: [] },
      { id: "HYP1", nombre: "Historia y Patrimonio", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "AVT1", nombre: "Agencias de Viajes y Transporte Turístico", creditos: 2, estado: "faltante", prereqs: ["IAT1"] },
      { id: "ENG2", nombre: "General English II", creditos: 2, estado: "faltante", prereqs: ["ENG1"] },
      { id: "TOA1", nombre: "Teoría de las Organizaciones y de la Administración", creditos: 4, estado: "faltante", prereqs: [] },
    ],
  },
  {
    semestre: 3,
    materias: [
      { id: "ECE1", nombre: "Emprendimiento y Creación de Empresas", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "GSR1", nombre: "Gestión de Servicios de Alojamiento y Reservas", creditos: 2, estado: "faltante", prereqs: ["IAT1"] },
      { id: "CCH1", nombre: "Contabilidad y Costos Hoteleros", creditos: 3, estado: "faltante", prereqs: ["CGF1"] },
      { id: "GTN1", nombre: "Geografía Turística Nacional e Internacional", creditos: 2, estado: "faltante", prereqs: ["IAT1"] },
      { id: "GAS1", nombre: "Gastronomía I: Gestión de la Inocuidad", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "ENG3", nombre: "General English III", creditos: 2, estado: "faltante", prereqs: ["ENG2"] },
      { id: "FDE1", nombre: "Fundamentos de Economía", creditos: 3, estado: "faltante", prereqs: [] },
      { id: "ELP1", nombre: "Electiva de Profundización I", creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
  {
    semestre: 4,
    materias: [
      { id: "CHC1", nombre: "Cátedra Humanística y Ciudadana", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "GHC1", nombre: "Gestión Hotelera en Clínicas y Hospitales", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "SCH1", nombre: "Sistemas de Control Hotelero", creditos: 2, estado: "faltante", prereqs: ["GSR1"] },
      { id: "LGE1", nombre: "Logística y Gestión de Eventos", creditos: 2, estado: "faltante", prereqs: ["EPR1"] },
      { id: "GAS2", nombre: "Gastronomía II: Cocina Colombiana y Gastronomía Internacional", creditos: 4, estado: "faltante", prereqs: ["GAS1"] },
      { id: "ENG4", nombre: "General English IV", creditos: 2, estado: "faltante", prereqs: ["ENG3"] },
      { id: "OYD1", nombre: "Organización y Dirección", creditos: 4, estado: "faltante", prereqs: ["TOA1"] },
    ],
  },
  {
    semestre: 5,
    materias: [
      { id: "FIN1", nombre: "Fundamentos de Investigación", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "SGD1", nombre: "Sistemas Globales de Distribución", creditos: 2, estado: "faltante", prereqs: ["SCH1"] },
      { id: "ETA1", nombre: "Ecoturismo y Turismo Alternativo", creditos: 3, estado: "faltante", prereqs: ["GTN1"] },
      { id: "GAS3", nombre: "Gastronomía III: Gestión Financiera de la Restauración", creditos: 2, estado: "faltante", prereqs: ["GAS2"] },
      { id: "ENG5", nombre: "General English V", creditos: 2, estado: "faltante", prereqs: ["ENG4"] },
      { id: "MFI1", nombre: "Matemáticas Financieras", creditos: 3, estado: "faltante", prereqs: [] },
      { id: "ELP2", nombre: "Electiva de Profundización II", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "MKT1", nombre: "Marketing Turístico", creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
  {
    semestre: 6,
    materias: [
      { id: "STI1", nombre: "Seminario Taller de Investigación I", creditos: 2, estado: "faltante", prereqs: ["FIN1"] },
      { id: "CAL1", nombre: "Cálculo Diferencial", creditos: 4, estado: "faltante", prereqs: [] },
      { id: "PEP1", nombre: "Planeación Estratégica y Prospectiva", creditos: 3, estado: "faltante", prereqs: ["TOA1"] },
      { id: "MIC1", nombre: "Microeconomía", creditos: 4, estado: "faltante", prereqs: ["FDE1"] },
      { id: "ANF1", nombre: "Análisis Financiero", creditos: 3, estado: "faltante", prereqs: ["MFI1"] },
      { id: "ENG6", nombre: "General English VI", creditos: 2, estado: "faltante", prereqs: ["ENG5"] },
    ],
  },
  {
    semestre: 7,
    materias: [
      { id: "STI2", nombre: "Seminario Taller de Investigación II", creditos: 2, estado: "faltante", prereqs: ["STI1"] },
      { id: "CAL2", nombre: "Cálculo Integral", creditos: 4, estado: "faltante", prereqs: ["CAL1"] },
      { id: "GTH1", nombre: "Gerencia del Talento Humano", creditos: 2, estado: "faltante", prereqs: ["PEP1"] },
      { id: "DPR1", nombre: "Diseño de Productos Turísticos Responsables y Regenerativos", creditos: 3, estado: "faltante", prereqs: [] },
      { id: "PGS1", nombre: "Planificación y Gestión Sostenible del Turismo", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "GEB1", nombre: "Gerencia de Establecimientos Gastronómicos y Bares", creditos: 2, estado: "faltante", prereqs: ["PEP1"] },
      { id: "DCO1", nombre: "Derecho Comercial", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "ENG7", nombre: "General English VII", creditos: 2, estado: "faltante", prereqs: ["ENG6"] },
    ],
  },
  {
    semestre: 8,
    materias: [
      { id: "STI3", nombre: "Seminario Taller de Investigación III", creditos: 2, estado: "faltante", prereqs: ["STI2"] },
      { id: "TDS1", nombre: "Toma de Decisiones y Simulación Gerencial", creditos: 2, estado: "faltante", prereqs: ["PEP1"] },
      { id: "IAT2", nombre: "Impactos de la Actividad Turística", creditos: 2, estado: "faltante", prereqs: ["MAC1"] },
      { id: "FPR1", nombre: "Formulación de Proyectos", creditos: 2, estado: "faltante", prereqs: ["ANF1"] },
      { id: "EMD1", nombre: "Estrategias de Marketing Digital", creditos: 2, estado: "faltante", prereqs: ["DPR1"] },
      { id: "RSE1", nombre: "Responsabilidad Social Empresarial", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "MAC1", nombre: "Macroeconomía", creditos: 4, estado: "faltante", prereqs: ["FDE1"] },
      { id: "ENG8", nombre: "General English VIII", creditos: 2, estado: "faltante", prereqs: ["ENG7"] },
    ],
  },
  {
    semestre: 9,
    materias: [
      { id: "GOT1", nombre: "Gerencia de Organizaciones Turísticas", creditos: 2, estado: "faltante", prereqs: ["TDS1"] },
      { id: "EEP1", nombre: "Evaluación y Ejecución de Proyectos", creditos: 2, estado: "faltante", prereqs: ["FPR1"] },
      { id: "DLA1", nombre: "Derecho Laboral", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "GPC1", nombre: "Gestión Sostenible del Patrimonio Cultural", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "GCS1", nombre: "Gestión de la Calidad y Sostenibilidad en Empresas Turísticas", creditos: 2, estado: "faltante", prereqs: ["TDS1"] },
      { id: "SCT1", nombre: "Sostenibilidad Corporativa en Turismo", creditos: 2, estado: "faltante", prereqs: [] },
      { id: "EST2", nombre: "Estadística II", creditos: 3, estado: "faltante", prereqs: ["EST1"] },
      { id: "PPP2", nombre: "Profundización Profesional II", creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
];

export const MALLA_INDUSTRIAL = [
  {
    semestre: 1,
    materias: [
      { id: "CAL1", codigo: "01011601", nombre: "Cálculo Diferencial",                          creditos: 4, estado: "faltante", prereqs: [] },
      { id: "DIB1", codigo: "01011602", nombre: "Dibujo de Ingeniería",                         creditos: 2, estado: "faltante", prereqs: [] },
      { id: "III1", codigo: "01011603", nombre: "Introducción a la Ingeniería Industrial",      creditos: 2, estado: "faltante", prereqs: [] },
      { id: "PLE1", codigo: "01011604", nombre: "Procesos Lectores y Escriturales",             creditos: 2, estado: "faltante", prereqs: [] },
      { id: "FHC1", codigo: "01011605", nombre: "Formación Humanística y Ciudadana",            creditos: 2, estado: "faltante", prereqs: [] },
      { id: "RRM1", codigo: "01011606", nombre: "Razonamiento y Representación Matemática",     creditos: 2, estado: "faltante", prereqs: [] },
      { id: "CGL1", codigo: "01011607", nombre: "Cátedra Global",                               creditos: 2, estado: "faltante", prereqs: [] },
      { id: "ENG1", codigo: "01011608", nombre: "General English I",                            creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
  {
    semestre: 2,
    materias: [
      { id: "CAL2", codigo: "02011609", nombre: "Cálculo Integral",                             creditos: 4, estado: "faltante", prereqs: ["CAL1"] },
      { id: "FIM1", codigo: "02011610", nombre: "Física Mecánica",                              creditos: 4, estado: "faltante", prereqs: ["CAL1"] },
      { id: "ALI1", codigo: "02011611", nombre: "Álgebra Lineal",                               creditos: 3, estado: "faltante", prereqs: [] },
      { id: "PRO1", codigo: "02011612", nombre: "Programación",                                 creditos: 3, estado: "faltante", prereqs: [] },
      { id: "EOA1", codigo: "02011613", nombre: "Expresión Oral y Argumentación",               creditos: 2, estado: "faltante", prereqs: ["PLE1"] },
      { id: "ENG2", codigo: "02011614", nombre: "General English II",                           creditos: 2, estado: "faltante", prereqs: ["ENG1"] },
    ],
  },
  {
    semestre: 3,
    materias: [
      { id: "ECD1", codigo: "03011615", nombre: "Ecuaciones Diferenciales",                     creditos: 3, estado: "faltante", prereqs: ["CAL2"] },
      { id: "CYO1", codigo: "03011616", nombre: "Calor y Ondas",                                creditos: 4, estado: "faltante", prereqs: ["FIM1"] },
      { id: "QGM1", codigo: "03011617", nombre: "Química General",                              creditos: 4, estado: "faltante", prereqs: [] },
      { id: "DIB2", codigo: "03011618", nombre: "Dibujo Industrial",                            creditos: 2, estado: "faltante", prereqs: ["DIB1"] },
      { id: "PRE1", codigo: "03011619", nombre: "Probabilidad y Estadística",                   creditos: 3, estado: "faltante", prereqs: ["CAL2"] },
      { id: "ENG3", codigo: "03011620", nombre: "General English III",                          creditos: 2, estado: "faltante", prereqs: ["ENG2"] },
    ],
  },
  {
    semestre: 4,
    materias: [
      { id: "ESTA1", codigo: "04011621", nombre: "Estática",                                    creditos: 3, estado: "faltante", prereqs: ["FIM1", "CAL2"] },
      { id: "EYM1", codigo: "04011622", nombre: "Electricidad y Magnetismo",                    creditos: 4, estado: "faltante", prereqs: ["CYO1"] },
      { id: "CTM1", codigo: "04011623", nombre: "Ciencia y Tecnología de los Materiales",       creditos: 3, estado: "faltante", prereqs: ["QGM1"] },
      { id: "CCO1", codigo: "04011624", nombre: "Contabilidad y Costeo de Operaciones",         creditos: 3, estado: "faltante", prereqs: ["PRO1"] },
      { id: "EST2", codigo: "04011625", nombre: "Estadística Inferencial",                      creditos: 3, estado: "faltante", prereqs: ["PRE1"] },
      { id: "ENG4", codigo: "04011626", nombre: "General English IV",                           creditos: 2, estado: "faltante", prereqs: ["ENG3"] },
    ],
  },
  {
    semestre: 5,
    materias: [
      { id: "RMF1", codigo: "05011656", nombre: "Resistencia de Materiales de Fabricación",     creditos: 4, estado: "faltante", prereqs: ["ESTA1", "CTM1"] },
      { id: "TER1", codigo: "05011628", nombre: "Termodinámica",                                creditos: 3, estado: "faltante", prereqs: ["CYO1"] },
      { id: "ECO1", codigo: "05011629", nombre: "Economía",                                     creditos: 3, estado: "faltante", prereqs: ["CCO1"] },
      { id: "DEX1", codigo: "05011630", nombre: "Diseño de Experimentos",                       creditos: 3, estado: "faltante", prereqs: ["EST2"] },
      { id: "IOD1", codigo: "05011631", nombre: "Investigación de Operaciones Determinísticas", creditos: 3, estado: "faltante", prereqs: ["ALI1"] },
      { id: "ENG5", codigo: "05011635", nombre: "General English V",                            creditos: 2, estado: "faltante", prereqs: ["ENG4"] },
    ],
  },
  {
    semestre: 6,
    materias: [
      { id: "IME1", codigo: "06011632", nombre: "Ingeniería de Mercados",                       creditos: 3, estado: "faltante", prereqs: ["ECO1"] },
      { id: "IMT1", codigo: "06011633", nombre: "Ingeniería de Métodos y Tiempos",              creditos: 3, estado: "faltante", prereqs: ["DEX1"] },
      { id: "IOP1", codigo: "06011634", nombre: "Investigación de Operaciones Probabilísticas", creditos: 3, estado: "faltante", prereqs: ["IOD1"] },
      { id: "PNI1", codigo: "06011635", nombre: "Procesos Industriales",                        creditos: 4, estado: "faltante", prereqs: ["RMF1", "TER1"] },
      { id: "AYO1", codigo: "06011636", nombre: "Administración y Organizaciones",              creditos: 3, estado: "faltante", prereqs: ["ECO1"] },
      { id: "DYP1", codigo: "06011637", nombre: "Diseño y Prototipado",                         creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
  {
    semestre: 7,
    materias: [
      { id: "INF1", codigo: "07011638", nombre: "Ingeniería Financiera",                        creditos: 3, estado: "faltante", prereqs: ["IME1"] },
      { id: "DOP1", codigo: "07011639", nombre: "Diseño de Operaciones",                        creditos: 3, estado: "faltante", prereqs: ["IMT1"] },
      { id: "CEP1", codigo: "07011640", nombre: "Control Estadístico de Procesos",              creditos: 3, estado: "faltante", prereqs: ["DEX1"] },
      { id: "SIG1", codigo: "07011641", nombre: "Sistemas Integrados de Gestión",               creditos: 3, estado: "faltante", prereqs: ["AYO1"] },
      { id: "ETI1", codigo: "07011642", nombre: "Ética en Ingeniería Industrial",               creditos: 2, estado: "faltante", prereqs: [] },
      { id: "MTI1", codigo: "07011643", nombre: "Metodología y Técnicas de Investigación en Ingeniería", creditos: 2, estado: "faltante", prereqs: ["DYP1"] },
      { id: "ELP1", codigo: "07011657", nombre: "Electiva de Profundización I",                 creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
  {
    semestre: 8,
    materias: [
      { id: "IPR1", codigo: "08011644", nombre: "Ingeniería de Proyectos",                      creditos: 3, estado: "faltante", prereqs: [] },
      { id: "GDO1", codigo: "08011645", nombre: "Gerencia de Operaciones",                      creditos: 3, estado: "faltante", prereqs: ["DOP1"] },
      { id: "SMO1", codigo: "08011646", nombre: "Simulación de Operaciones",                    creditos: 3, estado: "faltante", prereqs: ["IOP1"] },
      { id: "RII1", codigo: "08011647", nombre: "Relaciones Industriales",                      creditos: 3, estado: "faltante", prereqs: ["AYO1"] },
      { id: "PDS1", codigo: "08011648", nombre: "Pensamiento de Sistemas",                      creditos: 2, estado: "faltante", prereqs: ["SIG1"] },
      { id: "PII1", codigo: "08000001", nombre: "Propuesta de Investigación en Ingeniería",     creditos: 2, estado: "faltante", prereqs: ["MTI1"] },
      { id: "ELP2", codigo: "08011658", nombre: "Electiva de Profundización II",                creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
  {
    semestre: 9,
    materias: [
      { id: "DIP1", codigo: "09011650", nombre: "Diseño e Innovación de Productos",             creditos: 3, estado: "faltante", prereqs: ["IPR1"] },
      { id: "LGI1", codigo: "09011651", nombre: "Logística Integral",                           creditos: 3, estado: "faltante", prereqs: ["GDO1"] },
      { id: "DGE1", codigo: "09011652", nombre: "Diseño de Instalaciones y Gestión Energética", creditos: 3, estado: "faltante", prereqs: ["SMO1"] },
      { id: "DNS1", codigo: "09011654", nombre: "Dinámica de Sistemas",                         creditos: 3, estado: "faltante", prereqs: ["PDS1"] },
      { id: "PCD1", codigo: "09011655", nombre: "Proyecto Culminante de Diseño",                creditos: 2, estado: "faltante", prereqs: ["PII1"] },
      { id: "ELP3", codigo: "09011659", nombre: "Electiva de Profundización III",               creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
];

export const MALLA_NEGOCIOS = [
  {
    semestre: 1,
    materias: [
      { id: "CAL1", codigo: "01012613", nombre: "Cálculo Diferencial",                             creditos: 4, estado: "faltante", prereqs: [] },
      { id: "RRM1", codigo: "01012610", nombre: "Razonamiento y Representación Matemática",        creditos: 2, estado: "faltante", prereqs: [] },
      { id: "PLE1", codigo: "01012612", nombre: "Procesos Lectores y Escriturales",                creditos: 2, estado: "faltante", prereqs: [] },
      { id: "OFI1", codigo: "01012611", nombre: "Ofimática Avanzada y Bases de Datos",             creditos: 2, estado: "faltante", prereqs: [] },
      { id: "INI1", codigo: "01012614", nombre: "Introducción a los Negocios Internacionales",    creditos: 2, estado: "faltante", prereqs: [] },
      { id: "FEC1", codigo: "01012615", nombre: "Fundamentos de Economía",                         creditos: 3, estado: "faltante", prereqs: [] },
      { id: "TFC1", codigo: "02012619", nombre: "Teoría y Filosofía del Conocimiento",            creditos: 2, estado: "faltante", prereqs: [] },
      { id: "CGL1", codigo: "03012624", nombre: "Cátedra Global",                                 creditos: 2, estado: "faltante", prereqs: [] },
      { id: "ENG1", codigo: "01012609", nombre: "General English I",                              creditos: 2, estado: "faltante", prereqs: [] },
    ],
  },
  {
    semestre: 2,
    materias: [
      { id: "CAL2", codigo: "02012620", nombre: "Cálculo Integral",                               creditos: 4, estado: "faltante", prereqs: ["CAL1"] },
      { id: "CGF1", codigo: "02012621", nombre: "Contabilidad General y Financiera",              creditos: 3, estado: "faltante", prereqs: [] },
      { id: "MIC1", codigo: "02012622", nombre: "Microeconomía",                                  creditos: 4, estado: "faltante", prereqs: ["FEC1"] },
      { id: "ECE1", codigo: "04012603", nombre: "Emprendimiento y Creación de Empresas",          creditos: 2, estado: "faltante", prereqs: [] },
      { id: "EOA1", codigo: "02012617", nombre: "Expresión Oral y Argumentación",                 creditos: 2, estado: "faltante", prereqs: [] },
      { id: "ETL1", codigo: "02012618", nombre: "Exigencia Tercera Lengua I",                     creditos: 2, estado: "faltante", prereqs: [] },
      { id: "ENG2", codigo: "02012616", nombre: "General English II",                             creditos: 2, estado: "faltante", prereqs: ["ENG1"] },
    ],
  },
  {
    semestre: 3,
    materias: [
      { id: "MAC1", codigo: "03012629", nombre: "Macroeconomía",                                  creditos: 4, estado: "faltante", prereqs: ["FEC1"] },
      { id: "NGC1", codigo: "03012627", nombre: "Negocios, Globalización y Cultura",              creditos: 3, estado: "faltante", prereqs: ["INI1"] },
      { id: "CEX1", codigo: "03012628", nombre: "Comercio Exterior I",                            creditos: 3, estado: "faltante", prereqs: ["INI1"] },
      { id: "DII1", codigo: "03012656", nombre: "Derecho e Instituciones Internacionales",        creditos: 3, estado: "faltante", prereqs: [] },
      { id: "MTI1", codigo: "03012625", nombre: "Metodología y Técnicas de la Investigación",     creditos: 2, estado: "faltante", prereqs: ["TFC1"] },
      { id: "ETL2", codigo: "03012626", nombre: "Exigencia Tercera Lengua II",                    creditos: 2, estado: "faltante", prereqs: ["ETL1"] },
      { id: "ENG3", codigo: "03012623", nombre: "General English III",                            creditos: 2, estado: "faltante", prereqs: ["ENG2"] },
    ],
  },
  {
    semestre: 4,
    materias: [
      { id: "TPC1", codigo: "04012608", nombre: "Teoría y Política del Comercio Internacional",   creditos: 4, estado: "faltante", prereqs: ["MAC1"] },
      { id: "CEX2", codigo: "04012602", nombre: "Comercio Exterior II",                           creditos: 3, estado: "faltante", prereqs: ["CEX1"] },
      { id: "EST1", codigo: "04012604", nombre: "Estadística I",                                  creditos: 3, estado: "faltante", prereqs: [] },
      { id: "FHC1", codigo: "04012606", nombre: "Formación Humanística y Ciudadana",              creditos: 2, estado: "faltante", prereqs: [] },
      { id: "STI1", codigo: "04012607", nombre: "Seminario Taller de Investigación I",            creditos: 2, estado: "faltante", prereqs: ["MTI1"] },
      { id: "ETL3", codigo: "04012605", nombre: "Exigencia Tercera Lengua III",                   creditos: 2, estado: "faltante", prereqs: ["ETL2"] },
      { id: "ENG4", codigo: "04012601", nombre: "General English IV",                             creditos: 2, estado: "faltante", prereqs: ["ENG3"] },
    ],
  },
  {
    semestre: 5,
    materias: [
      { id: "NGI1", codigo: "05012633", nombre: "Negociación Internacional",                      creditos: 3, estado: "faltante", prereqs: ["NGC1"] },
      { id: "IPF1", codigo: "05012634", nombre: "Instrumentos de Pago y Financiación del Comercio Exterior", creditos: 3, estado: "faltante", prereqs: ["CEX2"] },
      { id: "FMK1", codigo: "05012635", nombre: "Fundamentos de Marketing",                       creditos: 3, estado: "faltante", prereqs: ["EST1"] },
      { id: "EST2", codigo: "05012631", nombre: "Estadística II",                                 creditos: 3, estado: "faltante", prereqs: ["EST1"] },
      { id: "STI2", codigo: "05012630", nombre: "Seminario Taller de Investigación II",           creditos: 2, estado: "faltante", prereqs: ["STI1"] },
      { id: "ETL4", codigo: "05012632", nombre: "Exigencia Tercera Lengua IV",                    creditos: 2, estado: "faltante", prereqs: ["ETL3"] },
      { id: "ENG5", codigo: "05012601", nombre: "General English V",                              creditos: 2, estado: "faltante", prereqs: ["ENG4"] },
    ],
  },
  {
    semestre: 6,
    materias: [
      { id: "LDF1", codigo: "06012639", nombre: "Logística y Distribución Física Internacional",  creditos: 4, estado: "faltante", prereqs: ["CEX2"] },
      { id: "TOA1", codigo: "06012641", nombre: "Teoría de las Organizaciones y de la Administración", creditos: 4, estado: "faltante", prereqs: [] },
      { id: "IDM1", codigo: "06012640", nombre: "Investigación de Mercados",                      creditos: 3, estado: "faltante", prereqs: ["FMK1"] },
      { id: "MFR1", codigo: "06012638", nombre: "Matemática Financiera",                          creditos: 3, estado: "faltante", prereqs: [] },
      { id: "STI3", codigo: "06012637", nombre: "Seminario Taller de Investigación III",          creditos: 2, estado: "faltante", prereqs: ["STI2"] },
      { id: "ENG6", codigo: "06012636", nombre: "General English VI",                             creditos: 2, estado: "faltante", prereqs: ["ENG5"] },
    ],
  },
  {
    semestre: 7,
    materias: [
      { id: "PDN1", codigo: "07012645", nombre: "Plan de Negocios",                               creditos: 3, estado: "faltante", prereqs: ["IDM1"] },
      { id: "ANF1", codigo: "07012646", nombre: "Análisis Financiero",                            creditos: 3, estado: "faltante", prereqs: ["MFR1"] },
      { id: "PEP1", codigo: "07012647", nombre: "Planeación Estratégica y Prospectiva",           creditos: 3, estado: "faltante", prereqs: ["TOA1"] },
      { id: "RLI1", codigo: "07012644", nombre: "Relaciones Internacionales",                     creditos: 3, estado: "faltante", prereqs: [] },
      { id: "MRI1", codigo: "07012643", nombre: "Mercados Regionales e Inteligencia de Mercados", creditos: 3, estado: "faltante", prereqs: ["LDF1"] },
      { id: "ENG7", codigo: "07012642", nombre: "General English VII",                            creditos: 2, estado: "faltante", prereqs: ["ENG6"] },
    ],
  },
  {
    semestre: 8,
    materias: [
      { id: "FEP1", codigo: "08012652", nombre: "Formulación y Evaluación de Proyectos",          creditos: 4, estado: "faltante", prereqs: ["ANF1"] },
      { id: "FNI1", codigo: "08012649", nombre: "Finanzas Internacionales",                       creditos: 3, estado: "faltante", prereqs: ["MAC1"] },
      { id: "TDG1", codigo: "08012650", nombre: "Toma de Decisiones Gerenciales",                 creditos: 3, estado: "faltante", prereqs: ["PEP1"] },
      { id: "MKI1", codigo: "08012651", nombre: "Marketing Internacional",                        creditos: 3, estado: "faltante", prereqs: ["IDM1"] },
      { id: "DAD1", codigo: "08012654", nombre: "Derecho Aduanero",                               creditos: 3, estado: "faltante", prereqs: [] },
      { id: "OPR1", codigo: "08012653", nombre: "Optativa de Profundización",                     creditos: 3, estado: "faltante", prereqs: [] },
      { id: "ENG8", codigo: "08012648", nombre: "General English VIII",                           creditos: 2, estado: "faltante", prereqs: ["ENG7"] },
    ],
  },
  {
    semestre: "opt",
    label: "Optativos",
    materias: [
      { id: "OPTL0001", codigo: "OPTL0001", nombre: "Cátedra Interculturalidad, Territorio y Sostenibilidad", creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0001", codigo: "OPT_0001", nombre: "English Skills for Business Communication I",             creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0002", codigo: "OPT_0002", nombre: "English Skills for Business Communication II",            creditos: 3, estado: "faltante", prereqs: [], optativa: true },
      { id: "OPT_0003", codigo: "OPT_0003", nombre: "SARLAFT: Negocios Globales sin Riesgos",                 creditos: 3, estado: "faltante", prereqs: [], optativa: true },
    ],
  },
];

export const MALLAS_POR_CARRERA = {
  "Ingeniería de Sistemas": MALLA_SISTEMAS,
  "Hotelería y Turismo": MALLA_HOTELERIA_TURISMO,
  "Ingeniería Industrial": MALLA_INDUSTRIAL,
  "Negocios Internacionales": MALLA_NEGOCIOS,
};

export function getMallaByCareer(career) {
  return MALLAS_POR_CARRERA[career] || MALLA_SISTEMAS;
}

export const MALLA = MALLA_SISTEMAS;

export const ESTADOS = {
  aprobada:  { label: "Aprobada",  emoji: "✓" },
  cursando:  { label: "Cursando",  emoji: "◉" },
  faltante:  { label: "Faltante",  emoji: "○" },
};
