# Mighty Verse Reimagined — Agent Context

CANONICAL: yes
STATUS: current as of 2026-09-08 (Stage 2.3 Universe identity curation)
MAINTAINED BY: implementation agent (update on each verified checkpoint)

This document is the primary context for any coding agent (Amazon Q, Cursor, or future)
working on the Mighty Verse Reimagined repository. It describes the current verified state
of the implementation, the canonical architecture, and the mandatory development protocol.

The deep constitutional model lives in `.mighty-verse/05-architecture.md`.
This document is the practical working context.

---

## 1. WHAT MIGHTY VERSE IS

Mighty Verse is a canonical cultural universe owned by Golden Shovel.
It gives African creative culture a canonical home.

It is NOT fundamentally an NFT platform, streaming platform, or animation platform.
Those are delivery mechanisms. The canonical model is the product.

**Product flow:**
```
Discover → Reveal → Assemble → Experience
```

---

## 2. CANONICAL ONTOLOGY

The canonical creative hierarchy is:

```
Universe (Song/World)
    ↓
Mural (complete visual expression of a Universe)
    ↓
Scene (canonical bounded visual/narrative unit)
    ↓
Creative Moment (smallest authored/contributor unit)
```

These four entities are the canonical creative truth.
They live in the `master` table with `canonical_type` values:
`universe`, `mural`, `scene`, `creative-moment`.

**DO NOT:**
- Add new canonical creative entities without explicit founder decision
- Use provider playback IDs as canonical identity
- Treat AI output as canonical truth
- Collapse Scene → Creative Moment into a single entity
- Make Sentinel evidence automatically canonical

---

## 3. LIVE CANONICAL DATA (Super Hero Ego)

**Universe:** `05ccc0c6-75f9-4864-b0c1-af5e36bf45cc`
**Mural:** `a75ae8af-7b48-4b67-8392-d89447bae370`

**Mux media asset:** `795c057e-2967-4e93-8f5e-06297c674cb0`
- provider: `mux`
- storage_ref / playback_id: `JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4`
- HLS endpoint: `https://stream.mux.com/JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4.m3u8`
- duration_ms: `254800`

**Four canonical Scenes (projection_id → timing):**
| Scene | Projection ID | start_ms | end_ms |
|---|---|---|---|
| Golden Shovel — Powerhouse | `3039ca84-7e11-4eb6-8895-d16d13a899c3` | 36000 | 79000 |
| Mothipa — Dark Knight | `bb802400-b385-4025-9bb8-63df53abd9be` | 80000 | 124000 |
| ProVerb — Hand-to-Hand | `9c045ea3-ab09-4a6f-b89c-02dce076b8da` | 149000 | 192000 |
| Reason — Sword Master | `8100033e-4c7e-448f-8b9c-b9ff97fdc3fd` | 193000 | 254000 |

**Authority holder:** participant `866390ff-5d45-4c15-b64e-e7c0655780b8`
- authority_record: `b7b453f9-...`
- scope_type: `platform`
- authority_type: `ultimate`

These values are immutable verification targets. Any implementation that changes them
without explicit canonical authority is a defect.

---

## 4. ARCHITECTURE LAYERS

```
CANONICAL TRUTH          (master, canonical_state, projection, projection_media_binding)
       ↓
MEDIA ASSET              (media_asset, delivery_variant — provider-neutral)
       ↓
SENTINEL / EVIDENCE      (inspection_session, frame_observation — observational only)
       ↓
DERIVED INTELLIGENCE     (future: AI classification, similarity, etc.)
       ↓
CURATE / CREATIVE STUDIO (authority workspace — curate, media inspect)
       ↓
PUBLIC EXPERIENCE        (worlds, moments, editor, universes)
```

**Critical rule:** Evidence may inform editorial decisions. Evidence must NOT
automatically become canonical truth. A human-authorized operation via the
authority API must establish canonical Scene timing.

---

## 5. MEDIA PROVIDER ARCHITECTURE

**Current provider:** Mux (Super Hero Ego)
**Legacy provider:** Livepeer (second Universe `f11c3aba-...`)

Provider is stored in `media_asset.provider`. Never hard-code `mux` globally.
Never assume every asset is Mux. Resolve provider from the canonical media chain:

```
projection_media_binding → media_asset.provider → route to correct player/thumbnail
```

**Mux thumbnail:** `https://image.mux.com/{playback_id}/thumbnail.jpg?time={seconds}`
**Livepeer thumbnail:** via VTT keyframe index (see `src/lib/media/thumbnail.ts`)

`resolveThumbnail()` in `src/lib/media/thumbnail.ts` accepts `provider` parameter.
Always pass `provider` when calling it.

**HLS loading rule (all players):**
1. `Hls.isSupported()` → use hls.js (Chrome, Firefox, Edge)
2. `video.canPlayType('application/vnd.apple.mpegurl')` → native HLS (Safari only)
3. Otherwise → error state

Never use `canPlayType` as the primary gate. This was a confirmed Chrome bug.

---

## 6. IMPLEMENTED FEATURES (verified)

### Canonical Operations (hardened 2026-09-09)
- `/api/authority/media` — timing-preserving rebind (preserves start_ms/end_ms)
- `/api/authority/scenes` — created_by set, logOperation called, duplicate guard
- `/api/authority/media/timeline` — PATCH updates start_ms/end_ms on binding
- `/api/signals` — consumption signal recording (uses service client for projection lookup)

### Public Frontend
- `/` — home with Mux preview thumbnails
- `/universes` — provider-correct media
- `/worlds/[masterId]` — Universe and Mural pages with provider propagation
- `/worlds/[masterId]/scenes` — Scene Deck with provider=mux for all four scenes
- `/moments/[projectionId]` — Moment playback via MuxPlayer with canonical timing
- `/editor` — Experience Editor with Mux thumbnails and HLS playback
- `/authority/universes` — Authority Universe listing (auth-gated)
- `/authority/universes/[masterId]` — Universe curation workspace: identity, Mural, Scenes, Creative Moments
- `/authority/universes/[masterId]/identity` — Universe identity curation (title + description)
- `src/lib/assemble/` — shared Universe assembly read-model and identity validation (Authority now; public curation later). Map: `src/lib/assemble/CAPABILITIES.md`

### Sentinel Evidence Layer (Phase 1, 2026-09-10)
- `inspection_session` table — one row per inspection run against a media_asset
- `frame_observation` table — one row per sampled frame per session
- `src/lib/media/sentinel.ts` — persistence adapter (decoupled from analyser)
- `/api/authority/media/inspect` — authority-gated POST/GET for evidence persistence
- 3 live sessions exist against asset `795c057e` (from verification runs)

### Media Intelligence (browser-side, ephemeral)
- `src/lib/media/intelligence.ts` — sampleFrames, computeFrameDeltas, detectBoundaryTimestamps
- `src/lib/media/scene-candidates.ts` — SceneCandidate type, accept/reject/adjust
- Curate workspace — full inspection UI with candidate review

---

## 7. INTENTIONALLY DEFERRED (do not implement without explicit decision)

- `media_realization` population (requires ISRC/rights product decision)
- Sentinel candidate history persistence
- AI classification / object detection / embeddings
- Storyboard / composition layers
- 2.5D / holographic rendering
- Full Creative Studio expansion
- Sentinel dashboard UI
- `inspection_session` entity in canonical ontology (it is evidence, not canonical)

---

## 8. DATABASE

**Supabase project:** `fjrjyddzmjadeybjlree.supabase.co`
**Service role key:** in `.env.local` (never commit)

**Key tables:**
- `master` — canonical entities (universe/mural/scene/creative-moment)
- `canonical_state` — versioned canonical states
- `projection` — derived representations
- `projection_media_binding` — links projection to media_asset (has start_ms/end_ms)
- `media_asset` — media files (has provider, storage_ref, media_class)
- `delivery_variant` — HLS endpoints (endpoint_ref)
- `consumption_signal` — play/pause/complete telemetry
- `inspection_session` — Sentinel inspection runs
- `frame_observation` — per-frame evidence from inspections
- `canonical_operation_log` — append-only authority operation log

**RLS:** All tables have RLS. Use service client (`getServiceClient()`) for
server-side operations. Never expose service role key to browser.

**Migration state:** 20260910000000_sentinel_evidence_foundation.sql is the latest
applied migration.

---

## 9. KNOWN GAPS (tracked, not hidden)

- Atomicity on media rebind: delete+insert is not transactional. A unique constraint
  on `(projection_id, binding_type='primary')` would allow upsert. Deferred.
- Scene creation idempotency: title-based duplicate guard only. Not a true idempotency key.
- `media_realization` table: 0 rows. Blocked on product decision.
- Frame evidence: ephemeral browser-side only until Sentinel Phase 2.
- Sentinel has no persistent identity (no `inspection_session` in canonical ontology).
- Scene rebind UI: API is safe; no UI surface yet.
- Livepeer second Universe `f11c3aba`: not tested in this session but code paths preserved.
- `/universes/{masterId}` is not a live route (404). Canonical public Universe pages are `/worlds/{masterId}`.
- `/authority/curate` requires an authenticated participant; unauthenticated browser QA only verifies the sign-in gate.
- Mural Mux player: Stage 1.1 asserts Play on `/worlds/a75ae8af-7b48-4b67-8392-d89447bae370` locally. Stage 1.2 Chrome-verified the same Play path on the GitHub homepageUrl Vercel production origin. Stage 1.3 Chrome-verified Sword Master Moment Play on `/moments/8100033e-4c7e-448f-8b9c-b9ff97fdc3fd`. Stage 1.4 Chrome-verified Powerhouse, Dark Knight, and Hand-to-Hand through Universe → Mural sidebar navigation on the same shared `ProjectionMediaPlayer` / `MuxPlayer` path (Scene seek, Play, painted frame, end reset-to-start, no Livepeer). Stage 1.5 Chrome-verified Scene Moment → `/creative-moments/{id}` identity pages (Proverb, Mothipa, Reason). Those pages are not a Mux playback surface. `MuxPlayer` keys HLS on `source.endpoint` / `source.playbackId` and destroys hls.js on cleanup.
- Authority Universe curation: Stage 2.1 establishes `/authority/universes/{masterId}` as the Universe assembly shell. Stage 2.2 extracts the shared assembly read-model and hierarchy presentation (`src/lib/assemble/`, `src/components/assemble/`). Stage 2.3 adds Universe identity curation (`/authority/universes/{masterId}/identity`) using shared validation/form and the existing `POST /api/authority/presentation` mutation. Mural / Scene / Creative Moment *editing* workspaces are later increments. `/authority/curate` remains the media-inspection workspace, not the Universe shell.

---

## 10. DEVELOPMENT PROTOCOL

Every implementation task must follow this protocol:

### Before changing anything
1. `git status` — confirm clean working tree
2. `git log --oneline -5` — confirm current commit
3. Inspect relevant source files
4. Query live Supabase for relevant data
5. Verify canonical data is intact

### Implementation
- Smallest correct change only
- Provider-neutral — never hard-code mux globally
- Authority-gated writes — use `validateAuthority()` + `logOperation()`
- No service role key in browser code
- No canonical data mutations without authority

### After implementation
1. `npx tsc --noEmit` — zero errors required
2. Run full test suite (see below)
3. `npm run lint` — document any new issues
4. Verify live data unchanged
5. `git diff` — review complete change set
6. Commit with structured message
7. Push to the canonical GitHub default branch (`origin/main`) — do not leave work only on an isolated Cursor feature branch. Do not force-push.

### Test commands
```bash
# Pre-existing tests (must remain 32/32)
node --experimental-strip-types --experimental-loader ./src/lib/media/__tests__/ts-loader.mjs \
  src/lib/media/__tests__/provider-resolution.test.mjs \
  src/lib/media/__tests__/metadata.test.mjs \
  src/lib/media/__tests__/intake-workflow.test.mjs \
  src/lib/media/__tests__/inspection-wiring.test.mjs \
  src/lib/media/providers/mux/__tests__/mux.test.mjs

# Sentinel tests (must remain 6/6)
node --experimental-strip-types --experimental-loader ./src/lib/media/__tests__/ts-loader.mjs \
  src/lib/media/__tests__/sentinel.test.mjs

# Browser smoke (Chrome, against the running app — see §11)
npm run dev                      # if not already running
npm run test:qa:browser

# Production Mural + Moment Play (opt-in; not part of the local suite)
QA_PRODUCTION_URL="$(gh repo view --json homepageUrl --jq .homepageUrl)"
npm run test:qa:browser:production
```

### Git
Canonical remote: `origin`
Canonical default branch: `main`

```bash
git push -u origin HEAD
```

Do not use the retired Codespaces `source/main` workflow.

---

## 11. BROWSER QA PRINCIPLE

**Static checks are necessary but insufficient. Runtime/browser verification is
required for user-facing changes.**

A passing TypeScript check does not prove the UI works.
A passing unit-test suite does not prove media playback works.
A clean database query does not prove the Experience Editor works.

All three layers must agree:
```
SOURCE (TypeScript + tests + lint)
DATABASE (live Supabase queries)
BROWSER (actual UI verification)
```

**Evidence labels — use these exactly, never mix them:**

- `BROWSER VERIFIED` — Chrome executed the route/action and observed the result
- `STATIC VERIFIED` — only source/code/configuration was inspected
- `TEST VERIFIED` — a deterministic automated test passed (no browser)
- `NOT VERIFIED` — the environment prevented actual browser verification

When browser access is unavailable, state `NOT VERIFIED` explicitly.
Do not claim browser verification occurred if it did not.

### Stage 1 foundation

Config and smoke suite: `qa/browser/` (see `qa/browser/README.md`).
Chrome channel is used. Production components must not contain QA logic.

Start the app, then run smoke:

```bash
npm run dev
npm run test:qa:browser
```

Stage 1 routes: `/`, `/universes`, Super Hero Ego Universe at
`/worlds/05ccc0c6-75f9-4864-b0c1-af5e36bf45cc`, Super Hero Ego Mural Play at
`/worlds/a75ae8af-7b48-4b67-8392-d89447bae370`, Super Hero Ego Scene Moments at
`/moments/{projectionId}` for Powerhouse, Dark Knight, Hand-to-Hand, and Sword
Master, `/moments`, `/authority/curate`, `/editor`.
Smoke files match `qa/browser/smoke/*.smoke.ts`. Stage 1.1 proves actual Mux
playback after Play locally. Stage 1.2 proves the same Play path on the
deployed Vercel production origin (GitHub repository `homepageUrl`). Stage 1.3
proves Sword Master Moment Play. Stage 1.4 proves the three sibling Scene
Moments through Universe → Mural navigation on the same production command.
Stage 2.1 proves Authority → Universes → Super Hero Ego curation workspace
locally (auth-gated).
Production Chrome verification is opt-in:

```bash
QA_PRODUCTION_URL="$(gh repo view --json homepageUrl --jq .homepageUrl)"
npm run test:qa:browser:production
```

`npm run test:qa:browser` remains local (`http://localhost:3000`) and does
not hit production.

Canonical public Universe/Mural pages are `/worlds/{masterId}`. `/universes/{masterId}` is not a route.

---

## 12. CRITICAL INVARIANTS FOR AGENTS

**NEVER:**
- Change canonical ontology (Universe/Mural/Scene/Creative Moment) without explicit founder decision
- Use Mux playback IDs as canonical identity
- Use Livepeer playback IDs as canonical identity
- Mutate canonical data (master, canonical_state, projection, binding timings) without authority
- Populate `media_realization` without the required product decision
- Treat AI output as provenance truth
- Replace Mux/Livepeer architecture without explicit decision
- Expose service role key to browser
- Leave implementation only locally — always commit and push to `origin/main`

**ALWAYS:**
- Resolve provider from `media_asset.provider`
- Use `Hls.isSupported()` as primary HLS gate (not `canPlayType`)
- Pass `provider` to `resolveThumbnail()`
- Use service client for server-side Supabase operations
- Verify canonical data before and after any data operation
- Run TypeScript + tests + lint before committing
- Push to `origin/main` when implementation is complete

---

## 13. DEVELOPMENT ENVIRONMENT

Primary development is **Cursor** against this GitHub repository (`origin`).
Canonical default branch is `main`. Chrome is the primary browser QA client.

The canonical project instructions live in this file and `.mighty-verse/`.
They do not depend on conversation memory or the retired Codespaces/`source` remote workflow.

A new agent starting work on this repository should:
1. Read this file
2. Read `.mighty-verse/05-architecture.md` for deep constitutional context
3. Run `git log --oneline -10` to understand recent work
4. Query live Supabase to verify current data state
5. Run `npm test` and `npm run test:qa:browser` to confirm baseline

The repository is self-documenting. Do not rely on external conversation history.
