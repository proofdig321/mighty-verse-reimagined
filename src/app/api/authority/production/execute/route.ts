import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority } from "@/lib/authority/validate";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { loadSentinelIntelligence } from "@/lib/assemble/load-sentinel-intelligence";
import { loadUniverseReferences } from "@/lib/assemble/load-references";
import { loadUniverseProductionResults } from "@/lib/assemble/load-production";
import { deriveSceneProductionBriefs } from "@/lib/production/plan";
import { decideProductionDispatch } from "@/lib/production/adapter";

/**
 * POST /api/authority/production/execute
 *
 * Dispatch a Scene production brief to an external creative executor.
 * No executor is connected. Mux remains the video infrastructure for a future result.
 * Does not fabricate jobs, Mux assets, or media_realization rows.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const universeId = typeof body.universe_id === "string" ? body.universe_id.trim() : "";
  const sceneId = typeof body.scene_master_id === "string" ? body.scene_master_id.trim() : "";

  const assembly = universeId ? await loadUniverseAssembly(universeId) : null;
  if (!assembly) return NextResponse.json({ error: "Universe was not found." }, { status: 404 });

  const auth = await validateAuthority(participantId, "authorise-projection", universeId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const [intelligence, references, results] = await Promise.all([
    loadSentinelIntelligence(assembly, { includeObservations: false }),
    loadUniverseReferences(universeId),
    loadUniverseProductionResults(universeId),
  ]);
  const briefs = deriveSceneProductionBriefs(assembly, intelligence, references, results);
  const brief = briefs.find((entry) => entry.scene_master_id === sceneId) ?? null;
  const decision = decideProductionDispatch({ universe_id: universeId, brief });

  if (!decision.ok) {
    const status = decision.code === "not_connected" ? 409 : 400;
    return NextResponse.json({
      error: decision.message,
      code: decision.code,
      creates_canonical: false,
      populates_media_realization: false,
      video_infrastructure: "mux",
    }, { status });
  }

  return NextResponse.json({ error: "Unexpected dispatch." }, { status: 500 });
}
