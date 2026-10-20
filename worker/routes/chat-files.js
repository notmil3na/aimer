// subida y descarga de adjuntos del chat contra R2.
// son rutas públicas pero protegidas por un enlace firmado (ver signPath en lib.js),
// porque las etiquetas <img>/fetch del navegador no envían el Authorization.
import { json, verifyPath } from "../lib.js";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

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

  const type = c.req.header("content-type") || "application/octet-stream";
  await c.env.R2_BUCKET.put(path, c.req.raw.body, { httpMetadata: { contentType: type } });
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

  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Cache-Control", "private, max-age=3600");
  if (obj.size) headers.set("Content-Length", String(obj.size));
  // ?download=1 fuerza la descarga (attachment). En el teléfono es la única
  // forma fiable de guardar el archivo en vez de solo abrirlo en el visor.
  const asDownload = ["1", "true", "attachment"].includes(String(url.searchParams.get("download") || "").toLowerCase());
  const name = url.searchParams.get("name") || String(path).split("/").pop() || "archivo";
  headers.set("Content-Disposition", contentDisposition(asDownload ? "attachment" : "inline", name));
  return new Response(obj.body, { headers });
}
