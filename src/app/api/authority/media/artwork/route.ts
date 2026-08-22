import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, validateAuthority } from "@/lib/authority/validate";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { master_id, projection_id, thumbnail_url } = await request.json();
  if (!master_id || !thumbnail_url) return NextResponse.json({ error: "master_id and thumbnail_url required" }, { status: 400 });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(thumbnail_url);
  } catch {
    return NextResponse.json({ error: "thumbnail_url must be a valid URL" }, { status: 400 });
  }
  if (parsedUrl.protocol !== "https:") return NextResponse.json({ error: "thumbnail_url must use HTTPS" }, { status: 400 });

  const auth = await validateAuthority(participantId, "create-canonical-state", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();
  const { data: artwork, error: artworkError } = await svc
    .from("media_asset")
    .insert({
      asset_type: "thumbnail",
      storage_ref: parsedUrl.toString(),
      integrity_hash: `thumbnail:${parsedUrl.toString()}`,
      format: "image/png",
    })
    .select("asset_id, storage_ref")
    .single();
  if (artworkError || !artwork) return NextResponse.json({ error: artworkError?.message ?? "Failed to create artwork asset" }, { status: 500 });

  const { error: workError } = await svc
    .from("work_presentation")
    .update({ artwork_asset_id: artwork.asset_id, updated_at: new Date().toISOString() })
    .eq("master_id", master_id);
  if (workError) return NextResponse.json({ error: workError.message }, { status: 500 });

  if (projection_id) {
    const { error: projectionError } = await svc
      .from("projection_presentation")
      .update({ artwork_asset_id: artwork.asset_id, updated_at: new Date().toISOString() })
      .eq("projection_id", projection_id);
    if (projectionError) return NextResponse.json({ error: projectionError.message }, { status: 500 });
  }

  return NextResponse.json({ asset_id: artwork.asset_id, artwork_url: artwork.storage_ref }, { status: 201 });
}
