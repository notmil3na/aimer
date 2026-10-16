import {
  admin,
  envReady,
  json,
  readBody,
  verifyPassword,
  hashPassword,
  signToken,
  publicUser,
} from "../_lib.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!envReady() || !admin) return json(res, 500, { error: "Configuración del servidor incompleta" });

  const { username, password } = await readBody(req);
  if (!username || !password) return json(res, 400, { error: "Faltan datos" });

  const { data, error } = await admin
    .from("users")
    .select("*")
    .eq("username", String(username).trim())
    .maybeSingle();
  if (error || !data) return json(res, 401, { error: "Usuario no encontrado" });

  const ok = await verifyPassword(String(password), data.password);
  if (!ok) return json(res, 401, { error: "Contraseña incorrecta" });

  if (
    typeof data.password === "string" &&
    !data.password.startsWith("scrypt:") &&
    process.env.MAINTENANCE !== "1"
  ) {
    const hashed = await hashPassword(String(password));
    await admin.from("users").update({ password: hashed }).eq("username", data.username);
  }

  const { data: userData } = await admin
    .from("user_data")
    .select("*")
    .eq("username", data.username)
    .maybeSingle();

  return json(res, 200, {
    token: signToken({ username: data.username }),
    user: publicUser(data),
    data: userData || null,
  });
}
