import { CANON, CREATIVE_MOMENTS, ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { captureScreenshot, muxMediaRequests, reportEvidence } from "../lib/observe";

test("moments lists real media and uses the Mux provider path", async ({ page, observe }, testInfo) => {
  const response = await page.goto(ROUTES.moments, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `moments HTTP ${response?.status()}`).toBeTruthy();

  await expect(page.getByRole("heading", { name: "Creative Moments", exact: true })).toBeVisible();
  await expect(page.getByText("No Creative Moments yet.")).toHaveCount(0);
  await expect(page.getByText("Moment Cards")).toHaveCount(0);
  await expect(page.getByText("All Moments")).toHaveCount(0);

  const proverb = page.locator(`[data-moment-id="${CREATIVE_MOMENTS.proverb.masterId}"]`);
  await expect(proverb).toBeVisible();
  await expect(proverb).toHaveAttribute("href", `/creative-moments/${CREATIVE_MOMENTS.proverb.masterId}`);
  await expect(proverb.getByText("Powerhouse")).toBeVisible();
  await expect(proverb.getByText("Hand-to-Hand")).toBeVisible();

  const muxCard = page
    .locator("a.artifact-card")
    .filter({ has: page.locator(`img[src*="${CANON.muxPlaybackId}"], img[src*="image.mux.com"]`) })
    .first();
  const fallbackCard = page.locator("a.artifact-card").first();
  const targetCard = (await muxCard.count()) > 0 ? muxCard : fallbackCard;
  await expect(targetCard).toBeVisible();

  await page.waitForTimeout(1500);
  const listingMux = muxMediaRequests(observe);
  expect(listingMux.length, "expected Mux thumbnail path on Creative Moments listing").toBeGreaterThan(0);

  await proverb.click();
  await expect(page).toHaveURL(new RegExp(`/creative-moments/${CREATIVE_MOMENTS.proverb.masterId}$`));
  await expect(page.getByRole("heading", { name: "Proverb", exact: true })).toBeVisible();
  await expect(page.getByText("This media is unavailable right now.")).toHaveCount(0);

  const mux = muxMediaRequests(observe);
  expect(mux.length, "expected Mux provider traffic on Creative Moments listing").toBeGreaterThan(0);

  await captureScreenshot(page, testInfo, "moments");
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Creative Moments catalog", page.url(), [
    "Creative Moments catalog loaded",
    "Proverb identity reachable from catalog",
    `Mux path used (image.mux.com / stream.mux.com / ${CANON.muxPlaybackId})`,
    `mux media requests: ${mux.length}`,
  ], observe);
});
