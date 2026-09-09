import { CANON, ROUTES } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";
import { revealCanonicalIdentifiers } from "../lib/suite-composition";

test("a Universe without a Mural can register one without attaching media", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";

  const unauthorized = await page.request.post("/api/authority/murals", {
    data: { universe_id: CANON.untitledUniverseId },
  });
  expect(unauthorized.status(), `unauthenticated mural registration HTTP ${unauthorized.status()}`).toBe(401);
  notes.push("unauthenticated mural registration is rejected");

  await applyAuthoritySession(context, baseURL);

  const she = await page.request.post("/api/authority/murals", {
    data: { universe_id: CANON.universeId },
  });
  expect(she.status(), `Super Hero Ego mural registration HTTP ${she.status()}`).toBe(200);
  const sheBody = await she.json();
  expect(sheBody.registration).toBe("already_registered");
  expect(sheBody.mural_id).toBe(CANON.muralId);
  expect(sheBody.projection_id).toBe(CANON.muralProjectionId);
  expect(sheBody.created).toEqual({ master: false, state: false, projection: false });
  notes.push("Super Hero Ego mural registration is idempotent and does not create a second Mural");

  const sheAgain = await page.request.post("/api/authority/murals", {
    data: { universe_id: CANON.universeId, title: "Hijack Super Hero Ego" },
  });
  expect(sheAgain.status()).toBe(200);
  const sheAgainBody = await sheAgain.json();
  expect(sheAgainBody.mural_id).toBe(CANON.muralId);
  expect(sheAgainBody.projection_id).toBe(CANON.muralProjectionId);
  notes.push("client-supplied title cannot override the existing Super Hero Ego Mural");

  const notUniverse = await page.request.post("/api/authority/murals", {
    data: { universe_id: CANON.muralId },
  });
  expect(notUniverse.status(), `mural-as-universe HTTP ${notUniverse.status()}`).toBe(409);
  const notUniverseBody = await notUniverse.json();
  expect(notUniverseBody.reason).toBe("not_universe");
  notes.push("registering a Mural against a non-Universe master is rejected");

  const missing = await page.request.post("/api/authority/murals", {
    data: { universe_id: "00000000-0000-4000-8000-000000000000" },
  });
  expect(missing.status()).toBe(404);
  notes.push("unknown Universe is rejected");

  const untitled = await page.request.post("/api/authority/murals", {
    data: { universe_id: CANON.untitledUniverseId },
  });
  expect([200, 201], `untitled mural registration HTTP ${untitled.status()}`).toContain(untitled.status());
  const untitledBody = await untitled.json();
  expect(untitledBody.ok).toBe(true);
  expect(untitledBody.universe_id).toBe(CANON.untitledUniverseId);
  expect(untitledBody.mural_id).toBeTruthy();
  expect(untitledBody.projection_id).toBeTruthy();
  expect(untitledBody.mural_id).not.toBe(CANON.muralId);
  expect(untitledBody.projection_id).not.toBe(CANON.muralProjectionId);
  notes.push(`untitled Universe mural ${untitledBody.registration}: ${untitledBody.mural_id}`);

  const untitledAgain = await page.request.post("/api/authority/murals", {
    data: { universe_id: CANON.untitledUniverseId },
  });
  expect(untitledAgain.status()).toBe(200);
  const untitledAgainBody = await untitledAgain.json();
  expect(untitledAgainBody.registration).toBe("already_registered");
  expect(untitledAgainBody.mural_id).toBe(untitledBody.mural_id);
  expect(untitledAgainBody.projection_id).toBe(untitledBody.projection_id);
  notes.push("duplicate untitled Universe mural registration is idempotent");

  const occupied = await page.request.post("/api/authority/media", {
    data: { asset_id: CANON.unboundLivepeerAssetId, universe_id: CANON.universeId },
  });
  expect(occupied.status()).toBe(409);
  const occupiedBody = await occupied.json();
  expect(occupiedBody.code).toBe("mural_occupied");
  notes.push("registering a Mural does not attach media or replace Super Hero Ego Mux");

  await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true })).toBeVisible();
  const sheMural = page.locator("section[aria-labelledby='universe-mural']");
  await revealCanonicalIdentifiers(sheMural);
  await expect(sheMural.getByText(CANON.muralId)).toBeVisible();
  await expect(sheMural.getByRole("button", { name: "Register Mural" })).toHaveCount(0);
  notes.push("Super Hero Ego Creative Suite still shows the canonical Mural and does not offer a second registration");

  await page.goto(ROUTES.authorityUntitledUniverseWorkspace, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Creative Studio").first()).toBeVisible();
  const untitledMural = page.locator("section[aria-labelledby='universe-mural']");
  await expect(untitledMural.getByText(/No mural assembled/i)).toHaveCount(0);
  await revealCanonicalIdentifiers(untitledMural);
  await expect(untitledMural.getByText(untitledBody.mural_id)).toBeVisible();
  notes.push("Creative Suite shows the registered Mural for the previously mural-less Universe");

  await page.goto(ROUTES.curate, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /^Curate$/ })).toBeVisible();
  await page.getByLabel("Select Universe for Curate Studio").selectOption(CANON.untitledUniverseId);
  await expect(page).toHaveURL(new RegExp(`/authority/curate/${CANON.untitledUniverseId}$`));
  await expect(page.getByRole("heading", { name: /Curate Hub/i })).toBeVisible();
  await expect(page.getByText(/no Mural yet/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open Creative Studio" }).first()).toBeVisible();
  notes.push("Curate Hub for the registered Universe no longer treats it as mural-less");

  assertRuntimeHealth(observe);
  reportEvidence(
    testInfo,
    "BROWSER VERIFIED",
    "Stage 2.7 mural registration",
    page.url(),
    notes,
    observe,
  );
});
