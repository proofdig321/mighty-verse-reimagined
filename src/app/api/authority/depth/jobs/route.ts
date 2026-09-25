import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getDepthJob, listDepthJobsForAsset } from "@/lib/depth/jobs";

/**
 * GET /api/authority/depth/jobs?job_id=<id>
 * GET /api/authority/depth/jobs?source_asset_id=<id>
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");
  const sourceAssetId = searchParams.get("source_asset_id");

  if (jobId) {
    const job = await getDepthJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    return NextResponse.json({ job, creates_canonical: false });
  }

  if (sourceAssetId) {
    const jobs = await listDepthJobsForAsset(
      sourceAssetId,
      searchParams.get("page"),
      searchParams.get("page_size"),
    );
    return NextResponse.json({ ...jobs, creates_canonical: false });
  }

  return NextResponse.json({ error: "job_id or source_asset_id is required." }, { status: 400 });
}
