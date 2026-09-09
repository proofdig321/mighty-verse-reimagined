import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CANON, ROUTES, SCENE_MOMENTS } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { assertRuntimeHealth } from "../lib/health";
import { reportEvidence } from "../lib/observe";
import { expectCreativeSuiteComposition } from "../lib/suite-composition";

const SCENE_IDS = Object.values(SCENE_MOMENTS).map((scene) => scene.sceneMasterId);
const BINDING_IDS = Object.values(SCENE_MOMENTS).map((scene) => scene.bindingId);

function readLocalEnv(): Record<string, string> {
  const candidates = [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), "../../.env.local")];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) return {};
  const parsed: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && parsed[key] == null) parsed[key] = value;
  }
  return parsed;
}

function serviceClient() {
  const localEnv = readLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Production orchestration QA needs Supabase URL and service role.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function snapshotCanon(svc: ReturnType<typeof serviceClient>) {
  const [{ data: scenes }, { data: bindings }, { data: muralBinding }, { count: realizationCount }, { data: presence }, { count: referenceCount }, { count: productionCount }] =
    await Promise.all([
      svc.from("master").select("master_id, parent_master_id, sort_order").in("master_id", SCENE_IDS),
      svc.from("projection_media_binding").select("binding_id, asset_id, start_ms, end_ms").in("binding_id", BINDING_IDS),
      svc
        .from("projection_media_binding")
        .select("binding_id, asset_id")
        .eq("binding_id", CANON.muralBindingId)
        .maybeSingle(),
      svc.from("media_realization").select("*", { count: "exact", head: true }),
      svc.from("scene_moment").select("scene_master_id, moment_master_id").in("scene_master_id", SCENE_IDS),
      svc.from("media_asset").select("*", { count: "exact", head: true }).eq("provider", "curated-reference"),
      svc.from("media_asset").select("*", { count: "exact", head: true }).like("integrity_hash", "production:%"),
    ]);
  return {
    scenes: (scenes ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    bindings: (bindings ?? []).slice().sort((a, b) => a.binding_id.localeCompare(b.binding_id)),
    muralBinding,
    realizationCount: realizationCount ?? 0,
    presence: (presence ?? []).slice().sort((a, b) => `${a.scene_master_id}:${a.moment_master_id}`.localeCompare(`${b.scene_master_id}:${b.moment_master_id}`)),
    referenceCount: referenceCount ?? 0,
    productionCount: productionCount ?? 0,
  };
}

test("unauthenticated production execute and register remain rejected", async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  const execute = await fetch(`${baseURL}/api/authority/production/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      universe_id: CANON.universeId,
      scene_master_id: SCENE_MOMENTS.powerhouse.sceneMasterId,
    }),
  });
  expect(execute.status).toBe(401);

  const register = await fetch(`${baseURL}/api/authority/production/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      universe_id: CANON.universeId,
      scene_master_id: SCENE_MOMENTS.powerhouse.sceneMasterId,
      mux_asset_id: CANON.muxAssetId,
      playback_id: CANON.muxPlaybackId,
    }),
  });
  expect(register.status).toBe(401);
});

test("unauthenticated reference retain remains rejected", async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  const unauthorized = await fetch(`${baseURL}/api/authority/references`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      universe_id: CANON.universeId,
      source_asset_id: CANON.muxAssetId,
      time_ms: 36000,
      role: "still",
    }),
  });
  expect(unauthorized.status).toBe(401);
});

test("Authority Gallery roles, Sentinel retain, Studio production, and SHE 2.5D stay distinct", async ({ page, observe, context }, testInfo) => {
  test.setTimeout(180_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  const svc = serviceClient();
  const before = await snapshotCanon(svc);

  await applyAuthoritySession(context, baseURL);

  await page.goto(ROUTES.authorityMedia, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Media Library/i })).toBeVisible();
  await expect(page.getByText(/Sentinel observations stay in Sentinel/i)).toBeVisible();
  await expect(page.getByRole("tab", { name: "Sources" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "References" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Productions" })).toBeVisible();
  await page.getByRole("tab", { name: "Sources" }).click();
  const muxCard = page.locator(`a[href="${ROUTES.authorityMuxAsset}"]`).first();
  await expect(muxCard).toBeVisible();
  await expect(muxCard).toHaveAttribute("data-gallery-role", "source");
  notes.push("Authority Gallery Sources tab shows the Mux source and does not dump Sentinel frames");

  await page.getByRole("tab", { name: "Productions" }).click();
  const productionCards = page.locator("[data-gallery-role='production']");
  if (await productionCards.count()) {
    await expect(productionCards.first()).toBeVisible();
    notes.push("Authority Gallery Productions tab shows the real Mux production result");
  } else {
    await expect(page.getByText(/No production realizations yet/i)).toBeVisible();
    notes.push("Authority Gallery Productions tab stays honestly empty");
  }

  await page.getByRole("tab", { name: "Sources" }).click();
  await muxCard.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.authorityMuxAsset}$`));
  await expect(page.getByRole("link", { name: "Continue in Curate", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Inspect Media", exact: true })).toBeVisible();
  notes.push("Asset Record Inspect and Curate continuation remain on source media");

  await page.goto(ROUTES.authorityUniverseWorkspace, { waitUntil: "domcontentloaded" });
  await expectCreativeSuiteComposition(page);

  const executeRes = await page.request.post(`${baseURL}/api/authority/production/execute`, {
    data: {
      universe_id: CANON.universeId,
      scene_master_id: SCENE_MOMENTS.powerhouse.sceneMasterId,
    },
  });
  expect(executeRes.status()).toBe(409);
  expect((await executeRes.json()).code).toBe("not_connected");
  notes.push("Powerhouse execute stays not_connected and does not fabricate a production job");

  const { data: sourceAsset } = await svc
    .from("media_asset")
    .select("provider_asset_id, storage_ref")
    .eq("asset_id", CANON.muxAssetId)
    .maybeSingle();
  const registerRes = await page.request.post(`${baseURL}/api/authority/production/register`, {
    data: {
      universe_id: CANON.universeId,
      scene_master_id: SCENE_MOMENTS.powerhouse.sceneMasterId,
      mux_asset_id: sourceAsset?.provider_asset_id ?? CANON.muxAssetId,
      playback_id: sourceAsset?.storage_ref ?? CANON.muxPlaybackId,
    },
  });
  expect(registerRes.status()).toBe(400);
  expect((await registerRes.json()).code).toBe("canonical_source");
  notes.push("Canonical SHE Mux source cannot be registered as a production result");

  const sentinel = page.locator("section[aria-labelledby='universe-sentinel']");
  const powerhousePanel = sentinel.locator(`li[data-scene-id='${SCENE_MOMENTS.powerhouse.sceneMasterId}']`).first();
  await powerhousePanel.locator("button.sentinel-panel-open").click();
  const retain = powerhousePanel.getByRole("button", { name: /Keep as reference/i });
  await expect(retain).toBeVisible();
  await retain.click();
  await expect(page.getByRole("status").filter({ hasText: /reference/i }).first()).toBeVisible();
  notes.push("Powerhouse still retained as a curated reference without creating a Scene");

  await retain.click();
  await expect(page.getByText(/already a curated reference/i).or(page.getByText(/Kept as a production reference/i)).first()).toBeVisible();

  await page.goto(ROUTES.authorityMedia, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "References" }).click();
  await expect(page.locator("[data-gallery-role='reference']").first()).toBeVisible();
  notes.push("Retained still appears in Gallery References and is not a public Experience dump");

  await page.goto(ROUTES.universeHolographic, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-holographic-kind='scene']")).toHaveCount(4);
  await expect(page.locator("[data-holographic-kind='moment']")).toHaveCount(3);
  const publicProduction = page.locator("[data-holographic-kind='production']");
  const publicProductionCount = await publicProduction.count();
  expect(publicProductionCount === 0 || publicProductionCount === 1).toBeTruthy();
  notes.push(
    publicProductionCount === 1
      ? "2.5D shows the approved Powerhouse production layer without replacing canonical Scenes"
      : "2.5D stays canonical-only because no approved attached production result exists",
  );

  await page.goto(ROUTES.universeLive, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true }).first()).toBeVisible();

  const after = await snapshotCanon(svc);
  expect(after.scenes).toEqual(before.scenes);
  expect(after.bindings).toEqual(before.bindings);
  expect(after.muralBinding).toEqual(before.muralBinding);
  expect(after.presence).toEqual(before.presence);
  expect(after.realizationCount).toBe(before.realizationCount);
  expect(after.realizationCount).toBeLessThanOrEqual(1);
  expect(after.productionCount).toBe(before.productionCount);
  expect(after.productionCount).toBeLessThanOrEqual(1);
  expect(after.scenes).toHaveLength(4);
  expect(
    after.bindings
      .slice()
      .sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0))
      .map((binding) => [binding.start_ms, binding.end_ms]),
  ).toEqual([
    [36000, 79000],
    [80000, 124000],
    [149000, 192000],
    [193000, 254000],
  ]);
  expect(after.referenceCount).toBeGreaterThanOrEqual(before.referenceCount);
  expect(after.referenceCount).toBeLessThanOrEqual(before.referenceCount + 1);
  expect(after.muralBinding?.asset_id).toBe(CANON.muxAssetId);

  assertRuntimeHealth(observe);
  reportEvidence(testInfo, "BROWSER VERIFIED", "Production orchestration", page.url(), [
    ...notes,
    `SHE scenes remain ${after.scenes.length}`,
    `media_realization rows ${after.realizationCount}`,
    `curated references ${after.referenceCount}`,
    `production results ${after.productionCount}`,
  ], observe);
});
