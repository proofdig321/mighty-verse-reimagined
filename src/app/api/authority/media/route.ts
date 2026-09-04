import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { attachMediaBinding } from "@/lib/authority/operations";
import { getServiceClient } from "@/lib/authority/validate";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const {
    projection_id, master_id, livepeer_asset_id,
    rights_holder_ref, rights_basis, realization_id,
    intake_id, session_id,
  } = await request.json();

  if (!projection_id || !master_id || !livepeer_asset_id) {
    return NextResponse.json({ error: "projection_id, master_id, livepeer_asset_id required" }, { status: 400 });
  }

  const result = await attachMediaBinding(
    participantId,
    projection_id,
    master_id,
    livepeer_asset_id,
    rights_holder_ref ?? null,
    rights_basis ?? null,
    realization_id ?? null,
    intake_id ?? null
  );

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 403 });

  // Mark the upload session as ingested
  if (session_id || livepeer_asset_id) {
    const svc = getServiceClient();
    const query = svc
      .from("media_upload_session")
      .update({
        phase: "ingested",
        asset_id: result.data.asset_id,
        updated_at: new Date().toISOString(),
      });
    if (session_id) {
      await query.eq("session_id", session_id);
    } else {
      await query.eq("provider", "livepeer").eq("provider_asset_id", livepeer_asset_id);
    }
  }

  return NextResponse.json(result.data, { status: 201 });
}
