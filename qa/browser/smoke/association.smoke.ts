import { CANON, ROUTES } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";
import { expectCreativeSuiteComposition } from "../lib/suite-composition";

test("unassociated media can associate to an existing Universe without creating one", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";

  const unauthorized = await page.request.post("/api/authority/media", {
    data: { asset_id: CANON.unboundLivepeerAssetId, universe_id: CANON.universeId },
  });
  expect(unauthorized.status(), `unauthenticated association HTTP ${unauthorized.status()}`).toBe(401);
  notes.push("unauthenticated association is rejected");

  await applyAuthoritySession(context, baseURL);
  await page.goto(ROUTES.curate, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /^Curate$/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Incoming \/ Media/i })).toBeVisible();

  const muxInspect = page.locator(`a[href="/authority/media/inspect?assetId=${CANON.muxAssetId}"]`);
  const muxRow = page.locator("tr").filter({ has: muxInspect });
  await expect(muxRow.getByText(CANON.universeTitle, { exact: true })).toBeVisible();
  await expect(muxRow.getByRole("link", { name: "Open Creative Suite", exact: true })).toBeVisible();
  notes.push("Super Hero Ego Mux asset is already associated; Associate is not the primary action");

  const duplicate = await page.request.post("/api/authority/media", {
    data: { asset_id: CANON.muxAssetId, universe_id: CANON.universeId },
  });
  expect(duplicate.status(), `duplicate association HTTP ${duplicate.status()}`).toBe(200);
  const duplicateBody = await duplicate.json();
  expect(duplicateBody.already_associated).toBe(true);
  expect(duplicateBody.binding_id).toBe(CANON.muralBindingId);
  expect(duplicateBody.asset_id).toBe(CANON.muxAssetId);
  expect(duplicateBody.mural_id).toBe(CANON.muralId);
  expect(duplicateBody.projection_id).toBe(CANON.muralProjectionId);
  notes.push("duplicate Super Hero Ego association is idempotent and keeps the existing Mural binding");

  const occupied = await page.request.post("/api/authority/media", {
    data: { asset_id: CANON.unboundLivepeerAssetId, universe_id: CANON.universeId },
  });
  expect(occupied.status(), `occupied mural HTTP ${occupied.status()}`).toBe(409);
  const occupiedBody = await occupied.json();
  expect(occupiedBody.code).toBe("mural_occupied");
  notes.push("unbound media does not replace Super Hero Ego Mural media");

  const missingUniverse = await page.request.post("/api/authority/media", {
    data: { asset_id: CANON.unboundLivepeerAssetId, universe_id: "00000000-0000-4000-8000-000000000000" },
  });
  expect(missingUniverse.status()).toBe(404);
  notes.push("unknown Universe is rejected");

  const wrongProjection = await page.request.post("/api/authority/media", {
    data: {
      asset_id: CANON.unboundLivepeerAssetId,
      universe_id: CANON.universeId,
      projection_id: CANON.swordMasterProjectionId,
    },
  });
  expect(wrongProjection.status()).toBe(409);
  const wrongBody = await wrongProjection.json();
  expect(wrongBody.code).toBe("wrong_work");
  notes.push("client-supplied Scene projection cannot hijack Universe association");

  const unboundInspect = page.locator(`a[href="/authority/media/inspect?assetId=${CANON.unboundLivepeerAssetId}"]`);
  const unboundRow = page.locator("tr").filter({ has: unboundInspect });
  await expect(unboundRow.getByText(/Not associated/i)).toBeVisible();
  await unboundRow.getByRole("button", { name: "Associate with Universe" }).click();
  const associateForm = unboundRow.getByRole("form", { name: "Associate media with Universe" });
  await expect(associateForm).toBeVisible();
  await associateForm.getByLabel("Select Universe to associate").selectOption(CANON.universeId);
  await expect(associateForm.getByRole("alert")).toContainText(/already has different media/i);
  await expect(associateForm.getByRole("button", { name: "Confirm association" })).toBeDisabled();
  notes.push("Curate Studio shows Super Hero Ego as occupied for unbound media");

  await associateForm.getByLabel("Select Universe to associate").selectOption(CANON.untitledUniverseId);
  const untitledNoMural = associateForm.getByRole("alert").filter({ hasText: /no Mural/i });
  if (await untitledNoMural.count()) {
    await expect(untitledNoMural).toBeVisible();
    await expect(associateForm.getByRole("button", { name: "Confirm association" })).toBeDisabled();
    await expect(associateForm.getByRole("button", { name: "Register Mural" })).toBeVisible();
    notes.push("Universe without Mural is blocked; Register Mural is offered without creating a binding");
  } else {
    await expect(associateForm.getByRole("button", { name: "Confirm association" })).toBeVisible();
    notes.push("untitled Universe already has a Mural; association smoke does not bind unbound Livepeer");
  }

  await muxRow.getByRole("link", { name: "Open Creative Suite", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseWorkspace}\\?from=curate`));
  await expectCreativeSuiteComposition(page);
  notes.push("Creative Suite Identity / Mural / Scenes / Creative Moments remain intact");

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Curate", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.curate}$`));
  await expect(page.locator("tr").filter({ has: muxInspect }).getByText(CANON.universeTitle, { exact: true })).toBeVisible();
  notes.push("returning to Curate Studio still shows Super Hero Ego association");

  assertRuntimeHealth(observe);
  reportEvidence(
    testInfo,
    "BROWSER VERIFIED",
    "Stage 2.6 media association",
    page.url(),
    notes,
    observe,
  );
});
