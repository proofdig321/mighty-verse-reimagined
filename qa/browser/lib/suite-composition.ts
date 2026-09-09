import { expect, type Locator, type Page } from "@playwright/test";
import { CANON, CREATIVE_MOMENTS, ROUTES, SCENE_MOMENTS } from "./canon";

export async function revealCanonicalIdentifiers(scope: Locator) {
  const details = scope.locator("details").filter({ hasText: "Canonical identifiers" }).first();
  if (!(await details.count())) return;
  if (!(await details.getAttribute("open"))) {
    await details.locator("summary").click();
  }
}

async function openStudioWorkspace(page: Page, name: "Overview" | "Storyboard" | "Scenes" | "Production" | "2.5D" | "Experience") {
  await page.getByRole("navigation", { name: "Creative Suite" }).getByRole("link", { name, exact: true }).click();
}

export async function expectCreativeSuiteComposition(page: Page) {
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true }).first()).toBeVisible();
  await expect(page.getByText("Creative Studio").first()).toBeVisible();
  await expect(page.getByText(CANON.universeDescription).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /shuffle/i })).toHaveCount(0);
  await expect(page.locator("[data-suite-source-preview] video")).toHaveCount(1);

  const suiteNav = page.getByRole("navigation", { name: "Creative Suite" });
  await expect(suiteNav.getByRole("link", { name: "Overview", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "Storyboard", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "Scenes", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "Production", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "2.5D", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "Experience", exact: true })).toBeVisible();

  const productionPath = page.getByRole("navigation", { name: "Creative production path" });
  await expect(productionPath.getByRole("link", { name: /Source/i })).toBeVisible();
  await expect(productionPath.getByRole("link", { name: /Sentinel/i })).toHaveAttribute(
    "href",
    ROUTES.authorityUniverseSentinel,
  );
  await expect(productionPath.getByRole("link", { name: /Storyboard/i })).toHaveAttribute(
    "href",
    ROUTES.authorityUniverseStoryboard,
  );
  await expect(productionPath.getByRole("link", { name: /2\.5D Preview/i })).toHaveAttribute(
    "href",
    ROUTES.authorityUniversePreview,
  );
  await expect(productionPath.getByRole("link", { name: /Experience/i })).toHaveAttribute(
    "href",
    ROUTES.authorityUniverseExperience,
  );

  const source = page.locator("section[aria-labelledby='universe-source']");
  await expect(source.getByRole("heading", { name: "Source" })).toBeVisible();
  await expect(source.getByRole("button", { name: /Powerhouse/i })).toBeVisible();
  await expect(source.getByText("0:36.000")).toBeVisible();
  await expect(source.getByText("1:20.000")).toBeVisible();
  await expect(source.getByText("2:29.000")).toBeVisible();
  await expect(source.getByText("3:13.000")).toBeVisible();

  const mural = page.locator("section[aria-labelledby='universe-mural']");
  await expect(mural.getByText(/audiovisual expression/i)).toBeVisible();
  await revealCanonicalIdentifiers(mural);
  await expect(mural.getByText(CANON.muralId)).toBeVisible();

  await openStudioWorkspace(page, "Storyboard");
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseStoryboard}`));
  await page.getByRole("tab", { name: "Sentinel" }).click();
  const sentinel = page.locator("section[aria-labelledby='universe-sentinel']");
  await expect(sentinel.getByRole("heading", { name: "Sentinel" })).toBeVisible();
  await expect(sentinel.getByRole("heading", { name: "Evidence" })).toBeVisible();
  await expect(sentinel.getByRole("heading", { name: "Storyboard" })).toBeVisible();
  await expect(sentinel.getByRole("heading", { name: "Animation plan" })).toBeVisible();
  await expect(sentinel.getByRole("heading", { name: "Scene-boundary proposals" })).toBeVisible();
  await expect(sentinel.locator("[data-holographic-kind]")).toHaveCount(0);
  await expect(sentinel.locator("[data-proposal-scene]")).toHaveCount(4);
  await expect(sentinel.getByRole("link", { name: "Open 2.5D Studio Preview" })).toHaveAttribute(
    "href",
    ROUTES.authorityUniversePreview,
  );
  await expect(sentinel.getByRole("button", { name: /Authorise Sentinel windows/i })).toBeVisible();
  await expect(sentinel.getByText("Canonical Scene").first()).toBeVisible();
  await expect(sentinel.getByText("Storyboard beat").first()).toBeVisible();
  await expect(sentinel.getByText("System proposal").or(sentinel.getByText("Canonical", { exact: true })).first()).toBeVisible();

  await openStudioWorkspace(page, "Production");
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseProduction}`));
  const production = page.locator("section[aria-labelledby='universe-production']");
  await expect(production.getByRole("heading", { name: "Production" })).toBeVisible();
  await expect(production.locator("[data-production-scene]")).toHaveCount(4);
  await expect(production.locator("[data-production-execution='not_connected']")).toHaveCount(
    (await production.locator("[data-production-execution='completed']").count()) > 0 ? 3 : 4,
  );
  await expect(production.getByRole("button", { name: /Execute production/i }).first()).toBeVisible();
  await expect(production.getByText("No production realization yet").or(production.getByText(/attached to 2\.5D/i)).first()).toBeVisible();
  await expect(production.getByText(/Powerhouse/i).first()).toBeVisible();
  await expect(production.getByText("Proverb").first()).toBeVisible();

  await openStudioWorkspace(page, "2.5D");
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniversePreview}`));
  const preview = page.locator("section[aria-labelledby='universe-preview']");
  await expect(preview.getByRole("heading", { name: "2.5D Preview" })).toBeVisible();
  await expect(preview.getByRole("button", { name: "2D composition" })).toBeVisible();
  await expect(preview.getByRole("button", { name: "2.5D Studio Preview" })).toBeVisible();
  await expect(preview.locator("[data-holographic-kind='scene']")).toHaveCount(4);
  await expect(preview.locator("[data-holographic-kind='moment']")).toHaveCount(2);
  const productionLayers = preview.locator("[data-holographic-kind='production']");
  const productionLayerCount = await productionLayers.count();
  expect(productionLayerCount === 0 || productionLayerCount === 1).toBeTruthy();
  if (productionLayerCount === 1) {
    await expect(productionLayers).toHaveAttribute("data-master-id", SCENE_MOMENTS.powerhouse.sceneMasterId);
  }
  await expect(preview.getByRole("link", { name: "Enter Experience" })).toHaveAttribute("href", ROUTES.universeHolographic);
  await expect(preview.getByRole("link", { name: "Open Universe" }).first()).toHaveAttribute("href", ROUTES.universeLive);

  await openStudioWorkspace(page, "Scenes");
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseScenes}`));
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
    const relatedLink = object.getByRole("link", { name: scene.creativeMomentTitle, exact: true });
    if (await relatedLink.count()) {
      await expect(relatedLink).toHaveAttribute(
        "href",
        `${ROUTES.authorityUniverseScenes}#universe-moment-${scene.creativeMomentId}`,
      );
      await expect(object.getByRole("button", { name: new RegExp(`Remove ${scene.creativeMomentTitle} from ${scene.shortName}`) })).toBeVisible();
    }
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
    `${ROUTES.authorityUniverseScenes}#universe-scene-${SCENE_MOMENTS.powerhouse.sceneMasterId}`,
  );
  await expect(proverb.getByRole("link", { name: SCENE_MOMENTS.handToHand.shortName, exact: true })).toHaveAttribute(
    "href",
    `${ROUTES.authorityUniverseScenes}#universe-scene-${SCENE_MOMENTS.handToHand.sceneMasterId}`,
  );

  await openStudioWorkspace(page, "Experience");
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseExperience}`));
  const continuation = page.locator("section[aria-labelledby='universe-experience-continuation']");
  await expect(continuation.getByText("Assemble", { exact: true })).toBeVisible();
  await expect(continuation.getByText("Experience", { exact: true }).first()).toBeVisible();
  await expect(continuation.getByRole("link", { name: /Enter Experience/i })).toHaveAttribute(
    "href",
    ROUTES.universeHolographic,
  );
  await expect(continuation.getByRole("link", { name: /Open Universe/i }).first()).toHaveAttribute(
    "href",
    ROUTES.universeLive,
  );

  await openStudioWorkspace(page, "Overview");
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseWorkspace}$`));
}
