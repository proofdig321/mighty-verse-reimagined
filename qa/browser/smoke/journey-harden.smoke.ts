import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";

const SHE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const FR = "e22e080c-715c-4045-ba82-20474d25b2e0";
const JUDAS = "430ccb6b-6c31-4504-8729-19e7213e54a5";
const ARTIFACTS = "/opt/cursor/artifacts";

test("Authority journeys keep Studio off dashboard and persist Universe Sentinel", async ({ page, context }, testInfo) => {
  test.setTimeout(180_000);
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-public-hero-parallax=true]")).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/home_hero_parallax.png` });

  await page.goto("/authority", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Authority Console" })).toBeVisible();
  await expect(page.locator('[data-dashboard-surface="experience"]')).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Discover" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Public Experience" })).toHaveCount(0);
  await page.screenshot({ path: `${ARTIFACTS}/authority_dashboard_operations.png` });

  for (const [label, id] of [
    ["she", SHE],
    ["fr", FR],
    ["judas", JUDAS],
  ] as const) {
    await page.goto(`/authority/universes/${id}/sentinel`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-sentinel-page='true']")).toBeVisible();
    await expect(page.getByText("No mural media is attached to this Universe.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Analyse source/i })).toBeVisible();
    await page.screenshot({ path: `${ARTIFACTS}/sentinel_${label}.png`, fullPage: true });
  }

  await page.goto(`/authority/universes/${SHE}/preview`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Production" }).first()).toBeVisible();
  const productionImg = page.locator("[data-holographic-orbit='production'] img").first();
  await expect(productionImg).toBeVisible();
  await expect(productionImg).toHaveAttribute("src", /image\.mux\.com\/.*time=36/);
  await page.screenshot({ path: `${ARTIFACTS}/she_preview_production.png`, fullPage: true });

  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Timeline" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Universe projects" })).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/studio_home.png` });

  await page.goto("/editor", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Scene Deck timeline")).toBeVisible();
  await expect(page.getByText("Storyboard authoring lives in Creative Studio.")).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/public_editor.png` });
});
