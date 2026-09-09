import { CANON, CREATIVE_MOMENTS, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

const POWERHOUSE = SCENE_MOMENTS.powerhouse.sceneMasterId;
const REASON = CREATIVE_MOMENTS.reason.masterId;

async function restorePowerhouseReason(page: import("@playwright/test").Page) {
  await page.evaluate(async ({ universeId, sceneId, momentId }) => {
    await fetch(
      `/api/authority/scene-moment?universe_id=${universeId}&scene_master_id=${sceneId}&moment_master_id=${momentId}`,
      { method: "DELETE" },
    );
  }, { universeId: CANON.universeId, sceneId: POWERHOUSE, momentId: REASON });
}

test("Creative Suite authors Scene ↔ Creative Moment presence without mutating Super Hero Ego fixtures", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(120_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";

  const unauthorized = await fetch(`${baseURL}/api/authority/scene-moment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scene_master_id: POWERHOUSE,
      moment_master_id: REASON,
      universe_id: CANON.universeId,
    }),
  });
  expect([401, 403]).toContain(unauthorized.status);
  notes.push("A: unauthenticated presence mutation is rejected");

  await applyAuthoritySession(context, baseURL);
  await page.goto(ROUTES.authorityUniverseScenes, { waitUntil: "domcontentloaded" });
  await restorePowerhouseReason(page);

  try {
    const scenes = page.locator("section[aria-labelledby='universe-scenes']");
    const moments = page.locator("section[aria-labelledby='universe-moments']");
    const powerhouse = scenes.locator(`#universe-scene-${POWERHOUSE}`);
    const reason = moments.locator(`#universe-moment-${REASON}`);

    await expect(powerhouse.getByRole("link", { name: "Proverb", exact: true })).toBeVisible();
    await expect(reason.getByRole("link", { name: "Sword Master", exact: true })).toBeVisible();
    await expect(powerhouse.getByRole("link", { name: "Reason", exact: true })).toHaveCount(0);
    notes.push("B: Super Hero Ego Proverb/Reason presence is visible before mutation");

    await powerhouse.getByRole("button", { name: "Add presence" }).click();
    await powerhouse.getByRole("button", { name: "Add Reason to Powerhouse" }).focus();
    await expect(powerhouse.getByRole("button", { name: "Add Reason to Powerhouse" })).toBeFocused();
    await powerhouse.getByRole("button", { name: "Add Reason to Powerhouse" }).click();
    await expect(powerhouse.getByRole("link", { name: "Reason", exact: true })).toBeVisible();
    await expect(reason.getByRole("link", { name: "Powerhouse", exact: true })).toBeVisible();
    await expect(powerhouse.getByRole("link", { name: "Proverb", exact: true })).toBeVisible();
    notes.push("C: Reason can be present in Powerhouse without duplicating Proverb");

    await page.goto(ROUTES.universeLive, { waitUntil: "domcontentloaded" });
    const presence = page.locator("section[aria-labelledby='world-presence-heading']");
    await expect(presence.locator(`[data-moment-id="${REASON}"]`)).toContainText(/Powerhouse/);
    await expect(presence.locator(`[data-moment-id="${CREATIVE_MOMENTS.proverb.masterId}"]`)).toContainText(/identity/i);
    notes.push("D: Experience presence reflects the new relationship; Proverb stays identity-only");

    await page.goto(ROUTES.authorityUniverseScenes, { waitUntil: "domcontentloaded" });
    const powerhouseAfter = page.locator(`#universe-scene-${POWERHOUSE}`);
    await powerhouseAfter.getByRole("button", { name: "Remove Reason from Powerhouse" }).click();
    await powerhouseAfter.getByRole("button", { name: "Confirm remove presence" }).click();
    await expect(powerhouseAfter.getByRole("link", { name: "Reason", exact: true })).toHaveCount(0);
    await expect(powerhouseAfter.getByRole("link", { name: "Proverb", exact: true })).toBeVisible();
    notes.push("E: removing presence restores Powerhouse ↔ Proverb only");

    await page.goto(ROUTES.universeLive, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`[data-moment-id="${REASON}"]`)).not.toContainText(/Powerhouse/);
    await expect(page.getByRole("link", { name: /Enter Scene Deck/i })).toBeVisible();
    await page.goto(ROUTES.universeScenes, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Scene Deck" })).toBeVisible();
    await expect(page.getByRole("button", { name: /shuffle/i })).toBeVisible();
    notes.push("F: Experience and Scene Deck remain intact after restore");

    await page.goto(ROUTES.authorityUniverseScenes, { waitUntil: "domcontentloaded" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
    await expect(page.locator(`#universe-scene-${POWERHOUSE}`).getByRole("button", { name: "Add presence" })).toBeVisible();
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX, `narrow viewport horizontal overflow ${overflowX}px`).toBeLessThan(24);
    notes.push("G: 390px keeps presence authoring usable without horizontal overflow");
  } finally {
    await page.goto(ROUTES.authorityUniverseScenes, { waitUntil: "domcontentloaded" }).catch(() => null);
    await restorePowerhouseReason(page);
  }

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 3.2 Scene ↔ Creative Moment presence", page.url(), notes, observe);
});
