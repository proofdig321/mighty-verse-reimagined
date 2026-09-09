import { ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

const ORDER = [
  SCENE_MOMENTS.powerhouse,
  SCENE_MOMENTS.darkKnight,
  SCENE_MOMENTS.handToHand,
  SCENE_MOMENTS.swordMaster,
];

async function restoreSceneOrder(page: import("@playwright/test").Page) {
  await page.evaluate(async (orders) => {
    await fetch("/api/authority/masters/sort-order", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders }),
    });
  }, ORDER.map((scene, index) => ({ master_id: scene.sceneMasterId, sort_order: index + 1 })));
}

test("Creative Suite authors canonical Scene order without importing Scene Deck shuffle", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(120_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";

  const unauthorized = await fetch(`${baseURL}/api/authority/masters/sort-order`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orders: ORDER.map((scene, index) => ({ master_id: scene.sceneMasterId, sort_order: index + 1 })),
    }),
  });
  expect([401, 403]).toContain(unauthorized.status);
  notes.push("A: unauthenticated Scene order mutation is rejected");

  await applyAuthoritySession(context, baseURL);
  await page.goto(ROUTES.authorityUniversePowerhouse, { waitUntil: "domcontentloaded" });
  await restoreSceneOrder(page);
  await page.reload({ waitUntil: "domcontentloaded" });

  try {
    await expect(page.getByRole("button", { name: /shuffle/i })).toHaveCount(0);
    const powerhouse = page.locator(`#universe-scene-${SCENE_MOMENTS.powerhouse.sceneMasterId}`);
    await expect(powerhouse.locator(".suite-scene-ordinal")).toHaveText("01");
    await expect(powerhouse.getByRole("button", { name: "Move earlier" })).toBeDisabled();
    notes.push("B: canonical order is 01 Powerhouse; no shuffle control");

    await powerhouse.getByRole("button", { name: "Move later" }).click();
    await expect(powerhouse.locator(".suite-scene-ordinal")).toHaveText("02");
    await expect(powerhouse.getByRole("heading", { name: /Scene 02\. Powerhouse/ })).toBeVisible();
    await page.goto(ROUTES.authorityUniverseScenes, { waitUntil: "domcontentloaded" });
    const deck = page.locator("section[aria-labelledby='universe-scenes']");
    await expect(deck.locator(`#universe-scene-${SCENE_MOMENTS.darkKnight.sceneMasterId}`).locator(".suite-scene-ordinal")).toHaveText("01");
    await expect(deck.locator(`#universe-scene-${SCENE_MOMENTS.powerhouse.sceneMasterId}`).locator(".suite-scene-ordinal")).toHaveText("02");
    notes.push("C: Move later swaps Powerhouse with Dark Knight without mutating public Scene Deck");
  } finally {
    await page.goto(ROUTES.authorityUniverseScenes, { waitUntil: "domcontentloaded" }).catch(() => null);
    await restoreSceneOrder(page);
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  const restoredPowerhouse = page.locator(`#universe-scene-${SCENE_MOMENTS.powerhouse.sceneMasterId}`);
  const restoredDarkKnight = page.locator(`#universe-scene-${SCENE_MOMENTS.darkKnight.sceneMasterId}`);
  await expect(restoredPowerhouse.locator(".suite-scene-ordinal")).toHaveText("01");
  await expect(restoredDarkKnight.locator(".suite-scene-ordinal")).toHaveText("02");
  notes.push("D: Super Hero Ego canonical Scene order is restored");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 3.7 canonical Scene order", page.url(), notes, observe);
});
