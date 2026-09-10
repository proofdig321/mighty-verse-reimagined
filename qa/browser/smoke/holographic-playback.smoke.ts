import { CANON, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { readVideoSnapshot, tryStartNativeVideoPlayback } from "../lib/playback";
import { captureScreenshot, muxMediaRequests, reportEvidence } from "../lib/observe";

test("Super Hero Ego holographic Experience plays Mux mural through canonical Scenes", async ({ page, observe }, testInfo) => {
  test.setTimeout(120_000);
  const notes: string[] = [];
  const response = await page.goto(ROUTES.universeHolographic, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `holographic HTTP ${response?.status()}`).toBeTruthy();
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  await expect(page.locator("[data-holographic-kind='mural']")).toHaveCount(1);
  await expect(page.locator("[data-holographic-kind='scene']")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /Play|Load/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restart" })).toBeVisible();
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

  await page.getByRole("button", { name: /Play|Load/ }).click();
  await expect
    .poll(async () => {
      await tryStartNativeVideoPlayback(player);
      const snapshot = await readVideoSnapshot(player);
      return !snapshot.paused && snapshot.currentTime > 0.15;
    }, { timeout: 20000 })
    .toBeTruthy();
  await expect(page.locator("[data-holographic-playing='true']")).toHaveCount(1);
  notes.push("B: Play starts decoded Mux mural playback");

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.locator("[data-holographic-playing='false']")).toHaveCount(1);
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(page.getByRole("button", { name: /Play|Load/ })).toBeVisible();
  notes.push("C: Pause and Restart return the Experience to a stopped clock");

  for (const scene of Object.values(SCENE_MOMENTS)) {
    await expect(page.locator(`[data-holographic-kind='scene'][data-master-id='${scene.sceneMasterId}']`)).toBeVisible();
  }
  expect(muxMediaRequests(observe).length).toBeGreaterThan(0);
  await captureScreenshot(page, testInfo, "holographic-experience-play");
  reportEvidence(testInfo, "BROWSER VERIFIED", "Holographic Experience Mux playback", page.url(), notes, observe);
});
