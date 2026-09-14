import { resolveSuiteSourceAssetId } from "../source-preview";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const FR = "e22e080c-715c-4045-ba82-20474d25b2e0";
const FR_MURAL = "14938419-9477-431a-be04-511b1e205bbd";
const FR_ASSET = "5f85a6f1-1f2a-4da7-af9b-8467e58d3b9c";
const SHE_ASSET = "795c057e-2967-4e93-8f5e-06297c674cb0";

const fatherRaymond = {
  master_id: FR,
  title: "Father Raymond - Golden Shovel feat Reverb 360",
  description: null,
  created_at: "2026-09-14T00:00:00Z",
  murals: [
    {
      master_id: FR_MURAL,
      title: "Father Raymond - Golden Shovel feat Reverb 360",
      scenes: [],
      has_media: true,
      asset_id: FR_ASSET,
      provider: "mux",
      storage_ref: "014sJhmHHRL2g52G14xG00L6MTyq4zvunCsZtFStk4Wds",
    },
  ],
  creative_moments: [],
};

assert(
  resolveSuiteSourceAssetId(fatherRaymond) === FR_ASSET,
  "Father Raymond Experience clocks the Mural Mux when there are no Scenes",
);

const she = {
  master_id: "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc",
  title: "Super Hero Ego",
  description: null,
  created_at: "2026-08-19T00:00:00Z",
  murals: [
    {
      master_id: "a75ae8af-7b48-4b67-8392-d89447bae370",
      title: "Super Hero Ego",
      has_media: true,
      asset_id: SHE_ASSET,
      provider: "mux",
      storage_ref: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4",
      scenes: [
        {
          master_id: "4790c7cf-bb19-4a01-a243-e5c3eb680555",
          title: "Golden Shovel — Powerhouse",
          description: null,
          sort_order: 1,
          start_ms: 36000,
          end_ms: 79000,
          binding_id: null,
          projection_id: null,
          asset_id: SHE_ASSET,
          creative_moments: [],
          creative_moment_id: null,
          creative_moment_title: null,
          provider: "mux",
          storage_ref: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4",
        },
      ],
    },
  ],
  creative_moments: [],
};

assert(resolveSuiteSourceAssetId(she) === SHE_ASSET, "Super Hero Ego still clocks mural Mux");

const empty = {
  master_id: FR,
  title: "Empty",
  description: null,
  created_at: "2026-09-14T00:00:00Z",
  murals: [
    {
      master_id: FR_MURAL,
      title: "Empty",
      scenes: [],
      has_media: false,
      asset_id: null,
      provider: null,
      storage_ref: null,
    },
  ],
  creative_moments: [],
};
assert(resolveSuiteSourceAssetId(empty) === null, "a Mural without media has no cinema clock");

console.log("source-preview.test.mjs: ok");
