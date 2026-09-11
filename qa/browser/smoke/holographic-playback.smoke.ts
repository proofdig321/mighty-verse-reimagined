import { CANON, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { readVideoSnapshot, samplePaintedFrame, tryStartNativeVideoPlayback } from "../lib/playback";
import { captureScreenshot, muxMediaRequests, reportEvidence } from "../lib/observe";

test("Super Hero Ego holographic Experience plays Mux mural through canonical Scenes", async ({ page, observe }, testInfo) => {
  test.setTimeout(120_000);
  const notes: string[] = [];
  const response = await page.goto(ROUTES.universeHolographic, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `holographic HTTP ${response?.status()}`).toBeTruthy();
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  await expect(page.locator("[data-holographic-kind='mural']")).toHaveCount(1);
  await expect(page.locator("[data-holographic-kind='scene']")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restart" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Mute|Unmute/ })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Experience progress" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Canonical Scene Exploration" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Creative Moments & Contributors" })).toBeVisible();
  await expect(page.locator("[data-holographic-kind='moment']")).toHaveCount(3);
  await expect(page.locator("[data-holographic-kind='moment'] img")).toHaveCount(3);
  await expect(page.locator(`[data-holographic-kind='scene'][data-master-id='${SCENE_MOMENTS.swordMaster.sceneMasterId}']`)).toContainText(/Reason/i);
  await expect(page.locator("[data-holographic-cinema]")).toHaveCount(1);
  await expect(page.locator("[data-holographic-theater]")).toHaveCount(1);
  await expect(page.locator("text=/production-plan:/i")).toHaveCount(0);
  await expect(page.locator(".holographic-transport")).not.toContainText(CANON.universeId);
  notes.push("A: Experience presents Super Hero Ego without internal identifiers in the transport");

  const player = page.locator("[data-holographic-kind='mural'] video");
  await expect(player).toHaveCount(1);

  await expect
    .poll(
      () => observe.requests.some((entry) => entry.url.includes(CANON.muxStreamHost)),
      { timeout: 20000 },
    )
    .toBeTruthy();

  const muralBox = await player.boundingBox();
  const sceneBox = await page.locator("[data-holographic-kind='scene'] img").first().boundingBox();
  expect(muralBox?.width ?? 0, "mural video is the cinematic surface").toBeGreaterThan(480);
  expect((muralBox?.width ?? 0) > (sceneBox?.width ?? 0), "mural is larger than Scene stills").toBeTruthy();

  await page.getByRole("button", { name: "Play" }).click();
  await expect
    .poll(async () => {
      await tryStartNativeVideoPlayback(player);
      const snapshot = await readVideoSnapshot(player);
      const painted = await samplePaintedFrame(player);
      return !snapshot.paused && snapshot.currentTime > 0.15 && snapshot.videoWidth > 16 && painted.painted;
    }, { timeout: 25000 })
    .toBeTruthy();
  await expect(page.locator("[data-holographic-playing='true']")).toHaveCount(1);
  notes.push("B: Play starts decoded Mux mural video with audio unlocked");
  await expect(page.locator("[data-holographic-muted='false']")).toHaveCount(1);

  const powerhouse = page.locator(`[data-holographic-kind='scene'][data-master-id='${SCENE_MOMENTS.powerhouse.sceneMasterId}']`);
  await powerhouse.click();
  await expect
    .poll(async () => {
      const snapshot = await readVideoSnapshot(player);
      return snapshot.currentTime >= 35;
    }, { timeout: 15000 })
    .toBeTruthy();
  notes.push("B2: Scene selection seeks the mural without changing canonical timing");

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.locator("[data-holographic-playing='false']")).toHaveCount(1);
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  notes.push("C: Pause and Restart return the Experience to a stopped clock");

  for (const scene of Object.values(SCENE_MOMENTS)) {
    await expect(page.locator(`[data-holographic-kind='scene'][data-master-id='${scene.sceneMasterId}']`)).toBeVisible();
  }
  expect(muxMediaRequests(observe).length).toBeGreaterThan(0);
  await captureScreenshot(page, testInfo, "holographic-experience-play");
  reportEvidence(testInfo, "BROWSER VERIFIED", "Holographic Experience Mux playback", page.url(), notes, observe);
});
