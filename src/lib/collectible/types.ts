// Types mirror the A3/A4 schema exactly. No invented fields.

export type CollectibleClass =
  | "card"
  | "edition"
  | "interpretation-collectible"
  | "mural-representation"
  | "creative-moment-projection"
  | "other";

export type OwnershipRail = "web2" | "web3";

export type EntitlementBundle = {
  entitlement_bundle_id: string;
  access_rights: Record<string, unknown>;
  recognition_rights: Record<string, unknown>;
  transfer_rights: Record<string, unknown>;
  economic_entitlements: Record<string, unknown>;
  created_at: string;
  created_by: string;
};

export type Collectible = {
  collectible_id: string;
  collectible_class: CollectibleClass;
  projection_id: string;
  canonical_state_id: string;
  master_id: string;
  provenance_id: string;
  issuance_id: string;
  edition_info: Record<string, unknown> | null;
  issued_at: string;
  issued_by: string;
  // economic terms — immutable at issuance
  primary_waterfall_id: string;
  primary_waterfall_version: string;
  secondary_waterfall_id: string | null;
  secondary_waterfall_version: string | null;
  entitlement_bundle_id: string;
  economic_rule_snapshot: Record<string, unknown>;
  // ownership — mutable
  current_owner_ref: string | null;
  ownership_rail: OwnershipRail;
  web3_token_ref: Record<string, unknown> | null;
};

export type OwnershipTransfer = {
  transfer_id: string;
  collectible_id: string;
  from_owner_ref: string | null;
  to_owner_ref: string;
  transferred_at: string;
  transfer_basis: string;
  economic_event_id: string | null;
};

// Input for issueCollectible() — caller supplies all immutable issuance fields
export type CollectibleIssuanceInput = {
  collectible_class: CollectibleClass;
  projection_id: string;
  canonical_state_id: string;
  master_id: string;
  provenance_id: string;
  issuance_id: string;
  edition_info?: Record<string, unknown> | null;
  issued_by: string; // authority_record.authority_id
  primary_waterfall_id: string;
  primary_waterfall_version: string;
  secondary_waterfall_id?: string | null;
  secondary_waterfall_version?: string | null;
  entitlement_bundle: Omit<EntitlementBundle, "entitlement_bundle_id" | "created_at">;
  economic_rule_snapshot: Record<string, unknown>;
  initial_owner_ref?: string | null;
};
