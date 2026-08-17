-- =============================================================================
-- Mighty Verse Reimagined — Initial Schema
-- Implements A1–A13 entity groups from 05-architecture.md
-- Constitutional constraints are enforced via RLS, CHECK constraints, and
-- application-layer triggers. Immutability is enforced by RLS (no UPDATE/DELETE
-- on append-only tables) and by column-level constraints where possible.
-- =============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

create type canonical_type as enum (
  'song-world', 'creative-moment', 'mural', 'interpretation', 'other'
);

create type authorisation_state as enum (
  'draft', 'authorised', 'superseded', 'revoked'
);

create type projection_type as enum (
  'experiential', 'distributional', 'archival', 'collectible-designated', 'other'
);

create type provenance_subject_type as enum (
  'canonical-state', 'projection', 'interpretation', 'collectible'
);

create type provenance_relationship_type as enum (
  'canonical-revision', 'projection', 'interpretation', 'derivative', 'collectible-issuance'
);

create type collectible_class as enum (
  'card', 'edition', 'interpretation-collectible', 'mural-representation', 'creative-moment-projection', 'other'
);

create type ownership_rail as enum ('web2', 'web3');

create type economic_channel as enum (
  'consumption', 'advertising', 'primary-issuance', 'secondary-transfer',
  'interpretation', 'platform', 'other'
);

create type waterfall_status as enum ('draft', 'active', 'superseded');

create type calculation_mode as enum ('independent', 'sequential');

create type participant_role_type as enum (
  'canonical-creator', 'collaborator', 'featured-artist', 'interpretation-creator',
  'collector', 'audience', 'authorised-canonical-authority', 'delegated-authority',
  'mighty-verse-platform', 'director', 'other'
);

create type attribution_role_type as enum (
  'original-artist', 'director', 'collaborator', 'featured-artist',
  'interpretation-creator', 'other'
);

create type identity_type as enum (
  'web2-account', 'email', 'oauth-provider', 'wallet', 'web3-did', 'isrc-party', 'other'
);

create type authority_type as enum ('ultimate', 'delegated');

create type scope_type as enum (
  'platform', 'master', 'mural', 'catalogue', 'creative-domain', 'other-bounded'
);

create type authority_capability as enum (
  'create-canonical-state', 'advance-master-state', 'authorise-projection',
  'designate-collectible', 'authorise-interpretation', 'delegate-authority',
  'revoke-delegation'
);

create type event_type as enum (
  'consumption', 'advertising', 'primary-issuance', 'secondary-transfer',
  'creator-entitlement', 'settlement', 'refund', 'correction', 'reversal',
  'platform-consumption', 'other'
);

create type correction_type as enum (
  'correction', 'reversal', 'refund', 'attribution-correction',
  'provenance-correction', 'participant-correction', 'rule-correction'
);

create type event_status as enum ('active', 'corrected', 'reversed');

create type settlement_state as enum (
  'Calculated', 'Accrued', 'Payable', 'Settled', 'Held', 'Reversed'
);

create type settlement_method as enum ('web2-payment', 'web3-transfer', 'other');

create type settlement_record_state as enum ('completed', 'pending', 'failed');

create type attachment_level as enum (
  'platform', 'work', 'projection', 'collectible-class', 'collectible'
);

create type entitlement_basis as enum (
  'gross-revenue', 'net-revenue', 'remainder', 'fixed-amount', 'formula'
);

create type calculation_method as enum ('percentage', 'fixed', 'formula');

create type asset_type as enum (
  'original', 'transcode', 'streaming-variant', 'thumbnail', 'preview',
  'downloadable', 'metadata'
);

create type binding_type as enum (
  'primary', 'variant', 'thumbnail', 'preview', 'downloadable'
);

create type access_level as enum (
  'public', 'authenticated', 'owner-only', 'collector-only'
);

create type delivery_format as enum (
  'streaming', 'progressive-download', 'hls', 'dash', 'other'
);

create type signal_type as enum (
  'play', 'pause', 'complete', 'interaction', 'ad-impression', 'ad-view'
);

create type attribution_confidence as enum ('high', 'medium', 'low');

create type participant_status as enum ('active', 'suspended', 'deleted');

create type privacy_level as enum (
  'public-attribution', 'private-participant', 'operational-identity', 'economic-payment-identity'
);

-- =============================================================================
-- A13 — IDENTITY / PARTICIPANT (must exist before all other tables that
--        reference participant_id)
-- =============================================================================

create table participant (
  participant_id  uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  status          participant_status not null default 'active'
);

create table identity_link (
  link_id         uuid primary key default uuid_generate_v4(),
  participant_id  uuid not null references participant(participant_id),
  identity_type   identity_type not null,
  identity_ref    text not null,
  verified        boolean not null default false,
  verified_at     timestamptz,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index on identity_link(participant_id);
create index on identity_link(identity_type, identity_ref);

create table participant_role (
  role_id           uuid primary key default uuid_generate_v4(),
  participant_id    uuid not null references participant(participant_id),
  role_type         participant_role_type not null,
  scope_subject_id  uuid,
  scope_type        scope_type,
  effective_from    timestamptz not null default now(),
  effective_to      timestamptz,
  active            boolean not null default true,
  granted_by        uuid references participant(participant_id),
  created_at        timestamptz not null default now()
);

create index on participant_role(participant_id);
create index on participant_role(scope_subject_id) where scope_subject_id is not null;

-- =============================================================================
-- A11 — AUTHORITY RECORD (depends on participant)
-- =============================================================================

create table authority_record (
  authority_id          uuid primary key default uuid_generate_v4(),
  holder_ref            uuid not null references participant(participant_id),
  authority_type        authority_type not null,
  scope_type            scope_type not null,
  scope_subject_id      uuid,
  capabilities          authority_capability[] not null,
  delegated_from        uuid references authority_record(authority_id),
  effective_from        timestamptz not null default now(),
  effective_to          timestamptz,
  revoked               boolean not null default false,
  revoked_at            timestamptz,
  revoked_by            uuid references authority_record(authority_id),
  revocation_reason     text,
  authorisation_evidence text,
  created_at            timestamptz not null default now(),
  created_by            uuid not null references participant(participant_id),
  -- ultimate authority cannot be delegated as ultimate
  constraint ultimate_not_delegated check (
    not (authority_type = 'ultimate' and delegated_from is not null)
  )
);

create index on authority_record(holder_ref);
create index on authority_record(scope_subject_id) where scope_subject_id is not null;

-- Append-only log of canonical operations (A11)
create table canonical_operation_log (
  log_id          uuid primary key default uuid_generate_v4(),
  authority_id    uuid not null references authority_record(authority_id),
  operation       text not null,
  subject_id      uuid not null,
  subject_type    text not null,
  occurred_at     timestamptz not null default now(),
  result          text not null,  -- 'accepted' | 'rejected'
  rejection_reason text
);

-- =============================================================================
-- A1 — MASTER + CANONICAL STATE (depends on participant/authority)
-- =============================================================================

-- Forward-declare master so canonical_state can reference it
create table master (
  master_id         uuid primary key default uuid_generate_v4(),
  canonical_type    canonical_type not null,
  created_at        timestamptz not null default now(),
  created_by        uuid not null references participant(participant_id),
  -- current_state_id is a mutable forward pointer; set after first canonical_state insert
  current_state_id  uuid,
  attribution_ref   uuid  -- FK added after attribution_record table exists
);

create table canonical_state (
  canonical_state_id      uuid primary key default uuid_generate_v4(),
  master_id               uuid not null references master(master_id),
  version                 integer not null,
  parent_state_id         uuid references canonical_state(canonical_state_id),
  created_at              timestamptz not null default now(),
  authorised_by           uuid not null references authority_record(authority_id),
  authorisation_state     authorisation_state not null default 'draft',
  attribution_snapshot_ref uuid,  -- FK added after attribution_record
  content_refs            jsonb,
  integrity_hash          text not null,
  provenance_ref          uuid,   -- FK added after provenance_record
  constraint version_positive check (version > 0),
  constraint root_has_no_parent check (
    (version = 1 and parent_state_id is null) or version > 1
  ),
  unique (master_id, version)
);

create index on canonical_state(master_id);

-- Add FK from master to canonical_state now that canonical_state exists
alter table master
  add constraint master_current_state_fk
  foreign key (current_state_id) references canonical_state(canonical_state_id);

-- =============================================================================
-- A2 — PROVENANCE RECORD (depends on master, canonical_state)
-- =============================================================================

create table provenance_record (
  provenance_id     uuid primary key default uuid_generate_v4(),
  subject_id        uuid not null,
  subject_type      provenance_subject_type not null,
  source_id         uuid,
  source_type       provenance_subject_type,
  relationship_type provenance_relationship_type not null,
  created_at        timestamptz not null default now(),
  authorised_by     uuid not null references authority_record(authority_id),
  public            boolean not null default false,
  integrity_hash    text not null,
  -- root canonical state has no source
  constraint root_has_no_source check (
    (relationship_type = 'canonical-revision' and source_id is null and source_type is null)
    or source_id is not null
  )
);

create index on provenance_record(subject_id);
create index on provenance_record(source_id) where source_id is not null;

-- Wire provenance_ref back onto canonical_state
alter table canonical_state
  add constraint canonical_state_provenance_fk
  foreign key (provenance_ref) references provenance_record(provenance_id);

-- =============================================================================
-- A1 — PROJECTION (depends on canonical_state, provenance_record)
-- =============================================================================

create table projection (
  projection_id           uuid primary key default uuid_generate_v4(),
  canonical_state_id      uuid not null references canonical_state(canonical_state_id),
  master_id               uuid not null references master(master_id),
  projection_type         projection_type not null,
  collectible_designated  boolean not null default false,
  created_at              timestamptz not null default now(),
  created_by              uuid not null references authority_record(authority_id),
  content_refs            jsonb,
  integrity_hash          text not null,
  provenance_ref          uuid references provenance_record(provenance_id)
);

create index on projection(canonical_state_id);
create index on projection(master_id);

-- =============================================================================
-- A13 — ATTRIBUTION RECORD (depends on master, canonical_state, participant)
-- =============================================================================

create table attribution_record (
  attribution_id      uuid primary key default uuid_generate_v4(),
  master_id           uuid references master(master_id),
  canonical_state_id  uuid references canonical_state(canonical_state_id),
  version             integer not null default 1,
  created_at          timestamptz not null default now(),
  constraint attribution_has_subject check (
    master_id is not null or canonical_state_id is not null
  )
);

create table attribution_entry (
  entry_id                  uuid primary key default uuid_generate_v4(),
  attribution_id            uuid not null references attribution_record(attribution_id),
  participant_id            uuid not null references participant(participant_id),
  role_type                 attribution_role_type not null,
  contribution_description  text,
  public                    boolean not null default false,
  privacy_level             privacy_level not null default 'private-participant'
);

create index on attribution_entry(attribution_id);
create index on attribution_entry(participant_id);

-- Wire attribution FKs now that attribution_record exists
alter table master
  add constraint master_attribution_fk
  foreign key (attribution_ref) references attribution_record(attribution_id);

alter table canonical_state
  add constraint canonical_state_attribution_snapshot_fk
  foreign key (attribution_snapshot_ref) references attribution_record(attribution_id);

-- =============================================================================
-- A4 — WATERFALL DEFINITIONS + VERSIONS (depends on participant)
-- =============================================================================

create table waterfall_definition (
  waterfall_id      uuid primary key default uuid_generate_v4(),
  name              text not null,
  economic_channel  economic_channel not null,
  created_at        timestamptz not null default now(),
  created_by        uuid not null references participant(participant_id)
);

create table waterfall_version (
  waterfall_version_id  uuid primary key default uuid_generate_v4(),
  waterfall_id          uuid not null references waterfall_definition(waterfall_id),
  version               integer not null,
  effective_from        timestamptz not null,
  effective_to          timestamptz,
  status                waterfall_status not null default 'draft',
  calculation_mode      calculation_mode not null,
  -- participants stored as ordered JSONB array of WaterfallParticipantEntry
  participants          jsonb not null default '[]',
  conditions            jsonb,
  integrity_hash        text not null,
  created_at            timestamptz not null default now(),
  authorised_by         uuid not null references authority_record(authority_id),
  unique (waterfall_id, version)
);

create index on waterfall_version(waterfall_id);

create table rule_attachment (
  attachment_id         uuid primary key default uuid_generate_v4(),
  waterfall_id          uuid not null references waterfall_definition(waterfall_id),
  waterfall_version_id  uuid not null references waterfall_version(waterfall_version_id),
  attachment_level      attachment_level not null,
  subject_id            uuid,
  subject_type          text,
  effective_from        timestamptz not null,
  effective_to          timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid not null references participant(participant_id)
);

create index on rule_attachment(subject_id) where subject_id is not null;
create index on rule_attachment(attachment_level);

-- =============================================================================
-- A3 — COLLECTIBLE (depends on projection, provenance_record, waterfall_version)
-- =============================================================================

create table collectible (
  collectible_id              uuid primary key default uuid_generate_v4(),
  collectible_class           collectible_class not null,
  projection_id               uuid not null references projection(projection_id),
  canonical_state_id          uuid not null references canonical_state(canonical_state_id),
  master_id                   uuid not null references master(master_id),
  provenance_id               uuid not null references provenance_record(provenance_id),
  issuance_id                 uuid not null,
  edition_info                jsonb,
  issued_at                   timestamptz not null default now(),
  issued_by                   uuid not null references authority_record(authority_id),
  -- economic terms — immutable at issuance
  primary_waterfall_id        uuid not null references waterfall_definition(waterfall_id),
  primary_waterfall_version   uuid not null references waterfall_version(waterfall_version_id),
  secondary_waterfall_id      uuid references waterfall_definition(waterfall_id),
  secondary_waterfall_version uuid references waterfall_version(waterfall_version_id),
  entitlement_bundle_id       uuid not null,
  economic_rule_snapshot      jsonb not null,
  -- ownership (mutable)
  current_owner_ref           uuid references participant(participant_id),
  ownership_rail              ownership_rail not null default 'web2',
  web3_token_ref              jsonb  -- { chain, contract, token_id }
);

create index on collectible(projection_id);
create index on collectible(canonical_state_id);
create index on collectible(master_id);
create index on collectible(current_owner_ref) where current_owner_ref is not null;

create table ownership_transfer (
  transfer_id       uuid primary key default uuid_generate_v4(),
  collectible_id    uuid not null references collectible(collectible_id),
  from_owner_ref    uuid references participant(participant_id),
  to_owner_ref      uuid not null references participant(participant_id),
  transferred_at    timestamptz not null default now(),
  transfer_basis    text not null,
  economic_event_id uuid  -- FK added after economic_event table exists
);

create index on ownership_transfer(collectible_id);

-- =============================================================================
-- A5 / A6 / A7 / A9 — ECONOMIC EVENTS + ENTITLEMENTS + SETTLEMENT
-- =============================================================================

create table economic_event (
  event_id              uuid primary key default uuid_generate_v4(),
  event_type            event_type not null,
  attributed            boolean not null,
  source_ref            text,
  master_id             uuid references master(master_id),
  canonical_state_id    uuid references canonical_state(canonical_state_id),
  projection_id         uuid references projection(projection_id),
  collectible_id        uuid references collectible(collectible_id),
  provenance_id         uuid references provenance_record(provenance_id),
  attribution_snapshot  jsonb,  -- immutable snapshot of attribution_record at event time
  waterfall_version_id  uuid references waterfall_version(waterfall_version_id),
  economic_basis        numeric(20,8),
  currency              text not null default 'USD',
  occurred_at           timestamptz not null,
  calculated_at         timestamptz,
  -- correction chain
  correction_of         uuid references economic_event(event_id),
  correction_type       correction_type,
  correction_reason     text,
  correction_basis      text,
  status                event_status not null default 'active',
  -- attribution basis for consumption/advertising events
  attribution_basis     text,
  -- transfer reference for secondary-transfer events
  transfer_id           uuid references ownership_transfer(transfer_id),
  -- A7: attributed=true requires master_id
  constraint attributed_requires_master check (
    not attributed or master_id is not null
  ),
  -- correction events must carry correction_of
  constraint correction_requires_ref check (
    correction_type is null or correction_of is not null
  )
);

create index on economic_event(master_id) where master_id is not null;
create index on economic_event(collectible_id) where collectible_id is not null;
create index on economic_event(correction_of) where correction_of is not null;
create index on economic_event(occurred_at);

-- Wire economic_event FK back onto ownership_transfer
alter table ownership_transfer
  add constraint ownership_transfer_economic_event_fk
  foreign key (economic_event_id) references economic_event(event_id);

create table economic_entitlement (
  entitlement_id      uuid primary key default uuid_generate_v4(),
  event_id            uuid not null references economic_event(event_id),
  participant_ref     uuid not null references participant(participant_id),
  participant_role    participant_role_type not null,
  calculation_basis   numeric(20,8) not null,
  calculation_method  calculation_method not null,
  calculation_value   text not null,  -- percentage, fixed amount, or formula id
  entitlement_amount  numeric(20,8) not null,
  currency            text not null default 'USD',
  calculated_at       timestamptz not null default now(),
  settlement_state    settlement_state not null default 'Calculated',
  settlement_ref      uuid  -- FK added after settlement_record
);

create index on economic_entitlement(event_id);
create index on economic_entitlement(participant_ref);
create index on economic_entitlement(settlement_state);

create table settlement_record (
  settlement_id     uuid primary key default uuid_generate_v4(),
  entitlement_ids   uuid[] not null,
  settlement_amount numeric(20,8) not null,
  currency          text not null default 'USD',
  settled_at        timestamptz not null default now(),
  settlement_method settlement_method not null,
  settlement_ref    text,  -- external payment/transaction reference
  settlement_state  settlement_record_state not null default 'pending',
  web3_settlement_ref text
);

-- Wire settlement_ref FK onto economic_entitlement
alter table economic_entitlement
  add constraint economic_entitlement_settlement_fk
  foreign key (settlement_ref) references settlement_record(settlement_id);

-- =============================================================================
-- A8 — SETTLEMENT THRESHOLD CONFIG
-- =============================================================================

create table settlement_threshold_config (
  config_id         uuid primary key default uuid_generate_v4(),
  participant_role  participant_role_type,  -- null = platform-wide
  channel           economic_channel not null,
  minimum_amount    numeric(20,8) not null,
  settlement_period interval,
  currency          text not null default 'USD',
  effective_from    timestamptz not null,
  effective_to      timestamptz,
  version           integer not null default 1
);

-- =============================================================================
-- A12 — MEDIA ASSETS + DELIVERY
-- =============================================================================

create table media_asset (
  asset_id        uuid primary key default uuid_generate_v4(),
  asset_type      asset_type not null,
  storage_ref     text not null,  -- mutable: assets may be moved
  integrity_hash  text not null,  -- immutable once set
  format          text,
  resolution      text,
  duration_ms     integer,
  created_at      timestamptz not null default now()
);

create table projection_media_binding (
  binding_id      uuid primary key default uuid_generate_v4(),
  projection_id   uuid not null references projection(projection_id),
  asset_id        uuid not null references media_asset(asset_id),
  binding_type    binding_type not null,
  access_level    access_level not null default 'public',
  created_at      timestamptz not null default now(),
  created_by      uuid not null references participant(participant_id)
);

create index on projection_media_binding(projection_id);
create index on projection_media_binding(asset_id);

create table delivery_variant (
  variant_id          uuid primary key default uuid_generate_v4(),
  asset_id            uuid not null references media_asset(asset_id),
  delivery_format     delivery_format not null,
  endpoint_ref        text,  -- mutable: CDN endpoint
  access_policy_ref   text
);

create index on delivery_variant(asset_id);

create table consumption_signal (
  signal_id             uuid primary key default uuid_generate_v4(),
  session_ref           text not null,
  participant_ref       uuid references participant(participant_id),  -- null = anonymous
  projection_id         uuid not null references projection(projection_id),
  master_id             uuid not null references master(master_id),
  canonical_state_id    uuid not null references canonical_state(canonical_state_id),
  signal_type           signal_type not null,
  occurred_at           timestamptz not null,
  attribution_confidence attribution_confidence not null
);

create index on consumption_signal(projection_id);
create index on consumption_signal(master_id);
create index on consumption_signal(occurred_at);

-- =============================================================================
-- ENTITLEMENT BUNDLE (referenced by collectible; structure defined here)
-- =============================================================================

create table entitlement_bundle (
  entitlement_bundle_id  uuid primary key default uuid_generate_v4(),
  access_rights          jsonb not null default '{}',
  recognition_rights     jsonb not null default '{}',
  transfer_rights        jsonb not null default '{}',
  economic_entitlements  jsonb not null default '{}',
  created_at             timestamptz not null default now(),
  created_by             uuid not null references participant(participant_id)
);

-- Wire entitlement_bundle_id FK onto collectible
alter table collectible
  add constraint collectible_entitlement_bundle_fk
  foreign key (entitlement_bundle_id) references entitlement_bundle(entitlement_bundle_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- Append-only enforcement: no DELETE, no UPDATE on immutable tables.
-- Application layer enforces the permitted mutations (e.g. master.current_state_id,
-- collectible.current_owner_ref, economic_event.status, entitlement.settlement_state).
-- Full RLS policies (per-role read/write) are added in subsequent migrations
-- once Supabase Auth roles are established.
-- =============================================================================

alter table master enable row level security;
alter table canonical_state enable row level security;
alter table provenance_record enable row level security;
alter table projection enable row level security;
alter table attribution_record enable row level security;
alter table attribution_entry enable row level security;
alter table authority_record enable row level security;
alter table canonical_operation_log enable row level security;
alter table participant enable row level security;
alter table identity_link enable row level security;
alter table participant_role enable row level security;
alter table waterfall_definition enable row level security;
alter table waterfall_version enable row level security;
alter table rule_attachment enable row level security;
alter table collectible enable row level security;
alter table ownership_transfer enable row level security;
alter table economic_event enable row level security;
alter table economic_entitlement enable row level security;
alter table settlement_record enable row level security;
alter table settlement_threshold_config enable row level security;
alter table media_asset enable row level security;
alter table projection_media_binding enable row level security;
alter table delivery_variant enable row level security;
alter table consumption_signal enable row level security;
alter table entitlement_bundle enable row level security;

-- Temporary open policy for service_role during development bootstrap.
-- These are replaced by scoped policies in the auth migration.
do $$
declare
  t text;
begin
  foreach t in array array[
    'master','canonical_state','provenance_record','projection',
    'attribution_record','attribution_entry','authority_record',
    'canonical_operation_log','participant','identity_link','participant_role',
    'waterfall_definition','waterfall_version','rule_attachment',
    'collectible','ownership_transfer','economic_event','economic_entitlement',
    'settlement_record','settlement_threshold_config','media_asset',
    'projection_media_binding','delivery_variant','consumption_signal',
    'entitlement_bundle'
  ]
  loop
    execute format(
      'create policy "service_role_all" on %I for all to service_role using (true) with check (true)',
      t
    );
  end loop;
end $$;
