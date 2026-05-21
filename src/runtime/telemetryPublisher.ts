import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AgentAction, AgentName, AgencyTaskStatus } from '../lib/types';

export interface TelemetryEvent {
  taskId: string;
  agentName: AgentName;
  action: AgentAction;
  content: string;
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
    recordStatusChange: async ({ taskId, agentName, action, content }) => {
      await enqueueTelemetryInsert(client, {
        taskId,
        agentName,
        action,
        content,
      });
    },
    recordHandoff: async ({ taskId, from, to, content }) => {
      await enqueueTelemetryInsert(client, {
        taskId,
        agentName: from,
        action: 'Handoff',
        content: `${content} | handoff_to=${to}`,
      });
    },
  };
}

async function enqueueTelemetryInsert(client: SupabaseClient, event: TelemetryEvent): Promise<void> {
  queueMicrotask(() => {
    void client
      .from('agent_telemetry')
      .insert({
        task_id: event.taskId,
        agent_name: event.agentName,
        action: event.action,
        content: event.content,
      })
      .then(
        ({ error }) => {
          if (error) {
            console.warn('[Hermes Mission Control] telemetry insert failed', error.message);
          }
        },
        (error: unknown) => {
          console.warn('[Hermes Mission Control] telemetry insert failed', error);
        },
      );
  });
}
