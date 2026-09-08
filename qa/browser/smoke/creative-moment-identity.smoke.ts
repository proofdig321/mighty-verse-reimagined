import { CREATIVE_MOMENTS, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

const PROVERB = CREATIVE_MOMENTS.proverb;

test("Creative Suite authors Creative Moment identity without leaving Super Hero Ego mutated", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(120_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";

  const unauthorized = await fetch(`${baseURL}/api/authority/presentation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      master_id: PROVERB.masterId,
      title: PROVERB.title,
    }),
  });
  expect([401, 403]).toContain(unauthorized.status);
  notes.push("A: unauthenticated Creative Moment identity mutation is rejected");

  await applyAuthoritySession(context, baseURL);
  await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" });

  const proverb = page.locator(`#universe-moment-${PROVERB.masterId}`);
  await proverb.getByRole("button", { name: "Edit identity" }).click();
  const originalTitle = await proverb.getByLabel("Creative Moment name").inputValue();
  const originalDescription = await proverb.getByLabel("How this Creative Moment is introduced").inputValue();
  await proverb.getByRole("button", { name: "Cancel" }).click();

  async function restoreProverbIdentity() {
    await page.evaluate(async ({ masterId, title, description }) => {
      await fetch("/api/authority/presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ master_id: masterId, title, description: description || null }),
      });
    }, {
      masterId: PROVERB.masterId,
      title: originalTitle || PROVERB.title,
      description: originalDescription,
    });
  }

  try {
    await expect(proverb.getByRole("heading", { name: "Proverb", exact: true })).toBeVisible();
    await expect(proverb.getByText(/shared across scenes/i)).toBeVisible();
    await expect(proverb.getByRole("link", { name: SCENE_MOMENTS.powerhouse.shortName, exact: true })).toBeVisible();
    notes.push("B: Proverb remains identity-only and shared before the rename");

    await proverb.getByRole("button", { name: "Edit identity" }).click();
    await expect(proverb.getByText("What is this Creative Moment called?")).toBeVisible();
    await proverb.getByLabel("Creative Moment name").fill("   ");
    await proverb.getByRole("button", { name: "Save identity" }).click();
    await expect(proverb.getByRole("alert")).toHaveText("Title is required.");
    notes.push("C: blank Creative Moment name is rejected without a write");

    await proverb.getByLabel("Creative Moment name").fill("Proverb renamed");
    await proverb.getByRole("button", { name: "Save identity" }).click();
    await expect(proverb.getByRole("heading", { name: "Proverb renamed", exact: true })).toBeVisible();
    await expect(proverb.getByText(/shared across scenes/i)).toBeVisible();
    await expect(proverb.getByRole("link", { name: SCENE_MOMENTS.powerhouse.shortName, exact: true })).toBeVisible();
    notes.push("D: Proverb can be named in place; sharing and identity-only stay");
  } finally {
    await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" }).catch(() => null);
    await restoreProverbIdentity();
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  const restored = page.locator(`#universe-moment-${PROVERB.masterId}`);
  await expect(restored.getByRole("heading", { name: originalTitle || PROVERB.title, exact: true })).toBeVisible();
  notes.push("E: Super Hero Ego Proverb title is restored");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 3.6 Creative Moment identity authoring", page.url(), notes, observe);
});
