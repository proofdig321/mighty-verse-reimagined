/**
 * Curate Hub — derived presentation of live canonical state.
 *
 * Not a workflow-state table. Not a second Create Work wizard.
 * Rows and next action are computed from Universe assembly, upload sessions,
 * and inspection evidence that already exist.
 */
import { classifyProcessingPhase } from "../media/processing-state";
import {
  CURATE_STUDIO_HREF,
  creativeSuiteHref,
  creativeSuiteScenesHref,
  curateHubHref,
  curateIncomingHref,
  curateMomentHref,
  curateMuralHref,
  curateSentinelHref,
  mediaInspectHref,
} from "./studio";
import { suiteScenes } from "./suite";
import type { UniverseAssembly } from "./types";

export type CurateHubRowKey =
  | "universe"
  | "source_media"
  | "sentinel"
  | "mural"
  | "scenes"
  | "creative_moments"
  | "composition"
  | "experience";

export type CurateHubTone = "complete" | "attention" | "pending" | "processing";

export type CurateHubRow = {
  key: CurateHubRowKey;
  label: string;
  tone: CurateHubTone;
  summary: string;
  href?: string;
  actionLabel?: string;
};

export type CurateHubNextAction = {
  title: string;
  body: string;
  href: string;
  label: string;
};

export type CurateHubSnapshot = {
  universeId: string;
  universeTitle: string;
  rows: CurateHubRow[];
  nextAction: CurateHubNextAction;
  processingNote: string | null;
  muralRegistered: boolean;
};

export type CurateHubSession = {
  session_id: string;
  phase: string;
  asset_id: string | null;
  updated_at: string;
};

export type CurateHubInput = {
  assembly: UniverseAssembly;
  sessions: CurateHubSession[];
  inspectCount: number;
  incomingAssetId?: string | null;
  boundAssetId?: string | null;
};

function latestSession(sessions: CurateHubSession[]) {
  return [...sessions].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] ?? null;
}

function studioHref(universeId: string) {
  return creativeSuiteHref(universeId, "curate");
}

export function deriveCurateHub(input: CurateHubInput): CurateHubSnapshot {
  const { assembly, inspectCount } = input;
  const universeId = assembly.master_id;
  const universeTitle = assembly.title ?? "Untitled universe";
  const session = latestSession(input.sessions);
  const mural = assembly.murals[0] ?? null;
  const scenes = suiteScenes(assembly);
  const sceneCount = scenes.length;
  const momentCount = assembly.creative_moments.length;
  const presenceCount = assembly.creative_moments.reduce(
    (count, moment) => count + moment.scene_ids.length,
    0,
  );
  const bound =
    Boolean(mural?.has_media) || scenes.some((scene) => Boolean(scene.asset_id));
  const boundAssetId = input.boundAssetId ?? scenes.find((scene) => scene.asset_id)?.asset_id ?? null;
  const incomingAssetId = input.incomingAssetId ?? null;
  const inspectAssetId = boundAssetId ?? incomingAssetId;

  const phase = session?.phase ?? null;
  const phaseKind = phase ? classifyProcessingPhase(phase) : null;
  const processing = Boolean(phase) && phaseKind === "in_progress";
  const failed = phaseKind === "failed";
  const ingestedUnbound =
    !bound && (phaseKind === "ingested" || Boolean(incomingAssetId));

  const sourceRow: CurateHubRow = bound
    ? {
        key: "source_media",
        label: "Source media",
        tone: "complete",
        summary: "Attached to this Universe.",
        href: boundAssetId ? `/authority/${encodeURIComponent(boundAssetId)}` : curateHubHref(universeId),
        actionLabel: "Open asset",
      }
    : processing
      ? {
          key: "source_media",
          label: "Source media",
          tone: "processing",
          summary:
            phase === "processing"
              ? "Provider is processing the upload. You can leave this workspace."
              : phase === "uploading"
                ? "Upload in progress."
                : "Upload registered. Waiting for the file to arrive.",
        }
      : failed
        ? {
            key: "source_media",
            label: "Source media",
            tone: "attention",
            summary: "The provider reported a processing failure. The canonical work is preserved.",
            href: `/authority/${universeId}`,
            actionLabel: "Open work record",
          }
        : ingestedUnbound
          ? {
              key: "source_media",
              label: "Source media",
              tone: "attention",
              summary: "Ingested and waiting for curator attachment.",
              href: incomingAssetId
                ? curateIncomingHref(incomingAssetId)
                : CURATE_STUDIO_HREF,
              actionLabel: "Attach media",
            }
          : {
              key: "source_media",
              label: "Source media",
              tone: "pending",
              summary: "No source media is attached yet.",
              href: "/authority/media/intake",
              actionLabel: "Add media",
            };

  const sentinelRow: CurateHubRow =
    inspectCount > 0
      ? {
          key: "sentinel",
          label: "Sentinel",
          tone: sceneCount === 0 ? "attention" : "complete",
          summary:
            sceneCount === 0
              ? "Evidence is available. Review candidates before establishing canonical Scenes."
              : "Evidence is on record. Canonical Scenes already exist.",
          href: curateSentinelHref(universeId),
          actionLabel: sceneCount === 0 ? "Establish Scene" : "Open Sentinel",
        }
      : {
          key: "sentinel",
          label: "Sentinel",
          tone: bound || incomingAssetId ? "attention" : "pending",
          summary:
            bound || incomingAssetId
              ? "Source is present. Persist an inspect so Sentinel evidence can inform Scene work."
              : "Sentinel needs source media first.",
          href: inspectAssetId ? mediaInspectHref(inspectAssetId) : undefined,
          actionLabel: inspectAssetId ? "Inspect source" : undefined,
        };

  const muralRow: CurateHubRow = mural
    ? {
        key: "mural",
        label: "Mural",
        tone: "complete",
        summary: `Registered: ${mural.title ?? "Mural"}.`,
        href: studioHref(universeId),
        actionLabel: "Open in Studio",
      }
    : {
        key: "mural",
        label: "Mural",
        tone: "attention",
        summary: "No Mural is registered for this Universe yet. Registration is canonical, not minting.",
        href: curateMuralHref(universeId),
        actionLabel: "Register Mural",
      };

  const scenesRow: CurateHubRow =
    sceneCount > 0
      ? {
          key: "scenes",
          label: "Scenes",
          tone: "complete",
          summary: `${sceneCount} canonical Scene${sceneCount === 1 ? "" : "s"} established.`,
          href: creativeSuiteScenesHref(universeId, "curate"),
          actionLabel: "Review timing",
        }
      : {
          key: "scenes",
          label: "Scenes",
          tone: inspectCount > 0 ? "attention" : "pending",
          summary:
            inspectCount > 0
              ? "Sentinel candidates are ready for human authorisation into canonical Scenes."
              : "No canonical Scenes yet.",
          href: curateSentinelHref(universeId),
          actionLabel: "Establish Scene",
        };

  const momentsRow: CurateHubRow =
    momentCount > 0
      ? {
          key: "creative_moments",
          label: "Creative Moments",
          tone: presenceCount > 0 ? "complete" : "attention",
          summary:
            presenceCount > 0
              ? `${momentCount} Creative Moment${momentCount === 1 ? "" : "s"}, ${presenceCount} Scene presence${presenceCount === 1 ? "" : "s"}.`
              : `${momentCount} Creative Moment${momentCount === 1 ? "" : "s"} exist, but none are present in a Scene yet.`,
          href: creativeSuiteScenesHref(universeId, "curate"),
          actionLabel: presenceCount > 0 ? "Review presence" : "Place in Scenes",
        }
      : {
          key: "creative_moments",
          label: "Creative Moments",
          tone: "pending",
          summary: "No Creative Moments are registered on this Universe.",
          href: curateMomentHref(universeId),
          actionLabel: "Add Creative Moment",
        };

  const compositionRow: CurateHubRow = {
    key: "composition",
    label: "Composition",
    tone: mural && sceneCount > 0 ? "complete" : "pending",
    summary:
      mural && sceneCount > 0
        ? "Canonical assembly is ready for precision authoring in Creative Studio."
        : "Creative Studio needs a Mural and Scenes before composition is meaningful.",
    href: studioHref(universeId),
    actionLabel: "Open Creative Studio",
  };

  const experienceRow: CurateHubRow = bound
    ? {
        key: "experience",
        label: "Experience",
        tone: "complete",
        summary: "Public presentation is reachable from this work.",
        href: `/worlds/${universeId}`,
        actionLabel: "Preview Experience",
      }
    : {
        key: "experience",
        label: "Experience",
        tone: "pending",
        summary: "Experience waits until source media is attached.",
      };

  const nextAction = resolveNextAction({
    universeId,
    universeTitle,
    bound,
    boundAssetId,
    mural: Boolean(mural),
    processing,
    failed,
    ingestedUnbound,
    inspectCount,
    sceneCount,
    momentCount,
    presenceCount,
    incomingAssetId,
  });

  return {
    universeId,
    universeTitle,
    rows: [
      {
        key: "universe",
        label: "Universe",
        tone: "complete",
        summary: "Canonical work is established.",
        href: `/authority/${universeId}`,
        actionLabel: "Open record",
      },
      sourceRow,
      sentinelRow,
      muralRow,
      scenesRow,
      momentsRow,
      compositionRow,
      experienceRow,
    ],
    nextAction,
    processingNote: processing && !bound
      ? "Source media is still with the provider. You can leave this workspace. We will preserve the work state."
      : null,
    muralRegistered: Boolean(mural),
  };
}

function resolveNextAction(input: {
  universeId: string;
  universeTitle: string;
  bound: boolean;
  boundAssetId: string | null;
  mural: boolean;
  processing: boolean;
  failed: boolean;
  ingestedUnbound: boolean;
  inspectCount: number;
  sceneCount: number;
  momentCount: number;
  presenceCount: number;
  incomingAssetId: string | null;
}): CurateHubNextAction {
  const { universeId } = input;

  if (input.processing && !input.bound) {
    return {
      title: "Processing source media",
      body: "You can leave this workspace. We'll preserve the work state and continue when the provider is ready.",
      href: curateHubHref(universeId),
      label: "Stay with this work",
    };
  }

  if (input.failed && !input.bound) {
    return {
      title: "Resume this work",
      body: "Provider processing failed. Retry against the existing Universe — do not create another one.",
      href: `/authority/${universeId}`,
      label: "Open work record",
    };
  }

  if (input.ingestedUnbound) {
    const href = input.incomingAssetId
      ? curateIncomingHref(input.incomingAssetId)
      : CURATE_STUDIO_HREF;
    return {
      title: "Source media ready",
      body: "Attach it to the appropriate canonical expression. Media is not the Universe.",
      href,
      label: "Attach media",
    };
  }

  if (!input.mural) {
    return {
      title: "Register a Mural",
      body: "A Mural is the complete audiovisual expression of this Universe. Registration is canonical, not minting.",
      href: curateMuralHref(universeId),
      label: "Register Mural",
    };
  }

  if (!input.bound) {
    return {
      title: "Attach source media",
      body: "This Universe has a Mural, but source media is not bound yet.",
      href: "/authority/media/intake",
      label: "Add media",
    };
  }

  if (input.sceneCount === 0 && input.inspectCount === 0 && input.boundAssetId) {
    return {
      title: "Inspect the source",
      body: "Persist Sentinel evidence before treating visual beats as canonical Scenes.",
      href: mediaInspectHref(input.boundAssetId),
      label: "Open Sentinel inspect",
    };
  }

  if (input.sceneCount === 0) {
    return {
      title: "Establish canonical Scenes",
      body: "Sentinel may propose candidates. You authorise the canonical windows.",
      href: curateSentinelHref(universeId),
      label: "Establish Scene",
    };
  }

  if (input.momentCount === 0) {
    return {
      title: "Add a Creative Moment",
      body: "Creative Moments are contributor-centred units parented to the Universe, not owned by the Mural.",
      href: curateMomentHref(universeId),
      label: "Add Creative Moment",
    };
  }

  if (input.presenceCount === 0) {
    return {
      title: "Place Creative Moments in Scenes",
      body: "Scene presence is authored in Creative Studio. Candidate observations are not canonical until you decide.",
      href: studioHref(universeId),
      label: "Open Creative Studio",
    };
  }

  return {
    title: "Continue in Creative Studio",
    body: `${input.universeTitle} has canonical structure. Compose timing, presence, and the 2D / 2.5D preview.`,
    href: studioHref(universeId),
    label: "Open Creative Studio",
  };
}
