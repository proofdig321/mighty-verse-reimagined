import type { Page, TestInfo } from "@playwright/test";
import { expect } from "./fixtures";
import { CANON, ROUTES, type SceneMomentCanon } from "./canon";
import { assertRuntimeHealth } from "./health";
import {
  isMuxHlsAbort,
  readVideoSnapshot,
  samplePaintedFrame,
  tryStartNativeVideoPlayback,
} from "./playback";
import {
  captureScreenshot,
  livepeerRequests,
  muxMediaRequests,
  originBlockedStaticRequests,
  reportEvidence,
  type RuntimeObservation,
} from "./observe";

/**
 * Shared Scene-Moment playback assertions. Callers must already be on the
 * Moment route. Does not invent media identity — checks the page against
 * the live canonical Scene window and the shared Mux player.
 */
export async function assertCanonicalSceneMomentPlayback(args: {
  page: Page;
  observe: RuntimeObservation;
  testInfo: TestInfo;
  scene: SceneMomentCanon;
  arrival: string;
}): Promise<void> {
  const { page, observe, testInfo, scene, arrival } = args;
  const route = `/moments/${scene.projectionId}`;
  const startSec = scene.startMs / 1000;
  const endSec = scene.endMs / 1000;

  await expect(page).toHaveURL(new RegExp(`${route}$`));
  await expect(page.getByText(`Scene: ${scene.sceneTitle}`)).toBeVisible();
  await expect(page.getByRole("link", { name: CANON.muralTitle, exact: true })).toHaveAttribute(
    "href",
    ROUTES.muralLive,
  );
  await expect(page.getByRole("link", { name: scene.creativeMomentTitle, exact: true })).toHaveAttribute(
    "href",
    `/creative-moments/${scene.creativeMomentId}`,
  );

  const html = await page.content();
  const pageHasMuxHlsUrl = html.includes(`https://stream.mux.com/${CANON.muxPlaybackId}.m3u8`);
  expect(pageHasMuxHlsUrl, `${scene.shortName} page must deliver the Mux HLS URL`).toBeTruthy();

  const player = page.locator('video[aria-label="Mighty Verse media player"]');
  await expect(player).toBeVisible();
  await expect(player).toHaveJSProperty("tagName", "VIDEO");
  await expect(page.getByText("This media is unavailable right now.")).toHaveCount(0);

  const loadingGone = await page
    .getByText("Loading media")
    .waitFor({ state: "hidden", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  expect(loadingGone, `${scene.shortName} player must leave Loading media before Play`).toBeTruthy();

  await expect
    .poll(
      () => observe.requests.some((entry) => entry.url.includes(CANON.muxStreamHost)),
      { timeout: 15000 },
    )
    .toBeTruthy();

  await expect
    .poll(async () => (await readVideoSnapshot(player)).duration, { timeout: 15000 })
    .toBeGreaterThan(1);
  await expect
    .poll(async () => (await readVideoSnapshot(player)).readyState, { timeout: 15000 })
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(async () => (await readVideoSnapshot(player)).videoWidth, { timeout: 15000 })
    .toBeGreaterThan(0);

  await expect
    .poll(async () => (await readVideoSnapshot(player)).currentTime, { timeout: 15000 })
    .toBeGreaterThan(startSec - 1);

  const beforePlay = await readVideoSnapshot(player);
  expect(
    beforePlay.currentTime,
    `Scene timing must seek near ${startSec}s before Play (got ${beforePlay.currentTime})`,
  ).toBeGreaterThan(startSec - 1);
  expect(
    beforePlay.currentTime,
    `${scene.shortName} must not start at mural 0s when a Scene window exists`,
  ).toBeLessThan(endSec);

  await player.click();

  const playErrors: string[] = [];
  let playAttempt = await tryStartNativeVideoPlayback(player);
  await expect
    .poll(
      async () => {
        playAttempt = await tryStartNativeVideoPlayback(player);
        if (playAttempt.playError) playErrors.push(playAttempt.playError);
        const snapshot = await readVideoSnapshot(player);
        return playAttempt.playInvoked && !snapshot.paused;
      },
      { timeout: 15000 },
    )
    .toBeTruthy();

  await expect
    .poll(async () => (await readVideoSnapshot(player)).readyState, { timeout: 15000 })
    .toBeGreaterThanOrEqual(2);

  await expect
    .poll(async () => (await readVideoSnapshot(player)).currentTime, { timeout: 15000 })
    .toBeGreaterThan(beforePlay.currentTime + 0.2);

  await expect
    .poll(async () => (await readVideoSnapshot(player)).paused, { timeout: 10000 })
    .toBe(false);

  const afterPlay = await readVideoSnapshot(player);
  expect(afterPlay.currentTime).toBeLessThan(endSec + 1);
  expect(afterPlay.currentTime).toBeGreaterThan(startSec - 1);

  await expect
    .poll(async () => (await samplePaintedFrame(player)).painted, { timeout: 10000 })
    .toBe(true);
  const painted = await samplePaintedFrame(player);

  await player.evaluate((el, time) => {
    (el as HTMLVideoElement).currentTime = time;
  }, Math.max(startSec, endSec - 0.4));
  await expect
    .poll(async () => (await readVideoSnapshot(player)).currentTime, { timeout: 15000 })
    .toBeGreaterThan(endSec - 2);
  await tryStartNativeVideoPlayback(player);
  let endBoundary = "not-observed";
  await expect
    .poll(
      async () => {
        const snapshot = await readVideoSnapshot(player);
        if (snapshot.currentTime >= endSec + 1) {
          endBoundary = "overran";
          return "overran";
        }
        if (snapshot.paused && snapshot.currentTime <= startSec + 2) {
          endBoundary = "reset-to-start";
          return "ok";
        }
        if (snapshot.paused && snapshot.currentTime <= endSec + 0.5) {
          endBoundary = "paused-at-end";
          return "ok";
        }
        return false;
      },
      { timeout: 10000 },
    )
    .toBe("ok");
  expect(endBoundary, `${scene.shortName} must respect Scene end ${endSec}s`).not.toBe("overran");
  const afterEnd = await readVideoSnapshot(player);
  expect(afterEnd.currentTime).toBeLessThan(endSec + 1);

  const hlsRequests = observe.requests.filter((entry) => entry.url.includes(CANON.muxStreamHost));
  const muxRequests = muxMediaRequests(observe);
  const livepeerTraffic = livepeerRequests(observe);
  expect(
    livepeerTraffic,
    `Mux ${scene.shortName} Moment must not request Livepeer: ${livepeerTraffic.map((entry) => entry.url).join(" | ")}`,
  ).toEqual([]);
  const blocked = originBlockedStaticRequests(observe);
  const abortedMux = observe.requests.filter((entry) => isMuxHlsAbort(entry.url, entry.failure));
  const playbackErrors = observe.pageErrors.filter((message) =>
    /hls|mux|media|playback|video/i.test(message),
  );

  const notes = [
    arrival,
    `canonical Moment route ${route}`,
    `Scene visible: ${scene.sceneTitle}`,
    `Mural parent link ${ROUTES.muralLive}`,
    `Creative Moment link /creative-moments/${scene.creativeMomentId} (${scene.creativeMomentTitle})`,
    pageHasMuxHlsUrl
      ? `Mux HLS URL present (stream.mux.com/${CANON.muxPlaybackId}.m3u8)`
      : "FINDING: Mux HLS URL missing",
    "shared ProjectionMediaPlayer / MuxPlayer labelled <video>, not a Moment-specific player",
    `Scene binding window ${scene.startMs}-${scene.endMs} ms`,
    `before Play currentTime=${beforePlay.currentTime.toFixed(3)} readyState=${beforePlay.readyState} paused=${beforePlay.paused}`,
    `Play control: ${playAttempt.playControl}`,
    `Play invoked: ${playAttempt.playInvoked}`,
    playErrors.length
      ? `transient play() errors before start: ${[...new Set(playErrors)].join(" | ")}`
      : "play() did not throw",
    `after Play currentTime=${afterPlay.currentTime.toFixed(3)} readyState=${afterPlay.readyState} paused=${afterPlay.paused} duration=${afterPlay.duration.toFixed(3)}`,
    `currentTime advanced within Scene range: ${afterPlay.currentTime > beforePlay.currentTime + 0.2}`,
    `end boundary: ${endBoundary} currentTime=${afterEnd.currentTime.toFixed(3)} paused=${afterEnd.paused}`,
    `video ${afterPlay.videoWidth}x${afterPlay.videoHeight} currentSrc=${afterPlay.currentSrc || "(empty)"}`,
    painted.painted
      ? `decoded/painted frame: yes (nonBlackRatio=${painted.nonBlackRatio.toFixed(3)})`
      : `FINDING: no painted frame (nonBlackRatio=${painted.nonBlackRatio.toFixed(3)})`,
    `stream.mux.com requests: ${hlsRequests.length}`,
    `mux media requests: ${muxRequests.length}`,
    livepeerTraffic.length
      ? `FINDING: Livepeer traffic on Mux Moment (${livepeerTraffic.length})`
      : "no Livepeer requests on this Mux Moment",
    blocked.length
      ? `FINDING: Origin-blocked /_next/static 403 (${blocked.length})`
      : "no Origin-blocked static chunks",
    abortedMux.length
      ? `Mux segment ERR_ABORTED count ${abortedMux.length} (HLS unused-range aborts, not treated as app failure)`
      : "no Mux segment aborts",
    playbackErrors.length
      ? `FINDING playback errors: ${playbackErrors.join(" | ")}`
      : "no playback pageErrors",
  ];

  await testInfo.attach(`${scene.key}-moment-play-evidence.json`, {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        {
          scene,
          arrival,
          pageHasMuxHlsUrl,
          playAttempt,
          playErrors: [...new Set(playErrors)],
          beforePlay,
          afterPlay,
          painted,
          endBoundary,
          afterEnd,
          startSec,
          endSec,
          hlsRequests: hlsRequests.map((entry) => ({
            url: entry.url,
            status: entry.status,
            failure: entry.failure,
          })),
          livepeerTraffic,
          abortedMuxCount: abortedMux.length,
          blocked,
          playbackErrors,
        },
        null,
        2,
      ),
    ),
  });

  await captureScreenshot(page, testInfo, `${scene.key}-moment-playing`);
  assertRuntimeHealth(observe);
  reportEvidence(
    testInfo,
    "BROWSER VERIFIED",
    `Super Hero Ego ${scene.shortName} Moment Play`,
    page.url(),
    notes,
    observe,
  );
}
