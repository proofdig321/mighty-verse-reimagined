import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CANON, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

const MISSING_ASSET = "00000000-0000-0000-0000-000000000000";
const SCENE_IDS = Object.values(SCENE_MOMENTS).map((scene) => scene.sceneMasterId);
const BINDING_IDS = Object.values(SCENE_MOMENTS).map((scene) => scene.bindingId);

function readLocalEnv(): Record<string, string> {
  const candidates = [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), "../../.env.local")];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) return {};
  const parsed: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && parsed[key] == null) parsed[key] = value;
  }
  return parsed;
}

function serviceClient() {
  const localEnv = readLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Sentinel persist QA needs Supabase URL and service role.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function evidencePayload(assetId: string, frameCount: number, masterId?: string) {
  const frames = Array.from({ length: frameCount }, (_, index) => ({
    timeSec: index + 1,
    timeMs: (index + 1) * 1000,
    luminance: [10 + index, 20 + index, 30 + index],
    width: 160,
    height: 90,
  }));
  return {
    asset_id: assetId,
    ...(masterId ? { master_id: masterId } : {}),
    metadata: {
      durationSec: frameCount + 1,
      durationMs: (frameCount + 1) * 1000,
      videoWidth: 160,
      videoHeight: 90,
      hasVideo: true,
      hasAudio: false,
      frameRateFps: null,
      codec: null,
    },
    frames,
    deltas: frames.slice(1).map((frame, index) => ({
      fromMs: frames[index].timeMs,
      toMs: frame.timeMs,
      changeScore: 0.2 + index * 0.05,
    })),
    candidateTimestampsMs: [frames[0].timeMs],
    parameters: { frameCount, threshold: 0.15, minSceneDurationMs: 3000 },
  };
}

async function snapshotCanon(svc: ReturnType<typeof serviceClient>) {
  const [
    { data: universe },
    { data: mural },
    { data: scenes },
    { data: bindings },
    { data: moments },
    { count: realizationCount },
    { count: masterCount },
    { count: projectionCount },
  ] = await Promise.all([
    svc.from("master").select("master_id, current_state_id, sort_order").eq("master_id", CANON.universeId).single(),
    svc.from("master").select("master_id, current_state_id, parent_master_id, sort_order").eq("master_id", CANON.muralId).single(),
    svc.from("master").select("master_id, parent_master_id, sort_order, current_state_id").in("master_id", SCENE_IDS),
    svc.from("projection_media_binding").select("binding_id, asset_id, start_ms, end_ms").in("binding_id", BINDING_IDS),
    svc.from("scene_moment").select("scene_master_id, moment_master_id").in("scene_master_id", SCENE_IDS),
    svc.from("media_realization").select("*", { count: "exact", head: true }),
    svc.from("master").select("*", { count: "exact", head: true }),
    svc.from("projection").select("*", { count: "exact", head: true }),
  ]);
  return {
    universe,
    mural,
    scenes: (scenes ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    bindings: (bindings ?? []).slice().sort((a, b) => a.binding_id.localeCompare(b.binding_id)),
    moments: (moments ?? []).slice().sort((a, b) =>
      `${a.scene_master_id}:${a.moment_master_id}`.localeCompare(`${b.scene_master_id}:${b.moment_master_id}`),
    ),
    realizationCount: realizationCount ?? 0,
    masterCount: masterCount ?? 0,
    projectionCount: projectionCount ?? 0,
  };
}

async function postInspect(page: import("@playwright/test").Page, payload: Record<string, unknown>) {
  const response = await page.request.post("/api/authority/media/inspect", { data: payload });
  const body = await response.json().catch(() => ({}));
  return { status: response.status(), body };
}

test("Sentinel persists source-media inspection without creating canonical work", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(180_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  const svc = serviceClient();
  const createdSessions: string[] = [];

  const unauthorized = await fetch(`${baseURL}/api/authority/media/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(evidencePayload(CANON.unboundLivepeerAssetId, 2)),
  });
  expect(unauthorized.status).toBe(401);
  notes.push("A: unauthenticated inspection persistence is rejected");

  await applyAuthoritySession(context, baseURL);
  await page.goto(ROUTES.authorityUnboundInspect, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Inspecting Asset")).toBeVisible();
  const before = await snapshotCanon(svc);
  const { count: sessionsBefore } = await svc
    .from("inspection_session")
    .select("*", { count: "exact", head: true })
    .eq("asset_id", CANON.unboundLivepeerAssetId);
  const { count: muxSessionsBefore } = await svc
    .from("inspection_session")
    .select("*", { count: "exact", head: true })
    .eq("asset_id", CANON.muxAssetId);

  try {
    const missing = await postInspect(page, evidencePayload(MISSING_ASSET, 2));
    expect(missing.status).toBe(404);
    notes.push("B: nonexistent media asset is rejected");

    const invalid = await postInspect(page, evidencePayload("not-an-asset", 2));
    expect(invalid.status).toBe(400);
    notes.push("C: invalid asset scope is rejected");

    const first = await postInspect(page, evidencePayload(CANON.unboundLivepeerAssetId, 2));
    expect(first.status).toBe(201);
    expect(first.body.observation_count).toBe(2);
    expect(typeof first.body.session_id).toBe("string");
    createdSessions.push(first.body.session_id);

    const second = await postInspect(page, evidencePayload(CANON.unboundLivepeerAssetId, 4));
    expect(second.status).toBe(201);
    expect(second.body.session_id).not.toBe(first.body.session_id);
    expect(second.body.observation_count).toBe(4);
    createdSessions.push(second.body.session_id);
    notes.push("D: unbound media persist creates a new historical session rather than overwriting");

    const masterScoped = await postInspect(page, evidencePayload(CANON.unboundLivepeerAssetId, 3, CANON.universeId));
    expect(masterScoped.status).toBe(201);
    createdSessions.push(masterScoped.body.session_id);
    notes.push("E: optional master-scoped persist remains valid and still anchors to the media asset");

    const { data: firstSession } = await svc
      .from("inspection_session")
      .select("session_id, asset_id, status, frame_count")
      .eq("session_id", first.body.session_id)
      .single();
    expect(firstSession?.asset_id).toBe(CANON.unboundLivepeerAssetId);
    const { data: firstObs } = await svc
      .from("frame_observation")
      .select("observation_id, time_ms, mean_luminance, change_score, is_boundary_candidate")
      .eq("session_id", first.body.session_id)
      .order("order_index", { ascending: true });
    expect(firstObs?.length).toBe(2);
    expect(firstObs?.[0]?.mean_luminance).not.toBeNull();
    expect(firstObs?.[0]?.is_boundary_candidate).toBe(true);
    const { data: secondStill } = await svc
      .from("inspection_session")
      .select("session_id")
      .eq("session_id", first.body.session_id)
      .maybeSingle();
    expect(secondStill?.session_id).toBe(first.body.session_id);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Inspecting Asset")).toBeVisible();
    await expect(page.getByText("Saved inspections")).toBeVisible();
    await expect(page.getByText("2 observations").first()).toBeVisible();
    await expect(page.getByText("4 observations").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Media Inspection" })).toBeVisible();
    notes.push("F: saved inspections remain after navigation");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Saved inspections")).toBeVisible();
    await expect(page.getByText("2 observations").first()).toBeVisible();
    notes.push("G: saved inspections remain after refresh");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Run Inspection" })).toBeVisible();
    await expect(page.getByText("Saved inspections")).toBeVisible();
    notes.push("H: 390px keeps inspect controls and saved status usable");

    const videoReady = await page
      .getByText(/ready to inspect|Duration /i)
      .first()
      .isVisible()
      .catch(() => false);
    if (videoReady) {
      await page.getByLabel("Frames to sample").fill("5");
      await page.getByRole("button", { name: "Run Inspection" }).click();
      await expect(page.getByText(/Inspection complete/)).toBeVisible({ timeout: 120_000 });
      await page.getByRole("button", { name: "Save inspection" }).click();
      await expect(page.getByRole("status")).toContainText("Inspection saved");
      const listed = page.getByText("5 observations");
      await expect(listed.first()).toBeVisible();
      const { data: latest } = await svc
        .from("inspection_session")
        .select("session_id, frame_count")
        .eq("asset_id", CANON.unboundLivepeerAssetId)
        .eq("frame_count", 5)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.session_id) createdSessions.push(latest.session_id);
      notes.push("I: Inspect UI saved an observational run against unbound media");
    } else {
      notes.push("I: player not ready for a live sample; API persist + saved list verified");
    }

    const after = await snapshotCanon(svc);
    expect(after.universe).toEqual(before.universe);
    expect(after.mural).toEqual(before.mural);
    expect(after.scenes).toEqual(before.scenes);
    expect(after.bindings).toEqual(before.bindings);
    expect(after.moments).toEqual(before.moments);
    expect(after.realizationCount).toBe(before.realizationCount);
    expect(after.masterCount).toBe(before.masterCount);
    expect(after.projectionCount).toBe(before.projectionCount);
    const { count: muxSessionsAfter } = await svc
      .from("inspection_session")
      .select("*", { count: "exact", head: true })
      .eq("asset_id", CANON.muxAssetId);
    expect(muxSessionsAfter).toBe(muxSessionsBefore);
    notes.push("J: Super Hero Ego Universe, Mural, Scenes, timings, order, presence, Mux sessions, and realization are unchanged");
  } finally {
    if (createdSessions.length > 0) {
      await svc.from("inspection_session").delete().in("session_id", createdSessions);
    }
  }

  const { count: sessionsAfterCleanup } = await svc
    .from("inspection_session")
    .select("*", { count: "exact", head: true })
    .eq("asset_id", CANON.unboundLivepeerAssetId);
  expect(sessionsAfterCleanup).toBe(sessionsBefore ?? 0);

  assertRuntimeHealth(observe, {
    allowFailedUrl: (url, status) =>
      url.includes("/api/authority/media/inspect") && (status === 400 || status === 404),
  });
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 3.8 Sentinel source-media persist", page.url(), notes, observe);
});
