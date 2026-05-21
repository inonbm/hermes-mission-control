alter table public.agent_telemetry
  add column if not exists handoff_to public.agent_name;

create index if not exists agent_telemetry_handoff_to_idx on public.agent_telemetry (handoff_to);
