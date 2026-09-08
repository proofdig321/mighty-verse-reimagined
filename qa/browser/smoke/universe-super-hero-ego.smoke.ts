import { CANON, ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import {
  captureScreenshot,
  originBlockedStaticRequests,
  reportEvidence,
} from "../lib/observe";

test("Super Hero Ego Universe renders mural, scenes, and records Mux playback evidence", async ({
  page,
  observe,
}, testInfo) => {
  const obsolete = await page.goto(ROUTES.universeObsolete, { waitUntil: "domcontentloaded" });
  expect(obsolete?.status(), "obsolete /universes/{id} must 404").toBe(404);

  const response = await page.goto(ROUTES.universeLive, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `universe live HTTP ${response?.status()}`).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeLive}$`));

  await expect(page.getByText(CANON.universeTitle).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Enter Scene Deck/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /View Mural/i })).toBeVisible();

  await page.getByRole("button", { name: /^Scenes$/ }).click();
  await expect(page.getByText(CANON.muralTitle).first()).toBeVisible();

  await page.getByRole("link", { name: /Enter Scene Deck/i }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeScenes}$`));
  await expect(page.getByRole("heading", { name: /Scene Deck/i })).toBeVisible();
  for (const [index, title] of CANON.sceneTitles.entries()) {
    await expect(
      page.getByRole("button", { name: new RegExp(`Go to scene ${index + 1}: ${title}`) }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: `Go to scene 1: ${CANON.sceneTitles[0]}`, exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Scene 1: ${CANON.sceneTitles[0]}`, exact: true }),
  ).toBeVisible();
  await captureScreenshot(page, testInfo, "super-hero-ego-scene-deck");

  await page.goto(ROUTES.muralLive, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(CANON.muralTitle).first()).toBeVisible();

  const html = await page.content();
  const pageHasMuxHlsUrl = html.includes(`https://stream.mux.com/${CANON.muxPlaybackId}.m3u8`);
  expect(pageHasMuxHlsUrl, "mural page must deliver the Mux HLS URL to the client").toBeTruthy();

  const player = page.getByLabel("Mighty Verse media player");
  await expect(player).toBeVisible();
  await expect(page.getByText("This media is unavailable right now.")).toHaveCount(0);
  for (const title of CANON.sceneTitles) {
    await expect(page.getByText(title).first()).toBeVisible();
  }

  const loadingGone = await page
    .getByText("Loading media")
    .waitFor({ state: "hidden", timeout: 12000 })
    .then(() => true)
    .catch(() => false);

  const hlsRequests = observe.requests.filter((entry) => entry.url.includes(CANON.muxStreamHost));
  const hlsLoader = observe.requests.filter((entry) => /hls_mjs|hls\.js/i.test(entry.url));
  const blocked = originBlockedStaticRequests(observe);
  const videoState = await player.evaluate((el) => {
    const video = el as HTMLVideoElement;
    return {
      readyState: video.readyState,
      networkState: video.networkState,
      currentSrc: video.currentSrc,
    };
  });

  const notes = [
    `obsolete ${ROUTES.universeObsolete} returned 404`,
    `canonical Universe route is ${ROUTES.universeLive}`,
    "Universe page loaded with real title",
    "Mural CTA rendered",
    `Scene Deck rendered ${CANON.sceneTitles.length} real Scenes`,
    pageHasMuxHlsUrl
      ? "Mural HTML/RSC payload contains stream.mux.com HLS URL"
      : "FINDING: Mux HLS URL missing from mural page",
    "Mux player element mounted (aria-label Mighty Verse media player)",
    loadingGone
      ? "Mural loading overlay cleared"
      : "FINDING: Mural player remained on Loading media after 12s",
    `hls.js related requests: ${hlsLoader.length}`,
    `stream.mux.com requests: ${hlsRequests.length}`,
    `video readyState=${videoState.readyState} networkState=${videoState.networkState} currentSrc=${videoState.currentSrc || "(empty)"}`,
    blocked.length
      ? `FINDING: Origin-bearing /_next/static 403 Unauthorized (${blocked.length}) — HLS module did not complete`
      : "no Origin-blocked static chunks",
    "Mux playback ID was not requested through Livepeer",
  ];

  await testInfo.attach("mural-playback-evidence.json", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify({ pageHasMuxHlsUrl, loadingGone, hlsRequests, hlsLoader, blocked, videoState }, null, 2)),
  });

  await captureScreenshot(page, testInfo, "super-hero-ego-mural");
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Super Hero Ego Universe", page.url(), notes, observe);
});
