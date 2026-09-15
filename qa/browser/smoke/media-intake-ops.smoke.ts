import { CANON, ROUTES } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

test("Gallery awaiting intake can be discarded without touching Super Hero Ego", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  const title = `QA awaiting discard ${Date.now()}`;

  const unauthorized = await page.request.post("/api/authority/media-intake/00000000-0000-4000-8000-000000000001/discard");
  expect(unauthorized.status(), `unauthenticated intake discard HTTP ${unauthorized.status()}`).toBe(401);
  notes.push("unauthenticated intake discard is rejected");

  await applyAuthoritySession(context, baseURL);

  const created = await page.request.post("/api/authority/media-intake", {
    data: {
      title,
      work_type: "other",
      source_type: "upload",
    },
  });
  expect(created.status(), `create intake HTTP ${created.status()}`).toBe(201);
  const createdBody = await created.json();
  expect(typeof createdBody.intake_id).toBe("string");
  const intakeId = createdBody.intake_id as string;
  notes.push(`created unlinked intake ${intakeId}`);

  const sheIntake = await page.request.post(`/api/authority/media-intake/${intakeId}/discard`);
  expect(sheIntake.status()).toBe(200);
  const discarded = await sheIntake.json();
  expect(discarded.discarded).toBe(true);
  notes.push("unlinked intake discard succeeds");

  const again = await page.request.post(`/api/authority/media-intake/${intakeId}/discard`);
  expect(again.status()).toBe(409);
  notes.push("already discarded intake is refused");

  await page.goto(ROUTES.authorityMedia, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Media Library/i })).toBeVisible();
  await expect(page.locator(`[data-intake-id="${intakeId}"]`)).toHaveCount(0);
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  notes.push("discarded intake is hidden from Gallery awaiting upload");

  const sheCard = page.locator("div.group").filter({ has: page.locator(`a[href="${ROUTES.authorityMuxAsset}"]`) });
  await expect(sheCard.first()).toBeVisible();
  await expect(sheCard.getByRole("button", { name: "Delete" })).toHaveCount(0);
  notes.push("Super Hero Ego Gallery card still has no Delete");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Gallery intake discard", page.url(), notes, observe);
});

test("Gallery awaiting upload shows Delete for unlinked duplicate shells", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  const title = `QA awaiting visible ${Date.now()}`;

  await applyAuthoritySession(context, baseURL);
  const created = await page.request.post("/api/authority/media-intake", {
    data: {
      title,
      work_type: "other",
      source_type: "upload",
    },
  });
  expect(created.status()).toBe(201);
  const createdBody = await created.json();
  const intakeId = createdBody.intake_id as string;

  await page.goto(ROUTES.authorityMedia, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Intake Records — Awaiting Upload")).toBeVisible();
  const row = page.locator(`[data-intake-id="${intakeId}"]`);
  await expect(row).toBeVisible();
  await expect(row.getByText(title)).toBeVisible();
  await expect(row.getByRole("button", { name: "Upload media" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Delete" })).toBeVisible();
  notes.push("awaiting upload row offers Upload and Delete");

  await row.getByRole("button", { name: "Delete" }).click();
  await row.getByRole("button", { name: "Confirm delete" }).click();
  await expect(row).toHaveCount(0);
  notes.push("confirm delete removes the awaiting row");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Gallery awaiting Delete", page.url(), notes, observe);
});
