-- =============================================================================
-- Mighty Verse Reimagined — ISRC Foundation
--
-- Implements:
--   1. isrc_registrant          — prefix configuration (one row per authorized registrant)
--   2. isrc_designation_sequence — year-scoped atomic counter (collision-safe allocation)
--   3. isrc_assignment_log       — append-only audit trail for every assignment event
--   4. media_realization.isrc_status — extend to include 'assigned' status
--   5. Unique constraint on complete ISRC in media_realization
--   6. allocate_isrc_designation() — atomic Postgres function for safe concurrent allocation
--
-- ISRC structure (ISO 3901):
--   PREFIX (5 chars) + YEAR (2 digits) + DESIGNATION (5 digits) = 12 alphanumeric chars
--   Example: AA6QZ2600001  displayed as  AA-6QZ-26-00001
--
-- The prefix is supplied by the authorized ISRC registrant (Golden Shovel / RISA).
-- It is NOT hard-coded here. It is stored in isrc_registrant and entered by an operator.
-- =============================================================================

-- =============================================================================
-- 1. isrc_registrant — prefix configuration
--
-- One row per authorized registrant/prefix.
-- The prefix_code is the 5-character ISRC prefix allocated by the ISRC Agency.
-- Only one active registrant is expected for Golden Shovel, but the schema
-- supports future multi-registrant scenarios without code changes.
-- =============================================================================

create table if not exists public.isrc_registrant (
  registrant_id   uuid primary key default gen_random_uuid(),
  registrant_name text not null,
  country_code    text,                    -- ISO 3166-1 alpha-2 (e.g. 'ZA')
  registrant_code text,                    -- 3-char registrant code component of prefix
  prefix_code     text not null,           -- full 5-char prefix (e.g. 'AA6QZ')
  effective_from  date not null default current_date,
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid not null references public.participant(participant_id),
  -- prefix_code must be exactly 5 uppercase alphanumeric characters
  constraint isrc_registrant_prefix_format check (
    prefix_code ~ '^[A-Z]{2}[A-Z0-9]{3}$'
  ),
  -- country_code must be 2 uppercase letters if supplied
  constraint isrc_registrant_country_format check (
    country_code is null or country_code ~ '^[A-Z]{2}$'
  ),
  -- only one active registrant per prefix_code
  constraint isrc_registrant_prefix_unique unique (prefix_code)
);

comment on table public.isrc_registrant is
  'Authorized ISRC registrant configuration. The prefix_code is the 5-character ISRC prefix allocated by the ISRC Agency (e.g. RISA in South Africa). Enter the official prefix here when supplied by the registrant authority. Do not hard-code.';

comment on column public.isrc_registrant.prefix_code is
  'Full 5-character ISRC prefix allocated by the ISRC Agency. Format: 2-letter country code + 3-char registrant code (e.g. ZA + XXX = ZAXXX). Must be uppercase alphanumeric.';

comment on column public.isrc_registrant.active is
  'Only active registrants may be used for new ISRC assignments. Set to false to retire a prefix without deleting historical records.';

create index if not exists isrc_registrant_active_idx
  on public.isrc_registrant(active)
  where active = true;

alter table public.isrc_registrant enable row level security;

create policy "service_role_all_isrc_registrant"
  on public.isrc_registrant for all to service_role using (true) with check (true);

create policy "authenticated_read_isrc_registrant"
  on public.isrc_registrant for select to authenticated using (true);

grant select on public.isrc_registrant to authenticated;
grant select, insert, update, delete on public.isrc_registrant to service_role;

-- =============================================================================
-- 2. isrc_designation_sequence — year-scoped atomic counter
--
-- One row per (registrant_id, year_of_reference).
-- next_designation is the NEXT number to be allocated (starts at 1).
-- The allocate_isrc_designation() function increments this atomically
-- using SELECT ... FOR UPDATE to prevent concurrent duplicate allocation.
--
-- The designation is 5 digits: 00001 through 99999.
-- The same designation number may appear in different years — the complete
-- ISRC (prefix + year + designation) is what must be globally unique.
-- =============================================================================

create table if not exists public.isrc_designation_sequence (
  sequence_id       uuid primary key default gen_random_uuid(),
  registrant_id     uuid not null references public.isrc_registrant(registrant_id),
  year_of_reference smallint not null,     -- e.g. 26 for 2026
  next_designation  integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint isrc_designation_sequence_unique unique (registrant_id, year_of_reference),
  constraint isrc_designation_year_range check (
    year_of_reference >= 0 and year_of_reference <= 99
  ),
  constraint isrc_designation_next_range check (
    next_designation >= 1 and next_designation <= 100000
  )
);

comment on table public.isrc_designation_sequence is
  'Year-scoped designation counter per registrant. next_designation is the next number to allocate. Incremented atomically by allocate_isrc_designation(). Never reset within a year. Designation 100000 means the year is exhausted (99999 is the maximum valid designation).';

alter table public.isrc_designation_sequence enable row level security;

create policy "service_role_all_isrc_designation_sequence"
  on public.isrc_designation_sequence for all to service_role using (true) with check (true);

grant select, insert, update on public.isrc_designation_sequence to service_role;

-- =============================================================================
-- 3. isrc_assignment_log — append-only audit trail
--
-- Every ISRC assignment event is recorded here permanently.
-- This is the authoritative evidence of when, by whom, and for which
-- recording an ISRC was assigned.
-- =============================================================================

create table if not exists public.isrc_assignment_log (
  log_id            uuid primary key default gen_random_uuid(),
  realization_id    uuid not null references public.media_realization(realization_id),
  isrc              text not null,
  registrant_id     uuid not null references public.isrc_registrant(registrant_id),
  prefix_code       text not null,
  year_of_reference smallint not null,
  designation       integer not null,
  assignment_status text not null default 'assigned',
  assigned_by       uuid not null references public.participant(participant_id),
  assigned_at       timestamptz not null default now(),
  notes             text,
  -- structural validation: ISRC must be 12 uppercase alphanumeric chars
  constraint isrc_assignment_log_isrc_format check (
    isrc ~ '^[A-Z0-9]{12}$'
  ),
  constraint isrc_assignment_log_status_check check (
    assignment_status in ('assigned', 'confirmed', 'superseded', 'revoked')
  )
);

comment on table public.isrc_assignment_log is
  'Append-only audit trail for ISRC assignment events. Every assignment is recorded here permanently. This is the authoritative evidence chain for blockchain anchoring in a future phase.';

create index if not exists isrc_assignment_log_realization_idx
  on public.isrc_assignment_log(realization_id);

create index if not exists isrc_assignment_log_isrc_idx
  on public.isrc_assignment_log(isrc);

create index if not exists isrc_assignment_log_assigned_at_idx
  on public.isrc_assignment_log(assigned_at);

alter table public.isrc_assignment_log enable row level security;

create policy "service_role_all_isrc_assignment_log"
  on public.isrc_assignment_log for all to service_role using (true) with check (true);

create policy "authenticated_read_isrc_assignment_log"
  on public.isrc_assignment_log for select to authenticated using (true);

grant select on public.isrc_assignment_log to authenticated;
grant select, insert on public.isrc_assignment_log to service_role;

-- =============================================================================
-- 4. media_realization.isrc_status — extend to include 'assigned'
--
-- 'assigned' = ISRC generated and persisted by Mighty Verse internally.
--              Not yet externally confirmed/verified by the ISRC Agency.
-- 'verified' = externally confirmed (existing status, preserved).
--
-- The existing constraint must be dropped and recreated.
-- The existing isrc_state_check constraint must also be updated to allow
-- isrc to be non-null when status is 'assigned'.
-- =============================================================================

alter table public.media_realization
  drop constraint if exists media_realization_isrc_status_check;

alter table public.media_realization
  add constraint media_realization_isrc_status_check check (
    isrc_status in (
      'verified',
      'not-provided',
      'not-applicable',
      'pending',
      'assignment-required',
      'assigned'
    )
  );

-- Update the state consistency constraint to allow isrc + 'assigned'
alter table public.media_realization
  drop constraint if exists media_realization_isrc_state_check;

alter table public.media_realization
  add constraint media_realization_isrc_state_check check (
    (isrc is not null and isrc_status in ('verified', 'assigned')) or
    (isrc is null and isrc_status in ('not-provided', 'not-applicable', 'pending', 'assignment-required'))
  );

-- =============================================================================
-- 5. Unique constraint on complete ISRC in media_realization
--
-- The database must prevent two realizations from sharing the same ISRC.
-- This is the last line of defense after application-level duplicate checks.
-- =============================================================================

alter table public.media_realization
  drop constraint if exists media_realization_isrc_unique;

alter table public.media_realization
  add constraint media_realization_isrc_unique unique (isrc);

-- The existing partial index is now superseded by the unique constraint,
-- but keep it for query performance on non-null ISRC lookups.
-- (The unique constraint creates its own index; the partial index is harmless.)

-- =============================================================================
-- 6. allocate_isrc_designation() — atomic allocation function
--
-- Called from the API layer (via service role RPC).
-- Uses SELECT ... FOR UPDATE to lock the sequence row, preventing concurrent
-- duplicate allocation even under simultaneous requests.
--
-- Returns the allocated designation integer.
-- Raises an exception if the year is exhausted (> 99999).
-- Creates the sequence row if it does not yet exist for this registrant/year.
--
-- Parameters:
--   p_registrant_id  — uuid of the isrc_registrant row
--   p_year           — 2-digit year of reference (e.g. 26)
-- =============================================================================

create or replace function public.allocate_isrc_designation(
  p_registrant_id uuid,
  p_year          smallint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_designation integer;
begin
  -- Insert sequence row if it does not exist, then lock it for update.
  insert into public.isrc_designation_sequence (registrant_id, year_of_reference, next_designation)
  values (p_registrant_id, p_year, 1)
  on conflict (registrant_id, year_of_reference) do nothing;

  -- Lock the row exclusively to prevent concurrent allocation.
  select next_designation
  into   v_designation
  from   public.isrc_designation_sequence
  where  registrant_id     = p_registrant_id
    and  year_of_reference = p_year
  for update;

  if v_designation > 99999 then
    raise exception 'ISRC designation space exhausted for registrant % year %', p_registrant_id, p_year;
  end if;

  -- Advance the counter.
  update public.isrc_designation_sequence
  set    next_designation = next_designation + 1,
         updated_at       = now()
  where  registrant_id     = p_registrant_id
    and  year_of_reference = p_year;

  return v_designation;
end;
$$;

comment on function public.allocate_isrc_designation(uuid, smallint) is
  'Atomically allocates the next designation number for a registrant/year pair. Uses row-level locking (SELECT FOR UPDATE) to prevent concurrent duplicate allocation. Returns the allocated designation integer (1–99999). Raises an exception if the year is exhausted.';

grant execute on function public.allocate_isrc_designation(uuid, smallint) to service_role;
