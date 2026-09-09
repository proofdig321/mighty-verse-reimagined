import { CANON, ROUTES, SCENE_MOMENTS, SIBLING_SCENE_MOMENTS } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { captureScreenshot, reportEvidence } from "../lib/observe";
import { expectSceneInspectIdentity } from "../lib/scene-moment-playback";

test("Super Hero Ego Universe and Mural expose sibling Scene Moment routes", async ({
  page,
  observe,
}, testInfo) => {
  const universe = await page.goto(ROUTES.universeLive, { waitUntil: "domcontentloaded" });
  expect(universe?.ok(), `universe HTTP ${universe?.status()}`).toBeTruthy();
  await expect(page.getByText(CANON.universeTitle).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /View Mural/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Enter Scene Deck/i })).toBeVisible();

  await page.getByRole("link", { name: /View Mural/i }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.muralLive}$`));
  await expect(page.getByRole("link", { name: CANON.universeTitle }).first()).toHaveAttribute(
    "href",
    ROUTES.universeLive,
  );

  const muralNotes: string[] = [
    `Universe ${ROUTES.universeLive} → View Mural ${ROUTES.muralLive}`,
  ];

  for (const scene of Object.values(SCENE_MOMENTS)) {
    const href = `/moments/${scene.projectionId}`;
    const link = page.locator(`a[href="${href}"]`);
    await expect(link, `Mural sidebar missing ${scene.sceneTitle}`).toBeVisible();
    await expect(link).toContainText(scene.sceneTitle);
    muralNotes.push(`Mural sidebar ${scene.sceneTitle} → ${href}`);
  }

  await page.getByRole("link", { name: /View Scene Deck/i }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeScenes}$`));
  await expect(page.getByRole("heading", { name: /Scene Deck/i })).toBeVisible();

  for (const [index, scene] of Object.values(SCENE_MOMENTS).entries()) {
    await expect(
      page.getByRole("button", { name: new RegExp(`Go to scene ${index + 1}: ${scene.sceneTitle}`) }),
    ).toBeVisible();
    muralNotes.push(`Scene Deck card ${index + 1}: ${scene.sceneTitle}`);
  }

  await page.goto(ROUTES.muralLive, { waitUntil: "domcontentloaded" });

  for (const scene of SIBLING_SCENE_MOMENTS) {
    const href = `/moments/${scene.projectionId}`;
    await page.locator(`a[href="${href}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expectSceneInspectIdentity(page, scene);
    muralNotes.push(`clicked Mural sidebar ${scene.shortName} → ${href} with Scene/Mural/Creative Moment`);
    await page.goto(ROUTES.muralLive, { waitUntil: "domcontentloaded" });
  }

  await captureScreenshot(page, testInfo, "super-hero-ego-sibling-navigation");
  assertRuntimeHealth(observe);
  reportEvidence(
    testInfo,
    "BROWSER VERIFIED",
    "Super Hero Ego sibling Scene Moment navigation",
    page.url(),
    muralNotes,
    observe,
  );
});
