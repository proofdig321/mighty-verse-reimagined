import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";
import { mergeWorkPresentationIdentity, validateUniverseIdentity } from "@/lib/assemble/identity";

// POST /api/authority/presentation
// Body: { master_id, title, description? }
// Upserts work_presentation for the given master.
// Presentation layer only — does NOT touch master, canonical_state, or provenance.
// Identity-only payloads preserve existing description_md and artwork_asset_id.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json();
  const master_id = body?.master_id;
  const identity = validateUniverseIdentity({ title: body?.title, description: body?.description });
  if (!master_id || !identity.ok) {
    return NextResponse.json({ error: "master_id and title required" }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "create-canonical-state", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();
  const { data: existing } = await svc
    .from("work_presentation")
    .select("title, description, description_md, artwork_asset_id")
    .eq("master_id", master_id)
    .maybeSingle();

  const { data, error } = await svc
    .from("work_presentation")
    .upsert(mergeWorkPresentationIdentity(master_id, identity.value, existing, body), { onConflict: "master_id" })
    .select("presentation_id, master_id, title, description, description_md, artwork_asset_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 200 });
}
