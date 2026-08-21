-- =============================================================================
-- Mighty Verse Reimagined — Build 10: Media Realization & Rights Architecture
--
-- Establishes the minimum boundary between:
--   canonical work authority  (master / authority_record)
--   creative attribution      (attribution_entry)
--   media file                (media_asset)
--   media production/rights   (media_realization)
--
-- CANONICAL INVARIANT (2026-08-21, founder-established):
--   Unknown rights ≠ authorised rights.
--   NULL rights_holder_ref means "not recorded" — never "canonical authority owns this."
--   Livepeer ingestion identity is not evidence of underlying rights ownership.
--   A collectible-designated projection must only be bound to media whose
--   rights_holder_ref is the canonical authority, or whose rights are explicitly
--   established. Unknown rights must be treated as a rights-risk state.
--
-- FOUNDER FACT (2026-08-21):
--   bda79051 (Livepeer 5a112ddzzuvlq3a5) — Golden Shovel owns this recording outright.
--   rights_holder_ref = 866390ff-5d45-4c15-b64e-e7c0655780b8 (Golden Shovel)
--   rights_basis = 'Golden Shovel — original recording'
--
-- Changes:
--   1. media_asset: add rights_holder_ref, rights_basis
--   2. media_realization: new table (outside canonical domain)
--   3. projection_media_binding: add realization_id (nullable FK)
--   4. Annotate bda79051 with confirmed rights
-- =============================================================================

-- =============================================================================
-- 1. media_asset — rights annotation
-- =============================================================================

alter table public.media_asset
  add column rights_holder_ref uuid references public.participant(participant_id),
  add column rights_basis       text;

comment on column public.media_asset.rights_holder_ref is
  'Participant who owns/controls this specific recording/file. NULL = unknown — never treat as canonical authority. Unknown rights are a rights-risk state, not a neutral state.';

comment on column public.media_asset.rights_basis is
  'Basis under which rights_holder_ref controls this asset (e.g. ''Golden Shovel — original recording'', ''licensed'', ''unknown — rights holder not yet established'').';

create index on public.media_asset(rights_holder_ref) where rights_holder_ref is not null;

-- =============================================================================
-- 2. media_realization — real-world production/performance context
--
-- Represents a specific recording, performance, broadcast, or visual production
-- that depicts a canonical work. NOT a canonical Master. NOT a projection.
-- Has no canonical_state, no integrity_hash in the canonical sense, no
-- provenance_record in the canonical lineage.
--
-- Sits outside the canonical domain. Referenced by projection_media_binding
-- when a projection uses independently produced media.
-- =============================================================================

create table public.media_realization (
  realization_id    uuid primary key default uuid_generate_v4(),
  -- what canonical work this realization depicts
  master_id         uuid not null references public.master(master_id),
  -- type of realization
  realization_type  text not null,
  -- who controls/owns this realization
  rights_holder_ref uuid references public.participant(participant_id),
  -- basis of rights (owned, licensed, unknown, etc.)
  rights_basis      text,
  -- human-readable production provenance
  production_notes  text,
  created_at        timestamptz not null default now(),
  created_by        uuid not null references public.participant(participant_id),
  -- realization_type must be a known value
  constraint realization_type_check check (
    realization_type in (
      'original-recording',
      'animated-video',
      'live-performance',
      'broadcast-recording',
      'music-video',
      'visualisation',
      'other'
    )
  )
);

create index on public.media_realization(master_id);
create index on public.media_realization(rights_holder_ref) where rights_holder_ref is not null;

alter table public.media_realization enable row level security;

create policy "anon_read_media_realization"
  on public.media_realization for select to anon using (true);

create policy "authenticated_read_media_realization"
  on public.media_realization for select to authenticated using (true);

create policy "service_role_all_media_realization"
  on public.media_realization for all to service_role using (true) with check (true);

grant select on public.media_realization to anon;
grant select on public.media_realization to authenticated;
grant select, insert, update, delete on public.media_realization to service_role;

-- =============================================================================
-- 3. projection_media_binding — optional realization reference
--
-- When a projection uses media from an independently produced realization,
-- realization_id makes the rights context explicit.
-- NULL = no realization context recorded (legacy or canonical-authority-owned asset).
-- =============================================================================

alter table public.projection_media_binding
  add column realization_id uuid references public.media_realization(realization_id);

create index on public.projection_media_binding(realization_id) where realization_id is not null;

-- =============================================================================
-- 4. Annotate bda79051 with confirmed founder-established rights
--
-- FOUNDER FACT (2026-08-21): Golden Shovel owns this recording outright.
-- Participant 866390ff = Golden Shovel.
-- =============================================================================

update public.media_asset
set
  rights_holder_ref = '866390ff-5d45-4c15-b64e-e7c0655780b8',
  rights_basis      = 'Golden Shovel — animation/visual realization'
where asset_id = 'bda79051-6bc9-497f-b0aa-12d95130290c';
