import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CANON, CREATIVE_MOMENTS, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { captureScreenshot, reportEvidence } from "../lib/observe";
import { expectUniverseExperience } from "../lib/universe-experience";

const LIVE_PRODUCTION = {
  realizationId: "041a0567-cccb-431b-94e1-aaab8422e7eb",
  mediaAssetId: "82fba04f-d313-411c-8f6b-3ea53c2c09ce",
  muxAssetId: "g004q8Ah8fLnTyV2vJwMN8r01DTUExpypfYwcWYnqsd7c",
  playbackId: "J01AIUNsiJzqQ5TK3QOYIU7ny025fHMn11vMrfiR4xLRE",
} as const;

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
  if (!url || !key) throw new Error("Product surface QA needs Supabase URL and service role.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function snapshotProduction(svc: ReturnType<typeof serviceClient>) {
  const [{ count: realizationCount }, { data: realization }, { count: muxAssetCount }] = await Promise.all([
    svc.from("media_realization").select("*", { count: "exact", head: true }),
    svc
      .from("media_realization")
      .select("realization_id, master_id, version_label, production_notes")
      .eq("realization_id", LIVE_PRODUCTION.realizationId)
      .maybeSingle(),
    svc.from("media_asset").select("*", { count: "exact", head: true }).eq("provider", "mux"),
  ]);
  return {
    realizationCount: realizationCount ?? 0,
    realization,
    muxAssetCount: muxAssetCount ?? 0,
  };
}

async function expectPublicExperience(page: import("@playwright/test").Page) {
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeHolographic}$`));
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  await expect(page.locator("[data-holographic-kind='mural']")).toHaveCount(1);
  await expect(page.locator("[data-holographic-kind='scene']")).toHaveCount(4);
  await expect(page.locator("[data-holographic-kind='moment']")).toHaveCount(3);
  const production = page.locator("[data-holographic-kind='production']");
  await expect(production).toHaveCount(1);
  await expect(production).toHaveAttribute("data-master-id", SCENE_MOMENTS.powerhouse.sceneMasterId);
}

test("Home click path reaches Super Hero Ego Experience without typing a URL", async ({ page, observe }, testInfo) => {
  test.setTimeout(180_000);
  const notes: string[] = [];
  const svc = serviceClient();
  const before = await snapshotProduction(svc);

  await page.goto(ROUTES.home, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /Explore Universes/i }).click();
  await expect(page).toHaveURL(/\/universes/);
  notes.push("clicked Explore Universes");

  await page.locator(`[data-universe-card="${CANON.universeId}"]`).filter({ hasText: CANON.universeTitle }).first().click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeLive}$`));
  await expectUniverseExperience(page);
  notes.push("clicked Super Hero Ego Universe card");

  await page.locator('[data-experience-entry="experience"]').first().click();
  await expectPublicExperience(page);
  await captureScreenshot(page, testInfo, "click-path-home-experience");
  notes.push(`clicked Enter Experience → ${ROUTES.universeHolographic}`);

  const after = await snapshotProduction(svc);
  expect(after).toEqual(before);
  expect(after.realizationCount).toBe(1);
  expect(after.realization?.realization_id).toBe(LIVE_PRODUCTION.realizationId);

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Home click path to Experience", page.url(), notes, observe);
});

test("Universe Mural Scene and Creative Moment click paths share one Experience", async ({ page, observe }, testInfo) => {
  test.setTimeout(180_000);
  const notes: string[] = [];

  await page.goto(ROUTES.home, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Universes", exact: true }).click();
  await page.locator(`[data-universe-card="${CANON.universeId}"]`).first().click();

  await page.getByRole("link", { name: /View Mural/i }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.muralLive}$`));
  await expect(page.getByText("Mural", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Back to Universe/i })).toBeVisible();
  await page.locator('[data-experience-entry="experience"]').first().click();
  await expectPublicExperience(page);
  notes.push("Universe → Mural → Enter Experience");

  await page.getByRole("link", { name: /Return to Universe/i }).click();
  await page.locator(`[data-scene-id="${SCENE_MOMENTS.powerhouse.sceneMasterId}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/moments/${SCENE_MOMENTS.powerhouse.projectionId}$`));
  await expect(page.getByText("Scene", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: SCENE_MOMENTS.powerhouse.sceneTitle })).toBeVisible();
  await expect(page.getByText("Experiential Moment")).toHaveCount(0);
  await expect(page.getByText("ERC-1155")).toHaveCount(0);
  await page.locator('[data-experience-entry="experience"]').first().click();
  await expectPublicExperience(page);
  notes.push("Universe → Powerhouse Scene → Enter Experience");

  await page.getByRole("link", { name: /Return to Universe/i }).click();
  await page.getByRole("link", { name: /Enter Scene Deck/i }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeScenes}$`));
  await expect(page.getByRole("heading", { name: /Scene Deck/i })).toBeVisible();
  await expect(page.locator('[data-experience-entry="experience"]').first()).toHaveAttribute("href", ROUTES.universeHolographic);
  await page.getByRole("link", { name: /Back to Universe/i }).click();
  await page
    .locator(`[data-moment-id="${CREATIVE_MOMENTS.proverb.masterId}"]`)
    .getByRole("link", { name: /View Creative Moment/i })
    .click();
  await expect(page).toHaveURL(new RegExp(`/creative-moments/${CREATIVE_MOMENTS.proverb.masterId}$`));
  await expect(page.getByText("Creative Moment", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Powerhouse", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hand-to-Hand", exact: true })).toBeVisible();
  await page.locator('[data-experience-entry="experience"]').first().click();
  await expectPublicExperience(page);
  await captureScreenshot(page, testInfo, "click-path-reveal-surfaces");
  notes.push("Universe → Proverb → Enter Experience");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Reveal surfaces click into Experience", page.url(), notes, observe);
});

test("Dashboard and header Creative Studio are reachable by clicking visible UI", async ({
  page,
  observe,
  context,
}, testInfo) => {
  test.setTimeout(180_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);

  await page.goto(ROUTES.home, { waitUntil: "domcontentloaded" });
  await page.locator('[data-product-nav="studio"]').first().click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverses}$`));
  await expect(page.getByText("Creative Studio").first()).toBeVisible();
  notes.push("Home header Creative Studio → Studio universe list");

  await page.getByRole("link", { name: CANON.universeTitle, exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseWorkspace}$`));
  await expect(page.getByText("Creative Studio").first()).toBeVisible();
  notes.push("clicked Super Hero Ego → Studio");

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authority}$`));
  await page.locator('[data-dashboard-surface="experience"]').first().click();
  await expect(page).toHaveURL(/\/universes\?intent=experience/);
  await page.locator(`[data-universe-card="${CANON.universeId}"]`).first().click();
  await page.locator('[data-experience-entry="experience"]').first().click();
  await expectPublicExperience(page);
  notes.push("Dashboard → Experience → Super Hero Ego → Enter Experience");

  await page.goto(ROUTES.home, { waitUntil: "domcontentloaded" });
  await page.locator('[data-product-nav="studio"]').first().click();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.locator('[data-dashboard-surface="studio"]').first().click();
  await page.locator(`a[href="${ROUTES.authorityUniverseWorkspace}"]`).filter({ hasText: CANON.universeTitle }).first().click();
  await page.locator("section[aria-labelledby='universe-experience-continuation']").getByRole("link", { name: /Enter Experience/i }).click();
  await expectPublicExperience(page);
  await captureScreenshot(page, testInfo, "click-path-studio-experience");
  notes.push("Dashboard → Creative Studio → Super Hero Ego → Enter Experience");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Dashboard and Studio click mounting", page.url(), notes, observe);
});
