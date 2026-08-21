-- =============================================================================
-- Mighty Verse Reimagined — Build 12: Scene Canonical Primitive
--
-- Establishes `scene` as a first-class canonical Master type and
-- `extraction` as a first-class provenance relationship type.
--
-- INFRASTRUCTURE ONLY. No Scene instances are created.
-- No canonical_state, projection, media binding, or collectible records created.
--
-- Canonical hierarchy established:
--   World (song-world)
--     └── Mural (mural, parent = World)
--           └── Scene (scene, parent = Mural)
--
-- Creative Moment remains separate:
--   World (song-world)
--     └── Creative Moment (creative-moment, parent = World)
--
-- Extraction provenance:
--   Scene canonical state → [extraction] → source Mural canonical state
--   This is distinct from parent_master_id (canonical hierarchy).
--   Extraction geometry (content_refs.extraction_bounds) is intentionally
--   deferred until the first Scene ontology audit.
--
-- Existing Mural invariant preserved:
--   mural + parent_master_id requires parent canonical_type = song-world
--
-- New Scene invariant:
--   scene + parent_master_id requires parent canonical_type = mural
-- =============================================================================

-- =============================================================================
-- 1. Add 'scene' to canonical_type enum
-- =============================================================================

alter type canonical_type add value 'scene';

-- =============================================================================
-- 2. Add 'extraction' to provenance_relationship_type enum
--
-- Represents: Scene canonical state → extracted from → Mural canonical state.
-- Distinct from 'canonical-revision' (state supersedes state) and
-- 'projection' (projection derives from state).
-- =============================================================================

alter type provenance_relationship_type add value 'extraction';

-- =============================================================================
-- 3. Extend master_parent_type_check to permit scene to have a parent
--
-- Drop and recreate — Postgres CHECK constraints cannot be altered in place.
-- The new constraint adds 'scene' to the permitted types.
-- All existing rows remain valid (no existing scene records exist).
-- =============================================================================

alter table public.master drop constraint master_parent_type_check;

alter table public.master add constraint master_parent_type_check check (
  parent_master_id is null
  or canonical_type in ('mural', 'creative-moment', 'scene', 'interpretation', 'other')
);

-- =============================================================================
-- 4. Extend enforce_mural_parent_type trigger to validate Scene parents
--
-- Existing Mural rule preserved exactly:
--   mural + parent_master_id → parent must be song-world
--
-- New Scene rule added:
--   scene + parent_master_id → parent must be mural
-- =============================================================================

create or replace function public.enforce_mural_parent_type()
returns trigger language plpgsql as $$
declare
  v_parent_type canonical_type;
begin
  -- Existing Mural invariant — unchanged
  if NEW.canonical_type = 'mural' and NEW.parent_master_id is not null then
    select canonical_type into v_parent_type
      from public.master
      where master_id = NEW.parent_master_id;
    if v_parent_type is null then
      raise exception 'Mural parent master not found: %', NEW.parent_master_id;
    end if;
    if v_parent_type != 'song-world' then
      raise exception 'A Mural parent must be a song-world (got: %)', v_parent_type;
    end if;
  end if;

  -- New Scene invariant
  if NEW.canonical_type = 'scene' and NEW.parent_master_id is not null then
    select canonical_type into v_parent_type
      from public.master
      where master_id = NEW.parent_master_id;
    if v_parent_type is null then
      raise exception 'Scene parent master not found: %', NEW.parent_master_id;
    end if;
    if v_parent_type != 'mural' then
      raise exception 'A Scene parent must be a mural (got: %)', v_parent_type;
    end if;
  end if;

  return NEW;
end;
$$;
