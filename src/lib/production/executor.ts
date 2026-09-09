/**
 * Replaceable creative-executor contract for experimental production proofs.
 *
 * Mighty Verse does not own generation. This module is not the permanent AI
 * provider. Mux remains the video ingest/delivery infrastructure.
 *
 * Stage 4.6 uses a local ffmpeg proof executor only when explicitly requested.
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SceneProductionBrief } from "./plan";
import { productionPlanId } from "./adapter";

const execFileAsync = promisify(execFile);

export const FFMPEG_PROOF_EXECUTOR = "ffmpeg-proof";
export const POWERHOUSE_SCENE_MASTER_ID = "4790c7cf-bb19-4a01-a243-e5c3eb680555";

export { productionPlanId, isFfmpegProofExecutor } from "./adapter";

export type CreativeExecutorResult =
  | {
      ok: true;
      executor: typeof FFMPEG_PROOF_EXECUTOR;
      job_id: string;
      file_path: string;
      mime: "video/mp4";
      duration_ms: number;
      creates_canonical: false;
    }
  | {
      ok: false;
      code: "executor_failed";
      message: string;
    };

export async function runFfmpegProofExecutor(input: {
  universe_id: string;
  brief: SceneProductionBrief;
}): Promise<CreativeExecutorResult> {
  const dir = await mkdtemp(join(tmpdir(), "mv-production-proof-"));
  const filePath = join(dir, "powerhouse-proof.mp4");
  const jobId = `ffmpeg-proof:${input.universe_id}:${input.brief.scene_master_id}:${Date.now()}`;
  const title = (input.brief.title ?? "Powerhouse").replace(/'/g, "");
  const draw = `drawtext=text='${title} production proof':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2`;

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "color=c=0x1a0a08:s=640x360:d=3:r=24",
      "-f", "lavfi", "-i", "sine=frequency=220:duration=3",
      "-vf", draw,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-shortest",
      filePath,
    ], { timeout: 30_000 });
  } catch {
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "color=c=0x1a0a08:s=640x360:d=3:r=24",
      "-f", "lavfi", "-i", "sine=frequency=220:duration=3",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-shortest",
      filePath,
    ], { timeout: 30_000 });
  }

  await writeFile(join(dir, "job.json"), JSON.stringify({
    executor: FFMPEG_PROOF_EXECUTOR,
    job_id: jobId,
    universe_id: input.universe_id,
    scene_master_id: input.brief.scene_master_id,
    plan_id: productionPlanId(input.universe_id, input.brief.scene_master_id),
  }));

  return {
    ok: true,
    executor: FFMPEG_PROOF_EXECUTOR,
    job_id: jobId,
    file_path: filePath,
    mime: "video/mp4",
    duration_ms: 3000,
    creates_canonical: false,
  };
}
