import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Copy, Save, Settings2 } from 'lucide-react';
import clsx from 'clsx';
import { db, q } from '../lib/db';
import CategoryEditor from './CategoryEditor';

type Cat = { id: number; name: string };
const ym = (d: Date) => d.toLocaleDateString('sv').slice(0, 7);
const step = (m: string, n: number) => { const d = new Date(m + '-15'); d.setMonth(d.getMonth() + n); return ym(d); };
const ron = (n: number) => new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(n);
const inp = 'rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-violet-500';

export default function Finance() {
  const [month, setMonth] = useState(ym(new Date()));
  const [cats, setCats] = useState<Cat[]>([]);
  const [pct, setPct] = useState<Record<number, number>>({});
  const [salary, setSalary] = useState(0);
  const [showCats, setShowCats] = useState(false);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    setCats(await q<Cat>('SELECT id,name FROM budget_categories ORDER BY sort,id'));
    const b = await q<{ salary_ron: number }>('SELECT salary_ron FROM monthly_budgets WHERE month=?', [month]);
    const a = await q<{ category_id: number; percent: number }>('SELECT category_id,percent FROM budget_allocations WHERE month=?', [month]);
    setSalary(b[0]?.salary_ron ?? 0); setPct(Object.fromEntries(a.map(x => [x.category_id, x.percent]))); setMsg('');
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const total = Math.round(cats.reduce((s, c) => s + (pct[c.id] || 0), 0) * 100) / 100;
  const ok = total === 100, diff = Math.round((100 - total) * 100) / 100;
  async function save() {
    if (!ok) return;
    await db.batch([
      { sql: 'INSERT INTO monthly_budgets(month,salary_ron) VALUES(?,?) ON CONFLICT(month) DO UPDATE SET salary_ron=excluded.salary_ron', args: [month, salary] },
      { sql: 'DELETE FROM budget_allocations WHERE month=?', args: [month] },
      ...cats.map(c => ({ sql: 'INSERT INTO budget_allocations(month,category_id,percent,amount_ron) VALUES(?,?,?,?)', args: [month, c.id, pct[c.id] || 0, +(salary * (pct[c.id] || 0) / 100).toFixed(2)] })),
    ], 'write');
    setMsg('Salvat ✓');
  }
  async function copyPrev() {
    const a = await q<{ category_id: number; percent: number }>('SELECT category_id,percent FROM budget_allocations WHERE month=?', [step(month, -1)]);
    if (!a.length) return setMsg('Luna precedentă nu are date.');
    setPct(Object.fromEntries(a.map(x => [x.category_id, x.percent])));
  }
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <button aria-label="Luna anterioară" onClick={() => setMonth(step(month, -1))} className="p-2"><ChevronLeft /></button>
        <div className="text-center"><p className="font-semibold">{month}</p>{month === ym(new Date()) && <p className="text-xs text-violet-400">luna curentă</p>}</div>
        <button aria-label="Luna următoare" onClick={() => setMonth(step(month, 1))} className="p-2"><ChevronRight /></button>
      </div>
      <label className="block"><span className="text-sm text-zinc-400">Salariu net (RON)</span>
        <input type="number" inputMode="decimal" min={0} value={salary || ''} onChange={e => setSalary(+e.target.value)} className={clsx(inp, 'w-full mt-1 text-lg')} /></label>
      <div className="space-y-2">
        {cats.map(c => { const p = pct[c.id] || 0; return (
          <div key={c.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="flex items-center justify-between gap-2"><span className="font-medium">{c.name}</span>
              <div className="flex items-center gap-1"><input type="number" inputMode="decimal" min={0} max={100} value={p || ''} onChange={e => setPct({ ...pct, [c.id]: Math.min(100, +e.target.value) })} className={clsx(inp, 'w-20 text-right')} /><span className="text-zinc-500">%</span></div></div>
            <input type="range" min={0} max={100} step={0.5} value={p} onChange={e => setPct({ ...pct, [c.id]: +e.target.value })} className="w-full accent-violet-500 my-1" />
            <p className="text-right text-lg font-semibold text-violet-300">{ron(salary * p / 100)}</p>
          </div>); })}
      </div>
      <div className={clsx('rounded-2xl p-3', ok ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
        <div className="flex justify-between text-sm"><span>Total: {total}%</span><span className={ok ? 'text-emerald-300' : 'text-red-300'}>{ok ? 'Perfect 100%' : diff > 0 ? `Mai ai de alocat ${diff}%` : `Depășit cu ${-diff}%`}</span></div>
        <div className="mt-2 h-2 rounded-full bg-zinc-800 overflow-hidden"><div className={clsx('h-full transition-all', ok ? 'bg-emerald-500' : total > 100 ? 'bg-red-500' : 'bg-amber-500')} style={{ width: `${Math.min(total, 100)}%` }} /></div>
      </div>
      <div className="flex gap-2">
        <button onClick={copyPrev} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 py-2.5 text-sm"><Copy size={16} />Din luna precedentă</button>
        <button disabled={!ok} onClick={save} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-medium disabled:opacity-40"><Save size={16} />Salvează</button>
      </div>
      {msg && <p className="text-center text-sm text-zinc-400">{msg}</p>}
      <button onClick={() => setShowCats(true)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 py-2.5 text-sm text-zinc-300"><Settings2 size={16} />Gestionează categoriile</button>
      {showCats && <CategoryEditor title="Categorii buget" table="budget_categories" idRefs={[['budget_allocations', 'category_id']]} onClose={() => { setShowCats(false); load(); }} />}
    </section>
  );
}
