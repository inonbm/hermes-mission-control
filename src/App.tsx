import { useMemo } from 'react';
import { useMissionControlFeed } from './hooks/useMissionControlFeed';
import { TelemetryBoard } from './components/TelemetryBoard';
import type { AgentAction, AgentName } from './lib/types';

const actionOrder: AgentAction[] = ['Thinking', 'Executing', 'Handoff'];
const agentOrder: AgentName[] = ['CEO', 'frontend_designer', 'Developer', 'QA', 'Content'];

export default function App() {
  const { cards, loading, connected, error, lastSync, refresh } = useMissionControlFeed();

  const overview = useMemo(() => {
    const total = cards.length;
    const activeTasks = new Set(cards.map((card) => card.taskId)).size;
    const lastEvent = cards[0] ?? null;
    const counts = actionOrder.reduce<Record<AgentAction, number>>((acc, action) => {
      acc[action] = cards.filter((card) => card.action === action).length;
      return acc;
    }, { Thinking: 0, Executing: 0, Handoff: 0 });
    const agentCounts = agentOrder.reduce<Record<AgentName, number>>((acc, agent) => {
      acc[agent] = cards.filter((card) => card.agentName === agent).length;
      return acc;
    }, { CEO: 0, frontend_designer: 0, Developer: 0, QA: 0, Content: 0 });

    return { total, activeTasks, lastEvent, counts, agentCounts };
  }, [cards]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl border border-white/10 bg-slate-950/75 p-5 shadow-glow backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Hermes Mission Control</p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              חדר בקרה פנימי, עצמאי ומבודד לסוכני Hermes
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              רשת צמתים חיה המציגה את סוכני Hermes, אירועי טלמטריה, וקווי Handoff מונפשים מתוך Supabase Realtime.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusPill connected={connected} />
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
            >
              רענון
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="אירועים כוללים" value={overview.total} hint="agent_telemetry rows" />
          <StatCard label="משימות פעילות" value={overview.activeTasks} hint="distinct task_id" />
          <StatCard label="Thinking" value={overview.counts.Thinking} hint="sensing and analysis" />
          <StatCard label="Handoff" value={overview.counts.Handoff} hint="handoff events" />
          <StatCard label="Designer" value={overview.agentCounts.frontend_designer} hint="UI/UX Pro Max" />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span>Last sync: {lastSync ? formatTimestamp(lastSync) : 'pending'}</span>
          {overview.lastEvent ? (
            <span>Latest agent: <span className="text-slate-200">{overview.lastEvent.agentName}</span></span>
          ) : null}
        </div>
      </header>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      <TelemetryBoard cards={cards} />

      <footer className="pb-2 text-center text-xs text-slate-500">
        Built for secure operational awareness and live graph visibility.
      </footer>
    </main>
  );
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${connected ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-300 animate-pulse'}`} />
      {connected ? 'Realtime connected' : 'Connecting...'}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{hint}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-300">
      טוען נתוני טלמטריה חיים מהמסד...
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-rose-100">
      <p className="text-sm font-semibold">שגיאת חיבור</p>
      <p className="mt-1 text-sm leading-6 text-rose-100/90">{message}</p>
    </div>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
