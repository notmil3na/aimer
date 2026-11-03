import { clearSessionCookie, json, vreq } from "../../lib.js";

// cierra la sesión del navegador borrando la cookie HttpOnly. El JWT sigue
// siendo válido hasta que expire, pero el cliente ya no lo tiene.
export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "POST") return json(c, 405, { error: "method" });
  clearSessionCookie(c);
  return json(c, 200, { ok: true });
}
