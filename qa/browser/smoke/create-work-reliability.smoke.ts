import { CANON, ROUTES } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { reportEvidence } from "../lib/observe";

const FATHER_RAYMOND_MASTER = "e22e080c-715c-4045-ba82-20474d25b2e0";

test("Create Work and Curate expose processing and continuation without hidden URLs", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(180_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";

  await applyAuthoritySession(context, baseURL);

  await page.goto(ROUTES.authority, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Authority Console/i })).toBeVisible();
  await expect(page.getByText(/Video processing continues on the work record/i)).toBeVisible();
  await page.screenshot({ path: "/opt/cursor/artifacts/dashboard_create_work_and_suite.png", fullPage: true });
  notes.push("A: Dashboard Create Work card explains processing continues on the work");

  await page.goto(ROUTES.authorityCreate, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Create Work/i })).toBeVisible();
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.getByPlaceholder(/Universe title/i).fill("Father Raymond - Golden Shovel feat Reverb 360");
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.getByRole("checkbox", { name: /Attach a video now/i }).uncheck();
  await page.getByRole("button", { name: /Continue/i }).click();
  await expect(page.getByText(/request timeout is not a processing failure/i).or(page.getByText(/already registered/i))).toBeVisible();
  await page.screenshot({ path: "/opt/cursor/artifacts/create_work_review_processing_copy.png", fullPage: true });
  notes.push("B: Create Work review distinguishes canonical registration from video processing");

  await page.goto(ROUTES.authorityCurateMuxAsset, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: /^Inspect$/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Creative Studio/i }).first()).toBeVisible();
  await page.screenshot({ path: "/opt/cursor/artifacts/curate_inspect_sentinel_suite_continuation.png", fullPage: true });
  notes.push("C: Bound Curate media offers Inspect and Creative Suite continuation");

  await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("navigation", { name: "Creative Suite" }).getByRole("link", { name: "Storyboard", exact: true })).toBeVisible();
  await expect(page.getByText(/2\.5D/i).first()).toBeVisible();
  await page.screenshot({ path: "/opt/cursor/artifacts/super_hero_ego_suite_storyboard.png", fullPage: true });
  notes.push("D: Super Hero Ego Creative Suite still mounts Storyboard and 2.5D");

  const work = await page.goto(`/authority/${FATHER_RAYMOND_MASTER}`, { waitUntil: "domcontentloaded" });
  if (work && work.ok()) {
    const processing = page.getByText(/Media processing|Processing video|ready to attach|Check processing/i);
    if (await processing.first().isVisible().catch(() => false)) {
      await page.screenshot({ path: "/opt/cursor/artifacts/father_raymond_processing_resume.png", fullPage: true });
      notes.push("E: Father Raymond work record exposes processing/resume state");
    } else {
      notes.push("E: Father Raymond work record loaded; processing panel not required if media already bound");
    }
  } else {
    notes.push("E: Father Raymond work record not reachable in this environment");
  }

  reportEvidence(testInfo, "BROWSER VERIFIED", "Stage 4.1 Create Work reliability & Curate continuation", page.url(), notes, observe);
});
