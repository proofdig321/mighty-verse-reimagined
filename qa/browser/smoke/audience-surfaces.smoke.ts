import { ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

test("audience chrome restores Discover pages without the operations sidebar", async ({ page, observe }, testInfo) => {
  const notes: string[] = [];

  await page.goto(ROUTES.home, { waitUntil: "domcontentloaded" });
  const product = page.getByRole("navigation", { name: "Product" }).first();
  await expect(product.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  await expect(product.getByRole("link", { name: "Universes", exact: true })).toBeVisible();
  await expect(product.getByRole("link", { name: "Murals", exact: true })).toBeVisible();
  await expect(product.getByRole("link", { name: "Scenes", exact: true })).toBeVisible();
  await expect(product.getByRole("link", { name: "Creative Moments", exact: true })).toBeVisible();
  await expect(product.getByRole("link", { name: "Storyboard", exact: true })).toBeVisible();
  await expect(product.getByRole("link", { name: "Participants", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Discover" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Every Song is a Universe/i })).toBeVisible();
  notes.push("Home uses audience top nav, not the operations sidebar");

  await product.getByRole("link", { name: "Scenes", exact: true }).click();
  await expect(page).toHaveURL(/\/scenes/);
  await expect(page.getByRole("heading", { name: "Scene Deck" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Build Experience/i })).toBeVisible();
  notes.push("Scenes keeps shuffle, custom sequence, and Build Experience");

  await page.getByRole("link", { name: "Help", exact: true }).first().click();
  await expect(page).toHaveURL(/\/help/);
  await expect(page.getByRole("heading", { name: "How Mighty Verse works" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Play narrator/i })).toBeVisible();
  notes.push("Help walkthrough exposes the browser narrator");

  await page.getByRole("navigation", { name: "Product" }).first().getByRole("link", { name: "Participants", exact: true }).click();
  await expect(page).toHaveURL(/\/participants/);
  await expect(page.getByRole("heading", { name: "Creators & Participants" })).toBeVisible();
  notes.push("Public participants catalogue is restored");

  await page.goto(ROUTES.storyboard, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  notes.push("Audience storyboard stays signed-in; it reuses the existing workspace");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Audience Discover chrome", page.url(), notes, observe);
});
