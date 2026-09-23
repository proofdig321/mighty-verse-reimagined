import { ROUTES } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { reportEvidence, captureScreenshot } from "../lib/observe";

const RAWBEATS_TITLE = "Rawbeats ft Golden Shovel and Lenny da kid - it is what it is";
const YOUTUBE_URL = "https://www.youtube.com/watch?v=EEnwb0Uknew";

test("Gallery YouTube retry fetches a file instead of sending the watch page to Mux", async ({
  page,
  observe,
  context,
}, testInfo) => {
  test.setTimeout(180_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);

  await page.goto(ROUTES.authorityMedia, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Media Library/i })).toBeVisible();
  // Intake rows are in the Intake tab
  await page.getByRole("tab", { name: "Intake" }).click();

  const row = page.locator("[data-intake-id]").filter({ hasText: RAWBEATS_TITLE }).first();
  await expect(row).toBeVisible();
  await expect(row.getByText(YOUTUBE_URL)).toBeVisible();
  await expect(row.getByRole("button", { name: /Retry Mux/i })).toBeVisible();
  await expect(row.getByText(/YouTube session/i)).toBeVisible();
  await captureScreenshot(page, testInfo, "gallery-youtube-retry-ready");
  notes.push("Rawbeats Gallery shell offers Retry Mux and YouTube session cookies");

  await row.getByRole("button", { name: /Retry Mux/i }).click();
  await expect(row.getByText(/sign in to confirm you are not a bot/i)).toBeVisible({ timeout: 120_000 });
  await expect(row.getByText(/Mux cannot pull a watch page/i)).toBeVisible();
  await expect(row.getByText(/invalid_input/i)).toHaveCount(0);
  await captureScreenshot(page, testInfo, "gallery-youtube-retry-bot-gate");
  notes.push("Retry fails at YouTube file fetch, not Mux invalid_input on the watch URL");

  const sheCard = page.locator("div.group").filter({ has: page.locator(`a[href="${ROUTES.authorityMuxAsset}"]`) });
  await expect(sheCard.first()).toBeVisible();
  await expect(sheCard.getByRole("button", { name: "Delete" })).toHaveCount(0);
  notes.push("Super Hero Ego Gallery card still has no Delete");

  reportEvidence(testInfo, "BROWSER VERIFIED", "YouTube file ingest retry", page.url(), notes, observe);
});
