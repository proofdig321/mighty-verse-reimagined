-- =============================================================================
-- Mighty Verse Reimagined — Step 5 support: grant table privileges to roles
--
-- The initial schema created RLS policies for service_role and authenticated
-- but did not issue explicit GRANT statements. PostgREST requires both RLS
-- policies AND table-level GRANTs. This migration adds the minimum required
-- grants so the application service client and authenticated users can access
-- the tables they are already permitted to access via RLS.
-- =============================================================================

-- service_role: full access to all domain tables (mirrors service_role_all RLS policies)
grant select, insert, update, delete on
  public.master,
  public.canonical_state,
  public.provenance_record,
  public.projection,
  public.attribution_record,
  public.attribution_entry,
  public.authority_record,
  public.canonical_operation_log,
  public.participant,
  public.identity_link,
  public.participant_role,
  public.media_asset,
  public.projection_media_binding,
  public.delivery_variant,
  public.consumption_signal,
  public.waterfall_definition,
  public.waterfall_version,
  public.rule_attachment,
  public.collectible,
  public.ownership_transfer,
  public.economic_event,
  public.economic_entitlement,
  public.settlement_record,
  public.settlement_threshold_config,
  public.entitlement_bundle
to service_role;

-- authenticated: select on tables with authenticated RLS policies
grant select on
  public.participant,
  public.identity_link,
  public.media_asset,
  public.projection_media_binding,
  public.delivery_variant,
  public.consumption_signal
to authenticated;

grant insert on
  public.consumption_signal
to authenticated;

-- anon: select on tables with anon RLS policies
grant select on
  public.media_asset,
  public.projection_media_binding,
  public.delivery_variant,
  public.collectible,
  public.waterfall_definition,
  public.waterfall_version,
  public.rule_attachment,
  public.settlement_threshold_config
to anon;
