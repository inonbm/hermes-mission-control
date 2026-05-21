import { useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { AgentAction, TelemetryCard } from '../lib/types';

type GraphAgent = 'CEO' | 'Developer' | 'QA';

interface Props {
  cards: TelemetryCard[];
}

interface FlowNodeData extends Record<string, unknown> {
  agentName: GraphAgent;
  latestAction: AgentAction | null;
  latestContent: string;
  latestAt: string | null;
  latestTask: string;
  eventCount: number;
}

interface FlowEdgeData extends Record<string, unknown> {
  label: string;
}

const agentOrder: GraphAgent[] = ['CEO', 'Developer', 'QA'];
const agentPositions: Record<GraphAgent, { x: number; y: number }> = {
  CEO: { x: 72, y: 96 },
  Developer: { x: 388, y: 24 },
  QA: { x: 704, y: 160 },
};

const nodeTone: Record<GraphAgent, { border: string; glow: string; badge: string }> = {
  CEO: { border: 'border-sky-400/30', glow: 'shadow-[0_0_40px_rgba(56,189,248,0.18)]', badge: 'bg-sky-500/15 text-sky-100' },
  Developer: { border: 'border-emerald-400/30', glow: 'shadow-[0_0_40px_rgba(52,211,153,0.16)]', badge: 'bg-emerald-500/15 text-emerald-100' },
  QA: { border: 'border-violet-400/30', glow: 'shadow-[0_0_40px_rgba(167,139,250,0.18)]', badge: 'bg-violet-500/15 text-violet-100' },
};

const actionTone: Record<AgentAction, { chip: string; ring: string }> = {
  Thinking: { chip: 'bg-cyan-500/15 text-cyan-100', ring: 'ring-cyan-400/20' },
  Executing: { chip: 'bg-emerald-500/15 text-emerald-100', ring: 'ring-emerald-400/20' },
  Handoff: { chip: 'bg-violet-500/15 text-violet-100', ring: 'ring-violet-400/20' },
};

export function TelemetryBoard({ cards }: Props) {
  const model = useMemo(() => buildFlowModel(cards), [cards]);
  const latestEvent = cards[0] ?? null;
  const activeAgents = new Set(cards.filter((card) => toGraphAgent(card.agentName) !== null).map((card) => card.agentName)).size;

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-4 shadow-glow backdrop-blur-xl sm:p-6">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Live agent graph</p>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">רשת גרפית חיה של סוכני Hermes</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            כל צומת מייצג סוכן, וכל Handoff יוצר קו מונפש בזמן אמת מתוך Supabase Realtime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <MetricPill label="אירועים" value={cards.length} />
          <MetricPill label="סוכנים פעילים" value={activeAgents} />
          <MetricPill label="Handoff edges" value={model.edges.length} />
          <MetricPill label="אחרון" value={latestEvent ? latestEvent.agentName : 'None'} isText />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span>Latest update: {latestEvent ? formatTimestamp(latestEvent.createdAt) : 'pending'}</span>
        {latestEvent ? <span>Latest action: {latestEvent.action}</span> : null}
      </div>

      <div className="h-[760px] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80">
        <ReactFlow
          nodes={model.nodes as any}
          edges={model.edges as any}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          panOnScroll
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          minZoom={0.7}
          maxZoom={1.4}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(148, 163, 184, 0.18)" />
          <MiniMap
            nodeColor={(node) => {
              const agent = node.id as GraphAgent;
              return agent === 'CEO' ? '#38bdf8' : agent === 'Developer' ? '#34d399' : '#a78bfa';
            }}
            maskColor="rgba(2, 6, 23, 0.7)"
            style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
          <Controls position="bottom-right" />
        </ReactFlow>
      </div>
    </section>
  );
}

function buildFlowModel(cards: TelemetryCard[]): { nodes: any[]; edges: any[] } {
  const latestByAgent = new Map<GraphAgent, TelemetryCard>();
  const recentHandoffs = new Map<string, TelemetryCard>();

  for (const card of cards) {
    const source = toGraphAgent(card.agentName);
    if (!source) {
      continue;
    }

    if (!latestByAgent.has(source)) {
      latestByAgent.set(source, card);
    }

    if (card.action === 'Handoff') {
      const target = resolveHandoffTarget(card);
      if (!target || target === source) {
        continue;
      }
      const key = `${source}->${target}`;
      if (!recentHandoffs.has(key)) {
        recentHandoffs.set(key, card);
      }
    }
  }

  const nodes = agentOrder.map((agentName) => {
    const latest = latestByAgent.get(agentName) ?? null;
    const eventCount = cards.filter((card) => toGraphAgent(card.agentName) === agentName).length;
    const tone = nodeTone[agentName];
    const action = latest?.action ?? null;
    const latestActionLabel = action ? `${action}` : 'Idle';

    return {
      id: agentName,
      type: 'agentNode',
      position: agentPositions[agentName],
      data: {
        agentName,
        latestAction: action,
        latestContent: latest?.content ?? 'Waiting for live telemetry',
        latestAt: latest?.createdAt ?? null,
        latestTask: latest?.projectName ?? 'No task yet',
        eventCount,
      } satisfies FlowNodeData,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        width: 240,
        background: 'transparent',
        border: 'none',
      },
      className: tone.glow,
      selected: false,
      draggable: false,
      deletable: false,
      selectable: false,
      focusable: false,
      hidden: false,
      zIndex: 2,
      ariaLabel: `${agentName} node ${latestActionLabel}`,
    };
  });

  const edges = Array.from(recentHandoffs.entries()).map(([key, card]) => {
    const source = toGraphAgent(card.agentName) ?? 'CEO';
    const target = resolveHandoffTarget(card) ?? 'QA';
    const tone = edgeTone(source, target);
    return {
      id: `${card.id}-${key}`,
      source,
      target,
      type: 'smoothstep',
      animated: true,
      label: 'Handoff',
      data: {
        label: `Handoff to ${target}`,
      } satisfies FlowEdgeData,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: tone.stroke,
      },
      style: {
        stroke: tone.stroke,
        strokeWidth: 2.5,
      },
      labelStyle: {
        fill: '#e2e8f0',
        fontSize: 11,
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: 'rgba(15, 23, 42, 0.92)',
        fillOpacity: 1,
      },
      labelBgBorderRadius: 999,
      labelBgPadding: [6, 4],
    };
  });

  return { nodes, edges };
}

function toGraphAgent(agentName: string): GraphAgent | null {
  return agentName === 'CEO' || agentName === 'Developer' || agentName === 'QA' ? agentName : null;
}

function resolveHandoffTarget(card: TelemetryCard): GraphAgent | null {
  if (card.handoffTo && toGraphAgent(card.handoffTo) !== null) {
    return toGraphAgent(card.handoffTo);
  }

  const match = card.content.match(/handoff_to=([A-Za-z]+)/i);
  if (match) {
    const candidate = toGraphAgent(match[1]);
    if (candidate) {
      return candidate;
    }
  }

  const source = toGraphAgent(card.agentName);
  if (!source) {
    return null;
  }

  return agentOrder[(agentOrder.indexOf(source) + 1) % agentOrder.length];
}

function edgeTone(source: GraphAgent, target: GraphAgent): { stroke: string } {
  if (source === 'CEO' || target === 'CEO') {
    return { stroke: '#38bdf8' };
  }
  if (source === 'Developer' || target === 'Developer') {
    return { stroke: '#34d399' };
  }
  return { stroke: '#a78bfa' };
}

function MetricPill({ label, value, isText = false }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${isText ? 'text-white' : 'text-slate-100'}`}>{value}</div>
    </div>
  );
}

function AgentNode({ data }: any) {
  const nodeData = data as FlowNodeData;
  const tone = nodeTone[nodeData.agentName];
  const latestAction = nodeData.latestAction ? actionTone[nodeData.latestAction] : null;

  return (
    <div className={`relative rounded-3xl border ${tone.border} bg-slate-900/95 p-4 text-slate-100 shadow-2xl backdrop-blur-xl`}>
      <Handle type="target" position={Position.Left} className="!border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!border-0 !bg-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Agent node</p>
          <h3 className="mt-1 text-xl font-semibold text-white">{nodeData.agentName}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.badge}`}>{nodeData.eventCount} events</span>
      </div>

      <div className="mt-4 space-y-3">
        <div className={`rounded-2xl border border-white/10 bg-white/5 p-3 ${latestAction ? latestAction.ring : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">State</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${latestAction ? latestAction.chip : 'bg-slate-500/15 text-slate-200'}`}>
              {nodeData.latestAction ?? 'Idle'}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-200">{nodeData.latestContent}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>Task: {nodeData.latestTask}</span>
          <span>{nodeData.latestAt ? formatTimestamp(nodeData.latestAt) : 'pending'}</span>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  agentNode: AgentNode,
};

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
