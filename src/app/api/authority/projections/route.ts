import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { createProjection } from "@/lib/authority/operations";
import { validateAuthority, logOperation, getServiceClient } from "@/lib/authority/validate";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { canonical_state_id, master_id, projection_type } = await request.json();
  if (!canonical_state_id || !master_id || !projection_type) {
    return NextResponse.json({ error: "canonical_state_id, master_id, projection_type required" }, { status: 400 });
  }

  const result = await createProjection(participantId, canonical_state_id, master_id, projection_type);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json(result.data, { status: 201 });
}

/**
 * PATCH /api/authority/projections
 *
 * Set content_refs on a distributional projection.
 * Only distributional projections may carry a content URL.
 * The URL must be explicit, authority-gated, and auditable.
 * A URL alone does not make content public — the projection must be
 * authorised and the master must have a current canonical state.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const projectionId = typeof body.projection_id === "string" ? body.projection_id.trim() : "";
  const masterId = typeof body.master_id === "string" ? body.master_id.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!projectionId || !masterId) {
    return NextResponse.json({ error: "projection_id and master_id required" }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "authorise-projection", masterId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();
  const { data: projection } = await svc
    .from("projection")
    .select("projection_id, master_id, projection_type, content_refs")
    .eq("projection_id", projectionId)
    .eq("master_id", masterId)
    .maybeSingle();

  if (!projection) {
    return NextResponse.json({ error: "Projection not found for this master" }, { status: 404 });
  }
  if (projection.projection_type !== "distributional") {
    return NextResponse.json({
      error: "Only distributional projections may carry a content URL",
      code: "wrong_projection_type",
    }, { status: 400 });
  }

  // url may be null to clear the distributional URL
  const contentRefs = url
    ? { ...(projection.content_refs as Record<string, unknown> ?? {}), url }
    : { ...(projection.content_refs as Record<string, unknown> ?? {}), url: null };

  const { error } = await svc
    .from("projection")
    .update({ content_refs: contentRefs })
    .eq("projection_id", projectionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logOperation(auth.authority_id, "set-distributional-url", projectionId, "projection", "accepted");

  return NextResponse.json({ projection_id: projectionId, master_id: masterId, content_refs: contentRefs });
}
