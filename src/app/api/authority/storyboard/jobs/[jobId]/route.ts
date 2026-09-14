import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { cancelGenerationJob, getGenerationJob, processGenerationJob, retryGenerationJob } from "@/lib/storyboard/generation";

export const maxDuration = 300;

async function participant() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const participantId = await getParticipantId(supabase);
  if (!participantId) return { error: NextResponse.json({ error: "No participant record" }, { status: 403 }) };
  return { participantId };
}

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await participant();
  if ("error" in auth) return auth.error;
  const { jobId } = await context.params;
  let job = await getGenerationJob({ participantId: auth.participantId, jobId });
  if (!job) return NextResponse.json({ error: "Job was not found." }, { status: 404 });
  if (job.status === "queued" || job.status === "submitted" || job.status === "processing") {
    job = await processGenerationJob(job.job_id, auth.participantId);
  }
  return NextResponse.json({ ...job, creates_scene: false, creates_canonical: false });
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await participant();
  if ("error" in auth) return auth.error;
  const { jobId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  const job =
    action === "cancel"
      ? await cancelGenerationJob({ participantId: auth.participantId, jobId })
      : action === "retry"
        ? await retryGenerationJob({ participantId: auth.participantId, jobId })
        : await getGenerationJob({ participantId: auth.participantId, jobId });
  if (!job) return NextResponse.json({ error: "Job was not found." }, { status: 404 });
  return NextResponse.json({ ...job, creates_scene: false, creates_canonical: false });
}
