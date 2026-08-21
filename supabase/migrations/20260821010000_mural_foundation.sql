-- =============================================================================
-- Mighty Verse Reimagined — Build 04: Canonical Mural Foundation
--
-- Introduces the World → Mural canonical relationship via a nullable
-- self-reference on master: parent_master_id.
--
-- Design decisions:
--
-- 1. A Mural is a master record with canonical_type = 'mural'.
--    The canonical_type enum already contains 'mural' from the initial schema.
--
-- 2. The World → Mural relationship is expressed as master.parent_master_id,
--    a nullable FK to master(master_id). Existing World records remain NULL.
--
-- 3. A CHECK constraint enforces the intended invariant:
--    Only 'mural' and 'creative-moment' canonical types may have a parent.
--    'song-world' records must have parent_master_id = NULL.
--    This prevents the self-reference from becoming an unrestricted hierarchy.
--
-- 4. No provenance enum changes are required. A Mural's canonical state uses
--    the existing 'canonical-state' subject type and 'canonical-revision'
--    relationship type — identical to a World. The World → Mural relationship
--    is structural (parent_master_id), not a provenance relationship.
--
-- 5. No existing records are migrated. All existing master rows receive NULL.
--
-- 6. No Mural record is created by this migration.
-- =============================================================================

alter table public.master
  add column parent_master_id uuid references public.master(master_id);

-- Enforce the intended hierarchy invariant:
-- song-world records must not have a parent.
-- Only mural and creative-moment records may reference a parent World.
alter table public.master
  add constraint master_parent_type_check check (
    parent_master_id is null
    or canonical_type in ('mural', 'creative-moment', 'interpretation', 'other')
  );

create index on public.master(parent_master_id) where parent_master_id is not null;

-- Enforce the canonical invariant: a Mural's parent must be a song-world.
-- A CHECK constraint cannot reference other rows in Postgres, so a trigger is required.
-- Applies on both INSERT and UPDATE.
create or replace function public.enforce_mural_parent_type()
returns trigger language plpgsql as $$
declare
  v_parent_type canonical_type;
begin
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
  return NEW;
end;
$$;

create trigger enforce_mural_parent_type
  before insert or update on public.master
  for each row execute function public.enforce_mural_parent_type();
