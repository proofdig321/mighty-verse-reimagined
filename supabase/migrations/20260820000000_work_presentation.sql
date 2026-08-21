-- =============================================================================
-- Mighty Verse Reimagined — work_presentation
--
-- Application-layer presentation metadata for a Work (Master).
-- Lives entirely outside the canonical domain:
--   - no integrity_hash
--   - no provenance_ref
--   - not included in canonical_state.content_refs
--   - not part of any canonical operation
--   - title edits never create a canonical state
--
-- One row per master_id (unique). Mutable by the authority holder.
-- Public read (anon). Service-role write.
-- =============================================================================

create table public.work_presentation (
  presentation_id  uuid primary key default uuid_generate_v4(),
  master_id        uuid not null unique references public.master(master_id),
  title            text not null,
  description      text,
  -- artwork_asset_id references an existing media_asset; nullable
  -- artwork is optional and does not affect canonical state
  artwork_asset_id uuid references public.media_asset(asset_id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on public.work_presentation(master_id);

alter table public.work_presentation enable row level security;

-- anon: read all presentation records (titles are public)
create policy "anon_read_work_presentation"
  on public.work_presentation
  for select to anon using (true);

-- authenticated: read all
create policy "authenticated_read_work_presentation"
  on public.work_presentation
  for select to authenticated using (true);

-- service_role: full access (authority holder writes via service client)
create policy "service_role_all_work_presentation"
  on public.work_presentation
  for all to service_role using (true) with check (true);

-- grants
grant select on public.work_presentation to anon;
grant select on public.work_presentation to authenticated;
grant select, insert, update, delete on public.work_presentation to service_role;
