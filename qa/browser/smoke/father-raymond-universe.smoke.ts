import { CANON, ROUTES } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

test("Father Raymond Universe plays the mural and states Scenes are curator work", async ({ page, observe }, testInfo) => {
  const notes: string[] = [];
  const response = await page.goto(ROUTES.fatherRaymondUniverse, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `Father Raymond universe HTTP ${response?.status()}`).toBeTruthy();

  await expect(page.getByRole("heading", { name: new RegExp(CANON.fatherRaymondTitleIncludes, "i") }).first()).toBeVisible();
  await expect(page.locator("[data-universe-mural-stage=live]")).toBeVisible();
  await expect(page.locator('video[aria-label="Mighty Verse media player"]')).toBeVisible();
  const html = await page.content();
  expect(html.includes(CANON.fatherRaymondPlaybackId), "Universe landing must deliver Father Raymond Mux playback").toBeTruthy();
  await expect(page.locator("[data-universe-scenes=empty]")).toBeVisible();
  await expect(page.getByText(/No canonical Scenes are authorised yet/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Enter Scene Deck/i })).toHaveCount(0);
  await expect(page.locator("[data-public-footer=site]")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "Universes", exact: true })).toBeVisible();
  notes.push("Universe landing stages mural Mux without inventing Scenes");

  await page.goto(ROUTES.fatherRaymondUniverseScenes, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-universe-scenes=empty]")).toBeVisible();
  notes.push("Universe Scene Deck is honest when no Scenes exist");

  await page.goto(ROUTES.fatherRaymondMural, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: /Scene Deck/i })).toHaveCount(0);
  notes.push("Mural does not send the audience into an empty Scene Deck");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Father Raymond Universe mural stage", page.url(), notes, observe);
});
