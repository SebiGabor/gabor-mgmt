import { createClient } from '@libsql/client/web';
import schema from '../../schema.sql?raw';
const url = (import.meta.env.VITE_TURSO_DATABASE_URL as string || '').replace('libsql://', 'https://');
export const db = createClient({ url, authToken: import.meta.env.VITE_TURSO_AUTH_TOKEN as string });
export async function q<T = any>(sql: string, args: any[] = []): Promise<T[]> {
  return (await db.execute({ sql, args })).rows as unknown as T[];
}
export const run = (sql: string, args: any[] = []) => db.execute({ sql, args });

const TASKS_COLS = 'id,title,notes,category,priority,est_minutes,due_at,done,created_at';
const BLOCKS_COLS = 'id,date,start_min,end_min,title,kind,task_id';

// Baze create cu versiunea veche au CHECK pe category/kind: reconstruim tabelele (datele se păstrează).
async function migrate() {
  const sqlOf = async (t: string) => (await q<{ sql: string }>('SELECT sql FROM sqlite_master WHERE name=?', [t]))[0]?.sql || '';
  const [ts, bs] = [await sqlOf('tasks'), await sqlOf('time_blocks')];
  if (!/category IN/.test(ts) && !/kind IN/.test(bs)) return;
  const ddl = (name: string, body: string) => `CREATE TABLE ${name} (${body})`;
  await db.batch([
    ddl('tasks_new', `id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL CHECK (length(title) > 0), notes TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Personal', priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Urgent','High','Medium','Low')), est_minutes INTEGER NOT NULL DEFAULT 60 CHECK (est_minutes > 0), due_at TEXT, done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)), created_at TEXT NOT NULL DEFAULT (datetime('now'))`),
    `INSERT INTO tasks_new(${TASKS_COLS}) SELECT ${TASKS_COLS} FROM tasks`,
    ddl('time_blocks_new', `id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, start_min INTEGER NOT NULL CHECK (start_min BETWEEN 0 AND 1439), end_min INTEGER NOT NULL CHECK (end_min BETWEEN 1 AND 1440), title TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'task', task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL, CHECK (end_min > start_min)`),
    `INSERT INTO time_blocks_new(${BLOCKS_COLS}) SELECT ${BLOCKS_COLS} FROM time_blocks`,
    'DROP TABLE time_blocks', 'DROP TABLE tasks',
    'ALTER TABLE tasks_new RENAME TO tasks', 'ALTER TABLE time_blocks_new RENAME TO time_blocks',
    'CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(done, due_at)',
    'CREATE INDEX IF NOT EXISTS idx_blocks_date ON time_blocks(date, start_min)',
  ], 'write');
}

async function seed(table: string, sql: string, rows: any[][]) {
  const [{ n }] = await q<{ n: number }>(`SELECT COUNT(*) n FROM ${table}`);
  if (!n) await db.batch(rows.map(args => ({ sql, args })), 'write');
}

export async function initSchema() {
  await db.batch(schema.split(/;\s*\n/).map(s => s.trim()).filter(Boolean), 'write');
  await migrate();
  await seed('budget_categories', 'INSERT INTO budget_categories(name,sort) VALUES(?,?)',
    ['Cheltuieli fixe / Nevoi', 'Economii / Investiții', 'Dezvoltare / Educație', 'Stil de viață / Fun'].map((n, i) => [n, i]));
  await seed('task_categories', 'INSERT INTO task_categories(name,sort) VALUES(?,?)',
    ['Facultate/Teme', 'Job', 'Proiecte', 'Personal'].map((n, i) => [n, i]));
  await seed('block_categories', 'INSERT INTO block_categories(name,color,sort) VALUES(?,?,?)', [
    ['task', '#8b5cf6'], ['sleep', '#312e81'], ['class', '#0369a1'], ['meal', '#b45309'], ['gym', '#047857'], ['break', '#52525b'],
  ].map(([n, c], i) => [n, c, i]));
}
