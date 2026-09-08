import { test as base } from "@playwright/test";
import { attachObservers, type RuntimeObservation } from "./observe";

/**
 * Playwright fixture that records console, page errors, and network activity
 * for the duration of each smoke test. QA observation stays in this layer —
 * production components are not instrumented.
 */
export const test = base.extend<{ observe: RuntimeObservation }>({
  observe: async ({ page }, use) => {
    const observation = attachObservers(page);
    await use(observation);
  },
});

export { expect } from "@playwright/test";
