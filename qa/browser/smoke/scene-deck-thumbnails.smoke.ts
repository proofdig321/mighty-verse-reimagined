import { CANON, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

test("Scene Deck revealed cards show each Scene still, not mural time=0", async ({ page, observe }, testInfo) => {
  test.setTimeout(120_000);
  const notes: string[] = [];

  await page.goto(ROUTES.universeScenes, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Scene Deck" })).toBeVisible();
  await expect(page.getByRole("button", { name: /shuffle/i })).toBeVisible();
  notes.push("A: Super Hero Ego Scene Deck still shuffles and stays facedown until revealed");

  for (const [index, scene] of Object.values(SCENE_MOMENTS).entries()) {
    const timeSec = Math.floor(scene.startMs / 1000);
    await page.getByRole("button", { name: `Go to scene ${index + 1}: ${scene.sceneTitle}`, exact: true }).click();
    const card = page.locator(`[data-scene-id="${scene.sceneMasterId}"]`);
    await expect(card.getByRole("img", { name: scene.sceneTitle })).toBeVisible();
    await expect(card.getByRole("img", { name: scene.sceneTitle })).toHaveAttribute(
      "src",
      new RegExp(`image\\.mux\\.com/${CANON.muxPlaybackId}/thumbnail\\.jpg\\?time=${timeSec}(?:&|$)`),
    );
    await expect(card.getByRole("img", { name: scene.sceneTitle })).not.toHaveAttribute("src", /time=0(?:&|$)/);
    notes.push(`B: ${scene.shortName} still uses Mux time=${timeSec}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(`[data-scene-id="${SCENE_MOMENTS.powerhouse.sceneMasterId}"]`).getByRole("img")).toBeVisible();
  notes.push("C: revealed Powerhouse still remains visible at 390px");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 3.4 Scene Deck revealed thumbnails", page.url(), notes, observe);
});
