/**
 * Storyboard media generation.
 *
 * Text panels are local. Visual stills use Gemini when configured.
 * Motion outputs (clip / gif / reel / animation) transform existing stills
 * through ffmpeg and Mux ingest. Never reports Ready without an artifact.
 */

import { mkdtemp, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { muxAdapter } from "../media/providers/mux/adapter";
import { generateGeminiImage, serverAiCapability } from "../ai/provider";
import type { StoryboardOutputType } from "./artifact";

const execFileAsync = promisify(execFile);

export type StoryboardGenerateDecision =
  | {
      ok: true;
      output_type: StoryboardOutputType;
      status: "ready";
      file_path: string;
      mime: string;
      duration_ms: number | null;
      still_only: boolean;
      creates_canonical: false;
    }
  | {
      ok: false;
      status: "unavailable" | "failed";
      output_type: StoryboardOutputType;
      message: string;
    };

async function downloadToFile(url: string, filePath: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read source still (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, bytes);
}

async function ffmpeg(args: string[], timeoutMs = 45_000) {
  await execFileAsync("ffmpeg", args, { timeout: timeoutMs });
}

async function stillToClip(dir: string, stillUrl: string, filePath: string, seconds = 2) {
  const imagePath = join(dir, "panel-source.bin");
  await downloadToFile(stillUrl, imagePath);
  await ffmpeg([
    "-y",
    "-loop", "1",
    "-i", imagePath,
    "-f", "lavfi",
    "-i", "anullsrc=r=44100:cl=stereo",
    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
    "-t", String(seconds),
    "-c:v", "libx264",
    "-c:a", "aac",
    "-shortest",
    filePath,
  ], seconds >= 30 ? 120_000 : 45_000);
}

export async function generateStoryboardMedia(input: {
  output_type: StoryboardOutputType;
  prompt: string;
  still_url?: string | null;
  still_urls?: string[];
  cors_origin: string;
}): Promise<StoryboardGenerateDecision> {
  const type = input.output_type;
  const dir = await mkdtemp(join(tmpdir(), "mv-storyboard-"));

  if (type === "script") {
    return { ok: false, status: "unavailable", output_type: type, message: "Script generation is a text action, not a media action." };
  }

  if (type === "panel" || type === "still" || type === "variation") {
    if (input.still_url && type !== "variation") {
      const filePath = join(dir, "panel.mp4");
      try {
        await stillToClip(dir, input.still_url, filePath);
      } catch {
        return { ok: false, status: "failed", output_type: type, message: "Gallery still could not be turned into a storyboard panel." };
      }
      return {
        ok: true,
        output_type: type,
        status: "ready",
        file_path: filePath,
        mime: "video/mp4",
        duration_ms: 2000,
        still_only: false,
        creates_canonical: false,
      };
    }
    const image = await generateGeminiImage({
      prompt:
        type === "variation"
          ? `Create a variation of this storyboard still. ${input.prompt}`
          : `Cinematic storyboard still, African futurist music universe, no text overlay. ${input.prompt}`,
    });
    if (!image.ok) {
      return { ok: false, status: image.status, output_type: type, message: image.message };
    }
    const imagePath = join(dir, type === "variation" ? "variation.png" : "panel.png");
    await writeFile(imagePath, image.bytes);
    const filePath = join(dir, "panel.mp4");
    try {
      await ffmpeg([
        "-y",
        "-loop", "1",
        "-i", imagePath,
        "-f", "lavfi",
        "-i", "anullsrc=r=44100:cl=stereo",
        "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
        "-t", "2",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-shortest",
        filePath,
      ]);
    } catch {
      return { ok: false, status: "failed", output_type: type, message: "ffmpeg could not turn the generated still into playable media." };
    }
    return {
      ok: true,
      output_type: type,
      status: "ready",
      file_path: filePath,
      mime: "video/mp4",
      duration_ms: 2000,
      still_only: false,
      creates_canonical: false,
    };
  }

  const frames = (input.still_urls?.length ? input.still_urls : input.still_url ? [input.still_url] : []).filter(Boolean);
  if (!frames.length) {
    return {
      ok: false,
      status: "unavailable",
      output_type: type,
      message: "This output needs a still, Sentinel frame, or generated panel first.",
    };
  }

  try {
    const sources: string[] = [];
    for (const [index, url] of frames.entries()) {
      const filePath = join(dir, `frame-${index}.jpg`);
      await downloadToFile(url, filePath);
      sources.push(filePath);
    }

    if (type === "gif") {
      const filePath = join(dir, "panel-loop.mp4");
      await ffmpeg([
        "-y",
        "-loop", "1",
        "-t", "2",
        "-i", sources[0],
        "-vf", "zoompan=z='min(zoom+0.002,1.2)':d=50:s=640x360,format=yuv420p",
        "-r", "12",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-an",
        filePath,
      ]);
      return {
        ok: true,
        output_type: type,
        status: "ready",
        file_path: filePath,
        mime: "video/mp4",
        duration_ms: 2000,
        still_only: false,
        creates_canonical: false,
      };
    }

    const clipSeconds = type === "animation" ? 4 : type === "clip" ? 30 : 3;
    const filePath = join(dir, type === "reel" ? "reel.mp4" : "clip.mp4");
    if (type === "reel" && sources.length > 1) {
      const listPath = join(dir, "concat.txt");
      await writeFile(listPath, sources.map((source) => `file '${source}'\nduration 1.2`).join("\n") + `\nfile '${sources[sources.length - 1]}'\n`);
      await ffmpeg([
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
        "-r", "24",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-t", String(Math.min(8, sources.length * 1.2)),
        filePath,
      ]);
    } else {
      await ffmpeg([
        "-y",
        "-loop", "1",
        "-i", sources[0],
        "-f", "lavfi",
        "-i", "anullsrc=r=44100:cl=stereo",
        "-vf", type === "clip"
          ? "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p"
          : "zoompan=z='min(zoom+0.0012,1.12)':d=75:s=1280x720,format=yuv420p",
        "-t", String(clipSeconds),
        "-c:v", "libx264",
        "-c:a", "aac",
        "-shortest",
        filePath,
      ], type === "clip" ? 120_000 : 45_000);
    }

    return {
      ok: true,
      output_type: type,
      status: "ready",
      file_path: filePath,
      mime: "video/mp4",
      duration_ms: type === "reel" ? 1200 * Math.max(1, sources.length) : clipSeconds * 1000,
      still_only: false,
      creates_canonical: false,
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "ffmpeg could not produce this output.";
    return { ok: false, status: "failed", output_type: type, message };
  }
}

export async function ingestGeneratedMedia(input: {
  file_path: string;
  mime: string;
  passthrough: string;
  cors_origin: string;
}) {
  if (input.mime.startsWith("image/") && input.mime !== "image/gif") {
    return { ok: false as const, status: "unavailable" as const, message: "Still images are stored as artifacts without Mux ingest." };
  }
  const asset = await muxAdapter.ingestLocalFile({
    filePath: input.file_path,
    passthrough: input.passthrough,
    corsOrigin: input.cors_origin,
    contentType: input.mime,
  });
  await unlink(input.file_path).catch(() => undefined);
  return {
    ok: true as const,
    mux_asset_id: asset.providerAssetId,
    playback_id: asset.playbackId,
    duration_ms: asset.durationMs,
    media_class: asset.mediaClass,
    format: asset.format,
    resolution: asset.resolution,
  };
}

export function storyboardCapabilityStatus() {
  const ai = serverAiCapability();
  return {
    script: { status: "ready" as const, label: "Local story-body parser" },
    assist: {
      status: ai.text ? "ready" as const : "unavailable" as const,
      label: ai.text ? ai.label : "Chrome Prompt API in the browser, or Gemini API on the server",
    },
    panel: { status: ai.image ? "ready" as const : "unavailable" as const, label: ai.image ? "Gemini image" : "Gemini image generation is not configured" },
    clip: { status: "ready" as const, label: "ffmpeg + Mux 30-second clip from an existing still" },
    gif: { status: "ready" as const, label: "ffmpeg GIF from an existing still" },
    reel: { status: "ready" as const, label: "ffmpeg sequence + Mux" },
    animation: { status: "ready" as const, label: "ffmpeg motion + Mux" },
    creates_scene: false,
  };
}
