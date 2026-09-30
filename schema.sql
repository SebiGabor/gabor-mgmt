PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS task_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS block_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(title) > 0),
  notes TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Personal',
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Urgent','High','Medium','Low')),
  est_minutes INTEGER NOT NULL DEFAULT 60 CHECK (est_minutes > 0),
  due_at TEXT,
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(done, due_at);
CREATE TABLE IF NOT EXISTS time_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
  end_min INTEGER NOT NULL CHECK (end_min BETWEEN 1 AND 1440),
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'task',
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  CHECK (end_min > start_min)
);
CREATE INDEX IF NOT EXISTS idx_blocks_date ON time_blocks(date, start_min);
CREATE TABLE IF NOT EXISTS budget_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS monthly_budgets (
  month TEXT PRIMARY KEY CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  salary_ron REAL NOT NULL DEFAULT 0 CHECK (salary_ron >= 0)
);
CREATE TABLE IF NOT EXISTS budget_allocations (
  month TEXT NOT NULL REFERENCES monthly_budgets(month) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  percent REAL NOT NULL CHECK (percent >= 0 AND percent <= 100),
  amount_ron REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (month, category_id)
);
