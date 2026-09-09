import { deriveCurateHub } from "../curate-hub";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const ASSET = "795c057e-2967-4e93-8f5e-06297c674cb0";
const FR = "e22e080c-715c-4045-ba82-20474d25b2e0";
const FR_ASSET = "5f85a6f1-0000-4000-8000-000000000001";

const sheAssembly = {
  master_id: UNIVERSE,
  title: "Super Hero Ego",
  description: null,
  created_at: "2026-08-19T00:00:00Z",
  murals: [
    {
      master_id: MURAL,
      title: "Super Hero Ego",
      has_media: true,
      provider: "mux",
      storage_ref: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4",
      scenes: [
        {
          master_id: POWERHOUSE,
          title: "Golden Shovel — Powerhouse",
          description: null,
          sort_order: 1,
          start_ms: 36000,
          end_ms: 79000,
          binding_id: null,
          projection_id: null,
          asset_id: ASSET,
          creative_moments: [{ master_id: "cm-proverb", title: "Proverb" }],
          creative_moment_id: "cm-proverb",
          creative_moment_title: "Proverb",
          provider: "mux",
          storage_ref: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4",
        },
      ],
    },
  ],
  creative_moments: [
    {
      master_id: "cm-proverb",
      title: "Proverb",
      description: null,
      has_experience: false,
      scene_ids: [POWERHOUSE],
      scene_titles: ["Golden Shovel — Powerhouse"],
    },
  ],
};

const she = deriveCurateHub({
  assembly: sheAssembly,
  sessions: [],
  inspectCount: 2,
  boundAssetId: ASSET,
});

assert(she.universeTitle === "Super Hero Ego", "SHE title comes from live assembly");
assert(she.nextAction.label === "Open Creative Studio", "complete SHE continues in Studio, not Create Work");
assert(she.nextAction.href.includes(`/authority/universes/${UNIVERSE}`), "Studio continuation stays on SHE");
assert(she.rows.find((row) => row.key === "mural")?.tone === "complete", "registered mural is complete, not minted");
assert(!she.rows.some((row) => /mint/i.test(`${row.summary}${row.actionLabel ?? ""}`)), "hub never says mint");
assert(she.rows.find((row) => row.key === "source_media")?.tone === "complete", "bound Mux media is attached");
assert(she.rows.find((row) => row.key === "experience")?.href === `/worlds/${UNIVERSE}`, "experience stays public");
assert(she.processingNote === null, "attached work is not processing");

const processing = deriveCurateHub({
  assembly: {
    master_id: FR,
    title: "Father Raymond",
    description: null,
    created_at: "2026-09-09T00:00:00Z",
    murals: [],
    creative_moments: [],
  },
  sessions: [
    {
      session_id: "7fa7c456-0000-4000-8000-000000000001",
      phase: "processing",
      asset_id: null,
      updated_at: "2026-09-09T12:00:00Z",
    },
  ],
  inspectCount: 0,
});
assert(processing.nextAction.title === "Processing source media", "processing is the next action");
assert(processing.rows.find((row) => row.key === "source_media")?.tone === "processing", "source row is processing");
assert(processing.processingNote?.includes("leave this workspace"), "processing note lets the curator leave");
assert(!processing.nextAction.href.includes(UNIVERSE), "FR processing does not open Super Hero Ego");

const ingested = deriveCurateHub({
  assembly: {
    master_id: FR,
    title: "Father Raymond",
    description: null,
    created_at: "2026-09-09T00:00:00Z",
    murals: [],
    creative_moments: [],
  },
  sessions: [
    {
      session_id: "7fa7c456-0000-4000-8000-000000000001",
      phase: "ingested",
      asset_id: FR_ASSET,
      updated_at: "2026-09-09T12:00:00Z",
    },
  ],
  inspectCount: 0,
  incomingAssetId: FR_ASSET,
});
assert(ingested.nextAction.title === "Source media ready", "ingested unbound media asks for attachment");
assert(ingested.nextAction.label === "Attach media", "attachment is curator work");
assert(ingested.rows.find((row) => row.key === "mural")?.actionLabel === "Register Mural", "unregistered mural is register, not mint");
assert(ingested.nextAction.href.includes(FR), "FR ingested work stays on Father Raymond");

const noScenes = deriveCurateHub({
  assembly: {
    ...sheAssembly,
    murals: [{ ...sheAssembly.murals[0], scenes: [] }],
    creative_moments: [],
  },
  sessions: [],
  inspectCount: 3,
  boundAssetId: ASSET,
});
assert(noScenes.nextAction.label === "Establish Scene", "evidence without scenes needs human authorisation");
assert(noScenes.nextAction.href.includes("#establish-scene"), "scene establishment stays in Curate");

const noMoments = deriveCurateHub({
  assembly: {
    ...sheAssembly,
    creative_moments: [],
    murals: [
      {
        ...sheAssembly.murals[0],
        scenes: [
          {
            ...sheAssembly.murals[0].scenes[0],
            creative_moments: [],
            creative_moment_id: null,
            creative_moment_title: null,
          },
        ],
      },
    ],
  },
  sessions: [],
  inspectCount: 1,
  boundAssetId: ASSET,
});
assert(noMoments.nextAction.label === "Add Creative Moment", "scenes without moments stay in Curate");
assert(noMoments.nextAction.href.includes("#register-moment"), "moment registration is contextual, not Create Work");

console.log("curate-hub.test.mjs: ok");
