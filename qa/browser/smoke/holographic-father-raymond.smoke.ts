import { CANON, ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { readVideoSnapshot, tryStartNativeVideoPlayback } from "../lib/playback";
import { reportEvidence } from "../lib/observe";

test.use({ screenshot: "off" });

test("Father Raymond holographic Experience plays the mural Mux without inventing Scenes", async ({ page, observe }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const response = await page.goto(ROUTES.fatherRaymondHolographic, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `Father Raymond holographic HTTP ${response?.status()}`).toBeTruthy();
  await expect(page.getByRole("heading", { name: new RegExp(CANON.fatherRaymondTitleIncludes, "i") })).toBeVisible();
  await expect(page.locator("[data-holographic-cinema]")).toHaveCount(1);
  await expect(page.locator("[data-holographic-cinema]")).toHaveAttribute("data-hologram", "live");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  // FR now has 4 authorised canonical Scenes — the holographic Experience renders them
  await expect(page.locator("[data-holographic-kind='scene']")).toHaveCount(4);
  notes.push("Father Raymond Experience renders its 4 canonical Scenes in the holographic cinema");

  const player = page.locator("[data-holographic-kind='mural'] video");
  await expect(player).toHaveCount(1);
  await expect
    .poll(
      () =>
        observe.requests.some(
          (entry) => entry.url.includes(CANON.muxStreamHost) && entry.url.includes(CANON.fatherRaymondPlaybackId),
        ),
      { timeout: 20_000 },
    )
    .toBeTruthy();

  await page.getByRole("button", { name: "Play" }).click();
  await expect
    .poll(
      async () => {
        await tryStartNativeVideoPlayback(player);
        const snapshot = await readVideoSnapshot(player);
        return !snapshot.paused && snapshot.currentTime > 0.15 && snapshot.videoWidth > 16;
      },
      { timeout: 25_000 },
    )
    .toBeTruthy();
  notes.push("Play starts Father Raymond Mux mural video");

  reportEvidence(testInfo, "BROWSER VERIFIED", "Father Raymond holographic mural clock", page.url(), notes, observe);
});
