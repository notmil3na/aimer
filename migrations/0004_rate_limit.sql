-- Tabla de intentos fallidos para rate limiting por usuario e IP.
-- Se usa en forgot-password, login, register y change-password.
CREATE TABLE IF NOT EXISTS rate_limits (
  key        TEXT NOT NULL,       -- "forgot:<username>", "login:<ip>", etc.
  attempts   INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,              -- ISO 8601; NULL = no bloqueado
  window_start TEXT NOT NULL,     -- inicio de la ventana actual
  PRIMARY KEY (key)
);
