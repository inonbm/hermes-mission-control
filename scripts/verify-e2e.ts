import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

interface DbRuntimeResult {
  taskId: string;
  rows: number;
  actions: string[];
}

async function main() {
  const dbUrl = loadDbUrl();
  const result = await runDbSimulation(dbUrl);

  if (result.rows < 3) {
    throw new Error(`Expected at least 3 telemetry rows, got ${result.rows}`);
  }

  for (const action of ['Thinking', 'Executing', 'Handoff'] as const) {
    if (!result.actions.includes(action)) {
      throw new Error(`Missing telemetry action: ${action}`);
    }
  }

  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

async function runDbSimulation(dbUrl: string): Promise<DbRuntimeResult> {
  const projectName = `Telegram E2E ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
  const taskId = runPsql(dbUrl, `
    insert into public.agency_tasks (project_name, status)
    values ($$${projectName}$$, 'In Progress')
    returning id;
  `).trim();

  const messageText = 'בקש ממחלקת הפיתוח להדפיס שלום עולם';
  const rows = [
    {
      agent: 'CEO',
      action: 'Thinking',
      content: `telegram_message=${messageText} | project=${projectName} | phase=received`,
      handoffTo: null,
    },
    {
      agent: 'Developer',
      action: 'Executing',
      content: `telegram_message=${messageText} | project=${projectName} | phase=implementation`,
      handoffTo: null,
    },
    {
      agent: 'Developer',
      action: 'Handoff',
      content: `telegram_message=${messageText} | project=${projectName} | handoff_to=QA`,
      handoffTo: 'QA',
    },
  ] as const;

  for (const row of rows) {
    runPsql(
      dbUrl,
      `
        insert into public.agent_telemetry (task_id, agent_name, action, content, handoff_to)
        values (
          $$${taskId}$$,
          $$${row.agent}$$,
          $$${row.action}$$,
          $$${row.content}$$,
          ${row.handoffTo ? `$$${row.handoffTo}$$` : 'null'}
        );
      `,
    );
  }

  const raw = runPsql(
    dbUrl,
    `
      select action
      from public.agent_telemetry
      where task_id = $$${taskId}$$
      order by created_at asc;
    `,
  );

  const actions = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return { taskId, rows: actions.length, actions };
}

function runPsql(dbUrl: string, sql: string): string {
  const result = spawnSync('psql', [dbUrl, '-Atqc', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `psql exited with ${result.status}`);
  }

  return result.stdout.trim();
}

function loadDbUrl(): string {
  const candidates = [
    process.env.SUPABASE_DB_URL,
    readTrimmedFile(path.resolve(process.cwd(), '.secret_db_url')),
    readTrimmedFile('/tmp/tmp.Y0N7cZRZo9/.secret_db_url'),
  ].filter(Boolean) as string[];

  const dbUrl = candidates[0];
  if (!dbUrl) {
    throw new Error('Missing SUPABASE_DB_URL. Add it to the environment or create .secret_db_url.');
  }

  return dbUrl;
}

function readTrimmedFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const value = fs.readFileSync(filePath, 'utf8').trim();
  return value || null;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
