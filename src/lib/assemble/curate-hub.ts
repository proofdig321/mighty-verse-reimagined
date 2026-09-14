/**
 * Curate Hub — derived presentation of live canonical state.
 *
 * Not a workflow-state table. Not a second Create Work wizard.
 * Rows and next action are computed from Universe assembly, upload sessions,
 * and inspection evidence that already exist.
 */
import { classifyProcessingPhase } from "../media/processing-state";
import {
  creativeSuiteHref,
  creativeSuiteIdentityHref,
  creativeSuiteScenesHref,
  curateAttachHref,
  curateHubHref,
  curateMomentHref,
  curateMuralHref,
  curateSentinelHref,
} from "./studio";
import { suiteScenes } from "./suite";
import type { UniverseAssembly } from "./types";
import {
  classifyUniverseOccupancy,
  occupancyLabel,
  type UniverseOccupancy,
} from "./occupancy";
import { isProtectedMaster } from "./protected-work";

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
  occupancy: UniverseOccupancy;
  occupancyLabel: string;
  identityHref: string;
  withdrawable: boolean;
  incomingAssetId: string | null;
  boundAssetId: string | null;
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
  currentStateId?: string | null;
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
  const boundAssetId =
    input.boundAssetId ?? mural?.asset_id ?? scenes.find((scene) => scene.asset_id)?.asset_id ?? null;
  const incomingAssetId = input.incomingAssetId ?? null;
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
        summary: "Attached to this Universe. ISRC, technical identity, and Replace media live on the media and work records — not on the public page.",
        href: boundAssetId ? `/authority/media/${encodeURIComponent(boundAssetId)}` : `/authority/${universeId}`,
        actionLabel: boundAssetId ? "Open media record" : "Open work record",
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
              summary: mural
                ? "Ingested and waiting for curator attachment to this Universe's Mural."
                : "Ingested and waiting. Register a Mural for this Universe before attaching — do not attach it to another work.",
              href: mural ? curateAttachHref(universeId) : curateMuralHref(universeId),
              actionLabel: mural ? "Attach media" : "Register Mural first",
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
    bound || incomingAssetId
      ? sceneCount === 0
        ? {
            key: "sentinel",
            label: "Sentinel",
            tone: "attention",
            summary:
              inspectCount > 0
                ? "Evidence is available. You still name Intro, Verse, Hook windows and set start/end before Accept as Scene."
                : "Name Intro, Verse 1, Hook, Verse 2 windows and set start/end on the mural. Visual inspection is optional evidence — it does not create Scenes.",
            href: curateSentinelHref(universeId),
            actionLabel: "Establish Scene",
          }
        : {
            key: "sentinel",
            label: "Sentinel",
            tone: "complete",
            summary:
              inspectCount > 0
                ? "Evidence is on record. Canonical Scenes already exist."
                : "Canonical Scenes exist. Sentinel can still retain stills and adjust windows.",
            href: curateSentinelHref(universeId),
            actionLabel: "Open Sentinel",
          }
      : {
          key: "sentinel",
          label: "Sentinel",
          tone: "pending",
          summary: "Sentinel needs source media first.",
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
  });

  const occupancy = classifyUniverseOccupancy({
    title: assembly.title,
    currentStateId: input.currentStateId ?? "present",
    muralHasPlayableMedia: bound,
    hasSourceMedia: bound || ingestedUnbound || processing,
  });

  return {
    universeId,
    universeTitle,
    occupancy,
    occupancyLabel: occupancyLabel(occupancy),
    identityHref: creativeSuiteIdentityHref(universeId, "curate"),
    withdrawable: occupancy !== "withdrawn" && !isProtectedMaster(universeId),
    incomingAssetId,
    boundAssetId,
    rows: [
      {
        key: "universe",
        label: "Universe",
        tone: "complete",
        summary: "Canonical work is established. Title, description, rights, and Replace media live on this record.",
        href: `/authority/${universeId}`,
        actionLabel: "Edit metadata",
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

  if (!input.mural) {
    return {
      title: "Register a Mural",
      body: input.ingestedUnbound
        ? "A Mural is the audiovisual expression of this Universe. Register it first. Ingested media waits for that Mural — do not attach it to another work. Registration is canonical, not minting."
        : "A Mural is the complete audiovisual expression of this Universe. Registration is canonical, not minting.",
      href: curateMuralHref(universeId),
      label: "Register Mural",
    };
  }

  if (input.ingestedUnbound) {
    return {
      title: "Attach this media",
      body: "Bind the ingested source to this Universe's Mural. Do not attach it to Super Hero Ego or another work.",
      href: curateAttachHref(universeId),
      label: "Attach media",
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

  if (input.sceneCount === 0) {
    return {
      title: "Establish canonical Scenes",
      body: "Sentinel observes the mural. You name each window (Intro, Verse 1, Hook, Verse 2…) and set start/end. Sentinel does not auto-create Scenes.",
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
