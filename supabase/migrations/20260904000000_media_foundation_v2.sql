-- =============================================================================
-- Mighty Verse Reimagined — Media Foundation V2
--
-- PHASE A: Media integrity
--   1. media_asset: add provider, provider_asset_id, intake_id, realization_id
--   2. media_upload_session: recoverable ingestion state
--   3. media_realization: add isrc, isrc_status, version_label
--   4. media_split_sheet + media_split_sheet_participant: rights/provenance layer
--
-- PHASE E: Editorial
--   5. work_presentation: add description_md
--   6. projection_presentation: add description_md
--
-- All changes are additive (nullable / default). No existing data is touched.
-- Existing playback, bindings, and intake records are fully preserved.
-- =============================================================================

-- =============================================================================
-- 1. media_asset — provider identity + intake linkage + realization grouping
-- =============================================================================

alter table public.media_asset
  add column if not exists provider          text,
  add column if not exists provider_asset_id text,
  add column if not exists intake_id         uuid references public.media_intake(intake_id),
  add column if not exists realization_id    uuid references public.media_realization(realization_id);

comment on column public.media_asset.provider is
  'Media provider name (e.g. livepeer, supabase-storage, external). NULL = unknown/legacy.';

comment on column public.media_asset.provider_asset_id is
  'Provider-internal asset identifier (e.g. Livepeer assetId). Distinct from storage_ref (playbackId). Preserved for recovery/reconciliation.';

comment on column public.media_asset.intake_id is
  'Deterministic link to the media_intake record that initiated this asset. Set at ingest time via explicit intake_id passed through the upload session. NULL = legacy asset or no intake record.';

comment on column public.media_asset.realization_id is
  'Optional grouping under a media_realization (recording identity). Multiple assets (WAV, FLAC, streaming variant) may share one realization_id.';

create index if not exists media_asset_provider_asset_id_idx
  on public.media_asset(provider, provider_asset_id)
  where provider_asset_id is not null;

create index if not exists media_asset_intake_id_idx
  on public.media_asset(intake_id)
  where intake_id is not null;

create index if not exists media_asset_realization_id_idx
  on public.media_asset(realization_id)
  where realization_id is not null;

-- Backfill provider for existing Livepeer assets.
-- storage_ref = playbackId (not a URL, not a seed placeholder) → provider = livepeer.
-- This is a best-effort backfill; provider_asset_id cannot be recovered for legacy assets.
update public.media_asset
set provider = 'livepeer'
where provider is null
  and storage_ref is not null
  and storage_ref not like 'seed:placeholder:%'
  and storage_ref not like 'http%'
  and storage_ref not like 'thumbnail:%';

-- =============================================================================
-- 2. media_upload_session — recoverable ingestion state
--
-- Created when an upload session is opened. Survives browser close.
-- Allows recovery/reconciliation if polling is interrupted.
-- =============================================================================

create table if not exists public.media_upload_session (
  session_id          uuid primary key default gen_random_uuid(),
  intake_id           uuid references public.media_intake(intake_id),
  projection_id       uuid not null references public.projection(projection_id),
  master_id           uuid not null references public.master(master_id),
  provider            text not null default 'livepeer',
  provider_asset_id   text not null,
  provider_upload_url text,
  phase               text not null default 'created',
  asset_id            uuid references public.media_asset(asset_id),
  created_by          uuid not null references public.participant(participant_id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint media_upload_session_phase_check check (
    phase in ('created', 'uploading', 'processing', 'ready', 'failed', 'ingested')
  )
);

comment on table public.media_upload_session is
  'Persisted upload session record. Created before the browser upload begins. Survives browser close. Allows recovery if polling is interrupted. phase=ingested means media_asset was created and linked.';

create index if not exists media_upload_session_intake_id_idx
  on public.media_upload_session(intake_id)
  where intake_id is not null;

create index if not exists media_upload_session_master_id_idx
  on public.media_upload_session(master_id);

create index if not exists media_upload_session_provider_asset_id_idx
  on public.media_upload_session(provider, provider_asset_id);

alter table public.media_upload_session enable row level security;

create policy "service_role_all_media_upload_session"
  on public.media_upload_session for all to service_role using (true) with check (true);

create policy "authenticated_read_media_upload_session"
  on public.media_upload_session for select to authenticated using (true);

grant select on public.media_upload_session to authenticated;
grant select, insert, update, delete on public.media_upload_session to service_role;

-- =============================================================================
-- 3. media_realization — recording identity fields
--
-- isrc: the ISRC for this specific recording (not the Universe).
-- isrc_status: mirrors media_intake.isrc_status semantics.
-- version_label: human label for this realization (e.g. "Radio edit", "Album version").
-- =============================================================================

alter table public.media_realization
  add column if not exists isrc         text,
  add column if not exists isrc_status  text not null default 'not-applicable',
  add column if not exists version_label text;

alter table public.media_realization
  drop constraint if exists media_realization_isrc_check;

alter table public.media_realization
  add constraint media_realization_isrc_check check (
    isrc is null or isrc ~ '^[A-Z]{2}-?[A-Z0-9]{3}-?[0-9]{2}-?[0-9]{5}$'
  );

alter table public.media_realization
  drop constraint if exists media_realization_isrc_status_check;

alter table public.media_realization
  add constraint media_realization_isrc_status_check check (
    isrc_status in ('verified', 'not-provided', 'not-applicable', 'pending', 'assignment-required')
  );

alter table public.media_realization
  drop constraint if exists media_realization_isrc_state_check;

alter table public.media_realization
  add constraint media_realization_isrc_state_check check (
    (isrc is not null and isrc_status = 'verified') or
    (isrc is null and isrc_status in ('not-provided', 'not-applicable', 'pending', 'assignment-required'))
  );

create index if not exists media_realization_isrc_idx
  on public.media_realization(isrc)
  where isrc is not null;

comment on column public.media_realization.isrc is
  'ISRC for this specific recording/realization. Distinct from the Universe. A music video and a sound recording of the same Universe have separate ISRCs.';

comment on column public.media_realization.isrc_status is
  'verified: ISRC confirmed. not-provided: released but no ISRC supplied. not-applicable: non-recording media. pending: applicable but not yet obtained. assignment-required: Golden Shovel needs to assign/obtain one.';

comment on column public.media_realization.version_label is
  'Human-readable version label for this realization (e.g. "Album version", "Radio edit", "Instrumental", "Director''s cut").';

-- =============================================================================
-- 4. media_split_sheet — rights/provenance/economic evidence layer
--
-- Belongs to the rights layer, NOT the canonical creative layer.
-- Represents a formal agreement/evidence of agreed allocations.
-- Not required for every asset — applicability is explicit.
-- =============================================================================

create table if not exists public.media_split_sheet (
  split_sheet_id      uuid primary key default gen_random_uuid(),
  realization_id      uuid references public.media_realization(realization_id),
  master_id           uuid references public.master(master_id),
  applicable          boolean not null default true,
  not_applicable_reason text,
  status              text not null default 'draft',
  effective_date      date,
  agreement_reference text,
  integrity_hash      text,
  notes               text,
  created_by          uuid not null references public.participant(participant_id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint media_split_sheet_status_check check (
    status in ('draft', 'confirmed', 'superseded')
  ),
  constraint media_split_sheet_subject_check check (
    realization_id is not null or master_id is not null
  ),
  constraint media_split_sheet_not_applicable_check check (
    applicable = true or not_applicable_reason is not null
  )
);

comment on table public.media_split_sheet is
  'Rights/provenance evidence layer for agreed ownership/revenue allocations. NOT canonical creative ontology. applicable=false means a split sheet was considered and determined not applicable (e.g. Golden Shovel-only work). The private agreement document remains off-chain; integrity_hash may later anchor it on-chain.';

create index if not exists media_split_sheet_realization_id_idx
  on public.media_split_sheet(realization_id)
  where realization_id is not null;

create index if not exists media_split_sheet_master_id_idx
  on public.media_split_sheet(master_id)
  where master_id is not null;

alter table public.media_split_sheet enable row level security;

create policy "service_role_all_media_split_sheet"
  on public.media_split_sheet for all to service_role using (true) with check (true);

create policy "authenticated_read_media_split_sheet"
  on public.media_split_sheet for select to authenticated using (true);

grant select on public.media_split_sheet to authenticated;
grant select, insert, update, delete on public.media_split_sheet to service_role;

-- =============================================================================
-- 4b. media_split_sheet_participant — allocation entries
-- =============================================================================

create table if not exists public.media_split_sheet_participant (
  entry_id            uuid primary key default gen_random_uuid(),
  split_sheet_id      uuid not null references public.media_split_sheet(split_sheet_id) on delete cascade,
  participant_id      uuid not null references public.participant(participant_id),
  role                text not null,
  allocation_pct      numeric(6, 3),
  allocation_notes    text,
  display_order       integer not null default 0,
  created_at          timestamptz not null default now(),
  constraint split_sheet_participant_role_check check (
    role in (
      'writer', 'composer', 'lyricist', 'producer', 'performer',
      'primary_artist', 'featured_artist', 'director', 'publisher',
      'label', 'contributor', 'other'
    )
  ),
  constraint split_sheet_participant_pct_check check (
    allocation_pct is null or (allocation_pct >= 0 and allocation_pct <= 100)
  )
);

comment on table public.media_split_sheet_participant is
  'Individual allocation entries within a split sheet. allocation_pct is the agreed percentage for this participant/role. NULL = not yet agreed or not percentage-based.';

create index if not exists split_sheet_participant_sheet_idx
  on public.media_split_sheet_participant(split_sheet_id, display_order);

create index if not exists split_sheet_participant_participant_idx
  on public.media_split_sheet_participant(participant_id);

alter table public.media_split_sheet_participant enable row level security;

create policy "service_role_all_split_sheet_participant"
  on public.media_split_sheet_participant for all to service_role using (true) with check (true);

create policy "authenticated_read_split_sheet_participant"
  on public.media_split_sheet_participant for select to authenticated using (true);

grant select on public.media_split_sheet_participant to authenticated;
grant select, insert, update, delete on public.media_split_sheet_participant to service_role;

-- =============================================================================
-- 5. work_presentation — rich editorial description
-- =============================================================================

alter table public.work_presentation
  add column if not exists description_md text;

comment on column public.work_presentation.description_md is
  'Markdown editorial description. Portable: can produce web display, distribution copy, release notes. Stored as plain text; rendered by the application. Coexists with description (plain text) for backwards compatibility.';

-- =============================================================================
-- 6. projection_presentation — rich editorial description
-- =============================================================================

alter table public.projection_presentation
  add column if not exists description_md text;

comment on column public.projection_presentation.description_md is
  'Markdown editorial description for this projection/creative moment. Same semantics as work_presentation.description_md.';
