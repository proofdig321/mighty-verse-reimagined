import { expect } from "@playwright/test";
import {
  failedRequests,
  livepeerMisrouteForMux,
  unexpectedConsoles,
  type RuntimeObservation,
} from "./observe";

type HealthOptions = {
  /** Extra failed-request URLs that are expected for this route (e.g. a known 404 probe). */
  allowFailedUrl?: (url: string, status: number | null) => boolean;
};

/**
 * Runtime health for the smoke suite.
 *
 * Fails on uncaught page errors, unexpected console errors, Mux assets routed
 * through Livepeer, and obvious application request failures.
 *
 * Does not treat mixed-provider Livepeer traffic as a defect on pages that
 * also render the legacy Universe.
 */
export function assertRuntimeHealth(
  observation: RuntimeObservation,
  options: HealthOptions = {},
): void {
  expect(observation.pageErrors, `uncaught page errors: ${observation.pageErrors.join(" | ")}`).toEqual([]);

  const consoles = unexpectedConsoles(observation);
  expect(
    consoles,
    `unexpected console errors: ${consoles.map((entry) => entry.text).join(" | ")}`,
  ).toEqual([]);

  const misroute = livepeerMisrouteForMux(observation);
  expect(
    misroute,
    `Mux playback ID was requested through a Livepeer path: ${misroute.map((entry) => entry.url).join(" | ")}`,
  ).toEqual([]);

  const failed = failedRequests(observation).filter((entry) => {
    if (options.allowFailedUrl?.(entry.url, entry.status)) return false;
    return true;
  });

  const applicationFailed = failed.filter((entry) => {
    try {
      const parsed = new URL(entry.url);
      const appHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
      if (appHost && parsed.pathname.startsWith("/api/")) return true;
      if (appHost && entry.status != null && entry.status >= 500) return true;
      return false;
    } catch {
      return false;
    }
  });

  expect(
    applicationFailed,
    `failed application requests: ${applicationFailed.map((entry) => `${entry.status ?? "fail"} ${entry.url}`).join(" | ")}`,
  ).toEqual([]);
}
