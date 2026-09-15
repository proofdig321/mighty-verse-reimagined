import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { beginMuxUrlIngest, ensureUrlIngestIntake } from "@/lib/media/url-ingest";
import { parseMediaSourceUrl } from "@/lib/media/source-url";

export const maxDuration = 300;

/**
 * POST /api/authority/media/ingest-url
 *
 * YouTube → fetch media file → Mux Direct Upload.
 * Direct HTTPS media URL → Mux URL pull.
 * Creates or reuses a Gallery intake. Does not create a Universe.
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

  const { url, name, projection_id, master_id, intake_id, work_type, youtube_cookies } = body as {
    url?: string;
    name?: string;
    projection_id?: string | null;
    master_id?: string | null;
    intake_id?: string | null;
    work_type?: string;
    youtube_cookies?: string | null;
  };

  const parsed = parseMediaSourceUrl(typeof url === "string" ? url : "");
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const intake = await ensureUrlIngestIntake({
    participantId,
    url: parsed.url,
    name: typeof name === "string" ? name : "YouTube ingest",
    intakeId: intake_id ?? null,
    workType: typeof work_type === "string" ? work_type : undefined,
  });
  if (!intake.ok) {
    return NextResponse.json({ error: intake.error, url: parsed.url }, { status: intake.status });
  }

  const result = await beginMuxUrlIngest({
    url: parsed.url,
    name: typeof name === "string" ? name : "YouTube ingest",
    participantId,
    projectionId: projection_id ?? null,
    masterId: master_id ?? null,
    intakeId: intake.intake_id,
    youtubeCookies: typeof youtube_cookies === "string" ? youtube_cookies : null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, intake_id: intake.intake_id, url: parsed.url },
      { status: result.status },
    );
  }

  return NextResponse.json({
    session_id: result.session_id,
    provider_asset_id: result.provider_asset_id,
    intake_id: intake.intake_id,
    url: parsed.url,
    uploaded: true,
  });
}
