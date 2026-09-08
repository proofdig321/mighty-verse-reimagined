import { CANON, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

const POWERHOUSE = SCENE_MOMENTS.powerhouse;

async function restorePowerhouseIdentity(page: import("@playwright/test").Page) {
  await page.evaluate(async ({ masterId, title, description }) => {
    await fetch("/api/authority/presentation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ master_id: masterId, title, description }),
    });
  }, {
    masterId: POWERHOUSE.sceneMasterId,
    title: POWERHOUSE.sceneTitle,
    description: POWERHOUSE.sceneDescription,
  });
}

test("Creative Suite authors Scene identity without leaving Super Hero Ego mutated", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(120_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";

  const unauthorized = await fetch(`${baseURL}/api/authority/presentation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      master_id: POWERHOUSE.sceneMasterId,
      title: "Powerhouse",
      description: POWERHOUSE.sceneDescription,
    }),
  });
  expect([401, 403]).toContain(unauthorized.status);
  notes.push("A: unauthenticated Scene identity mutation is rejected");

  await applyAuthoritySession(context, baseURL);
  await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" });
  await restorePowerhouseIdentity(page);
  await page.reload({ waitUntil: "domcontentloaded" });

  try {
    const powerhouse = page.locator(`#universe-scene-${POWERHOUSE.sceneMasterId}`);
    await expect(powerhouse.getByRole("heading", { name: /Scene 01\. Powerhouse/ })).toBeVisible();
    await expect(powerhouse.getByText(POWERHOUSE.sceneTitle, { exact: true })).toBeVisible();
    await expect(powerhouse.getByText(/0:36\.000/)).toBeVisible();
    await expect(powerhouse.getByRole("link", { name: "Proverb", exact: true })).toBeVisible();
    notes.push("B: Powerhouse is face-up with contributor-prefixed identity, timing, and Proverb presence");

    await powerhouse.getByRole("button", { name: "Edit identity" }).click();
    await expect(powerhouse.getByText("What is this Scene called?")).toBeVisible();
    await expect(powerhouse.getByLabel("Scene name")).toHaveValue(POWERHOUSE.sceneTitle);
    await expect(powerhouse.getByLabel("How this Scene is introduced")).toHaveValue(POWERHOUSE.sceneDescription);

    await powerhouse.getByLabel("Scene name").fill("   ");
    await powerhouse.getByRole("button", { name: "Save identity" }).click();
    await expect(powerhouse.getByRole("alert")).toHaveText("Title is required.");
    notes.push("C: blank Scene name is rejected without a write");

    await powerhouse.getByLabel("Scene name").fill("Powerhouse");
    await powerhouse.getByRole("button", { name: "Save identity" }).click();
    await expect(powerhouse.getByRole("heading", { name: /Scene 01\. Powerhouse/ })).toBeVisible();
    await expect(powerhouse.getByText(POWERHOUSE.sceneTitle, { exact: true })).toHaveCount(0);
    await expect(powerhouse.getByText(/0:36\.000/)).toBeVisible();
    await expect(powerhouse.getByRole("link", { name: "Proverb", exact: true })).toBeVisible();
    notes.push("D: cinematic Scene name stays on the object; timing and presence are unchanged");

    await page.goto(ROUTES.universeLive, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`#world-scene-${POWERHOUSE.sceneMasterId}`)).toContainText("Powerhouse");
    await expect(page.locator(`#world-scene-${POWERHOUSE.sceneMasterId}`)).not.toContainText("Golden Shovel — Powerhouse");
    notes.push("E: Experience encounter shows the authored cinematic Scene name");

    await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" });
    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = page.locator(`#universe-scene-${POWERHOUSE.sceneMasterId}`);
    await expect(narrow.getByRole("button", { name: "Edit identity" })).toBeVisible();
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX, `narrow viewport horizontal overflow ${overflowX}px`).toBeLessThan(24);
    notes.push("F: 390px keeps Scene identity authoring usable without horizontal overflow");
  } finally {
    await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" }).catch(() => null);
    await restorePowerhouseIdentity(page);
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  const restored = page.locator(`#universe-scene-${POWERHOUSE.sceneMasterId}`);
  await expect(restored.getByText(POWERHOUSE.sceneTitle, { exact: true })).toBeVisible();
  notes.push("G: Super Hero Ego Powerhouse title is restored");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 3.3 Scene identity authoring", page.url(), notes, observe);
});
