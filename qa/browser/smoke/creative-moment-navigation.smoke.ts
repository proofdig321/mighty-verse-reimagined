import {
  CANON,
  CREATIVE_MOMENTS,
  ROUTES,
  SCENE_MOMENTS,
  creativeMomentHref,
} from "../lib/canon";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

async function openMuralFromUniverse(page: import("@playwright/test").Page) {
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeLive}$`));
  await page.getByRole("link", { name: /View Mural/i }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.muralLive}$`));
}

test("Super Hero Ego navigation exposes Universe, Mural, Scenes, and Creative Moments", async ({
  page,
  observe,
}, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];

  const universe = await page.goto(ROUTES.universeLive, { waitUntil: "domcontentloaded" });
  expect(universe?.ok(), `universe HTTP ${universe?.status()}`).toBeTruthy();
  await expect(page.getByText(CANON.universeTitle).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /View Mural/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Enter Scene Deck/i })).toBeVisible();
  notes.push(`Universe ${ROUTES.universeLive} HTTP ${universe?.status()} title ${CANON.universeTitle}`);

  await page.getByRole("link", { name: /View Mural/i }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.muralLive}$`));
  await expect(page.getByText(CANON.muralTitle).first()).toBeVisible();
  await expect(page.getByRole("link", { name: CANON.universeTitle }).first()).toHaveAttribute(
    "href",
    ROUTES.universeLive,
  );
  notes.push(`View Mural → ${ROUTES.muralLive}`);

  for (const scene of Object.values(SCENE_MOMENTS)) {
    const href = `/moments/${scene.projectionId}`;
    const link = page.locator(`a[href="${href}"]`);
    await expect(link, `Mural sidebar missing ${scene.sceneTitle}`).toBeVisible();
    await expect(link).toContainText(scene.sceneTitle);
    notes.push(`Mural sidebar ${scene.sceneTitle} → ${href}`);
  }

  await page.getByRole("link", { name: /View Scene Deck/i }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeScenes}$`));
  await expect(page.getByRole("heading", { name: /Scene Deck/i })).toBeVisible();
  notes.push(`View Scene Deck → ${ROUTES.universeScenes}`);

  for (const [index, scene] of Object.values(SCENE_MOMENTS).entries()) {
    await expect(
      page.getByRole("button", { name: new RegExp(`Go to scene ${index + 1}: ${scene.sceneTitle}`) }),
    ).toBeVisible();
    notes.push(`Scene Deck ${index + 1}: ${scene.sceneTitle} master ${scene.sceneMasterId}`);
  }

  await page.getByRole("link", { name: CANON.universeTitle }).first().click();
  await openMuralFromUniverse(page);

  for (const scene of Object.values(SCENE_MOMENTS)) {
    await expect(page).toHaveURL(new RegExp(`${ROUTES.muralLive}$`));
    await page.locator(`a[href="/moments/${scene.projectionId}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/moments/${scene.projectionId}$`));
    await expect(page.getByText(`Scene: ${scene.sceneTitle}`)).toBeVisible();
    await expect(page.getByRole("link", { name: CANON.muralTitle, exact: true })).toHaveAttribute(
      "href",
      ROUTES.muralLive,
    );

    const cmLink = page.getByRole("link", { name: scene.creativeMomentTitle, exact: true });
    await expect(cmLink).toHaveAttribute("href", `/creative-moments/${scene.creativeMomentId}`);
    await cmLink.click();
    await expect(page).toHaveURL(new RegExp(`/creative-moments/${scene.creativeMomentId}$`));
    await expect(page.getByRole("heading", { name: scene.creativeMomentTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: CANON.universeTitle }).first()).toHaveAttribute(
      "href",
      ROUTES.universeLive,
    );
    const hasMomentCard = (await page.getByText("No Moment Card representation yet.").count()) === 0;
    notes.push(
      `${scene.shortName} Scene ${scene.sceneMasterId} → /moments/${scene.projectionId} → /creative-moments/${scene.creativeMomentId} (${scene.creativeMomentTitle}; ${hasMomentCard ? "Moment Card present" : "no Moment Card representation"})`,
    );

    await page.getByRole("link", { name: CANON.universeTitle }).first().click();
    await openMuralFromUniverse(page);
  }

  await page.getByRole("link", { name: CANON.universeTitle }).first().click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.universeLive}$`));
  await page.getByRole("button", { name: /^Moments$/ }).click();

  for (const cm of Object.values(CREATIVE_MOMENTS)) {
    const href = creativeMomentHref(cm);
    const card = page.locator(`a[href="${href}"]`).filter({ hasText: cm.title });
    await expect(card, `Universe Moments tab missing ${cm.title}`).toBeVisible();
    notes.push(`Universe Moments tab ${cm.title} href ${href}`);
  }

  for (const cm of Object.values(CREATIVE_MOMENTS)) {
    const href = creativeMomentHref(cm);
    await page.locator(`a[href="${href}"]`).filter({ hasText: cm.title }).click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByText(cm.title).first()).toBeVisible();
    notes.push(`clicked Universe Moments ${cm.title} → ${href}`);
    if (page.url().includes("/creative-moments/")) {
      await page.getByRole("link", { name: CANON.universeTitle }).first().click();
    } else {
      await page.getByRole("link", { name: "Universes", exact: true }).click();
      await expect(page).toHaveURL(/\/universes$/);
      await page.locator(`a[href="${ROUTES.universeLive}"]`).first().click();
    }
    await expect(page).toHaveURL(new RegExp(`${ROUTES.universeLive}$`));
    await page.getByRole("button", { name: /^Moments$/ }).click();
  }

  assertRuntimeHealth(observe);
  reportEvidence(
    testInfo,
    "BROWSER VERIFIED",
    "Super Hero Ego Creative Moment navigation",
    page.url(),
    notes,
    observe,
  );
});
