import { CANON, ROUTES } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { readVideoSnapshot } from "../lib/playback";
import { reportEvidence } from "../lib/observe";

test("Father Raymond mural record plays Mux and rights save without HTTP 405", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";

  await applyAuthoritySession(context, baseURL);

  const methodProbe = await page.request.post("/api/authority/media/rights", {
    data: {},
  });
  expect(methodProbe.status(), `rights POST HTTP ${methodProbe.status()}`).not.toBe(405);
  expect(methodProbe.status()).toBe(400);
  notes.push("Save rights accepts POST (no HTTP 405)");

  const rights = await page.request.post("/api/authority/media/rights", {
    data: {
      binding_id: CANON.fatherRaymondBindingId,
      master_id: CANON.fatherRaymondMuralId,
      rights_holder_ref: CANON.authorityParticipantId,
      rights_basis: "Owns song and animation",
    },
  });
  expect([200, 201], `Father Raymond rights HTTP ${rights.status()}`).toContain(rights.status());
  const rightsBody = await rights.json();
  expect(rightsBody.asset_id).toBe(CANON.fatherRaymondAssetId);
  notes.push("Father Raymond video rights save on its own Mural");

  await page.goto(ROUTES.authorityMurals, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Murals", exact: true })).toBeVisible();
  await expect(page.getByText(CANON.fatherRaymondTitleIncludes).first()).toBeVisible();
  await expect(page.getByText(CANON.muralTitle, { exact: true }).first()).toBeVisible();
  await expect(page.locator(`a[href*="${CANON.untitledUniverseId}"]`)).toHaveCount(0);
  const sheMuralRow = page.locator("tr").filter({ hasText: CANON.muralTitle }).filter({ hasText: CANON.universeTitle });
  await expect(sheMuralRow.getByRole("button", { name: "Withdraw" })).toHaveCount(0);
  const frMuralRow = page.locator("tr").filter({ hasText: CANON.fatherRaymondTitleIncludes });
  await expect(frMuralRow.getByRole("button", { name: "Withdraw" })).toBeVisible();
  notes.push("Murals catalogue lists live works, hides withdrawn shells, and withdraws Father Raymond not Super Hero Ego");

  await page.goto(ROUTES.authorityFatherRaymondMuralRecord, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: new RegExp(CANON.fatherRaymondTitleIncludes, "i") })).toBeVisible();
  await expect(page.getByRole("region", { name: "Attached media" })).toBeVisible();
  await expect(page.getByText("Playable media attached")).toBeVisible();
  const player = page.locator('video[aria-label="Mighty Verse media player"]');
  await expect(player).toBeVisible();
  await expect
    .poll(
      () => observe.requests.some((entry) => entry.url.includes(CANON.muxStreamHost) && entry.url.includes(CANON.fatherRaymondPlaybackId)),
      { timeout: 20_000 },
    )
    .toBeTruthy();
  await expect
    .poll(async () => (await readVideoSnapshot(player)).duration, { timeout: 20_000 })
    .toBeGreaterThan(1);
  await expect(page.getByRole("button", { name: "Withdraw" })).toBeVisible();
  await expect(page.getByText("This is not a delete").first()).toBeVisible();
  notes.push("Father Raymond mural record plays Mux and offers withdraw");

  await page.goto(ROUTES.authoritySheMuralRecord, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: CANON.muralTitle, exact: true })).toBeVisible();
  await expect(page.locator('video[aria-label="Mighty Verse media player"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Withdraw" })).toHaveCount(0);
  notes.push("Super Hero Ego mural plays and cannot be withdrawn");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Authority mural playback and rights", page.url(), notes, observe);
});
