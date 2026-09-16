import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { playableGallerySources } from "@/lib/assemble/gallery-source";
import { loadCurateStudioMedia } from "@/lib/assemble/load-studio";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const studio = await loadCurateStudioMedia();
  return NextResponse.json({ sources: playableGallerySources(studio.media) });
}
