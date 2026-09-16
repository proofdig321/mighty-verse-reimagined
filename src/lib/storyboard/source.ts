/**
 * Storyboard source media and derived frame references.
 * Reuses media_intake provenance. Never creates Scenes.
 */

import { parseCinematicAnalysis, type CinematicAnalysis } from "../media/cinematic-evidence";

export const STORYBOARD_SOURCE_KIND = "storyboard-source";
export const STORYBOARD_FRAME_KIND = "storyboard-frame-reference";
export const STORYBOARD_ASSEMBLY_KIND = "storyboard-assembly";
export const STORYBOARD_SELECTION_KIND = "storyboard-selection";
export const STORYBOARD_CINEMATIC_KIND = "storyboard-cinematic";

export type StoryboardSourceKind = "source" | "reference" | "generated";

export type StoryboardSourceRecord = {
  kind: typeof STORYBOARD_SOURCE_KIND;
  work_id: string;
  title: string;
  asset_id: string | null;
  mux_asset_id: string | null;
  playback_id: string | null;
  endpoint_ref: string | null;
  still_url: string | null;
  duration_ms: number | null;
  category: StoryboardSourceKind;
  creates_scene: false;
  creates_canonical: false;
};

export type StoryboardFrameRecord = {
  kind: typeof STORYBOARD_FRAME_KIND;
  work_id: string;
  source_title: string;
  timestamp_ms: number;
  derived: "Storyboard Reference";
  playback_id: string;
  still_url: string;
  panel_id: string | null;
  creates_scene: false;
  creates_canonical: false;
};

export type StoryboardAssemblyRecord = {
  kind: typeof STORYBOARD_ASSEMBLY_KIND;
  work_id: string;
  items: Array<{
    id: string;
    kind: "still" | "motion" | "source" | "reference";
    label: string;
    panel_id?: string | null;
    asset_id?: string | null;
    url?: string | null;
    playback_id?: string | null;
    endpoint?: string | null;
  }>;
  creates_scene: false;
  creates_canonical: false;
};

export type StoryboardSelectionRecord = {
  kind: typeof STORYBOARD_SELECTION_KIND;
  work_id: string;
  shot_id: string;
  panel_id: string | null;
  creates_scene: false;
  creates_canonical: false;
};

export type StoryboardCinematicRecord = {
  kind: typeof STORYBOARD_CINEMATIC_KIND;
  work_id: string;
  cinematic: CinematicAnalysis;
  creates_scene: false;
  creates_canonical: false;
};

export function parseStoryboardSource(value: string | null | undefined): StoryboardSourceRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoryboardSourceRecord>;
    if (parsed.kind !== STORYBOARD_SOURCE_KIND) return null;
    if (typeof parsed.work_id !== "string") return null;
    return {
      kind: STORYBOARD_SOURCE_KIND,
      work_id: parsed.work_id,
      title: typeof parsed.title === "string" ? parsed.title : "Source media",
      asset_id: typeof parsed.asset_id === "string" ? parsed.asset_id : null,
      mux_asset_id: typeof parsed.mux_asset_id === "string" ? parsed.mux_asset_id : null,
      playback_id: typeof parsed.playback_id === "string" ? parsed.playback_id : null,
      endpoint_ref: typeof parsed.endpoint_ref === "string" ? parsed.endpoint_ref : null,
      still_url: typeof parsed.still_url === "string" ? parsed.still_url : null,
      duration_ms: typeof parsed.duration_ms === "number" ? parsed.duration_ms : null,
      category: parsed.category === "reference" || parsed.category === "generated" ? parsed.category : "source",
      creates_scene: false,
      creates_canonical: false,
    };
  } catch {
    return null;
  }
}

export function parseStoryboardFrame(value: string | null | undefined): StoryboardFrameRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoryboardFrameRecord>;
    if (parsed.kind !== STORYBOARD_FRAME_KIND) return null;
    if (typeof parsed.work_id !== "string" || typeof parsed.playback_id !== "string" || typeof parsed.still_url !== "string") {
      return null;
    }
    return {
      kind: STORYBOARD_FRAME_KIND,
      work_id: parsed.work_id,
      source_title: typeof parsed.source_title === "string" ? parsed.source_title : "Source performance",
      timestamp_ms: typeof parsed.timestamp_ms === "number" ? parsed.timestamp_ms : 0,
      derived: "Storyboard Reference",
      playback_id: parsed.playback_id,
      still_url: parsed.still_url,
      panel_id: typeof parsed.panel_id === "string" ? parsed.panel_id : null,
      creates_scene: false,
      creates_canonical: false,
    };
  } catch {
    return null;
  }
}

export function parseStoryboardAssembly(value: string | null | undefined): StoryboardAssemblyRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoryboardAssemblyRecord>;
    if (parsed.kind !== STORYBOARD_ASSEMBLY_KIND) return null;
    if (typeof parsed.work_id !== "string") return null;
    return {
      kind: STORYBOARD_ASSEMBLY_KIND,
      work_id: parsed.work_id,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      creates_scene: false,
      creates_canonical: false,
    };
  } catch {
    return null;
  }
}

export function storyboardSourceNotes(input: Omit<StoryboardSourceRecord, "kind" | "creates_scene" | "creates_canonical">): string {
  const provenance: StoryboardSourceRecord = {
    kind: STORYBOARD_SOURCE_KIND,
    ...input,
    creates_scene: false,
    creates_canonical: false,
  };
  return JSON.stringify(provenance);
}

export function storyboardFrameNotes(input: Omit<StoryboardFrameRecord, "kind" | "derived" | "creates_scene" | "creates_canonical">): string {
  const provenance: StoryboardFrameRecord = {
    kind: STORYBOARD_FRAME_KIND,
    derived: "Storyboard Reference",
    ...input,
    creates_scene: false,
    creates_canonical: false,
  };
  return JSON.stringify(provenance);
}

export function storyboardAssemblyNotes(input: Omit<StoryboardAssemblyRecord, "kind" | "creates_scene" | "creates_canonical">): string {
  const provenance: StoryboardAssemblyRecord = {
    kind: STORYBOARD_ASSEMBLY_KIND,
    ...input,
    creates_scene: false,
    creates_canonical: false,
  };
  return JSON.stringify(provenance);
}

export function parseStoryboardSelection(value: string | null | undefined): StoryboardSelectionRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoryboardSelectionRecord>;
    if (parsed.kind !== STORYBOARD_SELECTION_KIND) return null;
    if (typeof parsed.work_id !== "string" || typeof parsed.shot_id !== "string") return null;
    return {
      kind: STORYBOARD_SELECTION_KIND,
      work_id: parsed.work_id,
      shot_id: parsed.shot_id,
      panel_id: typeof parsed.panel_id === "string" ? parsed.panel_id : null,
      creates_scene: false,
      creates_canonical: false,
    };
  } catch {
    return null;
  }
}

export function storyboardSelectionNotes(input: Omit<StoryboardSelectionRecord, "kind" | "creates_scene" | "creates_canonical">): string {
  const provenance: StoryboardSelectionRecord = {
    kind: STORYBOARD_SELECTION_KIND,
    ...input,
    creates_scene: false,
    creates_canonical: false,
  };
  return JSON.stringify(provenance);
}

export function parseStoryboardCinematic(value: string | null | undefined): StoryboardCinematicRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoryboardCinematicRecord>;
    if (parsed.kind !== STORYBOARD_CINEMATIC_KIND) return null;
    if (typeof parsed.work_id !== "string") return null;
    const cinematic = parseCinematicAnalysis(parsed.cinematic);
    if (!cinematic) return null;
    return {
      kind: STORYBOARD_CINEMATIC_KIND,
      work_id: parsed.work_id,
      cinematic,
      creates_scene: false,
      creates_canonical: false,
    };
  } catch {
    return null;
  }
}

export function storyboardCinematicNotes(input: { work_id: string; cinematic: CinematicAnalysis }): string {
  const provenance: StoryboardCinematicRecord = {
    kind: STORYBOARD_CINEMATIC_KIND,
    work_id: input.work_id,
    cinematic: input.cinematic,
    creates_scene: false,
    creates_canonical: false,
  };
  return JSON.stringify(provenance);
}

export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function sourceCategoryLabel(category: StoryboardSourceKind): string {
  if (category === "source") return "Source";
  if (category === "generated") return "Generated";
  return "Reference";
}
