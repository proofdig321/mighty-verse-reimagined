import { CANON, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { readVideoSnapshot, sampleCinemaOrientation, samplePaintedFrame, tryStartNativeVideoPlayback, readTheaterSync } from "../lib/playback";
import { muxMediaRequests, reportEvidence } from "../lib/observe";

test.use({ screenshot: "off" });

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
  await expect
    .poll(async () => page.locator("[data-holographic-theater]").getAttribute("data-holographic-warp"), { timeout: 20000 })
    .toBe("live");
  notes.push("B1: Mux frames are bound as the WebGL video texture");
  await expect(page.locator("[data-holographic-theater]")).toHaveAttribute("data-holographic-flip-y", "false");
  await expect(page.locator("[data-holographic-theater]")).toHaveAttribute("data-holographic-parallax", "0.75");
  await expect
    .poll(async () => {
      const orientation = await sampleCinemaOrientation(page);
      return orientation.upright;
    }, { timeout: 10000 })
    .toBeTruthy();
  const orientation = await sampleCinemaOrientation(page);
  notes.push(
    `B1c: Mux WebGL texture is right-side up (texture.flipY=false); luma unflipped=${orientation.unflipped.toFixed(3)} flipped=${orientation.flipped.toFixed(3)}`,
  );

  const cinema = page.locator("[data-holographic-cinema]");
  const cinemaBox = await cinema.boundingBox();
  expect(cinemaBox, "cinema has a pointer surface").toBeTruthy();
  if (cinemaBox) {
    await page.mouse.move(cinemaBox.x + 8, cinemaBox.y + cinemaBox.height / 2);
    await expect
      .poll(async () => Number(await page.locator("[data-holographic-theater]").getAttribute("data-holographic-pan")), { timeout: 5000 })
      .toBeLessThan(-0.4);
    await page.mouse.move(cinemaBox.x + cinemaBox.width - 8, cinemaBox.y + cinemaBox.height / 2);
    await expect
      .poll(async () => Number(await page.locator("[data-holographic-theater]").getAttribute("data-holographic-pan")), { timeout: 5000 })
      .toBeGreaterThan(0.4);
  }
  notes.push("B1b: Cursor left pans audio left and right pans audio right");

  const playingSync = await readTheaterSync(page);
  expect(playingSync.texUploads, "playing Mux cinema uploads video frames").toBeGreaterThan(0);
  expect(playingSync.texPath, "steady Mux resolution uses texSubImage2D").toBe("subimage");
  notes.push(
    `B1d: playing draws=${playingSync.draws} uploads=${playingSync.texUploads} path=${playingSync.texPath} parallax=${playingSync.parallax.toFixed(2)}`,
  );

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
  const pausedClock = await readVideoSnapshot(player);
  const pausedAt = await readTheaterSync(page);
  await expect
    .poll(async () => {
      const next = await readTheaterSync(page);
      const clock = await readVideoSnapshot(player);
      return (
        next.draws > pausedAt.draws + 6 &&
        next.warp === "live" &&
        Math.abs(clock.currentTime - pausedClock.currentTime) < 0.05
      );
    }, { timeout: 4000 })
    .toBeTruthy();
  const pausedSync = await readTheaterSync(page);
  notes.push(
    `B1e: paused Mux clock holds while rAF/texSubImage2D continue (draws ${pausedAt.draws}→${pausedSync.draws}, warp=${pausedSync.warp})`,
  );
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  notes.push("C: Pause and Restart return the Experience to a stopped clock");

  for (const scene of Object.values(SCENE_MOMENTS)) {
    await expect(page.locator(`[data-holographic-kind='scene'][data-master-id='${scene.sceneMasterId}']`)).toBeVisible();
  }
  expect(muxMediaRequests(observe).length).toBeGreaterThan(0);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Holographic Experience Mux playback", page.url(), notes, observe);
});
