import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AgentAction, AgentName, AgencyTaskStatus } from '../lib/types';

export interface TelemetryEvent {
  taskId: string;
  agentName: AgentName;
  action: AgentAction;
  content: string;
  handoffTo?: AgentName | null;
}

export interface TelemetryPublisherConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

export interface TelemetryPublisher {
  record(event: TelemetryEvent): Promise<void>;
  recordStatusChange(params: {
    taskId: string;
    projectName?: string;
    status: AgencyTaskStatus;
    agentName: AgentName;
    action: AgentAction;
    content: string;
  }): Promise<void>;
  recordHandoff(params: {
    taskId: string;
    from: AgentName;
    to: AgentName;
    content: string;
  }): Promise<void>;
}

export function createTelemetryPublisher(config: TelemetryPublisherConfig): TelemetryPublisher {
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return {
    record: (event) => enqueueTelemetryInsert(client, event),
    recordStatusChange: ({ taskId, projectName, status, agentName, action, content }) =>
      enqueueTelemetryInsert(client, {
        taskId,
        agentName,
        action,
        content: formatTelemetryContent(content, { projectName, status }),
      }),
    recordHandoff: ({ taskId, from, to, content }) =>
      enqueueTelemetryInsert(client, {
        taskId,
        agentName: from,
        action: 'Handoff',
        handoffTo: to,
        content: formatTelemetryContent(content, { handoffTo: to }),
      }),
  };
}

function formatTelemetryContent(
  content: string,
  details: { projectName?: string; status?: AgencyTaskStatus; handoffTo?: AgentName },
): string {
  const parts = [content.trim()];
  if (details.projectName) {
    parts.push(`project=${details.projectName}`);
  }
  if (details.status) {
    parts.push(`status=${details.status}`);
  }
  if (details.handoffTo) {
    parts.push(`handoff_to=${details.handoffTo}`);
  }
  return parts.filter(Boolean).join(' | ');
}

function enqueueTelemetryInsert(client: SupabaseClient, event: TelemetryEvent): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(() => {
      void client
        .from('agent_telemetry')
        .insert({
          task_id: event.taskId,
          agent_name: event.agentName,
          action: event.action,
          content: event.content,
          handoff_to: event.handoffTo ?? null,
        })
        .then(
          (result: { error: { message?: string } | null }) => {
            const error = result.error;
            if (error) {
              console.warn('[Hermes Mission Control] telemetry insert failed', error.message);
            }
            resolve();
          },
          (error: unknown) => {
            console.warn('[Hermes Mission Control] telemetry insert failed', error);
            resolve();
          },
        );
    });
  });
}
