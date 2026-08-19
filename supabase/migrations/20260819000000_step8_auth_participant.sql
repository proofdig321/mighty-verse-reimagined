-- =============================================================================
-- Mighty Verse Reimagined — Step 8: Auth + Participant Identity
-- Adds:
--   1. Unique constraint on identity_link(identity_type, identity_ref)
--   2. Authenticated RLS policies on participant and identity_link
--   3. handle_new_auth_user() trigger function + trigger on auth.users
-- Does NOT modify A1–A13 tables or existing service_role_all policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. UNIQUE CONSTRAINT on identity_link(identity_type, identity_ref)
-- Prevents duplicate identity registrations. Required for ON CONFLICT safety
-- in the trigger function.
-- -----------------------------------------------------------------------------
alter table public.identity_link
  add constraint identity_link_type_ref_unique
  unique (identity_type, identity_ref);

-- -----------------------------------------------------------------------------
-- 2. AUTHENTICATED RLS POLICIES
--
-- Resolution path: auth.uid() → identity_link.identity_ref → participant_id
--
-- participant: a user may read their own row by resolving their auth.users.id
-- through identity_link.
--
-- identity_link: a user may read their own identity_link rows by matching
-- identity_ref to their auth.users.id.
--
-- Existing service_role_all policies are preserved (not dropped).
-- -----------------------------------------------------------------------------

create policy "authenticated_read_own_participant"
  on public.participant
  for select
  to authenticated
  using (
    participant_id in (
      select il.participant_id
      from public.identity_link il
      where il.identity_type = 'web2-account'
        and il.identity_ref  = auth.uid()::text
        and il.active        = true
    )
  );

create policy "authenticated_read_own_identity_link"
  on public.identity_link
  for select
  to authenticated
  using (
    identity_type = 'web2-account'
    and identity_ref = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- 3. TRIGGER FUNCTION: handle_new_auth_user()
--
-- Fires AFTER INSERT on auth.users.
-- Creates a participant row and a web2-account identity_link.
-- Assigns NO participant_role.
-- Creates NO authority_record.
-- ON CONFLICT DO NOTHING makes the function idempotent against the unique
-- constraint added above.
-- SECURITY DEFINER so the function runs with the privileges of its owner
-- (postgres / service role) and can write to public tables regardless of RLS.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
begin
  -- Insert participant; capture the generated id
  insert into public.participant (status)
  values ('active')
  returning participant_id into v_participant_id;

  -- Insert identity_link linking auth.users.id → participant
  insert into public.identity_link (
    participant_id,
    identity_type,
    identity_ref,
    verified,
    verified_at,
    active
  )
  values (
    v_participant_id,
    'web2-account',
    new.id::text,
    true,
    now(),
    true
  )
  on conflict (identity_type, identity_ref) do nothing;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. TRIGGER on auth.users
-- -----------------------------------------------------------------------------
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
