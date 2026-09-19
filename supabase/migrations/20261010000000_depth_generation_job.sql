-- =============================================================================
-- Mighty Verse Reimagined — Depth Generation Job Table
--
-- Separate from storyboard generation_job because:
--   - Depth jobs are scoped to source media assets (not storyboard work)
--   - generation_job.work_id is a FK to storyboard work — wrong semantic
--   - Depth job lifecycle and result shape differ from storyboard jobs
--
-- Job lifecycle:
--   queued → processing → completed
--                       → failed
--                       → needs_configuration
--
-- A failed job NEVER produces a usable depth asset.
-- Completed jobs carry the full result in the result JSONB column.
--
-- All changes are additive. No existing data is touched.
-- =============================================================================

create table if not exists public.depth_generation_job (
  job_id              uuid primary key default gen_random_uuid(),

  -- The source media asset this depth job is for.
  source_asset_id     uuid not null references public.media_asset(asset_id),

  -- Who initiated the job.
  participant_id      uuid not null references public.participant(participant_id),

  -- Provider identifier (e.g. "replicate").
  provider            text not null default 'replicate',

  -- Model identifier set on completion (e.g. "depth-anything/depth-anything-v2@abc12345").
  model               text,

  -- Job lifecycle status.
  status              text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'needs_configuration', 'unavailable')),

  -- Sampling configuration used for this job.
  target_fps          real not null default 1.0
    check (target_fps > 0),
  frame_width         integer not null default 640
    check (frame_width > 0),

  -- Result on completion. Contains depth_asset_id, association_id, storage_path,
  -- frame_count, width, height, frame_rate, duration_ms, confidence, provider, model.
  result              jsonb,

  -- Error detail on failure. Contains message and stage.
  error               jsonb,

  -- Whether this job can be retried.
  retryable           boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  completed_at        timestamptz,

  constraint depth_job_completed_at_check check (
    completed_at is null or completed_at >= created_at
  )
);

comment on table public.depth_generation_job is
  'Depth generation job lifecycle. '
  'Scoped to source media assets (not storyboard work). '
  'A failed job never produces a usable depth asset. '
  'Completed jobs carry depth_asset_id and association_id in result JSONB.';

comment on column public.depth_generation_job.result is
  'Set on completion. Contains: depth_asset_id, association_id, storage_path, '
  'frame_count, width, height, frame_rate, duration_ms, confidence, provider, model.';

comment on column public.depth_generation_job.error is
  'Set on failure. Contains: message (string), stage (sampling|provider|encoding|storage|database).';

create index if not exists depth_generation_job_source_asset_idx
  on public.depth_generation_job(source_asset_id);

create index if not exists depth_generation_job_participant_idx
  on public.depth_generation_job(participant_id);

create index if not exists depth_generation_job_status_idx
  on public.depth_generation_job(status);

create index if not exists depth_generation_job_created_at_idx
  on public.depth_generation_job(created_at desc);

-- RLS
alter table public.depth_generation_job enable row level security;

create policy "service_role_all_depth_generation_job"
  on public.depth_generation_job for all to service_role using (true) with check (true);

create policy "authenticated_read_depth_generation_job"
  on public.depth_generation_job for select to authenticated using (true);

grant select on public.depth_generation_job to authenticated;
grant select, insert, update, delete on public.depth_generation_job to service_role;
