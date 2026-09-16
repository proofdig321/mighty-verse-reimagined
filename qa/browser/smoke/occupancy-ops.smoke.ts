import { CANON, ROUTES } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";

test("clinical occupancy keeps Super Hero Ego curated and Father Raymond on its own hub", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(90_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";

  const unauthorized = await page.request.post("/api/authority/masters/withdraw", {
    data: { master_id: CANON.universeId },
  });
  expect(unauthorized.status(), `unauthenticated withdraw HTTP ${unauthorized.status()}`).toBe(401);
  notes.push("unauthenticated withdraw is rejected");
  const unauthorizedDiscard = await page.request.post(`/api/authority/media/${CANON.muxAssetId}/discard`);
  expect(unauthorizedDiscard.status(), `unauthenticated discard HTTP ${unauthorizedDiscard.status()}`).toBe(401);

  await applyAuthoritySession(context, baseURL);

  const sheWithdraw = await page.request.post("/api/authority/masters/withdraw", {
    data: { master_id: CANON.universeId },
  });
  expect(sheWithdraw.status(), `Super Hero Ego withdraw HTTP ${sheWithdraw.status()}`).toBe(409);
  const sheBody = await sheWithdraw.json();
  expect(String(sheBody.error)).toMatch(/Super Hero Ego/i);
  notes.push("Super Hero Ego cannot be withdrawn");

  const sheDiscard = await page.request.post(`/api/authority/media/${CANON.muxAssetId}/discard`);
  expect(sheDiscard.status(), `Super Hero Ego media discard HTTP ${sheDiscard.status()}`).toBe(409);
  notes.push("Super Hero Ego media cannot be deleted");

  await page.goto(ROUTES.universes, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: new RegExp(CANON.universeTitle, "i") })).toBeVisible();
  await expect(page.locator(`a[href*="${CANON.untitledUniverseId}"]`)).toHaveCount(0);
  notes.push("public Universes lists Super Hero Ego and hides untitled orphan work");

  await page.goto(ROUTES.authorityUniverses, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Universes", exact: true })).toBeVisible();
  const sheRow = page.locator("tr[data-occupancy='curated']").filter({ hasText: CANON.universeTitle });
  await expect(sheRow).toBeVisible();
  await expect(sheRow.getByRole("link", { name: /Open Creative Studio/i })).toBeVisible();
  await expect(sheRow.getByRole("link", { name: /^Edit$/ })).toHaveAttribute(
    "href",
    ROUTES.authorityUniverseIdentity,
  );
  await expect(sheRow.getByRole("button", { name: /Withdraw|Remove orphan/i })).toHaveCount(0);
  const frRow = page.locator("tr").filter({ hasText: CANON.fatherRaymondTitleIncludes });
  if (await frRow.count()) {
    await expect(frRow.first()).toHaveAttribute("data-occupancy", /in_progress|curated/);
    await expect(frRow.first().getByRole("link", { name: /Open Curate Hub|Open Creative Studio/i })).toBeVisible();
    notes.push("Authority Universes distinguishes Super Hero Ego from Father Raymond occupancy");
  } else {
    notes.push("Father Raymond Universe not listed in this environment");
  }

  await page.goto(ROUTES.authorityFatherRaymondHub, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Curate Hub", { exact: true })).toBeVisible();
  await expect(page.locator("[data-occupancy]").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit identity" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Open media record" }).first()).toHaveAttribute(
    "href",
    ROUTES.authorityFatherRaymondMedia,
  );
  await expect(page.getByRole("link", { name: "Replace media" }).first()).toHaveAttribute(
    "href",
    ROUTES.authorityFatherRaymondMuralRecord,
  );
  const establish = page.getByRole("link", { name: /Establish Scene/i });
  await expect(establish.first()).toBeVisible();
  await expect(establish.first()).toHaveAttribute("href", ROUTES.authorityFatherRaymondSentinel);
  notes.push("Father Raymond hub next work is Establish Scene on its own Sentinel");
  const attach = page.getByRole("link", { name: "Attach media" });
  if (await attach.count()) {
    await expect(attach.first()).toHaveAttribute("href", ROUTES.authorityFatherRaymondAttach);
    await attach.first().click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityFatherRaymondAttach}$`));
    await expect(page.getByRole("heading", { name: "Attach media" })).toBeVisible();
    await expect(page.locator("[data-gallery-picker]")).toBeVisible();
    await expect(page.getByRole("form", { name: "Associate media with Universe" })).toBeVisible();
    await expect(page.getByLabel("Select Universe to associate")).toHaveValue(CANON.fatherRaymondUniverseId);
    notes.push("Father Raymond attach stays locked to Father Raymond");
  } else {
    notes.push("Father Raymond hub is past attach in this environment");
  }

  const bind = await page.request.post("/api/authority/media", {
    data: {
      asset_id: CANON.fatherRaymondAssetId,
      universe_id: CANON.fatherRaymondUniverseId,
    },
  });
  expect([200, 201], `Father Raymond attach HTTP ${bind.status()}`).toContain(bind.status());
  const bindBody = await bind.json();
  expect(bindBody.universe_id).toBe(CANON.fatherRaymondUniverseId);
  expect(bindBody.mural_id).not.toBe(CANON.muralId);
  expect(bindBody.asset_id).toBe(CANON.fatherRaymondAssetId);
  notes.push("Father Raymond ingested Mux binds to Father Raymond's Mural, not Super Hero Ego");

  const occupied = await page.request.post("/api/authority/media", {
    data: {
      asset_id: CANON.fatherRaymondAssetId,
      universe_id: CANON.universeId,
    },
  });
  expect(occupied.status()).toBe(409);
  const occupiedBody = await occupied.json();
  expect(occupiedBody.code).toBe("mural_occupied");
  notes.push("Father Raymond media cannot replace Super Hero Ego Mural media");

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Clinical occupancy", page.url(), notes, observe);
});
