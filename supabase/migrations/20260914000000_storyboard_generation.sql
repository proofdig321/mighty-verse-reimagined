-- Storyboard documents, panels, generation jobs, and private creative-artifact storage.
-- Creative artifacts are not canonical Universe / Mural / Scene / Creative Moment rows.
-- RLS: authenticated users read/write only their own work. Public Experience has no write access.

create table if not exists public.storyboard_work (
  work_id uuid primary key default gen_random_uuid(),
  universe_id uuid references public.master(master_id) on delete set null,
  participant_id uuid not null references public.participant(participant_id),
  title text not null default 'Untitled storyboard',
  premise text,
  body text not null default '',
  tone text,
  genre text,
  audience text,
  creative_intent text,
  status text not null default 'draft',
  source text not null default 'script',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storyboard_work_status_check check (status in ('draft', 'active', 'archived')),
  constraint storyboard_work_source_check check (source in ('script', 'sentinel', 'hybrid', 'ai'))
);

create index if not exists storyboard_work_participant_idx
  on public.storyboard_work (participant_id, universe_id, updated_at desc);

create table if not exists public.storyboard_panel (
  panel_id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.storyboard_work(work_id) on delete cascade,
  sequence integer not null,
  title text not null,
  description text not null default '',
  narrative_purpose text,
  action text,
  dialogue text,
  narration text,
  camera text,
  camera_movement text,
  framing text,
  lens_style text,
  lighting text,
  environment text,
  characters text,
  mood text,
  transition text,
  duration_ms integer,
  aspect_ratio text,
  status text not null default 'draft',
  source text not null default 'script',
  proposed_scene_id uuid,
  sentinel_panel_id text,
  active_still_asset_id uuid references public.media_asset(asset_id) on delete set null,
  active_motion_asset_id uuid references public.media_asset(asset_id) on delete set null,
  panel_references jsonb not null default '[]'::jsonb,
  user_locked boolean not null default false,
  generation_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storyboard_panel_sequence_check check (sequence > 0),
  constraint storyboard_panel_status_check check (status in ('draft', 'ready', 'generating')),
  constraint storyboard_panel_source_check check (source in ('script', 'sentinel', 'ai', 'hybrid')),
  constraint storyboard_panel_aspect_check check (aspect_ratio is null or aspect_ratio in ('16:9', '9:16'))
);

create unique index if not exists storyboard_panel_work_sequence_idx
  on public.storyboard_panel (work_id, sequence);

create table if not exists public.generation_job (
  job_id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participant(participant_id),
  work_id uuid references public.storyboard_work(work_id) on delete cascade,
  panel_id uuid references public.storyboard_panel(panel_id) on delete set null,
  provider text not null default 'gemini',
  model text,
  operation_id text,
  kind text not null,
  status text not null default 'queued',
  progress integer,
  request jsonb not null default '{}'::jsonb,
  result jsonb,
  error jsonb,
  idempotency_key text,
  retryable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint generation_job_status_check check (
    status in (
      'queued',
      'submitted',
      'processing',
      'completed',
      'failed',
      'blocked',
      'cancelled',
      'needs_configuration',
      'unavailable'
    )
  ),
  constraint generation_job_kind_check check (
    kind in (
      'text',
      'structured-storyboard',
      'still',
      'motion',
      'animate-still',
      'first-last-frame',
      'reference-motion',
      'extend',
      'gif',
      'reel',
      'animation'
    )
  )
);

create unique index if not exists generation_job_idempotency_idx
  on public.generation_job (participant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists generation_job_work_idx on public.generation_job (work_id, created_at desc);
create index if not exists generation_job_panel_idx on public.generation_job (panel_id, created_at desc);

alter table public.storyboard_work enable row level security;
alter table public.storyboard_panel enable row level security;
alter table public.generation_job enable row level security;

create or replace function public.current_storyboard_participant_id()
returns uuid
language sql
stable
as $$
  select il.participant_id
  from public.identity_link il
  where il.identity_type = 'web2-account'
    and il.identity_ref = auth.uid()::text
    and il.active = true
  limit 1
$$;

create policy "authenticated_select_own_storyboard_work"
  on public.storyboard_work for select to authenticated
  using (participant_id = public.current_storyboard_participant_id());

create policy "authenticated_write_own_storyboard_work"
  on public.storyboard_work for all to authenticated
  using (participant_id = public.current_storyboard_participant_id())
  with check (participant_id = public.current_storyboard_participant_id());

create policy "service_role_all_storyboard_work"
  on public.storyboard_work for all to service_role
  using (true) with check (true);

create policy "authenticated_select_own_storyboard_panel"
  on public.storyboard_panel for select to authenticated
  using (
    work_id in (
      select work_id from public.storyboard_work
      where participant_id = public.current_storyboard_participant_id()
    )
  );

create policy "authenticated_write_own_storyboard_panel"
  on public.storyboard_panel for all to authenticated
  using (
    work_id in (
      select work_id from public.storyboard_work
      where participant_id = public.current_storyboard_participant_id()
    )
  )
  with check (
    work_id in (
      select work_id from public.storyboard_work
      where participant_id = public.current_storyboard_participant_id()
    )
  );

create policy "service_role_all_storyboard_panel"
  on public.storyboard_panel for all to service_role
  using (true) with check (true);

create policy "authenticated_select_own_generation_job"
  on public.generation_job for select to authenticated
  using (participant_id = public.current_storyboard_participant_id());

create policy "authenticated_write_own_generation_job"
  on public.generation_job for all to authenticated
  using (participant_id = public.current_storyboard_participant_id())
  with check (participant_id = public.current_storyboard_participant_id());

create policy "service_role_all_generation_job"
  on public.generation_job for all to service_role
  using (true) with check (true);

grant select, insert, update, delete on public.storyboard_work to authenticated;
grant select, insert, update, delete on public.storyboard_panel to authenticated;
grant select, insert, update, delete on public.generation_job to authenticated;
grant select, insert, update, delete on public.storyboard_work to service_role;
grant select, insert, update, delete on public.storyboard_panel to service_role;
grant execute on function public.current_storyboard_participant_id() to authenticated;
grant execute on function public.current_storyboard_participant_id() to service_role;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'creative-artifacts',
      'creative-artifacts',
      false,
      52428800,
      array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4']
    )
    on conflict (id) do nothing;
  end if;
end $$;
