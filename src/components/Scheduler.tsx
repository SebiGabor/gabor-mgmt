import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import clsx from 'clsx';
import { q, run } from '../lib/db';
import CategoryEditor from './CategoryEditor';

type Block = { id: number; date: string; start_min: number; end_min: number; title: string; kind: string; task_id: number | null };
type Cat = { id: number; name: string; color: string };
type Task = { id: number; title: string; est_minutes: number };
type Edit = { id?: number; start: number; end: number; title: string; kind: string; task_id: number | null };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const STEP = 10; // minute; 1 minut = 1px
const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (v: string, isEnd = false) => { const [h, m] = v.split(':').map(Number), x = h * 60 + m; return isEnd && x === 0 ? 1440 : x; };
const snap = (m: number) => Math.round(m / STEP) * STEP;
const shift = (d: string, n: number) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('sv'); };
const len = (t: Task) => Math.max(STEP, Math.ceil(t.est_minutes / STEP) * STEP);
const inp = 'w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-violet-500';

export default function Scheduler() {
  const [date, setDate] = useState(new Date().toLocaleDateString('sv'));
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [showCats, setShowCats] = useState(false);
  const [taskId, setTaskId] = useState('');
  const [now, setNow] = useState(nowMin());
  const gridRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<{ id: number; s: number; e: number } | null>(null);
  const ghostRef = useRef<typeof ghost>(null);
  const drag = useRef<{ id: number; mode: 'move' | 'resize'; y0: number; s0: number; e0: number; moved: boolean } | null>(null);

  const load = useCallback(async () => {
    setBlocks(await q<Block>('SELECT * FROM time_blocks WHERE date=? ORDER BY start_min', [date]));
    setCats(await q<Cat>('SELECT id,name,color FROM block_categories ORDER BY sort,id'));
    setTasks(await q<Task>('SELECT id,title,est_minutes FROM tasks WHERE done=0 ORDER BY due_at IS NULL, due_at'));
  }, [date]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { const i = setInterval(() => setNow(nowMin()), 30000); return () => clearInterval(i); }, []);
  const isToday = date === new Date().toLocaleDateString('sv');
  useEffect(() => { // la deschiderea zilei curente, derulează în dreptul orei curente
    if (isToday && gridRef.current) window.scrollTo({ top: gridRef.current.getBoundingClientRect().top + window.scrollY + nowMin() - 200, behavior: 'smooth' });
  }, [isToday]);

  const color = (k: string) => cats.find(c => c.name === k)?.color ?? '#52525b';
  const free = (s: number, e: number, ignore = 0) => !blocks.some(b => b.id !== ignore && b.start_min < e && b.end_min > s);

  async function save() {
    if (!edit) return;
    const { id, start, end, title, kind, task_id } = edit;
    if (start < 0 || end > 1440 || end <= start) return alert('Interval invalid.');
    if (!free(start, end, id ?? 0)) return alert('Interval ocupat.');
    const t = title.trim() || kind;
    if (id) await run('UPDATE time_blocks SET start_min=?,end_min=?,title=?,kind=? WHERE id=?', [start, end, t, kind, id]);
    else await run('INSERT INTO time_blocks(date,start_min,end_min,title,kind,task_id) VALUES(?,?,?,?,?,?)', [date, start, end, t, kind, task_id]);
    setEdit(null); load();
  }
  async function placeTask(t: Task, start: number) {
    const end = Math.min(start + len(t), 1440);
    if (start >= 1440 || !free(start, end)) return alert('Interval ocupat.');
    await run('INSERT INTO time_blocks(date,start_min,end_min,title,kind,task_id) VALUES(?,?,?,?,?,?)', [date, start, end, t.title, cats[0]?.name ?? 'task', t.id]);
    load();
  }
  function quickAssign() {
    const t = tasks.find(x => x.id === +taskId); if (!t) return;
    for (let s = 0; s + len(t) <= 1440; s += STEP) if (free(s, s + len(t))) return placeTask(t, s);
    alert('Nu există loc liber.');
  }

  // ---- drag & drop (mouse + touch) prin pointer events ----
  function begin(e: React.PointerEvent, b: Block, mode: 'move' | 'resize') {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: b.id, mode, y0: e.clientY, s0: b.start_min, e0: b.end_min, moved: false };
  }
  function move(e: React.PointerEvent) {
    const d = drag.current; if (!d) return;
    const dy = e.clientY - d.y0;
    if (Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    const dm = snap(dy), dur = d.e0 - d.s0;
    const g = d.mode === 'move'
      ? (() => { const s = Math.min(Math.max(d.s0 + dm, 0), 1440 - dur); return { id: d.id, s, e: s + dur }; })()
      : { id: d.id, s: d.s0, e: Math.min(Math.max(d.e0 + dm, d.s0 + STEP), 1440) };
    ghostRef.current = g; setGhost(g);
  }
  async function up(b: Block) {
    const d = drag.current, g = ghostRef.current;
    drag.current = null; ghostRef.current = null; setGhost(null);
    if (!d) return;
    if (!d.moved) return setEdit({ id: b.id, start: b.start_min, end: b.end_min, title: b.title, kind: b.kind, task_id: b.task_id });
    if (g && free(g.s, g.e, b.id)) { await run('UPDATE time_blocks SET start_min=?,end_min=? WHERE id=?', [g.s, g.e, b.id]); load(); }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <button aria-label="Ziua anterioară" onClick={() => setDate(shift(date, -1))} className="p-2"><ChevronLeft /></button>
        <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className="bg-transparent text-center font-medium" />
        <div className="flex"><button aria-label="Ziua următoare" onClick={() => setDate(shift(date, 1))} className="p-2"><ChevronRight /></button>
          <button aria-label="Categorii" onClick={() => setShowCats(true)} className="p-2 text-zinc-400"><Settings2 size={20} /></button></div>
      </div>
      <div className="mb-3 flex gap-2">
        <select value={taskId} onChange={e => setTaskId(e.target.value)} className="flex-1 min-w-0 rounded-xl bg-zinc-900 border border-zinc-800 px-2 py-2 text-sm">
          <option value="">Task de programat…</option>{tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
        <button onClick={quickAssign} className="rounded-xl bg-violet-600 px-3 text-sm">Programează</button>
      </div>
      <div ref={gridRef} className="relative rounded-2xl border border-zinc-800 bg-zinc-900/40 select-none" style={{ height: 1440 }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { const t = tasks.find(x => x.id === +e.dataTransfer.getData('task')); if (!t) return; const r = e.currentTarget.getBoundingClientRect(); placeTask(t, Math.floor((e.clientY - r.top) / STEP) * STEP); }}
        onClick={e => { if ((e.target as HTMLElement).closest('[data-block]')) return; const r = e.currentTarget.getBoundingClientRect(); const s = Math.min(Math.floor((e.clientY - r.top) / STEP) * STEP, 1430); setEdit({ start: s, end: Math.min(s + 30, 1440), title: '', kind: cats[0]?.name ?? 'task', task_id: null }); }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ top: h * 60, height: 60 }} className="absolute inset-x-0 border-t border-zinc-800 pointer-events-none">
            <span className="pl-2 text-[11px] text-zinc-500">{hm(h * 60)}</span>
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-zinc-800/60" />
          </div>))}
        {blocks.map(b => {
          const g = ghost?.id === b.id ? ghost : null, s = g?.s ?? b.start_min, e = g?.e ?? b.end_min, h = e - s;
          return (
            <div key={b.id} data-block style={{ top: s, height: h - 1, background: color(b.kind), touchAction: 'none', opacity: g ? 0.8 : 1 }}
              onPointerDown={ev => begin(ev, b, 'move')} onPointerMove={move} onPointerUp={() => up(b)} onPointerCancel={() => { drag.current = null; ghostRef.current = null; setGhost(null); }}
              className={clsx('absolute left-12 right-2 rounded-md px-2 overflow-hidden cursor-grab active:cursor-grabbing', g && 'ring-2 ring-white/70 z-10', h < 20 ? 'text-[10px] leading-[11px]' : 'text-xs py-0.5')}>
              <b className="block truncate">{b.title}</b>
              {h >= 34 && <span className="opacity-75">{hm(s)}–{hm(e)}</span>}
              <div onPointerDown={ev => { ev.stopPropagation(); begin(ev, b, 'resize'); }} className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize bg-white/25" />
            </div>);
        })}
        {isToday && (
          <div className="absolute inset-x-0 z-20 pointer-events-none flex items-center" style={{ top: now - 4 }}>
            <span className="ml-1 rounded bg-red-500 px-1 text-[10px] font-medium leading-4">{hm(now)}</span>
            <div className="flex-1 h-px bg-red-500" />
            <span className="size-2 rounded-full bg-red-500 mr-1" />
          </div>)}
      </div>
      <div className="hidden md:block mt-3 text-xs text-zinc-500">Trage un task în orar:{' '}
        {tasks.slice(0, 6).map(t => <span key={t.id} draggable onDragStart={e => e.dataTransfer.setData('task', String(t.id))} className="inline-block m-1 cursor-grab rounded-full bg-zinc-800 px-2 py-1 text-zinc-300">{t.title}</span>)}</div>
      {edit && <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center justify-center" onClick={() => setEdit(null)}>
        <div onClick={e => e.stopPropagation()} className="w-full md:max-w-sm rounded-t-3xl md:rounded-3xl bg-zinc-950 border border-zinc-800 p-4 space-y-2.5">
          <input autoFocus value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} placeholder="Titlu" className={inp} />
          <div className="flex flex-wrap gap-1.5">{cats.map(c => <button key={c.id} onClick={() => setEdit({ ...edit, kind: c.name })} style={{ background: c.color }}
            className={clsx('rounded-full px-3 py-1 text-xs', edit.kind === c.name ? 'ring-2 ring-white' : 'opacity-55')}>{c.name}</button>)}</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-400">Start<input type="time" step={600} value={hm(edit.start)} onChange={e => e.target.value && setEdit({ ...edit, start: toMin(e.target.value) })} className={inp} /></label>
            <label className="text-xs text-zinc-400">Sfârșit<input type="time" step={600} value={hm(edit.end)} onChange={e => e.target.value && setEdit({ ...edit, end: toMin(e.target.value, true) })} className={inp} /></label>
          </div>
          <div className="flex gap-2">
            {edit.id && <button onClick={async () => { await run('DELETE FROM time_blocks WHERE id=?', [edit.id]); setEdit(null); load(); }} className="rounded-xl bg-red-500/20 text-red-300 px-4 py-2.5">Șterge</button>}
            <button onClick={save} className="flex-1 rounded-xl bg-violet-600 py-2.5 font-medium">{edit.id ? 'Salvează' : 'Adaugă'}</button>
          </div>
        </div></div>}
      {showCats && <CategoryEditor title="Categorii calendar" table="block_categories" colors nameRefs={[['time_blocks', 'kind']]} onClose={() => { setShowCats(false); load(); }} />}
    </section>
  );
}
