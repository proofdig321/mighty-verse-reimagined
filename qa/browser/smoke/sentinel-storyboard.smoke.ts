import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { captureScreenshot, reportEvidence } from "../lib/observe";
import { mkdirSync } from "node:fs";

const JUDAS = "430ccb6b-6c31-4504-8729-19e7213e54a5";
const ARTIFACTS = "/opt/cursor/artifacts";

test("Judas Sentinel uses seconds and continues into Storyboard without Mux ids", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);
  mkdirSync(ARTIFACTS, { recursive: true });

  const sentinel = await page.goto(`${baseURL}/authority/curate/${JUDAS}/sentinel`, { waitUntil: "domcontentloaded" });
  expect(sentinel?.ok(), `Judas Sentinel HTTP ${sentinel?.status()}`).toBeTruthy();
  await expect(page.getByRole("heading", { name: /^Sentinel$/ })).toBeVisible();
  await expect(page.getByText("Start (s)")).toBeVisible();
  await expect(page.getByText("End (s)")).toBeVisible();
  await expect(page.getByText("Start (ms)")).toHaveCount(0);
  await expect(page.getByText("End (ms)")).toHaveCount(0);
  await expect(page.getByText("hqGacPkUZZuW")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Open Storyboard · Sentinel/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Storyboard · References/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Use still on storyboard/i })).toBeVisible();
  await expect(page.getByText(/Drag to mark Intro/i)).toBeVisible();
  notes.push("Sentinel operator fields are seconds, not milliseconds");
  notes.push("Sentinel does not label media with a Mux playback id");
  notes.push("Sentinel continues into Storyboard Sentinel and References");
  await captureScreenshot(page, testInfo, "judas-sentinel-seconds");
  await page.screenshot({ path: `${ARTIFACTS}/sentinel_seconds_and_storyboard_links.png`, fullPage: true });

  await page.getByRole("link", { name: /Open Storyboard · References/i }).click();
  await expect(page).toHaveURL(new RegExp(`/authority/universes/${JUDAS}/storyboard\\?from=curate&source=references`));
  await expect(page.getByRole("button", { name: "References" })).toBeVisible();
  await expect(page.getByText("Give me my money judas - Golden Shovel still · 1:32.775")).toBeVisible();
  await expect(page.getByText("still · 92.775s")).toBeVisible();
  notes.push("Storyboard References opens from Curate Sentinel");
  notes.push("Judas still at 1:32.775 is selectable as a storyboard thumbnail");
  await captureScreenshot(page, testInfo, "judas-storyboard-references");
  await page.screenshot({ path: `${ARTIFACTS}/storyboard_references_from_sentinel.png`, fullPage: true });

  const stillCard = page.locator("li").filter({ hasText: "1:32.775" });
  await stillCard.getByRole("button", { name: "Use on storyboard" }).click();
  await expect(page.getByText(/Still attached to a storyboard panel/i)).toBeVisible({ timeout: 20_000 });
  notes.push("Use on storyboard attached the 1:32.775 still to a panel");
  await captureScreenshot(page, testInfo, "judas-still-attached");
  await page.screenshot({ path: `${ARTIFACTS}/storyboard_still_attached.png`, fullPage: true });

  const stillRecord = await page.goto(`${baseURL}/authority/media/e74d79f9-546c-470c-bc2e-134ffbfe59ab`, { waitUntil: "domcontentloaded" });
  expect(stillRecord?.ok(), `curated still HTTP ${stillRecord?.status()}`).toBeTruthy();
  await expect(page.getByText("Curated reference").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Storyboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Sentinel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use on storyboard" })).toBeVisible();
  await expect(page.getByText(/A curated still is not bound to a Mural projection/i)).toBeVisible();
  notes.push("Curated still record continues into Storyboard; 0 projections is expected");
  await captureScreenshot(page, testInfo, "judas-still-record");
  await page.screenshot({ path: `${ARTIFACTS}/curated_still_use_on_storyboard.png`, fullPage: true });
  reportEvidence(testInfo, "BROWSER VERIFIED", "Sentinel ↔ Storyboard", page.url(), notes, observe);
});
