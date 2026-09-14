import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority } from "@/lib/authority/validate";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { createGenerationJob, processGenerationJob } from "@/lib/storyboard/generation";
import type { GenerationJobKind } from "@/lib/ai/jobs";

export const maxDuration = 300;

const KINDS = new Set<GenerationJobKind>([
  "still",
  "motion",
  "animate-still",
  "first-last-frame",
  "reference-motion",
  "extend",
  "gif",
  "reel",
  "animation",
]);

async function requireStoryboardUser(universeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const participantId = await getParticipantId(supabase);
  if (!participantId) return { error: NextResponse.json({ error: "No participant record" }, { status: 403 }) };
  if (universeId) {
    const assembly = await loadUniverseAssembly(universeId);
    if (!assembly) return { error: NextResponse.json({ error: "Universe was not found." }, { status: 404 }) };
    const auth = await validateAuthority(participantId, "authorise-projection", universeId);
    if ("error" in auth) return { error: NextResponse.json({ error: auth.error }, { status: 403 }) };
  }
  return { participantId };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const universeId = typeof body.universe_id === "string" ? body.universe_id.trim() : "";
  const workId = typeof body.work_id === "string" ? body.work_id.trim() : "";
  const panelId = typeof body.panel_id === "string" ? body.panel_id.trim() : "";
  const kind = (typeof body.kind === "string" ? body.kind : "") as GenerationJobKind;
  if (!KINDS.has(kind) || !workId) {
    return NextResponse.json({ error: "A work and generation kind are required.", creates_scene: false }, { status: 400 });
  }
  const auth = await requireStoryboardUser(universeId);
  if ("error" in auth) return auth.error;

  try {
    const job = await createGenerationJob({
      participantId: auth.participantId,
      workId,
      panelId: panelId || null,
      kind,
      request: { ...body, creates_canonical: false },
      prompt: typeof body.prompt === "string" ? body.prompt : `${kind}:${panelId}:${body.instruction ?? ""}`,
    });
    const processed = await processGenerationJob(job.job_id, auth.participantId);
    const pending = processed.status === "queued" || processed.status === "submitted" || processed.status === "processing";
    return NextResponse.json({
      ...processed,
      creates_scene: false,
      creates_canonical: false,
    }, { status: pending ? 202 : processed.status === "completed" ? 201 : 200 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Generation job failed.";
    return NextResponse.json({
      error: { code: "unknown", message },
      status: "failed",
      creates_scene: false,
      creates_canonical: false,
    }, { status: 500 });
  }
}
