# Browser QA foundation

CANONICAL for browser verification workflow: yes
STATUS: Stage 1 smoke + Stage 1.1 local Play + Stage 1.2 production Mural Play + Stage 1.3 Moment Play coverage

This directory is the browser QA layer for Mighty Verse. It is independent of
application and domain logic. Do not import these helpers from `src/`.

## What this is

A Playwright + Chrome smoke suite that observes the **running application**.

It is not a substitute for TypeScript, unit tests, or live Supabase queries.
All three layers are required:

```
SOURCE (TypeScript + tests + lint)
DATABASE (live Supabase queries)
BROWSER (this suite, against the real UI)
```

## Evidence kinds

Every result must be labelled as one of:

| Kind | Meaning |
|---|---|
| `BROWSER VERIFIED` | Chrome actually executed the route/action and observed the result |
| `STATIC VERIFIED` | Only source/code/configuration was inspected |
| `TEST VERIFIED` | A deterministic automated test passed (unit/integration, no browser) |
| `NOT VERIFIED` | The environment prevented actual browser verification |

Never describe a TypeScript pass as browser verification.

## How to run

1. Start the app (or reuse an already-running dev server):

```bash
npm run dev
```

Default origin: `http://localhost:3000`.

Next.js 16 treats `127.0.0.1` and `localhost` as different origins during `next dev`.
Chrome requests that send `Origin: http://127.0.0.1:3000` receive HTTP 403
`Unauthorized` on `/_next/static` chunks, including `hls.js`. `next.config.ts`
sets `allowedDevOrigins: ['127.0.0.1']` so that host still works in this
environment after a dev-server restart.

2. Run the smoke suite (uses the installed Google Chrome channel):

```bash
npm run test:qa:browser
```

Optional:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:qa:browser
npx playwright test --config qa/browser/playwright.config.ts --headed
```

The config reuses an existing dev server when one is already listening.
`PLAYWRIGHT_BASE_URL` overrides the local origin; leave it unset for localhost.

## Routes covered (Stage 1)

| Brief path | Live application path | What is checked |
|---|---|---|
| `/` | `/` | Home loads, primary content, real Universe, Mux thumbnail traffic |
| `/universes` | `/universes` | Universe list, real Super Hero Ego row |
| Super Hero Ego Universe | `/worlds/05ccc0c6-75f9-4864-b0c1-af5e36bf45cc` | Canonical Universe page, mural CTA, Scene Deck, Mux HLS evidence |
| Super Hero Ego Mural | `/worlds/a75ae8af-7b48-4b67-8392-d89447bae370` | Player mount, HLS URL, stream.mux.com, Play click, readyState, currentTime advance, painted frame |
| Super Hero Ego Sword Master Moment | `/moments/8100033e-4c7e-448f-8b9c-b9ff97fdc3fd` | Same shared player as Mural; Scene title; Mux HLS; seek near 193s; Play; currentTime advances inside 193–254s; painted frame; no Livepeer |
| `/moments` | `/moments` | Listing + opening a real moment, Mux provider path |
| `/authority/curate` | `/authority/curate` | Route loads; auth gate or Curate Universe/Mural selector |
| `/editor` | `/editor` | Experience Editor, real Scenes, Mux thumbnails, timeline init |

Canonical IDs live in `lib/canon.ts` and must match `.mighty-verse/AGENT.md`.

## Layout

```
qa/browser/
  playwright.config.ts              local Chrome + baseURL + webServer
  playwright.production.config.ts   opt-in production Chrome (no webServer)
  lib/canon.ts           live Super Hero Ego IDs (not fake fixtures)
  lib/observe.ts         console / network / screenshot / evidence labels
  lib/health.ts          unexpected console, failed app requests, Mux-vs-Livepeer
  lib/fixtures.ts        Playwright fixture — do not put this in production components
  lib/playback.ts        HTMLVideoElement Play / readyState / painted-frame helpers
  smoke/*.smoke.ts       Stage 1 runtime smoke (Playwright testMatch)
```

Later suites should be added as siblings, not mixed into production code:

- `playback/` — media playback verification
- `timeline/` — Scene timeline verification
- `curate/` — Curate workflow verification
- `sentinel/` — Sentinel workflow verification
- `responsive/` — viewport checks
- `a11y/` — accessibility checks
- `visual/` — visual regression

Do not build those suites in Stage 1.

## Configuration

- Playwright config: `qa/browser/playwright.config.ts`
- Chrome: `use.channel = "chrome"` (system Google Chrome)
- Reports: `qa/browser/playwright-report/` (gitignored)
- Per-test screenshots: `qa/browser/test-results/` (gitignored)

## Dev-server noise vs product defects

Next.js 16 can return HTTP 403 `Unauthorized` for `/_next/static` when Chrome’s
`Origin` is `http://127.0.0.1:3000` while the dev server considers `localhost`
the allowed host. The server log names this as `allowedDevOrigins`.

That is **browser QA / Next.js `next dev` host mismatch**, not an `/api` defect
and not Mux-vs-Livepeer misrouting. HMR websocket handshake failures are expected
Next.js dev-server noise.

Mural HLS: Chrome Origin `http://localhost:3000` loads `hls.js` and requests
`stream.mux.com`. Origin `http://127.0.0.1:3000` without `allowedDevOrigins`
returns HTTP 403 on those chunks and the player stays on "Loading media".
Do not silently drop a FINDING if HLS still does not start after origin alignment.

Stage 1.1 (`smoke/mural-playback.smoke.ts`) clicks Play on the labelled
`<video>` and asserts real Mux playback: `readyState >= 2`, `currentTime`
advances, and a non-empty decoded frame via `canvas.drawImage`. Native
`<video controls>` has no page-DOM Play button; the test clicks the labelled
video then calls `HTMLVideoElement.play()` once (Space is a toggle and can
pause an in-flight play).

Mux `edgemv.mux.com` / `stream.mux.com` `net::ERR_ABORTED` segment requests
are HLS unused-range aborts. They are recorded, not treated as `/api` failures.

## Local vs production

Local (`npm run test:qa:browser`): Chrome against `http://localhost:3000`
(`next dev`). This is the default. It does not call production.

Production (`npm run test:qa:browser:production`): Chrome against the deployed
Mighty Verse origin. The origin is the GitHub repository homepage (Vercel
`*.vercel.app`). It is **opt-in** and requires `QA_PRODUCTION_URL`.

```bash
QA_PRODUCTION_URL="$(gh repo view --json homepageUrl --jq .homepageUrl)"
npm run test:qa:browser:production
```

That command runs `smoke/mural-playback.smoke.ts` and
`smoke/moment-playback.smoke.ts`. It does not start `next dev`.
The GitHub field is `homepageUrl` (not `homepage`).

Stage 1.2 Chrome result on production Super Hero Ego Mural
(`/worlds/a75ae8af-7b48-4b67-8392-d89447bae370`): Play invoked, `readyState=4`,
`currentTime` advanced, 1280×720 painted frame, Mux HLS
`JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4`, no Livepeer misroute.

Stage 1.3 adds the Sword Master Moment Play assertion
(`/moments/8100033e-4c7e-448f-8b9c-b9ff97fdc3fd`) on the same production
command. Local `npm run test:qa:browser` also picks up the new smoke file.

Next.js RSC prefetch `net::ERR_ABORTED` on neighbouring routes (`/_rsc=`) is
production navigation prefetch cancellation. It is not a Mux playback failure.
