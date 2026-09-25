/**
 * Cinematic Sentinel evidence.
 * Observational only. Never creates Scenes or decides transformations.
 * Stored in inspection_session.parameters.cinematic — no schema migration.
 */

import { muxThumbnailUrl } from "./thumbnail";
import { formatMs } from "./timing";

export const CINEMATIC_KIND = "sentinel-cinematic";
export const CINEMATIC_ANALYSIS_VERSION = "cinematic-v1";

export const SHOT_FRAMINGS = [
  "extreme wide",
  "wide",
  "medium",
  "medium close-up",
  "close-up",
  "extreme close-up",
  "other",
  "unknown",
] as const;

export const CAMERA_MOTIONS = [
  "static",
  "pan",
  "tilt",
  "push-in",
  "pull-out",
  "tracking",
  "handheld",
  "crane/elevated",
  "orbit",
  "zoom",
  "rack focus",
  "unknown",
] as const;

export const TRANSITIONS = ["cut", "dissolve", "fade", "transition", "continuous shot", "unknown"] as const;

export type ShotFraming = (typeof SHOT_FRAMINGS)[number];
export type CameraMotion = (typeof CAMERA_MOTIONS)[number];
export type ShotTransition = (typeof TRANSITIONS)[number];
export type ObservationConfidence = "high" | "medium" | "low";
export type CinematicAnalysisMode = "gemini-sampled-frames" | "sampled-fallback";
export type EvidenceStatus = "observed" | "inferred" | "unknown";

export type CinematicSubject = {
  subject_id: string;
  description: string;
  position: string | null;
  pose: string | null;
  action: string | null;
  direction: string | null;
  interaction: string | null;
};

export type CinematicShot = {
  shot_id: string;
  sequence: number;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  time_ms: number;
  still_url: string | null;
  framing: ShotFraming;
  composition: string | null;
  camera: CameraMotion;
  camera_explanation: string | null;
  subjects: CinematicSubject[];
  motion: string;
  action: string;
  environment: string;
  lighting: string | null;
  transition: ShotTransition;
  narrative: string | null;
  what_happens: string;
  confidence: ObservationConfidence;
  analysis_mode: CinematicAnalysisMode;
  creates_scene: false;
};

export type CinematicAnalysis = {
  kind: typeof CINEMATIC_KIND;
  analysis_version: string;
  analysis_mode: CinematicAnalysisMode;
  provider_limitation: string | null;
  overview: string;
  playback_id: string | null;
  asset_id: string | null;
  duration_ms: number | null;
  shots: CinematicShot[];
  creates_scene: false;
  creates_canonical: false;
};

export type FrameCue = {
  time_ms: number;
  mean_luminance: number | null;
  change_score: number | null;
  is_boundary_candidate: boolean;
};

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function shotIdForTime(startMs: number): string {
  return `shot-${Math.max(0, Math.round(startMs))}`;
}

export function representativeTimeMs(startMs: number, endMs: number): number {
  const start = Math.max(0, startMs);
  const end = Math.max(start + 1, endMs);
  const mid = Math.round((start + end) / 2);
  if (mid <= 0 && end > 1000) return Math.min(1000, end - 1);
  return mid;
}

export function formatShotWindow(shot: Pick<CinematicShot, "start_ms" | "end_ms">): string {
  return `${formatMs(shot.start_ms)} – ${formatMs(shot.end_ms)}`;
}

export function subjectsLine(subjects: CinematicSubject[]): string {
  if (!subjects.length) return "No distinct subjects identified.";
  return subjects
    .map((subject) => {
      const bits = [subject.description];
      if (subject.position) bits.push(subject.position);
      if (subject.action) bits.push(subject.action);
      return bits.join(" — ");
    })
    .join(" · ");
}

export function evidenceStatusLabel(status: EvidenceStatus): string {
  if (status === "observed") return "Observed";
  if (status === "inferred") return "Inferred";
  return "Unknown / insufficient evidence";
}

function unknownValue(value?: string | null) {
  if (!value?.trim()) return true;
  const text = value.trim().toLowerCase();
  return text === "unknown" || text.includes("could not be determined") || text.includes("insufficient");
}

export function cameraEvidenceStatus(shot: {
  camera?: string | null;
  camera_explanation?: string | null;
  analysis_mode?: string | null;
}): EvidenceStatus {
  if (unknownValue(shot.camera) && unknownValue(shot.camera_explanation)) return "unknown";
  if (shot.analysis_mode === "sampled-fallback") return "unknown";
  return "inferred";
}

export function visualEvidenceStatus(value?: string | null): EvidenceStatus {
  return unknownValue(value) ? "unknown" : "observed";
}

export function temporalEvidenceStatus(value?: string | null): EvidenceStatus {
  return unknownValue(value) ? "unknown" : "inferred";
}

export function parseCinematicAnalysis(value: unknown): CinematicAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<CinematicAnalysis> & { cinematic?: unknown };
  const nested = record.cinematic && typeof record.cinematic === "object" ? (record.cinematic as Partial<CinematicAnalysis>) : null;
  const candidate = Array.isArray(record.shots) ? record : nested;
  const root = candidate && Array.isArray(candidate.shots) ? candidate : null;
  if (!root?.shots) return null;
  const shots = root.shots.map((shot, index) => normalizeShot(shot, index)).filter(Boolean) as CinematicShot[];
  if (!shots.length) return null;
  return {
    kind: CINEMATIC_KIND,
    analysis_version: typeof root.analysis_version === "string" ? root.analysis_version : CINEMATIC_ANALYSIS_VERSION,
    analysis_mode: root.analysis_mode === "gemini-sampled-frames" ? "gemini-sampled-frames" : "sampled-fallback",
    provider_limitation: asText(root.provider_limitation),
    overview: asText(root.overview) ?? "No storyline overview is available yet.",
    playback_id: asText(root.playback_id),
    asset_id: asText(root.asset_id),
    duration_ms: typeof root.duration_ms === "number" ? root.duration_ms : null,
    shots,
    creates_scene: false,
    creates_canonical: false,
  };
}

export function parseCinematicFromParameters(parameters: unknown): CinematicAnalysis | null {
  if (!parameters || typeof parameters !== "object") return null;
  const record = parameters as { cinematic?: unknown };
  return parseCinematicAnalysis(record.cinematic ?? parameters);
}

export function observationsFromCinematic(analysis: CinematicAnalysis | null): Array<{
  time_ms: number;
  mean_luminance: number | null;
  change_score: number | null;
  is_boundary_candidate: boolean;
}> {
  if (!analysis?.shots.length) return [];
  return analysis.shots.map((shot, index) => ({
    time_ms: shot.time_ms,
    mean_luminance: null,
    change_score: null,
    is_boundary_candidate:
      index === 0 || shot.transition === "cut" || shot.transition === "fade" || shot.transition === "dissolve",
  }));
}

export function parseCinematicShot(value: unknown): CinematicShot | null {
  return normalizeShot(value, 0);
}

function normalizeShot(value: unknown, index: number): CinematicShot | null {
  if (!value || typeof value !== "object") return null;
  const shot = value as Partial<CinematicShot>;
  const startMs = typeof shot.start_ms === "number" ? Math.max(0, Math.round(shot.start_ms)) : null;
  const endMs = typeof shot.end_ms === "number" ? Math.max(0, Math.round(shot.end_ms)) : null;
  if (startMs == null || endMs == null || endMs <= startMs) return null;
  const subjects = Array.isArray(shot.subjects)
    ? shot.subjects
        .map((subject, subjectIndex) => normalizeSubject(subject, subjectIndex))
        .filter(Boolean) as CinematicSubject[]
    : [];
  const timeMs = typeof shot.time_ms === "number" ? shot.time_ms : representativeTimeMs(startMs, endMs);
  return {
    shot_id: typeof shot.shot_id === "string" && shot.shot_id ? shot.shot_id : shotIdForTime(startMs),
    sequence: typeof shot.sequence === "number" && shot.sequence > 0 ? shot.sequence : index + 1,
    start_ms: startMs,
    end_ms: endMs,
    duration_ms: endMs - startMs,
    time_ms: timeMs,
    still_url: asText(shot.still_url),
    framing: asEnum(shot.framing, SHOT_FRAMINGS, "unknown"),
    composition: asText(shot.composition),
    camera: asEnum(shot.camera, CAMERA_MOTIONS, "unknown"),
    camera_explanation: asText(shot.camera_explanation),
    subjects,
    motion: asText(shot.motion) ?? "unknown",
    action: asText(shot.action) ?? "unknown",
    environment: asText(shot.environment) ?? "unknown",
    lighting: asText(shot.lighting),
    transition: asEnum(shot.transition, TRANSITIONS, "unknown"),
    narrative: asText(shot.narrative),
    what_happens: asText(shot.what_happens) ?? "Observation is incomplete.",
    confidence: asEnum(shot.confidence, ["high", "medium", "low"] as const, "low"),
    analysis_mode: shot.analysis_mode === "gemini-sampled-frames" ? "gemini-sampled-frames" : "sampled-fallback",
    creates_scene: false,
  };
}

function normalizeSubject(value: unknown, index: number): CinematicSubject | null {
  if (!value || typeof value !== "object") return null;
  const subject = value as Partial<CinematicSubject>;
  const description = asText(subject.description);
  if (!description) return null;
  return {
    subject_id: asText(subject.subject_id) ?? `subject-${index + 1}`,
    description,
    position: asText(subject.position),
    pose: asText(subject.pose),
    action: asText(subject.action),
    direction: asText(subject.direction),
    interaction: asText(subject.interaction),
  };
}

export function sampleTimesMs(durationMs: number, cues: FrameCue[], limit = 12): number[] {
  const duration = Math.max(0, durationMs);
  const times = new Set<number>();
  if (duration > 0) times.add(representativeTimeMs(0, Math.min(duration, 8000)));
  for (const cue of cues) {
    if (cue.is_boundary_candidate && cue.time_ms > 0 && cue.time_ms < duration) times.add(cue.time_ms);
  }
  if (duration > 0) {
    const steps = Math.min(limit, Math.max(4, Math.round(duration / 20_000) + 3));
    for (let index = 1; index < steps; index += 1) {
      const time = Math.round((duration * index) / steps);
      if (time > 0 && time < duration) times.add(time);
    }
    times.add(representativeTimeMs(Math.max(0, duration - 8000), duration));
  }
  return [...times].filter((time) => time > 0).sort((a, b) => a - b).slice(0, limit);
}

export function composeFallbackCinematic(input: {
  playbackId: string | null;
  assetId: string | null;
  durationMs: number | null;
  cues: FrameCue[];
  limitation: string | null;
}): CinematicAnalysis {
  const duration = input.durationMs && input.durationMs > 0 ? input.durationMs : Math.max(1000, ...input.cues.map((cue) => cue.time_ms), 1000);
  const boundaries = input.cues
    .filter((cue) => cue.is_boundary_candidate)
    .map((cue) => cue.time_ms)
    .filter((time) => time > 0 && time < duration)
    .sort((a, b) => a - b);
  const spaced = boundaries.filter((time, index) => index === 0 || time - boundaries[index - 1] >= 1500);
  const even = spaced.length >= 2
    ? []
    : Array.from({ length: Math.min(8, Math.max(4, Math.round(duration / 30_000))) }, (_, index) => Math.round((duration * (index + 1)) / (Math.min(8, Math.max(4, Math.round(duration / 30_000))) + 1)));
  const uniqueStarts = [...new Set([0, ...spaced, ...even])].filter((time) => time < duration).sort((a, b) => a - b);
  const shots: CinematicShot[] = uniqueStarts.map((start, index) => {
    const end = uniqueStarts[index + 1] ?? duration;
    const windowCues = input.cues.filter((cue) => cue.time_ms >= start && cue.time_ms < end);
    const peak = windowCues.reduce((best, cue) => ((cue.change_score ?? 0) > (best?.change_score ?? 0) ? cue : best), windowCues[0] ?? null);
    const change = peak?.change_score ?? 0;
    const timeMs = representativeTimeMs(start, end);
    return {
      shot_id: shotIdForTime(start),
      sequence: index + 1,
      start_ms: start,
      end_ms: end,
      duration_ms: end - start,
      time_ms: timeMs,
      still_url: input.playbackId ? muxThumbnailUrl(input.playbackId, timeMs / 1000, 640) : null,
      framing: "unknown",
      composition: null,
      camera: "unknown",
      camera_explanation: "Camera movement could not be determined from sampled luminance evidence.",
      subjects: [],
      motion: change >= 0.28 ? "Visible visual change across the window." : "Hold / limited visual change.",
      action: change >= 0.28 ? "Action is suggested by a boundary or luminance change; identity is unknown." : "No strong action cue in this window.",
      environment: "Environment was not identified in the fallback analyser.",
      lighting: peak?.mean_luminance != null ? (peak.mean_luminance < 40 ? "dark" : peak.mean_luminance > 120 ? "bright" : "mixed") : null,
      transition: index === 0 ? "unknown" : "cut",
      narrative: null,
      what_happens:
        change >= 0.28
          ? `A visual change is observed around ${formatMs(timeMs)}. This is sampled-frame fallback, not full video understanding.`
          : `This window holds with limited measured change. This is sampled-frame fallback, not full video understanding.`,
      confidence: "low",
      analysis_mode: "sampled-fallback",
      creates_scene: false,
    };
  });
  return {
    kind: CINEMATIC_KIND,
    analysis_version: CINEMATIC_ANALYSIS_VERSION,
    analysis_mode: "sampled-fallback",
    provider_limitation: input.limitation,
    overview: input.limitation
      ? `Fallback storyline from sampled frames and change scores. ${input.limitation}`
      : "Fallback storyline from sampled frames and change scores. Gemini video understanding was not used.",
    playback_id: input.playbackId,
    asset_id: input.assetId,
    duration_ms: input.durationMs,
    shots,
    creates_scene: false,
    creates_canonical: false,
  };
}

export function attachStillUrls(analysis: CinematicAnalysis, playbackId: string | null): CinematicAnalysis {
  if (!playbackId) return analysis;
  return {
    ...analysis,
    playback_id: playbackId,
    shots: analysis.shots.map((shot) => ({
      ...shot,
      still_url: muxThumbnailUrl(playbackId, Math.max(0.001, shot.time_ms / 1000), 640),
    })),
  };
}

export function cinematicToPanelProposal(shot: CinematicShot): {
  title: string;
  description: string;
  action: string;
  camera: string;
  camera_movement: string;
  framing: string;
  environment: string;
  lighting: string | null;
  characters: string | null;
  transition: string;
  narrative_purpose: string | null;
  duration_ms: number;
} {
  return {
    title: `Shot ${String(shot.sequence).padStart(2, "0")}`,
    description: shot.what_happens,
    action: shot.action,
    camera: shot.camera_explanation || shot.camera,
    camera_movement: shot.camera,
    framing: shot.framing,
    environment: shot.environment,
    lighting: shot.lighting,
    characters: subjectsLine(shot.subjects),
    transition: shot.transition,
    narrative_purpose: shot.narrative,
    duration_ms: shot.duration_ms,
  };
}

export function withCinematicParameters(existing: unknown, cinematic: CinematicAnalysis): Record<string, unknown> {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...(existing as Record<string, unknown>) } : {};
  return { ...base, cinematic };
}
