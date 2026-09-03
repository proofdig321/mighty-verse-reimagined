-- =============================================================================
-- Mighty Verse Reimagined — Build 16: Binding Playback Range
--
-- Adds optional temporal playback bounds to projection_media_binding.
--
-- ONTOLOGY INVARIANT (2026-08-21, founder-established):
--   These columns are media-realization context for a specific projection's
--   use of a specific asset. They are NOT canonical Scene identity.
--   Scene masters must never acquire start_ms / end_ms.
--   NULL = play the full asset (default behaviour, unchanged).
--
-- V1 Scene realization ranges (Super Hero Ego Mural, bda79051):
--   Golden Shovel Powerhouse  proj 3039ca84  00:36–01:19  (36000–79000 ms)
--   Mothipa Dark Knight       proj bb802400  01:20–02:04  (80000–124000 ms)
--   ProVerb Hand-to-Hand      proj 9c045ea3  02:29–03:12  (149000–192000 ms)
--   Reason Sword Master       proj 8100033e  03:13–04:14  (193000–254000 ms)
--
-- These ranges are media observations, not canonical Scene boundaries.
-- =============================================================================

alter table public.projection_media_binding
  add column if not exists start_ms integer check (start_ms >= 0),
  add column if not exists end_ms   integer check (end_ms > 0);

comment on column public.projection_media_binding.start_ms is
  'Optional playback start offset in milliseconds for this projection''s use of the asset. NULL = play from beginning. NOT canonical Scene identity.';

comment on column public.projection_media_binding.end_ms is
  'Optional playback end offset in milliseconds for this projection''s use of the asset. NULL = play to end. NOT canonical Scene identity.';

-- V1 Scene realization ranges
update public.projection_media_binding set start_ms = 36000,  end_ms = 79000  where projection_id = '3039ca84-7e11-4eb6-8895-d16d13a899c3';
update public.projection_media_binding set start_ms = 80000,  end_ms = 124000 where projection_id = 'bb802400-b385-4025-9bb8-63df53abd9be';
update public.projection_media_binding set start_ms = 149000, end_ms = 192000 where projection_id = '9c045ea3-ab09-4a6f-b89c-02dce076b8da';
update public.projection_media_binding set start_ms = 193000, end_ms = 254000 where projection_id = '8100033e-4c7e-448f-8b9c-b9ff97fdc3fd';
