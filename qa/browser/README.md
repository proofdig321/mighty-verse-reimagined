# Browser QA foundation

CANONICAL for browser verification workflow: yes
STATUS: Stage 1 smoke only

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

Default origin: `http://127.0.0.1:3000` (Next.js also binds `localhost:3000`).

2. Run the smoke suite (uses the installed Google Chrome channel):

```bash
npm run test:qa:browser
```

Optional:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:qa:browser
npx playwright test --config qa/browser/playwright.config.ts --headed
```

The config reuses an existing dev server when one is already listening.

## Routes covered (Stage 1)

| Brief path | Live application path | What is checked |
|---|---|---|
| `/` | `/` | Home loads, primary content, real Universe, Mux thumbnail traffic |
| `/universes` | `/universes` | Universe list, real Super Hero Ego row |
| `/universes/05ccc0c6-75f9-4864-b0c1-af5e36bf45cc` | **live page is `/worlds/{id}`** | Requested path is probed; mural + Scene Deck + Mux player on live routes |
| `/moments` | `/moments` | Listing + opening a real moment, Mux provider path |
| `/authority/curate` | `/authority/curate` | Route loads; auth gate or Curate Universe/Mural selector |
| `/editor` | `/editor` | Experience Editor, real Scenes, Mux thumbnails, timeline init |

Canonical IDs live in `lib/canon.ts` and must match `.mighty-verse/AGENT.md`.

## Layout

```
qa/browser/
  playwright.config.ts   Chrome + baseURL + webServer
  lib/canon.ts           live Super Hero Ego IDs (not fake fixtures)
  lib/observe.ts         console / network / screenshot / evidence labels
  lib/health.ts          unexpected console, failed app requests, Mux-vs-Livepeer
  lib/fixtures.ts        Playwright fixture — do not put this in production components
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
