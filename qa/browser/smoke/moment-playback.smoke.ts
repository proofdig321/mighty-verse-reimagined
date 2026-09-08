import { CANON, ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import {
  isMuxHlsAbort,
  readVideoSnapshot,
  samplePaintedFrame,
  tryStartNativeVideoPlayback,
} from "../lib/playback";
import {
  captureScreenshot,
  livepeerRequests,
  muxMediaRequests,
  originBlockedStaticRequests,
  reportEvidence,
} from "../lib/observe";

const START_SEC = CANON.swordMasterStartMs / 1000;
const END_SEC = CANON.swordMasterEndMs / 1000;

test("Super Hero Ego Sword Master Moment Play starts decoded Mux playback", async ({
  page,
  observe,
}, testInfo) => {
  const response = await page.goto(ROUTES.momentSwordMaster, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `moment HTTP ${response?.status()}`).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.momentSwordMaster}$`));
  await expect(page.getByText(`Scene: ${CANON.swordMasterSceneTitle}`)).toBeVisible();
  await expect(page.getByRole("link", { name: CANON.muralTitle, exact: true })).toHaveAttribute(
    "href",
    ROUTES.muralLive,
  );
  await expect(page.getByRole("link", { name: CANON.creativeMomentTitle, exact: true })).toHaveAttribute(
    "href",
    `/creative-moments/${CANON.creativeMomentId}`,
  );

  const html = await page.content();
  const pageHasMuxHlsUrl = html.includes(`https://stream.mux.com/${CANON.muxPlaybackId}.m3u8`);
  expect(pageHasMuxHlsUrl, "moment page must deliver the Mux HLS URL").toBeTruthy();

  const player = page.locator('video[aria-label="Mighty Verse media player"]');
  await expect(player).toBeVisible();
  await expect(player).toHaveJSProperty("tagName", "VIDEO");
  await expect(page.getByText("This media is unavailable right now.")).toHaveCount(0);

  const loadingGone = await page
    .getByText("Loading media")
    .waitFor({ state: "hidden", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  expect(loadingGone, "Moment player must leave Loading media before Play").toBeTruthy();

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
    .toBeGreaterThan(START_SEC - 1);

  const beforePlay = await readVideoSnapshot(player);
  expect(
    beforePlay.currentTime,
    `Scene timing must seek near ${START_SEC}s before Play (got ${beforePlay.currentTime})`,
  ).toBeGreaterThan(START_SEC - 1);
  expect(beforePlay.currentTime).toBeLessThan(END_SEC);

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
  expect(afterPlay.currentTime).toBeLessThan(END_SEC + 1);

  await expect
    .poll(async () => (await samplePaintedFrame(player)).painted, { timeout: 10000 })
    .toBe(true);
  const painted = await samplePaintedFrame(player);

  const hlsRequests = observe.requests.filter((entry) => entry.url.includes(CANON.muxStreamHost));
  const muxRequests = muxMediaRequests(observe);
  const livepeerTraffic = livepeerRequests(observe);
  expect(
    livepeerTraffic,
    `Mux Moment must not request Livepeer: ${livepeerTraffic.map((entry) => entry.url).join(" | ")}`,
  ).toEqual([]);
  const blocked = originBlockedStaticRequests(observe);
  const abortedMux = observe.requests.filter((entry) => isMuxHlsAbort(entry.url, entry.failure));
  const playbackErrors = observe.pageErrors.filter((message) =>
    /hls|mux|media|playback|video/i.test(message),
  );

  const notes = [
    `canonical Moment route ${ROUTES.momentSwordMaster}`,
    `Scene visible: ${CANON.swordMasterSceneTitle}`,
    `Mural parent link ${ROUTES.muralLive}`,
    `Creative Moment link /creative-moments/${CANON.creativeMomentId} (${CANON.creativeMomentTitle})`,
    pageHasMuxHlsUrl
      ? `Mux HLS URL present (stream.mux.com/${CANON.muxPlaybackId}.m3u8)`
      : "FINDING: Mux HLS URL missing",
    "shared ProjectionMediaPlayer / MuxPlayer labelled <video>, not a Moment-specific player",
    `Scene binding window ${CANON.swordMasterStartMs}-${CANON.swordMasterEndMs} ms`,
    `before Play currentTime=${beforePlay.currentTime.toFixed(3)} readyState=${beforePlay.readyState} paused=${beforePlay.paused}`,
    `Play control: ${playAttempt.playControl}`,
    `Play invoked: ${playAttempt.playInvoked}`,
    playErrors.length
      ? `transient play() errors before start: ${[...new Set(playErrors)].join(" | ")}`
      : "play() did not throw",
    `after Play currentTime=${afterPlay.currentTime.toFixed(3)} readyState=${afterPlay.readyState} paused=${afterPlay.paused} duration=${afterPlay.duration.toFixed(3)}`,
    `currentTime advanced within Scene range: ${afterPlay.currentTime > beforePlay.currentTime + 0.2}`,
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

  await testInfo.attach("moment-play-evidence.json", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        {
          pageHasMuxHlsUrl,
          playAttempt,
          playErrors: [...new Set(playErrors)],
          beforePlay,
          afterPlay,
          painted,
          startSec: START_SEC,
          endSec: END_SEC,
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

  await captureScreenshot(page, testInfo, "sword-master-moment-playing");
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Super Hero Ego Moment Play", page.url(), notes, observe);
});
