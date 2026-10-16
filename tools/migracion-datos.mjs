// exporta los datos de supabase y genera SQL de inserción para D1.
// uso: node tools/migracion-datos.mjs [salida.sql]
//   - lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env / .env.local
//   - escribe INSERT OR REPLACE ... para cada tabla en el orden que respeta las FKs
// luego:  npx wrangler d1 execute aimer --remote --file tools/dump-d1.sql
import fs from "node:fs";

function loadEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const URL_BASE = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OUT = process.argv[2] || "tools/dump-d1.sql";
if (!URL_BASE || !KEY) {
  console.error("faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno");
  process.exit(1);
}

// columnas de cada tabla tal como existen en D1 (el orden importa para las FKs)
const SCHEMA = {
  users: ["username", "password", "name", "university", "career", "semester", "ingreso_corte", "photo", "app_mode", "app_theme", "theme_colors", "border_radius", "font_scale", "font_body", "security_question", "security_answer"],
  user_data: ["username", "malla", "notas", "cursando", "horario", "plan", "calendario", "asignaciones", "ajustes", "notasclase"],
  friendships: ["user_username", "friend_username", "status", "requested_by", "created_at", "updated_at"],
  conversations: ["id", "channel_token", "created_at", "updated_at"],
  conversation_members: ["conversation_id", "username", "joined_at", "last_read_at", "pinned_at", "cleared_at", "hidden_at"],
  conversation_pairs: ["conversation_id", "user_a", "user_b"],
  messages: ["id", "conversation_id", "sender", "message_type", "content", "read", "created_at", "deleted_at"],
  message_attachments: ["id", "message_id", "storage_path", "file_name", "mime_type", "file_size", "created_at"],
  message_academic_items: ["id", "message_id", "item_type", "subject_id", "assignment_id", "note_id", "item_payload", "created_at"],
};

// claves primarias de cada tabla (para el upsert ON CONFLICT ... DO UPDATE,
// que a diferencia de INSERT OR REPLACE no borra la fila -> no dispara
// los ON DELETE CASCADE del esquema de D1)
const PK = {
  users: ["username"],
  user_data: ["username"],
  friendships: ["user_username", "friend_username"],
  conversations: ["id"],
  conversation_members: ["conversation_id", "username"],
  conversation_pairs: ["conversation_id"],
  messages: ["id"],
  message_attachments: ["id"],
  message_academic_items: ["id"],
};

// columnas que en supabase son jsonb y en D1 son TEXT
const JSON_COLS = new Set(["theme_colors", "malla", "notas", "cursando", "horario", "plan", "calendario", "asignaciones", "ajustes", "notasclase", "item_payload"]);
// columnas booleanas (en D1 son INTEGER 0/1)
const BOOL_COLS = new Set(["read"]);

function sqlValue(col, v) {
  if (v === null || v === undefined) return "NULL";
  if (BOOL_COLS.has(col)) return v ? "1" : "0";
  if (JSON_COLS.has(col)) {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return quote(s);
  }
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return quote(String(v));
}

function quote(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

async function fetchAll(table) {
  const rows = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const r = await fetch(`${URL_BASE}/rest/v1/${table}?select=*&limit=${page}&offset=${offset}`, {
      headers: { apikey: KEY, authorization: `Bearer ${KEY}` },
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${table}: ${r.status} ${text.slice(0, 200)}`);
    const batch = JSON.parse(text);
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}

const lines = [];
lines.push("-- dump de supabase para D1 (generado por tools/migracion-datos.mjs)");
lines.push("PRAGMA foreign_keys = OFF;");
const report = [];
for (const [table, cols] of Object.entries(SCHEMA)) {
  let rows = [];
  try {
    rows = await fetchAll(table);
  } catch (e) {
    console.error(`ERROR al leer ${table}: ${e.message}`);
    process.exitCode = 1;
    continue;
  }
  if (rows.length === 0) { report.push(`${table}: 0`); continue; }
  lines.push(`-- ${table}: ${rows.length} filas`);
  const collist = cols.join(", ");
  const pkCols = PK[table];
  const conflict = pkCols.join(", ");
  const updateCols = cols.filter((c) => !pkCols.includes(c));
  for (const row of rows) {
    const vals = cols.map((c) => sqlValue(c, row[c]));
    const suffix =
      updateCols.length === 0
        ? `ON CONFLICT(${conflict}) DO NOTHING`
        : `ON CONFLICT(${conflict}) DO UPDATE SET ${updateCols
            .map((c) => `${c}=excluded.${c}`)
            .join(", ")}`;
    lines.push(`INSERT INTO ${table} (${collist}) VALUES (${vals.join(", ")}) ${suffix};`);
  }
  report.push(`${table}: ${rows.length}`);
}
lines.push("PRAGMA foreign_keys = ON;");

fs.mkdirSync("tools", { recursive: true });
fs.writeFileSync(OUT, lines.join("\n") + "\n");
console.log("generado " + OUT);
console.log(report.join("\n"));
