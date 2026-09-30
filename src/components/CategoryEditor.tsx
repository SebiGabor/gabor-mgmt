import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { db, q, run } from '../lib/db';

type Row = { id: number; name: string; color?: string };
type Ref = [table: string, col: string];
/** nameRefs: tabele care rețin NUMELE categoriei (se redenumesc/reasignează); idRefs: tabele care rețin ID-ul (se șterg rândurile). */
export default function CategoryEditor({ title, table, colors, nameRefs = [], idRefs = [], onClose }:
  { title: string; table: string; colors?: boolean; nameRefs?: Ref[]; idRefs?: Ref[]; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [nn, setNn] = useState('');
  const load = useCallback(async () => setRows(await q<Row>(`SELECT * FROM ${table} ORDER BY sort,id`)), [table]);
  useEffect(() => { load(); }, [load]);

  async function rename(r: Row, raw: string) {
    const name = raw.trim();
    if (!name || name === r.name) return load();
    try {
      await db.batch([{ sql: `UPDATE ${table} SET name=? WHERE id=?`, args: [name, r.id] },
        ...nameRefs.map(([t, c]) => ({ sql: `UPDATE ${t} SET ${c}=? WHERE ${c}=?`, args: [name, r.name] }))], 'write');
    } catch { alert('Numele există deja.'); }
    load();
  }
  async function del(r: Row) {
    const other = rows.find(x => x.id !== r.id);
    if (!other) return alert('Păstrează cel puțin o categorie.');
    const extra = nameRefs.length ? ` Elementele ei vor trece la „${other.name}".` : idRefs.length ? ' Procentele ei din toate lunile se șterg.' : '';
    if (!confirm(`Ștergi „${r.name}"?${extra}`)) return;
    await db.batch([
      ...nameRefs.map(([t, c]) => ({ sql: `UPDATE ${t} SET ${c}=? WHERE ${c}=?`, args: [other.name, r.name] })),
      ...idRefs.map(([t, c]) => ({ sql: `DELETE FROM ${t} WHERE ${c}=?`, args: [r.id] })),
      { sql: `DELETE FROM ${table} WHERE id=?`, args: [r.id] }], 'write');
    load();
  }
  async function add() {
    const name = nn.trim(); if (!name) return;
    try {
      await run(colors ? `INSERT INTO ${table}(name,color,sort) VALUES(?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM ${table}))`
        : `INSERT INTO ${table}(name,sort) VALUES(?,(SELECT COALESCE(MAX(sort),0)+1 FROM ${table}))`, colors ? [name, '#14b8a6'] : [name]);
    } catch { alert('Numele există deja.'); }
    setNn(''); load();
  }
  const inp = 'rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-violet-500';
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end md:items-center justify-center" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full md:max-w-md max-h-[85dvh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-zinc-950 border border-zinc-800 p-4 space-y-2">
        <div className="flex items-center justify-between"><h3 className="font-semibold">{title}</h3><button aria-label="Închide" onClick={onClose} className="p-1"><X size={20} /></button></div>
        {rows.map(r => (
          <div key={r.id + r.name + (r.color ?? '')} className="flex items-center gap-2">
            {colors && <input type="color" defaultValue={r.color} onChange={e => run(`UPDATE ${table} SET color=? WHERE id=?`, [e.target.value, r.id])} onBlur={load} className="size-9 shrink-0 rounded-lg bg-transparent border-0 p-0" />}
            <input defaultValue={r.name} onBlur={e => rename(r, e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className={inp + ' flex-1 min-w-0'} />
            <button aria-label="Șterge" onClick={() => del(r)} className="p-2 text-zinc-500 hover:text-red-400"><Trash2 size={18} /></button>
          </div>))}
        <div className="flex gap-2 pt-2">
          <input value={nn} onChange={e => setNn(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Categorie nouă" className={inp + ' flex-1 min-w-0'} />
          <button aria-label="Adaugă" onClick={add} className="rounded-xl bg-violet-600 px-3"><Plus size={18} /></button>
        </div>
      </div>
    </div>
  );
}
