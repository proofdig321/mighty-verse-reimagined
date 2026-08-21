-- =============================================================================
-- Mighty Verse Reimagined — Build 12b: Scene constraints and trigger
--
-- Extends master_parent_type_check and enforce_mural_parent_type to enforce
-- the Scene parentage invariant: a Scene's parent must be a mural.
--
-- Depends on 20260821030000_scene_canonical_type.sql being committed first
-- (Postgres requires enum values to be committed before use in constraints).
--
-- Canonical hierarchy enforced:
--   World (song-world)  → no parent
--   Mural (mural)       → parent must be song-world
--   Scene (scene)       → parent must be mural
-- =============================================================================

-- =============================================================================
-- 1. Extend master_parent_type_check to permit scene to have a parent
-- =============================================================================

alter table public.master drop constraint master_parent_type_check;

alter table public.master add constraint master_parent_type_check check (
  parent_master_id is null
  or canonical_type in ('mural', 'creative-moment', 'scene', 'interpretation', 'other')
);

-- =============================================================================
-- 2. Extend enforce_mural_parent_type trigger to validate Scene parents
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
