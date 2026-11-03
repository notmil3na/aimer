ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS site_texts (
  page_path  TEXT NOT NULL,
  selector   TEXT NOT NULL,
  source_text TEXT NOT NULL,
  text       TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (page_path, selector)
);
