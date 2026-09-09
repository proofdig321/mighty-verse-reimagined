/**
 * Live canonical verification targets.
 *
 * These IDs come from `.mighty-verse/AGENT.md` and the linked Supabase project.
 * They are not test fixtures and must not be invented or mutated by QA.
 */

export type SceneMomentCanon = {
  key: "powerhouse" | "darkKnight" | "handToHand" | "swordMaster";
  shortName: string;
  sceneTitle: string;
  sceneDescription: string;
  sceneMasterId: string;
  projectionId: string;
  startMs: number;
  endMs: number;
  bindingId: string;
  creativeMomentId: string;
  creativeMomentTitle: string;
};

export const SCENE_MOMENTS = {
  powerhouse: {
    key: "powerhouse",
    shortName: "Powerhouse",
    sceneTitle: "Golden Shovel — Powerhouse",
    sceneDescription:
      "Golden Shovel's warrior manifestation within the Super Hero Ego Mural. Central city/skyline focal manifestation; powerhouse with spirit-avatar presence.",
    sceneMasterId: "4790c7cf-bb19-4a01-a243-e5c3eb680555",
    projectionId: "3039ca84-7e11-4eb6-8895-d16d13a899c3",
    startMs: 36000,
    endMs: 79000,
    bindingId: "6ca3869d-ca39-4422-bfd1-8b1353d64ea5",
    creativeMomentId: "3b0de6b4-2ca0-43c0-8561-7dc1c0697435",
    creativeMomentTitle: "Proverb",
  },
  darkKnight: {
    key: "darkKnight",
    shortName: "Dark Knight",
    sceneTitle: "Mothipa — Dark Knight",
    sceneDescription:
      "Mothipa's warrior manifestation within the Super Hero Ego Mural. Elevated/gargoyle rooftop manifestation; Dark Knight/aura presence.",
    sceneMasterId: "bebb65d2-21ed-4bc9-9fa0-a4857df30a43",
    projectionId: "bb802400-b385-4025-9bb8-63df53abd9be",
    startMs: 80000,
    endMs: 124000,
    bindingId: "9b8fbc44-5d1b-438f-9e4f-13ffe51d95fb",
    creativeMomentId: "32422bb4-d03c-465d-8348-942e49ae0051",
    creativeMomentTitle: "Mothipa",
  },
  handToHand: {
    key: "handToHand",
    shortName: "Hand-to-Hand",
    sceneTitle: "ProVerb — Hand-to-Hand",
    sceneDescription:
      "ProVerb's warrior manifestation within the Super Hero Ego Mural. Ground-level urban combat manifestation; hand-to-hand fighter.",
    sceneMasterId: "df15ec76-6bd8-4956-bbaa-755f72b2b8f8",
    projectionId: "9c045ea3-ab09-4a6f-b89c-02dce076b8da",
    startMs: 149000,
    endMs: 192000,
    bindingId: "1765324d-8f8a-42f2-93c3-a2a3fec1356e",
    creativeMomentId: "3b0de6b4-2ca0-43c0-8561-7dc1c0697435",
    creativeMomentTitle: "Proverb",
  },
  swordMaster: {
    key: "swordMaster",
    shortName: "Sword Master",
    sceneTitle: "Reason — Sword Master",
    sceneDescription:
      "Reason's warrior manifestation within the Super Hero Ego Mural. Elevated urban/rooftop combat manifestation; sword-master.",
    sceneMasterId: "65490a92-8faf-42ea-a391-0e6473360f5c",
    projectionId: "8100033e-4c7e-448f-8b9c-b9ff97fdc3fd",
    startMs: 193000,
    endMs: 254000,
    bindingId: "44130ab6-2dd9-49f0-b2aa-756b91550ece",
    creativeMomentId: "2745a50a-5417-4613-b23b-ef4857ab112e",
    creativeMomentTitle: "Reason",
  },
} as const satisfies Record<string, SceneMomentCanon>;

export const SIBLING_SCENE_MOMENTS = [
  SCENE_MOMENTS.powerhouse,
  SCENE_MOMENTS.darkKnight,
  SCENE_MOMENTS.handToHand,
] as const;

/** Canonical Creative Moments parented to Super Hero Ego Universe. */
export const CREATIVE_MOMENTS = {
  proverb: {
    masterId: "3b0de6b4-2ca0-43c0-8561-7dc1c0697435",
    title: "Proverb",
    projectionId: null as string | null,
  },
  mothipa: {
    masterId: "32422bb4-d03c-465d-8348-942e49ae0051",
    title: "Mothipa",
    projectionId: "718372da-4941-41d6-bb64-3a0b0812b047",
  },
  reason: {
    masterId: "2745a50a-5417-4613-b23b-ef4857ab112e",
    title: "Reason",
    projectionId: "89ba1c24-01c1-4bbd-8ed1-d48021600b71",
  },
} as const;

export function creativeMomentHref(cm: { masterId: string; projectionId: string | null }): string {
  return cm.projectionId ? `/moments/${cm.projectionId}` : `/creative-moments/${cm.masterId}`;
}

export const CANON = {
  universeId: "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc",
  universeTitle: "Super Hero Ego",
  universeDescription: "Golden Shovel ft Proverb, Reason and Mothipa",
  muralId: "a75ae8af-7b48-4b67-8392-d89447bae370",
  muralTitle: "Super Hero Ego",
  muxAssetId: "795c057e-2967-4e93-8f5e-06297c674cb0",
  muxPlaybackId: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4",
  muxThumbnailHost: "image.mux.com",
  muxStreamHost: "stream.mux.com",
  muralProjectionId: "2e68a8d6-6b15-4d16-a0d9-2ea290815f21",
  muralBindingId: "374f27cd-25b7-4379-b7d2-b0d324bdd14b",
  untitledUniverseId: "f11c3aba-2dcb-473a-b982-1b7442bd32b3",
  unboundLivepeerAssetId: "bda79051-6bc9-497f-b0aa-12d95130290c",
  swordMasterProjectionId: SCENE_MOMENTS.swordMaster.projectionId,
  swordMasterSceneTitle: SCENE_MOMENTS.swordMaster.sceneTitle,
  swordMasterStartMs: SCENE_MOMENTS.swordMaster.startMs,
  swordMasterEndMs: SCENE_MOMENTS.swordMaster.endMs,
  creativeMomentId: SCENE_MOMENTS.swordMaster.creativeMomentId,
  creativeMomentTitle: SCENE_MOMENTS.swordMaster.creativeMomentTitle,
  sceneTitles: [
    SCENE_MOMENTS.powerhouse.sceneTitle,
    SCENE_MOMENTS.darkKnight.sceneTitle,
    SCENE_MOMENTS.handToHand.sceneTitle,
    SCENE_MOMENTS.swordMaster.sceneTitle,
  ],
} as const;

export const ROUTES = {
  home: "/",
  universes: "/universes",
  /** Obsolete path — expected 404. Canonical public Universe pages are `/worlds/[id]`. */
  universeObsolete: `/universes/${CANON.universeId}`,
  /** Canonical public Universe page. There is no `/universes/[id]` route. */
  universeLive: `/worlds/${CANON.universeId}`,
  universeScenes: `/worlds/${CANON.universeId}/scenes`,
  universeHolographic: `/worlds/${CANON.universeId}/holographic`,
  experienceJourney: "/universes?intent=experience",
  muralLive: `/worlds/${CANON.muralId}`,
  moments: "/moments",
  creativeMomentProverb: `/creative-moments/${CREATIVE_MOMENTS.proverb.masterId}`,
  momentSwordMaster: `/moments/${CANON.swordMasterProjectionId}`,
  curate: "/authority/curate",
  authorityCurateHub: `/authority/curate/${CANON.universeId}`,
  authorityCurateSentinel: `/authority/curate/${CANON.universeId}/sentinel`,
  authorityCurateMural: `/authority/curate/${CANON.universeId}/mural`,
  authorityCurateMoment: `/authority/curate/${CANON.universeId}/moment`,
  authority: "/authority",
  authorityUniverses: "/authority/universes",
  authorityUniverseWorkspace: `/authority/universes/${CANON.universeId}`,
  authorityUniverseStoryboard: `/authority/universes/${CANON.universeId}/storyboard`,
  authorityUniverseSentinel: `/authority/universes/${CANON.universeId}/storyboard?source=sentinel`,
  authorityUniverseScenes: `/authority/universes/${CANON.universeId}/scenes`,
  authorityUniverseProduction: `/authority/universes/${CANON.universeId}/production`,
  authorityUniversePreview: `/authority/universes/${CANON.universeId}/preview`,
  authorityUniverseExperience: `/authority/universes/${CANON.universeId}/experience`,
  authorityUntitledUniverseWorkspace: `/authority/universes/${CANON.untitledUniverseId}`,
  authorityUniverseIdentity: `/authority/universes/${CANON.universeId}/identity`,
  authorityMedia: "/authority/media",
  authorityMuxAsset: `/authority/media/${CANON.muxAssetId}`,
  authorityUnboundAsset: `/authority/media/${CANON.unboundLivepeerAssetId}`,
  authorityMuxInspect: `/authority/media/inspect?assetId=${CANON.muxAssetId}`,
  authorityUnboundInspect: `/authority/media/inspect?assetId=${CANON.unboundLivepeerAssetId}`,
  authorityCurateMuxAsset: `/authority/curate?asset=${CANON.muxAssetId}`,
  authorityCurateUnboundAsset: `/authority/curate?asset=${CANON.unboundLivepeerAssetId}`,
  editor: "/editor",
  signIn: "/auth/sign-in",
  authorityCreate: "/authority/create",
} as const;
