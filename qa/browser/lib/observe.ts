import type { ConsoleMessage, Page, Request, Response, TestInfo } from "@playwright/test";
import { CANON } from "./canon";

export type EvidenceKind =
  | "BROWSER VERIFIED"
  | "STATIC VERIFIED"
  | "TEST VERIFIED"
  | "NOT VERIFIED";

export type ConsoleEntry = {
  type: string;
  text: string;
};

export type NetworkEntry = {
  method: string;
  url: string;
  resourceType: string;
  status: number | null;
  failure: string | null;
};

export type RuntimeObservation = {
  consoles: ConsoleEntry[];
  requests: NetworkEntry[];
  pageErrors: string[];
};

const IGNORED_URL_SNIPPETS = [
  "/favicon.ico",
  "/_next/webpack-hmr",
  "/_next/hmr",
  "chrome-extension://",
];

function isIgnoredUrl(url: string): boolean {
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  if (url.startsWith("ws://") || url.startsWith("wss://")) return true;
  return IGNORED_URL_SNIPPETS.some((snippet) => url.includes(snippet));
}

export function isBenignConsole(entry: ConsoleEntry): boolean {
  const text = entry.text;
  if (/Download the React DevTools/i.test(text)) return true;
  if (/Fast Refresh/i.test(text)) return true;
  if (/\[HMR\]/i.test(text)) return true;
  if (/\/_next\/hmr/i.test(text)) return true;
  if (/Extra attributes from the server/i.test(text)) return true;
  if (/favicon\.ico/i.test(text) && /404/.test(text)) return true;
  if (entry.type === "warning" && /Image with src/i.test(text)) return true;
  // Chrome omits the URL; Next/Turbopack chunk 403s and HMR handshake noise are
  // correlated from the network log instead of failing the smoke suite.
  if (/Failed to load resource: the server responded with a status of (403|404)/i.test(text)) return true;
  if (/WebSocket connection to .*\/_next\/hmr/i.test(text)) return true;
  return false;
}

/** `/_next/static` 403 "Unauthorized" when the request carries Origin — Cursor/dev-server noise. */
export function originBlockedStaticRequests(observation: RuntimeObservation): NetworkEntry[] {
  return observation.requests.filter((entry) => {
    if (!entry.url.includes("/_next/static/")) return false;
    return entry.status === 403 || /unauthorized/i.test(entry.failure ?? "");
  });
}

export function unexpectedConsoles(observation: RuntimeObservation): ConsoleEntry[] {
  return observation.consoles.filter((entry) => {
    if (entry.type !== "error") return false;
    return !isBenignConsole(entry);
  });
}

export function failedRequests(observation: RuntimeObservation): NetworkEntry[] {
  return observation.requests.filter((entry) => {
    if (isIgnoredUrl(entry.url)) return false;
    if (entry.failure) return true;
    if (entry.status != null && entry.status >= 400) return true;
    return false;
  });
}

export function muxMediaRequests(observation: RuntimeObservation): NetworkEntry[] {
  return observation.requests.filter((entry) => {
    return (
      entry.url.includes(CANON.muxThumbnailHost) ||
      entry.url.includes(CANON.muxStreamHost) ||
      entry.url.includes(CANON.muxPlaybackId)
    );
  });
}

export function livepeerMisrouteForMux(observation: RuntimeObservation): NetworkEntry[] {
  return observation.requests.filter((entry) => {
    const url = entry.url;
    const mentionsMuxPlayback = url.includes(CANON.muxPlaybackId);
    const livepeerPath =
      url.includes("/api/livepeer/playback/") ||
      url.includes("livepeercdn") ||
      url.includes("vod-cdn.lp-playback.studio");
    return mentionsMuxPlayback && livepeerPath;
  });
}

export function attachObservers(page: Page): RuntimeObservation {
  const observation: RuntimeObservation = {
    consoles: [],
    requests: [],
    pageErrors: [],
  };

  page.on("console", (message: ConsoleMessage) => {
    observation.consoles.push({
      type: message.type(),
      text: message.text(),
    });
  });

  page.on("pageerror", (error) => {
    observation.pageErrors.push(error.message);
  });

  page.on("request", (request: Request) => {
    if (isIgnoredUrl(request.url())) return;
    observation.requests.push({
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      status: null,
      failure: null,
    });
  });

  page.on("requestfailed", (request: Request) => {
    if (isIgnoredUrl(request.url())) return;
    const existing = observation.requests.find(
      (entry) => entry.url === request.url() && entry.status == null && entry.failure == null,
    );
    const failure = request.failure()?.errorText ?? "requestfailed";
    if (existing) {
      existing.failure = failure;
      return;
    }
    observation.requests.push({
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      status: null,
      failure,
    });
  });

  page.on("response", (response: Response) => {
    if (isIgnoredUrl(response.url())) return;
    const existing = [...observation.requests]
      .reverse()
      .find((entry) => entry.url === response.url() && entry.status == null);
    if (existing) {
      existing.status = response.status();
      return;
    }
    observation.requests.push({
      method: response.request().method(),
      url: response.url(),
      resourceType: response.request().resourceType(),
      status: response.status(),
      failure: null,
    });
  });

  return observation;
}

export function formatEvidence(args: {
  kind: EvidenceKind;
  title: string;
  url: string;
  notes: string[];
  observation: RuntimeObservation;
}): string {
  const unexpected = unexpectedConsoles(args.observation);
  const blockedStatic = originBlockedStaticRequests(args.observation);
  const failed = failedRequests(args.observation).filter(
    (entry) => !blockedStatic.some((blocked) => blocked.url === entry.url && blocked.status === entry.status),
  );
  const mux = muxMediaRequests(args.observation);
  const misroute = livepeerMisrouteForMux(args.observation);

  const lines = [
    "",
    `=== ${args.kind}: ${args.title} ===`,
    `url: ${args.url}`,
    ...args.notes.map((note) => `note: ${note}`),
    `pageErrors: ${args.observation.pageErrors.length ? args.observation.pageErrors.join(" | ") : "(none)"}`,
    `unexpectedConsoleErrors: ${unexpected.length ? unexpected.map((e) => `[${e.type}] ${e.text}`).join(" | ") : "(none)"}`,
    `failedRequests: ${failed.length ? failed.map((e) => `${e.status ?? "fail"} ${e.method} ${e.url}${e.failure ? ` (${e.failure})` : ""}`).join(" | ") : "(none)"}`,
    `originBlockedStatic: ${blockedStatic.length ? blockedStatic.map((e) => `${e.status ?? "fail"} ${e.url}`).join(" | ") : "(none)"}`,
    `muxMediaRequests: ${mux.length}`,
    `livepeerMisrouteForMux: ${misroute.length ? misroute.map((e) => e.url).join(" | ") : "(none)"}`,
  ];
  return lines.join("\n");
}

export async function captureScreenshot(page: Page, testInfo: TestInfo, label: string): Promise<void> {
  const slug = label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const file = testInfo.outputPath(`${slug}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(slug, { path: file, contentType: "image/png" });
}

export function reportEvidence(
  testInfo: TestInfo,
  kind: EvidenceKind,
  title: string,
  url: string,
  notes: string[],
  observation: RuntimeObservation,
): void {
  const report = formatEvidence({ kind, title, url, notes, observation });
  console.log(report);
  testInfo.annotations.push({ type: kind, description: `${title} — ${notes.join("; ")}` });
}
