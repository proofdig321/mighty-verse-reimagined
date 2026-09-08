import { defineConfig } from "@playwright/test";

/**
 * Opt-in production Chrome smoke. Not used by `npm run test:qa:browser`.
 *
 * Requires QA_PRODUCTION_URL to be the deployed Mighty Verse origin.
 * Does not start `next dev`.
 */
const baseURL = process.env.QA_PRODUCTION_URL ?? "";

if (!baseURL) {
  throw new Error(
    "QA_PRODUCTION_URL is required for production browser QA (the deployed origin, not localhost).",
  );
}

if (/localhost|127\.0\.0\.1/i.test(baseURL)) {
  throw new Error("QA_PRODUCTION_URL must not be a local next dev origin.");
}

export default defineConfig({
  testDir: "./smoke",
  testMatch: /mural-playback\.smoke\.ts/,
  outputDir: "./test-results-production",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "./playwright-report-production", open: "never" }],
  ],
  use: {
    baseURL,
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    screenshot: "on",
    trace: "retain-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    launchOptions: {
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
});
