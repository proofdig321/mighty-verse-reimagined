-- =============================================================================
-- Mighty Verse Reimagined — Sentinel Evidence Foundation
--
-- Introduces the persistent evidence layer for media inspection.
-- This is NOT canonical creative truth — it is observational evidence.
--
-- Architecture:
--
--   media_asset
--       ↓
--   inspection_session   (one run of the Sentinel analyser against one asset)
--       ↓
--   frame_observation    (one measured data point per sampled frame)
--
-- Invariants:
--   - inspection_session references media_asset (never master/projection)
--   - frame_observation references inspection_session
--   - Nothing here modifies masters, canonical_states, projections, or bindings
--   - Each inspection run creates a new session — historical evidence is never
--     overwritten by a later run
--   - analysis_version is stored explicitly so future algorithm changes produce
--     distinguishable evidence
--
-- All changes are additive. No existing data is touched.
-- =============================================================================

-- =============================================================================
-- 1. inspection_session
--
-- Represents one Sentinel inspection run against one media asset.
-- Provenance: who initiated it, when, what analysis version, what status.
-- =============================================================================

create table if not exists public.inspection_session (
  session_id          uuid primary key default gen_random_uuid(),

  -- The media asset being inspected. Required — Sentinel observes assets.
  asset_id            uuid not null references public.media_asset(asset_id),

  -- Who initiated the inspection. NULL = system/automated.
  initiated_by        uuid references public.participant(participant_id),

  -- Analysis implementation version. Explicit string so future algorithm
  -- changes produce distinguishable evidence. Format: "browser-v{N}".
  analysis_version    text not null default 'browser-v1',

  -- Inspection status lifecycle.
  status              text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'partial')),

  -- Duration of the inspected media at inspection time (ms).
  -- Stored here because the asset's duration_ms may be updated later.
  observed_duration_ms  integer,

  -- Video dimensions observed during inspection. NULL for audio-only.
  observed_width      integer,
  observed_height     integer,

  -- Number of frames sampled during this inspection.
  frame_count         integer,

  -- Number of boundary candidates detected (above threshold).
  candidate_count     integer,

  -- Inspection parameters used — stored for reproducibility.
  -- Nullable: not all inspection paths record parameters.
  parameters          jsonb,

  -- Optional failure detail.
  error_message       text,

  -- Timestamps
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,

  constraint inspection_session_completed_at_check check (
    completed_at is null or completed_at >= started_at
  )
);

comment on table public.inspection_session is
  'One Sentinel inspection run against one media asset. '
  'Observational evidence — never canonical creative truth. '
  'Each run creates a new session; historical evidence is never overwritten. '
  'analysis_version distinguishes evidence from different algorithm generations.';

comment on column public.inspection_session.analysis_version is
  'Explicit analysis implementation version. '
  'Format: "browser-v{N}". Increment N when the analysis algorithm changes '
  'so old and new evidence remain distinguishable.';

comment on column public.inspection_session.parameters is
  'Inspection parameters used (frameCount, threshold, minSceneDurationMs, etc.). '
  'Stored as JSONB for reproducibility. NULL if not recorded.';

create index if not exists inspection_session_asset_id_idx
  on public.inspection_session(asset_id);

create index if not exists inspection_session_initiated_by_idx
  on public.inspection_session(initiated_by)
  where initiated_by is not null;

create index if not exists inspection_session_status_idx
  on public.inspection_session(status);

create index if not exists inspection_session_started_at_idx
  on public.inspection_session(started_at desc);

-- RLS
alter table public.inspection_session enable row level security;

create policy "service_role_all_inspection_session"
  on public.inspection_session for all to service_role using (true) with check (true);

create policy "authenticated_read_inspection_session"
  on public.inspection_session for select to authenticated using (true);

grant select on public.inspection_session to authenticated;
grant select, insert, update, delete on public.inspection_session to service_role;

-- =============================================================================
-- 2. frame_observation
--
-- One measured data point per sampled frame within an inspection session.
-- Stores evidence metadata — NOT frame image blobs.
-- =============================================================================

create table if not exists public.frame_observation (
  observation_id      uuid primary key default gen_random_uuid(),

  -- Parent inspection session. Cascade delete: if a session is removed,
  -- its observations go with it.
  session_id          uuid not null references public.inspection_session(session_id) on delete cascade,

  -- Temporal position of this frame within the media (milliseconds).
  time_ms             integer not null,

  -- Sequential order within this session (0-based).
  order_index         integer not null,

  -- Mean luminance of this frame (0–255). Derived from pixel analysis.
  -- NULL if luminance was not computed for this frame.
  mean_luminance      real,

  -- Visual change score relative to the previous frame (0–1).
  -- NULL for the first frame (no previous frame to compare against).
  change_score        real
    check (change_score is null or (change_score >= 0 and change_score <= 1)),

  -- Whether this frame was identified as a boundary candidate by the
  -- detection algorithm (above threshold, passed local-maxima filter).
  is_boundary_candidate  boolean not null default false,

  -- Analysis version — mirrors session.analysis_version for direct queryability.
  analysis_version    text not null default 'browser-v1',

  created_at          timestamptz not null default now(),

  -- Each frame position is unique within a session.
  constraint frame_observation_session_time_unique unique (session_id, time_ms)
);

comment on table public.frame_observation is
  'One measured data point per sampled frame within an inspection_session. '
  'Evidence metadata only — no image blobs stored. '
  'change_score is relative to the previous frame; NULL for the first frame. '
  'is_boundary_candidate reflects the detection algorithm output at inspection time.';

comment on column public.frame_observation.time_ms is
  'Temporal position of this frame in milliseconds. '
  'Canonical unit throughout Mighty Verse.';

comment on column public.frame_observation.change_score is
  'Normalised visual change score 0–1 relative to the previous frame. '
  'Computed from mean absolute difference of luminance values. '
  'NULL for the first frame (no previous frame). '
  'Higher = more visual change between this frame and the previous one.';

comment on column public.frame_observation.is_boundary_candidate is
  'True if the detection algorithm identified this frame as a scene boundary candidate. '
  'Reflects the algorithm output at inspection time using the session parameters. '
  'This is evidence — not a canonical Scene boundary.';

create index if not exists frame_observation_session_id_idx
  on public.frame_observation(session_id, order_index);

create index if not exists frame_observation_session_boundary_idx
  on public.frame_observation(session_id, is_boundary_candidate)
  where is_boundary_candidate = true;

create index if not exists frame_observation_time_ms_idx
  on public.frame_observation(session_id, time_ms);

-- RLS
alter table public.frame_observation enable row level security;

create policy "service_role_all_frame_observation"
  on public.frame_observation for all to service_role using (true) with check (true);

create policy "authenticated_read_frame_observation"
  on public.frame_observation for select to authenticated using (true);

grant select on public.frame_observation to authenticated;
grant select, insert, update, delete on public.frame_observation to service_role;
