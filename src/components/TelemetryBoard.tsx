import type { TelemetryCard, AgentAction } from '../lib/types';

const actionMeta: Record<AgentAction, { label: string; accent: string; glow: string }> = {
  Thinking: { label: 'Thinking', accent: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100', glow: 'from-cyan-400/10 to-cyan-500/0' },
  Executing: { label: 'Executing', accent: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100', glow: 'from-emerald-400/10 to-emerald-500/0' },
  Handoff: { label: 'Handoff', accent: 'border-violet-400/30 bg-violet-500/10 text-violet-100', glow: 'from-violet-400/10 to-violet-500/0' },
};

const actionOrder: AgentAction[] = ['Thinking', 'Executing', 'Handoff'];

interface Props {
  cards: TelemetryCard[];
}

export function TelemetryBoard({ cards }: Props) {
  const counts = actionOrder.reduce<Record<AgentAction, number>>((acc, action) => {
    acc[action] = cards.filter((card) => card.action === action).length;
    return acc;
  }, { Thinking: 0, Executing: 0, Handoff: 0 });

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      {actionOrder.map((action) => {
        const columnCards = cards.filter((card) => card.action === action);
        const meta = actionMeta[action];

        return (
          <div key={action} className={`rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-glow backdrop-blur ${meta.glow}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Live lane</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{meta.label}</h2>
              </div>
              <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${meta.accent}`}>{counts[action]}</span>
            </div>

            <div className="space-y-3">
              {columnCards.length === 0 ? (
                <EmptyLane label={action} />
              ) : (
                columnCards.map((card) => <TelemetryCardItem key={card.id} card={card} />)
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function EmptyLane({ label }: { label: AgentAction }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
      אין כרגע אירועים ב-<span className="font-semibold text-slate-200">{label}</span>
    </div>
  );
}

function TelemetryCardItem({ card }: { card: TelemetryCard }) {
  const taskTone =
    card.taskStatus === 'Done'
      ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/20'
      : card.taskStatus === 'Failed'
        ? 'bg-rose-500/15 text-rose-200 ring-rose-400/20'
        : 'bg-amber-500/15 text-amber-200 ring-amber-400/20';

  return (
    <article className="group rounded-2xl border border-white/10 bg-slate-900/70 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-sky-400/30 hover:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{card.projectName}</p>
          <h3 className="mt-1 text-base font-semibold text-white">{card.agentName}</h3>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${taskTone}`}>{card.taskStatus}</span>
          <span className="text-xs text-slate-500">{formatTimestamp(card.createdAt)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-3 text-sm leading-6 text-slate-200">
        {card.content}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>Task: {card.taskId.slice(0, 8)}</span>
        <span className="rounded-full border border-white/5 px-2 py-1 text-slate-300">{card.action}</span>
      </div>
    </article>
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
  }).format(date);
}
