CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  difficulty   TEXT NOT NULL CHECK (difficulty IN ('facil', 'medio', 'dificil')),
  description  TEXT NOT NULL DEFAULT '',
  impl_guide   TEXT NOT NULL DEFAULT '',
  done         BOOLEAN NOT NULL DEFAULT FALSE,
  is_custom    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_difficulty ON tasks (difficulty);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks (updated_at);
