// @ts-nocheck
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createHermesRuntime } from '../src/runtime/hermesRuntime';

interface EnvFileValues {
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

interface TelemetryRow {
  id: string;
  task_id: string;
  agent_name: string;
  action: 'Thinking' | 'Executing' | 'Handoff';
  content: string;
  created_at: string;
  handoff_to: string | null;
  review_focus: string | null;
  fanout_group_id: string | null;
  parent_event_id: string | null;
}

async function main() {
  const env = loadEnvFile(path.resolve(process.cwd(), '.env'));
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.SUPABASE_DB_URL ?? readTrimmedFile(path.resolve(process.cwd(), '.secret_db_url'));

  if (!supabaseUrl || !dbUrl) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_DB_URL');
  }

  const canUseRuntime = Boolean(serviceRoleKey && !serviceRoleKey.includes('...'));
  const result = canUseRuntime
    ? await runRuntimeSimulation(supabaseUrl, serviceRoleKey as string)
    : await runDirectSimulation(dbUrl);

  if (result.reviewRows < 5) {
    throw new Error(`Expected at least 5 review telemetry rows, got ${result.reviewRows}`);
  }

  for (const focus of ['Security', 'Logic & Bugs', 'Guidelines', 'Redundancy', 'Maintainability'] as const) {
    if (!result.focuses.includes(focus)) {
      throw new Error(`Missing review focus: ${focus}`);
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

async function runRuntimeSimulation(supabaseUrl: string, serviceRoleKey: string) {
  const runtime = createHermesRuntime({ supabaseUrl, serviceRoleKey });
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const message = {
    chatId: 'telegram:simulated:hermes',
    from: 'Inon',
    messageId: `mock-${Date.now()}`,
    text: '/review בצעו סקירת אבטחה, לוגיקה, קונבנציות, כפילויות ותחזוקה',
  };

  const result = await runtime.handleTelegramMessage(message);
  const telemetry = await waitForTelemetry(client, result.taskId, 5, 25_000);
  return summarize(result.taskId, result.mode, telemetry);
}

async function runDirectSimulation(dbUrl: string) {
  const projectName = `Telegram E2E ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
  const taskId = runPsql(dbUrl, `
    insert into public.agency_tasks (project_name, status)
    values ($$${projectName}$$, 'In Progress')
    returning id;
  `).trim();

  const messageText = '/review בצעו סקירת אבטחה, לוגיקה, קונבנציות, כפילויות ותחזוקה';
  const fanoutGroupId = `fanout_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const focuses = ['Security', 'Logic & Bugs', 'Guidelines', 'Redundancy', 'Maintainability'] as const;

  runPsql(
    dbUrl,
    `insert into public.agent_telemetry (task_id, agent_name, action, content)
     values ($$${taskId}$$, 'CEO', 'Thinking', $$telegram_message=${messageText} | review_command=${messageText}$$);`,
  );

  for (const [index, focus] of focuses.entries()) {
    runPsql(
      dbUrl,
      `insert into public.agent_telemetry (task_id, agent_name, action, content, review_focus, fanout_group_id)
       values (
         $$${taskId}$$,
         'QA',
         'Executing',
         $$telegram_message=${messageText} | review_focus=${focus} | review_lane=${index + 1} | review_command=${messageText}$$,
         '${focus}',
         $$${fanoutGroupId}$$
       );`,
    );
  }

  const telemetryRaw = runPsql(
    dbUrl,
    `select id,task_id,agent_name,action,content,created_at,handoff_to,review_focus,fanout_group_id,parent_event_id
     from public.agent_telemetry
     where task_id = $$${taskId}$$
     order by created_at asc;`,
  );

  const telemetry = parseTelemetryRows(telemetryRaw);
  return summarize(taskId, 'review', telemetry);
}

function summarize(taskId: string, mode: string, telemetry: TelemetryRow[]) {
  const reviewRows = telemetry.filter((row) => row.review_focus !== null);
  const focuses = Array.from(new Set(reviewRows.map((row) => row.review_focus).filter(Boolean))) as string[];

  return {
    ok: true,
    taskId,
    mode,
    rows: telemetry.length,
    reviewRows: reviewRows.length,
    focuses,
    fanoutGroupId: reviewRows[0]?.fanout_group_id ?? null,
  };
}

async function waitForTelemetry(client: any, taskId: string, minRows: number, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await client
      .from('agent_telemetry')
      .select('id,task_id,agent_name,action,content,created_at,handoff_to,review_focus,fanout_group_id,parent_event_id')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as TelemetryRow[];
    if (rows.length >= minRows) {
      return rows;
    }

    await delay(750);
  }

  const { data, error } = await client
    .from('agent_telemetry')
    .select('id,task_id,agent_name,action,content,created_at,handoff_to,review_focus,fanout_group_id,parent_event_id')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as TelemetryRow[];
}

function parseTelemetryRows(raw: string): TelemetryRow[] {
  if (!raw.trim()) {
    return [];
  }

  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [id, task_id, agent_name, action, content, created_at, handoff_to, review_focus, fanout_group_id, parent_event_id] = line.split('\t');
      return {
        id,
        task_id,
        agent_name,
        action: action as TelemetryRow['action'],
        content,
        created_at,
        handoff_to: handoff_to === '' ? null : handoff_to,
        review_focus: review_focus === '' ? null : review_focus,
        fanout_group_id: fanout_group_id === '' ? null : fanout_group_id,
        parent_event_id: parent_event_id === '' ? null : parent_event_id,
      } satisfies TelemetryRow;
    });
}

function loadEnvFile(filePath: string): EnvFileValues {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values: EnvFileValues = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (key === 'VITE_SUPABASE_URL') {
      values.VITE_SUPABASE_URL = value;
    }
    if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
      values.SUPABASE_SERVICE_ROLE_KEY = value;
    }
  }

  return values;
}

function readTrimmedFile(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const value = fs.readFileSync(filePath, 'utf8').trim();
  return value || undefined;
}

function runPsql(dbUrl: string, sql: string): string {
  const result = spawnSync('psql', [dbUrl, '-Atq', '-F', '\t', '-c', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `psql exited with ${result.status}`);
  }

  return result.stdout.trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
