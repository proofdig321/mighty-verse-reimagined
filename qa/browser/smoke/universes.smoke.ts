import { CANON, ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { captureScreenshot, muxMediaRequests, reportEvidence } from "../lib/observe";

test("universes lists real Universe content", async ({ page, observe }, testInfo) => {
  const response = await page.goto(ROUTES.universes, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `universes HTTP ${response?.status()}`).toBeTruthy();

  await expect(page.getByRole("heading", { name: /All Universes/i })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(CANON.universeTitle, "i") })).toBeVisible();

  const universeLink = page.locator(`a[href="${ROUTES.universeLive}"]`).first();
  await expect(universeLink).toBeVisible();

  await page.waitForTimeout(1500);

  const mux = muxMediaRequests(observe);
  expect(mux.length, "expected Mux thumbnail request on universes").toBeGreaterThan(0);

  await captureScreenshot(page, testInfo, "universes");
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Universes", page.url(), [
    "page loaded",
    `real Universe data visible: ${CANON.universeTitle}`,
    `universe detail href is ${ROUTES.universeLive}`,
    `mux media requests: ${mux.length}`,
  ], observe);
});
