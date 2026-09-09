/**
 * Scene-centric production plan.
 *
 * Derived from live assembly + Sentinel intelligence + curated references.
 * Not a workflow-state table. Not a generated video. Not canonical truth.
 *
 * AI/MCP may later read this brief. Humans authorise. Mighty Verse records.
 */

import { formatTimelineMs } from "../media/timing";
import type { SentinelIntelligence } from "../media/sentinel-intelligence";
import { suiteScenes, type SuiteScene } from "../assemble/suite";
import type { UniverseAssembly } from "../assemble/types";
import type { ReferenceRole } from "./lifecycle";
import type { ProductionApproval } from "./result";

export type CuratedReference = {
  asset_id: string;
  title: string;
  role: ReferenceRole;
  time_ms: number;
  still_url: string | null;
  scene_master_id: string | null;
  moment_master_id: string | null;
  source_asset_id: string;
  panel_id: string | null;
};

export type SceneProductionResultCard = {
  asset_id: string;
  scene_master_id: string;
  mux_asset_id: string;
  playback_id: string;
  still_url: string | null;
  approval: ProductionApproval;
  attached: boolean;
  executor: string | null;
};

export type SceneProductionBrief = {
  scene_master_id: string;
  title: string | null;
  start_ms: number | null;
  end_ms: number | null;
  moments: { master_id: string; title: string | null }[];
  storyboard_count: number;
  storyboard_titles: string[];
  references: CuratedReference[];
  visual_intention: string;
  motion: string;
  transition: string;
  output_target: string;
  provider_target: "unassigned";
  execution: "not_connected";
  result: SceneProductionResultCard | null;
  approval: ProductionApproval | null;
  projects: boolean;
  realization: null;
  status: "planning" | "awaiting_approval" | "approved" | "rejected";
  window_label: string;
};

function motionLanguage(motion: string | undefined): { visual: string; motion: string; transition: string } {
  if (motion === "power") {
    return {
      visual: "Heroic performance environment (derived from Sentinel animation plan).",
      motion: "Camera push / subject emphasis.",
      transition: "Cut entry from previous Scene.",
    };
  }
  if (motion === "aura") {
    return {
      visual: "Atmospheric presence environment (derived from Sentinel animation plan).",
      motion: "Aura hold / environmental drift.",
      transition: "Dissolve or cut depending on gap.",
    };
  }
  if (motion === "combat") {
    return {
      visual: "Subject-emphasis combat environment (derived from Sentinel animation plan).",
      motion: "Subject emphasis / environmental motion.",
      transition: "Cut through adjacent Scene gap.",
    };
  }
  if (motion === "mastery") {
    return {
      visual: "Elevated mastery environment (derived from Sentinel animation plan).",
      motion: "Hold / subject mastery.",
      transition: "Dissolve exit unless the next Scene is adjacent.",
    };
  }
  return {
    visual: "Canonical Scene treatment. No additional visual instruction yet.",
    motion: "Hold.",
    transition: "Unspecified.",
  };
}

function briefStatus(result: SceneProductionResultCard | null): SceneProductionBrief["status"] {
  if (!result) return "planning";
  if (result.approval === "approved") return "approved";
  if (result.approval === "rejected") return "rejected";
  return "awaiting_approval";
}

export function deriveSceneProductionBriefs(
  assembly: UniverseAssembly,
  intelligence: SentinelIntelligence | null,
  references: CuratedReference[] = [],
  results: SceneProductionResultCard[] = [],
): SceneProductionBrief[] {
  const scenes = suiteScenes(assembly);
  return scenes.map((scene: SuiteScene) => {
    const animation = intelligence?.animation.find((beat) => beat.scene_master_id === scene.master_id) ?? null;
    const language = motionLanguage(animation?.motion);
    const storyboard = (intelligence?.storyboard ?? []).filter(
      (panel) => panel.scene_master_id === scene.master_id,
    );
    const sceneRefs = references.filter((reference) => reference.scene_master_id === scene.master_id);
    const result = results.find((entry) => entry.scene_master_id === scene.master_id) ?? null;
    return {
      scene_master_id: scene.master_id,
      title: scene.title,
      start_ms: scene.start_ms,
      end_ms: scene.end_ms,
      moments: scene.creative_moments,
      storyboard_count: storyboard.length,
      storyboard_titles: storyboard.map((panel) => panel.title),
      references: sceneRefs,
      visual_intention: language.visual,
      motion: animation ? `${animation.enter} in / ${animation.exit} out · ${animation.motion}` : language.motion,
      transition: language.transition,
      output_target: "2.5D Scene plane / public Experience",
      provider_target: "unassigned",
      execution: "not_connected",
      result,
      approval: result?.approval ?? null,
      projects: result?.attached === true && result.approval === "approved",
      realization: null,
      status: briefStatus(result),
      window_label:
        scene.start_ms != null && scene.end_ms != null
          ? `${formatTimelineMs(scene.start_ms)} → ${formatTimelineMs(scene.end_ms)}`
          : "No canonical window",
    };
  });
}
