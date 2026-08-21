/**
 * Build 06 — Super Hero Ego Mural creation
 * Run once: npx tsx scripts/build06-create-mural.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import {
  registerMaster,
  addAttribution,
  createCanonicalState,
  createProjection,
  attachMediaBinding,
} from "../src/lib/authority/operations";
import { createClient } from "@supabase/supabase-js";

const GOLDEN_SHOVEL = "866390ff-5d45-4c15-b64e-e7c0655780b8";
const WORLD_MASTER_ID = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
// Livepeer asset ID (not playback ID) — from integrity_hash of existing media_asset
const LIVEPEER_ASSET_ID = "5a115b88-a4d0-444b-974d-e9721e37f37d";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function run() {
  // 1. Register Mural master
  const masterResult = await registerMaster(GOLDEN_SHOVEL, "mural", WORLD_MASTER_ID);
  if ("error" in masterResult) throw new Error(`registerMaster: ${masterResult.error}`);
  const { master_id } = masterResult.data;
  console.log("master_id:", master_id);

  // 2. Designate Director — explicit canonical act, no original-artist
  const attrResult = await addAttribution(
    GOLDEN_SHOVEL,
    master_id,
    "director",
    "Director of the Super Hero Ego Mural",
    true
  );
  if ("error" in attrResult) throw new Error(`addAttribution: ${attrResult.error}`);
  const { entry_id } = attrResult.data;
  console.log("attribution entry_id:", entry_id);

  // 3. Create Mural canonical state
  const stateResult = await createCanonicalState(GOLDEN_SHOVEL, master_id, null);
  if ("error" in stateResult) throw new Error(`createCanonicalState: ${stateResult.error}`);
  const { canonical_state_id } = stateResult.data;
  console.log("canonical_state_id:", canonical_state_id);

  // 4. Create Mural experiential projection
  const projResult = await createProjection(GOLDEN_SHOVEL, canonical_state_id, master_id, "experiential");
  if ("error" in projResult) throw new Error(`createProjection: ${projResult.error}`);
  const { projection_id } = projResult.data;
  console.log("projection_id:", projection_id);

  // 5. Bind existing Livepeer asset to Mural projection
  const bindResult = await attachMediaBinding(GOLDEN_SHOVEL, projection_id, master_id, LIVEPEER_ASSET_ID);
  if ("error" in bindResult) throw new Error(`attachMediaBinding: ${bindResult.error}`);
  const { binding_id, asset_id } = bindResult.data;
  console.log("binding_id:", binding_id, "asset_id:", asset_id);

  // 6. Create work_presentation
  const supabase = getServiceClient();
  const { data: pres, error: presErr } = await supabase
    .from("work_presentation")
    .insert({ master_id, title: "Super Hero Ego" })
    .select("presentation_id")
    .single();
  if (presErr || !pres) throw new Error(`work_presentation: ${presErr?.message}`);
  console.log("presentation_id:", pres.presentation_id);

  console.log("\n--- Build 06 complete ---");
  console.log({ master_id, entry_id, canonical_state_id, projection_id, binding_id, asset_id, presentation_id: pres.presentation_id });
}

run().catch((e) => { console.error(e); process.exit(1); });
