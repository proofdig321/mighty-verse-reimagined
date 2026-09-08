import { expect, type Locator, type Page } from "@playwright/test";
import { CANON, CREATIVE_MOMENTS, SCENE_MOMENTS } from "./canon";

export async function revealCanonicalIdentifiers(scope: Locator) {
  const details = scope.locator("details").filter({ hasText: "Canonical identifiers" }).first();
  if (!(await details.count())) return;
  if (!(await details.getAttribute("open"))) {
    await details.locator("summary").click();
  }
}

export async function expectCreativeSuiteComposition(page: Page) {
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  await expect(page.getByText("Creative Suite").first()).toBeVisible();
  await expect(page.getByText(CANON.universeDescription).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /shuffle/i })).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);

  const mural = page.locator("section[aria-labelledby='universe-mural']");
  await expect(mural.getByText(/audiovisual expression/i)).toBeVisible();
  await revealCanonicalIdentifiers(mural);
  await expect(mural.getByText(CANON.muralId)).toBeVisible();

  const scenes = page.locator("section[aria-labelledby='universe-scenes']");
  const moments = page.locator("section[aria-labelledby='universe-moments']");
  await expect(scenes.locator("table")).toHaveCount(0);
  await expect(moments.locator("table")).toHaveCount(0);

  const sceneValues = Object.values(SCENE_MOMENTS);
  await expect(scenes.locator("article[data-scene-id]")).toHaveCount(sceneValues.length);
  for (const [index, scene] of sceneValues.entries()) {
    const object = scenes.locator(`#universe-scene-${scene.sceneMasterId}`);
    await expect(object).toBeVisible();
    await expect(object.locator(".suite-scene-ordinal")).toHaveText(String(index + 1).padStart(2, "0"));
    await expect(object.getByRole("heading", { name: new RegExp(`Scene 0${index + 1}\\. ${scene.shortName}`) })).toBeVisible();
    await expect(object.getByText(scene.sceneTitle, { exact: true })).toBeVisible();
    await expect(object.getByRole("link", { name: scene.creativeMomentTitle, exact: true })).toHaveAttribute(
      "href",
      `#universe-moment-${scene.creativeMomentId}`,
    );
    await expect(object.getByRole("link", { name: /Open record/i })).toHaveAttribute(
      "href",
      `/authority/${scene.sceneMasterId}`,
    );
  }

  await expect(moments.getByRole("heading", { name: "Proverb", exact: true })).toHaveCount(1);
  for (const cm of Object.values(CREATIVE_MOMENTS)) {
    const object = moments.locator(`#universe-moment-${cm.masterId}`);
    await expect(object).toBeVisible();
    await expect(object.getByRole("heading", { name: cm.title, exact: true })).toBeVisible();
  }

  const proverb = moments.locator(`#universe-moment-${CREATIVE_MOMENTS.proverb.masterId}`);
  await expect(proverb.getByText(/shared across scenes/i)).toBeVisible();
  await expect(proverb.getByRole("link", { name: SCENE_MOMENTS.powerhouse.shortName, exact: true })).toHaveAttribute(
    "href",
    `#universe-scene-${SCENE_MOMENTS.powerhouse.sceneMasterId}`,
  );
  await expect(proverb.getByRole("link", { name: SCENE_MOMENTS.handToHand.shortName, exact: true })).toHaveAttribute(
    "href",
    `#universe-scene-${SCENE_MOMENTS.handToHand.sceneMasterId}`,
  );
}
