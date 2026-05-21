import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
  const projectName = `Telegram ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
  const taskId = await createRuntimeTask(client, projectName);

  const baseContent = `telegram_message_id=${message.messageId} chat_id=${message.chatId} from=${message.from}`;

  await publisher.recordStatusChange({
    taskId,
    projectName,
    status: 'In Progress',
    agentName: 'CEO',
    action: 'Thinking',
    content: `${baseContent} | received=${message.text}`,
  });

  await publisher.recordStatusChange({
    taskId,
    projectName,
    status: 'In Progress',
    agentName: 'Developer',
    action: 'Executing',
    content: `${baseContent} | routing=implementation`,
  });

  await publisher.recordHandoff({
    taskId,
    from: 'Developer',
    to: 'QA',
    content: `${baseContent} | route=developer_to_qa`,
  });

  return {
    taskId,
    projectName,
    publishedEvents: 3,
  };
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
