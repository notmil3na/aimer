import { HORAS_FORM, horaIdx } from "./horarioHelpers.js";

const COLUMN_DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const OCR_DAYS = ["L", "M", "X", "J", "V", "S"];

function isBluePixel(data, offset) {
  const r = data[offset], g = data[offset + 1], b = data[offset + 2];
  return b > 85 && g > 65 && b > r * 1.18 && g > r * 1.08;
}

function runs(values, maxGap = 1) {
  const groups = [];
  let group = [];
  for (const value of values) {
    if (group.length && value - group[group.length - 1] > maxGap + 1) {
      groups.push(group);
      group = [];
    }
    group.push(value);
  }
  if (group.length) groups.push(group);
  return groups;
}

function centerOf(group) {
  return Math.round(group.reduce((sum, value) => sum + value, 0) / group.length);
}

function uniqueSorted(values, tolerance = 3) {
  return values.sort((a, b) => a - b).reduce((result, value) => {
    if (!result.length || value - result[result.length - 1] > tolerance) result.push(value);
    else result[result.length - 1] = Math.round((result[result.length - 1] + value) / 2);
    return result;
  }, []);
}

function detectTables(image) {
  const maxDimension = 2200;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);

  const blueAt = (x, y) => isBluePixel(data, (y * width + x) * 4);
  const horizontalCandidates = [];
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) if (blueAt(x, y)) count++;
    if (count / width >= 0.5) horizontalCandidates.push(y);
  }
  const horizontalRuns = runs(horizontalCandidates, 2);
  const yBounds = uniqueSorted(horizontalRuns.flatMap((group) => group.length >= 5
    ? [group[0], group[group.length - 1]]
    : [centerOf(group)]));
  if (yBounds.length < 3) throw new Error("No identifiqué las filas. Usa una captura donde se vea toda la tabla.");

  // Analiza cada franja entre bordes horizontales por separado. Así una imagen
  // que contiene la tabla de materias y la cuadrícula de salones no combina las
  // columnas de ambas tablas en una sola estructura imposible.
  const bands = [];
  for (let index = 0; index < yBounds.length - 1; index++) {
    const top = yBounds[index], bottom = yBounds[index + 1];
    const bandHeight = bottom - top;
    if (bandHeight < 8) continue;
    const verticalCandidates = [];
    for (let x = 0; x < width; x++) {
      let count = 0;
      for (let y = top + 2; y < bottom - 1; y++) if (blueAt(x, y)) count++;
      if (count / Math.max(1, bandHeight - 3) >= 0.38) verticalCandidates.push(x);
    }
    const xs = runs(verticalCandidates, 2).filter((group) => group.length <= 8).map(centerOf);
    if (xs.length >= 3) bands.push({ index, xs });
  }

  const sameColumns = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= 4);
  const tables = [];
  for (const band of bands) {
    const last = tables[tables.length - 1];
    if (last && last.endIndex === band.index && sameColumns(last.xs, band.xs)) {
      last.endIndex = band.index + 1;
      last.rowCount++;
    } else {
      tables.push({ canvas, context, xs: band.xs, startIndex: band.index, endIndex: band.index + 1, colCount: band.xs.length - 1, rowCount: 1 });
    }
  }
  for (const table of tables) {
    // Rebuild bounds from the original row-band indices; candidate tables hold
    // one or more contiguous bands and use their exact outer grid lines.
    table.yBounds = Array.from({ length: table.rowCount + 1 }, (_, i) => yBounds[table.startIndex + i]);
    delete table.startIndex;
    delete table.endIndex;
  }
  return tables;
}

function findTable(tables, expectedColumns) {
  return tables.filter((table) => table.colCount === expectedColumns && table.rowCount >= 2)
    .sort((a, b) => b.rowCount - a.rowCount)[0] || null;
}

function cellHasInk(context, x, y, width, height) {
  const imageData = context.getImageData(x, y, width, height).data;
  let count = 0;
  for (let i = 0; i < imageData.length; i += 4) {
    const luminance = imageData[i] * 0.299 + imageData[i + 1] * 0.587 + imageData[i + 2] * 0.114;
    if (luminance < 190) count++;
  }
  return count > 5;
}

function cropCell(table, row, col) {
  const x1 = table.xs[col] + 3;
  const x2 = table.xs[col + 1] - 3;
  const y1 = table.yBounds[row] + 3;
  const y2 = table.yBounds[row + 1] - 3;
  const width = x2 - x1, height = y2 - y1;
  if (width < 8 || height < 8 || !cellHasInk(table.context, x1, y1, width, height)) return null;

  const scale = Math.min(3, Math.max(2, 900 / width));
  const crop = document.createElement("canvas");
  crop.width = Math.round(width * scale);
  crop.height = Math.round(height * scale);
  crop.getContext("2d").drawImage(table.canvas, x1, y1, width, height, 0, 0, crop.width, crop.height);
  return crop;
}

function cleanOcr(text) {
  return String(text || "").replace(/[|]/g, "I").replace(/\s+/g, " ").trim();
}

function parseTimeRanges(text) {
  const matches = [...String(text || "").replace(/[oO]/g, "0").matchAll(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/g)];
  return matches.flatMap((match) => {
    const start = Number(match[1]), end = Number(match[2]);
    if (start < 6 || start > 22 || end <= start || end > 23) return [];
    const toFormHour = (hour) => {
      const period = hour < 12 ? "a. m." : "p. m.";
      const twelveHour = hour % 12 || 12;
      const value = `${String(twelveHour).padStart(2, "0")}:00 ${period}`;
      return HORAS_FORM.includes(value) ? value : null;
    };
    const horaInicio = toFormHour(start), horaFin = toFormHour(end);
    if (!horaInicio || !horaFin || horaIdx(horaFin) <= horaIdx(horaInicio)) return [];
    return [{ horaInicio, horaFin }];
  });
}

function parseVenue(text) {
  const raw = cleanOcr(text).replace(/\([^)]*\)/g, (match) => match.replace(/[()]/g, " ")).trim();
  const upper = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const roomNumber = upper.match(/SALON\s*(\d{2,4})/i)?.[1] || "";

  if (/CIENAGA\s+GRANDE/.test(upper)) {
    const lado = /\bNORTE\b/.test(upper) ? "Norte" : /\bSUR\b/.test(upper) ? "Sur" : "";
    return { edificio: "cienaga_grande", lado, salon: roomNumber, salonLabel: `Ciénaga Grande${lado ? ` ${lado}` : ""}${roomNumber ? ` salón ${roomNumber}` : ""}`.trim() };
  }
  if (/MAR\s+CARIBE/.test(upper)) {
    const lado = /\bNORTE\b/.test(upper) ? "Norte" : /\bSUR\b/.test(upper) ? "Sur" : "";
    return { edificio: "mar_caribe", lado, salon: roomNumber, salonLabel: `Mar Caribe${lado ? ` ${lado}` : ""}${roomNumber ? ` salón ${roomNumber}` : ""}`.trim() };
  }
  if (/BLOQUE\s*3/.test(upper)) {
    const salon = /TECNOLOGIAS/.test(upper)
      ? "Lab. de Tecnologías de la Información"
      : raw.replace(/BLOQUE\s*3\s*[-–]?\s*/i, "").trim();
    return { edificio: "bloque_3", lado: "", salon, salonLabel: `Bloque 3 — ${salon}` };
  }
  if (/EIE|MECANICA\s+I/.test(upper)) {
    return { edificio: "edf_innovacion", lado: "", salon: "Lab. de Mecánica I", salonLabel: "Edificio de Innovación y Emprendimiento — Lab. de Mecánica I" };
  }
  return raw ? { edificio: "", lado: "", salon: "", salonLabel: raw } : { edificio: "", lado: "", salon: "", salonLabel: "" };
}

async function recognizeCell(worker, table, row, col, numeric = false) {
  const crop = cropCell(table, row, col);
  if (!crop) return "";
  await worker.setParameters({
    tessedit_pageseg_mode: "6",
    tessedit_char_whitelist: numeric ? "0123456789:-–— " : "",
  });
  const result = await worker.recognize(crop);
  return cleanOcr(result.data.text);
}

function getDataRowCount(table) {
  const count = table.rowCount - 1;
  if (count < 1) throw new Error("La tabla no tiene filas de materias reconocibles.");
  return count;
}

export async function readScheduleImages(scheduleFile, locationFile, onProgress = () => {}) {
  if (!scheduleFile) throw new Error("Selecciona la imagen principal con materias, días y horas.");
  if (scheduleFile.size > 12 * 1024 * 1024 || locationFile?.size > 12 * 1024 * 1024) {
    throw new Error("Cada imagen debe pesar menos de 12 MB.");
  }
  const images = await Promise.all([createImageBitmap(scheduleFile), ...(locationFile ? [createImageBitmap(locationFile)] : [])]);
  let scheduleTable, locationTable, scheduleRowCount, locationRowCount;
  try {
    const mainTables = detectTables(images[0]);
    scheduleTable = findTable(mainTables, 10);
    if (!scheduleTable) {
      const foundColumns = [...new Set(mainTables.map((table) => table.colCount))].join(", ");
      throw new Error(foundColumns
        ? `No encontré la tabla de materias de 10 columnas (detecté tablas de ${foundColumns}). Sube también la captura con asignaturas, docentes y días.`
        : "No identifiqué una tabla completa. Sube una captura nítida con asignaturas, docentes y días.");
    }
    scheduleRowCount = getDataRowCount(scheduleTable);
    locationTable = (images[1] ? findTable(detectTables(images[1]), 7) : null) || findTable(mainTables, 7);
    locationRowCount = locationTable ? getDataRowCount(locationTable) : 0;
  } finally {
    images.forEach((image) => image.close());
  }

  const workerModule = await import("tesseract.js");
  const worker = await workerModule.createWorker("spa", 1, {
    logger: (message) => {
      if (message.status === "loading language traineddata" || message.status === "initializing tesseract") {
        onProgress(0.04 + (message.progress || 0) * 0.12, "Preparando reconocimiento de texto…");
      }
    },
  });

  try {
    const dataRows = [];
    let taskCount = scheduleRowCount * 10;
    let tasksDone = 0;
    for (let row = 1; row <= scheduleRowCount; row++) {
      // Un worker procesa una operación a la vez. Mantener cada cambio de
      // whitelist junto a su celda evita que se mezclen parámetros entre OCR.
      const nombre = await recognizeCell(worker, scheduleTable, row, 0);
      const profesor = await recognizeCell(worker, scheduleTable, row, 1);
      const grupo = await recognizeCell(worker, scheduleTable, row, 2, true);
      tasksDone += 3;
      const meetings = [];
      for (let dayIndex = 0; dayIndex < COLUMN_DAYS.length; dayIndex++) {
        const timeText = await recognizeCell(worker, scheduleTable, row, dayIndex + 3, true);
        tasksDone++;
        const ranges = parseTimeRanges(timeText);
        for (const range of ranges) meetings.push({ dia: COLUMN_DAYS[dayIndex], ...range, edificio: "", lado: "", salon: "", salonLabel: "" });
      }
      dataRows.push({ nombre, profesor, grupo: grupo.replace(/\D/g, "").slice(0, 8), meetings });
      onProgress(0.16 + (tasksDone / taskCount) * 0.7, `Leyendo materia ${row} de ${scheduleRowCount}…`);
    }

    if (locationTable) {
      const matchingRows = Math.min(locationRowCount, dataRows.length);
      const locationTasks = dataRows.slice(0, matchingRows).reduce((total, item) => total + item.meetings.length, 0);
      let locationDone = 0;
      taskCount += locationTasks;
      for (let row = 0; row < matchingRows; row++) {
        const scheduleRow = dataRows[row];
        for (const meeting of scheduleRow.meetings) {
          const dayIndex = COLUMN_DAYS.indexOf(meeting.dia);
          if (dayIndex < 0 || dayIndex >= 7) continue;
          const roomText = await recognizeCell(worker, locationTable, row + 1, dayIndex, false);
          Object.assign(meeting, parseVenue(roomText));
          locationDone++;
          onProgress(0.86 + (locationDone / Math.max(1, locationTasks)) * 0.12, "Leyendo salones…");
        }
      }
    }

    const rows = dataRows.filter((item) => item.nombre && item.meetings.length);
    if (!rows.length) throw new Error("No encontré materias con horas válidas. Revisa que la imagen tenga buena resolución.");
    const meetings = rows.flatMap((row) => row.meetings);
    const unsupportedDays = [...new Set(meetings.filter((meeting) => !OCR_DAYS.includes(meeting.dia)).map((meeting) => meeting.dia))];
    onProgress(1, "Reconocimiento listo");
    return {
      rows,
      warnings: [
        ...(locationTable && locationRowCount !== scheduleRowCount ? ["Las tablas tienen distinta cantidad de filas; los salones se alinearon por el orden visible."] : []),
        ...(unsupportedDays.length ? ["Se detectaron clases en domingo, que no se pueden mostrar en el horario actual."] : []),
      ],
      matchedLocationRows: locationTable ? Math.min(locationRowCount, scheduleRowCount) : 0,
    };
  } finally {
    await worker.terminate();
  }
}
