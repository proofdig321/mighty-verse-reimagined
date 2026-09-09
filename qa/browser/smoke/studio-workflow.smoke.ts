import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CANON, CREATIVE_MOMENTS, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";
import { expectCreativeSuiteComposition } from "../lib/suite-composition";

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
  if (!url || !key) throw new Error("Studio workflow QA needs Supabase URL and service role.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function snapshotCanon(svc: ReturnType<typeof serviceClient>) {
  const [{ data: scenes }, { data: bindings }, { data: muralBinding }, { count: realizationCount }, { data: presence }] =
    await Promise.all([
      svc.from("master").select("master_id, parent_master_id, sort_order").in("master_id", SCENE_IDS),
      svc.from("projection_media_binding").select("binding_id, asset_id, start_ms, end_ms").in("binding_id", BINDING_IDS),
      svc
        .from("projection_media_binding")
        .select("binding_id, asset_id")
        .eq("binding_id", CANON.muralBindingId)
        .maybeSingle(),
      svc.from("media_realization").select("*", { count: "exact", head: true }),
      svc.from("scene_moment").select("scene_master_id, moment_master_id").in("scene_master_id", SCENE_IDS),
    ]);
  return {
    scenes: (scenes ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    bindings: (bindings ?? []).slice().sort((a, b) => a.binding_id.localeCompare(b.binding_id)),
    muralBinding,
    realizationCount: realizationCount ?? 0,
    presence: (presence ?? []).slice().sort((a, b) => `${a.scene_master_id}:${a.moment_master_id}`.localeCompare(`${b.scene_master_id}:${b.moment_master_id}`)),
  };
}

test("unauthenticated Sentinel authorise remains rejected from Studio workflow", async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  const unauthorized = await fetch(`${baseURL}/api/authority/sentinel/authorise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ universe_id: CANON.universeId }),
  });
  expect(unauthorized.status).toBe(401);
});

test("dashboard follows Super Hero Ego production path into Studio then Experience", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(180_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  const svc = serviceClient();
  const before = await snapshotCanon(svc);

  await applyAuthoritySession(context, baseURL);

  await page.goto(ROUTES.authority, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Authority Console/i })).toBeVisible();
  const suiteCta = page.locator(`a[href="${ROUTES.authorityUniverses}"]`).filter({ hasText: "2.5D Preview" });
  await expect(suiteCta).toHaveAttribute("href", ROUTES.authorityUniverses);
  notes.push("A: dashboard exposes Creative Suite production path without a hidden holographic route");

  await suiteCta.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverses}$`));
  await page.locator(`a[href="${ROUTES.authorityUniverseWorkspace}"]`).filter({ hasText: CANON.universeTitle }).first().click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseWorkspace}$`));
  await expectCreativeSuiteComposition(page);
  notes.push("B: Universes → Super Hero Ego Creative Suite shows source, Sentinel, storyboard, proposals, and in-suite 2.5D");

  const preview = page.locator("section[aria-labelledby='universe-preview']");
  await preview.getByRole("button", { name: "2D composition" }).click();
  await expect(preview.locator("[data-preview-scene]")).toHaveCount(4);
  await preview.getByRole("button", { name: "2.5D Studio Preview" }).click();
  await expect(preview.locator("[data-holographic-kind='scene']")).toHaveCount(4);
  await expect(preview.locator("[data-holographic-kind='moment']")).toHaveCount(3);
  notes.push("C: Studio Preview switches 2D composition and 2.5D without leaving Creative Suite");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "Creative production path" })).toBeVisible();
  await expect(page.locator("[data-suite-source-preview] video")).toHaveCount(1);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflowX, `narrow Studio overflow ${overflowX}px`).toBeLessThan(24);
  notes.push("D: 390px keeps production path and source preview usable");
  await page.setViewportSize({ width: 1280, height: 800 });

  const continuation = page.locator("section[aria-labelledby='universe-experience-continuation']");
  await continuation.getByRole("link", { name: /Enter Experience/i }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeLive}$`));
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  notes.push("E: Experience is the Studio continuation into /worlds/{universeId}");

  await page.goto(ROUTES.universeHolographic, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-holographic-kind='mural']")).toHaveCount(1);
  await expect(page.locator("[data-holographic-kind='scene']")).toHaveCount(4);
  await expect(page.locator("[data-holographic-kind='moment']")).toHaveCount(3);
  notes.push("F: public holographic Experience remains intact");

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

  const after = await snapshotCanon(svc);
  expect(after.scenes).toEqual(before.scenes);
  expect(after.bindings).toEqual(before.bindings);
  expect(after.muralBinding?.asset_id).toBe(CANON.muxAssetId);
  expect(after.realizationCount).toBe(before.realizationCount);
  expect(after.presence).toEqual(before.presence);
  expect(after.scenes).toHaveLength(4);
  expect(after.presence.filter((row) => row.moment_master_id === CREATIVE_MOMENTS.proverb.masterId)).toHaveLength(2);
  notes.push("H: Super Hero Ego remains four Scenes, Proverb shared, Mux binding intact, no media_realization");

  assertRuntimeHealth(observe, {
    allowFailedUrl: (url, status) =>
      url.includes("/api/authority/sentinel/authorise") && (status === 400 || status === 401),
  });
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 4.0 Creative Suite production path", page.url(), notes, observe);
});
