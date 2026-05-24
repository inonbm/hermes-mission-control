import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AgentAction, AgentName, ReviewFocus, TelemetryCard } from '../lib/types';

interface Overview {
  total: number;
  activeTasks: number;
  counts: Record<AgentAction, number>;
  agentCounts: Record<AgentName, number>;
  blockingCount: number;
  lastEvent: TelemetryCard | null;
}

interface Props {
  cards: TelemetryCard[];
  overview: Overview;
}

type GraphAgent = AgentName;

const agentOrder: GraphAgent[] = ['CEO', 'frontend_designer', 'Developer', 'QA', 'Content'];
const reviewFocusOrder: ReviewFocus[] = ['Security', 'Logic & Bugs', 'Guidelines', 'Redundancy', 'Maintainability'];

const agentLayout: Record<GraphAgent, { top: string; left: string; width: string }> = {
  CEO: { top: '50%', left: '50%', width: '240px' },
  frontend_designer: { top: '21%', left: '70%', width: '162px' },
  Developer: { top: '43%', left: '86%', width: '162px' },
  QA: { top: '74%', left: '69%', width: '162px' },
  Content: { top: '64%', left: '27%', width: '162px' },
};

export function TelemetryBoard({ cards, overview }: Props) {
  const [selectedAgent, setSelectedAgent] = useState<GraphAgent | null>(null);

  const latestByAgent = useMemo(() => {
    const map = new Map<GraphAgent, TelemetryCard>();
    for (const card of cards) {
      if (!isGraphAgent(card.agentName)) {
        continue;
      }
      if (!map.has(card.agentName)) {
        map.set(card.agentName, card);
      }
    }
    return map;
  }, [cards]);

  const currentTaskId = useMemo(() => cards.find((card) => card.taskStatus === 'In Progress')?.taskId ?? null, [cards]);
  const latestReviewGroupId = useMemo(() => cards.find((card) => card.fanoutGroupId)?.fanoutGroupId ?? null, [cards]);
  const selectedCard = useMemo(() => {
    if (selectedAgent) {
      return latestByAgent.get(selectedAgent) ?? null;
    }
    return overview.lastEvent;
  }, [latestByAgent, overview.lastEvent, selectedAgent]);

  const activeCards = useMemo(() => cards.filter((card) => card.taskStatus === 'In Progress').slice(0, 4), [cards]);
  const feedCards = useMemo(() => cards.slice(0, 7), [cards]);
  const reviewCards = useMemo(() => {
    if (!latestReviewGroupId) {
      return [];
    }

    return cards
      .filter((card) => card.fanoutGroupId === latestReviewGroupId)
      .filter((card) => card.reviewFocus !== null && card.reviewFocus !== undefined)
      .sort((a, b) => reviewFocusOrder.indexOf(a.reviewFocus as ReviewFocus) - reviewFocusOrder.indexOf(b.reviewFocus as ReviewFocus))
      .slice(0, 3);
  }, [cards, latestReviewGroupId]);

  const summaryColumns = useMemo(() => {
    const latestThinking = cards.find((card) => card.action === 'Thinking') ?? null;
    const latestExecuting = cards.find((card) => card.action === 'Executing') ?? null;
    const latestHandoff = cards.find((card) => card.action === 'Handoff') ?? null;
    const latestBlocked = cards.find((card) => card.taskStatus === 'Failed') ?? null;

    return [
      {
        label: 'Thinking',
        count: overview.counts.Thinking,
        badge: 'running',
        title: latestThinking ? summarizeTelemetryContent(latestThinking.content) : 'No current thinking event',
      },
      {
        label: 'Executing',
        count: overview.counts.Executing,
        badge: 'running',
        title: latestExecuting ? summarizeTelemetryContent(latestExecuting.content) : 'No current execution event',
      },
      {
        label: 'Done',
        count: cards.filter((card) => card.taskStatus === 'Done').length,
        badge: 'done',
        title: overview.lastEvent ? overview.lastEvent.projectName : 'No completed item yet',
      },
      {
        label: 'Blocked',
        count: overview.blockingCount,
        badge: 'blocked',
        title: latestBlocked ? summarizeTelemetryContent(latestBlocked.content) : 'No blocking event',
      },
    ];
  }, [cards, overview]);

  return (
    <div className="command-layout">
      <section className="panel command-center">
        <div className="radar-grid" />
        <div className="range-ring ring-one" />
        <div className="range-ring ring-two" />

        <div className="agents-zone">
          {agentOrder.map((agentName) => (
            <AgentCard
              key={agentName}
              agentName={agentName}
              card={latestByAgent.get(agentName) ?? null}
              active={selectedAgent === agentName}
              onSelect={(nextAgent) => {
                setSelectedAgent(nextAgent);
              }}
              layout={agentLayout[agentName]}
            />
          ))}
        </div>

        <div className="core">
          <div className="core-ring" />
          <div>
            <p className="core-kicker">AIS control node</p>
            <div className="core-status-badge">
              <span aria-hidden="true">●</span>
              {overview.blockingCount > 0 ? 'Attention' : 'Running'}
            </div>
            <h2>Hermes</h2>
            <p className="core-subtitle">
              {selectedCard ? summarizeTelemetryContent(selectedCard.content) : 'מרכז פיקוד רדיאלי שמציג טלמטריה חיה, Handoff, ו-QA fanout.'}
            </p>
            <div className="core-stats">
              <span>{overview.activeTasks} פעילים</span>
              <span className="core-dot">•</span>
              <span>{overview.total} אירועים</span>
              <span className="core-dot">•</span>
              <span>{overview.blockingCount} חסימות</span>
            </div>
          </div>
        </div>

        <div className="status-card card-queue">
          <span className="card-label">Queue</span>
          <span className="card-count">{overview.activeTasks}</span>
          <p className="card-task">{currentTaskId ? `Task ${currentTaskId.slice(0, 8)}` : 'No active task'}</p>
          <span className="card-badge badge-running">{overview.counts.Thinking + overview.counts.Executing} running</span>
        </div>

        <div className="status-card card-profiles">
          <span className="card-label">Profiles</span>
          <span className="card-count">{overview.agentCounts.frontend_designer}</span>
          <p className="card-task">Designer control node</p>
          <span className="card-badge badge-done">Live agents</span>
        </div>

        <div className="status-card card-done">
          <span className="card-label">Done</span>
          <span className="card-count">{cards.filter((card) => card.taskStatus === 'Done').length}</span>
          <p className="card-task">Recent completed work</p>
          <span className="card-badge badge-done">green path</span>
        </div>

        <div className="status-card card-blocked">
          <span className="card-label">Blocked</span>
          <span className="card-count">{overview.blockingCount}</span>
          <p className="card-task">Needs review</p>
          <span className="card-badge badge-blocked">amber watch</span>
        </div>

        <div className="kanban-strip">
          {summaryColumns.map((column) => (
            <div className="kanban-col" key={column.label}>
              <div>
                <div className="kanban-col-label">{column.label}</div>
                <div className="kanban-col-count">{column.count}</div>
                <div className="kanban-col-title">{column.title}</div>
              </div>
              <span className={`kanban-col-badge ${column.badge}`}>{column.badge}</span>
            </div>
          ))}
        </div>
      </section>

      <aside className="panel activity-panel">
        <div className="panel-header">
          <p className="eyebrow">Activity stream</p>
          <h3>מרכז פעילות וצפייה מיידית</h3>
          <p className="panel-sub">
            לחיצה על צומת או פריט בזרם פותחת את פרטי הסוכן, המשימה, וקטעי הטלמטריה הרלוונטיים.
          </p>
        </div>

        <div className="activity-scroll">
          {selectedCard ? (
            <section className="panel" style={{ marginBottom: 14, padding: 14 }}>
              <p className="eyebrow">Selected node</p>
              <h3 style={{ marginBottom: 8 }}>{formatAgentName(selectedCard.agentName)}</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                <ActivityMeta label="Task" value={selectedCard.projectName} />
                <ActivityMeta label="Status" value={statusLabel(selectedCard)} />
                <ActivityMeta label="Updated" value={formatTimestamp(selectedCard.createdAt)} />
                {/* review focus intentionally omitted to reduce clutter */}
              </div>
              <p style={{ marginTop: 12, color: 'var(--muted)', fontSize: '.86rem', lineHeight: 1.7 }} dir={textDirection(selectedCard.content)}>
                {summarizeTelemetryContent(selectedCard.content)}
              </p>
            </section>
          ) : null}

          {reviewCards.length > 0 ? (
            <section style={{ marginBottom: 14 }}>
              <p className="eyebrow">Parallel QA swarm</p>
              <div className="activity-feed" style={{ marginTop: 8 }}>
                {reviewCards.map((card) => (
                  <li key={card.id} className="kind-comment" style={{ listStyle: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <strong style={{ color: 'var(--text)' }}>{card.reviewFocus}</strong>
                      <span>{formatTimeAgo(card.createdAt)}</span>
                    </div>
                    <div className="feed-summary" dir={textDirection(summarizeTelemetryContent(card.content))}>
                      {summarizeTelemetryContent(card.content)}
                    </div>
                  </li>
                ))}
              </div>
            </section>
          ) : null}

          <ul className="activity-feed">
            {feedCards.length > 0 ? (
              feedCards.map((card) => {
                const kind = feedKind(card);
                return (
                  <li key={card.id} className={`kind-${kind}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAgent(isGraphAgent(card.agentName) ? card.agentName : null);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        border: 0,
                        padding: 0,
                        margin: 0,
                        background: 'transparent',
                        textAlign: 'inherit',
                        color: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <strong style={{ color: 'var(--text)' }}>{formatAgentName(card.agentName)}</strong>
                        <span>{formatTimeAgo(card.createdAt)}</span>
                      </div>
                      <div style={{ marginTop: 5, color: 'var(--dim)', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                        {card.action} • {statusLabel(card)}
                      </div>
                      <div className="feed-summary" dir={textDirection(summarizeTelemetryContent(card.content))}>
                        {summarizeTelemetryContent(card.content)}
                      </div>
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="feed-placeholder">אין עדיין פעילות להצגה.</li>
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function AgentCard({
  agentName,
  card,
  layout,
  active,
  onSelect,
}: {
  agentName: GraphAgent;
  card: TelemetryCard | null;
  layout: { top: string; left: string; width: string };
  active: boolean;
  onSelect: (agentName: GraphAgent) => void;
}) {
  const isCore = agentName === 'CEO';
  const latestAction = card?.action ?? null;
  const badgeLabel = card ? statusLabel(card) : 'Idle';
  const running = card?.taskStatus === 'In Progress';

  return (
    <div
      className={`agent-card ${active ? 'is-active' : ''}`}
      style={{ top: layout.top, left: layout.left, width: layout.width, transform: 'translate(-50%, -50%)', borderColor: active ? 'rgba(34, 211, 238, 0.55)' : undefined }}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(agentName)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(agentName);
        }
      }}
    >
      <span className="agent-card-name">{formatAgentName(agentName)}</span>
        <div className="brain-wave" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      <p className="agent-card-task" dir={textDirection(card?.projectName ?? '')}>
        {card ? card.projectName : 'No task yet'}
      </p>
      <div className={`card-badge ${running ? 'badge-running' : badgeLabel === 'Idle' ? '' : 'badge-done'}`}>
        <span>{isCore ? 'core' : badgeLabel}</span>
        {latestAction ? <span>• {latestAction}</span> : null}
      </div>
    </div>
  );
}

function ActivityMeta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '100px minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
      <span style={{ color: 'var(--dim)', fontSize: '.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: '.88rem', lineHeight: 1.6 }} dir={textDirection(value)}>
        {value}
      </span>
    </div>
  );
}

function feedKind(card: TelemetryCard): 'completed' | 'claimed' | 'spawned' | 'created' | 'blocked' | 'comment' {
  if (card.taskStatus === 'Done') {
    return 'completed';
  }
  if (card.taskStatus === 'Failed') {
    return 'blocked';
  }
  if (card.action === 'Handoff') {
    return 'claimed';
  }
  if (card.agentName === 'CEO') {
    return 'created';
  }
  if (card.agentName === 'Content') {
    return 'comment';
  }
  return 'spawned';
}

function isGraphAgent(agentName: string): agentName is GraphAgent {
  return agentName === 'CEO' || agentName === 'frontend_designer' || agentName === 'Developer' || agentName === 'QA' || agentName === 'Content';
}

function statusLabel(card: TelemetryCard): string {
  if (card.taskStatus === 'In Progress') {
    return card.action;
  }
  if (card.taskStatus === 'Done') {
    return 'Done';
  }
  return 'Blocked';
}

function formatAgentName(agentName: string): string {
  switch (agentName) {
    case 'frontend_designer':
      return 'Frontend Designer';
    default:
      return agentName;
  }
}

function summarizeTelemetryContent(content: unknown): string {
  const text = typeof content === 'string' ? content : '';
  const cleaned = text
    .replace(/^telegram_message=[^|]+\s*\|\s*/i, '')
    .replace(/^telegram_message_id=[^|]+\s+chat_id=[^|]+\s+from=[^|]+\s*\|\s*/i, '')
    .replace(/\s*\|\s*review_command=.*$/i, '')
    .trim();

  if (/^review_command=/i.test(cleaned)) {
    return 'Review request';
  }

  return cleaned;
}

function textDirection(value: unknown): 'rtl' | 'ltr' {
  const text = typeof value === 'string' ? value : '';
  return /[\u0590-\u05FF]/.test(text) ? 'rtl' : 'ltr';
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

function formatTimeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'just now';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}
