import { CANON, ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { captureScreenshot, muxMediaRequests, reportEvidence } from "../lib/observe";

test("home loads primary content and real Universe data", async ({ page, observe }, testInfo) => {
  const response = await page.goto(ROUTES.home, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `home HTTP ${response?.status()}`).toBeTruthy();

  await expect(page.getByRole("heading", { name: /Every Song is a Universe/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore Universes/i })).toBeVisible();
  await expect(page.getByText(CANON.universeTitle).first()).toBeVisible();

  await page.waitForTimeout(1500);

  const mux = muxMediaRequests(observe);
  expect(mux.length, "expected Mux thumbnail/media request on home").toBeGreaterThan(0);

  await captureScreenshot(page, testInfo, "home");
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Home", page.url(), [
    "page loaded",
    `primary heading rendered`,
    `real Universe visible: ${CANON.universeTitle}`,
    `mux media requests: ${mux.length}`,
  ], observe);
});
