import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, validateAuthority } from "@/lib/authority/validate";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { composeStoryboardBody } from "@/lib/storyboard/script";
import { persistStoryboardBody, associateStoryboardWork } from "@/lib/storyboard/persist";
import { loadStoryboardMaterials } from "@/lib/storyboard/load";
import { promptWithGemini, serverAiCapability, STORYBOARD_SYSTEM } from "@/lib/ai/provider";
import { aiServiceCapability } from "@/lib/ai/config";
import { generateStructuredStoryboard } from "@/lib/ai/gemini";
import { composeAssistPrompt } from "@/lib/ai/prompt-composer";
import { assistAction } from "@/lib/storyboard/assist";
import { STRUCTURED_STORYBOARD_SYSTEM } from "@/lib/storyboard/document";
import {
  ensureStoryboardWork,
  loadStoryboardWork,
  replaceStoryboardPanels,
  saveStoryboardBody,
  seedPanelsFromScript,
  updateStoryboardPanel,
} from "@/lib/storyboard/work";
import { listGenerationJobs } from "@/lib/storyboard/generation";
import { parseStructuredStoryboard } from "@/lib/ai/structured-storyboard";

/**
 * GET/POST /api/authority/storyboard
 *
 * Story body and structured panels. Does not create Scenes.
 */
async function authorize(universeId: string, participantId: string) {
  if (!universeId) return null;
  const assembly = await loadUniverseAssembly(universeId);
  if (!assembly) return NextResponse.json({ error: "Universe was not found." }, { status: 404 });
  const auth = await validateAuthority(participantId, "authorise-projection", universeId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const universeId = new URL(request.url).searchParams.get("universe_id")?.trim() ?? "";
  const denied = await authorize(universeId, participantId);
  if (denied) return denied;

  const materials = await loadStoryboardMaterials(universeId || null, participantId);
  const work = await loadStoryboardWork({ participantId, universeId: universeId || null });
  const jobs = work ? await listGenerationJobs({ participantId, workId: work.work_id }) : [];
  const capability = aiServiceCapability();

  return NextResponse.json({
    body: work?.body ?? materials.body?.body ?? "",
    panel_count: work?.panels.length ?? materials.body?.panel_count ?? 0,
    work,
    jobs,
    artifacts: materials.artifacts.map((artifact) => ({
      title: artifact.title,
      output_type: artifact.output_type,
      still_url: artifact.still_url,
      playback_id: artifact.playback_id,
      endpoint_ref: artifact.endpoint_ref,
      status: artifact.playback_id || artifact.still_url ? "ready" : "failed",
    })),
    capability: {
      ...serverAiCapability(),
      models: capability.models,
      modes: capability.modes,
    },
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
  const selectedText = typeof body.selected_text === "string" ? body.selected_text : "";

  const assembly = universeId ? await loadUniverseAssembly(universeId) : null;
  if (universeId && !assembly) return NextResponse.json({ error: "Universe was not found." }, { status: 404 });
  const denied = await authorize(universeId, participantId);
  if (denied) return denied;

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

  if (action === "save-panel") {
    const panelId = typeof body.panel_id === "string" ? body.panel_id : "";
    const panel = await updateStoryboardPanel({
      participantId,
      panelId,
      patch: body.patch ?? body,
    });
    if (!panel) return NextResponse.json({ error: "Panel was not found." }, { status: 404 });
    return NextResponse.json({ panel, status: "ready", creates_scene: false });
  }

  const work = await ensureStoryboardWork({
    participantId,
    universeId: universeId || null,
    body: script,
    title: typeof body.title === "string" ? body.title : "Untitled storyboard",
  });

  if (action === "import-sentinel") {
    const beats = Array.isArray(body.panels) ? body.panels : [];
    const parsed = parseStructuredStoryboard({
      title: work.title,
      body: work.body,
      panels: beats.map((beat: Record<string, unknown>, index: number) => ({
        sequence: index + 1,
        title: typeof beat.title === "string" ? beat.title : `Beat ${index + 1}`,
        description: typeof beat.description === "string" ? beat.description : typeof beat.title === "string" ? beat.title : "",
      })),
    });
    if (!parsed) return NextResponse.json({ error: "Sentinel beats could not be imported.", creates_scene: false }, { status: 400 });
    const next = await replaceStoryboardPanels({
      workId: work.work_id,
      participantId,
      storyboard: parsed,
      source: "sentinel",
    });
    return NextResponse.json({ work: next, status: "ready", creates_scene: false, creates_canonical: false });
  }

  if (action === "generate-storyboard" || action === "shot-list") {
    const structured = await generateStructuredStoryboard({
      system: STRUCTURED_STORYBOARD_SYSTEM,
      prompt: composeAssistPrompt({
        action: action === "shot-list" ? "Create a shot list / structured storyboard." : "Turn the story into a structured storyboard.",
        storyTitle: work.title,
        storyBody: script || work.body,
        instruction,
      }),
    });
    if (!structured.ok) {
      const fallback = await seedPanelsFromScript({ workId: work.work_id, participantId, body: script || work.body });
      return NextResponse.json({
        work: fallback,
        status: structured.status,
        error: structured.message,
        provider: structured.provider,
        fallback: "local-script-parser",
        creates_scene: false,
      }, { status: structured.status === "needs_configuration" || structured.status === "unavailable" ? 200 : 502 });
    }
    const next = await replaceStoryboardPanels({
      workId: work.work_id,
      participantId,
      storyboard: structured.storyboard,
      source: "ai",
    });
    await persistStoryboardBody({
      svc: getServiceClient(),
      universeId: universeId || null,
      participantId,
      body: next.body,
      panelCount: next.panels.length,
    });
    return NextResponse.json({
      work: next,
      body: next.body,
      panels: next.panels,
      provider: "gemini",
      model: structured.model,
      status: "ready",
      creates_scene: false,
      creates_canonical: false,
    });
  }

  if (action === "assist" || assistAction(action)) {
    const assist = assistAction(action);
    const result = await promptWithGemini({
      system: STORYBOARD_SYSTEM,
      prompt: composeAssistPrompt({
        action: assist?.instruction ?? instruction ?? "Write or refine the story body.",
        storyTitle: assembly?.title ?? work.title,
        storyBody: script || work.body,
        panel: body.panel ?? null,
        instruction: [instruction, selectedText ? `Rewrite this passage only:\n${selectedText}` : ""].filter(Boolean).join("\n\n"),
      }),
    });
    if (!result.ok) {
      return NextResponse.json({
        status: result.status,
        error: result.message,
        provider: result.provider,
        creates_scene: false,
      }, { status: result.status === "unavailable" ? 409 : 502 });
    }
    const applyMode = typeof body.apply === "string" ? body.apply : "replace";
    const storyReplace = applyMode === "replace" || applyMode === "append";
    if (!storyReplace) {
      return NextResponse.json({
        work,
        body: work.body,
        suggestion: result.text,
        provider: result.provider,
        status: "ready",
        applied: false,
        creates_scene: false,
        creates_canonical: false,
      });
    }
    const nextBody = applyMode === "append" ? `${script || work.body}\n\n${result.text}` : result.text;
    const saved = await saveStoryboardBody({
      participantId,
      universeId: universeId || null,
      workId: work.work_id,
      body: nextBody,
    });
    await persistStoryboardBody({
      svc: getServiceClient(),
      universeId: universeId || null,
      participantId,
      body: saved.body,
      panelCount: saved.panels.length,
    });
    return NextResponse.json({
      work: saved,
      body: saved.body,
      panels: composeStoryboardBody(saved.body).panels,
      suggestion: result.text,
      provider: result.provider,
      status: "ready",
      creates_scene: false,
      creates_canonical: false,
    });
  }

  const composed = composeStoryboardBody(script);
  const saved = await saveStoryboardBody({
    participantId,
    universeId: universeId || null,
    workId: work.work_id,
    body: composed.body,
    title: typeof body.title === "string" ? body.title : work.title,
  });
  await persistStoryboardBody({
    svc: getServiceClient(),
    universeId: universeId || null,
    participantId,
    body: composed.body,
    panelCount: composed.panels.length,
  });

  return NextResponse.json({
    work: saved,
    intake_id: saved.work_id,
    body: composed.body,
    panels: composed.panels,
    provider: "local",
    status: "ready",
    creates_scene: false,
    creates_canonical: false,
  });
}
