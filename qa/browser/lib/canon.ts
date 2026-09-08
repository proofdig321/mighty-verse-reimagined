/**
 * Live canonical verification targets.
 *
 * These IDs come from `.mighty-verse/AGENT.md` and the linked Supabase project.
 * They are not test fixtures and must not be invented or mutated by QA.
 */

export const CANON = {
  universeId: "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc",
  universeTitle: "Super Hero Ego",
  muralId: "a75ae8af-7b48-4b67-8392-d89447bae370",
  muralTitle: "Super Hero Ego",
  muxAssetId: "795c057e-2967-4e93-8f5e-06297c674cb0",
  muxPlaybackId: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4",
  muxThumbnailHost: "image.mux.com",
  muxStreamHost: "stream.mux.com",
  swordMasterProjectionId: "8100033e-4c7e-448f-8b9c-b9ff97fdc3fd",
  swordMasterSceneTitle: "Reason — Sword Master",
  swordMasterStartMs: 193000,
  swordMasterEndMs: 254000,
  sceneTitles: [
    "Golden Shovel — Powerhouse",
    "Mothipa — Dark Knight",
    "ProVerb — Hand-to-Hand",
    "Reason — Sword Master",
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
  muralLive: `/worlds/${CANON.muralId}`,
  moments: "/moments",
  momentSwordMaster: `/moments/${CANON.swordMasterProjectionId}`,
  curate: "/authority/curate",
  editor: "/editor",
  signIn: "/auth/sign-in",
} as const;
