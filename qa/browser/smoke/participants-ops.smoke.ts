import { ROUTES } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

test("dashboard keeps operations chrome and participant management", async ({ page, observe, context }, testInfo) => {
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";

  await applyAuthoritySession(context, baseURL);

  await page.goto(ROUTES.authority, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/authority/);
  const consoleNav = page.getByRole("navigation", { name: "Authority Console" });
  await expect(consoleNav).toBeVisible();
  await expect(consoleNav.getByRole("link", { name: "Participants" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Product" })).toHaveCount(0);
  notes.push("Dashboard keeps AppShell; audience Product nav is absent");

  await page.goto(ROUTES.authorityParticipants, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Participants" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Register participant" })).toBeVisible();
  await expect(page.getByText("Golden Shovel", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Suspend" }).first()).toBeVisible();
  notes.push("Authority can register, edit, and suspend participants");

  await page.getByRole("button", { name: "Register participant" }).click();
  await expect(page.getByText("Display name (required)")).toBeVisible();
  notes.push("Register form stays on the existing participant API");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Dashboard participant operations", page.url(), notes, observe);
});
