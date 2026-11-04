-- Control de concurrencia y versiones para sincronización multi-dispositivo en user_data.
ALTER TABLE user_data ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_data ADD COLUMN updated_at TEXT;
