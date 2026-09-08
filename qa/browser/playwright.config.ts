import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

/**
 * Mighty Verse browser QA — Stage 1 foundation.
 *
 * Uses the installed Google Chrome channel when available.
 * Advanced suites (playback, Sentinel, visual regression, a11y) are not
 * included here; add them as sibling folders later.
 */
export default defineConfig({
  testDir: "./smoke",
  testMatch: /.*\.smoke\.ts/,
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "./playwright-report", open: "never" }],
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
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
