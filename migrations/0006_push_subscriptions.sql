-- Tabla dedicada para suscripciones push Web Push (VAPID).
-- Permite indexar por endpoint y usuario, y evita recorrer todo user_data en el cron.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  subscription TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(username);
