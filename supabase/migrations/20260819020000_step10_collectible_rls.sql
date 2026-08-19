-- =============================================================================
-- Mighty Verse Reimagined — Step 10: Collectible RLS Policies
-- Adds scoped RLS policies for the collectible layer.
-- Tables already exist from initial schema. No DDL changes to table structure.
-- service_role_all policies already exist on all tables from initial schema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- collectible
-- Public read: all rows (collectible identity is public per A3)
-- Authenticated read own: current_owner_ref resolves to caller's participant_id
-- service_role: full access (already exists)
-- -----------------------------------------------------------------------------

create policy "anon_read_collectible"
  on public.collectible
  for select to anon
  using (true);

create policy "authenticated_read_own_collectible"
  on public.collectible
  for select to authenticated
  using (
    current_owner_ref in (
      select il.participant_id from public.identity_link il
      where il.identity_type = 'web2-account'
        and il.identity_ref = auth.uid()::text
        and il.active = true
    )
  );

-- -----------------------------------------------------------------------------
-- ownership_transfer
-- service_role only — transfer history is internal per A6
-- No anon or authenticated read policies added.
-- -----------------------------------------------------------------------------

-- (service_role_all already covers all operations)

-- -----------------------------------------------------------------------------
-- entitlement_bundle
-- service_role only — economic entitlement terms are internal
-- No anon or authenticated read policies added.
-- -----------------------------------------------------------------------------

-- (service_role_all already covers all operations)

-- -----------------------------------------------------------------------------
-- waterfall_definition
-- Public read: economic rules are public by design per A4
-- service_role write: already covered by service_role_all
-- -----------------------------------------------------------------------------

create policy "anon_read_waterfall_definition"
  on public.waterfall_definition
  for select to anon
  using (true);

create policy "authenticated_read_waterfall_definition"
  on public.waterfall_definition
  for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- waterfall_version
-- Public read per A4
-- -----------------------------------------------------------------------------

create policy "anon_read_waterfall_version"
  on public.waterfall_version
  for select to anon
  using (true);

create policy "authenticated_read_waterfall_version"
  on public.waterfall_version
  for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- rule_attachment
-- Public read per A4
-- -----------------------------------------------------------------------------

create policy "anon_read_rule_attachment"
  on public.rule_attachment
  for select to anon
  using (true);

create policy "authenticated_read_rule_attachment"
  on public.rule_attachment
  for select to authenticated
  using (true);
