-- Sesiones revocadas (logout real). Guardamos el hash del JWT, no el token,
-- para poder invalidar una sesión concreta sin cerrar las demás.
CREATE TABLE IF NOT EXISTS revoked_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires ON revoked_sessions(expires_at);
