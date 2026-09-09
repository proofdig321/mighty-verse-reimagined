import { CANON, ROUTES } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { captureScreenshot, reportEvidence } from "../lib/observe";
import { expectCreativeSuiteComposition } from "../lib/suite-composition";

test("curate route loads the authority surface or the real auth gate", async ({ page, observe }, testInfo) => {
  const response = await page.goto(ROUTES.curate, { waitUntil: "domcontentloaded" });
  expect(response, "curate navigation produced a response").toBeTruthy();

  const onSignIn = /\/auth\/sign-in/.test(page.url());
  const curateHeading = page.getByRole("heading", { name: /^Curate$/i });
  const signInHeading = page.getByRole("heading", { name: /Sign in/i });

  if (onSignIn) {
    await expect(signInHeading).toBeVisible();
    await captureScreenshot(page, testInfo, "curate-sign-in");
    assertRuntimeHealth(observe);
    reportEvidence(testInfo, "BROWSER VERIFIED", "Curate", page.url(), [
      "route loaded",
      "unauthenticated session redirected to /auth/sign-in",
      "Curate Studio not observed without an authenticated participant",
    ], observe);
    return;
  }

  await expect(curateHeading).toBeVisible();
  await expect(page.getByText("Shape the work").first()).toBeVisible();
  await expect(page.getByLabel("Select Universe for Curate Studio")).toBeVisible();
  await captureScreenshot(page, testInfo, "curate-workspace");
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Curate", page.url(), [
    "route loaded",
    "Curate Studio gateway rendered",
    "Universe selection UI rendered",
  ], observe);
});

test("Authority dashboard opens Curate Studio then Super Hero Ego Creative Suite", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);

  const dashboard = await page.goto(ROUTES.authority, { waitUntil: "domcontentloaded" });
  expect(dashboard?.ok(), `authority dashboard HTTP ${dashboard?.status()}`).toBeTruthy();
  await expect(page.getByRole("heading", { name: /Authority Console/i })).toBeVisible();
  const curateCta = page.locator(`a[href="${ROUTES.curate}"]`).filter({ hasText: "Curate" }).first();
  await expect(curateCta).toHaveAttribute("href", ROUTES.curate);
  notes.push("dashboard Curate Studio CTA → /authority/curate");

  await curateCta.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.curate}$`));
  await expect(page.getByRole("heading", { name: /^Curate$/ })).toBeVisible();
  await expect(page.getByText("Shape the work").first()).toBeVisible();
  await expect(page.getByText(/Uploading media does not create a Universe/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Incoming \/ Media/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Curation context/i })).toBeVisible();
  notes.push("Curate Studio gateway loaded");

  const inspectMux = page.locator(`a[href="/authority/media/inspect?assetId=${CANON.muxAssetId}"]`);
  await expect(inspectMux.first()).toBeVisible();
  const muxRow = page.locator("tr").filter({ has: inspectMux });
  await expect(muxRow.getByText(CANON.universeTitle, { exact: true })).toBeVisible();
  await expect(muxRow.getByText(`Mural ${CANON.muralTitle}`)).toBeVisible();
  await expect(muxRow.getByRole("link", { name: "Open Creative Studio", exact: true })).toHaveAttribute(
    "href",
    `${ROUTES.authorityUniverseWorkspace}?from=curate`,
  );
  await expect(muxRow.getByRole("button", { name: "Associate with Universe" })).toHaveCount(0);
  notes.push(`incoming Mux asset ${CANON.muxAssetId} associated with ${CANON.universeTitle}; Inspect stays on media inspect; Open Creative Studio preserves from=curate`);

  await page.getByLabel("Select Universe for Curate Studio").selectOption(CANON.universeId);
  await expect(page).toHaveURL(new RegExp(`/authority/curate\\?universe=${CANON.universeId}`));
  await expect(page.getByRole("heading", { name: /Sentinel \/ Establish Scenes/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Run Inspection/i })).toBeVisible();
  await expect(page.getByText(/Evidence only/i).first()).toBeVisible();
  notes.push("selecting Super Hero Ego reveals existing Sentinel inspection without creating a Universe");

  await page.getByRole("link", { name: "Open Creative Studio", exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseWorkspace}\\?from=curate`));
  await expectCreativeSuiteComposition(page);
  notes.push("Creative Suite Identity / Mural / Scenes / Creative Moments remain intact from Curate");

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Curate", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.curate}$`));
  await expect(page.getByRole("heading", { name: /^Curate$/ })).toBeVisible();
  notes.push("breadcrumb returned to Curate Studio");

  assertRuntimeHealth(observe);
  reportEvidence(
    testInfo,
    "BROWSER VERIFIED",
    "Super Hero Ego Curate Studio",
    page.url(),
    notes,
    observe,
  );
});
