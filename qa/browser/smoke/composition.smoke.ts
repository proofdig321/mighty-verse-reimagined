import { CANON, CREATIVE_MOMENTS, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";
import { expectCreativeSuiteComposition } from "../lib/suite-composition";

test("Creative Suite presents Super Hero Ego as a composition surface", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(120_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);

  await page.goto(ROUTES.authority, { waitUntil: "domcontentloaded" });
  await page.getByRole("navigation", { name: "Authority" }).getByRole("link", { name: "Universes", exact: true }).click();
  await page.locator(`a[href="${ROUTES.authorityUniverseWorkspace}"]`).filter({ hasText: CANON.universeTitle }).first().click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseWorkspace}$`));
  await expectCreativeSuiteComposition(page);
  notes.push("A: Authority → Universes → Super Hero Ego reads as routed Creative Studio workspaces");

  await page.goto(ROUTES.authorityUniverseScenes, { waitUntil: "domcontentloaded" });
  const scenes = page.locator("section[aria-labelledby='universe-scenes']");
  const moments = page.locator("section[aria-labelledby='universe-moments']");
  await expect(scenes.locator("article[data-scene-id]")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /shuffle/i })).toHaveCount(0);
  notes.push("B: four face-up named numbered Scenes; no table rows, no shuffle");

  await expect(moments.getByRole("heading", { name: "Proverb", exact: true })).toHaveCount(1);
  await expect(moments.getByRole("heading", { name: "Mothipa", exact: true })).toHaveCount(1);
  await expect(moments.getByRole("heading", { name: "Reason", exact: true })).toHaveCount(1);
  notes.push("C: Proverb, Mothipa, Reason exist once as Creative Moment objects");

  const proverb = moments.locator(`#universe-moment-${CREATIVE_MOMENTS.proverb.masterId}`);
  const powerhouse = scenes.locator(`#universe-scene-${SCENE_MOMENTS.powerhouse.sceneMasterId}`);
  await powerhouse.hover();
  await expect(proverb).toHaveAttribute("data-related", "");
  await proverb.hover();
  await expect(powerhouse).toHaveAttribute("data-related", "");
  await expect(scenes.locator(`#universe-scene-${SCENE_MOMENTS.handToHand.sceneMasterId}`)).toHaveAttribute("data-related", "");
  notes.push("D: Proverb relates to Powerhouse and Hand-to-Hand without duplicating Proverb");

  await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" });
  const mural = page.locator("section[aria-labelledby='universe-mural']");
  await expect(mural.getByText(/audiovisual expression/i)).toBeVisible();
  await expect(mural.locator("video")).toHaveCount(0);
  notes.push("E: Mural is stage presence without a second Experience player");

  await page.goto(ROUTES.authorityUniverseScenes, { waitUntil: "domcontentloaded" });
  await scenes.locator(`#universe-scene-${SCENE_MOMENTS.powerhouse.sceneMasterId}`).getByRole("link", { name: /Open record/i }).click();
  await expect(page).toHaveURL(new RegExp(`/authority/${SCENE_MOMENTS.powerhouse.sceneMasterId}`));
  await page.goto(ROUTES.authorityUniverseScenes, { waitUntil: "domcontentloaded" });
  await moments.locator(`#universe-moment-${CREATIVE_MOMENTS.proverb.masterId}`).getByRole("link", { name: /Open record/i }).click();
  await expect(page).toHaveURL(new RegExp(`/authority/${CREATIVE_MOMENTS.proverb.masterId}`));
  notes.push("F: existing Open record routes still work");

  await page.goto(ROUTES.authorityUniverseScenes, { waitUntil: "domcontentloaded" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  await expect(scenes.locator("article[data-scene-id]")).toHaveCount(4);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflowX, `narrow viewport horizontal overflow ${overflowX}px`).toBeLessThan(24);
  notes.push("G: narrower viewport keeps four Scene objects without trapping the suite in nested catalogue tables");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(ROUTES.authorityMuxAsset, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Continue in Curate", exact: true })).toHaveAttribute(
    "href",
    ROUTES.authorityCurateMuxAsset,
  );
  await page.goto(ROUTES.authorityCreate, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/authority\/create/);
  await expect(page.getByRole("heading", { name: /Create Work/i })).toBeVisible();
  notes.push("H: Stage 2.8 Continue in Curate remains; Create Work stays an independent route");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 2.9 Creative Suite composition", page.url(), notes, observe);
});
