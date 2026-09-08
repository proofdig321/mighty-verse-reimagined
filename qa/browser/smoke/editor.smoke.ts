import { CANON, ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import {
  captureScreenshot,
  muxMediaRequests,
  reportEvidence,
} from "../lib/observe";

test("experience editor initializes Mux timeline media without Livepeer misroute", async ({
  page,
  observe,
}, testInfo) => {
  const response = await page.goto(ROUTES.editor, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `editor HTTP ${response?.status()}`).toBeTruthy();

  await expect(page.getByText("Experience Editor")).toBeVisible();
  await expect(page.getByText("Scene Library")).toBeVisible();
  for (const title of CANON.sceneTitles) {
    await expect(page.getByText(title).first()).toBeVisible();
  }

  await page.waitForTimeout(2000);
  const mux = muxMediaRequests(observe);
  expect(mux.length, "expected Mux thumbnail path in the editor scene library").toBeGreaterThan(0);

  await page.getByRole("button", { name: /Add Golden Shovel/i }).click();
  await expect(page.getByRole("button", { name: /Play Experience/i })).toBeEnabled();
  await page.getByRole("button", { name: /Play Experience/i }).click();

  const player = page.locator("video").first();
  await expect(player).toBeVisible();
  await expect(page.getByText("This media is unavailable right now.")).toHaveCount(0);

  await page.waitForTimeout(2000);

  await captureScreenshot(page, testInfo, "editor");
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Experience Editor", page.url(), [
    "editor route loaded",
    "real Scene Library rendered with canonical Super Hero Ego scenes",
    "Mux thumbnail/media path used",
    "timeline player initialized after adding a Scene",
    "Mux playback ID was not requested through Livepeer",
    `mux media requests: ${muxMediaRequests(observe).length}`,
  ], observe);
});
