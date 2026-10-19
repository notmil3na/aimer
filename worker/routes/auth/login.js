import { envReady, json, readBody, verifyPassword, hashPassword, signToken, publicUser, HASH_FALSO, vreq } from "../../lib.js";
import { jparse } from "../../db.js";

export async function handler(c) {
  const req = vreq(c);
  if (req.method !== "POST") return json(c, 405, { error: "method" });
  if (!envReady(c.env)) return json(c, 500, { error: "Configuración del servidor incompleta" });

  const { username, password } = await readBody(c);
  if (!username || !password) return json(c, 400, { error: "Faltan datos" });

  const uname = String(username).trim();
  const db = c.env.DB;
  const user = await db.prepare("SELECT * FROM users WHERE username = ?").bind(uname).first();

  // se verifica siempre, contra un hash de relleno si la cuenta no existe: así
  // el tiempo de respuesta no delata qué usuarios están registrados.
  const ok = await verifyPassword(String(password), user ? user.password : HASH_FALSO);
  if (!user || !ok) return json(c, 401, { error: "Usuario o contraseña incorrectos" });

  if (typeof user.password === "string" && !user.password.startsWith("scrypt:")) {
    const hashed = await hashPassword(String(password));
    await db.prepare("UPDATE users SET password = ? WHERE username = ?").bind(hashed, user.username).run();
  }

  const userData = await db.prepare("SELECT * FROM user_data WHERE username = ?").bind(user.username).first();
  const dataOut = userData ? { ...userData } : null;
  if (dataOut) {
    dataOut.malla = jparse(dataOut.malla);
    dataOut.notas = jparse(dataOut.notas);
    dataOut.cursando = jparse(dataOut.cursando);
    dataOut.horario = jparse(dataOut.horario);
    dataOut.plan = jparse(dataOut.plan);
    dataOut.calendario = jparse(dataOut.calendario);
    dataOut.asignaciones = jparse(dataOut.asignaciones);
    dataOut.ajustes = jparse(dataOut.ajustes);
    dataOut.notasclase = jparse(dataOut.notasclase);
  }

  return json(c, 200, {
    token: await signToken(c, { username: user.username }),
    user: publicUser(user),
    data: dataOut || null,
  });
}
