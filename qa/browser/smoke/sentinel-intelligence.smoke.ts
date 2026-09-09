import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CANON, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";
import { expectCreativeSuiteComposition } from "../lib/suite-composition";

const SCENE_IDS = Object.values(SCENE_MOMENTS).map((scene) => scene.sceneMasterId);
const BINDING_IDS = Object.values(SCENE_MOMENTS).map((scene) => scene.bindingId);
const MISSING_SCENE = "00000000-0000-0000-0000-000000000000";

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
  if (!url || !key) throw new Error("Sentinel intelligence QA needs Supabase URL and service role.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function snapshotWindows(svc: ReturnType<typeof serviceClient>) {
  const [
    { data: scenes },
    { data: bindings },
    { count: realizationCount },
    { count: masterCount },
    { count: muxSessions },
  ] = await Promise.all([
    svc.from("master").select("master_id, parent_master_id, sort_order, current_state_id").in("master_id", SCENE_IDS),
    svc.from("projection_media_binding").select("binding_id, asset_id, start_ms, end_ms").in("binding_id", BINDING_IDS),
    svc.from("media_realization").select("*", { count: "exact", head: true }),
    svc.from("master").select("*", { count: "exact", head: true }),
    svc.from("inspection_session").select("*", { count: "exact", head: true }).eq("asset_id", CANON.muxAssetId),
  ]);
  return {
    scenes: (scenes ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    bindings: (bindings ?? []).slice().sort((a, b) => a.binding_id.localeCompare(b.binding_id)),
    realizationCount: realizationCount ?? 0,
    masterCount: masterCount ?? 0,
    muxSessions: muxSessions ?? 0,
  };
}

async function restoreCanonicalWindows(svc: ReturnType<typeof serviceClient>) {
  for (const scene of Object.values(SCENE_MOMENTS)) {
    await svc
      .from("projection_media_binding")
      .update({ start_ms: scene.startMs, end_ms: scene.endMs })
      .eq("binding_id", scene.bindingId);
  }
}

test("Sentinel intelligence proposes windows without mutating Super Hero Ego", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(180_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  const svc = serviceClient();
  const before = await snapshotWindows(svc);

  const unauthorized = await fetch(`${baseURL}/api/authority/sentinel/authorise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ universe_id: CANON.universeId }),
  });
  expect(unauthorized.status).toBe(401);
  notes.push("A: unauthenticated Sentinel authorise is rejected");

  await applyAuthoritySession(context, baseURL);

  try {
    const skipped = await page.request.post("/api/authority/sentinel/authorise", {
      data: { universe_id: CANON.universeId, scene_master_ids: [MISSING_SCENE] },
    });
    expect(skipped.status()).toBe(400);
    notes.push("B: authorise with no matching Scene writes nothing");

    await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" });
    await expectCreativeSuiteComposition(page);
    const sentinel = page.locator("section[aria-labelledby='universe-sentinel']");
    await expect(sentinel.getByText("Golden Shovel — Powerhouse").first()).toBeVisible();
    await expect(sentinel.locator("[data-panel-kind='scene']")).toHaveCount(4);
    await expect(sentinel.locator("[data-animation-scene]")).toHaveCount(4);
    await expect(sentinel.getByRole("link", { name: "Open Inspect" })).toHaveAttribute("href", ROUTES.authorityMuxInspect);
    notes.push("C: Creative Suite Sentinel shows evidence, storyboard, animation plan, and four Scene proposals");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(sentinel.getByRole("heading", { name: "Storyboard" })).toBeVisible();
    await expect(sentinel.getByRole("button", { name: /Authorise Sentinel windows/i })).toBeVisible();
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX, `narrow Suite overflow ${overflowX}px`).toBeLessThan(24);
    notes.push("D: 390px keeps Sentinel storyboard and authorise usable");
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto(ROUTES.universeHolographic, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "2D", exact: true })).toHaveAttribute("href", ROUTES.universeLive);
    await expect(page.locator("[data-holographic-kind='mural']")).toHaveCount(1);
    await expect(page.locator("[data-holographic-kind='scene']")).toHaveCount(4);
    await expect(page.locator("[data-holographic-kind='moment']")).toHaveCount(3);
    for (const scene of Object.values(SCENE_MOMENTS)) {
      const timeSec = Math.floor(scene.startMs / 1000);
      await expect(page.locator(`[data-holographic-kind='scene'][data-master-id='${scene.sceneMasterId}'] img`)).toHaveAttribute(
        "src",
        new RegExp(`image\\.mux\\.com/${CANON.muxPlaybackId}/thumbnail\\.jpg\\?time=${timeSec}(?:&|$)`),
      );
    }
    await expect(page.locator(`[data-holographic-kind='moment'][data-master-id='${SCENE_MOMENTS.powerhouse.creativeMomentId}']`)).toBeVisible();
    notes.push("E: public 2.5D presents Mural, four Scene planes, and Creative Moments on canonical stills");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-holographic-kind='scene']")).toHaveCount(4);
    notes.push("F: 2.5D remains present at 390px");
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto(ROUTES.universeScenes, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /shuffle/i })).toBeVisible();
    for (const [index, scene] of Object.values(SCENE_MOMENTS).entries()) {
      const timeSec = Math.floor(scene.startMs / 1000);
      await page.getByRole("button", { name: `Go to scene ${index + 1}: ${scene.sceneTitle}`, exact: true }).click();
      await expect(page.locator(`[data-scene-id="${scene.sceneMasterId}"]`).getByRole("img", { name: scene.sceneTitle })).toHaveAttribute(
        "src",
        new RegExp(`image\\.mux\\.com/${CANON.muxPlaybackId}/thumbnail\\.jpg\\?time=${timeSec}(?:&|$)`),
      );
    }
    notes.push("G: Scene Deck stills remain Mux time=36/80/149/193");

    await page.goto(ROUTES.momentSwordMaster, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: "View in 2.5D" })).toHaveAttribute("href", ROUTES.universeHolographic);
    notes.push("H: Sword Master Moment continues into Super Hero Ego 2.5D");

    await page.goto(ROUTES.authorityMuxInspect, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: "Open Sentinel in Suite" })).toHaveAttribute(
      "href",
      `${ROUTES.authorityUniverseWorkspace}#universe-sentinel`,
    );
    notes.push("I: Mux Inspect links into Suite Sentinel without merging the surfaces");
  } finally {
    await restoreCanonicalWindows(svc);
  }

  const after = await snapshotWindows(svc);
  expect(after.scenes).toEqual(before.scenes);
  expect(after.bindings).toEqual(before.bindings);
  expect(after.realizationCount).toBe(before.realizationCount);
  expect(after.masterCount).toBe(before.masterCount);
  expect(after.muxSessions).toBe(before.muxSessions);

  assertRuntimeHealth(observe, {
    allowFailedUrl: (url, status) =>
      url.includes("/api/authority/sentinel/authorise") && (status === 400 || status === 401),
  });
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 3.9 Sentinel intelligence on Super Hero Ego", page.url(), notes, observe);
});
