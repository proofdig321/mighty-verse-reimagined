/**
 * Creative Suite production path.
 *
 * Derived from live assembly + Sentinel intelligence. Not a workflow-state
 * table and not a linear wizard. Curators can jump to any ready stage.
 *
 * SOURCE → SENTINEL → STORYBOARD → SCENE PROPOSALS → AUTHORISE → 2.5D PREVIEW → EXPERIENCE
 */

import type { SentinelIntelligence } from "../media/sentinel-intelligence";
import { suiteScenes } from "./suite";
import type { UniverseAssembly } from "./types";

export const PRODUCTION_PATH_STEPS = [
  { id: "source", label: "Source", fragment: "universe-source" },
  { id: "sentinel", label: "Sentinel", fragment: "universe-sentinel" },
  { id: "storyboard", label: "Storyboard", fragment: "sentinel-storyboard" },
  { id: "proposals", label: "Scene proposals", fragment: "sentinel-proposals" },
  { id: "authorise", label: "Authorise", fragment: "sentinel-authorise" },
  { id: "preview", label: "2.5D Preview", fragment: "universe-preview" },
  { id: "experience", label: "Experience", fragment: "universe-experience-continuation" },
] as const;

export type ProductionStepId = (typeof PRODUCTION_PATH_STEPS)[number]["id"];

export type ProductionStepStatus = "waiting" | "ready" | "attention" | "canonical";

export type ProductionPathStep = {
  id: ProductionStepId;
  label: string;
  fragment: string;
  href: string;
  status: ProductionStepStatus;
};

export type ProductionPathInput = {
  suiteHref: string;
  hasMural: boolean;
  hasSourceMedia: boolean;
  observationCount: number;
  storyboardCount: number;
  proposalCount: number;
  adjustCount: number;
  holographicCount: number;
};

export function productionPathInputFrom(
  assembly: UniverseAssembly,
  intelligence: SentinelIntelligence | null,
  suiteHref: string,
): ProductionPathInput {
  const scenes = suiteScenes(assembly);
  return {
    suiteHref,
    hasMural: assembly.murals.length > 0,
    hasSourceMedia: Boolean(scenes.find((scene) => scene.asset_id) || assembly.murals.some((mural) => mural.has_media)),
    observationCount: intelligence?.observation_count ?? 0,
    storyboardCount: intelligence?.storyboard.length ?? 0,
    proposalCount: intelligence?.proposals.length ?? 0,
    adjustCount: intelligence?.proposals.filter((proposal) => proposal.status === "adjust").length ?? 0,
    holographicCount: intelligence?.holographic.length ?? 0,
  };
}

export function deriveProductionPath(input: ProductionPathInput): ProductionPathStep[] {
  return PRODUCTION_PATH_STEPS.map((step) => {
    let status: ProductionStepStatus = "waiting";
    if (step.id === "source") {
      status = input.hasSourceMedia ? "ready" : input.hasMural ? "waiting" : "waiting";
    } else if (step.id === "sentinel") {
      status = input.observationCount > 0 ? "ready" : "waiting";
    } else if (step.id === "storyboard") {
      status = input.storyboardCount > 0 ? "ready" : "waiting";
    } else if (step.id === "proposals") {
      status = input.adjustCount > 0 ? "attention" : input.proposalCount > 0 ? "canonical" : "waiting";
    } else if (step.id === "authorise") {
      status = input.adjustCount > 0 ? "attention" : input.proposalCount > 0 ? "canonical" : "waiting";
    } else if (step.id === "preview") {
      status = input.holographicCount > 0 ? "ready" : "waiting";
    } else if (step.id === "experience") {
      status = input.hasMural ? "ready" : "waiting";
    }
    return {
      id: step.id,
      label: step.label,
      fragment: step.fragment,
      href: `${input.suiteHref}#${step.fragment}`,
      status,
    };
  });
}

export function productionStepStatusLabel(status: ProductionStepStatus): string {
  if (status === "attention") return "Needs authorisation";
  if (status === "canonical") return "Canonical";
  if (status === "ready") return "Ready";
  return "Waiting";
}
