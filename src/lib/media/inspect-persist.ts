/**
 * Sentinel source-media persist contract.
 *
 * Inspection evidence belongs to a media_asset. A canonical master is optional
 * authority context only — never a fake work, never written onto the session.
 *
 * SENTINEL ≠ CREATIVE AUTHORITY.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isInspectionId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export type InspectionPersistScope = "source_media" | "master_scoped";

export type InspectionPersistDecisionOk = {
  ok: true;
  action: "persist_source_inspection";
  asset_id: string;
  master_id: string | null;
  scope: InspectionPersistScope;
  creates_universe: false;
  creates_mural: false;
  creates_scene: false;
  creates_creative_moment: false;
  creates_projection: false;
  creates_binding: false;
  creates_realization: false;
  creates_canonical: false;
};

export type InspectionPersistRejectCode =
  | "missing_ids"
  | "invalid_id"
  | "missing_evidence";

export type InspectionPersistDecisionErr = {
  ok: false;
  code: InspectionPersistRejectCode;
  message: string;
};

export type InspectionPersistDecision =
  | InspectionPersistDecisionOk
  | InspectionPersistDecisionErr;

function reject(
  code: InspectionPersistRejectCode,
  message: string,
): InspectionPersistDecisionErr {
  return { ok: false, code, message };
}

function optionalId(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

/**
 * Decide whether a persist request is valid source-media inspection evidence.
 *
 * Does not look up the asset. Existence is enforced by persistInspection.
 * Does not create or attach canonical objects.
 */
export function decideInspectionPersist(input: {
  asset_id?: unknown;
  master_id?: unknown;
  metadata?: unknown;
  frames?: unknown;
  deltas?: unknown;
  candidateTimestampsMs?: unknown;
}): InspectionPersistDecision {
  const assetId = optionalId(input.asset_id);
  if (!assetId) {
    return reject("missing_ids", "A media asset is required.");
  }
  if (!isInspectionId(assetId)) {
    return reject("invalid_id", "Media asset must be a canonical identifier.");
  }

  const masterId = optionalId(input.master_id);
  if (masterId && !isInspectionId(masterId)) {
    return reject("invalid_id", "Canonical work must be a canonical identifier.");
  }

  if (
    input.metadata == null ||
    typeof input.metadata !== "object" ||
    Array.isArray(input.metadata) ||
    !Array.isArray(input.frames) ||
    !Array.isArray(input.deltas) ||
    !Array.isArray(input.candidateTimestampsMs)
  ) {
    return reject(
      "missing_evidence",
      "Inspection evidence (metadata, frames, deltas, and candidates) is required.",
    );
  }

  return {
    ok: true,
    action: "persist_source_inspection",
    asset_id: assetId,
    master_id: masterId || null,
    scope: masterId ? "master_scoped" : "source_media",
    creates_universe: false,
    creates_mural: false,
    creates_scene: false,
    creates_creative_moment: false,
    creates_projection: false,
    creates_binding: false,
    creates_realization: false,
    creates_canonical: false,
  };
}
