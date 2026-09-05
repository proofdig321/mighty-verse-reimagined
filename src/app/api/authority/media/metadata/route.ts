import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority } from "@/lib/authority/validate";
import { buildCanonicalMetadata } from "@/lib/media/metadata-build";
import { syncSidecar, checkMetadataConsistency } from "@/lib/media/metadata-embed";

// GET /api/authority/media/metadata?asset_id=...
// Returns the consistency report for an asset's metadata.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assetId = new URL(request.url).searchParams.get("asset_id");
  if (!assetId) return NextResponse.json({ error: "asset_id required" }, { status: 400 });

  const meta = await buildCanonicalMetadata(assetId);
  if (!meta) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const report = await checkMetadataConsistency(assetId, meta);
  return NextResponse.json({ meta, report });
}

// POST /api/authority/media/metadata
// Body: { asset_id }
// Synchronises the sidecar for an asset from canonical records.
// Requires create-canonical-state authority on the associated master.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { asset_id } = await request.json();
  if (!asset_id) return NextResponse.json({ error: "asset_id required" }, { status: 400 });

  const meta = await buildCanonicalMetadata(asset_id);
  if (!meta) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  // Authority gate — require create-canonical-state on the master
  if (meta.masterId) {
    const auth = await validateAuthority(participantId, "create-canonical-state", meta.masterId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  const result = await syncSidecar(asset_id, meta);
  return NextResponse.json({ asset_id, result, meta }, { status: result.sidecarStored ? 200 : 500 });
}
