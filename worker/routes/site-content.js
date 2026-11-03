import { all } from "../db.js";
import { json, readBody, requireAdmin, vreq } from "../lib.js";

const MAX_PATH = 160;
const MAX_SELECTOR = 1200;
const MAX_TEXT = 5000;

export async function handler(c) {
  const req = vreq(c);
  if (!c.env.DB) return json(c, 500, { error: "Configuración del servidor incompleta" });

  if (req.method === "GET") {
    if (new URL(req.url).searchParams.get("all") === "1") {
      const access = await requireAdmin(c);
      if (access.error === "unauthenticated") return json(c, 401, { error: "Sesión inválida" });
      if (access.error) return json(c, 403, { error: "Se requieren permisos de administrador" });
      const result = await all(c.env.DB.prepare("SELECT page_path,selector,source_text,text,updated_at FROM site_texts ORDER BY page_path,updated_at DESC"));
      if (result.error) {
        console.error("no se pudieron cargar los textos globales", result.error);
        return json(c, 500, { error: "No se pudieron cargar los textos" });
      }
      return json(c, 200, { items: result.data });
    }

    const pagePath = new URL(req.url).searchParams.get("path") || "";
    if (!pagePath || pagePath.length > MAX_PATH) return json(c, 400, { error: "Página inválida" });
    const result = await all(
      c.env.DB.prepare("SELECT selector,source_text,text FROM site_texts WHERE page_path = ?").bind(pagePath)
    );
    if (result.error) {
      console.error("no se pudieron cargar los textos públicos", result.error);
      return json(c, 500, { error: "No se pudieron cargar los textos del sitio" });
    }
    return json(c, 200, { items: result.data });
  }

  if (req.method !== "POST" && req.method !== "DELETE") return json(c, 405, { error: "method" });
  const access = await requireAdmin(c);
  if (access.error === "unauthenticated") return json(c, 401, { error: "Sesión inválida" });
  if (access.error) return json(c, 403, { error: "Se requieren permisos de administrador" });

  const body = await readBody(c);
  const pagePath = String(body.pagePath || "");
  const selector = String(body.selector || "");
  if (!pagePath || pagePath.length > MAX_PATH || !selector || selector.length > MAX_SELECTOR) {
    return json(c, 400, { error: "La referencia al texto no es válida" });
  }

  try {
    if (req.method === "DELETE") {
      await c.env.DB.prepare("DELETE FROM site_texts WHERE page_path = ? AND selector = ?")
        .bind(pagePath, selector).run();
      return json(c, 200, { ok: true });
    }

    const text = body.text;
    const sourceText = body.sourceText;
    if (typeof text !== "string" || text.length > MAX_TEXT || typeof sourceText !== "string" || sourceText.length > MAX_TEXT) {
      return json(c, 400, { error: `El texto debe tener hasta ${MAX_TEXT} caracteres` });
    }
    await c.env.DB.prepare(
      `INSERT INTO site_texts (page_path,selector,source_text,text,updated_by,updated_at)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(page_path,selector) DO UPDATE SET
         source_text = excluded.source_text, text = excluded.text,
         updated_by = excluded.updated_by, updated_at = excluded.updated_at`
    ).bind(pagePath, selector, sourceText, text, access.user.username, new Date().toISOString()).run();
    return json(c, 200, { ok: true });
  } catch (error) {
    console.error("no se pudo guardar el texto global", error);
    return json(c, 500, { error: "No se pudo guardar el texto" });
  }
}
