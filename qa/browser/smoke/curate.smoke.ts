import { ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { captureScreenshot, reportEvidence } from "../lib/observe";

test("curate route loads the authority surface or the real auth gate", async ({ page, observe }, testInfo) => {
  const response = await page.goto(ROUTES.curate, { waitUntil: "domcontentloaded" });
  expect(response, "curate navigation produced a response").toBeTruthy();

  const onSignIn = /\/auth\/sign-in/.test(page.url());
  const curateHeading = page.getByRole("heading", { name: /Select a Universe/i });
  const universeSelect = page.locator("select").filter({ hasText: "Select Universe" });
  const signInHeading = page.getByRole("heading", { name: /Sign in/i });

  if (onSignIn) {
    await expect(signInHeading).toBeVisible();
    await captureScreenshot(page, testInfo, "curate-sign-in");
    assertRuntimeHealth(observe);
    reportEvidence(testInfo, "BROWSER VERIFIED", "Curate", page.url(), [
      "route loaded",
      "unauthenticated session redirected to /auth/sign-in",
      "Universe/Mural selection UI not observed without an authenticated participant",
    ], observe);
    return;
  }

  await expect(curateHeading.or(page.getByText("Curation Workspace"))).toBeVisible();
  await expect(universeSelect.first()).toBeVisible();
  await captureScreenshot(page, testInfo, "curate-workspace");
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Curate", page.url(), [
    "route loaded",
    "authority curate surface rendered",
    "Universe selection UI rendered",
  ], observe);
});
