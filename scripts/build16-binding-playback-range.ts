/**
 * Build 16 — Scene media realization playback range
 *
 * Adds start_ms / end_ms to projection_media_binding and populates
 * V1 realization ranges for the four Super Hero Ego Scene projections.
 *
 * ONTOLOGY INVARIANT: these are media-realization context on the binding,
 * not canonical Scene identity. Scene masters are untouched.
 *
 * Run once: npx tsx scripts/build16-binding-playback-range.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF!;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN!;

async function sql(query: string) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ query }),
    }
  );
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

// V1 realization ranges — media observations, not canonical Scene boundaries
const RANGES = [
  { projectionId: "3039ca84-7e11-4eb6-8895-d16d13a899c3", startMs: 36000,  endMs: 79000,  label: "Golden Shovel Powerhouse" },
  { projectionId: "bb802400-b385-4025-9bb8-63df53abd9be", startMs: 80000,  endMs: 124000, label: "Mothipa Dark Knight" },
  { projectionId: "9c045ea3-ab09-4a6f-b89c-02dce076b8da", startMs: 149000, endMs: 192000, label: "ProVerb Hand-to-Hand" },
  { projectionId: "8100033e-4c7e-448f-8b9c-b9ff97fdc3fd", startMs: 193000, endMs: 254000, label: "Reason Sword Master" },
];

async function main() {
  console.log("Build 16 — adding playback range columns...");

  await sql(`
    alter table public.projection_media_binding
      add column if not exists start_ms integer check (start_ms >= 0),
      add column if not exists end_ms   integer check (end_ms > 0);

    comment on column public.projection_media_binding.start_ms is
      'Playback start offset ms for this projection''s use of the asset. NULL = play from beginning. NOT canonical Scene identity.';
    comment on column public.projection_media_binding.end_ms is
      'Playback end offset ms for this projection''s use of the asset. NULL = play to end. NOT canonical Scene identity.';
  `);
  console.log("  ✓ columns added");

  for (const { projectionId, startMs, endMs, label } of RANGES) {
    await sql(`
      update public.projection_media_binding
      set start_ms = ${startMs}, end_ms = ${endMs}
      where projection_id = '${projectionId}';
    `);
    console.log(`  ✓ ${label}  ${startMs}–${endMs} ms`);
  }

  console.log("Build 16 schema complete.");
}

main().catch(e => { console.error(e); process.exit(1); });
