import { expect, type Locator, type Page } from "@playwright/test";
import { CANON, CREATIVE_MOMENTS, ROUTES, SCENE_MOMENTS } from "./canon";

export async function revealCanonicalIdentifiers(scope: Locator) {
  const details = scope.locator("details").filter({ hasText: "Canonical identifiers" }).first();
  if (!(await details.count())) return;
  if (!(await details.getAttribute("open"))) {
    await details.locator(":scope > summary").click();
  }
}

export async function revealStudioInspector(page: Page) {
  const inspector = page.locator("details.studio-inspector").filter({ hasText: "Source and mural" }).first();
  if (!(await inspector.count())) return;
  if (!(await inspector.getAttribute("open"))) {
    await inspector.locator(":scope > summary").click();
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

  const suiteNav = page.getByRole("navigation", { name: "Creative Suite" });
  await expect(suiteNav.getByRole("link", { name: "Overview", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "Storyboard", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "Scenes", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "Production", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "2.5D", exact: true })).toBeVisible();
  await expect(suiteNav.getByRole("link", { name: "Experience", exact: true })).toBeVisible();

  const command = page.locator(".studio-command-grid");
  await expect(command.getByText("Source", { exact: true })).toBeVisible();
  await expect(command.getByText("4:14").or(command.getByText("Bound")).first()).toBeVisible();
  await expect(command.getByText("Scenes", { exact: true })).toBeVisible();
  await expect(command.getByText("Storyboard", { exact: true })).toBeVisible();
  await expect(command.getByText("Production", { exact: true })).toBeVisible();
  await expect(command.getByText("2.5D", { exact: true })).toBeVisible();

  const deck = page.locator("section[aria-labelledby='studio-scene-deck']");
  await expect(deck.getByRole("heading", { name: "Scene deck" })).toBeVisible();
  await expect(deck.locator("[data-scene-id]")).toHaveCount(4);
  await expect(deck.getByText(/Powerhouse/i).first()).toBeVisible();
  await expect(deck.getByText(/Dark Knight/i).first()).toBeVisible();
  await expect(deck.getByText(/Hand-to-Hand/i).first()).toBeVisible();
  await expect(deck.getByText(/Sword Master/i).first()).toBeVisible();

  await revealStudioInspector(page);
  const source = page.locator("section[aria-labelledby='universe-source']");
  await expect(source.getByRole("heading", { name: "Source" })).toBeVisible();
  const mural = page.locator("section[aria-labelledby='universe-mural']");
  await expect(mural.getByText(/audiovisual expression/i)).toBeVisible();
  await revealCanonicalIdentifiers(mural);
  await expect(mural.getByText(CANON.muralId)).toBeVisible();

  await openStudioWorkspace(page, "Storyboard");
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseStoryboard}`));
  await expect(page.getByRole("heading", { name: "Storyboard", exact: true })).toBeVisible();
  await expect(page.locator(".storyboard-panel-strip [data-panel-kind='scene']")).toHaveCount(4);
  await expect(page.getByText("Canonical Scene").first()).toBeVisible();
  await expect(page.getByText("Storyboard beat").first()).toBeVisible();

  await page.getByRole("tab", { name: "Sentinel" }).click();
  const sentinel = page.locator("section[aria-labelledby='universe-sentinel']");
  await expect(sentinel.getByRole("heading", { name: "Sentinel" })).toBeVisible();
  await expect(sentinel.getByRole("heading", { name: "Evidence" })).toBeVisible();
  await expect(sentinel.getByRole("heading", { name: "Observed panels" })).toBeVisible();
  await expect(sentinel.getByRole("heading", { name: "Scene-boundary proposals" })).toBeVisible();
  await expect(sentinel.locator("[data-holographic-kind]")).toHaveCount(0);
  await expect(sentinel.locator("[data-proposal-scene]")).toHaveCount(4);
  await expect(sentinel.getByRole("link", { name: "Open 2.5D Studio Preview" })).toHaveAttribute(
    "href",
    ROUTES.authorityUniversePreview,
  );
  await expect(sentinel.getByRole("button", { name: /Authorise Sentinel windows/i })).toBeVisible();
  await expect(sentinel.getByText("System proposal").or(sentinel.getByText("Canonical", { exact: true })).first()).toBeVisible();
  await sentinel.locator("summary").filter({ hasText: "Animation plan" }).click();
  await expect(sentinel.locator("[data-animation-scene]")).toHaveCount(4);

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
  await preview.getByRole("button", { name: "2D composition" }).click();
  await expect(preview.locator("[data-suite-source-preview] video")).toHaveCount(1);
  await expect(preview.getByRole("button", { name: /Powerhouse/i })).toBeVisible();
  await expect(preview.getByText("0:36.000")).toBeVisible();
  await expect(preview.getByText("1:20.000")).toBeVisible();
  await expect(preview.getByText("2:29.000")).toBeVisible();
  await expect(preview.getByText("3:13.000")).toBeVisible();
  await preview.getByRole("button", { name: "2.5D Studio Preview" }).click();
  await expect(preview.locator("[data-holographic-kind='scene']")).toHaveCount(4);
  await expect(preview.locator("[data-holographic-kind='moment']")).toHaveCount(3);
  const productionLayers = preview.locator("[data-holographic-kind='production']");
  const productionLayerCount = await productionLayers.count();
  expect(productionLayerCount === 0 || productionLayerCount === 1).toBeTruthy();
  if (productionLayerCount === 1) {
    await expect(productionLayers).toHaveAttribute("data-master-id", SCENE_MOMENTS.powerhouse.sceneMasterId);
  }
  await expect(preview.getByRole("link", { name: "Enter Experience" })).toHaveAttribute("href", ROUTES.universeHolographic);
  await expect(preview.getByRole("link", { name: "Open Universe" }).first()).toHaveAttribute("href", ROUTES.universeLive);

  await openStudioWorkspace(page, "Scenes");
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniverseScenes}$`));
  const scenes = page.locator("section[aria-labelledby='universe-scenes']");
  const moments = page.locator("section[aria-labelledby='universe-moments']");
  await expect(scenes.locator("table")).toHaveCount(0);
  await expect(moments.locator("table")).toHaveCount(0);
  await expect(scenes.locator("article[data-scene-id]")).toHaveCount(0);
  await expect(scenes.locator("a[data-scene-id]")).toHaveCount(4);

  const sceneValues = Object.values(SCENE_MOMENTS);
  for (const [index, scene] of sceneValues.entries()) {
    const card = scenes.locator(`#universe-scene-${scene.sceneMasterId}`);
    await expect(card).toBeVisible();
    await expect(card.locator(".suite-scene-ordinal")).toHaveText(String(index + 1).padStart(2, "0"));
    await expect(card).toHaveAttribute("href", `${ROUTES.authorityUniverseScenes}/${scene.sceneMasterId}`);
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
    ROUTES.authorityUniversePowerhouse,
  );
  await expect(proverb.getByRole("link", { name: SCENE_MOMENTS.handToHand.shortName, exact: true })).toHaveAttribute(
    "href",
    `${ROUTES.authorityUniverseScenes}/${SCENE_MOMENTS.handToHand.sceneMasterId}`,
  );

  await scenes.locator(`#universe-scene-${SCENE_MOMENTS.powerhouse.sceneMasterId}`).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityUniversePowerhouse}$`));
  const powerhouse = page.locator(`#universe-scene-${SCENE_MOMENTS.powerhouse.sceneMasterId}`);
  await expect(powerhouse.getByRole("heading", { name: /Scene 01\. Powerhouse/ })).toBeVisible();
  await expect(powerhouse.getByText(SCENE_MOMENTS.powerhouse.sceneTitle, { exact: true })).toBeVisible();
  await expect(powerhouse.getByRole("button", { name: "Edit identity" })).toBeVisible();
  await expect(powerhouse.getByRole("button", { name: "Edit timing" })).toBeVisible();
  await expect(powerhouse.getByRole("button", { name: "Move later" })).toBeVisible();
  await expect(powerhouse.getByRole("button", { name: "Add presence" })).toBeVisible();
  await expect(powerhouse.getByRole("link", { name: /Open record/i })).toHaveAttribute(
    "href",
    `/authority/${SCENE_MOMENTS.powerhouse.sceneMasterId}`,
  );
  await expect(powerhouse.getByRole("link", { name: SCENE_MOMENTS.powerhouse.creativeMomentTitle, exact: true })).toHaveAttribute(
    "href",
    `#universe-moment-${SCENE_MOMENTS.powerhouse.creativeMomentId}`,
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
