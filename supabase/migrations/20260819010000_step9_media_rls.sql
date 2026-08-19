-- =============================================================================
-- Mighty Verse Reimagined — Step 9: Media RLS Policies
-- Adds authenticated/anon read policies on media_asset, projection_media_binding,
-- delivery_variant, and consumption_signal.
-- Tables already exist from initial schema. No DDL changes to table structure.
-- =============================================================================

-- media_asset: anon reads assets bound to public projections
create policy "anon_read_public_media_asset"
  on public.media_asset
  for select to anon
  using (
    exists (
      select 1 from public.projection_media_binding pmb
      where pmb.asset_id = media_asset.asset_id
        and pmb.access_level = 'public'
    )
  );

-- media_asset: authenticated reads all (delivery layer enforces access_level)
create policy "authenticated_read_media_asset"
  on public.media_asset
  for select to authenticated using (true);

-- projection_media_binding: anon reads public bindings
create policy "anon_read_public_binding"
  on public.projection_media_binding
  for select to anon using (access_level = 'public');

-- projection_media_binding: authenticated reads public + authenticated bindings
create policy "authenticated_read_binding"
  on public.projection_media_binding
  for select to authenticated
  using (access_level in ('public', 'authenticated'));

-- delivery_variant: anon reads variants for public-bound assets
create policy "anon_read_delivery_variant"
  on public.delivery_variant
  for select to anon
  using (
    exists (
      select 1 from public.projection_media_binding pmb
      where pmb.asset_id = delivery_variant.asset_id
        and pmb.access_level = 'public'
    )
  );

-- delivery_variant: authenticated reads all variants
create policy "authenticated_read_delivery_variant"
  on public.delivery_variant
  for select to authenticated using (true);

-- consumption_signal: authenticated reads own signals
create policy "authenticated_read_own_signal"
  on public.consumption_signal
  for select to authenticated
  using (
    participant_ref in (
      select il.participant_id from public.identity_link il
      where il.identity_type = 'web2-account'
        and il.identity_ref = auth.uid()::text
        and il.active = true
    )
  );

-- consumption_signal: authenticated inserts own signals
create policy "authenticated_insert_signal"
  on public.consumption_signal
  for insert to authenticated
  with check (
    participant_ref in (
      select il.participant_id from public.identity_link il
      where il.identity_type = 'web2-account'
        and il.identity_ref = auth.uid()::text
        and il.active = true
    )
  );
