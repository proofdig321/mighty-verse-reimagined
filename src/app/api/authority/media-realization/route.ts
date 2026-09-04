import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { createMediaRealization } from "@/lib/authority/operations";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";

const ISRC_PATTERN = /^[A-Z]{2}-?[A-Z0-9]{3}-?[0-9]{2}-?[0-9]{5}$/;
const VALID_ISRC_STATUSES = new Set(["verified", "not-provided", "not-applicable", "pending", "assignment-required"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { master_id, realization_type, rights_holder_ref, rights_basis, production_notes } = await request.json();
  if (!master_id || !realization_type) {
    return NextResponse.json({ error: "master_id and realization_type required" }, { status: 400 });
  }

  const result = await createMediaRealization(
    participantId,
    master_id,
    realization_type,
    rights_holder_ref ?? null,
    rights_basis ?? null,
    production_notes ?? null
  );

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json(result.data, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { realization_id, master_id, isrc, isrc_status, version_label } = await request.json();
  if (!realization_id || !master_id) {
    return NextResponse.json({ error: "realization_id and master_id required" }, { status: 400 });
  }
  if (isrc_status && !VALID_ISRC_STATUSES.has(isrc_status)) {
    return NextResponse.json({ error: "Invalid isrc_status" }, { status: 400 });
  }
  if (isrc_status === "verified" && (typeof isrc !== "string" || !ISRC_PATTERN.test(isrc))) {
    return NextResponse.json({ error: "A valid ISRC is required when isrc_status is verified" }, { status: 400 });
  }
  if (isrc && isrc_status !== "verified") {
    return NextResponse.json({ error: "ISRC must be omitted unless isrc_status is verified" }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "create-canonical-state", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();

  // Prevent duplicate ISRC assignment to a different realization
  if (isrc) {
    const { data: existing } = await svc
      .from("media_realization")
      .select("realization_id")
      .eq("isrc", isrc)
      .neq("realization_id", realization_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: `ISRC ${isrc} is already assigned to a different recording` }, { status: 409 });
    }
  }

  const update: Record<string, unknown> = {};
  if (isrc !== undefined) update.isrc = isrc ?? null;
  if (isrc_status !== undefined) update.isrc_status = isrc_status;
  if (version_label !== undefined) update.version_label = version_label?.trim() ?? null;

  const { error } = await svc
    .from("media_realization")
    .update(update)
    .eq("realization_id", realization_id)
    .eq("master_id", master_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ realization_id, updated: true });
}
