import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Check, CalendarPlus, Pencil, Settings2 } from 'lucide-react';
import clsx from 'clsx';
import { q, run } from '../lib/db';
import CategoryEditor from './CategoryEditor';

type Task = { id: number; title: string; notes: string; category: string; priority: string; est_minutes: number; due_at: string | null; done: number };
const PRIOS = ['Urgent', 'High', 'Medium', 'Low'];
const pc: Record<string, string> = { Urgent: 'bg-red-500/20 text-red-300', High: 'bg-orange-500/20 text-orange-300', Medium: 'bg-sky-500/20 text-sky-300', Low: 'bg-zinc-700/50 text-zinc-300' };
const FILTERS = ['Toate', 'Expiră curând', 'Trecute de termen', 'Săptămâna aceasta'] as const;
const inp = 'w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-violet-500';

function left(due: string | null) {
  if (!due) return null;
  const ms = new Date(due).getTime() - Date.now(), h = Math.abs(ms) / 36e5;
  const t = h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} zile`;
  return ms < 0 ? { t: `Depășit cu ${t}`, cls: 'bg-red-500/20 text-red-300' } : { t: `Rămase: ${t}`, cls: ms < 864e5 * 2 ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400' };
}
const today = () => new Date().toLocaleDateString('sv');
const blank = (category: string) => ({ title: '', notes: '', category, priority: 'Medium', est: 60, due: '' });

export default function Tasks() {
  const [list, setList] = useState<Task[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [f, setF] = useState<(typeof FILTERS)[number]>('Toate');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [showCats, setShowCats] = useState(false);
  const [form, setForm] = useState(blank(''));
  const load = useCallback(async () => {
    setList(await q<Task>('SELECT * FROM tasks ORDER BY done, due_at IS NULL, due_at'));
    setCats((await q<{ name: string }>('SELECT name FROM task_categories ORDER BY sort,id')).map(r => r.name));
  }, []);
  useEffect(() => { load(); }, [load]);

  const now = Date.now(), wk = now + 7 * 864e5;
  const shown = list.filter(t => {
    const d = t.due_at ? new Date(t.due_at).getTime() : null;
    if (f === 'Expiră curând') return !t.done && d !== null && d >= now && d < now + 2 * 864e5;
    if (f === 'Trecute de termen') return !t.done && d !== null && d < now;
    if (f === 'Săptămâna aceasta') return d !== null && d >= now && d <= wk;
    return true;
  });
  const openNew = () => { setEditing(null); setForm(blank(cats[0] ?? '')); setOpen(true); };
  const openEdit = (t: Task) => { setEditing(t.id); setForm({ title: t.title, notes: t.notes, category: t.category, priority: t.priority, est: t.est_minutes, due: t.due_at ?? '' }); setOpen(true); };
  async function save() {
    if (!form.title.trim()) return;
    const a = [form.title.trim(), form.notes, form.category, form.priority, form.est, form.due || null];
    if (editing) await run('UPDATE tasks SET title=?,notes=?,category=?,priority=?,est_minutes=?,due_at=? WHERE id=?', [...a, editing]);
    else await run('INSERT INTO tasks(title,notes,category,priority,est_minutes,due_at) VALUES(?,?,?,?,?,?)', a);
    setOpen(false); load();
  }
  async function plan(t: Task) {
    const d = new Date(), start = Math.min(Math.ceil((d.getHours() * 60 + d.getMinutes()) / 10) * 10, 1430);
    const [c] = await q<{ name: string }>('SELECT name FROM block_categories ORDER BY sort,id LIMIT 1');
    await run('INSERT INTO time_blocks(date,start_min,end_min,title,kind,task_id) VALUES(?,?,?,?,?,?)',
      [today(), start, Math.min(start + Math.max(10, Math.ceil(t.est_minutes / 10) * 10), 1440), t.title, c?.name ?? 'task', t.id]);
    alert('Adăugat în calendar, azi. Îl poți muta acolo.');
  }
  return (
    <section>
      <div className="flex gap-2 overflow-x-auto pb-3">
        {FILTERS.map(x => <button key={x} onClick={() => setF(x)} className={clsx('whitespace-nowrap rounded-full px-3 py-1 text-sm', f === x ? 'bg-violet-600' : 'bg-zinc-900 text-zinc-400')}>{x}</button>)}
        <button aria-label="Categorii" onClick={() => setShowCats(true)} className="ml-auto shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-sm text-zinc-400 flex items-center gap-1"><Settings2 size={14} />Categorii</button>
      </div>
      <ul className="space-y-2">
        {shown.map(t => { const l = left(t.due_at); return (
          <li key={t.id} className={clsx('rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 transition', t.done && 'opacity-60')}>
            <div className="flex items-start gap-3">
              <button aria-label="Bifează" onClick={async () => { await run('UPDATE tasks SET done=? WHERE id=?', [t.done ? 0 : 1, t.id]); load(); }}
                className={clsx('mt-0.5 size-6 shrink-0 rounded-full border grid place-items-center active:scale-90 transition', t.done ? 'bg-violet-600 border-violet-600' : 'border-zinc-600')}>{t.done ? <Check size={14} /> : null}</button>
              <div className="flex-1 min-w-0">
                <p className={clsx('font-medium', t.done && 'line-through')}>{t.title}</p>
                {t.notes && <p className="text-sm text-zinc-500">{t.notes}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                  <span className={clsx('rounded-full px-2 py-0.5', pc[t.priority])}>{t.priority}</span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">{t.category} · {t.est_minutes} min</span>
                  {l && !t.done && <span className={clsx('rounded-full px-2 py-0.5', l.cls)}>{l.t}</span>}
                </div>
              </div>
              {t.due_at && !t.done && <button aria-label="Planifică" onClick={() => plan(t)} className="p-1.5 text-zinc-400 hover:text-violet-400"><CalendarPlus size={18} /></button>}
              <button aria-label="Editează" onClick={() => openEdit(t)} className="p-1.5 text-zinc-400 hover:text-violet-400"><Pencil size={18} /></button>
              <button aria-label="Șterge" onClick={async () => { await run('DELETE FROM tasks WHERE id=?', [t.id]); load(); }} className="p-1.5 text-zinc-600 hover:text-red-400"><Trash2 size={18} /></button>
            </div>
          </li>); })}
        {!shown.length && <p className="text-zinc-500 text-center py-10">Niciun task.</p>}
      </ul>
      <button aria-label="Task nou" onClick={openNew} className="fixed right-4 bottom-20 md:bottom-6 size-14 rounded-full bg-violet-600 grid place-items-center shadow-xl active:scale-95"><Plus /></button>
      {open && <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center justify-center" onClick={() => setOpen(false)}>
        <div onClick={e => e.stopPropagation()} className="w-full md:max-w-md rounded-t-3xl md:rounded-3xl bg-zinc-950 border border-zinc-800 p-4 space-y-2.5">
          <input autoFocus className={inp} placeholder="Titlu" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <textarea className={inp} placeholder="Notițe" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className={inp} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {!cats.includes(form.category) && form.category && <option>{form.category}</option>}{cats.map(c => <option key={c}>{c}</option>)}</select>
            <select className={inp} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{PRIOS.map(c => <option key={c}>{c}</option>)}</select>
            <input type="datetime-local" className={inp} value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} />
            <input type="number" min={5} step={5} className={inp} value={form.est} onChange={e => setForm({ ...form, est: +e.target.value || 60 })} />
          </div>
          <button onClick={save} className="w-full rounded-xl bg-violet-600 py-2.5 font-medium">{editing ? 'Salvează' : 'Adaugă'}</button>
        </div></div>}
      {showCats && <CategoryEditor title="Categorii task-uri" table="task_categories" nameRefs={[['tasks', 'category']]} onClose={() => { setShowCats(false); load(); }} />}
    </section>
  );
}
