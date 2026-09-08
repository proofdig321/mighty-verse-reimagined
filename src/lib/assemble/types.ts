/**
 * ASSEMBLE read-model for a Universe and its canonical children.
 *
 * This is product capability, not an Authority-only view. Routes inject
 * permissions and actions. Do not add playback or EXPERIENCE fields here.
 */

export type UniverseAssemblySceneMoment = {
  master_id: string;
  title: string | null;
};

export type UniverseAssemblyScene = {
  master_id: string;
  title: string | null;
  sort_order: number | null;
  start_ms: number | null;
  end_ms: number | null;
  projection_id: string | null;
  creative_moments: UniverseAssemblySceneMoment[];
  creative_moment_id: string | null;
  creative_moment_title: string | null;
  provider: string | null;
  storage_ref: string | null;
};

export type UniverseAssemblyMural = {
  master_id: string;
  title: string | null;
  scenes: UniverseAssemblyScene[];
  has_media: boolean;
  provider: string | null;
  storage_ref: string | null;
};

export type UniverseAssemblyMoment = {
  master_id: string;
  title: string | null;
  has_experience: boolean;
  scene_ids: string[];
  scene_titles: string[];
};

export type UniverseAssembly = {
  master_id: string;
  title: string | null;
  description: string | null;
  created_at: string;
  murals: UniverseAssemblyMural[];
  creative_moments: UniverseAssemblyMoment[];
};

export type UniverseAssemblyRows = {
  master: { master_id: string; created_at: string };
  presentation: { title: string | null; description: string | null } | null;
  muralMasters: { master_id: string }[];
  momentMasters: { master_id: string }[];
  sceneMasters: { master_id: string; parent_master_id: string | null; sort_order: number | null }[];
  presentations: { master_id: string; title: string | null }[];
  sceneProjections: { projection_id: string; master_id: string }[];
  muralProjections: { projection_id: string; master_id: string }[];
  momentProjections: { projection_id: string; master_id: string }[];
  bindings: {
    projection_id: string;
    start_ms: number | null;
    end_ms: number | null;
    asset_id?: string | null;
  }[];
  assets: { asset_id: string; provider: string | null; storage_ref: string }[];
  relations: { scene_master_id: string; moment_master_id: string }[];
};
