import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";

const TARGET = "91027ced-7fd8-405a-8ecd-3ed874e27913";
const ARTIFACTS = "/opt/cursor/artifacts";

test("catalogue UX edit/remove pagination and Authority trim", async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);

  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Universe projects" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Super Hero Ego", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" }).first()).toBeVisible();
  const she = page.locator("[data-universe-project='05ccc0c6-75f9-4864-b0c1-af5e36bf45cc']");
  await expect(she).toBeVisible();
  await expect(she.getByRole("button", { name: /Withdraw|Remove orphan/i })).toHaveCount(0);
  await page.screenshot({ path: `${ARTIFACTS}/studio-universe-projects.png`, fullPage: true });

  await page.goto("/authority", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Authority Console" })).toBeVisible();
  await expect(page.getByText("Public Universes catalog.")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Creative journey" })).toHaveCount(0);
  await expect(page.getByText("Experience is public. Sentinel observes throughout.")).toHaveCount(0);
  await expect(page.locator('[data-dashboard-surface="studio"]').first()).toBeVisible();
  await expect(page.locator('[data-dashboard-surface="experience"]')).toHaveCount(0);
  await expect(page.locator('[data-dashboard-surface="discover"]')).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Discover" })).toHaveCount(0);
  await page.screenshot({ path: `${ARTIFACTS}/authority-dashboard.png`, fullPage: true });

  await page.goto("/authority/scenes", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Scenes", exact: true })).toBeVisible();
  await expect(page.locator("[data-catalogue-record]").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" }).first()).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/authority-scenes.png`, fullPage: true });

  await page.goto(`/authority/universes/${TARGET}/sentinel`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-sentinel-page='true']")).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/universe-sentinel.png`, fullPage: true });

  await page.goto(`/authority/universes/${TARGET}/production`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Production" })).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/universe-production.png`, fullPage: true });

  await page.goto(`/authority/universes/${TARGET}/experience`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Holographic Experience" })).toBeVisible();
  await expect(page.locator(".studio-header-actions [data-experience-entry='holographic']")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit identity" }).first()).toBeVisible();
  await expect(
    page.locator("section[aria-labelledby='universe-experience-continuation'] [data-experience-entry='holographic']"),
  ).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/universe-experience.png`, fullPage: true });
});
