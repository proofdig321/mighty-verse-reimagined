import { expect, type Locator, type Page } from "@playwright/test";
import { CANON, CREATIVE_MOMENTS, ROUTES, SCENE_MOMENTS } from "./canon";

export async function revealCanonicalIdentifiers(scope: Locator) {
  const details = scope.locator("details").filter({ hasText: "Canonical identifiers" }).first();
  if (!(await details.count())) return;
  if (!(await details.getAttribute("open"))) {
    await details.locator("summary").click();
  }
}

export async function expectCreativeSuiteComposition(page: Page) {
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true }).first()).toBeVisible();
  await expect(page.getByText("Creative Studio").first()).toBeVisible();
  await expect(page.getByText(CANON.universeDescription).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /shuffle/i })).toHaveCount(0);
  await expect(page.locator("[data-suite-source-preview] video")).toHaveCount(1);

  const productionPath = page.getByRole("navigation", { name: "Creative production path" });
  await expect(productionPath.getByRole("link", { name: /Source/i })).toBeVisible();
  await expect(productionPath.getByRole("link", { name: /Sentinel/i })).toBeVisible();
  await expect(productionPath.getByRole("link", { name: /Storyboard/i })).toBeVisible();
  await expect(productionPath.getByRole("link", { name: /2\.5D Preview/i })).toBeVisible();
  await expect(productionPath.getByRole("link", { name: /Experience/i })).toBeVisible();

  const source = page.locator("section[aria-labelledby='universe-source']");
  await expect(source.getByRole("heading", { name: "Source" })).toBeVisible();
  await expect(source.getByRole("button", { name: /Powerhouse/i })).toBeVisible();
  await expect(source.getByText("0:36.000")).toBeVisible();
  await expect(source.getByText("1:20.000")).toBeVisible();
  await expect(source.getByText("2:29.000")).toBeVisible();
  await expect(source.getByText("3:13.000")).toBeVisible();

  const continuation = page.locator("section[aria-labelledby='universe-experience-continuation']");
  await expect(continuation.getByText("Assemble", { exact: true })).toBeVisible();
  await expect(continuation.getByText("Experience", { exact: true }).first()).toBeVisible();
  await expect(continuation.getByRole("link", { name: /Enter Experience/i })).toHaveAttribute(
    "href",
    ROUTES.universeLive,
  );

  const production = page.locator("section[aria-labelledby='universe-production']");
  await expect(production.getByRole("heading", { name: "Production" })).toBeVisible();
  await expect(production.locator("[data-production-scene]")).toHaveCount(4);
  await expect(production.locator("[data-production-execution='not_connected']")).toHaveCount(4);
  await expect(production.getByRole("button", { name: /Execute production/i }).first()).toBeVisible();
  await expect(production.getByText("No production realization yet").first()).toBeVisible();
  await expect(production.getByText(/Powerhouse/i).first()).toBeVisible();
  await expect(production.getByText("Proverb").first()).toBeVisible();

  const mural = page.locator("section[aria-labelledby='universe-mural']");
  await expect(mural.getByText(/audiovisual expression/i)).toBeVisible();
  await revealCanonicalIdentifiers(mural);
  await expect(mural.getByText(CANON.muralId)).toBeVisible();

  const sentinel = page.locator("section[aria-labelledby='universe-sentinel']");
  await expect(sentinel.getByRole("heading", { name: "Sentinel" })).toBeVisible();
  await expect(sentinel.getByRole("heading", { name: "Evidence" })).toBeVisible();
  await expect(sentinel.getByRole("heading", { name: "Storyboard" })).toBeVisible();
  await expect(sentinel.getByRole("heading", { name: "Animation plan" })).toBeVisible();
  await expect(sentinel.getByRole("heading", { name: "Scene-boundary proposals" })).toBeVisible();
  await expect(sentinel.locator("[data-holographic-kind]")).toHaveCount(0);
  await expect(sentinel.locator("[data-proposal-scene]")).toHaveCount(4);
  await expect(sentinel.getByRole("link", { name: "Open 2.5D Studio Preview" })).toHaveAttribute("href", "#universe-preview");
  await expect(sentinel.getByRole("button", { name: /Authorise Sentinel windows/i })).toBeVisible();
  await expect(sentinel.getByText("Canonical Scene").first()).toBeVisible();
  await expect(sentinel.getByText("Storyboard beat").first()).toBeVisible();
  await expect(sentinel.getByText("System proposal").or(sentinel.getByText("Canonical", { exact: true })).first()).toBeVisible();

  const preview = page.locator("section[aria-labelledby='universe-preview']");
  await expect(preview.getByRole("heading", { name: "2.5D Preview" })).toBeVisible();
  await expect(preview.getByRole("button", { name: "2D composition" })).toBeVisible();
  await expect(preview.getByRole("button", { name: "2.5D Studio Preview" })).toBeVisible();
  await expect(preview.locator("[data-holographic-kind='scene']")).toHaveCount(4);
  await expect(preview.locator("[data-holographic-kind='moment']")).toHaveCount(3);
  await expect(preview.locator("[data-holographic-kind='production']")).toHaveCount(0);
  await expect(preview.getByRole("link", { name: "Open public 2.5D" })).toHaveAttribute("href", ROUTES.universeHolographic);

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
    await expect(object.getByRole("button", { name: "Edit identity" })).toBeVisible();
    await expect(object.getByRole("button", { name: "Edit timing" })).toBeVisible();
    await expect(object.getByRole("button", { name: "Move earlier" })).toBeVisible();
    await expect(object.getByRole("button", { name: "Move later" })).toBeVisible();
    if (index === 0) {
      await expect(object.getByRole("button", { name: "Move earlier" })).toBeDisabled();
    }
    if (index === sceneValues.length - 1) {
      await expect(object.getByRole("button", { name: "Move later" })).toBeDisabled();
    }
    await expect(object.getByRole("button", { name: "Add presence" })).toBeVisible();
    await expect(object.getByRole("button", { name: new RegExp(`Remove ${scene.creativeMomentTitle} from ${scene.shortName}`) })).toBeVisible();
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
    await expect(object.getByRole("button", { name: "Edit identity" })).toBeVisible();
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
