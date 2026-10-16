-- esquema de Aimer para Cloudflare D1 (sqlite).
-- equivale al esquema de supabase; las columnas jsonb pasan a TEXT (JSON serializado)
-- y los timestamptz a TEXT (ISO 8601). los uuid se generan en el código.

CREATE TABLE IF NOT EXISTS users (
  username          TEXT PRIMARY KEY,
  password          TEXT,
  name              TEXT,
  university        TEXT,
  career            TEXT,
  semester          INTEGER,
  ingreso_corte     TEXT,
  photo             TEXT,
  app_mode          TEXT,
  app_theme         TEXT,
  theme_colors      TEXT,
  border_radius     INTEGER,
  font_scale        REAL,
  font_body         TEXT,
  security_question TEXT,
  security_answer   TEXT
);

CREATE TABLE IF NOT EXISTS user_data (
  username    TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
  malla       TEXT,
  notas       TEXT,
  cursando    TEXT,
  horario     TEXT,
  plan        TEXT,
  calendario  TEXT,
  asignaciones TEXT,
  ajustes     TEXT,
  notasclase  TEXT
);

CREATE TABLE IF NOT EXISTS friendships (
  user_username   TEXT NOT NULL,
  friend_username TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pendiente',
  requested_by    TEXT,
  created_at      TEXT,
  updated_at      TEXT,
  PRIMARY KEY (user_username, friend_username)
);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_username);

CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  channel_token TEXT NOT NULL,
  created_at    TEXT,
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  username        TEXT NOT NULL,
  joined_at       TEXT,
  last_read_at    TEXT,
  pinned_at       TEXT,
  cleared_at      TEXT,
  hidden_at       TEXT,
  PRIMARY KEY (conversation_id, username)
);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(username);

CREATE TABLE IF NOT EXISTS conversation_pairs (
  conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  user_a          TEXT NOT NULL,
  user_b          TEXT NOT NULL,
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender          TEXT NOT NULL,
  message_type    TEXT NOT NULL DEFAULT 'text',
  content         TEXT,
  read            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT,
  deleted_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS message_attachments (
  id           TEXT PRIMARY KEY,
  message_id   TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  storage_path TEXT,
  file_name    TEXT,
  mime_type    TEXT,
  file_size    INTEGER,
  created_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);

CREATE TABLE IF NOT EXISTS message_academic_items (
  id            TEXT PRIMARY KEY,
  message_id    TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  item_type     TEXT,
  subject_id    TEXT,
  assignment_id TEXT,
  note_id       TEXT,
  item_payload  TEXT,
  created_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_message_academic_items_message ON message_academic_items(message_id);
