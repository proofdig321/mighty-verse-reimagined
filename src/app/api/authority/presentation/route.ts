import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";

// POST /api/authority/presentation
// Body: { master_id, title, description? }
// Upserts work_presentation for the given master.
// Presentation layer only — does NOT touch master, canonical_state, or provenance.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { master_id, title, description, description_md, artwork_asset_id } = await request.json();
  if (!master_id || !title?.trim()) {
    return NextResponse.json({ error: "master_id and title required" }, { status: 400 });
  }

  // Authority gate — same capability as canonical state operations
  const auth = await validateAuthority(participantId, "create-canonical-state", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();

  // Upsert on master_id unique constraint
  const { data, error } = await svc
    .from("work_presentation")
    .upsert(
      {
        master_id,
        title: title.trim(),
        description: description?.trim() ?? null,
        description_md: description_md?.trim() ?? null,
        artwork_asset_id: artwork_asset_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "master_id" }
    )
    .select("presentation_id, master_id, title, description, description_md, artwork_asset_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 200 });
}
