import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  getSmoothStepPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { AgentAction, ReviewFocus, TelemetryCard } from '../lib/types';

type GraphAgent = 'CEO' | 'frontend_designer' | 'Developer' | 'QA';

type FlowNodeData = {
  agentName: GraphAgent;
  latestAction: AgentAction | null;
  latestTask: string;
  latestTaskStatus: TelemetryCard['taskStatus'] | null;
  latestAt: string | null;
  onSelectAgent?: (agentName: string) => void;
};

type FlowEdgeTone = 'cyan' | 'indigo' | 'emerald' | 'violet';

type FlowEdgeData = {
  label: string;
  tone: FlowEdgeTone;
};

interface Props {
  cards: TelemetryCard[];
}

const agentOrder: GraphAgent[] = ['CEO', 'frontend_designer', 'Developer', 'QA'];
const agentPositions: Record<GraphAgent, { x: number; y: number }> = {
  CEO: { x: 42, y: 132 },
  frontend_designer: { x: 340, y: 34 },
  Developer: { x: 640, y: 126 },
  QA: { x: 930, y: 220 },
};

const nodeTone: Record<GraphAgent, { border: string; glow: string; badge: string; dot: string; accent: string }> = {
  CEO: {
    border: 'border-cyan-400/30',
    glow: 'shadow-[0_0_48px_rgba(34,211,238,0.16)]',
    badge: 'bg-cyan-500/15 text-cyan-100',
    dot: '#22d3ee',
    accent: 'from-cyan-400/16 via-cyan-500/8 to-transparent',
  },
  frontend_designer: {
    border: 'border-indigo-400/30',
    glow: 'shadow-[0_0_48px_rgba(99,102,241,0.18)]',
    badge: 'bg-indigo-500/15 text-indigo-100',
    dot: '#6366f1',
    accent: 'from-indigo-400/16 via-indigo-500/8 to-transparent',
  },
  Developer: {
    border: 'border-emerald-400/30',
    glow: 'shadow-[0_0_48px_rgba(52,211,153,0.16)]',
    badge: 'bg-emerald-500/15 text-emerald-100',
    dot: '#34d399',
    accent: 'from-emerald-400/16 via-emerald-500/8 to-transparent',
  },
  QA: {
    border: 'border-violet-400/30',
    glow: 'shadow-[0_0_48px_rgba(167,139,250,0.18)]',
    badge: 'bg-violet-500/15 text-violet-100',
    dot: '#a78bfa',
    accent: 'from-violet-400/16 via-violet-500/8 to-transparent',
  },
};

const actionTone: Record<AgentAction, { chip: string; ring: string; dot: string }> = {
  Thinking: { chip: 'bg-cyan-500/15 text-cyan-100', ring: 'ring-cyan-400/20', dot: 'bg-cyan-300' },
  Executing: { chip: 'bg-indigo-500/15 text-indigo-100', ring: 'ring-indigo-400/20', dot: 'bg-indigo-300' },
  Handoff: { chip: 'bg-violet-500/15 text-violet-100', ring: 'ring-violet-400/20', dot: 'bg-violet-300' },
};

const reviewFocusOrder: ReviewFocus[] = ['Security', 'Logic & Bugs', 'Guidelines', 'Redundancy', 'Maintainability'];
const reviewTone: Record<ReviewFocus, { border: string; chip: string }> = {
  Security: { border: 'border-rose-400/25', chip: 'bg-rose-500/15 text-rose-100' },
  'Logic & Bugs': { border: 'border-amber-400/25', chip: 'bg-amber-500/15 text-amber-100' },
  Guidelines: { border: 'border-sky-400/25', chip: 'bg-sky-500/15 text-sky-100' },
  Redundancy: { border: 'border-fuchsia-400/25', chip: 'bg-fuchsia-500/15 text-fuchsia-100' },
  Maintainability: { border: 'border-emerald-400/25', chip: 'bg-emerald-500/15 text-emerald-100' },
};

export function TelemetryBoard({ cards }: Props) {
  const [selectedAgent, setSelectedAgent] = useState<GraphAgent | null>(null);
  const [clearedEdgeIds, setClearedEdgeIds] = useState<Set<string>>(() => new Set());

  const handleSelectAgent = useCallback((agentName: string) => {
    setSelectedAgent(agentName as GraphAgent);
  }, []);

  const currentTaskId = useMemo(() => findCurrentTaskId(cards), [cards]);
  const board = useMemo(() => buildFlowModel(cards, currentTaskId, handleSelectAgent), [cards, currentTaskId, handleSelectAgent]);
  const latestEvent = cards[0] ?? null;
  const activeAgents = board.nodes.filter((node) => node.data.latestAction !== null && node.data.latestTaskStatus === 'In Progress').length;
  const latestReviewGroupId = findLatestReviewGroupId(cards);
  const reviewCards = useMemo(() => {
    if (!latestReviewGroupId) {
      return [];
    }

    return cards
      .filter((card) => card.fanoutGroupId === latestReviewGroupId)
      .filter((card) => card.reviewFocus !== null && card.reviewFocus !== undefined)
      .sort((a, b) => reviewFocusOrder.indexOf(a.reviewFocus as ReviewFocus) - reviewFocusOrder.indexOf(b.reviewFocus as ReviewFocus));
  }, [cards, latestReviewGroupId]);

  const selectedCard = useMemo(() => {
    if (!selectedAgent) {
      return null;
    }

    return board.latestByAgent.get(selectedAgent) ?? null;
  }, [board.latestByAgent, selectedAgent]);

  useEffect(() => {
    setClearedEdgeIds(new Set());
    setSelectedAgent(null);
  }, [currentTaskId]);

  const visibleEdges = useMemo(
    () => board.edges.filter((edge) => !clearedEdgeIds.has(edge.id)),
    [board.edges, clearedEdgeIds],
  );

  const handleClearBoard = useCallback(() => {
    setSelectedAgent(null);
    setClearedEdgeIds(new Set(board.edges.map((edge) => edge.id)));
  }, [board.edges]);

  const handleNodeClick = useCallback((_: unknown, node: any) => {
    setSelectedAgent(node.id as GraphAgent);
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,9,11,0.92),rgba(2,6,23,0.88))] p-4 shadow-glow backdrop-blur-2xl sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_30%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_28%)]" />

      <div className="relative z-10 mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Live agent graph</p>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            רשת גרפית חיה של סוכני Hermes
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            כל צומת מייצג את המצב האחרון של סוכן, והקווים מציגים רק את זרימת העבודה הפעילה והנקייה.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <MetricPill label="אירועים" value={cards.length} />
          <MetricPill label="סוכנים פעילים" value={activeAgents} />
          <MetricPill label="Handoff edges" value={visibleEdges.length} />
          <MetricPill label="אחרון" value={latestEvent ? latestEvent.agentName : 'None'} isText />
          <button
            type="button"
            onClick={handleClearBoard}
            className="rounded-full border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-rose-100 transition hover:border-rose-300/50 hover:bg-rose-500/20"
          >
            Clear Board
          </button>
        </div>
      </div>

      <div className="relative z-10 mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span>Latest update: {latestEvent ? formatTimestamp(latestEvent.createdAt) : 'pending'}</span>
        {latestEvent ? <span>Latest action: {latestEvent.action}</span> : null}
        {currentTaskId ? <span>Current task: {currentTaskId.slice(0, 8)}</span> : <span>No active task</span>}
      </div>

      {reviewCards.length > 0 ? <ReviewSwarm cards={reviewCards} /> : null}

      <div className="relative z-10 mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[700px] overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.9),rgba(15,23,42,0.95))] sm:h-[760px]">
          <ReactFlow
            nodes={board.nodes}
            edges={visibleEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag
            panOnScroll
            zoomOnDoubleClick={false}
            onNodeClick={handleNodeClick}
            proOptions={{ hideAttribution: true }}
            minZoom={0.7}
            maxZoom={1.4}
            className="react-flow-shell"
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(148, 163, 184, 0.18)" />
            <MiniMap
              nodeColor={(node) => nodeTone[(node.id as GraphAgent)]?.dot ?? '#64748b'}
              maskColor="rgba(2, 6, 23, 0.72)"
              style={{ background: 'rgba(15, 23, 42, 0.82)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <Controls position="bottom-right" />
          </ReactFlow>
        </div>

        <aside
          className="min-h-[700px] rounded-[2rem] border border-white/10 bg-slate-950/80 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-2xl sm:p-5"
          dir="auto"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Agent details</p>
              <h3 className="font-display mt-2 text-xl font-bold text-white">פאנל צדדי לפי לחיצה על צומת</h3>
            </div>
            {selectedCard ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                Live
              </span>
            ) : null}
          </div>

          {selectedCard ? (
            <div className="mt-5 space-y-4">
              <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Agent</p>
                    <h4 className="font-display mt-1 text-2xl font-bold text-white">{formatAgentName(selectedCard.agentName)}</h4>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(selectedCard)}`}>{statusLabel(selectedCard)}</span>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-300">
                  <DetailRow label="Task" value={selectedCard.projectName} valueClassName="truncate" />
                  <DetailRow label="Status" value={selectedCard.taskStatus} valueClassName={selectedCard.taskStatus === 'Done' ? 'text-emerald-300' : 'text-slate-100'} />
                  <DetailRow label="Updated" value={formatTimestamp(selectedCard.createdAt)} valueClassName="font-display tabular-nums" />
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Live summary</p>
                <p className="mt-2 text-sm leading-7 text-slate-200" dir={textDirection(selectedCard.projectName)}>
                  {selectedCard.projectName}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{summarizeTelemetryContent(selectedCard.content)}</p>
              </section>

              <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/60 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Telemetry meta</p>
                <dl className="mt-3 space-y-3 text-sm">
                  <DetailRow label="Handoff to" value={selectedCard.handoffTo ?? 'None'} />
                  <DetailRow label="Review focus" value={selectedCard.reviewFocus ?? 'None'} />
                  <DetailRow label="Fanout group" value={selectedCard.fanoutGroupId ? selectedCard.fanoutGroupId.slice(-8) : 'None'} valueClassName="font-mono text-xs" />
                  <DetailRow label="Parent event" value={selectedCard.parentEventId ?? 'None'} valueClassName="font-mono text-xs" />
                </dl>
              </section>
            </div>
          ) : (
            <div className="mt-5 flex h-[calc(100%-88px)] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 px-4 text-center text-sm text-slate-400">
              <p className="text-base font-semibold text-slate-200">לחץ פיזית על צומת כדי לפתוח את הפרטים</p>
              <p className="mt-2 leading-7">
                הצמתים עצמם נשארים מינימליסטיים. כל פירוט עמוק יותר מופיע כאן בלבד.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function buildFlowModel(
  cards: TelemetryCard[],
  currentTaskId: string | null,
  selectAgent: (agentName: string) => void,
): { nodes: any[]; edges: any[]; latestByAgent: Map<GraphAgent, TelemetryCard> } {
  const latestByAgent = new Map<GraphAgent, TelemetryCard>();
  const latestHandoffByPair = new Map<string, TelemetryCard>();

  for (const card of cards) {
    const source = toGraphAgent(card.agentName);
    if (!source) {
      continue;
    }

    if (!latestByAgent.has(source)) {
      latestByAgent.set(source, card);
    }

    if (card.action !== 'Handoff' || !currentTaskId || card.taskId !== currentTaskId) {
      continue;
    }

    const target = resolveHandoffTarget(card, source);
    if (!target || target === source) {
      continue;
    }

    const key = `${card.taskId}:${source}->${target}`;
    if (!latestHandoffByPair.has(key)) {
      latestHandoffByPair.set(key, card);
    }
  }

  const nodes = agentOrder.map((agentName) => {
    const latest = latestByAgent.get(agentName) ?? null;
    const borderTone = nodeTone[agentName];
    const taskStatus = latest?.taskStatus ?? null;
    const action = taskStatus === 'In Progress' ? latest?.action ?? null : null;

    return {
      id: agentName,
      type: 'agentNode',
      position: agentPositions[agentName],
      data: {
        agentName,
        latestAction: action,
        latestTask: latest?.projectName ?? 'No task yet',
        latestTaskStatus: taskStatus,
        latestAt: latest?.createdAt ?? null,
        onSelectAgent: selectAgent,
      } satisfies FlowNodeData,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        width: 286,
        background: 'transparent',
        border: 'none',
      },
      className: `${borderTone.glow}`,
      draggable: false,
      selectable: false,
      deletable: false,
      focusable: false,
      hidden: false,
      zIndex: 2,
      ariaLabel: `${agentName} node ${action ?? 'Idle'}`,
    };
  });

  const edges = Array.from(latestHandoffByPair.entries()).map(([key, card]) => {
    const source = toGraphAgent(card.agentName) ?? 'CEO';
    const target = resolveHandoffTarget(card, source) ?? 'QA';
    const tone = edgeTone(source, target);

    return {
      id: `${card.id}-${key}`,
      source,
      target,
      type: 'flowEdge',
      animated: true,
      label: 'Handoff',
      data: {
        label: `Handoff to ${formatAgentName(target)}`,
        tone,
      } satisfies FlowEdgeData,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeToneColor(tone),
      },
      style: {
        stroke: edgeToneColor(tone),
        strokeWidth: 2.8,
      },
    };
  });

  return { nodes, edges, latestByAgent };
}

function findCurrentTaskId(cards: TelemetryCard[]): string | null {
  return cards.find((card) => card.taskStatus === 'In Progress')?.taskId ?? null;
}

function findLatestReviewGroupId(cards: TelemetryCard[]): string | null {
  return cards.find((card) => card.fanoutGroupId)?.fanoutGroupId ?? null;
}

function toGraphAgent(agentName: string): GraphAgent | null {
  return agentName === 'CEO' || agentName === 'frontend_designer' || agentName === 'Developer' || agentName === 'QA'
    ? agentName
    : null;
}

function resolveHandoffTarget(card: TelemetryCard, source?: GraphAgent): GraphAgent | null {
  if (card.handoffTo && toGraphAgent(card.handoffTo)) {
    return toGraphAgent(card.handoffTo);
  }

  const match = card.content.match(/handoff_to=([A-Za-z_]+)/i);
  if (match) {
    const candidate = toGraphAgent(match[1]);
    if (candidate) {
      return candidate;
    }
  }

  if (!source) {
    source = toGraphAgent(card.agentName) ?? undefined;
  }

  if (!source) {
    return null;
  }

  return agentOrder[(agentOrder.indexOf(source) + 1) % agentOrder.length];
}

function edgeTone(source: GraphAgent, target: GraphAgent): FlowEdgeTone {
  if (source === 'CEO' || target === 'CEO') {
    return 'cyan';
  }

  if (source === 'frontend_designer' || target === 'frontend_designer') {
    return 'indigo';
  }

  if (source === 'Developer' || target === 'Developer') {
    return 'emerald';
  }

  return 'violet';
}

function edgeToneColor(tone: FlowEdgeTone): string {
  switch (tone) {
    case 'cyan':
      return '#22d3ee';
    case 'indigo':
      return '#6366f1';
    case 'emerald':
      return '#34d399';
    case 'violet':
      return '#a78bfa';
    default:
      return '#22d3ee';
  }
}

function MetricPill({ label, value, isText = false }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-xl">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className={`font-display mt-1 text-sm font-semibold tabular-nums ${isText ? 'text-white' : 'text-slate-100'}`}>
        {value}
      </div>
    </div>
  );
}

function ReviewSwarm({ cards }: { cards: TelemetryCard[] }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-5 backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Parallel QA swarm</p>
          <h3 className="font-display mt-2 text-lg font-bold text-white sm:text-xl">חמישה סוקרי QA רצים במקביל</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
          {cards.length} review lanes
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const focus = card.reviewFocus ?? 'Security';
          const tone = reviewTone[focus as ReviewFocus];
          return (
            <article
              key={card.id}
              className={`rounded-[1.35rem] border ${tone.border} bg-slate-950/88 p-3 shadow-[0_0_24px_rgba(15,23,42,0.48)] backdrop-blur-xl`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.chip}`}>{focus}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">QA</span>
              </div>
              <p className="mt-3 line-clamp-3 text-right text-sm leading-6 text-slate-200" dir={textDirection(summarizeTelemetryContent(card.content))}>
                {summarizeTelemetryContent(card.content)}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>{card.fanoutGroupId ? card.fanoutGroupId.slice(-8) : 'fanout'}</span>
                <span>{formatTimestamp(card.createdAt)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AgentNode({ data }: any) {
  const tone = (nodeTone as any)[data.agentName] ?? nodeTone.CEO;
  const latestAction: any = data.latestAction ? (actionTone as any)[data.latestAction] : null;
  const badgeLabel = statusLabelFromNode(data);
  const displayName = formatAgentName(data.agentName);

  return (
    <div
      className={`group relative isolate overflow-hidden rounded-[1.6rem] border ${tone.border} bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(15,23,42,0.92))] p-4 text-slate-100 backdrop-blur-2xl transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(15,23,42,0.96))] sm:p-5`}
      dir={textDirection(displayName)}
      role="button"
      tabIndex={0}
      onMouseDown={() => data.onSelectAgent?.(data.agentName)}
      onClick={() => data.onSelectAgent?.(data.agentName)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          data.onSelectAgent?.(data.agentName);
        }
      }}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.accent} opacity-80`} />
      <div className="pointer-events-none absolute inset-[1px] rounded-[1.45rem] border border-white/5" />
      <Handle type="target" position={Position.Left} className="!border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!border-0 !bg-transparent" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 text-left" dir={textDirection(displayName)} style={{ direction: textDirection(displayName) }}>
          <p className="text-[10px] uppercase tracking-[0.34em] text-slate-400">{data.agentName}</p>
          <h3 className="font-display mt-1 truncate text-xl font-bold text-white sm:text-2xl">{displayName}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.badge}`}>{badgeLabel}</span>
      </div>

      <div className="relative mt-4 space-y-3">
        <div
          className={`rounded-[1.25rem] border border-white/10 bg-white/6 p-3 transition duration-300 ${latestAction ? `${latestAction.ring} shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_0_24px_rgba(255,255,255,0.08)]` : 'shadow-[0_0_0_1px_rgba(255,255,255,0.03)]'}`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Task</span>
            <span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-semibold ${latestAction ? latestAction.chip : 'bg-slate-500/15 text-slate-200'}`}>
              <span className={`h-2 w-2 rounded-full ${latestAction ? latestAction.dot : 'bg-slate-400'} ${latestAction ? 'animate-pulse' : ''}`} />
              {badgeLabel}
            </span>
          </div>
          <p className="mt-2 truncate text-sm leading-6 text-slate-200" dir={textDirection(data.latestTask)} style={{ direction: textDirection(data.latestTask) }}>
            {data.latestTask}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span className="truncate">{data.latestTaskStatus ?? 'No task'}</span>
          <span className="font-display tabular-nums">{data.latestAt ? formatTimestamp(data.latestAt) : 'pending'}</span>
        </div>
      </div>
    </div>
  );
}

function FlowEdge(props: any) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data, style } = props;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const tone = data?.tone ?? 'cyan';
  const label = data?.label ?? 'Handoff';

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        className={`flow-edge flow-edge--${tone}`}
        style={{
          ...style,
          strokeWidth: 7,
          opacity: 0.12,
          filter: 'blur(6px)',
        }}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        className={`flow-edge flow-edge--${tone}`}
        style={{
          ...style,
          strokeLinecap: 'round',
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className="pointer-events-none absolute rounded-full border border-white/10 bg-slate-950/92 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-200 shadow-lg backdrop-blur-xl"
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = {
  agentNode: AgentNode,
};

const edgeTypes = {
  flowEdge: FlowEdge,
};

function statusLabelFromNode(data: FlowNodeData): string {
  if (data.latestTaskStatus !== 'In Progress' || !data.latestAction) {
    return 'Idle';
  }

  return data.latestAction;
}

function statusTone(card: TelemetryCard): string {
  if (card.taskStatus !== 'In Progress') {
    return 'bg-slate-500/15 text-slate-200';
  }

  switch (card.action) {
    case 'Thinking':
      return actionTone.Thinking.chip;
    case 'Executing':
      return actionTone.Executing.chip;
    case 'Handoff':
      return actionTone.Handoff.chip;
    default:
      return 'bg-slate-500/15 text-slate-200';
  }
}

function statusLabel(card: TelemetryCard): string {
  if (card.taskStatus !== 'In Progress') {
    return 'Idle';
  }

  return card.action;
}

function DetailRow({ label, value, valueClassName = '' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[88px_minmax(0,1fr)] sm:items-start">
      <dt className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</dt>
      <dd className={`min-w-0 text-sm text-slate-100 ${valueClassName}`} dir={textDirection(value)} style={{ direction: textDirection(value) }}>
        {value}
      </dd>
    </div>
  );
}

function formatAgentName(agentName: string): string {
  switch (agentName) {
    case 'frontend_designer':
      return 'Frontend Designer';
    default:
      return agentName;
  }
}

function textDirection(value: unknown): 'rtl' | 'ltr' {
  const text = typeof value === 'string' ? value : '';
  return /[\u0590-\u05FF]/.test(text) ? 'rtl' : 'ltr';
}

function summarizeTelemetryContent(content: unknown): string {
  const text = typeof content === 'string' ? content : '';
  return text
    .replace(/^telegram_message=[^|]+\s*\|\s*/i, '')
    .replace(/^telegram_message_id=[^|]+\s+chat_id=[^|]+\s+from=[^|]+\s*\|\s*/i, '')
    .replace(/\s*\|\s*review_command=.*$/i, '')
    .trim();
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
