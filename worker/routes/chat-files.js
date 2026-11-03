// subida y descarga de adjuntos del chat contra R2.
// son rutas públicas pero protegidas por un enlace firmado (ver signPath en lib.js),
// porque las etiquetas <img>/fetch del navegador no envían el Authorization.
import { json, verifyPath } from "../lib.js";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function detectContentType(bytes) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) return "image/webp";
  if (
    bytes.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(String.fromCharCode(...bytes.subarray(0, 6)))
  ) return "image/gif";
  if (
    bytes.length >= 5 &&
    String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-"
  ) return "application/pdf";
  return "application/octet-stream";
}

async function readBoundedBody(body, maxBytes) {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

// nombre seguro para la cabecera: versión ascii de respaldo + el nombre real
// en utf-8 (filename*). Así los acentos y emojis no rompen la descarga.
function contentDisposition(type, name) {
  const clean = String(name || "archivo").slice(0, 120) || "archivo";
  const ascii = clean.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "archivo";
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function uploadHandler(c) {
  const url = new URL(c.req.url);
  const path = url.searchParams.get("path") || "";
  const token = url.searchParams.get("token") || "";
  if (!c.env.R2_BUCKET) return json(c, 500, { error: "Almacenamiento no configurado" });
  if (!path.startsWith("chat/")) return json(c, 400, { error: "Ruta inválida" });
  if (!(await verifyPath(c.env, path, token))) return json(c, 403, { error: "Enlace inválido o vencido" });

  const cl = Number(c.req.header("content-length") || 0);
  if (cl > MAX_FILE_BYTES) return json(c, 413, { error: "El archivo supera el límite de 8 MB" });

  const bytes = await readBoundedBody(c.req.raw.body, MAX_FILE_BYTES);
  if (!bytes) return json(c, 413, { error: "El archivo supera el límite de 8 MB" });
  const type = detectContentType(bytes);
  await c.env.R2_BUCKET.put(path, bytes, { httpMetadata: { contentType: type } });
  return json(c, 200, { ok: true });
}

export async function downloadHandler(c) {
  const url = new URL(c.req.url);
  const path = url.searchParams.get("path") || "";
  const token = url.searchParams.get("token") || "";
  if (!c.env.R2_BUCKET) return json(c, 500, { error: "Almacenamiento no configurado" });
  if (!(await verifyPath(c.env, path, token))) return json(c, 403, { error: "Enlace inválido o vencido" });

  const obj = await c.env.R2_BUCKET.get(path);
  if (!obj) return json(c, 404, { error: "Archivo no encontrado" });
  if (obj.size > MAX_FILE_BYTES) return json(c, 413, { error: "El archivo supera el límite de 8 MB" });

  const bytes = await readBoundedBody(obj.body, MAX_FILE_BYTES);
  if (!bytes) return json(c, 413, { error: "El archivo supera el límite de 8 MB" });
  const type = detectContentType(bytes);
  const isInlineImage = INLINE_IMAGE_TYPES.has(type);

  const headers = new Headers();
  headers.set("Content-Type", type);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "sandbox; default-src 'none'");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Content-Length", String(bytes.byteLength));
  const asDownload = ["1", "true", "attachment"].includes(String(url.searchParams.get("download") || "").toLowerCase());
  const name = url.searchParams.get("name") || String(path).split("/").pop() || "archivo";
  headers.set("Content-Disposition", contentDisposition(isInlineImage && !asDownload ? "inline" : "attachment", name));
  return new Response(bytes, { headers });
}
