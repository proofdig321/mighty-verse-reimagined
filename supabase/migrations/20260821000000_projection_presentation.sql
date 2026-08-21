-- =============================================================================
-- Mighty Verse Reimagined — projection_presentation
--
-- Application-layer presentation metadata for a Projection (Creative Moment etc).
-- Lives entirely outside the canonical domain:
--   - no integrity_hash
--   - no provenance_ref
--   - not included in canonical_state.content_refs
--   - not part of any canonical operation
--   - title edits never create a canonical state
--
-- One row per projection_id (unique). Mutable by the authority holder.
-- Public read (anon). Service-role write.
-- =============================================================================

create table public.projection_presentation (
  presentation_id  uuid primary key default uuid_generate_v4(),
  projection_id    uuid not null unique references public.projection(projection_id),
  title            text not null,
  description      text,
  -- artwork_asset_id references an existing media_asset; nullable
  -- artwork is optional and does not affect canonical state
  artwork_asset_id uuid references public.media_asset(asset_id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Note: UNIQUE constraint above already creates an index on projection_id.
-- No redundant explicit index added.

alter table public.projection_presentation enable row level security;

create policy "anon_read_projection_presentation"
  on public.projection_presentation
  for select to anon using (true);

create policy "authenticated_read_projection_presentation"
  on public.projection_presentation
  for select to authenticated using (true);

create policy "service_role_all_projection_presentation"
  on public.projection_presentation
  for all to service_role using (true) with check (true);

grant select on public.projection_presentation to anon;
grant select on public.projection_presentation to authenticated;
grant select, insert, update, delete on public.projection_presentation to service_role;
