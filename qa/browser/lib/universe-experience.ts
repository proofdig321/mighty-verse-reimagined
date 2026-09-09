import { expect, type Page } from "@playwright/test";
import { CANON, CREATIVE_MOMENTS, ROUTES, creativeMomentHref } from "./canon";

export async function expectUniverseExperience(page: Page) {
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  await expect(page.getByText(CANON.universeDescription).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Enter Scene Deck/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /View Mural/i })).toHaveAttribute("href", ROUTES.muralLive);
  await expect(page.getByRole("link", { name: "2.5D", exact: true })).toHaveAttribute("href", ROUTES.universeHolographic);
  await expect(page.getByRole("heading", { name: "The Mural", exact: true })).toBeVisible();
  await expect(page.getByText(/audiovisual expression/i).first()).toBeVisible();

  await expect(page.getByRole("button", { name: /^Overview$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Scenes$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Moments$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Participants$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Activity$/ })).toHaveCount(0);
  await expect(page.getByText("Collectibles")).toHaveCount(0);
  await expect(page.getByText("Holders")).toHaveCount(0);
  await expect(page.getByText("Base Network")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /shuffle/i })).toHaveCount(0);

  const encounters = page.locator("section[aria-labelledby='world-encounters-heading']");
  await expect(encounters.getByRole("heading", { name: "Powerhouse", exact: true })).toBeVisible();
  await expect(encounters.getByRole("heading", { name: "Dark Knight", exact: true })).toBeVisible();
  await expect(encounters.getByRole("heading", { name: "Hand-to-Hand", exact: true })).toBeVisible();
  await expect(encounters.getByRole("heading", { name: "Sword Master", exact: true })).toBeVisible();
  await expect(encounters.getByRole("link", { name: /Continue to Scene Deck/i })).toHaveAttribute(
    "href",
    ROUTES.universeScenes,
  );

  const presence = page.locator("section[aria-labelledby='world-presence-heading']");
  for (const cm of Object.values(CREATIVE_MOMENTS)) {
    const object = presence.locator(`[data-moment-id="${cm.masterId}"]`);
    await expect(object).toBeVisible();
    await expect(object.getByRole("heading", { name: cm.title, exact: true })).toBeVisible();
    await expect(object.getByRole("link")).toHaveAttribute("href", creativeMomentHref(cm));
  }

  const proverb = presence.locator(`[data-moment-id="${CREATIVE_MOMENTS.proverb.masterId}"]`);
  await expect(proverb).toHaveAttribute("data-has-moment-projection", "false");
  await expect(proverb.getByText(/creative identity/i)).toBeVisible();
  await expect(proverb.getByText(/Powerhouse/)).toBeVisible();
  await expect(proverb.getByText(/Hand-to-Hand/)).toBeVisible();
  await expect(proverb.getByRole("link", { name: /View identity/i })).toHaveAttribute(
    "href",
    `/creative-moments/${CREATIVE_MOMENTS.proverb.masterId}`,
  );

  await expect(presence.locator(`[data-moment-id="${CREATIVE_MOMENTS.mothipa.masterId}"]`)).toHaveAttribute(
    "data-has-moment-projection",
    "true",
  );
  await expect(presence.locator(`[data-moment-id="${CREATIVE_MOMENTS.reason.masterId}"]`)).toHaveAttribute(
    "data-has-moment-projection",
    "true",
  );
}
