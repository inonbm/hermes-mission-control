import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AgentAction, AgentName, AgencyTaskStatus, ReviewFocus } from '../lib/types';

export interface TelemetryEvent {
  taskId: string;
  agentName: AgentName;
  action: AgentAction;
  content: string;
  handoffTo?: AgentName | null;
  reviewFocus?: ReviewFocus | null;
  fanoutGroupId?: string | null;
  parentEventId?: string | null;
  promptProfile?: string | null;
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
    promptProfile?: string | null;
  }): Promise<void>;
  recordHandoff(params: {
    taskId: string;
    from: AgentName;
    to: AgentName;
    content: string;
    promptProfile?: string | null;
  }): Promise<void>;
  recordReviewStatus(params: {
    taskId: string;
    projectName?: string;
    agentName: AgentName;
    action: AgentAction;
    focus: ReviewFocus;
    fanoutGroupId: string;
    parentEventId?: string | null;
    content: string;
    promptProfile?: string | null;
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
    recordStatusChange: ({ taskId, projectName, status, agentName, action, content, promptProfile }) =>
      enqueueTelemetryInsert(client, {
        taskId,
        agentName,
        action,
        content: formatTelemetryContent(content, { projectName, status, promptProfile }),
      }),
    recordHandoff: ({ taskId, from, to, content, promptProfile }) =>
      enqueueTelemetryInsert(client, {
        taskId,
        agentName: from,
        action: 'Handoff',
        handoffTo: to,
        content: formatTelemetryContent(content, { handoffTo: to, promptProfile }),
      }),
    recordReviewStatus: ({ taskId, projectName, agentName, action, focus, fanoutGroupId, parentEventId, content, promptProfile }) =>
      enqueueTelemetryInsert(client, {
        taskId,
        agentName,
        action,
        reviewFocus: focus,
        fanoutGroupId,
        parentEventId: parentEventId ?? null,
        content: formatTelemetryContent(content, {
          projectName,
          reviewFocus: focus,
          fanoutGroupId,
          parentEventId: parentEventId ?? undefined,
          promptProfile,
        }),
      }),
  };
}

function formatTelemetryContent(
  content: string,
  details: {
    projectName?: string;
    status?: AgencyTaskStatus;
    handoffTo?: AgentName;
    reviewFocus?: ReviewFocus;
    fanoutGroupId?: string;
    parentEventId?: string;
    promptProfile?: string | null;
  },
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
  if (details.reviewFocus) {
    parts.push(`review_focus=${details.reviewFocus}`);
  }
  if (details.fanoutGroupId) {
    parts.push(`fanout_group=${details.fanoutGroupId}`);
  }
  if (details.parentEventId) {
    parts.push(`parent_event=${details.parentEventId}`);
  }
  if (details.promptProfile) {
    parts.push(`prompt_profile=${details.promptProfile}`);
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
          review_focus: event.reviewFocus ?? null,
          fanout_group_id: event.fanoutGroupId ?? null,
          parent_event_id: event.parentEventId ?? null,
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
