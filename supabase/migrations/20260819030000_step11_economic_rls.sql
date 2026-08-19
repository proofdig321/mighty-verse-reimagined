-- =============================================================================
-- Step 11 — Economic Engine RLS
-- Scoped policies for economic_event, economic_entitlement, settlement_record,
-- settlement_threshold_config per A5/A8.
-- service_role policies already exist (bootstrap); these add authenticated-user
-- scoped read policies.
-- =============================================================================

-- economic_event: authenticated users may read events where they are a participant
-- (via entitlement). Direct event read is service_role only for now; entitlement
-- read below gives the practical access path.
create policy "authenticated_read_own_events" on economic_event
  for select to authenticated
  using (
    exists (
      select 1 from economic_entitlement ee
      where ee.event_id = economic_event.event_id
        and ee.participant_ref = (
          select p.participant_id from participant p
          join identity_link il on il.participant_id = p.participant_id
          where il.identity_ref = auth.uid()::text
            and il.identity_type = 'web2-account'
            and il.active = true
          limit 1
        )
    )
  );

-- economic_entitlement: authenticated users may read their own entitlements
create policy "authenticated_read_own_entitlements" on economic_entitlement
  for select to authenticated
  using (
    participant_ref = (
      select p.participant_id from participant p
      join identity_link il on il.participant_id = p.participant_id
      where il.identity_ref = auth.uid()::text
        and il.identity_type = 'web2-account'
        and il.active = true
      limit 1
    )
  );

-- settlement_record: service_role only (no additional policy needed — bootstrap covers it)

-- settlement_threshold_config: public read (config is not sensitive)
create policy "anon_read_threshold_config" on settlement_threshold_config
  for select to anon
  using (true);

create policy "authenticated_read_threshold_config" on settlement_threshold_config
  for select to authenticated
  using (true);
