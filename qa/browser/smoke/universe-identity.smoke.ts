import { CANON, ROUTES } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

test("unauthenticated Universe identity redirects to sign-in", async ({ page, observe }, testInfo) => {
  const response = await page.goto(ROUTES.authorityUniverseIdentity, { waitUntil: "domcontentloaded" });
  expect(response, "universe identity produced a response").toBeTruthy();
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Universe identity auth gate", page.url(), [
    `${ROUTES.authorityUniverseIdentity} redirected to sign-in without a session`,
  ], observe);
});

test("Authority curates Super Hero Ego identity without changing canonical values", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);

  const dashboard = await page.goto(ROUTES.authority, { waitUntil: "domcontentloaded" });
  expect(dashboard?.ok(), `authority dashboard HTTP ${dashboard?.status()}`).toBeTruthy();
  await page.getByRole("navigation", { name: "Authority" }).getByRole("link", { name: "Universes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverses}$`));

  await page.locator(`a[href="${ROUTES.authorityUniverseWorkspace}"]`).filter({ hasText: CANON.universeTitle }).first().click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseWorkspace}$`));
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  notes.push(`workspace ${ROUTES.authorityUniverseWorkspace}`);

  await page.getByRole("link", { name: "Edit identity" }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseIdentity}$`));
  await expect(page.getByText("Creative Suite").first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Creative Suite" }).getByRole("link", { name: "Identity", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByText("Identity")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue(CANON.universeTitle);
  await expect(page.getByLabel("Description")).toHaveValue(CANON.universeDescription);
  notes.push(`identity form loaded with ${CANON.universeTitle} / ${CANON.universeDescription}`);

  await page.screenshot({ path: testInfo.outputPath("universe-identity-curation.png"), fullPage: true });

  await page.getByLabel("Title").fill("   ");
  await page.getByRole("button", { name: "Save identity" }).click();
  await expect(page.locator("#universe-title-error")).toHaveText("Title is required.");
  notes.push("empty title rejected without a write");

  await page.getByLabel("Title").fill(CANON.universeTitle);
  await page.getByLabel("Description").fill(CANON.universeDescription);
  await page.getByRole("button", { name: "Save identity" }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseWorkspace}\\?identity=saved$`));
  await expect(page.getByRole("status")).toHaveText("Universe identity saved.");
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  await expect(page.getByText(CANON.universeDescription).first()).toBeVisible();
  notes.push("idempotent save returned to workspace with canonical identity intact");

  await page.goto(`/authority/universes/${CANON.muralId}/identity`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Universe not found/i })).toBeVisible();
  notes.push(`non-universe id ${CANON.muralId} identity route rendered Universe not found`);

  assertRuntimeHealth(observe);
  reportEvidence(
    testInfo,
    "BROWSER VERIFIED",
    "Super Hero Ego Universe identity curation",
    page.url(),
    notes,
    observe,
  );
});
