/**
 * Durable Storyboard document. Panels are creative artifacts, not Scenes.
 */

export type StoryboardPanelSource = "script" | "sentinel" | "ai" | "hybrid";
export type StoryboardPanelStatus = "draft" | "ready" | "generating";
export type StoryboardReferenceRole =
  | "character"
  | "environment"
  | "style"
  | "still"
  | "first-frame"
  | "last-frame"
  | "motion"
  | "gallery";

export type StoryboardReference = {
  role: StoryboardReferenceRole;
  label: string;
  asset_id?: string | null;
  url?: string | null;
};

export type StoryboardPanelRecord = {
  panel_id: string;
  work_id: string;
  sequence: number;
  title: string;
  description: string;
  narrative_purpose: string | null;
  action: string | null;
  dialogue: string | null;
  narration: string | null;
  camera: string | null;
  camera_movement: string | null;
  framing: string | null;
  lens_style: string | null;
  lighting: string | null;
  environment: string | null;
  characters: string | null;
  mood: string | null;
  transition: string | null;
  duration_ms: number | null;
  aspect_ratio: string | null;
  status: StoryboardPanelStatus;
  source: StoryboardPanelSource;
  proposed_scene_id: string | null;
  sentinel_panel_id: string | null;
  active_still_asset_id: string | null;
  active_motion_asset_id: string | null;
  still_url: string | null;
  motion_playback_id: string | null;
  motion_endpoint: string | null;
  references: StoryboardReference[];
  user_locked: boolean;
  creates_scene: false;
};

export type StoryboardWorkRecord = {
  work_id: string;
  universe_id: string | null;
  participant_id: string;
  title: string;
  premise: string | null;
  body: string;
  tone: string | null;
  genre: string | null;
  audience: string | null;
  creative_intent: string | null;
  status: string;
  source: string;
  panels: StoryboardPanelRecord[];
  creates_scene: false;
  creates_canonical: false;
};

export const STRUCTURED_STORYBOARD_SYSTEM = `You are assisting a curator inside Mighty Verse Creative Studio.
Return a structured storyboard for cinematic African creative culture.
Do not invent canonical Scenes, Creative Moments, Universes, Murals, or database identifiers.
Do not treat storyboard panels as published ontology.
Keep each panel visually specific: subject, action, environment, camera, lighting, mood.
If the curator already wrote a story body, preserve their wording unless they asked you to rewrite.`;
