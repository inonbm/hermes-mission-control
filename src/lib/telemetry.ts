import { supabase } from './supabase';
import type { AgentTelemetryRow, TelemetryCard } from './types';

const telemetrySelect = 'id,task_id,agent_name,action,content,created_at,handoff_to,review_focus,fanout_group_id,parent_event_id,agency_tasks(id,project_name,status,created_at,updated_at)';

export async function loadTelemetry(limit = 100): Promise<TelemetryCard[]> {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { data, error } = await supabase
    .from('agent_telemetry')
    .select(telemetrySelect)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => normalizeTelemetryRow(row as unknown as AgentTelemetryRow));
}

export function normalizeTelemetryRow(row: AgentTelemetryRow): TelemetryCard {
  const task = Array.isArray(row.agency_tasks) ? row.agency_tasks[0] : row.agency_tasks;

  return {
    id: row.id,
    taskId: row.task_id,
    projectName: task?.project_name ?? `משימה ${row.task_id.slice(0, 8)}`,
    taskStatus: task?.status ?? 'In Progress',
    agentName: row.agent_name,
    action: row.action,
    content: row.content,
    handoffTo: row.handoff_to ?? extractHandoffTarget(row.content),
    reviewFocus: row.review_focus ?? extractReviewFocus(row.content),
    fanoutGroupId: row.fanout_group_id ?? extractFanoutGroup(row.content),
    parentEventId: row.parent_event_id ?? extractParentEvent(row.content),
    createdAt: row.created_at,
  };
}

function extractHandoffTarget(content: string): TelemetryCard['handoffTo'] {
  const match = content.match(/handoff_to=([A-Za-z_]+)/i);
  if (!match) {
    return null;
  }

  const candidate = match[1];
  return candidate === 'CEO' || candidate === 'frontend_designer' || candidate === 'Developer' || candidate === 'QA' || candidate === 'Content'
    ? (candidate as TelemetryCard['handoffTo'])
    : null;
}

function extractReviewFocus(content: string): TelemetryCard['reviewFocus'] {
  const match = content.match(/review_focus=([^|]+)/i);
  if (!match) {
    return null;
  }

  const candidate = match[1].trim();
  return candidate === 'Security' || candidate === 'Logic & Bugs' || candidate === 'Guidelines' || candidate === 'Redundancy' || candidate === 'Maintainability'
    ? (candidate as TelemetryCard['reviewFocus'])
    : null;
}

function extractFanoutGroup(content: string): string | null {
  const match = content.match(/fanout_group=([^|]+)/i);
  return match ? match[1].trim() : null;
}

function extractParentEvent(content: string): string | null {
  const match = content.match(/parent_event=([A-Za-z0-9-]+)/i);
  return match ? match[1] : null;
}
