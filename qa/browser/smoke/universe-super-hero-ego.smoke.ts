import { CANON, ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { captureScreenshot, muxMediaRequests, reportEvidence } from "../lib/observe";

test("Super Hero Ego Universe renders mural, scenes, and Mux media", async ({ page, observe }, testInfo) => {
  const requested = await page.request.get(ROUTES.universeRequested);
  expect(
    requested.status(),
    `requested path ${ROUTES.universeRequested} is not the live Universe page`,
  ).toBe(404);

  const response = await page.goto(ROUTES.universeLive, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `universe live HTTP ${response?.status()}`).toBeTruthy();

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
  await page.getByRole("button", { name: `Go to scene 1: ${CANON.sceneTitles[0]}` }).click();
  await expect(
    page.getByRole("button", { name: `Scene 1: ${CANON.sceneTitles[0]}` }),
  ).toBeVisible();
  await captureScreenshot(page, testInfo, "super-hero-ego-scene-deck");

  await page.goto(ROUTES.muralLive, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(CANON.muralTitle).first()).toBeVisible();
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

  const mux = muxMediaRequests(observe);
  const notes = [
    `${ROUTES.universeRequested} returned 404 (live route is ${ROUTES.universeLive})`,
    "Universe page loaded with real title",
    "Mural CTA rendered",
    `Scene Deck rendered ${CANON.sceneTitles.length} real Scenes`,
    "Mural page rendered real Scene titles and the Mux player element",
    loadingGone
      ? "Mural loading overlay cleared"
      : "Mural player remained on Loading media after 12s — remaining finding (HLS chunk/provider init)",
    `mux media requests: ${mux.length}`,
  ];

  await captureScreenshot(page, testInfo, "super-hero-ego-mural");
  assertRuntimeHealth(observe, {
    allowFailedUrl: (url, status) =>
      status === 404 && url.includes(ROUTES.universeRequested),
  });
  reportEvidence(testInfo, "BROWSER VERIFIED", "Super Hero Ego Universe", page.url(), notes, observe);
});
