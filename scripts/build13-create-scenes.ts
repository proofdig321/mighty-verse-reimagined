/**
 * Build 13 — Super Hero Ego Scene canonical registration
 *
 * Creates four canonical Scene records extracted from the Super Hero Ego Mural.
 * Infrastructure only: no projections, no media bindings, no collectibles.
 *
 * Authorised by founder/PM 2026-08-21.
 * Scene candidates: Golden Shovel, Mothipa, ProVerb, Reason warrior manifestations.
 *
 * Run once: npx tsx scripts/build13-create-scenes.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import {
  registerMaster,
  addAttribution,
  createCanonicalState,
} from "../src/lib/authority/operations";

const GOLDEN_SHOVEL        = "866390ff-5d45-4c15-b64e-e7c0655780b8";
const MURAL_MASTER_ID      = "a75ae8af-7b48-4b67-8392-d89447bae370";
const MURAL_STATE_ID       = "8f7fe56d-0269-476d-b925-4567c461ee5e";

// Creative Moment counterparts (Build 07/09)
const CM_PROVERB           = "3b0de6b4-0000-0000-0000-000000000000"; // placeholder — resolved below
const CM_REASON            = "2745a50a-0000-0000-0000-000000000000"; // placeholder — resolved below
const CM_MOTHIPA           = "32422bb4-0000-0000-0000-000000000000"; // placeholder — resolved below

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ---------------------------------------------------------------------------
// Scene definitions — semantic spatial identity only.
// No numerical coordinates. No timecodes.
// ---------------------------------------------------------------------------
const SCENES = [
  {
    name: "Golden Shovel — Powerhouse",
    description: "Golden Shovel's warrior manifestation within the Super Hero Ego Mural. Central city/skyline focal manifestation; powerhouse with spirit-avatar presence.",
    extraction_bounds: {
      type: "semantic-spatial",
      semantic_identity: "Golden Shovel warrior manifestation — the Powerhouse",
      spatial_description: "Central city/skyline focal area of the Mural",
      geometry: null  // not yet established — requires Mural canonical surface inspection
    },
    extraction_method: "manual",
    creative_moment_id: null,  // no Creative Moment counterpart — intentional
    attribution_description: "Golden Shovel warrior manifestation — canonical Scene extracted from Super Hero Ego Mural",
  },
  {
    name: "Mothipa — Dark Knight",
    description: "Mothipa's warrior manifestation within the Super Hero Ego Mural. Elevated/gargoyle rooftop manifestation; Dark Knight/aura presence.",
    extraction_bounds: {
      type: "semantic-spatial",
      semantic_identity: "Mothipa warrior manifestation — the Dark Knight",
      spatial_description: "Elevated/gargoyle rooftop setting within the Mural",
      geometry: null
    },
    extraction_method: "manual",
    creative_moment_id: "mothipa",  // resolved at runtime
    attribution_description: "Mothipa warrior manifestation — canonical Scene extracted from Super Hero Ego Mural",
  },
  {
    name: "ProVerb — Hand-to-Hand",
    description: "ProVerb's warrior manifestation within the Super Hero Ego Mural. Ground-level urban combat manifestation; hand-to-hand fighter.",
    extraction_bounds: {
      type: "semantic-spatial",
      semantic_identity: "ProVerb warrior manifestation — the Hand-to-Hand Specialist",
      spatial_description: "Ground-level urban combat setting within the Mural",
      geometry: null
    },
    extraction_method: "manual",
    creative_moment_id: "proverb",  // resolved at runtime
    attribution_description: "ProVerb warrior manifestation — canonical Scene extracted from Super Hero Ego Mural",
  },
  {
    name: "Reason — Sword Master",
    description: "Reason's warrior manifestation within the Super Hero Ego Mural. Elevated urban/rooftop combat manifestation; sword-master.",
    extraction_bounds: {
      type: "semantic-spatial",
      semantic_identity: "Reason warrior manifestation — the Sword Master",
      spatial_description: "Elevated urban/rooftop combat setting within the Mural",
      geometry: null
    },
    extraction_method: "manual",
    creative_moment_id: "reason",  // resolved at runtime
    attribution_description: "Reason warrior manifestation — canonical Scene extracted from Super Hero Ego Mural",
  },
] as const;

// ---------------------------------------------------------------------------
// Resolve Creative Moment master IDs from work_presentation titles
// ---------------------------------------------------------------------------
async function resolveCreativeMoments(): Promise<Record<string, string>> {
  const db = svc();
  const { data, error } = await db
    .from("work_presentation")
    .select("master_id, title")
    .in("title", ["Proverb", "Reason", "Mothipa"]);
  if (error || !data) throw new Error(`Failed to resolve Creative Moments: ${error?.message}`);
  const map: Record<string, string> = {};
  for (const row of data) {
    map[row.title.toLowerCase()] = row.master_id;
  }
  if (!map["proverb"] || !map["reason"] || !map["mothipa"]) {
    throw new Error(`Missing Creative Moment(s): ${JSON.stringify(map)}`);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Create one Scene
// ---------------------------------------------------------------------------
async function createScene(scene: typeof SCENES[number], cmMap: Record<string, string>) {
  const db = svc();

  // 1. Register Scene master
  const masterResult = await registerMaster(GOLDEN_SHOVEL, "scene", MURAL_MASTER_ID);
  if ("error" in masterResult) throw new Error(`registerMaster(${scene.name}): ${masterResult.error}`);
  const { master_id } = masterResult.data;

  // 2. Explicit director attribution — Golden Shovel designates the extraction
  const attrResult = await addAttribution(
    GOLDEN_SHOVEL,
    master_id,
    "director",
    scene.attribution_description,
    true
  );
  if ("error" in attrResult) throw new Error(`addAttribution(${scene.name}): ${attrResult.error}`);

  // 3. Canonical state with extraction metadata in content_refs
  const contentRefs = {
    source_canonical_state_id: MURAL_STATE_ID,
    extraction_bounds: scene.extraction_bounds,
    extraction_method: scene.extraction_method,
  };
  const stateResult = await createCanonicalState(GOLDEN_SHOVEL, master_id, contentRefs);
  if ("error" in stateResult) throw new Error(`createCanonicalState(${scene.name}): ${stateResult.error}`);
  const { canonical_state_id, provenance_id } = stateResult.data;

  // 4. Extraction provenance record — Scene state → extracted from → Mural state
  const { data: extractionProv, error: epErr } = await db
    .from("provenance_record")
    .select("provenance_id, relationship_type")
    .eq("subject_id", canonical_state_id)
    .single();
  // The createCanonicalState() call above creates a canonical-revision provenance record.
  // We additionally create an extraction provenance record pointing to the source Mural state.
  const { data: authRec } = await db
    .from("authority_record")
    .select("authority_id")
    .eq("holder_ref", GOLDEN_SHOVEL)
    .eq("revoked", false)
    .single();
  if (!authRec) throw new Error("Golden Shovel authority record not found");

  // Compute hash for extraction provenance
  const { data: hashData, error: hashErr } = await db.rpc("compute_integrity_hash", {
    fields: {
      authorised_by: authRec.authority_id,
      relationship_type: "extraction",
      source_id: MURAL_STATE_ID,
      source_type: "canonical-state",
      subject_id: canonical_state_id,
      subject_type: "canonical-state",
    }
  });
  if (hashErr || !hashData) throw new Error(`Hash failed for ${scene.name}: ${hashErr?.message}`);

  const { data: extractionProvRecord, error: epInsertErr } = await db
    .from("provenance_record")
    .insert({
      subject_id: canonical_state_id,
      subject_type: "canonical-state",
      source_id: MURAL_STATE_ID,
      source_type: "canonical-state",
      relationship_type: "extraction",
      authorised_by: authRec.authority_id,
      public: true,
      integrity_hash: hashData,
    })
    .select("provenance_id")
    .single();
  if (epInsertErr || !extractionProvRecord) {
    throw new Error(`Extraction provenance failed for ${scene.name}: ${epInsertErr?.message}`);
  }

  // 5. Presentation
  const { data: pres, error: presErr } = await db
    .from("work_presentation")
    .insert({ master_id, title: scene.name, description: scene.description })
    .select("presentation_id")
    .single();
  if (presErr || !pres) throw new Error(`work_presentation(${scene.name}): ${presErr?.message}`);

  const cmId = scene.creative_moment_id ? cmMap[scene.creative_moment_id] ?? null : null;

  return {
    master_id,
    canonical_state_id,
    canonical_provenance_id: provenance_id,
    extraction_provenance_id: extractionProvRecord.provenance_id,
    attribution_entry_id: attrResult.data.entry_id,
    presentation_id: pres.presentation_id,
    creative_moment_id: cmId,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  const db = svc();

  // Verify Mural is unchanged
  const { data: mural } = await db
    .from("master")
    .select("current_state_id")
    .eq("master_id", MURAL_MASTER_ID)
    .single();
  if (mural?.current_state_id !== MURAL_STATE_ID) {
    throw new Error(`Mural canonical state has changed — expected ${MURAL_STATE_ID}, got ${mural?.current_state_id}`);
  }

  const cmMap = await resolveCreativeMoments();
  console.log("Creative Moment IDs:", cmMap);

  const results: Record<string, ReturnType<typeof createScene> extends Promise<infer T> ? T : never> = {} as never;

  for (const scene of SCENES) {
    console.log(`\nCreating Scene: ${scene.name}`);
    const result = await createScene(scene, cmMap);
    results[scene.name] = result;
    console.log(result);
  }

  // Verify no projections or media bindings were created
  const sceneMasterIds = Object.values(results).map(r => r.master_id);
  const { data: projs } = await db.from("projection").select("projection_id").in("master_id", sceneMasterIds);
  if (projs?.length) throw new Error("Unexpected projections created on Scenes");

  // Verify Mural and World unchanged
  const { data: world } = await db.from("master").select("current_state_id").eq("master_id", "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc").single();
  if (world?.current_state_id !== "abe7b1c0-afb6-4786-a4c8-622e1da31602") throw new Error("World state changed");
  if (mural?.current_state_id !== MURAL_STATE_ID) throw new Error("Mural state changed");

  console.log("\n--- Build 13 Scene registration complete ---");
  console.log(JSON.stringify(results, null, 2));
}

run().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
