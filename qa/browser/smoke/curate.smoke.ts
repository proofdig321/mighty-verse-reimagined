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
  await expect(page.getByRole("heading", { name: /Incoming \/ Media/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Curate Hub/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Sentinel$/ })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "curate-workspace");
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Curate", page.url(), [
    "route loaded",
    "Curate incoming catalogue rendered",
    "Universe selection UI rendered",
    "Hub and Sentinel are not stacked on the index",
  ], observe);
});

test("Authority dashboard opens Curate then Super Hero Ego hub, not a stacked page", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);

  const dashboard = await page.goto(ROUTES.authority, { waitUntil: "domcontentloaded" });
  expect(dashboard?.ok(), `authority dashboard HTTP ${dashboard?.status()}`).toBeTruthy();
  await expect(page.getByRole("heading", { name: /Authority Console/i })).toBeVisible();
  const curateCta = page.locator(`a[href="${ROUTES.curate}"]`).filter({ hasText: "Curate" }).first();
  await expect(curateCta).toHaveAttribute("href", ROUTES.curate);
  notes.push("dashboard Curate CTA → /authority/curate");

  await curateCta.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.curate}$`));
  await expect(page.getByRole("heading", { name: /^Curate$/ })).toBeVisible();
  await expect(page.getByText("Shape the work").first()).toBeVisible();
  await expect(page.getByText(/Uploading media does not create a Universe/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Incoming \/ Media/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Curation context/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Curate Hub/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Run Inspection/i })).toHaveCount(0);
  notes.push("Curate index is incoming media + Universe picker only");

  const inspectMux = page.locator(`a[href="/authority/media/inspect?assetId=${CANON.muxAssetId}"]`);
  await expect(inspectMux.first()).toBeVisible();
  const muxRow = page.locator("tr").filter({ has: inspectMux });
  await expect(muxRow.getByText(CANON.universeTitle, { exact: true })).toBeVisible();
  await expect(muxRow.getByText(`Mural ${CANON.muralTitle}`)).toBeVisible();
  await expect(muxRow.getByRole("link", { name: "Open Creative Studio", exact: true })).toHaveAttribute(
    "href",
    `${ROUTES.authorityUniverseWorkspace}?from=curate`,
  );
  await expect(muxRow.getByRole("link", { name: "Sentinel", exact: true })).toHaveAttribute(
    "href",
    ROUTES.authorityCurateSentinel,
  );
  await expect(muxRow.getByRole("button", { name: "Associate with Universe" })).toHaveCount(0);
  notes.push(`incoming Mux asset ${CANON.muxAssetId} associated with ${CANON.universeTitle}; Sentinel is a child route`);

  await page.getByLabel("Select Universe for Curate Studio").selectOption(CANON.universeId);
  await expect(page).toHaveURL(new RegExp(`/authority/curate/${CANON.universeId}$`));
  await expect(page.getByRole("heading", { name: /Curate Hub/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Incoming \/ Media/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Run Inspection/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open Sentinel", exact: true })).toHaveAttribute(
    "href",
    ROUTES.authorityCurateSentinel,
  );
  notes.push("selecting Super Hero Ego opens the Curate Hub child route without stacking Sentinel");

  await page.getByRole("link", { name: "Open Sentinel", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/authority/curate/${CANON.universeId}/sentinel$`));
  await expect(page.getByRole("heading", { name: /^Sentinel$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Run Inspection/i })).toBeVisible();
  await expect(page.getByText(/Evidence only/i).first()).toBeVisible();
  notes.push("Sentinel is a dedicated child page");

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: CANON.universeTitle, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/authority/curate/${CANON.universeId}$`));
  notes.push("breadcrumb returns to the Curate Hub");

  await page.getByRole("link", { name: "Open Creative Studio", exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseWorkspace}\\?from=curate`));
  await expectCreativeSuiteComposition(page);
  notes.push("Creative Suite Identity / Mural / Scenes / Creative Moments remain intact from Curate");

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Curate", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/authority/curate/${CANON.universeId}$`));
  await expect(page.getByRole("heading", { name: /Curate Hub/i })).toBeVisible();
  notes.push("Studio breadcrumb returns to this Universe's Curate Hub");

  assertRuntimeHealth(observe);
  reportEvidence(
    testInfo,
    "BROWSER VERIFIED",
    "Super Hero Ego Curate child routes",
    page.url(),
    notes,
    observe,
  );
});
