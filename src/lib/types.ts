export type AgencyTaskStatus = 'In Progress' | 'Done' | 'Failed';
export type AgentName = 'CEO' | 'frontend_designer' | 'Developer' | 'QA' | 'Content';
export type AgentAction = 'Thinking' | 'Executing' | 'Handoff';
export type ReviewFocus = 'Security' | 'Logic & Bugs' | 'Guidelines' | 'Redundancy' | 'Maintainability';

export interface AgencyTask {
  id: string;
  project_name: string;
  status: AgencyTaskStatus;
  created_at: string;
  updated_at: string;
}

export interface AgentTelemetryRow {
  id: string;
  task_id: string;
  agent_name: AgentName;
  action: AgentAction;
  content: string;
  created_at: string;
  handoff_to?: AgentName | null;
  review_focus?: ReviewFocus | null;
  fanout_group_id?: string | null;
  parent_event_id?: string | null;
  agency_tasks?: AgencyTask | AgencyTask[] | null;
}

export interface TelemetryCard {
  id: string;
  taskId: string;
  projectName: string;
  taskStatus: AgencyTaskStatus;
  agentName: AgentName;
  action: AgentAction;
  content: string;
  handoffTo?: AgentName | null;
  reviewFocus?: ReviewFocus | null;
  fanoutGroupId?: string | null;
  parentEventId?: string | null;
  createdAt: string;
}
