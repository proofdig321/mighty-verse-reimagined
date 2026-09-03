-- =============================================================================
-- Mighty Verse Reimagined — Build 18: Universe terminology transition
--
-- PRODUCT DECISION (2026-08-21, founder-established):
--   The top-level canonical container is a Universe, not a Song World.
--   Mighty Verse is the multiverse/platform. Each song/work establishes a Universe.
--
-- HISTORICAL NOTE:
--   Prior builds used 'song-world'. That history is preserved in migration records
--   and .mighty-verse/ evolution documents. This migration records the transition.
--
-- Changes:
--   1. Rename enum value 'song-world' → 'universe'
--   2. Replace enforce_mural_parent_type() trigger body to validate 'universe'
--
-- What does NOT change:
--   All master IDs, canonical states, projections, bindings, media assets,
--   Scene records, Creative Moments, rights records, relationships.
--   Route /worlds/[masterId] — unchanged for backwards compatibility.
-- =============================================================================

-- 1. Rename the enum value
--    Postgres renames in place — the single 'song-world' master row (05ccc0c6)
--    is updated automatically. No data migration required.
do $$
begin
  if exists (select 1 from pg_enum where enumtypid = 'public.canonical_type'::regtype and enumlabel = 'song-world')
     and not exists (select 1 from pg_enum where enumtypid = 'public.canonical_type'::regtype and enumlabel = 'universe') then
    alter type public.canonical_type rename value 'song-world' to 'universe';
  end if;
end;
$$;

-- 2. Replace trigger function — update 'song-world' string literals to 'universe'
create or replace function public.enforce_mural_parent_type()
returns trigger language plpgsql as $$
declare
  v_parent_type canonical_type;
begin
  -- Mural invariant: parent must be a universe
  if NEW.canonical_type = 'mural' and NEW.parent_master_id is not null then
    select canonical_type into v_parent_type
      from public.master
      where master_id = NEW.parent_master_id;
    if v_parent_type is null then
      raise exception 'Mural parent master not found: %', NEW.parent_master_id;
    end if;
    if v_parent_type != 'universe' then
      raise exception 'A Mural parent must be a universe (got: %)', v_parent_type;
    end if;
  end if;

  -- Scene invariant: parent must be a mural
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
