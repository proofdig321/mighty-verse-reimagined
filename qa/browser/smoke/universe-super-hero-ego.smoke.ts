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
  for (const title of CANON.sceneTitles) {
    await expect(page.getByText(title).first()).toBeVisible();
  }

  await page.goto(ROUTES.muralLive, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(CANON.muralTitle).first()).toBeVisible();
  const player = page.getByLabel("Mighty Verse media player");
  await expect(player).toBeVisible();
  await expect(page.getByText("This media is unavailable right now.")).toHaveCount(0);

  await page.waitForTimeout(2000);

  const mux = muxMediaRequests(observe);
  expect(mux.length, "expected Mux media/thumbnail traffic for Super Hero Ego").toBeGreaterThan(0);

  await captureScreenshot(page, testInfo, "super-hero-ego-mural");
  assertRuntimeHealth(observe, {
    allowFailedUrl: (url, status) =>
      status === 404 && url.includes(ROUTES.universeRequested),
  });
  reportEvidence(testInfo, "BROWSER VERIFIED", "Super Hero Ego Universe", page.url(), [
    `${ROUTES.universeRequested} returned 404 (live route is ${ROUTES.universeLive})`,
    "Universe page loaded with real title",
    "Mural CTA rendered",
    `Scene Deck rendered ${CANON.sceneTitles.length} real Scenes`,
    "Mural media player initialized without the unavailable-media overlay",
    `mux media requests: ${mux.length}`,
  ], observe);
});
