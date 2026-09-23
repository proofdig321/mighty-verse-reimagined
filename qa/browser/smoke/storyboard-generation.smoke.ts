import { CANON } from "../lib/canon";
import { applyAuthoritySession } from "../lib/authority-auth";
import { test, expect } from "../lib/fixtures";
import { reportEvidence } from "../lib/observe";

const SCRIPT = `A lone mural walker crosses a Johannesburg night street.
Camera: slow crane up
Neon rain turns the wall into a living skyline.
Movement: orbit
The walker stops and looks back.
Transition: cut`;

test("unauthenticated storyboard generation stays rejected", async ({}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  const get = await fetch(`${baseURL}/api/authority/storyboard`);
  expect(get.status).toBe(401);
  const jobs = await fetch(`${baseURL}/api/authority/storyboard/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ work_id: "00000000-0000-0000-0000-000000000000", kind: "still" }),
  });
  expect(jobs.status).toBe(401);
});

test("authenticated Storyboard generates panels without creating Scenes", async ({ page, context, observe }, testInfo) => {
  test.setTimeout(180_000);
  const notes: string[] = [];
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3000";
  await applyAuthoritySession(context, baseURL);

  const cookies = await context.cookies();
  const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

  const capabilityResponse = await fetch(`${baseURL}/api/authority/storyboard`, {
    headers: { cookie: cookieHeader },
  });
  expect(capabilityResponse.status).toBe(200);
  const capabilityPayload = await capabilityResponse.json();
  expect(capabilityPayload.creates_scene).toBe(false);
  expect(capabilityPayload.capability).toBeTruthy();
  notes.push(
    `capability configured=${Boolean(capabilityPayload.capability?.configured)} provider=${capabilityPayload.capability?.provider} models=${JSON.stringify(capabilityPayload.capability?.models ?? {})}`,
  );

  const generated = await fetch(`${baseURL}/api/authority/storyboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader },
    body: JSON.stringify({
      universe_id: "",
      action: "generate-storyboard",
      title: "QA pipeline probe — do not curate",
      body: SCRIPT,
    }),
  });
  const generatedPayload = await generated.json();
  expect(generatedPayload.creates_scene).toBe(false);
  expect(generatedPayload.creates_canonical ?? false).toBe(false);
  expect(generatedPayload.work?.work_id).toBeTruthy();
  expect((generatedPayload.work?.panels ?? []).length).toBeGreaterThan(0);
  notes.push(
    `generate-storyboard status=${generated.status} jobStatus=${generatedPayload.status ?? "ready"} fallback=${generatedPayload.fallback ?? "none"} panels=${generatedPayload.work.panels.length} error=${generatedPayload.error ?? "none"}`,
  );

  const still = await fetch(`${baseURL}/api/authority/storyboard/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader },
    body: JSON.stringify({
      universe_id: "",
      work_id: generatedPayload.work.work_id,
      panel_id: generatedPayload.work.panels[0].panel_id,
      kind: "still",
      prompt: generatedPayload.work.panels[0].description,
    }),
  });
  const stillPayload = await still.json().catch(() => ({ status: "failed", error: { message: `empty response (${still.status})` } }));
  expect(stillPayload.creates_scene ?? false).toBe(false);
  notes.push(
    `still job status=${still.status} generation=${stillPayload.status} code=${stillPayload.error?.code ?? "none"} message=${stillPayload.error?.message ?? stillPayload.message ?? "none"}`,
  );

  if (stillPayload.status === "completed") {
    const motion = await fetch(`${baseURL}/api/authority/storyboard/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({
        universe_id: "",
        work_id: generatedPayload.work.work_id,
        panel_id: generatedPayload.work.panels[0].panel_id,
        kind: "motion",
        prompt: generatedPayload.work.panels[0].description,
      }),
    });
    const motionPayload = await motion.json();
    expect(motionPayload.creates_scene).toBe(false);
    notes.push(
      `motion job status=${motion.status} generation=${motionPayload.status} code=${motionPayload.error?.code ?? "none"} message=${motionPayload.error?.message ?? "none"} playback=${motionPayload.result?.playback_id ?? "none"}`,
    );
  }

  await page.goto("/studio/work", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Storyboard Workspace" })).toBeVisible();
  await page.getByRole("button", { name: "New storyboard" }).click();
  // Progress bar uses class storyboard-progress, not data-storyboard-progress
  await expect(page.locator(".storyboard-progress")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Generate storyboard" })).toBeVisible();
  // Storyboard workspace uses internal tab state, not role=tab elements
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();
  notes.push("standalone /studio/work list creates a work and exposes Generate storyboard, undo, and reset");
  if (process.env.STORYBOARD_ARTIFACT_DIR) {
    await page.screenshot({ path: `${process.env.STORYBOARD_ARTIFACT_DIR}/storyboard_standalone_studio.png`, fullPage: true });
  }

  await page.goto(`/authority/universes/${CANON.universeId}/storyboard`, { waitUntil: "domcontentloaded" });
  // h1 is the universe title; Storyboard appears in breadcrumb/nav
  await expect(page.getByRole("heading", { name: CANON.universeTitle, exact: true }).first()).toBeVisible();
  // Canonical Scenes are listed in the left column
  await expect(page.getByText("Canonical Scenes", { exact: true })).toBeVisible();
  await expect(page.getByText("Canonical Scene").first()).toBeVisible();
  await expect(page.locator("section[aria-labelledby='work-context-scenes'] li")).toHaveCount(4);
  notes.push("SHE Storyboard still shows exactly four Canonical Scene entries in the left column");
  if (process.env.STORYBOARD_ARTIFACT_DIR) {
    await page.screenshot({ path: `${process.env.STORYBOARD_ARTIFACT_DIR}/storyboard_she_workspace.png`, fullPage: true });
  }

  reportEvidence(testInfo, "BROWSER VERIFIED", "Storyboard generation pipeline", page.url(), notes, observe);
});
