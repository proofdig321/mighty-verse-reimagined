/**
 * Sentinel-derived creative intelligence.
 *
 * Sentinel remains observational evidence. This module *generates*:
 *   - Scene-boundary proposals against existing canonical Scenes
 *   - storyboard panels
 *   - animation planning beats
 *   - 2.5D holographic layers
 *
 * It does not create Universe, Mural, Scene, Creative Moment, projection,
 * binding, or realization records. Canonicalisation is a separate authorised
 * apply of proposed windows onto *existing* Scene bindings.
 *
 * MEDIA → SENTINEL EVIDENCE → HUMAN AUTHORISATION → CANONICAL TRUTH
 */

import { muxThumbnailUrl, providerThumbnailUrl } from "./thumbnail";
import { formatTimelineMs } from "./timing";

export const SENTINEL_MATCH_WINDOW_MS = 15_000;
export const CUT_INTENSITY = 0.22;

export type SentinelObservation = {
  time_ms: number;
  mean_luminance: number | null;
  change_score: number | null;
  is_boundary_candidate: boolean;
};

export type IntelligenceScene = {
  master_id: string;
  title: string | null;
  binding_id: string | null;
  start_ms: number | null;
  end_ms: number | null;
  sort_order: number | null;
  provider: string | null;
  storage_ref: string | null;
  asset_id: string | null;
  creative_moments: { master_id: string; title: string | null }[];
};

export type IntelligenceMoment = {
  master_id: string;
  title: string | null;
  scene_ids: string[];
};

export type BoundaryProposal = {
  scene_master_id: string;
  title: string | null;
  binding_id: string | null;
  canonical_start_ms: number;
  canonical_end_ms: number;
  proposed_start_ms: number;
  proposed_end_ms: number;
  start_delta_ms: number;
  end_delta_ms: number;
  status: "aligned" | "adjust";
  creates_scene: false;
};

export type StoryboardPanel = {
  panel_id: string;
  kind: "scene" | "beat";
  time_ms: number;
  scene_master_id: string | null;
  title: string;
  still_url: string | null;
  change_score: number | null;
  is_canonical_scene: boolean;
};

export type AnimationBeat = {
  scene_master_id: string;
  title: string | null;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  intensity: number;
  enter: "cut" | "dissolve";
  exit: "cut" | "dissolve";
  motion: "power" | "aura" | "combat" | "mastery" | "hold";
  holographic_depth: number;
};

export type HolographicLayer = {
  layer_id: string;
  kind: "mural" | "scene" | "moment" | "production";
  master_id: string;
  title: string | null;
  still_url: string | null;
  depth: number;
  offset_x: number;
  offset_y: number;
  related_scene_ids: string[];
};

export type SentinelIntelligence = {
  session_id: string | null;
  asset_id: string | null;
  observation_count: number;
  candidate_count: number;
  proposals: BoundaryProposal[];
  storyboard: StoryboardPanel[];
  animation: AnimationBeat[];
  holographic: HolographicLayer[];
  unaligned_beats: number[];
  creates_universe: false;
  creates_mural: false;
  creates_scene: false;
  creates_creative_moment: false;
  creates_projection: false;
  creates_binding: false;
  creates_realization: false;
};

export type AuthoriseWindowsDecisionOk = {
  ok: true;
  action: "authorise_windows";
  universe_id: string;
  windows: {
    scene_master_id: string;
    binding_id: string;
    start_ms: number;
    end_ms: number;
  }[];
  creates_scene: false;
  creates_canonical_objects: false;
  writes_existing_windows: true;
};

export type AuthoriseWindowsDecisionErr = {
  ok: false;
  code: "missing_ids" | "invalid_id" | "nothing_to_authorise" | "invalid_range";
  message: string;
};

export type AuthoriseWindowsDecision = AuthoriseWindowsDecisionOk | AuthoriseWindowsDecisionErr;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

function stillFor(scene: IntelligenceScene, timeMs: number): string | null {
  if (!scene.storage_ref) return null;
  const timeSec = Math.max(0, Math.floor(timeMs / 1000));
  if (scene.provider === "mux") return muxThumbnailUrl(scene.storage_ref, timeSec, 640);
  return providerThumbnailUrl(scene.provider, scene.storage_ref, { timeSec, width: 640 });
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function motionFor(title: string | null, index: number): AnimationBeat["motion"] {
  const text = (title ?? "").toLowerCase();
  if (text.includes("powerhouse") || text.includes("golden")) return "power";
  if (text.includes("dark") || text.includes("knight") || text.includes("mothipa")) return "aura";
  if (text.includes("hand") || text.includes("proverb")) return "combat";
  if (text.includes("sword") || text.includes("reason")) return "mastery";
  const kinds: AnimationBeat["motion"][] = ["power", "aura", "combat", "mastery"];
  return kinds[index % kinds.length] ?? "hold";
}

function nearest(timeMs: number, candidates: number[]): { time_ms: number; delta_ms: number } | null {
  let best: number | null = null;
  let bestDelta = Infinity;
  for (const candidate of candidates) {
    const delta = Math.abs(candidate - timeMs);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  if (best == null || bestDelta > SENTINEL_MATCH_WINDOW_MS) return null;
  return { time_ms: best, delta_ms: bestDelta };
}

function sceneWindows(scenes: IntelligenceScene[]) {
  return scenes
    .filter((scene) => scene.start_ms != null && scene.end_ms != null && scene.end_ms > scene.start_ms)
    .slice()
    .sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/**
 * Derive Sentinel intelligence for an existing Universe assembly.
 * Extra boundary candidates become storyboard beats, never new Scenes.
 */
export function composeSentinelIntelligence(input: {
  session_id?: string | null;
  asset_id?: string | null;
  observations: SentinelObservation[];
  scenes: IntelligenceScene[];
  moments?: IntelligenceMoment[];
  mural?: { master_id: string; title: string | null; provider: string | null; storage_ref: string | null } | null;
}): SentinelIntelligence {
  const windows = sceneWindows(input.scenes);
  const candidates = input.observations
    .filter((observation) => observation.is_boundary_candidate)
    .map((observation) => observation.time_ms)
    .sort((a, b) => a - b);
  const used = new Set<number>();

  const proposals: BoundaryProposal[] = windows.map((scene) => {
    const startMs = scene.start_ms as number;
    const endMs = scene.end_ms as number;
    const startMatch = nearest(startMs, candidates);
    const endMatch = nearest(endMs, candidates);
    let proposedStart = startMatch?.time_ms ?? startMs;
    let proposedEnd = endMatch?.time_ms ?? endMs;
    if (proposedEnd <= proposedStart) {
      proposedStart = startMs;
      proposedEnd = endMs;
    }
    if (startMatch) used.add(startMatch.time_ms);
    if (endMatch) used.add(endMatch.time_ms);
    const startDelta = proposedStart - startMs;
    const endDelta = proposedEnd - endMs;
    const status: BoundaryProposal["status"] =
      startDelta === 0 && endDelta === 0 ? "aligned" : "adjust";
    return {
      scene_master_id: scene.master_id,
      title: scene.title,
      binding_id: scene.binding_id,
      canonical_start_ms: startMs,
      canonical_end_ms: endMs,
      proposed_start_ms: proposedStart,
      proposed_end_ms: proposedEnd,
      start_delta_ms: startDelta,
      end_delta_ms: endDelta,
      status,
      creates_scene: false,
    };
  });

  const unaligned = candidates.filter((time) => {
    if (used.has(time)) return false;
    return !windows.some((scene) => time > (scene.start_ms as number) && time < (scene.end_ms as number));
  });

  const storyboard: StoryboardPanel[] = [];
  windows.forEach((scene, index) => {
    const startMs = scene.start_ms as number;
    const endMs = scene.end_ms as number;
    storyboard.push({
      panel_id: `scene-${scene.master_id}`,
      kind: "scene",
      time_ms: startMs,
      scene_master_id: scene.master_id,
      title: scene.title ?? `Scene ${index + 1}`,
      still_url: stillFor(scene, startMs),
      change_score: null,
      is_canonical_scene: true,
    });
    for (const observation of input.observations) {
      if (!observation.is_boundary_candidate) continue;
      if (observation.time_ms <= startMs || observation.time_ms >= endMs) continue;
      storyboard.push({
        panel_id: `beat-${scene.master_id}-${observation.time_ms}`,
        kind: "beat",
        time_ms: observation.time_ms,
        scene_master_id: scene.master_id,
        title: `${scene.title ?? "Scene"} beat · ${formatTimelineMs(observation.time_ms)}`,
        still_url: stillFor(scene, observation.time_ms),
        change_score: observation.change_score,
        is_canonical_scene: false,
      });
    }
  });
  for (const time of unaligned) {
    const host = windows.find((scene) => time < (scene.start_ms as number)) ?? windows[windows.length - 1] ?? null;
    storyboard.push({
      panel_id: `unaligned-${time}`,
      kind: "beat",
      time_ms: time,
      scene_master_id: null,
      title: `Unaligned beat · ${formatTimelineMs(time)}`,
      still_url: host ? stillFor(host, time) : null,
      change_score: input.observations.find((observation) => observation.time_ms === time)?.change_score ?? null,
      is_canonical_scene: false,
    });
  }
  storyboard.sort((a, b) => a.time_ms - b.time_ms);

  const animation: AnimationBeat[] = windows.map((scene, index) => {
    const startMs = scene.start_ms as number;
    const endMs = scene.end_ms as number;
    const inWindow = input.observations.filter(
      (observation) => observation.time_ms >= startMs && observation.time_ms < endMs && observation.change_score != null,
    );
    const intensity = mean(inWindow.map((observation) => observation.change_score as number));
    const next = windows[index + 1];
    const gap = next?.start_ms != null ? next.start_ms - endMs : 0;
    return {
      scene_master_id: scene.master_id,
      title: scene.title,
      start_ms: startMs,
      end_ms: endMs,
      duration_ms: endMs - startMs,
      intensity,
      enter: index === 0 || intensity >= CUT_INTENSITY ? "cut" : "dissolve",
      exit: next && gap >= 0 && gap < 2000 ? "cut" : "dissolve",
      motion: motionFor(scene.title, index),
      holographic_depth: (index + 1) * 48,
    };
  });

  const muralStill = input.mural?.storage_ref
    ? providerThumbnailUrl(input.mural.provider, input.mural.storage_ref, { timeSec: 0, width: 960 })
    : windows[0]
      ? stillFor(windows[0], windows[0].start_ms as number)
      : null;

  const holographic: HolographicLayer[] = [];
  if (input.mural) {
    holographic.push({
      layer_id: `mural-${input.mural.master_id}`,
      kind: "mural",
      master_id: input.mural.master_id,
      title: input.mural.title,
      still_url: muralStill,
      depth: 0,
      offset_x: 0,
      offset_y: 28,
      related_scene_ids: windows.map((scene) => scene.master_id),
    });
  }
  windows.forEach((scene, index) => {
    holographic.push({
      layer_id: `scene-${scene.master_id}`,
      kind: "scene",
      master_id: scene.master_id,
      title: scene.title,
      still_url: stillFor(scene, scene.start_ms as number),
      depth: (index + 1) * 72,
      offset_x: (index - (windows.length - 1) / 2) * 108,
      offset_y: index % 2 === 0 ? -8 : 22,
      related_scene_ids: [scene.master_id],
    });
  });
  const momentIndex = new Map<string, IntelligenceMoment>();
  for (const moment of input.moments ?? []) momentIndex.set(moment.master_id, moment);
  const seenMoments = new Set<string>();
  windows.forEach((scene, index) => {
    for (const related of scene.creative_moments) {
      if (seenMoments.has(related.master_id)) continue;
      seenMoments.add(related.master_id);
      const moment = momentIndex.get(related.master_id);
      const sceneIds = moment?.scene_ids?.length ? moment.scene_ids : [scene.master_id];
      holographic.push({
        layer_id: `moment-${related.master_id}`,
        kind: "moment",
        master_id: related.master_id,
        title: related.title,
        still_url: stillFor(scene, scene.start_ms as number),
        depth: (index + 1) * 72 + 36,
        offset_x: sceneIds.length > 1 ? 0 : (index - (windows.length - 1) / 2) * 124,
        offset_y: -72,
        related_scene_ids: sceneIds,
      });
    }
  });

  return {
    session_id: input.session_id ?? null,
    asset_id: input.asset_id ?? null,
    observation_count: input.observations.length,
    candidate_count: candidates.length,
    proposals,
    storyboard,
    animation,
    holographic,
    unaligned_beats: unaligned,
    creates_universe: false,
    creates_mural: false,
    creates_scene: false,
    creates_creative_moment: false,
    creates_projection: false,
    creates_binding: false,
    creates_realization: false,
  };
}

/**
 * Authorise Sentinel window proposals onto existing Scene bindings.
 * Does not create Scenes. Aligned proposals are skipped.
 */
export function decideAuthoriseWindows(input: {
  universe_id?: string | null;
  proposals: BoundaryProposal[];
  scene_master_ids?: string[] | null;
}): AuthoriseWindowsDecision {
  const universeId = input.universe_id?.trim() ?? "";
  if (!universeId) {
    return { ok: false, code: "missing_ids", message: "A Universe is required." };
  }
  if (!isId(universeId)) {
    return { ok: false, code: "invalid_id", message: "Universe must be a canonical identifier." };
  }

  const selected = new Set((input.scene_master_ids ?? []).filter(Boolean));
  const windows = input.proposals
    .filter((proposal) => proposal.status === "adjust")
    .filter((proposal) => selected.size === 0 || selected.has(proposal.scene_master_id))
    .filter((proposal) => proposal.binding_id && isId(proposal.binding_id) && isId(proposal.scene_master_id));

  if (!windows.length) {
    return { ok: false, code: "nothing_to_authorise", message: "Sentinel has no window adjustments to authorise." };
  }

  for (const window of windows) {
    if (window.proposed_end_ms <= window.proposed_start_ms) {
      return { ok: false, code: "invalid_range", message: "Proposed Scene windows must end after they start." };
    }
  }

  return {
    ok: true,
    action: "authorise_windows",
    universe_id: universeId,
    windows: windows.map((proposal) => ({
      scene_master_id: proposal.scene_master_id,
      binding_id: proposal.binding_id as string,
      start_ms: proposal.proposed_start_ms,
      end_ms: proposal.proposed_end_ms,
    })),
    creates_scene: false,
    creates_canonical_objects: false,
    writes_existing_windows: true,
  };
}
