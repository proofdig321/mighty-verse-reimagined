import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, validateAuthority } from "@/lib/authority/validate";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { composeStoryboardBody } from "@/lib/storyboard/script";
import { persistStoryboardBody, associateStoryboardWork } from "@/lib/storyboard/persist";
import { loadStoryboardMaterials } from "@/lib/storyboard/load";
import { promptWithGemini, serverAiCapability, STORYBOARD_SYSTEM } from "@/lib/ai/provider";

/**
 * GET/POST /api/authority/storyboard
 *
 * Story body materials only. Does not create Scenes.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const universeId = new URL(request.url).searchParams.get("universe_id")?.trim() ?? "";
  if (universeId) {
    const assembly = await loadUniverseAssembly(universeId);
    if (!assembly) return NextResponse.json({ error: "Universe was not found." }, { status: 404 });
    const auth = await validateAuthority(participantId, "authorise-projection", universeId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  const materials = await loadStoryboardMaterials(universeId || null, participantId);
  return NextResponse.json({
    body: materials.body?.body ?? "",
    panel_count: materials.body?.panel_count ?? 0,
    artifacts: materials.artifacts.map((artifact) => ({
      title: artifact.title,
      output_type: artifact.output_type,
      still_url: artifact.still_url,
      status: artifact.playback_id || artifact.still_url ? "ready" : "failed",
    })),
    capability: serverAiCapability(),
    creates_scene: false,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const universeId = typeof body.universe_id === "string" ? body.universe_id.trim() : "";
  const action = typeof body.action === "string" ? body.action : "save";
  const script = typeof body.body === "string" ? body.body : "";
  const instruction = typeof body.instruction === "string" ? body.instruction : "";

  const assembly = universeId ? await loadUniverseAssembly(universeId) : null;
  if (universeId && !assembly) return NextResponse.json({ error: "Universe was not found." }, { status: 404 });

  if (universeId) {
    const auth = await validateAuthority(participantId, "authorise-projection", universeId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  if (action === "associate") {
    if (!universeId || !assembly) {
      return NextResponse.json({ error: "Select a Universe to associate this work with.", creates_scene: false }, { status: 400 });
    }
    const moved = await associateStoryboardWork({
      svc: getServiceClient(),
      participantId,
      universeId,
    });
    return NextResponse.json({
      universe_id: universeId,
      moved: moved.moved,
      status: "ready",
      creates_scene: false,
      creates_canonical: false,
    });
  }

  let nextBody = script;
  let provider: "chrome-prompt" | "gemini" | "local" = "local";

  if (action === "assist") {
    const result = await promptWithGemini({
      system: STORYBOARD_SYSTEM,
      prompt: [
        `Universe: ${assembly?.title ?? "Standalone storyboard"}`,
        assembly?.description ? `Identity: ${assembly.description}` : "",
        script ? `Current story body:\n${script}` : "No current story body.",
        instruction ? `Curator instruction:\n${instruction}` : "Write a cinematic storyboard story body.",
      ].filter(Boolean).join("\n\n"),
    });
    if (!result.ok) {
      return NextResponse.json({
        status: result.status,
        error: result.message,
        provider: result.provider,
        creates_scene: false,
      }, { status: result.status === "unavailable" ? 409 : 502 });
    }
    nextBody = result.text;
    provider = result.provider;
  }

  const composed = composeStoryboardBody(nextBody);
  const saved = await persistStoryboardBody({
    svc: getServiceClient(),
    universeId: universeId || null,
    participantId,
    body: composed.body,
    panelCount: composed.panels.length,
  });

  return NextResponse.json({
    intake_id: saved.intake_id,
    body: composed.body,
    panels: composed.panels,
    provider,
    status: "ready",
    creates_scene: false,
    creates_canonical: false,
  });
}
