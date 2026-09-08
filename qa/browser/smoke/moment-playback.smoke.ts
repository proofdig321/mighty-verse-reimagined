import { CANON, ROUTES, SCENE_MOMENTS, SIBLING_SCENE_MOMENTS } from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertCanonicalSceneMomentPlayback } from "../lib/scene-moment-playback";

test("Super Hero Ego Sword Master Moment Play starts decoded Mux playback", async ({
  page,
  observe,
}, testInfo) => {
  const response = await page.goto(ROUTES.momentSwordMaster, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `moment HTTP ${response?.status()}`).toBeTruthy();
  await assertCanonicalSceneMomentPlayback({
    page,
    observe,
    testInfo,
    scene: SCENE_MOMENTS.swordMaster,
    arrival: `direct Moment route ${ROUTES.momentSwordMaster}`,
  });
});

for (const scene of SIBLING_SCENE_MOMENTS) {
  test(`Super Hero Ego ${scene.shortName} Moment Play starts decoded Mux playback`, async ({
    page,
    observe,
  }, testInfo) => {
    const universe = await page.goto(ROUTES.universeLive, { waitUntil: "domcontentloaded" });
    expect(universe?.ok(), `universe HTTP ${universe?.status()}`).toBeTruthy();
    await expect(page.getByText(CANON.universeTitle).first()).toBeVisible();

    await page.getByRole("link", { name: /View Mural/i }).click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.muralLive}$`));
    await expect(page.getByText(CANON.muralTitle).first()).toBeVisible();

    const sceneLink = page.locator(`a[href="/moments/${scene.projectionId}"]`);
    await expect(sceneLink, `Mural sidebar must expose ${scene.sceneTitle}`).toBeVisible();
    await sceneLink.click();

    await expect(page).toHaveURL(new RegExp(`/moments/${scene.projectionId}$`));
    await assertCanonicalSceneMomentPlayback({
      page,
      observe,
      testInfo,
      scene,
      arrival: `Universe ${ROUTES.universeLive} → View Mural ${ROUTES.muralLive} → sidebar ${scene.sceneTitle}`,
    });
  });
}
