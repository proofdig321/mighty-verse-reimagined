/**
 * Build 09 — Correct featured-artist attribution participant_id
 * Build 07 created the correct participant records for Proverb, Reason, Mothipa
 * but passed GOLDEN_SHOVEL as the participantId to addAttribution(), so all three
 * featured-artist entries point to Golden Shovel instead of the actual artists.
 * This script corrects the participant_id FK on the three existing entries.
 * Run once: npx tsx scripts/build09-correct-attribution.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const GOLDEN_SHOVEL = "866390ff-5d45-4c15-b64e-e7c0655780b8";

const CORRECTIONS = [
  {
    name: "Proverb",
    entry_id: "ccf2eba3-78fc-4793-b103-c3dc75217694",
    correct_participant_id: "ed5949f1-e50d-4d8b-8087-9ee51b323502",
    expected_description: "Featured artist on Super Hero Ego — Proverb",
  },
  {
    name: "Reason",
    entry_id: "2937ae84-c644-4381-91c1-11df5c552f78",
    correct_participant_id: "5f74b13e-1858-4607-86d6-9cacab09042c",
    expected_description: "Featured artist on Super Hero Ego — Reason",
  },
  {
    name: "Mothipa",
    entry_id: "70c19369-b4bd-4fd2-b07d-8edc9d823cbe",
    correct_participant_id: "d6ffdaa9-7473-4c5c-bc58-9d1722d37c7f",
    expected_description: "Featured artist on Super Hero Ego — Mothipa",
  },
];

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function run() {
  const db = svc();

  // --- Pre-state verification ---
  console.log("=== PRE-STATE VERIFICATION ===");
  for (const c of CORRECTIONS) {
    const { data, error } = await db
      .from("attribution_entry")
      .select("entry_id, participant_id, role_type, contribution_description, attribution_id")
      .eq("entry_id", c.entry_id)
      .single();

    if (error || !data) throw new Error(`Entry not found: ${c.entry_id} (${c.name})`);
    if (data.role_type !== "featured-artist") throw new Error(`Wrong role_type on ${c.name}: ${data.role_type}`);
    if (data.participant_id !== GOLDEN_SHOVEL) throw new Error(`Expected Golden Shovel on ${c.name}, got: ${data.participant_id}`);
    if (data.contribution_description !== c.expected_description) throw new Error(`Wrong description on ${c.name}: ${data.contribution_description}`);

    // Verify target participant exists
    const { data: part } = await db.from("participant").select("participant_id").eq("participant_id", c.correct_participant_id).single();
    if (!part) throw new Error(`Target participant not found: ${c.correct_participant_id} (${c.name})`);

    console.log(`VERIFIED ${c.name}: entry_id=${c.entry_id}, participant=${data.participant_id} → will correct to ${c.correct_participant_id}`);
  }

  // --- Apply corrections ---
  console.log("\n=== APPLYING CORRECTIONS ===");
  for (const c of CORRECTIONS) {
    const { error } = await db
      .from("attribution_entry")
      .update({ participant_id: c.correct_participant_id })
      .eq("entry_id", c.entry_id);
    if (error) throw new Error(`Failed to update ${c.name}: ${error.message}`);
    console.log(`CORRECTED ${c.name}: participant_id → ${c.correct_participant_id}`);
  }

  // --- Post-state verification ---
  console.log("\n=== POST-STATE VERIFICATION ===");
  for (const c of CORRECTIONS) {
    const { data } = await db
      .from("attribution_entry")
      .select("entry_id, participant_id, role_type, contribution_description")
      .eq("entry_id", c.entry_id)
      .single();
    if (!data) throw new Error(`Entry missing after update: ${c.entry_id}`);
    if (data.participant_id !== c.correct_participant_id) throw new Error(`Correction failed for ${c.name}: still ${data.participant_id}`);
    if (data.role_type !== "featured-artist") throw new Error(`role_type changed on ${c.name}`);
    if (data.contribution_description !== c.expected_description) throw new Error(`description changed on ${c.name}`);
    console.log(`VERIFIED ${c.name}: participant_id=${data.participant_id} ✓`);
  }

  // --- Verify Golden Shovel's own attribution is untouched ---
  console.log("\n=== GOLDEN SHOVEL ATTRIBUTION UNCHANGED ===");
  const { data: gsEntries } = await db
    .from("attribution_entry")
    .select("entry_id, role_type, participant_id")
    .eq("participant_id", GOLDEN_SHOVEL);
  const gsRoles = (gsEntries ?? []).map(e => e.role_type).sort();
  console.log("Golden Shovel entries:", gsRoles);
  // Should be: director (World), original-artist (World), director (Mural), + 3 other song-world entries
  const hasFeaturedArtist = gsRoles.includes("featured-artist");
  if (hasFeaturedArtist) throw new Error("Golden Shovel still has a featured-artist entry — correction incomplete");
  console.log("Golden Shovel has no featured-artist entries ✓");

  // --- Verify no extra attribution entries were created ---
  const { data: allEntries } = await db.from("attribution_entry").select("entry_id");
  console.log(`\nTotal attribution_entry count: ${allEntries?.length} (expected 12 — 9 existing + 3 corrected in place)`);

  console.log("\n=== Build 09 correction complete ===");
}

run().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
