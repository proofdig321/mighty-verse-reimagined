/**
 * Shared 2.5D program for Studio Preview and public Experience.
 *
 * One composition: Mux mural clock + canonical Scene windows + Creative
 * Moments + approved production layers. Does not create Scenes, rewrite
 * timing, or expose provider identifiers to the audience surface.
 */

import type { SuiteSourcePreview } from "../assemble/load-source-preview";
import type { HolographicLayer } from "../media/sentinel-intelligence";
import { muxThumbnailUrl } from "../media/thumbnail";
import { formatDuration, formatTimelineMs } from "../media/timing";
import { composeExperienceProjection, type ApprovedProductionLayer } from "../production/projection";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ExperienceWindow = {
  title: string;
  start_ms: number;
  end_ms: number;
  scene_master_id: string;
};

export type HolographicClock = {
  endpoint_ref: string;
  duration_ms: number | null;
  thumbnail_ref: string | null;
  projection_id: string;
  master_id: string;
  canonical_state_id: string;
};

export type HolographicProgram = {
  title: string;
  duration_ms: number;
  clock: HolographicClock | null;
  windows: ExperienceWindow[];
  layers: HolographicLayer[];
  production_count: number;
  injects_gallery: false;
  injects_evidence: false;
  redefines_timing: false;
  creates_scene: false;
};

/** Public continuation links. Never shown as raw identifiers. */
export type ExperienceSurfaceLinks = {
  universeHref: string;
  muralHref: string | null;
  sceneDeckHref: string;
  sceneHref: Record<string, string>;
  momentHref: Record<string, string>;
};

export function audienceLabel(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || UUID_RE.test(trimmed)) return fallback;
  return trimmed;
}

export function audienceLayerTitle(value: string | null | undefined, fallback: string): string {
  const label = audienceLabel(value, fallback).replace(/\s+production$/i, "").trim();
  return label || fallback;
}

export function layerKicker(kind: HolographicLayer["kind"], mode: "public" | "studio"): string {
  if (kind === "mural") return "Mural";
  if (kind === "scene") return "Scene";
  if (kind === "moment") return "Creative Moment";
  return mode === "studio" ? "Production" : "Realization";
}

export function layerIsActive(layer: HolographicLayer, timeMs: number): boolean {
  if (layer.kind === "mural") return true;
  if (layer.start_ms == null || layer.end_ms == null) return false;
  return timeMs >= layer.start_ms && timeMs < layer.end_ms;
}

export function activeWindow(windows: ExperienceWindow[], timeMs: number): ExperienceWindow | null {
  return windows.find((window) => timeMs >= window.start_ms && timeMs < window.end_ms) ?? null;
}

export function windowProgress(window: ExperienceWindow, timeMs: number): number {
  const span = window.end_ms - window.start_ms;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (timeMs - window.start_ms) / span));
}

export function formatClock(ms: number): string {
  return formatDuration(Math.max(0, ms) / 1000);
}

export function formatWindowRange(window: ExperienceWindow): string {
  return `${formatTimelineMs(window.start_ms)} → ${formatTimelineMs(window.end_ms)}`;
}

export function stillAtTime(thumbnailRef: string | null, timeMs: number, width = 640): string | null {
  if (!thumbnailRef) return null;
  return muxThumbnailUrl(thumbnailRef, Math.max(0, Math.floor(timeMs / 1000)), width);
}

export function composeHolographicProgram(input: {
  title: string;
  layers: HolographicLayer[];
  realizations?: ApprovedProductionLayer[] | null;
  source?: SuiteSourcePreview | null;
  moments?: { master_id: string; title: string | null; scene_ids: string[] }[] | null;
}): HolographicProgram {
  const projection = composeExperienceProjection({
    canonical_layers: input.layers,
    realizations: input.realizations,
  });
  const windows: ExperienceWindow[] = (input.source?.windows ?? [])
    .filter((window) => window.end_ms > window.start_ms)
    .map((window) => ({
      title: audienceLabel(window.title, "Scene"),
      start_ms: window.start_ms,
      end_ms: window.end_ms,
      scene_master_id: window.scene_master_id,
    }));

  const byScene = new Map(windows.map((window) => [window.scene_master_id, window]));
  const durationMs =
    input.source?.duration_ms ??
    windows.reduce((max, window) => Math.max(max, window.end_ms), 0);

  const layers = projection.layers.map((layer) => {
    if (layer.kind === "scene") {
      const window = byScene.get(layer.master_id);
      return {
        ...layer,
        start_ms: window?.start_ms ?? layer.start_ms,
        end_ms: window?.end_ms ?? layer.end_ms,
        playback_endpoint: layer.playback_endpoint ?? input.source?.endpoint_ref ?? null,
      };
    }
    if (layer.kind === "moment" || layer.kind === "production") {
      const related = layer.related_scene_ids
        .map((id) => byScene.get(id))
        .filter((window): window is ExperienceWindow => Boolean(window));
      return {
        ...layer,
        start_ms: related[0]?.start_ms ?? layer.start_ms,
        end_ms: related[related.length - 1]?.end_ms ?? layer.end_ms,
      };
    }
    if (layer.kind === "mural") {
      return {
        ...layer,
        start_ms: 0,
        end_ms: durationMs || layer.end_ms,
        playback_endpoint: input.source?.endpoint_ref ?? layer.playback_endpoint,
      };
    }
    return layer;
  });

  const presentMoments = new Set(layers.filter((layer) => layer.kind === "moment").map((layer) => layer.master_id));
  for (const moment of input.moments ?? []) {
    if (presentMoments.has(moment.master_id)) continue;
    const related = layers.filter((layer) => layer.kind === "scene" && moment.scene_ids.includes(layer.master_id));
    const host = related[0] ?? null;
    const still =
      host?.still_url ??
      (host?.start_ms != null ? stillAtTime(input.source?.playback_id ?? null, host.start_ms) : null);
    layers.push({
      layer_id: `moment-${moment.master_id}`,
      kind: "moment",
      master_id: moment.master_id,
      title: moment.title,
      still_url: still,
      depth: 108,
      offset_x: 0,
      offset_y: -72,
      related_scene_ids: moment.scene_ids,
      start_ms: host?.start_ms ?? null,
      end_ms: related[related.length - 1]?.end_ms ?? null,
      playback_endpoint: null,
    });
  }

  return {
    title: audienceLabel(input.title, "Experience"),
    duration_ms: durationMs,
    clock: input.source
      ? {
          endpoint_ref: input.source.endpoint_ref,
          duration_ms: input.source.duration_ms,
          thumbnail_ref: input.source.playback_id,
          projection_id: input.source.mural_projection_id,
          master_id: input.source.mural_id,
          canonical_state_id: input.source.mural_canonical_state_id ?? input.source.mural_id,
        }
      : null,
    windows,
    layers,
    production_count: projection.production_count,
    injects_gallery: false,
    injects_evidence: false,
    redefines_timing: false,
    creates_scene: false,
  };
}
