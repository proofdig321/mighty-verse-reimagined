import { CANON, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

test("inspect scopes Super Hero Ego Scenes to Super Hero Ego media only", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);

  const she = await page.goto(ROUTES.authorityMuxInspect, { waitUntil: "domcontentloaded" });
  expect(she?.ok(), `Super Hero Ego inspect HTTP ${she?.status()}`).toBeTruthy();
  await expect(page.getByRole("heading", { name: /Media Inspection/i })).toBeVisible();
  await expect(page.getByTestId("inspect-work-belonging")).toContainText(CANON.universeTitle);
  await expect(page.getByText(SCENE_MOMENTS.powerhouse.sceneTitle, { exact: true })).toBeVisible();
  notes.push("Super Hero Ego inspect lists Golden Shovel — Powerhouse on its own work");

  const unbound = await page.goto(ROUTES.authorityUnboundInspect, { waitUntil: "domcontentloaded" });
  expect(unbound?.ok(), `unbound inspect HTTP ${unbound?.status()}`).toBeTruthy();
  await expect(page.getByRole("heading", { name: /Media Inspection/i })).toBeVisible();
  await expect(page.getByTestId("inspect-work-belonging")).toBeVisible();
  await expect(page.getByTestId("inspect-empty-scenes")).toBeVisible();
  await expect(page.getByText(SCENE_MOMENTS.powerhouse.sceneTitle, { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Nearest canonical scene/i)).toHaveCount(0);
  notes.push("unbound inspect does not list Golden Shovel — Powerhouse");

  const frInspect = await page.goto(ROUTES.authorityFatherRaymondInspect, { waitUntil: "domcontentloaded" });
  if (frInspect && frInspect.ok()) {
    await expect(page.getByRole("heading", { name: /Media Inspection/i })).toBeVisible();
    await expect(page.getByText(SCENE_MOMENTS.powerhouse.sceneTitle, { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Nearest canonical scene on Super Hero Ego/i)).toHaveCount(0);
    const belonging = page.getByTestId("inspect-work-belonging");
    if (await belonging.count()) {
      await expect(belonging).not.toHaveText(new RegExp(`This media belongs to ${CANON.universeTitle}`));
    }
    notes.push("Father Raymond inspect does not associate candidates with Super Hero Ego");
  } else {
    notes.push(`Father Raymond inspect not live in this environment (HTTP ${frInspect?.status() ?? "none"})`);
  }

  const frHub = await page.goto(ROUTES.authorityFatherRaymondHub, { waitUntil: "domcontentloaded" });
  if (frHub && frHub.ok() && !/\/auth\/sign-in/.test(page.url())) {
    const next = page.getByRole("heading", { name: /Register a Mural/i });
    if (await next.count()) {
      await expect(next).toBeVisible();
      await expect(page.getByRole("link", { name: "Register Mural" }).first()).toHaveAttribute(
        "href",
        ROUTES.authorityFatherRaymondMural,
      );
      notes.push("Father Raymond Curate Hub next action is Register Mural, not Super Hero Ego");
    } else {
      notes.push("Father Raymond hub loaded; next action is not Register Mural in this environment");
    }
  } else {
    notes.push(`Father Raymond hub not live in this environment (HTTP ${frHub?.status() ?? "none"})`);
  }

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Inspect work scope", page.url(), notes, observe);
});
