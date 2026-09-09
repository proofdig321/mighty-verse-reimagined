import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CANON, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { captureScreenshot, reportEvidence } from "../lib/observe";
import { expectUniverseExperience } from "../lib/universe-experience";

/**
 * Stage 4.6 live Powerhouse proof. Navigation must consume this row, not
 * recreate it. These IDs are verification fixtures, not UI hard-codes.
 */
const LIVE_PRODUCTION = {
  realizationId: "041a0567-cccb-431b-94e1-aaab8422e7eb",
  mediaAssetId: "82fba04f-d313-411c-8f6b-3ea53c2c09ce",
  muxAssetId: "g004q8Ah8fLnTyV2vJwMN8r01DTUExpypfYwcWYnqsd7c",
  playbackId: "J01AIUNsiJzqQ5TK3QOYIU7ny025fHMn11vMrfiR4xLRE",
} as const;

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
  if (!url || !key) throw new Error("Experience discoverability QA needs Supabase URL and service role.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function snapshotProduction(svc: ReturnType<typeof serviceClient>) {
  const [
    { data: scenes },
    { data: bindings },
    { data: muralBinding },
    { count: realizationCount },
    { data: realization },
    { data: productionAsset },
    { count: muxAssetCount },
    { count: productionHashCount },
  ] = await Promise.all([
    svc.from("master").select("master_id, parent_master_id, sort_order").in("master_id", SCENE_IDS),
    svc.from("projection_media_binding").select("binding_id, asset_id, start_ms, end_ms").in("binding_id", BINDING_IDS),
    svc
      .from("projection_media_binding")
      .select("binding_id, asset_id")
      .eq("binding_id", CANON.muralBindingId)
      .maybeSingle(),
    svc.from("media_realization").select("*", { count: "exact", head: true }),
    svc
      .from("media_realization")
      .select("realization_id, master_id, version_label, production_notes")
      .eq("realization_id", LIVE_PRODUCTION.realizationId)
      .maybeSingle(),
    svc
      .from("media_asset")
      .select("asset_id, provider, provider_asset_id, storage_ref, realization_id")
      .eq("asset_id", LIVE_PRODUCTION.mediaAssetId)
      .maybeSingle(),
    svc.from("media_asset").select("*", { count: "exact", head: true }).eq("provider", "mux"),
    svc.from("media_asset").select("*", { count: "exact", head: true }).like("integrity_hash", "production:%"),
  ]);
  return {
    scenes: (scenes ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    bindings: (bindings ?? []).slice().sort((a, b) => a.binding_id.localeCompare(b.binding_id)),
    muralBinding,
    realizationCount: realizationCount ?? 0,
    realization,
    productionAsset,
    muxAssetCount: muxAssetCount ?? 0,
    productionHashCount: productionHashCount ?? 0,
  };
}

async function expectPublicHolographic(page: import("@playwright/test").Page) {
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeHolographic}$`));
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  await expect(page.locator("[data-holographic-kind='mural']")).toHaveCount(1);
  await expect(page.locator("[data-holographic-kind='scene']")).toHaveCount(4);
  await expect(page.locator("[data-holographic-kind='moment']")).toHaveCount(3);
  const production = page.locator("[data-holographic-kind='production']");
  await expect(production).toHaveCount(1);
  await expect(production).toHaveAttribute("data-master-id", SCENE_MOMENTS.powerhouse.sceneMasterId);
  await expect(production).toHaveAttribute("data-production-layer", "true");
}

test("dashboard Experience discovers Super Hero Ego 2.5D without mutating production", async ({
  page,
  observe,
  context,
}, testInfo) => {
  test.setTimeout(180_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  const svc = serviceClient();
  const before = await snapshotProduction(svc);
  expect(before.realizationCount).toBe(1);
  expect(before.realization?.realization_id).toBe(LIVE_PRODUCTION.realizationId);
  expect(before.realization?.master_id).toBe(SCENE_MOMENTS.powerhouse.sceneMasterId);
  expect(before.productionAsset?.asset_id).toBe(LIVE_PRODUCTION.mediaAssetId);
  expect(before.productionAsset?.provider_asset_id).toBe(LIVE_PRODUCTION.muxAssetId);
  expect(before.productionAsset?.storage_ref).toBe(LIVE_PRODUCTION.playbackId);
  expect(before.muralBinding?.asset_id).toBe(CANON.muxAssetId);

  await applyAuthoritySession(context, baseURL);

  await page.goto(ROUTES.authority, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Authority Console/i })).toBeVisible();
  const experienceCard = page.locator(`a[href="${ROUTES.universes}"]`).filter({ hasText: "Enter 2.5D from a work" });
  await expect(experienceCard).toBeVisible();
  await expect(experienceCard).toContainText("Distinct from Studio preview");
  notes.push("A: dashboard Experience stays a public Universes path, not a global 2.5D sidebar item");

  await experienceCard.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universes}$`));
  await expect(page.getByRole("heading", { name: /All Universes/i })).toBeVisible();
  const universeCard = page.locator(`a[href="${ROUTES.universeLive}"]`).filter({ hasText: CANON.universeTitle }).first();
  await expect(universeCard).toBeVisible();
  notes.push("B: Experience lands on public Universe discovery, not a hidden holographic URL");

  await universeCard.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeLive}$`));
  await expectUniverseExperience(page);
  const enterExperience = page.getByRole("link", { name: /Enter 2\.5D/i });
  await expect(enterExperience).toHaveAttribute("href", ROUTES.universeHolographic);
  await expect(enterExperience).toHaveAttribute("data-experience-entry", "2.5d");
  notes.push("C: Super Hero Ego World exposes Enter 2.5D to the existing holographic route");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(enterExperience).toBeVisible();
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflowX, `narrow Experience overflow ${overflowX}px`).toBeLessThan(24);
  notes.push("D: Enter 2.5D remains visible at 390px");

  await enterExperience.click();
  await expectPublicHolographic(page);
  await captureScreenshot(page, testInfo, "experience-discoverability-mobile-25d");
  notes.push("E: mobile Enter 2.5D opens public 2.5D with 1 mural, 4 scenes, 3 moments, 1 Powerhouse production layer");

  await page.setViewportSize({ width: 1280, height: 800 });
  await expectPublicHolographic(page);
  await captureScreenshot(page, testInfo, "experience-discoverability-desktop-25d");

  const after = await snapshotProduction(svc);
  expect(after.scenes).toEqual(before.scenes);
  expect(after.bindings).toEqual(before.bindings);
  expect(after.muralBinding).toEqual(before.muralBinding);
  expect(after.realizationCount).toBe(before.realizationCount);
  expect(after.realization).toEqual(before.realization);
  expect(after.productionAsset).toEqual(before.productionAsset);
  expect(after.muxAssetCount).toBe(before.muxAssetCount);
  expect(after.productionHashCount).toBe(before.productionHashCount);
  expect(after.scenes).toHaveLength(4);
  notes.push("F: navigating to Experience did not create media_realization, media_asset, or Mux rows");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 4.7 Experience discoverability", page.url(), notes, observe);
});

test("public Universes catalog reaches Super Hero Ego 2.5D without Authority", async ({ page, observe }, testInfo) => {
  await page.goto(ROUTES.universes, { waitUntil: "domcontentloaded" });
  await page.locator(`a[href="${ROUTES.universeLive}"]`).filter({ hasText: CANON.universeTitle }).first().click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeLive}$`));
  await page.getByRole("link", { name: /Enter 2\.5D/i }).click();
  await expectPublicHolographic(page);
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Public Universes 2.5D path", page.url(), [
    "unauthenticated Universes → Super Hero Ego → Enter 2.5D",
    `landed on ${ROUTES.universeHolographic}`,
    "public Experience does not require Authority permissions",
  ], observe);
});
