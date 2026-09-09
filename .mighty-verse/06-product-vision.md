# 06 — PRODUCT VISION

SOURCE: founder transfer 2026-09-08
CANONICAL: yes
CHECKPOINT: `7c6953ad3cd9daf2abf4d93108652b2e875a97ff`

This is the product operating constitution for Mighty Verse Reimagined.
It governs how future increments are chosen and built.
It does **not** authorize building the whole future in one task.

The human founder remains the ultimate product decision-maker.

---

## One sentence

`SOURCE` Mighty Verse is a truth-preserving creative universe engine.

It transforms canonical audiovisual works into curated, composable, animated and eventually immersive experiences while preserving identity, provenance, authority, contributor relationships, source relationships, canonical timing, media lineage, ownership boundaries, and creative meaning.

It is not merely a video player, CMS, NFT platform, media asset manager, storyboard tool, or AI creative tool.
It is the system that connects those concerns around a canonical creative truth model.

---

## Product journey

`CANONICAL` (2026-09-08)

These are product modes, not merely routes:

```
DISCOVER → REVEAL → ASSEMBLE / CURATE → EXPERIENCE
```

**Discover** — the audience understands that a work exists (Universes, creators, Murals, Scenes, Creative Moments, stories, visual material) before being asked to manipulate it.

**Reveal** — progressive understanding: what this is, who contributed, where a moment belongs, what larger work it belongs to, what happens before and after.

**Assemble / Curate** — the creative operating environment (Curate Studio + Creative Suite). Authorized assembly of canonical creative truth into a coherent experience. Not merely metadata editing.

**Experience** — audience-facing result. Consumes canonical/projection data. Must not silently redefine canonical truth.

---

## Two worlds

`CANONICAL` (2026-09-08)

**Canonical creative world** — what the work actually is.

**Experience world** — how the work is presented, explored, animated, consumed.

The second is derived from the first. Experience must not silently become the source of truth.

---

## Canonical ontology

`CANONICAL` (2026-09-08)

```
UNIVERSE
  ├── MURAL
  ├── SCENES
  └── CREATIVE MOMENTS
           └── related to Scenes through scene_moment
```

This is **not** a simple ownership tree.

**Universe** — canonical top-level creative work. Primary creative identity. Container of canonical meaning. Everything else resolves back to the Universe. (Earlier canon: Song / World.)

**Mural** — complete audiovisual expression of the Universe. Not “the video file.” Related to audiovisual expression, editorial structure, Scenes, media realization, and playback. **Mural does not own Scenes.** Scenes are a first-class creative capability.

**Scenes** — canonical visual/spatial units. Identity, timing, ordering, visual/spatial meaning, relationships to Creative Moments, media realization/projection. Canonical timing is structure, not decoration. Live Super Hero Ego:

| Scene | Timing |
|---|---|
| Powerhouse | 36,000–79,000 ms |
| Dark Knight | 80,000–124,000 ms |
| Hand-to-Hand | 149,000–192,000 ms |
| Sword Master | 193,000–254,000 ms |

**Creative Moments** — contributor-centred canonical units, parented to the Universe, **not owned by the Mural**. A Creative Moment may appear in multiple Scenes. Proverb on both Powerhouse and Hand-to-Hand is valid `scene_moment` data. Do not “deduplicate” it.

**Moment Cards** — Experience representations of Creative Moments.

```
CREATIVE MOMENT ≠ MOMENT CARD
```

A Creative Moment may exist without a Card. Do not turn the Card into the canonical object.

---

## Projection

`CANONICAL` (2026-09-08, consistent with 2026-08-17)

```
CANONICAL SOURCE → PROJECTION → EXPERIENCE
```

A projection answers “how is this canonical thing being presented here?” without changing “what is the canonical thing?”

Mighty Verse can evolve Experience without rewriting canonical truth.

---

## Media is not creative truth

`CANONICAL` (2026-09-08)

```
MEDIA ≠ CREATIVE WORK
```

A media asset is a technical realization. Uploading MP4/MOV/image/audio does not create a Universe, Mural, Scene, Creative Moment, canonical meaning, or publication authority.

Long-term bridge:

```
CANONICAL CREATIVE STRUCTURE
        ↓
  MEDIA REALIZATION
        ↓
    MEDIA ASSET
        ↓
    PROJECTION
        ↓
    EXPERIENCE
```

Asset = what digital media exists.
Realization = how media realizes a canonical object.
Projection = how that object is represented in this experience.

---

## Upload → Experience lifecycle

`SOURCE` (2026-09-08, long-term model — not every upload follows it immediately)

```
UPLOAD → MEDIA INTAKE → PROCESSING → SENTINEL / INSPECTION
  → MEDIA UNDERSTOOD → CURATE STUDIO → CANONICAL CREATIVE ASSOCIATION
  → CREATIVE SUITE
       UNIVERSE { Identity, Mural, Scenes, Creative Moments }
  → MEDIA REALIZATION → PROJECTIONS → PUBLICATION → EXPERIENCE
```

---

## Roles that must not collapse

`CANONICAL` (2026-09-08)

| Role | Responsibility |
|---|---|
| **Sentinel** | Verifies / observes (technical validity, media characteristics, frame/time evidence, candidate boundaries). Does **not** decide Universe, Mural, Scene meaning, contributor, Creative Moment meaning, publication, or canonical authority. |
| **Curator** | Interprets / assembles |
| **Authority** | Authorizes (authentication, authorization, governance, canonical control, publishing, privileged operations). Determines **who** may perform an operation. Not synonymous with Curate. |
| **Experience** | Presents |
| **AI** | Downstream of truth. May propose. Must not become canonical. `AI PROPOSAL ≠ CANONICAL TRUTH`. Preserve evidence and provenance when AI contributes. |

**Curate Studio** (`/authority/curate`) — doorway from “media has arrived” to “I understand it” to “I am assembling a canonical work.” Not merely upload, Sentinel, or an admin dashboard.

**Creative Suite** — canonical assembly environment: Identity, Mural, Scenes, Creative Moments, plus long-term relationships, ordering, timing, media realization, eventual publication. Curate owns the suite; not every operation belongs on `/authority/curate`.

```
SHARED CURATION CAPABILITY
        +
EXPRESSION-SPECIFIC AUTHORIZATION
```

A future public creator may curate their own Universe. That does not grant canonical Authority over another’s work, publication, rights-management, moderation, or governance.

---

## Experience language (future, not a build ticket)

`SOURCE` (2026-09-08)

- A person should be able to understand a work quickly: Universe, Mural, Scenes, contributors, Creative Moments, what they are experiencing. This is a quality objective, not permission to add onboarding screens now.
- Cards are Experience language. Facedown/rearranged/revealed/animated cards must not silently become new canonical entities.
- Three timeline concepts remain distinct even if they share canonical timing: **canonical/editorial (Mural)**, **Experience through time**, **Scene Deck**. Do not collapse them.
- Scene boundaries: proposal → review → canonical Scene. Automated detection must not silently create canonical Scenes.
- 2.5D / immersive presentation is the long-term Experience direction. It comes **after** canonical model, curation tools, and projections are trustworthy.

Mighty Verse is not a CRUD app. Prefer implementations that make canonical creative relationships understandable.

When choosing between a quick local feature and a reusable capability that preserves the correct ontology, prefer the latter. Do not build speculative abstractions merely because they sound elegant.

---

## Curator's mental model

`SOURCE` (2026-09-08)

The curator should eventually think:

- I have a creative Universe.
- Here is its audiovisual Mural.
- These are its Scenes.
- These contributors created these Moments.
- These moments appear in these Scenes.
- This media realizes this part of the work.
- This projection presents it this way.
- This is how the audience experiences it.

The UI should communicate those relationships, not a table → edit → save loop.

Every curation capability should eventually answer how it improves what someone can experience (Scene timing → Scene Deck, Creative Moment → Moment Card, media realization → playback, projection → Experience representation). The Experience consequence does not have to be implemented in the same increment, but the relationship must be understood.

---

## Provenance is first-class

`CANONICAL` (2026-09-08)

Mighty Verse must remain able to answer:

- Where did this come from?
- Who created it?
- What canonical work does it belong to?
- What Scene does it belong to?
- What media realizes it?
- What projection presents it?
- Who has authority over it?
- What was proposed automatically versus canonically accepted?

Cards, projections, ownership, collection, playback, and public interaction must not confer canonical Authority.

---

## Modularisation is permanent

`CANONICAL` (2026-09-08)

Every genuine reusable capability is separated from its expression-specific authorization.

**Shared:** Universe assembly, Creative Suite, identity editing, Mural presentation, Scene model, Creative Moment model, media inspection model, curation context, projection concepts.

**Authority-specific:** privileged mutations, governance, publication, authority authentication, protected operations.

**Experience-specific:** playback, public navigation, Moment Cards, Scene Deck, public timeline, immersive presentation.

Do not duplicate shared capabilities merely because the first implementation is inside Authority.

---

## How to select future work

`CANONICAL` (2026-09-08)

Do not select the next stage merely because “the next editor has not been built.”

Ask: **What is the next missing capability in the journey from canonical creative truth to compelling Experience?**

For every proposed increment:

1. What user problem does this solve?
2. Which part of DISCOVER → REVEAL → ASSEMBLE → EXPERIENCE does it improve?
3. Which canonical object does it affect?
4. Is this canonical truth, realization, projection, or Experience?
5. Does the capability already exist? Can we reuse it?
6. Does it create a new authority boundary?
7. Does it preserve provenance and existing relationships?
8. Does it improve the path from media to creative work to Experience?
9. Does it close a real gap and unlock subsequent capability?

Priority: close a genuine gap → advance canonical creative workflow → increase reusable capability → improve Experience consequences.

Reuse before duplicating. Improve the existing product. Do not create parallel systems. Do not over-architect (no speculative workflow engines, unused abstraction factories, premature AI / 2.5D / rights platforms).

---

## No-go unless specifically selected

`CANONICAL` (2026-09-08)

Do not implement merely because it appears in this vision:

- full Mural cinematic editor
- complete Scene editor
- complete Creative Moment editor
- public-user curation
- publication redesign
- rights-management system
- AI generation platform
- timeline redesign
- Experience redesign
- 2.5D / holographic engine
- commerce / NFT / tokenomics
- unrelated refactoring

Commerce and collection are downstream of creative truth. They must not rewrite canonical creative authority. Cards, projections, ownership, collection, playback, and public interaction must not confer Authority.

---

## North star

A creator brings a real audiovisual work into Mighty Verse.
The system understands the media without pretending media is creative truth.
Sentinel provides evidence.
The curator enters Curate Studio and assembles the canonical Universe.
The Universe gains its Mural; Scenes structure it; contributors become Creative Moments related to Scenes.
Media becomes realization rather than identity.
Projections translate canonical truth into Experience.
The audience discovers, reveals, and experiences it.
The creative truth remains traceable throughout.

That is Mighty Verse.

---

## Live reference

Universe `05ccc0c6-75f9-4864-b0c1-af5e36bf45cc` Super Hero Ego
Mural `a75ae8af-7b48-4b67-8392-d89447bae370`
Scenes: Powerhouse, Dark Knight, Hand-to-Hand, Sword Master
Creative Moments: Proverb, Mothipa, Reason
Mux asset `795c057e-2967-4e93-8f5e-06297c674cb0`

Do not invent fake Universes or relationships to demonstrate functionality.

---

## Checkpoint evaluation (Stage 2.5)

`CANONICAL` (2026-09-08, product review — not an implementation ticket)

Verified checkpoint: `7c6953ad3cd9daf2abf4d93108652b2e875a97ff`

**What Stage 2.5 unlocked:** Curate Studio is the doorway from incoming media / Sentinel into Creative Suite. Associated media can move Curate Studio → Creative Suite. Identity is a live editor. Public EXPERIENCE (Universe, Mural, Scene Deck, Moments, Mux) remains functional.

**What remains a product question, not an automatic ticket:**

1. **Unbound inspected media → existing Universe.** The gateway can *show* “not associated.” It cannot yet complete association as an explicit Curate Studio action. Existing `POST /api/authority/media` already binds an asset to a **projection** (typically the Mural), timing-preserving. Association currently requires an existing Mural projection. A Universe without a Mural cannot use this API without a separate mural create. Do not auto-create Universes from uploads. Do not populate `media_realization` without the ISRC/rights product decision.

2. **Sentinel UI persistence.** Browser inspection is ephemeral. `POST /api/authority/media/inspect` exists. Wiring it is a provenance-quality improvement, not the highest-value journey gap.

**Highest-value next increment (if selected):** explicit Curate Studio association of inspected media to an **existing** Universe by reusing `POST /api/authority/media` against that Universe’s Mural projection. This closes the media → work path and advances ASSEMBLE / CURATE without a new ontology, migration, or editor.

**Must not be touched from this checkpoint unless a later review selects them:** full Mural/Scene/Creative Moment editors, public-user curation, publication redesign, rights, AI, timeline/Experience redesign, 2.5D, commerce/NFT, unrelated refactors.

---

## Checkpoint evaluation (Stage 2.6)

`CANONICAL` (2026-09-08)

Starting checkpoint: `94a7a89cf133bf80515775b355dd03bafaaab457`

Curate Studio now performs explicit association of playable unbound media to an existing Universe. The mutation reuses `POST /api/authority/media`. The server resolves the Universe’s existing Mural projection. Occupied Murals are not replaced. Universes without a Mural are blocked. No Universe, Mural, Scene, Creative Moment, projection, or `media_realization` is created.

Sentinel persist remains deferred: `POST /api/authority/media/inspect` requires a `master_id`, which unbound media does not have.

**Do not automatically begin** a Mural editor, Scene editor, Creative Moment editor, public curation, publication, rights, timeline redesign, AI, 2.5D, or commerce. Evaluate the next missing capability in the journey.

---

## Checkpoint evaluation (Stage 2.7)

`CANONICAL` (2026-09-08)

Starting checkpoint: `3caaf65440f5c1c1b1588b137fd35eb3e286b60e`

Stage 2.6 made a real dead-end visible: a Universe without a Mural cannot receive playable media because association requires an existing Mural projection. Candidate B (Sentinel persist for unbound media) does not close that dead-end and would invent authority semantics (`inspect` currently requires `master_id`). Candidate A reuses the existing Create Work operations without the media step.

A curator can now register a Mural for an existing Universe via `POST /api/authority/murals`. This is container registration, not a Mural editor and not media ingestion. Super Hero Ego is idempotent. `media_realization` stays empty. Sentinel remains evidence, not creative authority.

**Do not automatically begin** a Mural editor, Scene editor, Creative Moment editor, public curation, publication, rights, timeline redesign, AI, 2.5D, or commerce.

---

## Checkpoint evaluation (Stage 2.8)

`CANONICAL` (2026-09-08)

Starting checkpoint: `4363432cd92c4441c46fa734384b9cb0c268e8c3`

The missing capability after Gallery → Asset Record → Inspect was context continuity into Curate Studio, not a Gallery → Create Work handoff. Create Work remains the independent new-work wizard and still starts from `/authority/create`. MEDIA ≠ UNIVERSE.

Asset Record and Inspect now continue into the same Curate Studio with `?asset=`. Unbound playable media is already selected for Associate with Universe. Bound Super Hero Ego Mux media (`795c057e-2967-4e93-8f5e-06297c674cb0`) continues toward Creative Suite and is not offered a duplicate association. Client-supplied context cannot reassign a bound asset. No migration. Sentinel remains evidence: Inspect does not associate.

**Do not automatically begin** a Mural editor, Scene editor, Creative Moment editor, public curation, publication, rights, timeline redesign, AI, 2.5D, or commerce. Create Work completion still lands on the publishing record; changing that destination was not required for this handoff.

---

## Checkpoint evaluation (Stage 3.2)

`CANONICAL` (2026-09-08)

Starting checkpoint: `9d4d68da85a1f53fb9a2dda617ffedfa5f4e346a`

Stage 3.0 connected Creative Suite to Experience. Stage 3.1 found the next creative job: the curator can see who is present in which Scene but cannot author that relationship from Studio.

Stage 3.2 gives Creative Suite Add presence / Remove presence for existing Scenes and Creative Moments through `scene_moment`. Universe-scoped. No new ontology, no migration, no playback fabrication, no Scene Deck redesign. Proverb remains identity-only and shared across Powerhouse and Hand-to-Hand.

**Do not automatically begin** a Scene editor, Creative Moment editor, Mural editor, publish ontology, media realization, rights/ISRC, Scene Deck rewrite, Three.js holographic engines, AI classification, or commerce.

---

## Checkpoint evaluation (Stage 4.0)

`CANONICAL` (2026-09-09)

Creative Suite is a followable Studio production path. A curator can enter the dashboard, open Super Hero Ego, and see source media, Sentinel evidence, storyboard, animation planning, Scene proposals, authorisation, 2.5D Studio Preview, and Experience without knowing hidden routes. 2.5D remains a realization/preview of canonical composition. Public `/worlds/{id}/holographic` remains the audience Experience. No workflow-state table. No migration. No `media_realization`. Super Hero Ego stays four Scenes.

Pipeline: MEDIA → SENTINEL EVIDENCE → DERIVED INTELLIGENCE → HUMAN AUTHORISATION → CANONICAL TRUTH

**Do not automatically begin** a Scene creator, Mural editor, publish ontology, media realization, rights/ISRC, Scene Deck rewrite, Three.js engines, AI classification, or commerce.

---

## Checkpoint evaluation (Stage 4.1)

`CANONICAL` (2026-09-09)

Create Work processing is recovered from live Mux state via `media_upload_session`. A browser request timeout is not a processing failure. Retry resumes the existing canonical work. Curate associate/register continue into Inspect → Sentinel → Creative Suite. No migration. No job table. No Three.js. Super Hero Ego remains the regression reference.

**Do not automatically begin** a Scene creator, Mural editor, publish ontology, media realization, rights/ISRC, Scene Deck rewrite, Three.js engines, AI classification, or commerce.

