/**
 * Asynchronous storyboard generation jobs.
 * Gemini/Veo produce media. Mux delivers playable video. ffmpeg derives GIF/reel.
 * Jobs never create canonical Scenes.
 */

import { mkdtemp, writeFile, unlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getServiceClient } from "../authority/validate";
import { aiModelConfig } from "../ai/config";
import type { ProviderFailure } from "../ai/errors";
import { generateGeminiImageBytes, pollVeoOperation, submitVeoGeneration, type VeoImageRef } from "../ai/gemini";
import {
  canRetryJob,
  generationIdempotencyKey,
  jobProgressPercent,
  transitionJob,
  type GenerationJobKind,
  type GenerationJobStatus,
} from "../ai/jobs";
import { composeMotionPrompt, composeMotionPromptFromContext, composeStillPrompt, composeStillPromptFromContext, type MotionIntent, type PanelPromptInput } from "../ai/prompt-composer";
import { assembleCreativeContext } from "./creative-context";
import { muxAdapter } from "../media/providers/mux/adapter";
import { persistGeneratedImageArtifact, persistStoryboardArtifact } from "./persist";
import { storeCreativeBytes } from "./storage";
import { loadStoryboardWorkById, updateStoryboardPanel } from "./work";
import type { StoryboardPanelRecord, StoryboardWorkRecord } from "./document";

const execFileAsync = promisify(execFile);

export type GenerationJobRecord = {
  job_id: string;
  participant_id: string;
  work_id: string | null;
  panel_id: string | null;
  provider: string;
  model: string | null;
  operation_id: string | null;
  kind: GenerationJobKind;
  status: GenerationJobStatus;
  progress: number | null;
  request: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: { code?: string; message: string } | null;
  retryable: boolean;
  created_at: string;
  updated_at: string;
  creates_scene: false;
};

type ServiceClient = ReturnType<typeof getServiceClient>;

function mapJob(row: Record<string, unknown>): GenerationJobRecord {
  return {
    job_id: String(row.job_id),
    participant_id: String(row.participant_id),
    work_id: typeof row.work_id === "string" ? row.work_id : null,
    panel_id: typeof row.panel_id === "string" ? row.panel_id : null,
    provider: String(row.provider ?? "gemini"),
    model: typeof row.model === "string" ? row.model : null,
    operation_id: typeof row.operation_id === "string" ? row.operation_id : null,
    kind: row.kind as GenerationJobKind,
    status: row.status as GenerationJobStatus,
    progress: jobProgressPercent(row.status as GenerationJobStatus, typeof row.progress === "number" ? row.progress : null),
    request: (row.request as Record<string, unknown>) ?? {},
    result: (row.result as Record<string, unknown>) ?? null,
    error: (row.error as { code?: string; message: string } | null) ?? null,
    retryable: row.retryable === true,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    creates_scene: false,
  };
}

function failFromProvider(failure: ProviderFailure): { status: GenerationJobStatus; error: { code: string; message: string }; retryable: boolean } {
  const status: GenerationJobStatus =
    failure.status === "needs_configuration"
      ? "needs_configuration"
      : failure.status === "blocked"
        ? "blocked"
        : failure.status === "unavailable"
          ? "unavailable"
          : "failed";
  return {
    status,
    error: { code: failure.code, message: failure.message },
    retryable: failure.retryable,
  };
}

export async function listGenerationJobs(input: {
  participantId: string;
  workId: string;
}): Promise<GenerationJobRecord[]> {
  const db = getServiceClient();
  const { data } = await db
    .from("generation_job")
    .select("*")
    .eq("participant_id", input.participantId)
    .eq("work_id", input.workId)
    .order("created_at", { ascending: false })
    .limit(40);
  return (data ?? []).map((row) => mapJob(row as Record<string, unknown>));
}

export async function getGenerationJob(input: {
  participantId: string;
  jobId: string;
}): Promise<GenerationJobRecord | null> {
  const db = getServiceClient();
  const { data } = await db
    .from("generation_job")
    .select("*")
    .eq("job_id", input.jobId)
    .eq("participant_id", input.participantId)
    .maybeSingle();
  return data ? mapJob(data as Record<string, unknown>) : null;
}

async function writeJob(db: ServiceClient, jobId: string, patch: Record<string, unknown>) {
  await db
    .from("generation_job")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("job_id", jobId);
}

export async function createGenerationJob(input: {
  participantId: string;
  workId: string;
  panelId?: string | null;
  kind: GenerationJobKind;
  request: Record<string, unknown>;
  prompt: string;
}): Promise<GenerationJobRecord> {
  const db = getServiceClient();
  const idempotency = generationIdempotencyKey({
    participantId: input.participantId,
    kind: input.kind,
    panelId: input.panelId,
    prompt: input.prompt,
    mode: typeof input.request.mode === "string" ? input.request.mode : null,
  });
  const { data: existing } = await db
    .from("generation_job")
    .select("*")
    .eq("participant_id", input.participantId)
    .eq("idempotency_key", idempotency)
    .maybeSingle();
  if (existing) {
    const job = mapJob(existing as Record<string, unknown>);
    if (job.status === "queued" || job.status === "submitted" || job.status === "processing" || job.status === "completed") {
      return job;
    }
  }
  const { data, error } = await db
    .from("generation_job")
    .insert({
      participant_id: input.participantId,
      work_id: input.workId,
      panel_id: input.panelId ?? null,
      provider: "gemini",
      model: input.kind === "still" ? aiModelConfig().imageModel : input.kind === "gif" || input.kind === "reel" ? "ffmpeg" : aiModelConfig().videoModel,
      kind: input.kind,
      status: "queued",
      progress: 0,
      request: input.request,
      idempotency_key: existing ? `${idempotency}:${Date.now()}` : idempotency,
      retryable: false,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to queue generation.");
  return mapJob(data as Record<string, unknown>);
}

async function fetchImageRef(url: string): Promise<VeoImageRef> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read reference image (${response.status}).`);
  const mime = response.headers.get("content-type")?.split(";")[0] || "image/png";
  return { mime, bytes: Buffer.from(await response.arrayBuffer()) };
}

async function persistStillAsset(input: {
  participantId: string;
  universeId: string | null;
  panel: StoryboardPanelRecord;
  bytes: Buffer;
  mime: string;
  prompt: string;
  model: string;
}) {
  const path = `${input.participantId}/${input.panel.work_id}/${input.panel.panel_id}/${Date.now()}.png`;
  const stored = await storeCreativeBytes({ path, bytes: input.bytes, mime: input.mime });
  const db = getServiceClient();
  const { data: asset, error } = await db
    .from("media_asset")
    .insert({
      asset_type: "preview",
      storage_ref: stored.storage_path,
      integrity_hash: `storyboard-still:${input.panel.panel_id}:${Date.now()}`,
      format: input.mime,
      media_class: "image",
      provider: "gemini",
      provider_asset_id: input.model,
    })
    .select("asset_id")
    .single();
  if (error || !asset) throw new Error(error?.message ?? "Failed to persist still artifact.");
  await persistGeneratedImageArtifact({
    svc: db,
    universeId: input.universeId,
    participantId: input.participantId,
    outputType: "still",
    panelId: input.panel.panel_id,
    title: input.panel.title,
    description: input.prompt,
    assetId: asset.asset_id,
    stillUrl: stored.signed_url,
    source: "ai",
  });
  const stills = [
    ...(input.panel.generation_metadata?.stills ?? []),
    {
      asset_id: asset.asset_id,
      still_url: stored.signed_url,
      status: "completed" as const,
      created_at: new Date().toISOString(),
      kind: "still" as const,
    },
  ];
  await updateStoryboardPanel({
    participantId: input.participantId,
    panelId: input.panel.panel_id,
    patch: {
      active_still_asset_id: asset.asset_id,
      status: "ready",
      generation_metadata: { ...input.panel.generation_metadata, stills },
    },
  });
  return { asset_id: asset.asset_id, still_url: stored.signed_url, storage_path: stored.storage_path };
}

async function probeHasAudio(filePath: string): Promise<boolean | null> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", filePath],
      { timeout: 15_000 },
    );
    return Boolean(String(stdout).trim());
  } catch {
    return null;
  }
}

async function persistMotionFile(input: {
  participantId: string;
  universeId: string | null;
  panel: StoryboardPanelRecord | null;
  filePath: string;
  mime: string;
  outputType: "animation" | "clip" | "gif" | "reel";
  title: string;
  prompt: string;
  providerVideoUri?: string | null;
  hasAudio?: boolean | null;
}) {
  const hasAudio = input.hasAudio ?? (await probeHasAudio(input.filePath));
  const ingested = await muxAdapter.ingestLocalFile({
    filePath: input.filePath,
    passthrough: `storyboard:${input.universeId || "standalone"}:${input.outputType}`,
    corsOrigin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    contentType: input.mime,
  });
  await unlink(input.filePath).catch(() => undefined);
  const persisted = await persistStoryboardArtifact({
    svc: getServiceClient(),
    universeId: input.universeId,
    participantId: input.participantId,
    outputType: input.outputType,
    panelId: input.panel?.panel_id ?? null,
    title: input.title,
    description: input.prompt,
    source: "ai",
    muxAssetId: ingested.providerAssetId,
    playbackId: ingested.playbackId,
    durationMs: ingested.durationMs,
    mediaClass: ingested.mediaClass,
    format: ingested.format,
    resolution: ingested.resolution,
  });
  if (input.panel) {
    const motionHistory = [
      ...(input.panel.generation_metadata?.motion ?? []),
      {
        asset_id: persisted.asset_id,
        still_url: persisted.still_url,
        playback_id: ingested.playbackId,
        endpoint: persisted.endpoint_ref,
        status: "completed" as const,
        created_at: new Date().toISOString(),
        kind: "motion" as const,
      },
    ];
    await updateStoryboardPanel({
      participantId: input.participantId,
      panelId: input.panel.panel_id,
      patch: {
        active_motion_asset_id: persisted.asset_id,
        status: "ready",
        generation_metadata: { ...input.panel.generation_metadata, motion: motionHistory },
      },
    });
  }
  return {
    asset_id: persisted.asset_id,
    playback_id: ingested.playbackId,
    endpoint_ref: persisted.endpoint_ref,
    still_url: persisted.still_url,
    mux_asset_id: ingested.providerAssetId,
    provider_video_uri: input.providerVideoUri ?? null,
    has_audio: hasAudio,
  };
}

async function deriveGif(sourceUrl: string, fromVideo: boolean) {
  const dir = await mkdtemp(join(tmpdir(), "mv-gif-"));
  const source = join(dir, fromVideo ? "source.mp4" : "source.bin");
  const filePath = join(dir, "panel.gif");
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error("Could not read source media for GIF.");
  await writeFile(source, Buffer.from(await response.arrayBuffer()));
  const vf = fromVideo
    ? "fps=8,scale=480:-2:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse"
    : "zoompan=z='min(zoom+0.002,1.2)':d=50:s=640x360,fps=12,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse";
  await execFileAsync("ffmpeg", [
    "-y",
    ...(fromVideo ? ["-t", "3"] : ["-loop", "1", "-t", "2"]),
    "-i", source,
    "-vf", vf,
    filePath,
  ], { timeout: 45_000 });
  return { filePath, mime: "image/gif" as const };
}

async function deriveReel(urls: string[], fromVideo: boolean) {
  const dir = await mkdtemp(join(tmpdir(), "mv-reel-"));
  const sources: string[] = [];
  for (const [index, url] of urls.entries()) {
    const filePath = join(dir, fromVideo ? `clip-${index}.mp4` : `frame-${index}.jpg`);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Could not read reel source.");
    await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
    sources.push(filePath);
  }
  const filePath = join(dir, "reel.mp4");
  if (fromVideo) {
    const listPath = join(dir, "concat.txt");
    await writeFile(listPath, sources.map((source) => `file '${source}'`).join("\n") + "\n");
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-an",
      filePath,
    ], { timeout: 120_000 });
  } else {
    const listPath = join(dir, "concat.txt");
    await writeFile(listPath, sources.map((source) => `file '${source}'\nduration 1.2`).join("\n") + `\nfile '${sources[sources.length - 1]}'\n`);
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
      "-r", "24",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-t", String(Math.min(8, sources.length * 1.2)),
      filePath,
    ], { timeout: 120_000 });
  }
  return { filePath, mime: "video/mp4" as const };
}

function panelPromptInput(
  work: StoryboardWorkRecord | null,
  panel: StoryboardPanelRecord,
  request: Record<string, unknown>,
): PanelPromptInput {
  const observation = panel.generation_metadata?.sentinel_observation ?? null;
  const frameLabels = (work?.frames ?? [])
    .filter((frame) => !frame.panel_id || frame.panel_id === panel.panel_id)
    .map((frame) => `${frame.source_title} at ${Math.round(frame.timestamp_ms)}ms`);
  const panelLabels = panel.references.map((reference) => reference.label);
  const instruction =
    typeof request.instruction === "string" && request.instruction.trim()
      ? request.instruction
      : panel.generation_metadata?.transformation_instruction ?? null;
  return {
    storyTitle: work?.title,
    storyBody: work?.body,
    panel,
    selectedReferences: [...new Set([...panelLabels, ...frameLabels].filter(Boolean))],
    instruction,
    sentinelObservation: observation,
    sourceLabel: work?.sources?.[0]?.title ?? null,
  };
}

export async function processGenerationJob(jobId: string, participantId: string): Promise<GenerationJobRecord> {
  const db = getServiceClient();
  const current = await getGenerationJob({ participantId, jobId });
  if (!current) throw new Error("Generation job was not found.");
  if (current.status === "completed" || current.status === "cancelled") return current;

  const work = current.work_id
    ? await loadStoryboardWorkById({ workId: current.work_id, participantId })
    : null;
  const panel = work?.panels.find((item) => item.panel_id === current.panel_id) ?? null;
  const request = current.request;
  const motion: MotionIntent = {
    style: typeof request.style === "string" ? request.style : null,
    animationStyle: typeof request.animation_style === "string" ? request.animation_style : null,
    motionDirection: typeof request.motion_direction === "string" ? request.motion_direction : null,
    cameraMovement: typeof request.camera_movement === "string" ? request.camera_movement : null,
    durationSeconds: typeof request.duration_seconds === "number" ? request.duration_seconds : 8,
    aspectRatio: request.aspect_ratio === "9:16" ? "9:16" : "16:9",
    audioIntention: typeof request.audio_intention === "string" ? request.audio_intention : null,
  };

  try {
    if (current.kind === "still") {
      if (!panel) throw new Error("A panel is required to generate a still.");
      await writeJob(db, jobId, { status: transitionJob(current.status, { type: "submit" }), progress: 10 });
      const instruction = typeof request.instruction === "string" && request.instruction.trim() ? request.instruction : null;
      const ctxResult = work ? await assembleCreativeContext(work, panel, instruction) : null;
      const prompt = ctxResult?.ok
        ? composeStillPromptFromContext(ctxResult.context)
        : composeStillPrompt(panelPromptInput(work, panel, request));
      const image = await generateGeminiImageBytes({ prompt });
      if (!image.ok) {
        const mapped = failFromProvider(image);
        await writeJob(db, jobId, mapped);
        return (await getGenerationJob({ participantId, jobId }))!;
      }
      const persisted = await persistStillAsset({
        participantId,
        universeId: work?.universe_id ?? null,
        panel,
        bytes: image.bytes,
        mime: image.mime,
        prompt,
        model: image.model,
      });
      await writeJob(db, jobId, {
        status: "completed",
        progress: 100,
        model: image.model,
        result: { ...persisted, prompt, creates_canonical: false },
        completed_at: new Date().toISOString(),
      });
      return (await getGenerationJob({ participantId, jobId }))!;
    }

    if (current.kind === "gif") {
      const playbackId = typeof request.playback_id === "string" ? request.playback_id : null;
      const still = (typeof request.still_url === "string" && request.still_url) || panel?.still_url;
      const source = playbackId ? `https://stream.mux.com/${playbackId}/low.mp4` : still;
      if (!source) throw new Error("GIF derivation needs generated motion or a still.");
      const derived = await deriveGif(source, Boolean(playbackId));
      const bytes = await readFile(/* turbopackIgnore: true */ derived.filePath);
      await unlink(derived.filePath).catch(() => undefined);
      const stored = await storeCreativeBytes({
        path: `${participantId}/${work?.work_id ?? "work"}/${panel?.panel_id ?? "reel"}/${Date.now()}.gif`,
        bytes,
        mime: "image/gif",
      });
      const dbInner = getServiceClient();
      const { data: asset, error } = await dbInner
        .from("media_asset")
        .insert({
          asset_type: "preview",
          storage_ref: stored.storage_path,
          integrity_hash: `storyboard-gif:${panel?.panel_id ?? work?.work_id}:${Date.now()}`,
          format: "image/gif",
          media_class: "image",
          provider: "ffmpeg",
        })
        .select("asset_id")
        .single();
      if (error || !asset) throw new Error(error?.message ?? "Failed to persist GIF.");
      await persistGeneratedImageArtifact({
        svc: dbInner,
        universeId: work?.universe_id ?? null,
        participantId,
        outputType: "gif",
        panelId: panel?.panel_id ?? null,
        title: panel?.title ?? "GIF",
        description: "Derived GIF",
        assetId: asset.asset_id,
        stillUrl: stored.signed_url,
        source: "ai",
      });
      await writeJob(db, jobId, {
        status: "completed",
        progress: 100,
        result: { asset_id: asset.asset_id, still_url: stored.signed_url, creates_canonical: false },
        completed_at: new Date().toISOString(),
      });
      return (await getGenerationJob({ participantId, jobId }))!;
    }

    if (current.kind === "reel") {
      const playbackIds = Array.isArray(request.playback_ids) ? request.playback_ids.filter((value) => typeof value === "string") : [];
      const urls = Array.isArray(request.still_urls) ? request.still_urls.filter((value) => typeof value === "string") : [];
      const motionUrls = playbackIds.map((id) => `https://stream.mux.com/${id}/low.mp4`);
      const frames = motionUrls.length ? motionUrls : urls.length ? urls : work?.panels.map((item) => item.still_url).filter(Boolean) ?? [];
      if (!frames.length) throw new Error("Assemble Reel needs generated motion or panel stills.");
      const derived = await deriveReel(frames as string[], motionUrls.length > 0);
      const persisted = await persistMotionFile({
        participantId,
        universeId: work?.universe_id ?? null,
        panel,
        filePath: derived.filePath,
        mime: derived.mime,
        outputType: "reel",
        title: work?.title ?? "Reel",
        prompt: "Assembled reel",
      });
      await writeJob(db, jobId, { status: "completed", progress: 100, result: persisted, completed_at: new Date().toISOString() });
      return (await getGenerationJob({ participantId, jobId }))!;
    }

    const instruction = typeof request.instruction === "string" && request.instruction.trim() ? request.instruction : null;
    const ctxResult = work && panel ? await assembleCreativeContext(work, panel, instruction) : null;
    const prompt = panel
      ? ctxResult?.ok
        ? composeMotionPromptFromContext(ctxResult.context, motion)
        : composeMotionPrompt(panelPromptInput(work, panel, request), motion)
      : String(request.prompt ?? "");

    if (current.operation_id && (current.status === "submitted" || current.status === "processing")) {
      return finishVeoJob(current, participantId, work, panel, prompt);
    }

    await writeJob(db, jobId, { status: "submitted", progress: 10 });
    const firstUrl = typeof request.first_frame_url === "string" ? request.first_frame_url : panel?.still_url;
    const lastUrl = typeof request.last_frame_url === "string" ? request.last_frame_url : null;
    const requestedReferenceUrls = Array.isArray(request.reference_urls)
      ? request.reference_urls.filter((value): value is string => typeof value === "string")
      : [];
    const frameUrls = (work?.frames ?? [])
      .filter((frame) => !panel || !frame.panel_id || frame.panel_id === panel.panel_id)
      .map((frame) => frame.still_url)
      .filter(Boolean);
    const referenceUrls = [...new Set([...requestedReferenceUrls, ...frameUrls])];
    const extensionUri = typeof request.extension_video_uri === "string" ? request.extension_video_uri : null;
    if (current.kind === "animate-still" && !firstUrl) {
      throw new Error("Animate still needs a generated panel still.");
    }
    if (current.kind === "first-last-frame" && (!firstUrl || !lastUrl)) {
      throw new Error("First / last frame needs both a first-frame still and a last-frame still.");
    }
    if (current.kind === "reference-motion" && !referenceUrls.length) {
      throw new Error("Reference motion needs attached character, environment, or style stills.");
    }
    if (current.kind === "extend" && !extensionUri) {
      throw new Error("Extend needs a generated Veo video to continue from. The original clip is not overwritten.");
    }
    const editUri = typeof request.edit_video_uri === "string" ? request.edit_video_uri : null;
    if (current.kind === "edit" && !editUri) {
      throw new Error("Edit needs a source video URI and a text directive describing the change.");
    }
    const submitted = await submitVeoGeneration({
      prompt,
      aspectRatio: motion.aspectRatio ?? "16:9",
      durationSeconds: motion.durationSeconds === 4 || motion.durationSeconds === 6 ? motion.durationSeconds : 8,
      generateAudio: request.generate_audio !== false,
      firstFrame: current.kind === "animate-still" || current.kind === "first-last-frame"
        ? firstUrl
          ? await fetchImageRef(firstUrl)
          : null
        : null,
      lastFrame: current.kind === "first-last-frame" && lastUrl ? await fetchImageRef(lastUrl) : null,
      referenceImages: current.kind === "reference-motion" && referenceUrls.length
        ? await Promise.all(referenceUrls.slice(0, 3).map((url) => fetchImageRef(url)))
        : [],
      extensionVideoUri: current.kind === "extend" ? extensionUri : null,
      editVideoUri: current.kind === "edit" ? editUri : null,
    });
    if (!submitted.ok) {
      const mapped = failFromProvider(submitted);
      await writeJob(db, jobId, mapped);
      return (await getGenerationJob({ participantId, jobId }))!;
    }
    await writeJob(db, jobId, {
      status: "processing",
      progress: 40,
      operation_id: submitted.operationName,
      model: submitted.model,
    });
    return finishVeoJob(
      { ...current, status: "processing", operation_id: submitted.operationName },
      participantId,
      work,
      panel,
      prompt,
    );
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Generation failed.";
    await writeJob(db, jobId, {
      status: "failed",
      retryable: true,
      error: { code: "unknown", message },
    });
    return (await getGenerationJob({ participantId, jobId }))!;
  }
}

async function finishVeoJob(
  current: GenerationJobRecord,
  participantId: string,
  work: StoryboardWorkRecord | null,
  panel: StoryboardPanelRecord | null,
  prompt: string,
): Promise<GenerationJobRecord> {
  if (!current.operation_id) return current;
  const polled = await pollVeoOperation(current.operation_id);
  if (!polled.ok) {
    const mapped = failFromProvider(polled);
    await writeJob(getServiceClient(), current.job_id, mapped);
    return (await getGenerationJob({ participantId, jobId: current.job_id }))!;
  }
  if (!polled.done) {
    await writeJob(getServiceClient(), current.job_id, { status: "processing", progress: 55 });
    return (await getGenerationJob({ participantId, jobId: current.job_id }))!;
  }
  const dir = await mkdtemp(join(tmpdir(), "mv-veo-"));
  const filePath = join(dir, "motion.mp4");
  await writeFile(filePath, polled.bytes);
  const persisted = await persistMotionFile({
    participantId,
    universeId: work?.universe_id ?? null,
    panel,
    filePath,
    mime: polled.mime,
    outputType: current.kind === "animation" ? "animation" : "clip",
    title: panel?.title ?? "Motion",
    prompt,
    providerVideoUri: polled.videoUri,
    hasAudio: polled.hasAudio,
  });
  await writeJob(getServiceClient(), current.job_id, {
    status: "completed",
    progress: 100,
    result: { ...persisted, prompt, has_audio: polled.hasAudio, creates_canonical: false },
    completed_at: new Date().toISOString(),
  });
  return (await getGenerationJob({ participantId, jobId: current.job_id }))!;
}

export async function cancelGenerationJob(input: { participantId: string; jobId: string }): Promise<GenerationJobRecord | null> {
  const job = await getGenerationJob(input);
  if (!job) return null;
  if (job.status === "completed") return job;
  await writeJob(getServiceClient(), job.job_id, {
    status: "cancelled",
    error: {
      code: "cancelled",
      message: "The local generation job was cancelled. The provider operation may still complete remotely.",
    },
  });
  return getGenerationJob(input);
}

export async function retryGenerationJob(input: { participantId: string; jobId: string }): Promise<GenerationJobRecord | null> {
  const job = await getGenerationJob(input);
  if (!job || !canRetryJob(job.status, job.retryable) && job.status !== "failed" && job.status !== "unavailable") {
    return job;
  }
  const next = await createGenerationJob({
    participantId: input.participantId,
    workId: job.work_id ?? "",
    panelId: job.panel_id,
    kind: job.kind,
    request: { ...job.request, retry_of: job.job_id },
    prompt: typeof job.request.prompt === "string" ? job.request.prompt : `${job.kind}:${job.panel_id}:${Date.now()}`,
  });
  return processGenerationJob(next.job_id, input.participantId);
}
