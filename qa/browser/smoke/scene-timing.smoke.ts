import { CANON, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

const POWERHOUSE = SCENE_MOMENTS.powerhouse;

async function restorePowerhouseTiming(page: import("@playwright/test").Page) {
  await page.evaluate(async ({ bindingId, masterId, startMs, endMs }) => {
    await fetch("/api/authority/media/timeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        binding_id: bindingId,
        master_id: masterId,
        start_ms: startMs,
        end_ms: endMs,
      }),
    });
  }, {
    bindingId: POWERHOUSE.bindingId,
    masterId: POWERHOUSE.sceneMasterId,
    startMs: POWERHOUSE.startMs,
    endMs: POWERHOUSE.endMs,
  });
}

test("Creative Suite authors Scene timing without leaving Super Hero Ego mutated", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(120_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";

  const unauthorized = await fetch(`${baseURL}/api/authority/media/timeline`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      binding_id: POWERHOUSE.bindingId,
      master_id: POWERHOUSE.sceneMasterId,
      start_ms: 37000,
      end_ms: POWERHOUSE.endMs,
    }),
  });
  expect([401, 403]).toContain(unauthorized.status);
  notes.push("A: unauthenticated Scene timing mutation is rejected");

  await applyAuthoritySession(context, baseURL);
  await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" });
  await restorePowerhouseTiming(page);
  await page.reload({ waitUntil: "domcontentloaded" });

  try {
    const powerhouse = page.locator(`#universe-scene-${POWERHOUSE.sceneMasterId}`);
    await expect(powerhouse.getByText(/0:36\.000 → 1:19\.000/)).toBeVisible();
    await powerhouse.getByRole("button", { name: "Edit timing" }).click();
    await expect(powerhouse.getByText("When does this Scene live on the Mural?")).toBeVisible();
    await expect(powerhouse.getByLabel("Window start")).toHaveValue("0:36.000");
    await expect(powerhouse.getByLabel("Window end")).toHaveValue("1:19.000");

    await powerhouse.getByLabel("Window start").fill("1:19.000");
    await powerhouse.getByRole("button", { name: "Save timing" }).click();
    await expect(powerhouse.getByRole("alert")).toHaveText("End must be after start.");
    notes.push("B: inverted window is rejected without a write");

    await powerhouse.getByLabel("Window start").fill("0:37.000");
    await powerhouse.getByRole("button", { name: "Save timing" }).click();
    await expect(powerhouse.getByText(/0:37\.000 → 1:19\.000/)).toBeVisible();
    await expect(powerhouse.getByRole("heading", { name: /Scene 01\. Powerhouse/ })).toBeVisible();
    await expect(powerhouse.getByRole("link", { name: "Proverb", exact: true })).toBeVisible();
    notes.push("C: Powerhouse window can be nudged in place; identity and presence stay");

    await page.goto(ROUTES.universeLive, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`#world-scene-${POWERHOUSE.sceneMasterId}`)).toBeVisible();
    notes.push("D: Experience encounter still presents Powerhouse after the timing write");
  } finally {
    await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" }).catch(() => null);
    await restorePowerhouseTiming(page);
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  const restored = page.locator(`#universe-scene-${POWERHOUSE.sceneMasterId}`);
  await expect(restored.getByText(/0:36\.000 → 1:19\.000/)).toBeVisible();
  notes.push("E: Super Hero Ego Powerhouse window is restored");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 3.5 Scene timing authoring", page.url(), notes, observe);
});
