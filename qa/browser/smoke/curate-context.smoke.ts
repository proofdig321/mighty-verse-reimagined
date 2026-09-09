import { CANON, ROUTES } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

test("unauthenticated Curate asset context still requires Authority session", async ({ page, observe }, testInfo) => {
  const response = await page.goto(ROUTES.authorityCurateMuxAsset, { waitUntil: "domcontentloaded" });
  expect(response, "contextual Curate navigation produced a response").toBeTruthy();
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Curate asset context auth gate", page.url(), [
    "unauthenticated /authority/curate?asset= redirects to sign-in",
    "client-supplied asset context cannot bypass Authority session",
  ], observe);
});

test("Gallery and Inspect carry selected media into Curate Studio", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(120_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);

  await page.goto(ROUTES.authorityMedia, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Media Library/i })).toBeVisible();
  const muxCard = page.locator(`a[href="${ROUTES.authorityMuxAsset}"]`).first();
  await expect(muxCard).toBeVisible();
  await muxCard.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityMuxAsset}$`));
  const continueFromRecord = page.getByRole("link", { name: "Continue in Curate", exact: true });
  await expect(continueFromRecord).toHaveAttribute("href", ROUTES.authorityCurateMuxAsset);
  notes.push("Path A: Asset Record Continue in Curate preserves Mux asset identity");

  await continueFromRecord.click();
  await expect(page).toHaveURL(new RegExp(`/authority/curate\\?asset=${CANON.muxAssetId}`));
  await expect(page.getByRole("heading", { name: /^Curate$/ })).toBeVisible();
  const muxFocus = page.locator("tr[aria-current='true']");
  await expect(muxFocus).toContainText(CANON.universeTitle);
  await expect(muxFocus.getByRole("link", { name: "Open Creative Studio", exact: true })).toBeVisible();
  await expect(muxFocus.getByRole("button", { name: "Associate with Universe" })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: /already associated/i })).toBeVisible();
  notes.push("Path A: Curate Studio focuses Super Hero Ego Mux asset and offers Creative Suite, not association");

  await page.goto(ROUTES.authorityMuxAsset, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Inspect Media", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/authority/media/inspect\\?assetId=${CANON.muxAssetId}`));
  await expect(page.getByRole("heading", { name: /Media Inspection/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Curate", exact: true })).toHaveAttribute(
    "href",
    ROUTES.authorityCurateMuxAsset,
  );
  const continueFromInspect = page.getByRole("link", { name: "Continue in Curate", exact: true });
  await expect(continueFromInspect).toHaveAttribute("href", ROUTES.authorityCurateMuxAsset);
  await continueFromInspect.click();
  await expect(page).toHaveURL(new RegExp(`/authority/curate\\?asset=${CANON.muxAssetId}`));
  await expect(page.locator("tr[aria-current='true']").getByRole("link", { name: "Open Creative Studio", exact: true })).toBeVisible();
  notes.push("Path B: Inspect Continue in Curate retains the same Mux asset context");

  await page.goto(`${ROUTES.curate}?asset=${CANON.muxAssetId}&universe=${CANON.untitledUniverseId}`, {
    waitUntil: "domcontentloaded",
  });
  const spoofedFocus = page.locator("tr[aria-current='true']");
  await expect(spoofedFocus).toContainText(CANON.universeTitle);
  await expect(spoofedFocus.getByRole("button", { name: "Associate with Universe" })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: /already associated/i })).toBeVisible();
  notes.push("client-supplied untitled Universe query cannot re-offer association for Super Hero Ego media");

  await page.goto(ROUTES.authorityUnboundAsset, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Continue in Curate", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/authority/curate\\?asset=${CANON.unboundLivepeerAssetId}`));
  const unboundFocus = page.locator("tr[aria-current='true']");
  await expect(unboundFocus.getByText(/Not associated/i)).toBeVisible();
  const associateForm = unboundFocus.getByRole("form", { name: "Associate media with Universe" });
  await expect(associateForm).toBeVisible();
  await associateForm.getByLabel("Select Universe to associate").selectOption(CANON.universeId);
  await expect(associateForm.getByRole("alert")).toContainText(/already has different media/i);
  await expect(associateForm.getByRole("button", { name: "Confirm association" })).toBeDisabled();
  notes.push("Path C: unbound asset arrives preselected with Associate with Universe; Super Hero Ego remains occupied; no bind confirmed");

  await page.goto(ROUTES.authorityCurateMuxAsset, { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Select Universe for Curate Studio")).toHaveValue(CANON.universeId);
  await expect(page.getByRole("heading", { name: /Inspect \/ Sentinel/i })).toBeVisible();
  await page.locator("tr[aria-current='true']").getByRole("link", { name: "Open Creative Studio", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseWorkspace}\\?from=curate`));
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  notes.push("Path D: bound Super Hero Ego context continues to Creative Suite");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 2.8 Curate media context", page.url(), notes, observe);
});
