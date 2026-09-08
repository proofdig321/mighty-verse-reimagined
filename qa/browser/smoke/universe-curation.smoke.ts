import { CANON, ROUTES, SCENE_MOMENTS, CREATIVE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";
import { expectCreativeSuiteComposition } from "../lib/suite-composition";

test("unauthenticated Universe listing redirects to sign-in", async ({ page, observe }, testInfo) => {
  const response = await page.goto(ROUTES.authorityUniverses, { waitUntil: "domcontentloaded" });
  expect(response, "universes listing produced a response").toBeTruthy();
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Authority Universes auth gate", page.url(), [
    `${ROUTES.authorityUniverses} redirected to sign-in without a session`,
  ], observe);
});

test("unauthenticated Universe workspace redirects to sign-in", async ({ page, observe }, testInfo) => {
  const response = await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" });
  expect(response, "universe workspace produced a response").toBeTruthy();
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Universe workspace auth gate", page.url(), [
    `${ROUTES.authorityUniverseWorkspace} redirected to sign-in without a session`,
  ], observe);
});

test("Authority Universes opens Super Hero Ego curation workspace", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);

  const dashboard = await page.goto(ROUTES.authority, { waitUntil: "domcontentloaded" });
  expect(dashboard?.ok(), `authority dashboard HTTP ${dashboard?.status()}`).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authority}$`));
  await expect(page.getByRole("heading", { name: /Authority Console/i })).toBeVisible();
  notes.push(`Authority dashboard ${ROUTES.authority} HTTP ${dashboard?.status()}`);

  await page.getByRole("navigation", { name: "Authority" }).getByRole("link", { name: "Universes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverses}$`));
  await expect(page.getByRole("heading", { name: /^Universes$/ })).toBeVisible();
  const workspaceLink = page.locator(`a[href="${ROUTES.authorityUniverseWorkspace}"]`).filter({ hasText: CANON.universeTitle }).first();
  await expect(workspaceLink).toBeVisible();
  notes.push(`Universes listing exposes ${CANON.universeTitle} → ${ROUTES.authorityUniverseWorkspace}`);

  await workspaceLink.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseWorkspace}$`));
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  await expect(page.getByText("Creative Suite").first()).toBeVisible();
  const suiteNav = page.getByRole("navigation", { name: "Creative Suite" });
  await expect(suiteNav.getByRole("link", { name: "Identity", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "Mural", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "Scenes", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "Creative Moments", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Universes", exact: true })).toHaveAttribute(
    "href",
    ROUTES.authorityUniverses,
  );
  await expect(page.getByRole("link", { name: "View public experience" })).toHaveAttribute("href", ROUTES.universeLive);
  await expect(page.getByRole("link", { name: "Canonical record" })).toHaveAttribute("href", `/authority/${CANON.universeId}`);

  await expectCreativeSuiteComposition(page);
  for (const scene of Object.values(SCENE_MOMENTS)) {
    notes.push(`suite Scene ${scene.sceneTitle} → ${scene.creativeMomentTitle}`);
  }
  for (const cm of Object.values(CREATIVE_MOMENTS)) {
    notes.push(`workspace Creative Moment ${cm.title} ${cm.masterId}`);
  }

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Universes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverses}$`));
  notes.push("breadcrumb returned to Universes listing");

  await page.goto(`/authority/universes/${CANON.muralId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Universe not found/i })).toBeVisible();
  notes.push(`non-universe id ${CANON.muralId} rendered Universe not found`);

  assertRuntimeHealth(observe);
  reportEvidence(
    testInfo,
    "BROWSER VERIFIED",
    "Super Hero Ego Creative Suite",
    page.url(),
    notes,
    observe,
  );
});
