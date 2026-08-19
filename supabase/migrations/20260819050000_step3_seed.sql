-- =============================================================================
-- Mighty Verse Reimagined — Step 3: Constitutionally-Valid Seed Migration
--
-- Establishes the minimum real canonical chain required by the approved V1
-- product definition (Phase 5, I.2.B):
--
--   Participant (Golden Shovel)
--   → IdentityLink (placeholder; superseded by web2-account on first login)
--   → AuthorityRecord (ultimate, platform scope)
--   → Master (song-world)
--   → AttributionRecord + AttributionEntry (canonical-creator, public=true)
--   → CanonicalState v1 (authorised)
--   → ProvenanceRecord (canonical-revision, public=true)
--   → Projection (experiential)
--   → ProvenanceRecord (projection, public=true)
--   → MediaAsset (placeholder storage_ref — mutable; replaced when real asset uploaded)
--   → DeliveryVariant (placeholder endpoint_ref — mutable)
--   → ProjectionMediaBinding (primary, public)
--   → CanonicalOperationLog (4 entries)
--
-- HASH ALGORITHM (first canonical definition):
--   encode(digest(<deterministic_jsonb>::text, 'sha256'), 'hex')
--   Input fields are serialised via jsonb_build_object with alphabetically
--   ordered keys. Step 4 (/authority) MUST use this same algorithm.
--
-- IDEMPOTENCY:
--   Guarded by identity_link(identity_type='other', identity_ref='seed:golden-shovel-v1').
--   If that row exists the block exits immediately. Safe to re-run.
--
-- MEDIA PLACEHOLDER:
--   storage_ref and endpoint_ref are mutable per A12 architecture.
--   Values prefixed 'seed:placeholder:' are replaced via ingestLivepeerAsset()
--   once a real asset is uploaded to Livepeer. The canonical chain and
--   integrity_hash are unaffected by that replacement.
--
-- AUTH IDENTITY:
--   The seed participant has no auth.users row yet. The existing
--   handle_new_auth_user() trigger will create a web2-account identity_link
--   on first login. The IdentityLink mechanism (A13) correctly handles this.
--   The placeholder identity_link uses identity_type='other' so it does not
--   conflict with the unique constraint on (identity_type, identity_ref) for
--   web2-account links.
-- =============================================================================

do $$
declare
  v_participant_id        uuid;
  v_authority_id          uuid;
  v_master_id             uuid;
  v_attribution_id        uuid;
  v_canonical_state_id    uuid;
  v_provenance_cs_id      uuid;
  v_provenance_proj_id    uuid;
  v_projection_id         uuid;
  v_asset_id              uuid;
  v_variant_id            uuid;
  v_binding_id            uuid;
  v_cs_hash               text;
  v_prov_cs_hash          text;
  v_proj_hash             text;
  v_prov_proj_hash        text;
begin

  -- -------------------------------------------------------------------------
  -- IDEMPOTENCY GUARD
  -- -------------------------------------------------------------------------
  if exists (
    select 1 from public.identity_link
    where identity_type = 'other'
      and identity_ref  = 'seed:golden-shovel-v1'
  ) then
    raise notice 'Seed already applied — exiting.';
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- 1. PARTICIPANT
  -- -------------------------------------------------------------------------
  insert into public.participant (status)
  values ('active')
  returning participant_id into v_participant_id;

  -- -------------------------------------------------------------------------
  -- 2. IDENTITY LINK (placeholder — superseded by web2-account on first login)
  -- -------------------------------------------------------------------------
  insert into public.identity_link (
    participant_id, identity_type, identity_ref, verified, active
  ) values (
    v_participant_id, 'other', 'seed:golden-shovel-v1', false, true
  );

  -- -------------------------------------------------------------------------
  -- 3. AUTHORITY RECORD — ultimate, platform scope, all capabilities
  -- -------------------------------------------------------------------------
  insert into public.authority_record (
    holder_ref,
    authority_type,
    scope_type,
    scope_subject_id,
    capabilities,
    effective_from,
    revoked,
    authorisation_evidence,
    created_by
  ) values (
    v_participant_id,
    'ultimate',
    'platform',
    null,
    array[
      'create-canonical-state',
      'advance-master-state',
      'authorise-projection',
      'designate-collectible',
      'authorise-interpretation',
      'delegate-authority',
      'revoke-delegation'
    ]::authority_capability[],
    now(),
    false,
    'Seed migration — Golden Shovel founding authority (Phase 5, I.2.B)',
    v_participant_id
  )
  returning authority_id into v_authority_id;

  -- -------------------------------------------------------------------------
  -- 4. MASTER
  -- -------------------------------------------------------------------------
  insert into public.master (
    canonical_type, created_by
  ) values (
    'song-world', v_participant_id
  )
  returning master_id into v_master_id;

  -- -------------------------------------------------------------------------
  -- 5. ATTRIBUTION RECORD + ENTRY (public=true per I.1.B and I.1.C)
  -- -------------------------------------------------------------------------
  insert into public.attribution_record (master_id, version)
  values (v_master_id, 1)
  returning attribution_id into v_attribution_id;

  insert into public.attribution_entry (
    attribution_id,
    participant_id,
    role_type,
    contribution_description,
    public,
    privacy_level
  ) values (
    v_attribution_id,
    v_participant_id,
    'original-artist',
    'Canonical creator — Golden Shovel',
    true,                          -- I.1.B: canonical creator attribution public
    'public-attribution'
  );

  -- Director attribution entry (I.1.C: public by default)
  insert into public.attribution_entry (
    attribution_id,
    participant_id,
    role_type,
    contribution_description,
    public,
    privacy_level
  ) values (
    v_attribution_id,
    v_participant_id,
    'director',
    'Director — Golden Shovel',
    true,                          -- I.1.C: Director attribution public
    'public-attribution'
  );

  -- Wire attribution_ref onto master
  update public.master
  set attribution_ref = v_attribution_id
  where master_id = v_master_id;

  -- -------------------------------------------------------------------------
  -- 6. CANONICAL STATE v1
  --    integrity_hash = SHA-256 of defining fields (alphabetical key order)
  -- -------------------------------------------------------------------------
  v_cs_hash := encode(
    digest(
      jsonb_build_object(
        'authorisation_state', 'authorised',
        'authorised_by',       v_authority_id::text,
        'master_id',           v_master_id::text,
        'parent_state_id',     null,
        'version',             1
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.canonical_state (
    master_id,
    version,
    parent_state_id,
    authorised_by,
    authorisation_state,
    attribution_snapshot_ref,
    content_refs,
    integrity_hash
  ) values (
    v_master_id,
    1,
    null,
    v_authority_id,
    'authorised',
    v_attribution_id,
    null,
    v_cs_hash
  )
  returning canonical_state_id into v_canonical_state_id;

  -- -------------------------------------------------------------------------
  -- 7. PROVENANCE RECORD for CanonicalState (root — no source)
  --    public=true per I.1.A
  -- -------------------------------------------------------------------------
  v_prov_cs_hash := encode(
    digest(
      jsonb_build_object(
        'authorised_by',       v_authority_id::text,
        'relationship_type',   'canonical-revision',
        'source_id',           null,
        'source_type',         null,
        'subject_id',          v_canonical_state_id::text,
        'subject_type',        'canonical-state'
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.provenance_record (
    subject_id,
    subject_type,
    source_id,
    source_type,
    relationship_type,
    authorised_by,
    public,
    integrity_hash
  ) values (
    v_canonical_state_id,
    'canonical-state',
    null,
    null,
    'canonical-revision',
    v_authority_id,
    true,                          -- I.1.A: provenance for authorised projection public
    v_prov_cs_hash
  )
  returning provenance_id into v_provenance_cs_id;

  -- Wire provenance_ref and current_state_id back
  update public.canonical_state
  set provenance_ref = v_provenance_cs_id
  where canonical_state_id = v_canonical_state_id;

  update public.master
  set current_state_id = v_canonical_state_id
  where master_id = v_master_id;

  -- -------------------------------------------------------------------------
  -- 8. PROJECTION (experiential)
  --    integrity_hash = SHA-256 of defining fields
  -- -------------------------------------------------------------------------
  v_proj_hash := encode(
    digest(
      jsonb_build_object(
        'canonical_state_id',     v_canonical_state_id::text,
        'collectible_designated', false,
        'created_by',             v_authority_id::text,
        'master_id',              v_master_id::text,
        'projection_type',        'experiential'
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.projection (
    canonical_state_id,
    master_id,
    projection_type,
    collectible_designated,
    created_by,
    content_refs,
    integrity_hash
  ) values (
    v_canonical_state_id,
    v_master_id,
    'experiential',
    false,
    v_authority_id,
    null,
    v_proj_hash
  )
  returning projection_id into v_projection_id;

  -- -------------------------------------------------------------------------
  -- 9. PROVENANCE RECORD for Projection (public=true per I.1.A)
  -- -------------------------------------------------------------------------
  v_prov_proj_hash := encode(
    digest(
      jsonb_build_object(
        'authorised_by',       v_authority_id::text,
        'relationship_type',   'projection',
        'source_id',           v_canonical_state_id::text,
        'source_type',         'canonical-state',
        'subject_id',          v_projection_id::text,
        'subject_type',        'projection'
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.provenance_record (
    subject_id,
    subject_type,
    source_id,
    source_type,
    relationship_type,
    authorised_by,
    public,
    integrity_hash
  ) values (
    v_projection_id,
    'projection',
    v_canonical_state_id,
    'canonical-state',
    'projection',
    v_authority_id,
    true,                          -- I.1.A: provenance for authorised projection public
    v_prov_proj_hash
  )
  returning provenance_id into v_provenance_proj_id;

  -- Wire provenance_ref onto projection
  update public.projection
  set provenance_ref = v_provenance_proj_id
  where projection_id = v_projection_id;

  -- -------------------------------------------------------------------------
  -- 10. MEDIA ASSET (placeholder — storage_ref and endpoint_ref are mutable)
  --     integrity_hash = placeholder prefix + projection_id for traceability
  --     Will be replaced by real SHA-256 when ingestLivepeerAsset() is called.
  -- -------------------------------------------------------------------------
  insert into public.media_asset (
    asset_type,
    storage_ref,
    integrity_hash,
    format,
    resolution,
    duration_ms
  ) values (
    'streaming-variant',
    'seed:placeholder:golden-shovel-world-v1',
    'seed:placeholder:' || v_projection_id::text,
    null,
    null,
    null
  )
  returning asset_id into v_asset_id;

  -- -------------------------------------------------------------------------
  -- 11. DELIVERY VARIANT (placeholder endpoint_ref — mutable)
  -- -------------------------------------------------------------------------
  insert into public.delivery_variant (
    asset_id,
    delivery_format,
    endpoint_ref
  ) values (
    v_asset_id,
    'hls',
    'seed:placeholder:golden-shovel-world-v1'
  )
  returning variant_id into v_variant_id;

  -- -------------------------------------------------------------------------
  -- 12. PROJECTION MEDIA BINDING (primary, public — required by V1 /worlds surface)
  -- -------------------------------------------------------------------------
  insert into public.projection_media_binding (
    projection_id,
    asset_id,
    binding_type,
    access_level,
    created_by
  ) values (
    v_projection_id,
    v_asset_id,
    'primary',
    'public',
    v_participant_id
  )
  returning binding_id into v_binding_id;

  -- -------------------------------------------------------------------------
  -- 13. CANONICAL OPERATION LOG (append-only record of seed operations)
  -- -------------------------------------------------------------------------
  insert into public.canonical_operation_log
    (authority_id, operation, subject_id, subject_type, result)
  values
    (v_authority_id, 'register-master',       v_master_id,           'master',          'accepted'),
    (v_authority_id, 'create-canonical-state', v_canonical_state_id,  'canonical-state', 'accepted'),
    (v_authority_id, 'authorise-projection',   v_projection_id,       'projection',      'accepted'),
    (v_authority_id, 'attach-media-binding',   v_binding_id,          'media-binding',   'accepted');

  raise notice 'Seed complete. participant=% authority=% master=% canonical_state=% projection=% asset=% variant=% binding=%',
    v_participant_id, v_authority_id, v_master_id, v_canonical_state_id,
    v_projection_id, v_asset_id, v_variant_id, v_binding_id;

end $$;
