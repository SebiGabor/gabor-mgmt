import { useEffect, useState } from 'react';
import { CalendarClock, ListChecks, Wallet, WifiOff } from 'lucide-react';
import clsx from 'clsx';
import { initSchema } from './lib/db';
import Tasks from './components/Tasks';
import Scheduler from './components/Scheduler';
import Finance from './components/Finance';

const tabs = [
  { id: 'cal', label: 'Calendar', icon: CalendarClock },
  { id: 'tasks', label: 'Task-uri', icon: ListChecks },
  { id: 'fin', label: 'Finanțe', icon: Wallet },
] as const;

export default function App() {
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('cal');
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    initSchema().then(() => setReady(true)).catch(e => setErr(String(e.message || e)));
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  return (
    <div className="min-h-dvh md:flex">
      <nav className="fixed bottom-0 inset-x-0 z-20 flex border-t border-zinc-800 bg-zinc-950/90 backdrop-blur pb-[env(safe-area-inset-bottom)] md:static md:w-52 md:flex-col md:border-t-0 md:border-r md:p-3 md:gap-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex-1 flex flex-col md:flex-row items-center gap-1 md:gap-3 py-3 md:px-3 md:flex-none md:rounded-xl text-xs md:text-sm transition',
              tab === t.id ? 'text-violet-400 md:bg-zinc-900' : 'text-zinc-500 hover:text-zinc-300')}>
            <t.icon size={20} />{t.label}
          </button>))}
      </nav>
      <main className="flex-1 p-4 pb-24 md:pb-6 max-w-3xl w-full mx-auto">
        {(!online || err) && <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-500/10 text-amber-300 px-3 py-2 text-sm"><WifiOff size={16} />{err || 'Offline — modificările nu se pot sincroniza.'}</div>}
        {ready && (tab === 'cal' ? <Scheduler /> : tab === 'tasks' ? <Tasks /> : <Finance />)}
        {!ready && !err && <p className="text-zinc-500">Se conectează la Turso…</p>}
      </main>
    </div>
  );
}
