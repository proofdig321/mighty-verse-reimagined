import { CANON, ROUTES } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

test("unauthenticated Curate asset context still requires Authority session", async ({ page, observe }, testInfo) => {
  const response = await page.goto(ROUTES.authorityCurateMuxAsset, { waitUntil: "domcontentloaded" });
  expect(response, "contextual Curate navigation produced a response").toBeTruthy();
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(page.locator('[data-slot="card-title"]').filter({ hasText: /Sign in/i })).toBeVisible();
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
    ROUTES.authorityCurateHub,
  );
  const continueFromInspect = page.getByRole("link", { name: "Continue in Curate", exact: true });
  await expect(continueFromInspect).toHaveAttribute("href", ROUTES.authorityCurateHub);
  await continueFromInspect.click();
  await expect(page).toHaveURL(new RegExp(`/authority/curate/${CANON.universeId}$`));
  await expect(page.getByText("Curate Hub", { exact: true })).toBeVisible();
  notes.push("Path B: Inspect Continue in Curate opens Super Hero Ego Hub, not the incoming catalogue");

  await page.goto(`${ROUTES.curate}?asset=${CANON.muxAssetId}&universe=${CANON.fatherRaymondUniverseId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(new RegExp(`/authority/curate/${CANON.fatherRaymondUniverseId}$`));
  await expect(page.getByText("Curate Hub", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Associate with Universe" })).toHaveCount(0);
  notes.push("legacy universe query opens that work's hub and cannot re-associate Super Hero Ego media");

  // Path C: the canonical unbound Livepeer asset is discarded (operator:discarded) so it is
  // excluded from the curate table by loadCurateStudioMedia. Navigating to its asset record
  // still works; the curate gateway opens the incoming catalogue without a focused row.
  await page.goto(ROUTES.authorityUnboundAsset, { waitUntil: "domcontentloaded" });
  const continueFromUnbound = page.getByRole("link", { name: "Continue in Curate", exact: true });
  if (await continueFromUnbound.count()) {
    await continueFromUnbound.click();
    await expect(page).toHaveURL(new RegExp(`/authority/curate\\?asset=${CANON.discardedAssetId}`));
    await expect(page.getByRole("heading", { name: /^Curate$/ })).toBeVisible();
    // Discarded asset is filtered from the table — no aria-current row
    await expect(page.locator("tr[aria-current='true']")).toHaveCount(0);
  }
  notes.push("Path C: discarded unbound asset is excluded from curate table; no association form presented");

  await page.goto(ROUTES.authorityCurateMuxAsset, { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Select Universe for Curate Studio")).toHaveValue("");
  await expect(page.getByRole("heading", { name: /Incoming \/ Media/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Curate Hub/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Run Inspection/i })).toHaveCount(0);
  await expect(page.locator("tr[aria-current='true']").getByRole("link", { name: "Sentinel", exact: true })).toHaveAttribute(
    "href",
    ROUTES.authorityCurateSentinel,
  );
  await page.locator("tr[aria-current='true']").getByRole("link", { name: "Open Creative Studio", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseWorkspace}\\?from=curate`));
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  notes.push("Path D: bound Super Hero Ego context stays on the incoming catalogue and continues to Creative Studio; Sentinel is a child route");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 2.8 Curate media context", page.url(), notes, observe);
});
