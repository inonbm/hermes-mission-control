import { supabase } from './supabase';
import type { AgentTelemetryRow, TelemetryCard } from './types';

const telemetrySelect = 'id,task_id,agent_name,action,content,created_at,agency_tasks(id,project_name,status,created_at,updated_at)';

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
    createdAt: row.created_at,
  };
}
