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
  muxMediaRequests,
  originBlockedStaticRequests,
  reportEvidence,
} from "../lib/observe";

test("Super Hero Ego Mural Play starts decoded Mux playback", async ({ page, observe }, testInfo) => {
  const response = await page.goto(ROUTES.muralLive, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `mural HTTP ${response?.status()}`).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.muralLive}$`));
  await expect(page.getByText(CANON.muralTitle).first()).toBeVisible();

  const html = await page.content();
  const pageHasMuxHlsUrl = html.includes(`https://stream.mux.com/${CANON.muxPlaybackId}.m3u8`);
  expect(pageHasMuxHlsUrl, "mural page must deliver the Mux HLS URL").toBeTruthy();

  const player = page.locator('video[aria-label="Mighty Verse media player"]');
  await expect(player).toBeVisible();
  await expect(player).toHaveJSProperty("tagName", "VIDEO");
  await expect(page.getByText("This media is unavailable right now.")).toHaveCount(0);

  const loadingGone = await page
    .getByText("Loading media")
    .waitFor({ state: "hidden", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  expect(loadingGone, "Mural player must leave Loading media before Play").toBeTruthy();

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

  const beforePlay = await readVideoSnapshot(player);
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
  const frame = await samplePaintedFrame(player);
  await expect
    .poll(async () => (await samplePaintedFrame(player)).painted, { timeout: 10000 })
    .toBe(true);
  const painted = await samplePaintedFrame(player);

  const hlsRequests = observe.requests.filter((entry) => entry.url.includes(CANON.muxStreamHost));
  const muxRequests = muxMediaRequests(observe);
  const blocked = originBlockedStaticRequests(observe);
  const abortedMux = observe.requests.filter((entry) => isMuxHlsAbort(entry.url, entry.failure));
  const playbackErrors = observe.pageErrors.filter((message) =>
    /hls|mux|media|playback|video/i.test(message),
  );

  const notes = [
    `canonical Mural route ${ROUTES.muralLive}`,
    pageHasMuxHlsUrl
      ? `Mux HLS URL present (stream.mux.com/${CANON.muxPlaybackId}.m3u8)`
      : "FINDING: Mux HLS URL missing",
    "Mux player is a labelled <video> (Mighty Verse media player), not Livepeer",
    `Play control: ${playAttempt.playControl}`,
    `Play invoked: ${playAttempt.playInvoked}`,
    playErrors.length
      ? `transient play() errors before start: ${[...new Set(playErrors)].join(" | ")}`
      : "play() did not throw",
    `before Play currentTime=${beforePlay.currentTime.toFixed(3)} readyState=${beforePlay.readyState} paused=${beforePlay.paused}`,
    `after Play currentTime=${afterPlay.currentTime.toFixed(3)} readyState=${afterPlay.readyState} paused=${afterPlay.paused} duration=${afterPlay.duration.toFixed(3)}`,
    `currentTime advanced: ${afterPlay.currentTime > beforePlay.currentTime + 0.2}`,
    `video ${afterPlay.videoWidth}x${afterPlay.videoHeight} currentSrc=${afterPlay.currentSrc || "(empty)"}`,
    painted.painted
      ? `decoded/painted frame: yes (nonBlackRatio=${painted.nonBlackRatio.toFixed(3)})`
      : `FINDING: no painted frame (nonBlackRatio=${painted.nonBlackRatio.toFixed(3)})`,
    `stream.mux.com requests: ${hlsRequests.length}`,
    `mux media requests: ${muxRequests.length}`,
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

  await testInfo.attach("mural-play-evidence.json", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        {
          pageHasMuxHlsUrl,
          playAttempt,
          playErrors: [...new Set(playErrors)],
          beforePlay,
          afterPlay,
          frame,
          painted,
          hlsRequests: hlsRequests.map((entry) => ({ url: entry.url, status: entry.status, failure: entry.failure })),
          abortedMuxCount: abortedMux.length,
          blocked,
          playbackErrors,
        },
        null,
        2,
      ),
    ),
  });

  await captureScreenshot(page, testInfo, "super-hero-ego-mural-playing");
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Super Hero Ego Mural Play", page.url(), notes, observe);
});
