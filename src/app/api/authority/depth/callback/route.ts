/**
 * POST /api/authority/depth/callback
 *
 * Receives the completed depth generation result from the Modal GPU worker.
 * The worker calls this endpoint after VDA inference, MVDP encoding, and
 * Supabase Storage upload are complete.
 *
 * AUTHENTICATION:
 *   The worker signs the request body with HMAC-SHA256 using MODAL_WEBHOOK_SECRET.
 *   This route verifies the signature before accepting any result.
 *   An unauthenticated request cannot mark a job complete or create depth assets.
 *
 * SUCCESS BODY (from worker):
 *   {
 *     job_id: string,
 *     status: "completed",
 *     result: DepthJobResult,
 *     signature: string  // HMAC-SHA256 hex of the JSON body (excluding signature field)
 *   }
 *
 * FAILURE BODY (from worker):
 *   {
 *     job_id: string,
 *     status: "failed",
 *     error: { message: string, stage?: string },
 *     retryable: boolean,
 *     signature: string
 *   }
 *
 * SENTINEL BOUNDARY: This route does not interact with Sentinel.
 * CANONICAL BOUNDARY: This route does not create Scenes, projections, or bindings.
 */

import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getDepthJob, finalizeDepthJob, failDepthJob } from "@/lib/depth/jobs";
import type { DepthJobResult } from "@/lib/depth/jobs";

function modalWebhookSecret(): string | null {
  return process.env.MODAL_WEBHOOK_SECRET?.trim() || null;
}

/**
 * Verify the HMAC-SHA256 signature on the callback body.
 * The worker signs the canonical JSON (body without the signature field).
 */
function verifyCallbackSignature(
  body: Record<string, unknown>,
  receivedSig: string,
  secret: string,
): boolean {
  // Reconstruct the signed payload: body without the signature field, sorted keys
  const { signature: _sig, ...payload } = body;
  const canonical = JSON.stringify(
    Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)))
  );
  const expected = createHmac("sha256", secret).update(canonical).digest("hex");
  // Constant-time comparison
  if (expected.length !== receivedSig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ receivedSig.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: Request) {
  const secret = modalWebhookSecret();
  if (!secret) {
    return NextResponse.json({ error: "Callback endpoint not configured." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const signature = typeof body.signature === "string" ? body.signature : "";
  if (!signature || !verifyCallbackSignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const jobId = typeof body.job_id === "string" ? body.job_id.trim() : "";
  if (!jobId) {
    return NextResponse.json({ error: "job_id is required." }, { status: 400 });
  }

  // Verify the job exists and is in a state that accepts callbacks
  const job = await getDepthJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  if (job.status === "completed") {
    // Idempotent: already completed, accept gracefully
    return NextResponse.json({ ok: true, job_id: jobId, status: "completed" });
  }
  if (job.status !== "processing") {
    return NextResponse.json(
      { error: `Job is in unexpected state: ${job.status}` },
      { status: 409 },
    );
  }

  const status = typeof body.status === "string" ? body.status : "";

  if (status === "completed") {
    const result = body.result as DepthJobResult | null;
    if (!result?.depth_asset_id || !result?.association_id) {
      return NextResponse.json({ error: "Callback missing required result fields." }, { status: 400 });
    }
    const finalized = await finalizeDepthJob({ jobId, result });
    return NextResponse.json({ ok: true, job_id: jobId, status: finalized.status });
  }

  if (status === "failed") {
    const error = body.error as { message?: string; stage?: string } | null;
    const retryable = body.retryable === true;
    await failDepthJob({
      jobId,
      message: error?.message ?? "Worker reported failure.",
      stage: error?.stage,
      retryable,
    });
    return NextResponse.json({ ok: true, job_id: jobId, status: "failed" });
  }

  return NextResponse.json({ error: `Unknown callback status: ${status}` }, { status: 400 });
}
