# Mighty Verse Reimagined — Agent Context

CANONICAL: yes
STATUS: current as of 2026-09-16 (production origin mightyverse.goldenshovel.co.za; Gemini/Mux in Vercel env)
MAINTAINED BY: implementation agent (update on each verified checkpoint)

This document is the primary context for any coding agent (Amazon Q, Cursor, or future)
working on the Mighty Verse Reimagined repository. It describes the current verified state
of the implementation, the canonical architecture, and the mandatory development protocol.

The product operating constitution lives in `.mighty-verse/06-product-vision.md`.
The deep technical model lives in `.mighty-verse/05-architecture.md`.
This document is the practical working context.

From this checkpoint forward, agents act as product lead + architect + implementer.
The founder remains the ultimate product decision-maker.
Do not treat Mighty Verse as a sequence of isolated tickets.
Do not implement `.mighty-verse/06-product-vision.md` as one giant development task.

---

## 1. WHAT MIGHTY VERSE IS

Mighty Verse is a canonical cultural universe owned by Golden Shovel.
It gives African creative culture a canonical home.

It is NOT fundamentally an NFT platform, streaming platform, or animation platform.
Those are delivery mechanisms. The canonical model is the product.

**Product flow:**
```
Discover → Reveal → Assemble / Curate → Experience
```

Mighty Verse is a truth-preserving creative universe engine.
MEDIA ≠ CREATIVE WORK. Experience must not silently become the source of truth.
See `.mighty-verse/06-product-vision.md`.

---

## 2. CANONICAL ONTOLOGY

The canonical creative structure is **not** a simple ownership tree:

```
Universe (Song/World)     ← primary creative identity; everything resolves here
  ├── Mural               ← complete audiovisual expression; not “the video file”
  ├── Scenes              ← first-class visual/spatial units (canonical timing)
  └── Creative Moments    ← contributor-centred; Universe-parented
           └── related to Scenes through scene_moment (sharing across Scenes is valid)
```

These four entities are the canonical creative truth.
They live in the `master` table with `canonical_type` values:
`universe`, `mural`, `scene`, `creative-moment`.

**Mural does not own Scenes.** Creative Moments are Universe-parented.
Moment Cards are Experience representations, not the canonical Creative Moment.
MEDIA ≠ CREATIVE WORK. A Mux asset is not a Universe, Mural, Scene, or Creative Moment.

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

### Father Raymond (own Universe — do not merge into Super Hero Ego)

**Universe:** `e22e080c-715c-4045-ba82-20474d25b2e0`
**Mural:** `14938419-9477-431a-be04-511b1e205bbd`
**Mux asset:** `5f85a6f1-1f2a-4da7-af9b-8467e58d3b9c` / playback `014sJhmHHRL2g52G14xG00L6MTyq4zvunCsZtFStk4Wds`
**Duration:** `198400` ms
**Canonical Scenes:** none until a curator Accepts as Scene on Curate Sentinel.

Do not invent Intro/Verse/Hook Scenes in the database. The curator names structure and times.
Do not reparent this work into Super Hero Ego because the title contains “Golden Shovel”.

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
CURATE / CREATIVE STUDIO (Curate Studio gateway → Creative Suite assembly)
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

**Mux thumbnail:** `https://image.mux.com/{playback_id}/thumbnail.jpg` is the representative poster. Add `?time={seconds}` only for a real timestamp. `time=0` is the first decoded frame and can be black (Give Me My Money Judas). Super Hero Ego Scene stills stay `time=36/80/149/193`.
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
- `/api/authority/media` — timing-preserving rebind (preserves start_ms/end_ms); Stage 2.6 Universe association `{ asset_id, universe_id }`
- `/api/authority/murals` — Stage 2.7 Mural registration for an existing Universe (composes registerMaster + canonical state + experiential projection; no media)
- `/api/authority/scenes` — created_by set, logOperation called, duplicate guard
- `/api/authority/media/timeline` — PATCH updates start_ms/end_ms on binding
- `/api/signals` — consumption signal recording (uses service client for projection lookup)

### Public Frontend
- `/` — home with Mux preview thumbnails
- `/universes` — provider-correct media
- `/worlds/[masterId]` — Universe landing is the public world encounter (identity, Mural as stage, Scene introductions, contributor presence, 2D / 2.5D toggle). Mural pages keep the existing player + scene sidebar.
- `/worlds/[masterId]/scenes` — Scene Deck with provider=mux for all four scenes (facedown, reveal, shuffle preserved). Revealed stills use each Scene's `start_ms` (Mux `time=` seconds).
- `/worlds/[masterId]/holographic` — public 2.5D holographic stage. Creative Moments are spatial objects; Scenes are visual planes; the Mural is the back plane. Canonical stills only. Not a new ontology.
- `/moments/[projectionId]` — Moment playback via MuxPlayer with canonical timing. Scene Moments continue into Universe 2.5D.
- `/editor` — Experience Editor with Mux thumbnails and HLS playback
- `/authority/curate` — incoming media catalogue and Universe picker. Short. MEDIA ≠ UNIVERSE.
- `/authority/curate/[universeId]` — Curate Hub for one Universe (derived live state). Not a stacked page.
- `/authority/curate/[universeId]/mural` — Register Mural (existing mural API). Not minting.
- `/authority/curate/[universeId]/moment` — Add Creative Moment (existing master/state/projection APIs).
- `/authority/curate/[universeId]/sentinel` — Sentinel Scene establishment workstation. Curator names Intro / Verse / Hook / Other and sets start/end, then Accept as Scene (`POST /api/authority/scenes`). Visual candidates are evidence. Sentinel does not classify musical structure and does not auto-create Scenes.
- `POST /api/authority/sentinel/authorise` — curator authorises Sentinel-proposed windows onto **existing** Scene bindings. Writes `start_ms`/`end_ms` only. Does not create Scenes. Disabled until Scenes exist.
- Studio Storyboard Sentinel tab continues to Curate Sentinel when the Universe has zero Scenes. Keep as reference still works.
- Public `/worlds/{id}` stages mural Mux when the Universe master has no own playback (Father Raymond). Empty Scenes are stated honestly.
- Public footer is site chrome on `PublicShell`. Operations stay off `PUBLIC_PRODUCT_NAV`.
- Asset Distribution panel is a readiness checklist (identity, rights, bind, ISRC, public Experience). YouTube / Spotify / Vimeo are named as future projections, not live adapters.
- `/authority/universes` — Creative Studio entry (existing Universe catalogue)
- `/authority/universes/[masterId]` — Creative Studio Overview (command centre). Child workspaces: `/storyboard`, `/sentinel`, `/scenes`, `/scenes/[sceneId]`, `/production`, `/preview` (2.5D Experience), `/experience` (Holographic Experience). Identity stays `/identity`. Mux IDs stay in inspector details. Public `/worlds/{id}` and `/worlds/{id}/holographic` remain Experience destinations. Sentinel does not create Scenes. Scene Deck shuffle is not imported. Preview does not rewrite timing.
- `/authority/universes/[masterId]/identity` — Universe identity curation (title + description)
- `/studio` and `/studio/work` — standalone Creative Studio. Storyboard can start without a Universe.
- Gemini/Veo server AI layer (`src/lib/ai/`) — text, structured storyboard, image, Veo long-running video. Jobs persist in `generation_job`. Stills/GIFs store in `creative-artifacts`. Motion ingests to Mux. AI never creates Scenes.
- Storyboard panels persist in `storyboard_work` / `storyboard_panel`. User edits are locked against silent overwrite.

### Sentinel Evidence Layer (Phase 1, 2026-09-10)
- `inspection_session` table — one row per inspection run against a media_asset
- `frame_observation` table — one row per sampled frame per session
- `src/lib/media/sentinel.ts` — persistence adapter (decoupled from analyser)
- `/api/authority/media/inspect` — authority-gated POST/GET; `asset_id` required, `master_id` optional. Source-media persist uses platform-scoped `authorise-projection`. Unauthenticated requests are rejected.
- Historical inspection runs against Mux `795c057e` remain intact. New runs append sessions; they do not overwrite.

### Sentinel Intelligence (Stage 3.9)
- `src/lib/media/sentinel-intelligence.ts` — derive storyboard, animation plan, 2.5D layers, and Scene-boundary proposals from evidence + existing Universe assembly
- Extra Sentinel candidates become storyboard beats, never new Scenes
- Authorise writes existing `projection_media_binding.start_ms/end_ms` via `decideSceneTiming`
- Public 2.5D uses canonical stills. Suite uses the latest completed inspection session when present. Stage 4.0 exposes the same 2.5D as Studio Preview inside Creative Suite; `/worlds/{id}/holographic` remains the audience Experience.
- Mux cinema is a custom WebGL1 compositor (`HolographicTheater`), not Three.js / R3F. `texture.flipY` stays false. Steady frames use `texSubImage2D` (allocate on size change). Do not skip uploads on HLS `currentTime`. Parallax strength is 0.75. Cinema fill is 1 (no dark bezel). Do not draw a second dark overlay display in the cinema; Scene/Moment composition stays under the mural. No new tables.

### Media Intelligence (browser-side, ephemeral)
- `src/lib/media/intelligence.ts` — sampleFrames, computeFrameDeltas, detectBoundaryTimestamps
- `src/lib/media/scene-candidates.ts` — SceneCandidate type, accept/reject/adjust
- Curate Studio — incoming media gateway plus existing Sentinel inspection UI with candidate review

---

## 7. INTENTIONALLY DEFERRED (do not implement without explicit decision)

- `media_realization` population (requires ISRC/rights product decision)
- Auto-creating Scenes from Sentinel candidates or Storyboard panels
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
- `storyboard_work` / `storyboard_panel` — creative storyboard documents (not canonical ontology)
- `generation_job` — async Gemini/Veo/ffmpeg jobs
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
- Frame evidence: persisted as `inspection_session` + `frame_observation` against the media asset (Stage 3.8). Not canonical.
- Sentinel has no persistent identity (no `inspection_session` in canonical ontology).
- Scene rebind UI: API is safe; no UI surface yet.
- Livepeer second Universe `f11c3aba`: Stage 2.7 registered Mural `f5872a92-1c38-4cff-836e-fbb22b25e506` (container only; no media attached). Super Hero Ego Mural `a75ae8af` is unchanged.
- `/universes/{masterId}` is not a live route (404). Canonical public Universe pages are `/worlds/{masterId}`.
- `/authority/curate` requires an authenticated participant; unauthenticated browser QA only verifies the sign-in gate.
- Mural Mux player: Stage 1.1 asserts Play on `/worlds/a75ae8af-7b48-4b67-8392-d89447bae370` locally. Stage 1.2 Chrome-verified the same Play path on the GitHub homepageUrl Vercel production origin. Stage 1.3 Chrome-verified Sword Master Moment Play on `/moments/8100033e-4c7e-448f-8b9c-b9ff97fdc3fd`. Stage 1.4 Chrome-verified Powerhouse, Dark Knight, and Hand-to-Hand through Universe → Mural sidebar navigation on the same shared `ProjectionMediaPlayer` / `MuxPlayer` path (Scene seek, Play, painted frame, end reset-to-start, no Livepeer). Stage 1.5 Chrome-verified Scene Moment → `/creative-moments/{id}` identity pages (Proverb, Mothipa, Reason). Those pages are not a Mux playback surface. `MuxPlayer` keys HLS on `source.endpoint` / `source.playbackId` and destroys hls.js on cleanup.
- Authority Universe curation: Stage 2.1–2.4 establish Creative Suite. Stage 2.5 reconciles `/authority/curate` as the Curate Studio gateway (incoming media + Sentinel) into Creative Suite. `/authority/curate` is not the Universe editor. MEDIA ≠ UNIVERSE.
- Product constitution locked 2026-09-08 in `.mighty-verse/06-product-vision.md`. Future increments are selected by the journey question, not by “next missing editor.”
- Stage 2.6: Curate Studio can explicitly associate playable unbound media with an **existing** Universe via `POST /api/authority/media` `{ asset_id, universe_id }`. Server resolves the Universe’s Mural projection. Does not create Universes/Murals. Does not replace an occupied Mural. Does not populate `media_realization`.
- Stage 2.7: A Universe without a Mural can register one via `POST /api/authority/murals` `{ universe_id }`, composing the existing Create Work operations **without media**. Super Hero Ego remains idempotent. Association still does not create a Mural. Sentinel persist remains deferred.
- Stage 2.8: Gallery Asset Record and Inspect continue into the **same** Curate Studio with `?asset={assetId}`. Unbound media stays selected for Associate with Universe. Bound Super Hero Ego Mux media continues to Creative Suite and is not re-associated. No MediaContext entity, no migration. Create Work remains the independent new-work wizard at `/authority/create`.
- Stage 2.9: Creative Suite is a Studio composition surface on `/authority/universes/{id}`. Scenes are face-up cinematic objects; Creative Moments are contributor objects; Proverb remains a single shared Creative Moment related to Powerhouse and Hand-to-Hand. Experience facedown/shuffle/reorder is not imported. No Scene/CM/Mural editor. No migration.
- Stage 3.0: Assemble → Experience continuity. Creative Suite surfaces Enter Experience as navigation into `/worlds/{universeId}`. The public Universe landing presents the composed world (identity, Mural as audiovisual stage, Scene encounters leading to the existing Scene Deck, contributor presence). Proverb remains identity-only. Dashboard residue (empty Collectibles/Holders/Base Network/Participants/Activity, Scenes tab showing the Mural) is removed from primary Experience. No publish/realize ontology. No migration. No canonical mutation. Scene Deck facedown/shuffle and Mural/Moment playback stay intact.
- Stage 3.2: Creative Suite authors Scene ↔ Creative Moment presence via existing `scene_moment` and `POST/DELETE /api/authority/scene-moment`. Relates existing objects only. Does not create Scenes, Creative Moments, projections, or media. Proverb remains identity-only and shared across Powerhouse and Hand-to-Hand.
- Stage 3.3: Creative Suite authors Scene identity (title + description) on the Scene object via existing `POST /api/authority/presentation`. Identity-only upsert preserves artwork and editorial markdown. Does not change timing, order, presence, projections, or media. Does not create Scenes.
- Stage 3.4: Scene Deck revealed cards use each Scene binding's `start_ms` (Mux `time=36/80/149/193` on Super Hero Ego). Facedown, reveal, shuffle, and playback stay in Experience. Studio stills were already correct.
- Stage 3.5: Creative Suite authors Scene timing on the Scene object via existing `PATCH /api/authority/media/timeline`. Compact start/end fields; canonical unit is ms; accepts `0:36.000`, `0:36`, and integer ms. Does not create Scenes. Not a timeline dashboard.
- Stage 3.6: Creative Suite authors Creative Moment identity with the same presentation primitive. Creative Moments stay Universe-parented. Does not create projections or media.
- Stage 3.7: Creative Suite authors canonical Scene order via existing `PATCH /api/authority/masters/sort-order` as Move earlier / Move later. Catalogue drag-order remains. Scene Deck shuffle is not imported.
- Stage 3.8: Asset-level Inspect persists Sentinel evidence against `media_asset` without requiring a canonical master. Re-runs create a new `inspection_session`. Does not create Universe/Mural/Scene/Creative Moment/projection/binding/realization.
- Stage 3.9: Sentinel evidence becomes storyboard, animation plan, Scene-boundary proposals, and CSS 2.5D holographic presentation on Super Hero Ego. Extra candidates stay beats. Authorise writes existing Scene windows only. Sentinel does not create Scenes. Scene Deck shuffle stays in Experience. No migration. No Three.js.
- Stage 4.0: Creative Suite is a followable Studio production path. Source media preview, Sentinel, storyboard, animation plan, Scene proposals, authorise, and 2.5D Studio Preview are visible from the dashboard/Universes entry without hidden routes. 2.5D remains a realization/preview. No workflow-state table. No migration. No media_realization. Super Hero Ego stays four Scenes at 36/80/149/193.
- Stage 4.1: Create Work processing no longer depends on Mux webhooks or a single open browser request. Polling advances `media_upload_session` from live Mux state. A request timeout is not a processing failure. Retry resumes the existing master/session. Curate associate/register expose Inspect → Sentinel → Creative Suite continuation. No migration. No job table. No Three.js. Super Hero Ego remains the regression reference.
- Stage 4.2: Product-facing journey is CREATE → CURATE → CREATIVE STUDIO → EXPERIENCE. Curate Hub is derived from live canonical records (no `UniverseProjectState` table, no Zustand). Create Work completion continues in Curate. Creative Studio is presentation language for the existing `/authority/universes/{id}` Suite. No minting, no NLE timeline, no Three.js, no migration. Fresh browser Create Work upload remains **not proven**.
- Stage 4.3: Curate no longer stacks Hub + incoming + forms + Sentinel on one page. Occupied work uses `/authority/curate/{id}` child routes. `?universe=` redirects. Bound `?asset=` stays on the incoming catalogue. Scene creation remains Curate Sentinel, not Studio. No new ontology, no migration.
- Stage 4.4 (2026-09-14): Publishing journey hardening. Mural-only work (Father Raymond) can establish Scenes from Curate Sentinel with curator-named structure (Intro/Verse/Hook) and adjustable times. Storyboard Authorise stays PATCH-only. Public Universe stages mural Mux. Public footer is real. Distribution readiness is a checklist, not YouTube/Spotify adapters. Sentinel still does not auto-create Scenes. Super Hero Ego windows unchanged. Hub source media opens `/authority/media/{assetId}` (ISRC / Replace media), not `/authority/{assetId}`. Public Scene Deck CTAs stay hidden until Scenes exist.
- Stage 4.5 (2026-09-14): Scene authoring is constant — identity, timing, and still on every Scene object (Studio list + focused Scene). Gallery pick reuses ingested media on attach/replace. Public Scene Deck scrolling actually moves; many Scenes default to grid. Storyboard tabs share one height with a derived SCRIPT→PANELS→STILLS→MOTION path. Holographic cinema no longer paints a dark second screen over Mux. Super Hero Ego windows unchanged. Duplicate Father Raymond Intro stays on Universe `91027ced…` until an explicit reparent.
- Curate Studio Sentinel remains universe-scoped evidence UI. Asset-level Inspect answers what is in this media; Universe-scoped Sentinel answers what evidence helps understand it in a Universe. They are not merged.
- Stage 4.6 (2026-09-16): Storyboard source stills use the Mux representative poster when no timestamp is set. Sentinel stays observational. Generation labels are requested / running / succeeded / failed / unavailable. Studio CTAs are 2.5D Experience and Holographic Experience. Public audience CTAs stay Enter Experience. Super Hero Ego windows unchanged. No schema migration.
- Stage 4.7 (2026-09-16): Sentinel cinematic evidence (timing, shot, camera, subjects, motion, environment, transition, storyline, confidence) is stored in `inspection_session.parameters.cinematic` and storyboard `media_intake` provenance. Selecting a shot is durable Storyboard state (`storyboard-selection`). Use as Reference / bulk add de-dupes playback+time. Creator edits lock panel fields without erasing `generation_metadata.sentinel_observation`. Gemini uses sampled Mux frames, not full video-file ingest; otherwise sampled-fallback is labeled. ffmpeg ENOENT is operator-copy plus technical details. Judas Mux `hqGacPkUZZuWiTu4kl9DZQx56IutFzfnXnsgDr1LHEM` remains the Storyboard source when attached. Super Hero Ego is not mutated. `creates_scene = false`. No schema migration.
- Stage 4.8 (2026-09-16): Creative Studio interaction is Context → Work → Directive on the existing Storyboard ontology. `delete-work` actually DELETEs `storyboard_work` (panels/jobs cascade) and work-owned `media_intake` provenance; canonical Universe/Mural/Scene/Creative Moment/Experience are untouched. `/studio` lists each Universe once plus standalone work by `work_id`. Public Universe entry CTA is **Enter 2.5D** (`/worlds/{id}`); holographic destination language is **Holographic Experience**. Super Hero Ego windows unchanged. No schema migration.

---

## 10. HOW TO SELECT WORK

Ask: **What is the next missing capability in the journey from canonical creative truth to compelling Experience?**

Do not select work merely because an editor, table, or screen is missing.
Do not implement `.mighty-verse/06-product-vision.md` as one giant task.

Priority:
1. Close a genuine user/product gap
2. Advance the canonical creative workflow
3. Increase reusable capability
4. Improve Experience consequences

Inspect existing code, data, routes, APIs, tests, and UI first.
Reuse before duplicating. No speculative migrations, frameworks, AI platforms, or 2.5D engines.

No-go unless specifically selected: full Mural/Scene/Creative Moment editors, public-user curation, publication redesign, rights system, AI generation, timeline/Experience redesign, Three.js holographic engines, commerce/NFT, unrelated refactors.

---

## 11. DEVELOPMENT PROTOCOL

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

# Browser smoke (Chrome, against the running app — see §12)
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

## 12. BROWSER QA PRINCIPLE

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

### Holographic cinema (Mux WebGL1)

Do not use screenshots to prove orientation or audio/lyric sync. Chrome smoke
`qa/browser/smoke/holographic-playback.smoke.ts` is the proof path:

- luma-row correlation of Mux `<video>` vs the theater canvas (upright)
- `data-holographic-flip-y=false`, `data-holographic-parallax=0.75`, `data-holographic-overlays=none`, `data-holographic-cinema-fill=1`
- cursor left/right stereo pan
- `texSubImage2D` in-place uploads (`data-holographic-tex-path=subimage`); paused Mux clock holds while rAF continues

Same compositor serves Studio preview and the public holographic Experience.

Canonical public Universe/Mural pages are `/worlds/{masterId}`. `/universes/{masterId}` is not a route.

---

## 13. CRITICAL INVARIANTS FOR AGENTS

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

## 14. DEVELOPMENT ENVIRONMENT

Primary development is **Cursor** against this GitHub repository (`origin`).
Canonical default branch is `main`. Chrome is the primary browser QA client.

Production origin is `https://mightyverse.goldenshovel.co.za`. Do not send
Supabase magic-link redirects to the retired Vercel production alias
(`DEPLOYMENT_NOT_FOUND`). Mux and Gemini API keys live in Vercel env;
do not commit them.

The canonical project instructions live in this file and `.mighty-verse/`.
They do not depend on conversation memory or the retired Codespaces/`source` remote workflow.

A new agent starting work on this repository should:
1. Read this file
2. Read `.mighty-verse/06-product-vision.md` for the product operating constitution
3. Read `.mighty-verse/05-architecture.md` for deep constitutional context
4. Run `git log --oneline -10` to understand recent work
5. Query live Supabase to verify current data state
6. Run `npm test` and `npm run test:qa:browser` to confirm baseline

The repository is self-documenting. Do not rely on external conversation history.
