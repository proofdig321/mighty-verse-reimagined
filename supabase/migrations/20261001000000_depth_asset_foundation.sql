-- =============================================================================
-- Mighty Verse Reimagined — Depth Asset Foundation
--
-- Establishes the database contract for depth assets as first-class media.
--
-- Architecture:
--
--   media_asset (existing)
--       ↓
--   media_asset_depth (new join table)
--       ↓
--   media_asset (depth asset, media_class = 'depth')
--
-- Why a join table (not media_asset.depth_asset_id):
--   A source video may eventually have multiple depth representations:
--     - source_provided depth
--     - generated depth (different models, versions)
--     - creator_authored depth
--     - different resolutions
--   A single FK column would paint the system into a one-depth-per-source corner.
--   The join table supports all of these without schema changes.
--
-- Changes:
--   1. Add CHECK constraint allowing media_class = 'depth' on media_asset.
--      media_asset currently uses asset_type enum, not a media_class column.
--      The media_class classification lives in the application layer (MediaClass
--      in providers/interface.ts). The database stores depth assets as
--      asset_type = 'metadata' with a depth_format column for the binary payload
--      storage reference, OR as a new asset_type value.
--
--      Decision: add 'depth' to the asset_type enum. This is the minimal,
--      consistent change — asset_type already classifies media assets by kind.
--      The application MediaClass='depth' maps to asset_type='depth'.
--
--   2. Create media_asset_depth join table.
--
-- All changes are additive. No existing rows are modified.
-- =============================================================================

-- =============================================================================
-- 1. Extend asset_type enum with 'depth'
--
-- Depth assets are stored in Supabase Storage as binary blobs (MVDP format).
-- storage_ref on media_asset holds the signed/CDN URL or storage path.
-- integrity_hash holds the SHA-256 of the binary payload.
-- =============================================================================

alter type asset_type add value if not exists 'depth';

comment on type asset_type is
  'Media asset type classification. '
  '''depth'' = a depth map asset in Mighty Verse MVDP binary format, '
  'associated with a source video via media_asset_depth. '
  'Stored in Supabase Storage. Delivered via signed/CDN URL.';

-- =============================================================================
-- 2. media_asset_depth — join table
--
-- Associates one or more depth assets with a source media asset.
-- Supports multiple depth representations per source (different sources,
-- models, resolutions, versions).
--
-- Relationship:
--   source_asset_id  → media_asset (the source video/image)
--   depth_asset_id   → media_asset (asset_type = 'depth', MVDP binary)
-- =============================================================================

create table if not exists public.media_asset_depth (
  -- Stable identifier for this association.
  association_id      uuid primary key default gen_random_uuid(),

  -- The source media asset (video or image) this depth is associated with.
  source_asset_id     uuid not null references public.media_asset(asset_id),

  -- The depth asset (asset_type = 'depth', MVDP binary format).
  depth_asset_id      uuid not null references public.media_asset(asset_id),

  -- Provenance of this depth asset.
  -- Mirrors DepthSource in depth-asset.ts. Stored here for queryability
  -- without decoding the binary payload.
  depth_source        text not null
    check (depth_source in (
      'source_provided',
      'generated',
      'inferred',
      'creator_authored',
      'runtime_synthetic'
    )),

  -- Asset-level confidence [0, 1].
  -- Mirrors DepthAsset.confidence. Stored here for queryability.
  confidence          real not null default 0.0
    check (confidence >= 0.0 and confidence <= 1.0),

  -- Width and height of depth frames in pixels.
  -- Stored here for queryability without decoding the binary payload.
  depth_width         integer not null check (depth_width > 0),
  depth_height        integer not null check (depth_height > 0),

  -- Depth sampling rate in frames per second. NULL = single-frame asset.
  depth_frame_rate    real check (depth_frame_rate is null or depth_frame_rate > 0),

  -- Total number of depth frames.
  frame_count         integer not null check (frame_count > 0),

  -- Total duration in milliseconds. NULL = single-frame asset.
  duration_ms         integer check (duration_ms is null or duration_ms > 0),

  -- Binary format version. Must match depth-format.ts DEPTH_FORMAT_VERSION.
  format_version      integer not null default 1,

  -- Who created this association. NULL = system/automated pipeline.
  created_by          uuid references public.participant(participant_id),

  created_at          timestamptz not null default now(),

  -- A source asset can have at most one depth asset per source type.
  -- (Multiple generated versions are distinguished by depth_asset_id, not source.)
  -- This constraint prevents accidental duplicate associations of the same
  -- depth asset to the same source.
  constraint media_asset_depth_unique_pair
    unique (source_asset_id, depth_asset_id)
);

comment on table public.media_asset_depth is
  'Associates depth assets with source media assets. '
  'One source may have multiple depth representations (different sources, models, resolutions). '
  'depth_asset_id references a media_asset with asset_type = ''depth'' in MVDP binary format. '
  'This is the application-level delivery contract: '
  'source video → media_asset_depth → depth asset → signed URL → browser → DepthIndex → renderer.';

comment on column public.media_asset_depth.depth_source is
  'Provenance of the depth asset. Mirrors DepthSource in depth-asset.ts. '
  'Stored here for queryability without decoding the MVDP binary payload.';

comment on column public.media_asset_depth.confidence is
  'Asset-level confidence [0,1]. Mirrors DepthAsset.confidence. '
  '1.0 = high confidence (source-provided stereo). 0.0 = no confidence.';

comment on column public.media_asset_depth.format_version is
  'MVDP binary format version. Must match DEPTH_FORMAT_VERSION in depth-format.ts. '
  'Increment when the binary layout changes to distinguish old and new payloads.';

-- Indexes for the expected query patterns.
create index if not exists media_asset_depth_source_idx
  on public.media_asset_depth(source_asset_id);

create index if not exists media_asset_depth_depth_idx
  on public.media_asset_depth(depth_asset_id);

create index if not exists media_asset_depth_source_type_idx
  on public.media_asset_depth(source_asset_id, depth_source);

-- RLS
alter table public.media_asset_depth enable row level security;

create policy "service_role_all_media_asset_depth"
  on public.media_asset_depth for all to service_role using (true) with check (true);

create policy "authenticated_read_media_asset_depth"
  on public.media_asset_depth for select to authenticated using (true);

grant select on public.media_asset_depth to authenticated;
grant select, insert, update, delete on public.media_asset_depth to service_role;
