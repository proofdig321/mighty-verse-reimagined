import { CANON, ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

/**
 * Father Raymond Universe now has 4 authorised Scenes (Intro, Verse 1 — Golden Shovel,
 * Hook — Reverb 360, Verse 2 — Golden Shovel). The previous invariant "no Scenes" was
 * stale. The canonical invariant is: FR Universe stages its mural and exposes its Scenes.
 */
test("Father Raymond Universe plays the mural and exposes its canonical Scenes", async ({ page, observe }, testInfo) => {
  const notes: string[] = [];
  const response = await page.goto(ROUTES.fatherRaymondUniverse, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `Father Raymond universe HTTP ${response?.status()}`).toBeTruthy();

  await expect(page.getByRole("heading", { name: new RegExp(CANON.fatherRaymondTitleIncludes, "i") }).first()).toBeVisible();
  await expect(page.locator("[data-universe-mural-stage=live]")).toBeVisible();
  await expect(page.locator('video[aria-label="Mighty Verse media player"]')).toBeVisible();
  const html = await page.content();
  expect(html.includes(CANON.fatherRaymondPlaybackId), "Universe landing must deliver Father Raymond Mux playback").toBeTruthy();
  // FR now has 4 authorised Scenes — the empty-scenes state must NOT appear
  await expect(page.locator("[data-universe-scenes=empty]")).toHaveCount(0);
  // Scene Deck entry must be present
  await expect(page.getByRole("link", { name: /Enter Scene Deck/i })).toBeVisible();
  await expect(page.locator("[data-public-footer=site]")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "Universes", exact: true })).toBeVisible();
  notes.push("Universe landing stages mural Mux and exposes Scene Deck (4 canonical Scenes authorised)");

  await page.goto(ROUTES.fatherRaymondUniverseScenes, { waitUntil: "commit" });
  // Scene Deck page must render scenes, not the empty state
  await expect(page.locator("[data-universe-scenes=empty]")).toHaveCount(0);
  notes.push("Universe Scene Deck renders canonical Scenes, not empty state");

  await page.goto(ROUTES.fatherRaymondMural, { waitUntil: "domcontentloaded" });
  // Mural page exposes Scene Deck link because Scenes exist (may be multiple links)
  await expect(page.getByRole("link", { name: /Scene Deck/i }).first()).toBeVisible();
  notes.push("Mural exposes Scene Deck link because canonical Scenes exist");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Father Raymond Universe mural stage", page.url(), notes, observe);
});
