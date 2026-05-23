do $$ begin
  alter type public.agent_name add value if not exists 'frontend_designer';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.qa_review_focus as enum (
    'Security',
    'Logic & Bugs',
    'Guidelines',
    'Redundancy',
    'Maintainability'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.agent_telemetry
  add column if not exists parent_event_id uuid null,
  add column if not exists fanout_group_id text null,
  add column if not exists review_focus public.qa_review_focus null;

alter table public.agent_telemetry
  drop constraint if exists agent_telemetry_parent_event_id_fkey;

alter table public.agent_telemetry
  add constraint agent_telemetry_parent_event_id_fkey
  foreign key (parent_event_id)
  references public.agent_telemetry(id)
  on delete set null;

create index if not exists agent_telemetry_fanout_group_idx on public.agent_telemetry (fanout_group_id, created_at desc);
create index if not exists agent_telemetry_review_focus_idx on public.agent_telemetry (review_focus);
