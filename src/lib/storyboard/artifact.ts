/**
 * Storyboard artifacts are materials, not canonical ontology.
 * They reuse media_intake provenance rather than a new table.
 */

export const STORYBOARD_BODY_KIND = "storyboard-body";
export const STORYBOARD_ARTIFACT_KIND = "storyboard-artifact";

export type StoryboardOutputType =
  | "script"
  | "panel"
  | "still"
  | "variation"
  | "animation"
  | "clip"
  | "gif"
  | "reel";

export type StoryboardGenerationStatus = "idle" | "generating" | "ready" | "failed" | "unavailable";

export type StoryboardBodyProvenance = {
  kind: typeof STORYBOARD_BODY_KIND;
  universe_id: string;
  body: string;
  panel_count: number;
  creates_scene: false;
  creates_canonical: false;
};

export type StoryboardArtifactProvenance = {
  kind: typeof STORYBOARD_ARTIFACT_KIND;
  universe_id: string;
  output_type: StoryboardOutputType;
  panel_id: string | null;
  title: string;
  description: string | null;
  source: "script" | "sentinel" | "reference" | "ai";
  mux_asset_id: string | null;
  playback_id: string | null;
  still_url: string | null;
  creates_scene: false;
  creates_canonical: false;
  binds_projection: false;
};

export function parseStoryboardBody(value: string | null | undefined): StoryboardBodyProvenance | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoryboardBodyProvenance>;
    if (parsed.kind !== STORYBOARD_BODY_KIND) return null;
    if (typeof parsed.body !== "string") return null;
    return {
      kind: STORYBOARD_BODY_KIND,
      universe_id: typeof parsed.universe_id === "string" ? parsed.universe_id : "",
      body: parsed.body,
      panel_count: typeof parsed.panel_count === "number" ? parsed.panel_count : 0,
      creates_scene: false,
      creates_canonical: false,
    };
  } catch {
    return null;
  }
}

export function parseStoryboardArtifact(value: string | null | undefined): StoryboardArtifactProvenance | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoryboardArtifactProvenance>;
    if (parsed.kind !== STORYBOARD_ARTIFACT_KIND) return null;
    return {
      kind: STORYBOARD_ARTIFACT_KIND,
      universe_id: typeof parsed.universe_id === "string" ? parsed.universe_id : "",
      output_type: parsed.output_type ?? "panel",
      panel_id: typeof parsed.panel_id === "string" ? parsed.panel_id : null,
      title: typeof parsed.title === "string" ? parsed.title : "Storyboard artifact",
      description: typeof parsed.description === "string" ? parsed.description : null,
      source: parsed.source === "sentinel" || parsed.source === "reference" || parsed.source === "ai" ? parsed.source : "script",
      mux_asset_id: typeof parsed.mux_asset_id === "string" ? parsed.mux_asset_id : null,
      playback_id: typeof parsed.playback_id === "string" ? parsed.playback_id : null,
      still_url: typeof parsed.still_url === "string" ? parsed.still_url : null,
      creates_scene: false,
      creates_canonical: false,
      binds_projection: false,
    };
  } catch {
    return null;
  }
}

export function storyboardBodyNotes(input: {
  universe_id: string;
  body: string;
  panel_count: number;
}): string {
  const provenance: StoryboardBodyProvenance = {
    kind: STORYBOARD_BODY_KIND,
    universe_id: input.universe_id,
    body: input.body,
    panel_count: input.panel_count,
    creates_scene: false,
    creates_canonical: false,
  };
  return JSON.stringify(provenance);
}

export function storyboardArtifactNotes(input: Omit<StoryboardArtifactProvenance, "kind" | "creates_scene" | "creates_canonical" | "binds_projection">): string {
  const provenance: StoryboardArtifactProvenance = {
    kind: STORYBOARD_ARTIFACT_KIND,
    ...input,
    creates_scene: false,
    creates_canonical: false,
    binds_projection: false,
  };
  return JSON.stringify(provenance);
}
