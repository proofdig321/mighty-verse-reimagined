import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { beginMuxUrlIngest } from "@/lib/media/url-ingest";

/**
 * POST /api/authority/media/ingest-url
 *
 * YouTube / HTTPS URL → Mux pull. Does not create a Universe.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  const { url, name, projection_id, master_id, intake_id } = body as {
    url?: string;
    name?: string;
    projection_id?: string | null;
    master_id?: string | null;
    intake_id?: string | null;
  };

  const result = await beginMuxUrlIngest({
    url: typeof url === "string" ? url : "",
    name: typeof name === "string" ? name : "YouTube ingest",
    participantId,
    projectionId: projection_id ?? null,
    masterId: master_id ?? null,
    intakeId: intake_id ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    session_id: result.session_id,
    provider_asset_id: result.provider_asset_id,
    uploaded: true,
  });
}
