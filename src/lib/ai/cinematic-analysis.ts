/**
 * Gemini sampled-frame cinematic understanding.
 * Observational only. Does not author transformations or create Scenes.
 */

import { generateCinematicFromParts, generateGeminiText } from "./gemini";
import { geminiApiKey } from "./provider-key";
import {
  attachStillUrls,
  composeFallbackCinematic,
  parseCinematicAnalysis,
  sampleTimesMs,
  type CinematicAnalysis,
  type FrameCue,
} from "../media/cinematic-evidence";
import { muxThumbnailUrl } from "../media/thumbnail";

const CINEMATIC_SYSTEM = `You are Sentinel, an observational evidence layer inside Mighty Verse.
Analyse timed video frames as a storyboard/shot breakdown.
Describe only what is visible or reasonably inferred from the frames and timestamps.
Never invent narrative facts, character identities, or artistic meaning.
Never recommend transformations, replacements, or what the scene should become.
If camera movement cannot be determined, use "unknown".
If a subject cannot be identified, describe appearance only.
Return JSON only.`;

function cinematicSchemaPrompt(durationMs: number): string {
  return `The source duration is ${durationMs} ms. Frames are given in chronological order with timestamps.
Return JSON with kind "sentinel-cinematic", overview, and shots[]. Each shot needs sequence, start_ms, end_ms, framing, composition, camera, camera_explanation, subjects[], motion, action, environment, lighting, transition, narrative, what_happens, confidence.
framing: extreme wide | wide | medium | medium close-up | close-up | extreme close-up | other | unknown
camera: static | pan | tilt | push-in | pull-out | tracking | handheld | crane/elevated | orbit | zoom | rack focus | unknown
transition: cut | dissolve | fade | transition | continuous shot | unknown
confidence: high | medium | low
Do not create Scenes.`;
}

async function fetchFrameJpeg(playbackId: string, timeSec: number): Promise<{ mime: string; data: string } | null> {
  try {
    const response = await fetch(muxThumbnailUrl(playbackId, timeSec, 480));
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < 4000) return null;
    return { mime: "image/jpeg", data: buffer.toString("base64") };
  } catch {
    return null;
  }
}

function asGeminiAnalysis(parsed: CinematicAnalysis, input: { playbackId: string; assetId: string | null; durationMs: number | null }): CinematicAnalysis {
  return attachStillUrls({
    ...parsed,
    analysis_mode: "gemini-sampled-frames",
    shots: parsed.shots.map((shot) => ({ ...shot, analysis_mode: "gemini-sampled-frames" })),
    asset_id: input.assetId,
    playback_id: input.playbackId,
    duration_ms: input.durationMs,
    provider_limitation: "Gemini described sampled Mux frames. This is not a full video-file ingest.",
  }, input.playbackId);
}

export async function analyseSourceCinematically(input: {
  playbackId: string;
  assetId: string | null;
  durationMs: number | null;
  cues: FrameCue[];
}): Promise<{ analysis: CinematicAnalysis; provider: "gemini" | "fallback" }> {
  const duration = input.durationMs && input.durationMs > 0 ? input.durationMs : 60_000;
  const configured = Boolean(geminiApiKey());
  const fallback = attachStillUrls(
    composeFallbackCinematic({
      playbackId: input.playbackId,
      assetId: input.assetId,
      durationMs: input.durationMs,
      cues: input.cues,
      limitation: configured
        ? "Gemini sampled-frame understanding was not applied or did not return usable JSON."
        : "Google Gemini API is not configured. Fallback uses sampled Mux frames and change scores.",
    }),
    input.playbackId,
  );

  if (!configured) return { analysis: fallback, provider: "fallback" };

  const times = sampleTimesMs(duration, input.cues, 10);
  const frames: { time_ms: number; mime: string; data: string }[] = [];
  for (const time of times) {
    const jpeg = await fetchFrameJpeg(input.playbackId, time / 1000);
    if (jpeg) frames.push({ time_ms: time, ...jpeg });
  }
  if (frames.length < 2) {
    return {
      analysis: {
        ...fallback,
        provider_limitation: "Mux stills could not supply enough frames for Gemini vision.",
      },
      provider: "fallback",
    };
  }

  const result = await generateCinematicFromParts({
    system: CINEMATIC_SYSTEM,
    prompt: [
      cinematicSchemaPrompt(duration),
      "Timed frames:",
      ...frames.map((frame, index) => `Frame ${index + 1} at ${frame.time_ms} ms.`),
    ].join("\n"),
    images: frames.map((frame) => ({ mimeType: frame.mime, data: frame.data })),
  });
  if (result.ok) {
    const parsed = parseCinematicAnalysis(result.json);
    if (parsed?.shots.length) return { analysis: asGeminiAnalysis(parsed, input), provider: "gemini" };
  }

  const text = await generateGeminiText({
    system: CINEMATIC_SYSTEM,
    prompt: `${cinematicSchemaPrompt(duration)}\nFrame times: ${frames.map((frame) => frame.time_ms).join(", ")}`,
  });
  if (text.ok) {
    const fromText = parseCinematicAnalysis(safeJson(text.text));
    if (fromText?.shots.length) return { analysis: asGeminiAnalysis(fromText, input), provider: "gemini" };
  }

  return {
    analysis: {
      ...fallback,
      provider_limitation: result.ok ? "Gemini returned cinematic JSON that could not be validated." : result.message,
    },
    provider: "fallback",
  };
}

function safeJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}
