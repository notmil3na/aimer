export const SEMESTER_CORTE = "2026-2";
export const SEMESTER_START = new Date(2026, 7, 3);
export const SEMESTER_END = new Date(2026, 10, 28, 23, 59, 59, 999);
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseISODate(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function endOfDay(d) {
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function semesterDatesFor(semestre) {
  const start = parseISODate(semestre?.inicio) || new Date(SEMESTER_START);
  const end = endOfDay(parseISODate(semestre?.fin)) || new Date(SEMESTER_END.getTime());
  return { start, end };
}

export function semesterCorteFor(semestre) {
  const { start } = semesterDatesFor(semestre);
  const sem = start.getMonth() < 6 ? "1" : "2";
  return `${start.getFullYear()}-${sem}`;
}

export function getSemesterCountdown(semestre, now = new Date()) {
  const { start, end } = semesterDatesFor(semestre);
  const today = startOfDay(now);
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);

  if (today < startDay) {
    const daysUntilStart = Math.round((startDay - today) / MS_PER_DAY);
    return {
      days: daysUntilStart,
      daysText: daysUntilStart === 1 ? "día para iniciar clases" : "días para iniciar clases",
      status: "Aún no inicia",
      showProgress: false,
      progress: 0,
      progressInfo: null,
    };
  }

  if (today > endDay) {
    return {
      days: 0,
      daysText: "días para terminar",
      status: "Semestre finalizado",
      showProgress: true,
      progress: 100,
      progressInfo: {
        left: "100% del semestre transcurrido",
        right: "0 días restantes",
      },
    };
  }

  const totalSemesterDays = Math.ceil((end - start) / MS_PER_DAY);
  const elapsedDays = Math.max(0, Math.ceil((today - start) / MS_PER_DAY));
  const remainingDays = Math.max(0, Math.ceil((end - now) / MS_PER_DAY));
  const semesterProgress = Math.min(
    100,
    Math.max(0, Math.round((elapsedDays / totalSemesterDays) * 100))
  );

  return {
    days: remainingDays,
    daysText: remainingDays === 1 ? "día para terminar" : "días para terminar",
    status: "Semestre en curso",
    showProgress: true,
    progress: semesterProgress,
    progressInfo: {
      left: `${semesterProgress}% del semestre transcurrido`,
      right: `${remainingDays} días restantes`,
    },
  };
}
