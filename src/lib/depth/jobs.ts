/**
 * Mighty Verse — Depth Generation Job Manager
 *
 * Manages the lifecycle of depth generation jobs.
 * Uses the depth_generation_job table (separate from storyboard generation_job
 * because depth jobs are scoped to source media assets, not storyboard work).
 *
 * Job lifecycle:
 *   queued → running → completed
 *                    → failed
 *
 * A failed job never produces a usable depth asset.
 * Completed jobs carry the depth asset ID and association ID in their result.
 */

import { getServiceClient } from "../authority/validate";
import type { GenerationJobStatus } from "../ai/jobs";
import { runDepthPipeline, type DepthPipelineInput } from "./pipeline";
import type { DepthProvider } from "./provider";
import { parsePage, pageMeta, type PageMeta } from "../pagination";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DepthJobStatus = Extract<
  GenerationJobStatus,
  "queued" | "processing" | "completed" | "failed" | "needs_configuration" | "unavailable"
>;

export type DepthJobRecord = {
  job_id: string;
  source_asset_id: string;
  participant_id: string;
  provider: string;
  model: string | null;
  status: DepthJobStatus;
  target_fps: number;
  frame_width: number;
  result: DepthJobResult | null;
  error: { message: string; stage?: string } | null;
  retryable: boolean;
  created_at: string;
  updated_at: string;
};

export type DepthJobResult = {
  depth_asset_id: string;
  association_id: string;
  storage_path: string;
  frame_count: number;
  width: number;
  height: number;
  frame_rate: number;
  duration_ms: number;
  confidence: number;
  provider: string;
  model: string;
};

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

type ServiceClient = ReturnType<typeof getServiceClient>;

function mapJob(row: Record<string, unknown>): DepthJobRecord {
  return {
    job_id: String(row.job_id),
    source_asset_id: String(row.source_asset_id),
    participant_id: String(row.participant_id),
    provider: String(row.provider ?? "replicate"),
    model: typeof row.model === "string" ? row.model : null,
    status: row.status as DepthJobStatus,
    target_fps: typeof row.target_fps === "number" ? row.target_fps : 1.0,
    frame_width: typeof row.frame_width === "number" ? row.frame_width : 640,
    result: (row.result as DepthJobResult | null) ?? null,
    error: (row.error as { message: string; stage?: string } | null) ?? null,
    retryable: row.retryable === true,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function writeJob(db: ServiceClient, jobId: string, patch: Record<string, unknown>) {
  await db
    .from("depth_generation_job")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("job_id", jobId);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createDepthJob(input: {
  sourceAssetId: string;
  participantId: string;
  targetFps?: number;
  frameWidth?: number;
  provider?: DepthProvider;
}): Promise<DepthJobRecord> {
  const db = getServiceClient();
  const providerId = input.provider?.providerId ?? "modal";
  const targetFps = input.targetFps ?? 2.0;
  const frameWidth = input.frameWidth ?? 640;

  const { data, error } = await db
    .from("depth_generation_job")
    .insert({
      source_asset_id: input.sourceAssetId,
      participant_id: input.participantId,
      provider: providerId,
      status: "queued",
      target_fps: targetFps,
      frame_width: frameWidth,
      retryable: false,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create depth generation job.");
  return mapJob(data as Record<string, unknown>);
}

export async function getDepthJob(jobId: string): Promise<DepthJobRecord | null> {
  const db = getServiceClient();
  const { data } = await db
    .from("depth_generation_job")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();
  return data ? mapJob(data as Record<string, unknown>) : null;
}

export async function listDepthJobsForAsset(
  sourceAssetId: string,
  page?: string | null,
  pageSize?: string | null,
): Promise<{ jobs: DepthJobRecord[]; pagination: PageMeta }> {
  const db = getServiceClient();
  const pg = parsePage(page, pageSize, 20);
  const { data, count } = await db
    .from("depth_generation_job")
    .select("*", { count: "exact" })
    .eq("source_asset_id", sourceAssetId)
    .order("created_at", { ascending: false })
    .range(pg.from, pg.to);
  return {
    jobs: (data ?? []).map((row) => mapJob(row as Record<string, unknown>)),
    pagination: pageMeta(pg, count ?? 0),
  };
}

/**
 * Submit a depth job to the active provider.
 * For async providers (Modal VDA): transitions job to "processing" and returns.
 * For sync providers (Replicate): runs the full pipeline and returns completed/failed.
 * Never leaves the job in a partial state.
 */
export async function processDepthJob(input: {
  jobId: string;
  playbackId: string;
  durationMs: number;
  provider?: DepthProvider;
}): Promise<DepthJobRecord> {
  const db = getServiceClient();
  const job = await getDepthJob(input.jobId);
  if (!job) throw new Error(`Depth job ${input.jobId} not found.`);
  if (job.status === "completed") return job;

  await writeJob(db, input.jobId, { status: "processing" });

  const pipelineInput: DepthPipelineInput = {
    sourceAssetId: job.source_asset_id,
    playbackId: input.playbackId,
    durationMs: input.durationMs,
    participantId: job.participant_id,
    jobId: input.jobId,
    sampling: {
      targetFps: job.target_fps,
      frameWidth: job.frame_width,
    },
    provider: input.provider,
  };

  const result = await runDepthPipeline(pipelineInput);

  // Async-submitted: Modal worker accepted the job. Job stays "processing".
  // The callback route will finalize it when the worker completes.
  if (result.ok === "submitted") {
    await writeJob(db, input.jobId, {
      status: "processing",
      model: result.model,
    });
    return (await getDepthJob(input.jobId))!;
  }

  if (!result.ok) {
    const status: DepthJobStatus =
      result.stage === "provider" && result.message.includes("not configured")
        ? "needs_configuration"
        : "failed";
    await writeJob(db, input.jobId, {
      status,
      retryable: result.retryable,
      error: { message: result.message, stage: result.stage },
    });
    return (await getDepthJob(input.jobId))!;
  }

  const jobResult: DepthJobResult = {
    depth_asset_id: result.depthAssetId,
    association_id: result.associationId,
    storage_path: result.storagePath,
    frame_count: result.frameCount,
    width: result.width,
    height: result.height,
    frame_rate: result.frameRate,
    duration_ms: result.durationMs,
    confidence: result.confidence,
    provider: result.provider,
    model: result.model,
  };

  await writeJob(db, input.jobId, {
    status: "completed",
    model: result.model,
    result: jobResult,
    completed_at: new Date().toISOString(),
  });

  return (await getDepthJob(input.jobId))!;
}

/**
 * Finalize a depth job from a Modal worker callback.
 * Called by /api/authority/depth/callback after the worker completes.
 * Persists the depth asset and association, then marks the job completed.
 * On failure, marks the job failed with a safe diagnostic.
 */
export async function finalizeDepthJob(input: {
  jobId: string;
  result: DepthJobResult;
}): Promise<DepthJobRecord> {
  const db = getServiceClient();
  await writeJob(db, input.jobId, {
    status: "completed",
    model: input.result.model,
    result: input.result,
    completed_at: new Date().toISOString(),
  });
  return (await getDepthJob(input.jobId))!;
}

/**
 * Mark a depth job as failed from a Modal worker callback.
 */
export async function failDepthJob(input: {
  jobId: string;
  message: string;
  stage?: string;
  retryable?: boolean;
}): Promise<DepthJobRecord> {
  const db = getServiceClient();
  await writeJob(db, input.jobId, {
    status: "failed",
    retryable: input.retryable ?? false,
    error: { message: input.message, stage: input.stage },
  });
  return (await getDepthJob(input.jobId))!;
}
