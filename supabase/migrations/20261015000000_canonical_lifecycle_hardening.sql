-- canonical_lifecycle_hardening
--
-- 1. Unique constraint on projection_media_binding(projection_id, binding_type)
--    Enables atomic upsert for primary binding replacement.
--    A projection may have at most one binding of each type (primary, thumbnail, etc.).
--
-- 2. canonical_state.authorisation_state check constraint
--    Enforces the four valid states: draft, authorised, superseded, revoked.
--    The existing schema uses a text column; this adds the check without altering data.

-- 1. Unique constraint — projection has at most one binding per type
alter table public.projection_media_binding
  add constraint projection_media_binding_projection_type_unique
  unique (projection_id, binding_type);

-- 2. canonical_state authorisation_state check (idempotent — only adds if absent)
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_schema = 'public'
      and constraint_name = 'canonical_state_authorisation_state_check'
  ) then
    alter table public.canonical_state
      add constraint canonical_state_authorisation_state_check
      check (authorisation_state in ('draft', 'authorised', 'superseded', 'revoked'));
  end if;
end $$;
