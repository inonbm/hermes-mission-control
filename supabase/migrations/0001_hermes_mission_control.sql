create extension if not exists pgcrypto;

create type public.agency_task_status as enum ('In Progress', 'Done', 'Failed');
create type public.agent_name as enum ('CEO', 'Developer', 'QA', 'Content');
create type public.agent_action as enum ('Thinking', 'Executing', 'Handoff');

create table if not exists public.agency_tasks (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  status public.agency_task_status not null default 'In Progress',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_telemetry (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.agency_tasks(id) on delete cascade,
  agent_name public.agent_name not null,
  action public.agent_action not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists agency_tasks_status_idx on public.agency_tasks (status);
create index if not exists agent_telemetry_task_id_idx on public.agent_telemetry (task_id);
create index if not exists agent_telemetry_created_at_idx on public.agent_telemetry (created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_agency_tasks_updated_at on public.agency_tasks;
create trigger touch_agency_tasks_updated_at
before update on public.agency_tasks
for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.agency_tasks;
alter publication supabase_realtime add table public.agent_telemetry;

alter table public.agency_tasks enable row level security;
alter table public.agent_telemetry enable row level security;

drop policy if exists "read agency tasks" on public.agency_tasks;
create policy "read agency tasks" on public.agency_tasks
  for select
  using (true);

drop policy if exists "read agent telemetry" on public.agent_telemetry;
create policy "read agent telemetry" on public.agent_telemetry
  for select
  using (true);

drop policy if exists "service role writes agency tasks" on public.agency_tasks;
create policy "service role writes agency tasks" on public.agency_tasks
  for insert
  with check (true);

drop policy if exists "service role updates agency tasks" on public.agency_tasks;
create policy "service role updates agency tasks" on public.agency_tasks
  for update
  using (true)
  with check (true);

drop policy if exists "service role deletes agency tasks" on public.agency_tasks;
create policy "service role deletes agency tasks" on public.agency_tasks
  for delete
  using (true);

drop policy if exists "service role writes telemetry" on public.agent_telemetry;
create policy "service role writes telemetry" on public.agent_telemetry
  for insert
  with check (true);
