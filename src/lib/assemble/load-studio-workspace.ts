import { cache } from "react";
import { loadUniverseAssembly } from "./load-universe";
import { loadSentinelIntelligence } from "./load-sentinel-intelligence";
import { loadSuiteSourcePreview } from "./load-source-preview";
import { loadUniverseReferences } from "./load-references";
import { loadUniverseProductionResults } from "./load-production";
import { deriveProductionPath, productionPathInputFrom } from "./workflow";
import { deriveSceneProductionBriefs } from "../production/plan";
import { isFfmpegProofExecutor } from "../production/adapter";
import { productionLayersFromResults } from "../production/projection";
import { creativeSuiteHref } from "./studio";
import { suiteScenes } from "./suite";
import type { UniverseAssembly } from "./types";
import type { SentinelIntelligence } from "../media/sentinel-intelligence";
import type { SuiteSourcePreview } from "./load-source-preview";
import type { ProductionPathStep } from "./workflow";
import type { SceneProductionBrief } from "../production/plan";
import type { ApprovedProductionLayer } from "../production/projection";
import type { LoadedProductionResult } from "./load-production";
import type { CuratedReference } from "../production/plan";

export type StudioWorkspace = {
  data: UniverseAssembly;
  intelligence: SentinelIntelligence | null;
  source: SuiteSourcePreview | null;
  references: CuratedReference[];
  productionResults: LoadedProductionResult[];
  productionPath: ProductionPathStep[];
  productionBriefs: SceneProductionBrief[];
  productionLayers: ApprovedProductionLayer[];
  inspectAssetId: string | null;
  proofExecutorAvailable: boolean;
  fromCurate: boolean;
  suiteHref: string;
};

export const loadStudioWorkspace = cache(async function loadStudioWorkspace(
  masterId: string,
  fromCurate = false,
): Promise<StudioWorkspace | null> {
  const data = await loadUniverseAssembly(masterId);
  if (!data) return null;

  const [intelligence, source, references, productionResults] = await Promise.all([
    loadSentinelIntelligence(data),
    loadSuiteSourcePreview(data),
    loadUniverseReferences(data.master_id),
    loadUniverseProductionResults(data.master_id),
  ]);

  const suiteHref = creativeSuiteHref(data.master_id, fromCurate ? "curate" : null);
  const inspectAssetId =
    suiteScenes(data).find((scene) => scene.asset_id)?.asset_id ?? null;

  return {
    data,
    intelligence,
    source,
    references,
    productionResults,
    productionPath: deriveProductionPath(productionPathInputFrom(data, intelligence, suiteHref)),
    productionBriefs: deriveSceneProductionBriefs(data, intelligence, references, productionResults),
    productionLayers: productionLayersFromResults(productionResults),
    inspectAssetId,
    proofExecutorAvailable: isFfmpegProofExecutor(process.env.MV_PRODUCTION_PROOF_EXECUTOR),
    fromCurate,
    suiteHref,
  };
});
