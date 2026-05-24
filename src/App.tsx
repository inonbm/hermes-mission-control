import { useEffect, useMemo, useState } from 'react';
import { useMissionControlFeed } from './hooks/useMissionControlFeed';
import { TelemetryBoard } from './components/TelemetryBoard';
import type { AgentAction, AgentName } from './lib/types';

const actionOrder: AgentAction[] = ['Thinking', 'Executing', 'Handoff'];
const agentOrder: AgentName[] = ['CEO', 'frontend_designer', 'Developer', 'QA', 'Content'];

export default function App() {
  const { cards, loading, connected, error, lastSync, refresh } = useMissionControlFeed();
  const [reelMode, setReelMode] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('reel-mode', reelMode);
    return () => {
      document.body.classList.remove('reel-mode');
    };
  }, [reelMode]);

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
    const blockingCount = cards.filter((card) => card.taskStatus === 'Failed').length;

    return { total, activeTasks, lastEvent, counts, agentCounts, blockingCount };
  }, [cards]);

  return (
    <main className="dashboard-shell">
      <div className="noise" />
      <div className="orb orb-cyan" />
      <div className="orb orb-violet" />

      <header className="panel command-bar">
        <div className="bar-title">
          <p className="eyebrow">Hermes Mission Control Center v3.0</p>
          <h1>מרכז פיקוד רדיאלי חי לסוכני Hermes</h1>
          <p className="bar-subtitle">
            לוח בקרה רדיאלי חי, נקי ומהודק, עם פוקוס על ליבה מרכזית, זרימת Handoff, וקריאות מבצעית.
          </p>
        </div>

        <div className="bar-state">
          <span className="state-label">System state</span>
          <strong>{connected ? 'Realtime connected' : 'Connecting...'}</strong>
          <small>
            {lastSync ? formatTimestamp(lastSync) : 'pending'}
            {overview.lastEvent ? `  •  ${overview.lastEvent.agentName}` : ''}
          </small>
        </div>

        <div className="bar-controls">
          <button
            type="button"
            onClick={() => void refresh()}
            className="primary-button"
          >
            <span className="button-pulse" />
            רענון עכשיו
          </button>
          <button
            type="button"
            onClick={() => setReelMode((value) => !value)}
            className={`secondary-button ${reelMode ? 'is-active' : ''}`}
          >
            {reelMode ? 'Exit 9:16' : '9:16'}
          </button>
        </div>
      </header>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      <section className="panel" style={{ padding: 0 }}>
        <TelemetryBoard cards={cards} overview={overview} />
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="panel" style={{ padding: '18px 22px', color: 'var(--muted)' }}>
      טוען נתוני טלמטריה חיים מהמסד...
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="panel" style={{ padding: '18px 22px', borderColor: 'rgba(251, 113, 133, 0.26)', background: 'rgba(127, 29, 29, 0.28)', color: '#ffe4e6' }}>
      <p className="text-sm font-semibold">שגיאת חיבור</p>
      <p style={{ marginTop: 6, fontSize: '0.94rem', lineHeight: 1.6 }}>{message}</p>
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
