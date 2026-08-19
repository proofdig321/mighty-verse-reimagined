import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority } from "@/lib/authority/validate";
import { livepeer } from "@/lib/livepeer/client";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { name, projection_id, master_id } = await request.json();
  if (!name || !projection_id || !master_id) {
    return NextResponse.json({ error: "name, projection_id, master_id required" }, { status: 400 });
  }

  // Authority gate — same capability as attachMediaBinding
  const auth = await validateAuthority(participantId, "authorise-projection", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  // Create Livepeer upload session — LIVEPEER_API_KEY stays server-side
  const result = await livepeer.asset.create({ name });
  if (!result.data) return NextResponse.json({ error: "Failed to create upload session" }, { status: 500 });

  return NextResponse.json({
    upload_url: result.data.url,
    asset_id: result.data.asset.id,
  });
}
