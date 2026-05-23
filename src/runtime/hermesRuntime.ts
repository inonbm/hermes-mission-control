import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AGENT_PROMPTS, getPromptProfile } from './agentPrompts';
import { createTelemetryPublisher, type TelemetryPublisher } from './telemetryPublisher';

export interface TelegramMessageEnvelope {
  chatId: string;
  from: string;
  text: string;
  messageId: string;
}

export interface HermesRuntimeConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

export interface HermesRuntimeResult {
  taskId: string;
  projectName: string;
  publishedEvents: number;
  mode: 'standard' | 'frontend' | 'review';
}

export function createHermesRuntime(config: HermesRuntimeConfig) {
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const publisher = createTelemetryPublisher(config);

  return {
    async handleTelegramMessage(message: TelegramMessageEnvelope): Promise<HermesRuntimeResult> {
      return routeTelegramMessage(client, publisher, message);
    },
  };
}

async function routeTelegramMessage(
  client: SupabaseClient,
  publisher: TelemetryPublisher,
  message: TelegramMessageEnvelope,
): Promise<HermesRuntimeResult> {
  const text = message.text.trim();
  const projectName = `Telegram ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
  const taskId = await createRuntimeTask(client, projectName);
  const baseContent = `telegram_message_id=${message.messageId} chat_id=${message.chatId} from=${message.from}`;

  if (isReviewCommand(text)) {
    const publishedEvents = await publishReviewFanout(publisher, taskId, projectName, baseContent, text);
    return { taskId, projectName, publishedEvents, mode: 'review' };
  }

  if (isFrontendRequest(text)) {
    const publishedEvents = await publishFrontendFlow(publisher, taskId, projectName, baseContent, text);
    return { taskId, projectName, publishedEvents, mode: 'frontend' };
  }

  const publishedEvents = await publishStandardFlow(publisher, taskId, projectName, baseContent, text);
  return { taskId, projectName, publishedEvents, mode: 'standard' };
}

async function publishStandardFlow(
  publisher: TelemetryPublisher,
  taskId: string,
  projectName: string,
  baseContent: string,
  incomingText: string,
): Promise<number> {
  await publisher.recordStatusChange({
    taskId,
    projectName,
    status: 'In Progress',
    agentName: 'CEO',
    action: 'Thinking',
    content: `${baseContent} | received=${incomingText}`,
  });

  await publisher.recordStatusChange({
    taskId,
    projectName,
    status: 'In Progress',
    agentName: 'Developer',
    action: 'Executing',
    content: `${baseContent} | routing=implementation`,
    promptProfile: getPromptProfile('software_developer'),
  });

  await publisher.recordHandoff({
    taskId,
    from: 'Developer',
    to: 'QA',
    content: `${baseContent} | route=developer_to_qa`,
    promptProfile: AGENT_PROMPTS.qa_specialist.id,
  });

  return 3;
}

async function publishFrontendFlow(
  publisher: TelemetryPublisher,
  taskId: string,
  projectName: string,
  baseContent: string,
  incomingText: string,
): Promise<number> {
  await publisher.recordStatusChange({
    taskId,
    projectName,
    status: 'In Progress',
    agentName: 'CEO',
    action: 'Thinking',
    content: `${baseContent} | received=${incomingText}`,
  });

  await publisher.recordStatusChange({
    taskId,
    projectName,
    status: 'In Progress',
    agentName: 'frontend_designer',
    action: 'Thinking',
    content: `${baseContent} | routing=frontend_design`,
    promptProfile: AGENT_PROMPTS.frontend_designer.id,
  });

  await publisher.recordHandoff({
    taskId,
    from: 'frontend_designer',
    to: 'Developer',
    content: `${baseContent} | route=frontend_designer_to_developer`,
    promptProfile: AGENT_PROMPTS.frontend_designer.id,
  });

  await publisher.recordStatusChange({
    taskId,
    projectName,
    status: 'In Progress',
    agentName: 'Developer',
    action: 'Executing',
    content: `${baseContent} | routing=implementation`,
    promptProfile: getPromptProfile('software_developer'),
  });

  await publisher.recordHandoff({
    taskId,
    from: 'Developer',
    to: 'QA',
    content: `${baseContent} | route=developer_to_qa`,
    promptProfile: AGENT_PROMPTS.qa_specialist.id,
  });

  return 5;
}

async function publishReviewFanout(
  publisher: TelemetryPublisher,
  taskId: string,
  projectName: string,
  baseContent: string,
  incomingText: string,
): Promise<number> {
  await publisher.recordStatusChange({
    taskId,
    projectName,
    status: 'In Progress',
    agentName: 'CEO',
    action: 'Thinking',
    content: `${baseContent} | review_command=${incomingText}`,
  });

  const fanoutGroupId = createFanoutGroupId();
  const reviewFocuses = ['Security', 'Logic & Bugs', 'Guidelines', 'Redundancy', 'Maintainability'] as const;

  await Promise.all(
    reviewFocuses.map((focus, index) =>
      publisher.recordReviewStatus({
        taskId,
        projectName,
        agentName: 'QA',
        action: 'Executing',
        focus,
        fanoutGroupId,
        content: `${baseContent} | review_focus=${focus} | review_lane=${index + 1} | review_command=${incomingText}`,
        promptProfile: AGENT_PROMPTS.qa_specialist.id,
      }),
    ),
  );

  return 6;
}

function isReviewCommand(text: string): boolean {
  return text.startsWith('/review');
}

function isFrontendRequest(text: string): boolean {
  return /\b(frontend|front-end|ui|ux|design|tailwind|reactflow|layout|component|style|styles|css|visual)\b/i.test(text);
}

function createFanoutGroupId(): string {
  return `fanout_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function createRuntimeTask(client: SupabaseClient, projectName: string): Promise<string> {
  const { data, error } = await client
    .from('agency_tasks')
    .insert({ project_name: projectName, status: 'In Progress' })
    .select('id')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create runtime task');
  }

  return data.id as string;
}
