import { createClient as createServiceClient } from "@supabase/supabase-js";

export function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type AuthorityCapability =
  | "create-canonical-state"
  | "advance-master-state"
  | "authorise-projection"
  | "designate-collectible"
  | "authorise-interpretation"
  | "delegate-authority"
  | "revoke-delegation";

export type ValidatedAuthority = {
  authority_id: string;
  participant_id: string;
  scope_type: string;
  scope_subject_id: string | null;
};

export type AuthorityError = { error: string };

/**
 * A11 five-step authority validation.
 * Steps 1–4 always checked. Step 5 (parent_state_id) checked by caller for
 * create-canonical-state operations.
 */
export async function validateAuthority(
  participantId: string,
  capability: AuthorityCapability,
  targetMasterId: string | null
): Promise<ValidatedAuthority | AuthorityError> {
  const supabase = getServiceClient();

  // Step 1: participant resolves to AuthorityRecord(s)
  const { data: records } = await supabase
    .from("authority_record")
    .select("authority_id, scope_type, scope_subject_id, capabilities, revoked, effective_to")
    .eq("holder_ref", participantId)
    .eq("revoked", false);

  if (!records || records.length === 0) {
    return { error: "No active AuthorityRecord for participant" };
  }

  const now = new Date();

  for (const rec of records) {
    // Step 2: not revoked, not expired
    if (rec.effective_to && new Date(rec.effective_to) < now) continue;

    // Step 3: scope covers target master
    if (rec.scope_type !== "platform" && rec.scope_subject_id !== targetMasterId) continue;

    // Step 4: capability present
    if (!(rec.capabilities as string[]).includes(capability)) continue;

    return {
      authority_id: rec.authority_id,
      participant_id: participantId,
      scope_type: rec.scope_type,
      scope_subject_id: rec.scope_subject_id,
    };
  }

  return { error: `AuthorityRecord does not grant capability: ${capability}` };
}

/** Append-only canonical operation log entry. */
export async function logOperation(
  authorityId: string,
  operation: string,
  subjectId: string,
  subjectType: string,
  result: "accepted" | "rejected",
  rejectionReason?: string
) {
  const supabase = getServiceClient();
  await supabase.from("canonical_operation_log").insert({
    authority_id: authorityId,
    operation,
    subject_id: subjectId,
    subject_type: subjectType,
    result,
    rejection_reason: rejectionReason ?? null,
  });
}

/**
 * Compute integrity hash via the canonical Postgres function.
 * Keys are sorted alphabetically before passing to match seed algorithm.
 */
export async function computeHash(fields: Record<string, unknown>): Promise<string> {
  const supabase = getServiceClient();
  const sorted = Object.fromEntries(
    Object.entries(fields).sort(([a], [b]) => a.localeCompare(b))
  );
  const { data, error } = await supabase.rpc("compute_integrity_hash", { fields: sorted });
  if (error || data == null) throw new Error(`Hash computation failed: ${error?.message}`);
  return data as string;
}
