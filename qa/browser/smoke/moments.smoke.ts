import { CANON, ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { captureScreenshot, muxMediaRequests, reportEvidence } from "../lib/observe";

test("moments lists real media and uses the Mux provider path", async ({ page, observe }, testInfo) => {
  const response = await page.goto(ROUTES.moments, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `moments HTTP ${response?.status()}`).toBeTruthy();

  await expect(page.getByRole("heading", { name: /All Moments/i })).toBeVisible();
  await expect(page.getByText("No moments yet.")).toHaveCount(0);

  const firstCard = page.locator("a.artifact-card").first();
  await expect(firstCard).toBeVisible();

  await page.waitForTimeout(1500);
  const listingMux = muxMediaRequests(observe);
  expect(listingMux.length, "expected Mux thumbnail path on moments listing").toBeGreaterThan(0);

  await firstCard.click();
  await expect(page).toHaveURL(/\/moments\/[0-9a-f-]+/i);
  await page.waitForTimeout(2000);

  const mux = muxMediaRequests(observe);
  expect(mux.length, "expected Mux provider traffic after opening a moment").toBeGreaterThan(0);
  await expect(page.getByText("This media is unavailable right now.")).toHaveCount(0);

  await captureScreenshot(page, testInfo, "moments");
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Moments", page.url(), [
    "moments route loaded",
    "real moment cards rendered",
    `Mux path used (image.mux.com / stream.mux.com / ${CANON.muxPlaybackId})`,
    `mux media requests: ${mux.length}`,
  ], observe);
});
