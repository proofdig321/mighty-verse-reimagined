/**
 * Build 07 — Super Hero Ego Creative Moments
 * Registers Proverb, Reason, Mothipa as canonical Creative Moments.
 * Deletes artefact master 7d5f7bef after dependency verification.
 * Run once: npx tsx scripts/build07-create-moments.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import {
  registerMaster,
  addAttribution,
  createCanonicalState,
} from "../src/lib/authority/operations";

const GOLDEN_SHOVEL = "866390ff-5d45-4c15-b64e-e7c0655780b8";
const WORLD_MASTER_ID = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const ARTEFACT_MASTER_ID = "7d5f7bef-277a-4822-8b10-e0b6a54d3f7b";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ---------------------------------------------------------------------------
// Create a minimal participant record (no identity links — no verified data)
// ---------------------------------------------------------------------------
async function createParticipant(name: string): Promise<string> {
  const db = svc();
  const { data, error } = await db
    .from("participant")
    .insert({ status: "active" })
    .select("participant_id")
    .single();
  if (error || !data) throw new Error(`Failed to create participant for ${name}: ${error?.message}`);
  return data.participant_id;
}

// ---------------------------------------------------------------------------
// Register one Creative Moment with featured-artist attribution + state + presentation
// ---------------------------------------------------------------------------
async function createMoment(
  name: string,
  featuredArtistParticipantId: string
): Promise<{
  master_id: string;
  attribution_entry_id: string;
  canonical_state_id: string;
  presentation_id: string;
}> {
  const db = svc();

  // 1. Register master — identity only
  const masterResult = await registerMaster(GOLDEN_SHOVEL, "creative-moment", WORLD_MASTER_ID);
  if ("error" in masterResult) throw new Error(`registerMaster(${name}): ${masterResult.error}`);
  const { master_id } = masterResult.data;

  // 2. Explicit featured-artist attribution
  const attrResult = await addAttribution(
    GOLDEN_SHOVEL,
    master_id,
    "featured-artist",
    `Featured artist on Super Hero Ego — ${name}`,
    true
  );
  if ("error" in attrResult) throw new Error(`addAttribution(${name}): ${attrResult.error}`);
  const { entry_id: attribution_entry_id } = attrResult.data;

  // 3. Canonical state
  const stateResult = await createCanonicalState(GOLDEN_SHOVEL, master_id, null);
  if ("error" in stateResult) throw new Error(`createCanonicalState(${name}): ${stateResult.error}`);
  const { canonical_state_id } = stateResult.data;

  // 4. Presentation
  const { data: pres, error: presErr } = await db
    .from("work_presentation")
    .insert({ master_id, title: name })
    .select("presentation_id")
    .single();
  if (presErr || !pres) throw new Error(`work_presentation(${name}): ${presErr?.message}`);

  return { master_id, attribution_entry_id, canonical_state_id, presentation_id: pres.presentation_id };
}

// ---------------------------------------------------------------------------
// Delete artefact 7d5f7bef — verify dependencies first
// ---------------------------------------------------------------------------
async function deleteArtefact(): Promise<void> {
  const db = svc();

  const { data: artefact } = await db
    .from("master")
    .select("master_id, attribution_ref, current_state_id")
    .eq("master_id", ARTEFACT_MASTER_ID)
    .single();
  if (!artefact) { console.log("Artefact already absent — skipping deletion"); return; }

  // Verify no child masters
  const { data: children } = await db.from("master").select("master_id").eq("parent_master_id", ARTEFACT_MASTER_ID);
  if (children?.length) throw new Error(`Artefact has child masters — manual review required`);

  // Verify no presentation
  const { data: pres } = await db.from("work_presentation").select("presentation_id").eq("master_id", ARTEFACT_MASTER_ID);
  if (pres?.length) throw new Error(`Artefact has presentation records — manual review required`);

  // Collect projection IDs
  const { data: projs } = await db.from("projection").select("projection_id").eq("master_id", ARTEFACT_MASTER_ID);
  const projIds = (projs ?? []).map((p) => p.projection_id);

  // For each projection: collect media bindings and their asset IDs
  const assetIdsToDelete: string[] = [];
  for (const projId of projIds) {
    const { data: bindings } = await db.from("projection_media_binding").select("binding_id, asset_id").eq("projection_id", projId);
    for (const b of bindings ?? []) {
      // Only delete asset if it is exclusively used by this artefact
      const { data: otherBindings } = await db.from("projection_media_binding").select("binding_id").eq("asset_id", b.asset_id).neq("projection_id", projId);
      if (!otherBindings?.length) assetIdsToDelete.push(b.asset_id);
    }
    // Delete bindings
    await db.from("projection_media_binding").delete().eq("projection_id", projId);
    // Delete projection provenance
    await db.from("provenance_record").delete().eq("subject_id", projId);
  }

  // Delete projections
  if (projIds.length) await db.from("projection").delete().in("projection_id", projIds);

  // Delete exclusively-owned media assets (and their delivery variants)
  for (const assetId of assetIdsToDelete) {
    await db.from("delivery_variant").delete().eq("asset_id", assetId);
    await db.from("media_asset").delete().eq("asset_id", assetId);
  }

  // Null FK pointers to break cycles
  await db.from("master").update({ current_state_id: null, attribution_ref: null }).eq("master_id", ARTEFACT_MASTER_ID);

  // Delete canonical state (cascades provenance FK from canonical_state side)
  if (artefact.current_state_id) {
    await db.from("canonical_state").delete().eq("canonical_state_id", artefact.current_state_id);
  }

  // Delete attribution entries then record
  if (artefact.attribution_ref) {
    await db.from("attribution_entry").delete().eq("attribution_id", artefact.attribution_ref);
    await db.from("attribution_record").delete().eq("attribution_id", artefact.attribution_ref);
  }

  // Delete master
  const { error } = await db.from("master").delete().eq("master_id", ARTEFACT_MASTER_ID);
  if (error) throw new Error(`Failed to delete artefact master: ${error.message}`);

  console.log("Artefact 7d5f7bef and full dependency chain deleted cleanly");
  console.log("  Deleted asset(s):", assetIdsToDelete);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  const db = svc();

  // --- Delete artefact first ---
  await deleteArtefact();

  // --- Create participants (no identity links — no verified external data exists) ---
  const proverb_id = await createParticipant("Proverb");
  const reason_id = await createParticipant("Reason");
  const mothipa_id = await createParticipant("Mothipa");
  console.log("participants:", { proverb_id, reason_id, mothipa_id });

  // --- Create Creative Moments ---
  const proverb = await createMoment("Proverb", proverb_id);
  console.log("Proverb moment:", proverb);

  const reason = await createMoment("Reason", reason_id);
  console.log("Reason moment:", reason);

  const mothipa = await createMoment("Mothipa", mothipa_id);
  console.log("Mothipa moment:", mothipa);

  // --- Verify World and Mural chains are untouched ---
  const { data: world } = await db
    .from("master")
    .select("current_state_id, attribution_ref")
    .eq("master_id", WORLD_MASTER_ID)
    .single();
  if (world?.current_state_id !== "abe7b1c0-afb6-4786-a4c8-622e1da31602") {
    throw new Error("World canonical state has changed — integrity violation");
  }

  const { data: mural } = await db
    .from("master")
    .select("current_state_id")
    .eq("master_id", "a75ae8af-7b48-4b67-8392-d89447bae370")
    .single();
  if (mural?.current_state_id !== "8f7fe56d-0269-476d-b925-4567c461ee5e") {
    throw new Error("Mural canonical state has changed — integrity violation");
  }

  // --- Verify no projections or media bindings on new Moments ---
  const momentIds = [proverb.master_id, reason.master_id, mothipa.master_id];
  const { data: momentProjs } = await db.from("projection").select("projection_id").in("master_id", momentIds);
  if (momentProjs?.length) throw new Error("Moments have projections — unexpected");

  // --- Final master count ---
  const { data: allMasters } = await db.from("master").select("master_id, canonical_type, parent_master_id");
  console.log("\nAll masters:", JSON.stringify(allMasters, null, 2));

  console.log("\n--- Build 07 complete ---");
  console.log({
    participants: { proverb_id, reason_id, mothipa_id },
    moments: {
      proverb: { master_id: proverb.master_id, attribution_entry_id: proverb.attribution_entry_id, canonical_state_id: proverb.canonical_state_id, presentation_id: proverb.presentation_id },
      reason:  { master_id: reason.master_id,  attribution_entry_id: reason.attribution_entry_id,  canonical_state_id: reason.canonical_state_id,  presentation_id: reason.presentation_id  },
      mothipa: { master_id: mothipa.master_id, attribution_entry_id: mothipa.attribution_entry_id, canonical_state_id: mothipa.canonical_state_id, presentation_id: mothipa.presentation_id },
    },
    artefact_deleted: ARTEFACT_MASTER_ID,
    world_state_unchanged: world?.current_state_id,
    mural_state_unchanged: mural?.current_state_id,
  });
}

run().catch((e) => { console.error(e); process.exit(1); });
