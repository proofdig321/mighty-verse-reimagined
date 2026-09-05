-- =============================================================================
-- Mighty Verse Reimagined — Mux Media Foundation
--
-- Three additive changes required for Mux provider integration:
--
-- 1. media_upload_session.provider_upload_id
--    Holds the Mux Direct Upload ID (upload.id) before the Mux asset is created.
--    Distinct from provider_asset_id (Mux asset.id) and storage_ref (playback_id).
--    NULL for Livepeer sessions (Livepeer returns asset_id immediately at creation).
--
-- 2. media_asset.media_class
--    Normalized, provider-independent canonical classification for the player contract.
--    Answers: should this be rendered as audio or video?
--    Distinct from format (provider-reported MIME/container string).
--    Backfill: livepeer streaming-variant assets → 'video' (matches current behavior).
--    Thumbnail assets → 'image'. Seed placeholder → NULL (cannot be safely classified).
--
-- 3. media_realization.source_realization_id
--    Nullable self-referencing FK expressing creative derivation lineage.
--    Example: a visualisation realization references its source audio recording.
--    Self-reference prevented by CHECK constraint.
--    Same-master and cycle prevention enforced at application layer.
--    No ISRC, rights, or metadata is automatically inherited from the source.
--    Cross-master derivation is NOT prohibited at DB level — future workflows
--    (remixes, commissions, cross-Universe collaboration) may require it.
--
-- All changes are additive (nullable / default). No existing data is removed.
-- Existing Livepeer records, bindings, and intake records are fully preserved.
-- =============================================================================

-- =============================================================================
-- 1. media_upload_session — provider_upload_id
-- =============================================================================

alter table public.media_upload_session
  add column if not exists provider_upload_id text;

create index if not exists media_upload_session_provider_upload_id_idx
  on public.media_upload_session(provider, provider_upload_id)
  where provider_upload_id is not null;

comment on column public.media_upload_session.provider_upload_id is
  'Provider upload identifier before the asset is created. '
  'For Mux: the Direct Upload id (upload.id). '
  'NULL for Livepeer sessions (Livepeer returns asset_id immediately at upload creation). '
  'Used for webhook correlation alongside passthrough (session_id). '
  'Distinct from provider_asset_id (Mux asset.id) and storage_ref (Mux playback_id).';

-- =============================================================================
-- 2. media_asset — media_class
-- =============================================================================

alter table public.media_asset
  add column if not exists media_class text
    check (media_class in ('audio', 'video', 'image', 'other'));

create index if not exists media_asset_media_class_idx
  on public.media_asset(media_class)
  where media_class is not null;

comment on column public.media_asset.media_class is
  'Normalized, provider-independent canonical media classification for the player contract. '
  'Answers: should this asset be rendered as audio or video? '
  'Values: audio | video | image | other. '
  'Distinct from format (provider-reported MIME/container string). '
  'Set at ingest time from magic-byte detection and provider track data. '
  'NULL on assets where classification cannot be safely determined.';

-- Backfill: Livepeer streaming-variant assets are video animations (confirmed by founder).
-- The existing asset bda79051 is the Super Hero Ego animated visual — format = mp4.
-- The duplicate 5862ee9a shares the same Livepeer asset and is also video.
-- f91a3db5 is also a Livepeer mp4 streaming-variant.
-- These are classified as video, matching current player behavior.
update public.media_asset
  set media_class = 'video'
  where provider = 'livepeer'
    and asset_type = 'streaming-variant'
    and media_class is null;

-- Backfill: thumbnail assets are images.
update public.media_asset
  set media_class = 'image'
  where asset_type = 'thumbnail'
    and media_class is null;

-- seed:placeholder asset (900a70e3) — cannot be safely classified. Remains NULL.
-- This is intentional: a placeholder is not a real media asset.

-- =============================================================================
-- 3. media_realization — source_realization_id
-- =============================================================================

alter table public.media_realization
  add column if not exists source_realization_id uuid
    references public.media_realization(realization_id);

-- Self-reference prevention: a realization cannot source itself.
-- Cycle prevention (A→B→C→A) is enforced at application layer via recursive walk.
-- Cross-master derivation is NOT prohibited here — future workflows may require it.
alter table public.media_realization
  add constraint media_realization_no_self_source
    check (source_realization_id <> realization_id);

create index if not exists media_realization_source_realization_id_idx
  on public.media_realization(source_realization_id)
  where source_realization_id is not null;

comment on column public.media_realization.source_realization_id is
  'Optional FK to the realization from which this one is derived. '
  'Example: a visualisation realization references its source audio recording. '
  'Self-reference is prohibited by constraint. '
  'Cycle prevention (A→B→C→A) is enforced at application layer. '
  'Cross-master derivation is NOT prohibited at DB level — future workflows '
  '(remixes, commissions, cross-Universe collaboration) may require it. '
  'No ISRC, rights, or canonical metadata is automatically inherited from the source.';
