-- Registro de subidas de adjuntos del chat.
-- Permite aplicar una cuota de R2 por usuario y saber qué enlaces siguen
-- pendientes, de modo que un enlace consumido no pueda sobrescribir el
-- adjunto de un mensaje ya enviado.
CREATE TABLE IF NOT EXISTS chat_uploads (
  path            TEXT PRIMARY KEY,
  username        TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  message_id      TEXT NOT NULL,
  declared_size   INTEGER NOT NULL DEFAULT 0,
  actual_size     INTEGER,
  created_at      TEXT NOT NULL,
  consumed_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_chat_uploads_user ON chat_uploads(username, consumed_at);
-- Un mensaje solo puede tener una subida asociada; así dos peticiones
-- simultáneas no pueden crear rutas distintas para el mismo message_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_uploads_message ON chat_uploads(message_id);
