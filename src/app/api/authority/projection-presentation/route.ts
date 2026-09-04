import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";

// POST /api/authority/projection-presentation
// Body: { projection_id, master_id, title, description? }
// Upserts projection_presentation for the given projection.
// Presentation layer only — does NOT touch projection, canonical_state, or provenance.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { projection_id, master_id, title, description, description_md, artwork_asset_id } = await request.json();
  if (!projection_id || !master_id || !title?.trim()) {
    return NextResponse.json({ error: "projection_id, master_id, and title required" }, { status: 400 });
  }

  // Authority gate — scoped to the master that owns this projection
  const auth = await validateAuthority(participantId, "authorise-projection", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();

  // Verify the projection belongs to this master (prevents cross-master writes)
  const { data: proj } = await svc
    .from("projection")
    .select("projection_id")
    .eq("projection_id", projection_id)
    .eq("master_id", master_id)
    .single();
  if (!proj) return NextResponse.json({ error: "Projection not found for this master" }, { status: 404 });

  const { data, error } = await svc
    .from("projection_presentation")
    .upsert(
      {
        projection_id,
        title: title.trim(),
        description: description?.trim() ?? null,
        description_md: description_md?.trim() ?? null,
        artwork_asset_id: artwork_asset_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "projection_id" }
    )
    .select("presentation_id, projection_id, title, description, description_md, artwork_asset_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 200 });
}
