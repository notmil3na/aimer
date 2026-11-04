import { clearSessionCookie, getToken, json, revokeToken, verifyToken, vreq } from "../../lib.js";

// Cierra la sesión actual: revoca el JWT en D1 y borra la cookie HttpOnly.
// Antes solo se borraba la cookie y el token seguía siendo válido hasta expirar.
export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "POST") return json(c, 405, { error: "method" });

  // Revoke the current session before clearing the cookie.
  const tokens = new Set();
  const cookieToken = getToken(c);
  if (cookieToken) tokens.add(cookieToken);
  for (const token of tokens) {
    const payload = await verifyToken(c, token);
    if (!payload) continue;
    try {
      await revokeToken(c, token, payload);
    } catch (error) {
      // La cookie se borra igual; si D1 falla, el token expirará solo.
      console.error("no se pudo revocar la sesión", error);
    }
  }

  clearSessionCookie(c);
  return json(c, 200, { ok: true });
}
