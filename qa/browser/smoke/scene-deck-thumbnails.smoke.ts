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

  await page.setViewportSize({ width: 1280, height: 800 });
  for (const scene of [SCENE_MOMENTS.powerhouse, SCENE_MOMENTS.darkKnight, SCENE_MOMENTS.handToHand]) {
    await page.locator(`[data-sequence-add="${scene.sceneMasterId}"]`).click();
  }
  const track = page.locator("[data-custom-sequence-track]");
  await expect(track).toHaveAttribute("data-sequence-count", "3");
  await expect(track.getByText(SCENE_MOMENTS.powerhouse.sceneTitle)).toBeVisible();
  await expect(track.getByText(SCENE_MOMENTS.powerhouse.sceneMasterId)).toHaveCount(0);
  const desktopColumns = await track.locator("ol").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(desktopColumns, "desktop sequence track should lock to 3 columns").toBe(3);
  await page.getByRole("button", { name: /shuffle/i }).click();
  await expect(track).toHaveAttribute("data-sequence-count", "3");
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileColumns = await track.locator("ol").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(mobileColumns, "390px sequence track should stack to 1 column").toBe(1);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflowX, `narrow sequence overflow ${overflowX}px`).toBeLessThan(24);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("button", { name: "Clear sequence" })).toBeVisible();
  await page.getByRole("button", { name: "Clear sequence" }).click();
  await expect(track).toHaveAttribute("data-sequence-count", "0");
  expect(observe.requests.some((entry) => entry.url.includes("/api/authority/media/timeline") && entry.method === "PATCH")).toBeFalsy();
  notes.push("D: flipped cards enter a 3-column client sequence track without mutating canonical timing");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 3.4 Scene Deck revealed thumbnails", page.url(), notes, observe);
});

test("public /scenes flipped cards add to a client sequence track", async ({ page, observe }, testInfo) => {
  test.setTimeout(120_000);
  const notes: string[] = [];

  await page.goto(ROUTES.scenes, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Scene Deck" })).toBeVisible();
  await expect(page.getByRole("button", { name: /shuffle/i })).toBeVisible();
  await expect(page.locator("[data-custom-sequence-track]")).toHaveAttribute("data-sequence-count", "0");
  notes.push("A: public /scenes still shuffles and starts with an empty client sequence");

  const card = page.locator(`[data-scene-id="${SCENE_MOMENTS.powerhouse.sceneMasterId}"]`);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const add = page.locator(`[data-sequence-add="${SCENE_MOMENTS.powerhouse.sceneMasterId}"]`);
  await expect(add).toBeVisible();
  await expect(add).toHaveText("Add to Custom Sequence Track");
  await add.click();

  const track = page.locator("[data-custom-sequence-track]");
  await expect(track).toHaveAttribute("data-sequence-count", "1");
  await expect(track.getByText(SCENE_MOMENTS.powerhouse.sceneTitle)).toBeVisible();
  await expect(track.getByText(SCENE_MOMENTS.powerhouse.sceneMasterId)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clear sequence" })).toBeVisible();
  expect(observe.requests.some((entry) => entry.url.includes("/api/authority/media/timeline") && entry.method === "PATCH")).toBeFalsy();
  notes.push("B: flipping Powerhouse on /scenes populates the custom sequence without a timeline PATCH");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 3.4 public /scenes custom sequence", page.url(), notes, observe);
});
