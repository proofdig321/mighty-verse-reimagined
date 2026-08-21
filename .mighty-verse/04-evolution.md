# 04 — EVOLUTION

The living record of decisions made, approaches rejected, and lessons learned.
This document grows as Mighty Verse Reimagined progresses.

---

## Implementation Steps

`CANONICAL` **Step 3 — Constitutionally-valid seed migration** (2026-08-19, complete)

Migration: `supabase/migrations/20260819050000_step3_seed.sql`

Canonical chain established:
- Participant (Golden Shovel) → IdentityLink (placeholder `seed:golden-shovel-v1`)
- AuthorityRecord (ultimate, platform scope, 7 capabilities)
- Master (song-world) + AttributionRecord
- AttributionEntry: original-artist public=true (I.1.B), director public=true (I.1.C)
- CanonicalState v1 (authorised) + ProvenanceRecord (canonical-revision, public=true, I.1.A)
- Projection (experiential) + ProvenanceRecord (projection, public=true, I.1.A)
- MediaAsset + DeliveryVariant (placeholder storage_ref/endpoint_ref — mutable per A12)
- ProjectionMediaBinding (primary, access_level=public)
- CanonicalOperationLog (4 entries)

`CANONICAL` **Integrity hash algorithm** (2026-08-19, first definition)

All `integrity_hash` fields on `canonical_state`, `provenance_record`, and `projection`
use the following algorithm. Step 4 (/authority) MUST use the same algorithm.

```
encode(digest(<jsonb_build_object with alphabetically ordered keys>::text, 'sha256'), 'hex')
```

Defining fields per entity:
- `canonical_state`: authorisation_state, authorised_by, master_id, parent_state_id, version
- `provenance_record`: authorised_by, relationship_type, source_id, source_type, subject_id, subject_type
- `projection`: canonical_state_id, collectible_designated, created_by, master_id, projection_type

All 4 hashes independently verified (stored = recomputed).

`OPEN QUESTION` **Media placeholder replacement** — The seed MediaAsset has
`storage_ref = 'seed:placeholder:golden-shovel-world-v1'` and
`endpoint_ref = 'seed:placeholder:golden-shovel-world-v1'`. These must be replaced
by calling `ingestLivepeerAsset()` once a real asset is uploaded to Livepeer.
The `/worlds/[masterId]` surface must handle the placeholder gracefully until replaced.

`CANONICAL` **Step 16 — Vercel staging deployment** (2026-08-19, complete)

- Vercel project created and linked: `proofdig321s-projects/mighty-verse-reimagined`
- All environment variables pushed to Vercel preview and production environments
- Build succeeded: Next.js 16.3.1 / Turbopack, 10 routes, TypeScript clean
- Staging URL: https://mighty-verse-reimagined.vercel.app (HTTP 200 verified)
- Inspection URL: https://vercel.com/proofdig321s-projects/mighty-verse-reimagined
- `.gitignore` corrected: `.env.local`, `.env*.local`, `.next`, `tsconfig.tsbuildinfo` now ignored
- `.env.local.example` sanitised: all values empty, no real credentials in source control
- Supabase Auth redirect URLs: not yet updated — must be done before auth flows are tested

`OPEN QUESTION` **Supabase Auth redirect URLs** — The Supabase project's allowed redirect URLs
must include the staging domain (`https://mighty-verse-reimagined.vercel.app/auth/callback`)
before sign-in flows can be tested against the deployed app. This is a manual step in the
Supabase dashboard (Authentication → URL Configuration).

---

## Architectural Decisions

`ARCHITECTURAL DECISION` **South African primary audience** (2026-08-19, founder-established)
Mighty Verse is South African based and targets a South African primary audience.
This has not been previously recorded and must inform product, payment, and distribution decisions.

`TECHNICAL DEBT` **Stripe payment integration deferred** (2026-08-19)
Stripe is the A14-selected payment provider. However, Stripe's South African availability,
ZAR currency support, and local payment method coverage (EFT, Ozow, PayFast, etc.) have not
been evaluated against the SA primary audience requirement. Step 15 (Stripe) is deferred until
the payment provider decision is revisited with SA context. The economic engine (Step 11),
settlement state machine (A8), and SettlementRecord schema are payment-provider-agnostic and
remain in place. No implementation work is blocked by this deferral.

`OPEN QUESTION` **Payment provider for SA audience** — Stripe supports ZAR and has SA presence,
but local alternatives (PayFast, Peach Payments, Ozow) may be more appropriate for the primary
audience. This must be a founder decision before Step 15 is implemented.

`CANONICAL` **Phase 5 — Product Definition** (2026-08-19, founder-established)

Phase 5 is now closed. The following product-definition decisions are approved and canonical.

**Operating model:**
- Founder + ChatGPT: product decisions, UX priorities, product experience, unresolved policy decisions
- mighty-verse agent: constitutional interpretation, domain architecture, backend/application implementation, validation
- shadcn/ui MCP: UI component discovery and API correctness only — not a product-definition agent

**V1 product surfaces (approved):**

| Surface | V1 | Auth required | Authority required |
|---|---|---|---|
| `/` — universe discovery | ✅ | No | No |
| `/worlds/[masterId]` — World/Mural media experience | ✅ | No (public); Yes (gated) | No |
| `/moments/[projectionId]` — Creative Moment/Card | ✅ | No (public); Yes (gated) | No |
| `/auth/sign-in` + `/auth/callback` | ✅ already built | — | — |
| `/profile` — minimal participant identity | ✅ minimal | Yes | No |
| `/authority` — canonical lifecycle (V1 minimum) | ✅ | Yes | AuthorityRecord |
| `/collect/[collectibleId]` | ❌ post-V1 | — | — |
| `/studio/*` | ❌ post-V1 | — | — |

**V1 authority operations (minimum lifecycle only):**
- Register a Master
- Advance canonical state
- Create/authorise a Projection
- Attach/verify projection media (ProjectionMediaBinding)
- Designate a Collectible

Economic corrections, delegation UI, revocation UI, interpretation authorisation: post-V1.

**I.1 — Public provenance defaults** (2026-08-19, founder-established)

A. `provenance_record.public = true` by default for authorised projections: **YES**
B. `attribution_entry.public = true` by default for canonical creators: **YES**
C. Director attribution public by default: **YES**

Product principle: for publicly presented canonical work, legitimate provenance and creative
authorship should be publicly verifiable. This aligns with the constitutional provenance and
attribution principles in A2 and 03-principles.

Implementation consequence: API routes serving public surfaces filter provenance and attribution
on `public = true`. Seed data and all subsequent canonical data created through `/authority`
must set `public = true` on provenance records for authorised projections and on attribution
entries for canonical creators and Directors. This is a data policy, not a schema change.

**I.2 — Seed data strategy** (2026-08-19, founder-established)

**B — First canonical data seeded directly into Supabase before public surfaces are implemented.**

This is a product/testing decision, not permission to bypass the constitutional model.

Seed constraints (constitutionally mandatory):
- AuthorityRecord for Golden Shovel must be established first (FK dependency for all canonical ops)
- Valid Master → CanonicalState → Projection → MediaBinding lineage required
- Provenance integrity must be maintained (provenance_record per canonical entity)
- integrity_hash fields must be correctly computed
- Real Golden Shovel Auth identity used where required; no invented participant identity
- `provenance_record.public = true` and `attribution_entry.public = true` per I.1 decision
- Seed does not weaken or bypass A11 AuthorityRecord rules for subsequent operations
- Seed exists so V1 product surfaces can be developed against real canonical content
- `/authority` application workflow remains the authorised path for all subsequent canonical operations

**Practical constraint:** The seed migration requires the real Supabase Auth `user_id` for
Golden Shovel's account. This user_id must be known at seed time. If not yet known, the seed
uses a placeholder participant record that is linked to the real Auth identity on first login
via the existing IdentityLink mechanism (A13). This does not bypass A11 — it uses the
constitutionally-defined identity model correctly.

---


Mighty Verse Reimagined operates with its own `.amazonq/` project context on the shared EC2
instance. The `--agent mighty-verse` flag with `useLegacyMcpJson: false` ensures Platform Core
MCP servers are not loaded in Mighty Verse sessions. The global `~/.aws/amazonq/mcp.json` is
not modified.

`ARCHITECTURAL DECISION` **Constitution-first approach** (2026-08-17)
The Master MCP / Constitution is established before any application code, database schema, or
technology selection. Implementation follows constitutional clarity, not the reverse.

`ARCHITECTURAL DECISION` **`.mighty-verse/` as constitutional home** (2026-08-17)
The authoritative project context lives in `.mighty-verse/` at the repository root, separate
from the Q agent configuration in `.amazonq/`.

## Operational Architecture

`CANONICAL` **AI-led implementation constraint** (2026-08-17, founder-established)

Q (Amazon Q Developer) is the primary implementation operator for Mighty Verse. Q is expected to perform essentially all implementation and infrastructure work required by the approved architecture, including: application implementation; Supabase project configuration; database schema, migrations, RLS, functions, storage, and auth configuration; third-party integrations; MCP configuration; environment/configuration setup; Web3 configuration and contract deployment; deployment configuration and execution; testing and validation; architectural verification; and subsequent migrations and maintenance.

**Founder involvement** is limited to the minimum external secrets, credentials, approvals, or values that Q cannot legitimately obtain or create itself — such as required API keys, Supabase credentials where access cannot otherwise be established, third-party account credentials, domain/DNS credentials, payment-provider credentials, deployment credentials, and explicit human approval for irreversible external actions.

**Credential boundary:** Secrets must never be invented, guessed, exposed unnecessarily, committed to source control, or written into client-side code. Q must determine exactly which credential is missing, complete everything else independently, request only the minimum required value, configure it in the appropriate secure environment, validate the integration, and continue without unnecessary interruption.

**Supabase operational authority:** Q is authorised to perform the full Supabase implementation sequence — project → schema → migrations → RLS → functions → storage → auth → seed/configuration → validation — rather than generating migration files for the founder to execute manually. The one-Supabase-project-per-app constraint remains mandatory.

**Deployment operational authority:** Q treats deployment as part of implementation. Where credentials/access permit, Q executes: code → configuration → build → deployment → verification. The founder must not be asked to manually copy/paste deployment steps that Q can perform itself.

**Safety boundary:** This operational authority does not give Q authority to bypass the constitution. Q must still respect AuthorityRecord, canonical-state immutability, provenance, ownership separation, economic-history preservation, Web2/Web3 separation, versioned economic rules, append-only corrections, privacy boundaries, and the seven-layer architecture. Technical access is not equivalent to canonical authority.

Before destructive, irreversible, financial, production, or externally visible operations, Q must identify the action and obtain the minimum required human approval where appropriate.

---

## Phase Model

`CANONICAL` **V2 development phases** (2026-08-17, founder-established)

| Phase | Name | Status |
|---|---|---|
| 0 | Constitutional Ingestion | ✅ COMPLETE |
| 1 | Canonical Ontology / Domain Definition | ✅ COMPLETE |
| 2 | Experience and Participant Model | ✅ COMPLETE |
| 3 | Rights, Provenance and Authority | ✅ COMPLETE |
| 4 | Economic / Ownership Model | ✅ COMPLETE |
| 5 | Product Definition | skipped → deferred |
| 6 | Technical Architecture | ✅ COMPLETE |
| — | Implementation | ← IN PROGRESS |

Phase 6 stays locked until the preceding domain decisions are sufficiently mature.
Q does not make domain decisions. Q records founder decisions.

---



`CANONICAL` **Mighty Verse as canonical source** (2026-08-17, founder-verified)
Mighty Verse is the canonical source. Experiences, media, ownership mechanisms, and distribution
channels are projections of that source. This is the most important architectural idea to preserve
and must not be violated by implementation convenience.

---

## Path Decision — Missing V1 Source Material

`OPEN QUESTION` The original V1 source deck/material has not been ingested. It apparently contained:
- the three interpretation style names and definitions
- audience role taxonomy
- artist experience model
- parts of the economic model
- parts of the Web3 model

Two legitimate paths exist:
1. Recover the original V1 source material and ingest it before defining those areas.
2. Explicitly establish new V2 decisions, knowing they are new decisions rather than recovered canon.

Q must not fill these gaps itself. The path must be chosen by the founder.

---



`HISTORICAL / REJECTED` V1 Supabase schema — must not become V2 architecture.
`HISTORICAL / REJECTED` V1 smart contracts and ThirdWeb as a specific dependency.
`HISTORICAL / REJECTED` V1 agent taxonomy and MCP implementation.
`HISTORICAL / REJECTED` V1 URL structure and component names.
`HISTORICAL / REJECTED` V1 JSON/disconnected processing pipeline pattern.
`HISTORICAL / REJECTED` Specific V1 AI tools (MiDaS, SAM, CLIP) as requirements.
`HISTORICAL / REJECTED` V1 tuning constants.
`HISTORICAL / REJECTED` V1 dual dashboards.
`HISTORICAL / REJECTED` The disconnected upload → mural pipeline pattern.

---

## Lessons From V1

`LESSON` The animation was not actually playing in V1. The real processing path was never properly connected.

`LESSON` The upload → mural pipeline was disconnected. Content could be uploaded but the path to a complete rendered Mural was not operational.

`LESSON` The JSON/disconnected processing pipeline created fragility and made it impossible to trace the state of any given piece of content through the system.

`LESSON` Dual dashboards created confusion about where canonical state lived and who had authority over it.

`LESSON` V1 agent taxonomy was not constitutionally grounded. Agents were built around implementation concerns rather than canonical meaning. This is the origin of the Master MCP concept for V2.

`LESSON` Context loss is architecture debt, not merely documentation debt. When the constitutional meaning of Mighty Verse is not encoded in the system, implementation drift occurs. V1 demonstrated this.

---

## Open Questions Log

The following questions are unresolved and must not be answered by assumption:

- Full scope of Golden Shovel's universe (catalogue, collaborators, scale)
- Single-artist vs multi-artist platform
- Full taxonomy of creative units beyond Song / Mural / Card / Creative Moment / Interpretation
- The specific three interpretation style names and definitions
- Structural relationship between Song → World → Mural → Creative Moment → Interpretation
- What exactly constitutes a canonical World
- What makes something canonical vs a projection
- What can change without changing the underlying canonical work
- What belongs to the artist versus the audience versus collaborators
- What is a projection versus canonical state
- What does a person actually *do* inside this universe
- What must be attributable and preserved
- Which decisions are cultural/domain decisions and which are merely implementation choices
- What "navigable" means experientially
- Full audience role taxonomy
- Full artist experience model
- Rights, licensing, and royalty model
- Provenance enforcement mechanism
- Audience and access model (free, gated, purchased, earned)
- Web2/Web3 balance and sequencing
- Specific Web3 chain, contract standard, and token model for V2
- Open vs curated contribution model
- Product vs platform vs institution identity
- Public branding and product name
- V2 agent taxonomy and MCP architecture
- V2 processing pipeline architecture
- V2 database / persistence model
- V2 media delivery model

---

## Evolution Log

| Date | Event |
|---|---|
| 2026-08-17 | Repository created. Q environment isolated. Constitution structure established. |
| 2026-08-17 | V1 source material ingested. Evidence layer populated. Constitution documents updated with confirmed canonical information. |
| 2026-08-17 | Phase 1 — Canonical Ontology decisions established by founder. Song=World, canonical hierarchy, Master/projection boundary, and core ontology principle recorded. |
| 2026-08-17 | Phase 3 — Rights, Provenance and Authority closed. Six principle clusters established: Authority, Delegation, Attribution, Provenance, Rights, Integrity/Canonical Evolution. Canonical status ≠ rights ownership. Provenance applies to both Master and projections. Revision permitted; history non-erasable. Delegation scoped and revocable; revocation preserves lineage. |
| 2026-08-17 | Phase 4 — Economic / Ownership Model foundational decisions established by founder. Eight principles recorded: collectibles are projections not Masters; ownership attaches to authorised projection; ownership does not transfer authorship or canonical authority; ownership may confer additional access and recognition; meaningful free tier established (Discover → Experience → Participate → Collect → Deeper Access); Web3 supplementary not mandatory; Web2 and Web3 are different ownership rails for the same collectible model; collectible retains provenance to canonical state from which it was issued even after Master evolution. |
| 2026-08-17 | Phase 4A — Collectible object taxonomy established. Card, Creative Moment projection, Interpretation, Mural representation, Edition, and open future types defined. Separation of six economic concepts recorded (canonical authority, creative authorship, provenance, ownership, economic entitlement, access, Web3 representation). Economic provenance chain principle established. Four open questions raised: collectible designation, multiple collectibles per Creative Moment, Interpretation economic identity, collectible entitlement bundle. |
| 2026-08-17 | Phase 4A — Four founder decisions closed. Collectible designation: explicit Mighty Verse authorisation required, not automatic. Multiple collectibles per Creative Moment: yes, distinct objects with own identities and entitlement bundles. Interpretation economic identity: both projection and independent economic identity depending on creation/authorisation; Interpretation creator may have separable economic rights. Collectible entitlement bundle: defined rights bundle established; ownership does not automatically include authorship, canonical authority, Master ownership, or underlying IP rights. Collectible issuance principle recorded. |
| 2026-08-17 | Phase 4 — Platform economic model established. Mighty Verse is a media/cultural platform first; collectible economy is supplementary. Five economic channels recorded: consumption/advertising, collectible, creator, platform, Web3. Native advertising interface confirmed as part of free consumption experience. Revenue waterfall per channel and participant economics remain open (Phase 4B). |
| 2026-08-17 | Phase 4B — Revenue waterfall questions raised. Seven open questions recorded for founder decision: consumption/advertising participation; primary collectible revenue participation; secondary transfer economics; Interpretation creator economics; variable waterfalls by collectible type; collector economic participation; Mighty Verse platform share scope. No percentages assumed. Economic rules to be established before technical enforcement. |
| 2026-08-17 | Phase 4B — Seven founder decisions closed. Eight canonical principles recorded: consumption/advertising economics (work-attributed + platform-level pool); primary collectible revenue (provenance-traceable, variable by type); secondary transfer economics (optional per collectible, defined at issuance); Interpretation creator economics (independent economic identity, traceable to underlying Creative Moment); variable waterfalls by collectible type; collector economic participation (optional entitlement, not automatic); Mighty Verse platform share (participates as enabler, not as owner/author); attribution-aware economic model. No percentages, royalty rates, payment schedules, or technical mechanisms established. |
| 2026-08-17 | Phase 4C — Economic calculation and settlement questions raised. Eight open questions recorded for founder decision: calculation principles; participant entitlement resolution; waterfall configuration; primary vs secondary calculation; consumption/advertising settlement; settlement timing; economic history; disputes/corrections/reversals. |
| 2026-08-17 | Phase 4C — Eight founder decisions closed. Nine canonical principles recorded: layered/configurable calculation model; participant entitlement resolution (issuance-attached terms authoritative for collectibles; independent + sequential waterfall support); data-driven versioned waterfall configuration; separate primary/secondary waterfalls (issuance terms travel with collectible); consumption/advertising settlement (direct attribution where available; unattributed pool defaults to platform revenue); six-state settlement lifecycle; economic history (historically reproducible, rule-versioned); corrections as new events not silent amendments; economic engine principles (configurable, versioned, provenance-aware, attribution-aware, historically reproducible, correction-preserving). No technical implementation established. |
| 2026-08-17 | Phase 5 (Product Definition) deferred. Phase 6 (Technical Architecture) opened as current phase. 05-architecture.md created. Fourteen technical architecture open questions recorded (A1–A14): canonical state representation; provenance chain; collectible identity; economic rule representation; economic event model; primary/secondary economics; consumption/advertising economics; settlement lifecycle; corrections/reversals; Web2/Web3 boundary; canonical authority enforcement; media/projection delivery; identity/participant model; technology selection. Constitutional/economic model from Phases 1–4 established as immutable architectural constraints. |
| 2026-08-17 | Phase 6 — UI/Design System architecture established. shadcn/ui confirmed as foundational UI component system (architectural decision, not preference). Seven-layer architectural model recorded: Domain/Canonical, Economic, Identity, Media, Application, UI/Design System, Infrastructure. Layer separation mandatory; UI components must not become authoritative source of domain state. shadcn/ui MCP integration to be verified against official capability before implementation. A14 amended to treat shadcn/ui as established decision. |
| 2026-08-17 | Phase 6 — A1–A3 architectural decisions established. A1: versioned immutable canonical state lineage; Master as root identity; canonical states as immutable snapshots with parent references; projections as derived representations with immutable canonical_state_id; integrity_hash for independent verification. A2: append-only provenance graph; provenance records immutable once established; detachment prevention via referential integrity; provenance distinct from ownership. A3: collectible as distinct entity referencing projection/canonical state/provenance/ownership/economic terms; all issuance fields immutable; economic_rule_snapshot preserves terms at issuance; transfer history append-only; later waterfall changes cannot affect already-issued collectibles. |
| 2026-08-17 | Phase 6 — A4–A5 architectural decisions established. A4: WaterfallDefinition + WaterfallVersion as immutable versioned records; five-level rule attachment hierarchy with specificity precedence; issuance-attached rules always authoritative for collectibles; independent and sequential calculation modes explicitly supported; rule resolution algorithm defined; full reproducibility from event + waterfall_version_id + attribution_snapshot + economic_basis. A5: EconomicEvent + EconomicEntitlement + SettlementRecord as separate append-only records; attributed/unattributed distinction enforced; correction/reversal as new events referencing originals; six settlement states; settlement separate from economic event; all calculation inputs immutable once set. |
| 2026-08-17 | Phase 6 — A6–A7 architectural decisions established. A6: primary issuance always uses collectible's primary_waterfall_version (never platform default); secondary transfer always uses collectible's secondary_waterfall_version; OwnershipTransfer and secondary EconomicEvent are separate records; transfer never modifies canonical state, provenance, authorship, or issuance terms. A7: attributed/unattributed determination from source data (never fabricated); attributed = true requires valid master_id traceable through provenance; unattributed defaults to platform revenue; Interpretation consumption resolves both Interpretation-layer and Creative Moment-layer economics; future allocation rules are new WaterfallVersions, not rewrites of historical events. |
| 2026-08-17 | Phase 6 — A8–A10 architectural decisions established. A8: six-state settlement lifecycle formalised with explicit valid transitions; SettlementThresholdConfig as versioned configurable rule; SettlementRecord immutable after creation; Settled→Reversed only via correction event. A9: corrections are new EconomicEvents with correction_of/type/reason/basis; original records never deleted; only permitted mutation on original event is status→corrected/reversed; historical chain always reconstructable. A10: Web2-first/Web3-optional boundary established; Web2 authoritative for all canonical/provenance/identity/ownership/economic/access state; Web3 as optional representation/settlement rail; collectible identity direction is Mighty Verse record → web3_token_ref (not reverse); failure boundary defined; core platform requires no wallet. |
| 2026-08-17 | Phase 6 — A11–A13 architectural decisions established. A11: AuthorityRecord as first-class access-control entity; seven explicit capabilities; five-step validation on every canonical operation; revocation preserves historical lineage; ownership/attribution/economic entitlement/Web3 grant zero canonical capabilities. A12: five-entity media model (MediaAsset, ProjectionMediaBinding, DeliveryVariant, Projection, ConsumptionSignal); provenance resolved through entity chain not URL; ConsumptionSignals are evidence not automatic entitlements; attribution_confidence gates economic attribution. A13: Participant as stable internal identity; IdentityLink for external/wallet references (wallet is a link, not identity); ParticipantRole explicit and never inferred; AttributionRecord versioned with snapshots; four privacy levels; participant_id immutable regardless of external identity changes. |
| 2026-08-17 | Phase 6 — A14 Technology Selection completed. Stack: Next.js 16 + React + shadcn/ui + Tailwind (UI); Supabase/PostgreSQL (authoritative database, one project); Supabase Storage + IPFS/Pinata (media); Livepeer (video/streaming); n8n (automation); thirdweb v5.121.0 (Web3, selected after current-state investigation — materially different from V1); Base L2 (chain); ERC-721/ERC-1155 + OpenZeppelin v5 (contract standards); Supabase Auth + thirdweb in-app wallets (identity/auth); Stripe + thirdweb Pay (settlement); PostgreSQL FTS (search, initial); Vercel (deployment). shadcn/ui MCP verified: official built-in MCP server in shadcn CLI v4.18.0 via `npx shadcn mcp`, eight tools, requires components.json. Architecture contradiction check: all ten constitutional principles satisfied. 17 remaining unresolved items recorded. |
| 2026-08-17 | A14 accepted. Operational architecture constraint recorded: Q is the primary implementation operator. Founder involvement limited to minimum external secrets and irreversible-action approvals. Supabase and deployment operational authority granted to Q within constitutional boundaries. Implementation commenced. Dependency order: Supabase schema → AuthorityRecord → Participant/Identity → Master/CanonicalState/Provenance → Projection → Waterfalls → Next.js + shadcn/ui + MCP → Auth → Media/Livepeer → Collectible → Economic engine → ConsumptionSignal → n8n → thirdweb v5 → Stripe → Vercel. |

---

## Canonical Identity vs Expressive Composition

`CANONICAL` **Two-graph ontology** (2026-08-21, founder-established)

Mighty Verse distinguishes two separate graphs that must not be collapsed:

**Graph 1 — Canonical Identity**
Establishes what a work *is* and where its canonical identity belongs.
Governs: ownership, provenance, authority, integrity, attribution.

```
World (canonical source — the Song)
├── Mural (canonical entity — the complete visual expression)
└── Creative Moment (canonical entity — a meaningful unit)
      └── Interpretation (canonical entity — a new creative response)
```

Implemented via: `master.canonical_type`, `master.parent_master_id`, `canonical_state`, `provenance_record`, `attribution_entry`.

**Graph 2 — Expressive Composition**
Establishes how canonical works express, represent, interpret, or project one another.
Governs: creative relationships, contextual placement, expressive composition.

```
World ──[expressed-as]──► Mural
Mural ──[expresses]──► Creative Moment (contextually, without owning it)
Creative Moment ──[represented-as]──► Card (collectible)
Creative Moment ──[responded-to-by]──► Interpretation (new creative act)
Any canonical entity ──[projected-as]──► Projection (technical delivery)
```

Implemented via: `parent_master_id` (partial — canonical identity only), future `mural_moment_context` (expressive placement), `projection` (technical delivery).

`CANONICAL` **Four relationship vocabulary** (2026-08-21, founder-established)

Mighty Verse uses four distinct relationship types in the expressive composition graph:

| Relationship | Meaning |
|---|---|
| **Expression** | A canonical work expressed through another creative form (World → Mural) |
| **Representation** | A canonical work represented as a collectible/designated object (Moment → Card) |
| **Interpretation** | A new creative work responding to another canonical work (Moment → Interpretation) |
| **Projection** | A canonical state technically delivered or exhibited (any entity → Projection) |

These four words are now architectural vocabulary. They must not be collapsed into one another.

`CANONICAL` **parent_master_id is canonical identity, not expressive composition** (2026-08-21, founder-established)

`master.parent_master_id` answers: "What canonical World does this entity belong to?"

It does NOT answer: "How does this work appear within another creative expression?"

The eventual `mural_moment_context` relationship is the first concrete implementation of the expressive composition graph. It is not merely a join table — it carries the semantic meaning of the `expresses` relationship type.

`CANONICAL` **Registration and attribution are separate ontological acts** (2026-08-21, founder-established)

Registering a canonical entity (creating a `master` record) establishes canonical identity.
Attributing creative contribution is a separate, explicit act.
Granting operational authority is a further separate, explicit act.

These must not be collapsed. `registerMaster()` should establish canonical identity only.
Creative roles (Director, original-artist, collaborator) must be explicitly attributed, not defaulted.

This principle applies especially to Mural creation:
- A Mural's Director must be explicitly designated — not defaulted to the creating participant.
- A Mural does not have an `original-artist` in the same sense as a World — the Mural is an expression of the World, not an independent original work. Whether a Mural carries `original-artist` attribution requires an explicit product decision.

`OPEN QUESTION` **Mural attribution model** — Whether a Mural carries `original-artist` attribution (and if so, whose) is UNKNOWN / TO BE ESTABLISHED. The Mural is an expression of the World, not an independent original work. The Director is the creative authority over the Mural. Whether these are the same person, and whether `original-artist` is the right role type for the Mural, requires a founder decision before the first Mural is created.

`OPEN QUESTION` **Super Hero Ego Mural Director** — Whether Golden Shovel is the Director of the Super Hero Ego Mural is UNKNOWN / TO BE ESTABLISHED. Golden Shovel is the most plausible Director, but this must be explicitly confirmed by the founder before the Mural is created. The Director designation is a deliberate canonical act, not a default.

`OPEN QUESTION` **World projection vs Mural projection** — Once the Super Hero Ego Mural exists and has its own projection, the product must decide whether the World's experiential projection remains the primary public experience, or whether the Mural's projection becomes the primary experience. Both can coexist architecturally. This is a product navigation decision, not a schema decision.

`ARCHITECTURAL DECISION` **Mural title shares World title** (2026-08-21, founder-established)

The Mural's canonical title is the same as the World's title. "Super Hero Ego" is the name of the Song/World. The Mural, as the complete visual expression of that World, shares that name. The word "Mural" is the `canonical_type` designation, not part of the title. This follows directly from the V1 compound "Song / Mural" — the Song and its complete visual expression share the name of the creative work.

`ARCHITECTURAL DECISION` **Existing video is legitimately the Mural's media** (2026-08-21, founder-established)

The existing ~4:15 Livepeer video (`5a112ddzzuvlq3a5`, "Golden Shovel ft Proverb, Reason and Mothipa - Super Hero Ego") is the complete visual expression of Super Hero Ego. It is legitimately the Mural's media. The same asset can be bound to both the World's experiential projection and the Mural's experiential projection without either claim being false — they operate at different layers (canonical identity vs technical delivery). The World projection is not wrong; the Mural projection is an additional canonical record, not a replacement.

`ARCHITECTURAL DECISION` **Build 04 canonical Mural foundation is closed** (2026-08-21)

`master.parent_master_id` (nullable FK, song-world cannot have parent), `master_parent_type_check` CHECK constraint, and `enforce_mural_parent_type` trigger are in place. No Mural record has been created. The architecture is ready. Creation of the first Mural record is deferred until the attribution model is resolved and explicit product confirmation is received.

`CANONICAL` **Registration and attribution are separate canonical acts** (2026-08-21, founder-established)

`registerMaster()` establishes canonical identity only:
- `master` record
- `attribution_record` container (empty — no entries)
- `canonical_operation_log` entry

Creative roles are established by a separate explicit `addAttribution()` operation.
The system must never infer a creative role from the person who registered a canonical work.
Every attribution entry is an explicit canonical fact, not a default.

This applies retroactively as a principle. Existing World attribution entries were created correctly (Golden Shovel is the original-artist and director of the Super Hero Ego World). But the mechanism that created them automatically is now considered incorrect architecture and must be replaced.

`CANONICAL` **Super Hero Ego Mural — Director** (2026-08-21, founder-established)

Golden Shovel is the Director of the Super Hero Ego Mural.
This is an explicit product decision, not a deduction from the registration act.
`attribution_entry.role_type = 'director'` pointing to Golden Shovel's participant record.

`CANONICAL` **Super Hero Ego Mural — original-artist** (2026-08-21, founder-established)

No `original-artist` attribution is assigned to the Super Hero Ego Mural at this stage.
The Mural is the complete visual expression of the World. The World already carries the `original-artist` attribution for Golden Shovel. Whether the Mural carries a separate `original-artist` attribution — and if so, whose — is UNKNOWN / TO BE ESTABLISHED. This is correctly unresolved data, not missing data.

`CANONICAL` **Build 05 attribution decisions** (2026-08-21, founder-established)

| Item | Decision |
|---|---|
| Attribution architecture | Separate `addAttribution()` operation |
| Super Hero Ego Mural Director | Golden Shovel — explicitly designated |
| Mural `original-artist` | Not assigned — correctly unresolved |
| Mural title | "Super Hero Ego" |
| Mural media | Existing ~4:15 Livepeer video (`5a112ddzzuvlq3a5`) |
| World projection | Remains untouched and primary |
| Mural projection | Additional projection of the Mural canonical state |
| Creative Moments | Deferred |
| Mural-Moment context | Deferred |
| Rendition entity | No |
| Expression vocabulary | Conceptually established; no new table yet |

---

## Build 06 — Super Hero Ego Mural (2026-08-21, CLOSED)

`CANONICAL` **First real Mural instance** (2026-08-21, founder-established)

The Super Hero Ego Mural is the first canonical instance of the two-graph ontology in production.

**Canonical Identity Graph:**
```
Super Hero Ego World (song-world)
master_id: 05ccc0c6-75f9-4864-b0c1-af5e36bf45cc
│
└── Super Hero Ego Mural (mural)
    master_id: a75ae8af-7b48-4b67-8392-d89447bae370
    canonical_state_id: 8f7fe56d-0269-476d-b925-4567c461ee5e
    director: Golden Shovel (866390ff) — explicit canonical act
    original-artist: not assigned
```

**Experiential Delivery (two separate projection contexts, one underlying asset):**
```
World canonical state abe7b1c0
  └── World projection a66a93b6
        └── media asset bda79051 (Livepeer: 5a112ddzzuvlq3a5)

Mural canonical state 8f7fe56d
  └── Mural projection 2e68a8d6
        └── same media asset bda79051 (reused, not duplicated)
```

**Proven architectural result:** the same creative media participates in two legitimate projection contexts without collapsing the canonical identities. The World projection and Mural projection are distinct canonical records with distinct provenance, pointing to the same underlying delivery asset.

**Record IDs:**

| Record | ID |
|---|---|
| Mural master | `a75ae8af-7b48-4b67-8392-d89447bae370` |
| Mural canonical state | `8f7fe56d-0269-476d-b925-4567c461ee5e` |
| Mural projection | `2e68a8d6-6b15-4d16-a0d9-2ea290815f21` |
| Mural media binding | `17294363-9ac2-44c9-bbb5-0fe358b07f86` |
| Director attribution entry | `08455471-3108-4a61-b74e-0491314eb9c4` |
| Work presentation | `4c45bbf4-9a55-41ae-b1ee-627397bfeb9a` |
| Media asset reused | `bda79051-6bc9-497f-b0aa-12d95130290c` |

**Commit:** `bc46f2f`

**Integrity:** 15/15 checks passed. World canonical state and projection unchanged. TypeScript clean.

---

## Build 09 — Attribution Provenance Correction (2026-08-21, CLOSED)

`CANONICAL` **Registering authority ≠ creative contributor** (2026-08-21, founder-established)

`created_by` on a `master` record identifies the canonical authority that registered the work.
`attribution_entry.participant_id` identifies the creative contributor.
These must never be confused. The registering authority is not automatically the creative contributor.

`CANONICAL` **Build 09 correction** (2026-08-21)

Build 07 created the correct participant records for Proverb (`ed5949f1`), Reason (`5f74b13e`), and Mothipa (`d6ffdaa9`), but passed `GOLDEN_SHOVEL` as the `participantId` argument to `addAttribution()`. This caused all three `featured-artist` attribution entries to point to Golden Shovel (`866390ff`) instead of the actual featured artists.

Build 09 corrected the `participant_id` FK on the three existing `attribution_entry` rows by exact `entry_id`. No entries were created or deleted. No canonical states, projections, or media bindings were modified. Golden Shovel's World and Mural attribution entries are unchanged.

| Entry | Moment | Corrected from | Corrected to |
|---|---|---|---|
| `ccf2eba3` | Proverb | `866390ff` (Golden Shovel) | `ed5949f1` (Proverb) |
| `2937ae84` | Reason | `866390ff` (Golden Shovel) | `5f74b13e` (Reason) |
| `70c19369` | Mothipa | `866390ff` (Golden Shovel) | `d6ffdaa9` (Mothipa) |

This correction restores canonical provenance before any downstream Scene, collectible, or Interpretation work is built on top of these Creative Moments.

`CANONICAL` **Tokenization direction** (2026-08-21, founder-established)

Mighty Verse is intended to support progressively finer-grained canonical units. Future Scenes and other extractable units may be **derived/sliced directly from existing canonical works** (such as the original Mural), rather than necessarily being newly authored independent content. A Scene does not have to originate as newly authored application data — it may be a canonical extraction of an existing Master, with its provenance and source relationship preserved.

This distinction matters for the full canonical hierarchy:

```
Source
→ World / Mural / existing canonical work

Extracted canonical unit
→ Scene / visual element / character / object / Creative Moment

Interpretive layer
→ Interpretation of that unit

Projection
→ experiential representation

Collectible / token layer
→ economic / Web3 projection of the canonical unit
```

The Scene vocabulary decision (Creative Moment = canonical; Scene = contextual Mural appearance) remains in place. The tokenization direction does not change that vocabulary — it adds the principle that Scenes and other fine-grained units may be extracted from existing canonical works rather than authored from scratch. This must be considered before the `mural_moment_context` schema is designed.

`CANONICAL` **Creative Moment vs Scene vocabulary** (2026-08-21, founder-established)

- **Creative Moment** = canonical creative unit within the World. Entity type: `creative-moment`.
- **Scene** = contextual visual appearance of a Creative Moment within a particular Mural.
- These must not be collapsed. A Creative Moment does not become a Scene by appearing in a Mural.
- "Verse" is not a canonical entity type.
- The future `mural_moment_context` relationship represents the Scene/appearance relationship.
- `start_ms` / `end_ms` belong to `mural_moment_context` (Scene), not to the Creative Moment.

`OPEN QUESTION` **What exactly is a Creative Moment, now that a real World and real Mural exist?**

Build 06 is closed. The next build must NOT begin with implementation.

The next step is an evidence/ontology audit of Creative Moments against the real Super Hero Ego material. The question to answer before any schema or code work:

> Does the relationship `Mural → Creative Moment` require an intermediate layer, or is direct expressive placement (via `mural_moment_context`) sufficient?

Specifically:
- What is the unit of meaning that constitutes a Creative Moment in Super Hero Ego?
- Is a Creative Moment a segment of the Mural's timeline, a visual region, a lyric unit, or something else?
- Does the Mural → Moment relationship require a named intermediate concept (e.g. a "Scene" or "Act") between the full Mural and individual Moments?
- What does "a Moment appearing within a Mural" actually mean against the real 4:15 video?

This audit must be conducted by the founder against the actual Super Hero Ego material before any `mural_moment_context` schema or Creative Moment creation is designed.

`CANONICAL` **Mural does not own any Creative Moments** (2026-08-21, founder-established)

The Super Hero Ego Mural currently has no Creative Moment relationships. This is correct — not missing data. The expressive composition graph between Mural and Moments is deferred until the Creative Moment ontology audit is complete.

---

## Build 10 — Media Realization, Performance & Rights Architecture Discovery (2026-08-21, OPEN)

`CANONICAL` **Media realization is not a projection** (2026-08-21, founder-established)

A media realization (animated video, live performance, broadcast recording) is a production
artifact that depicts a canonical work. It is not a canonical state. It is not a projection.
A projection is authorised by the canonical authority. A realization is produced by whoever
produced it, and its rights belong to that party — not automatically to the canonical authority.

`CANONICAL` **Canonical work authority ≠ recording rights** (2026-08-21, founder-established)

Ownership/authority over the canonical work (master, canonical_state) does not imply
ownership or control of every media realization that depicts it. These are distinct domains
and must not be conflated in the schema, in application logic, or in collectible issuance.

`CANONICAL` **Tokenized Scene must not inherit media rights** (2026-08-21, founder-established)

A collectible issued against a tokenized Scene derives its rights from the canonical
projection of that Scene — not from any particular video or performance in which the Scene
appears. The collectible's provenance chain must be traceable to the canonical work without
passing through any independently-owned media asset.

`CANONICAL` **Build 10 architectural gaps identified** (2026-08-21, founder-established)

Six gaps confirmed by discovery:

- Gap A: `media_asset` has no rights_holder_ref — cannot assert who controls a recording
- Gap B: No production provenance for media files
- Gap C: No semantic distinction between canonical-authority-controlled and third-party-owned assets bound to projections
- Gap D: No entity for a performance/realization as a distinct concept
- Gap E: No licence/permission record for asset use
- Gap F: No mechanism to enforce that a collectible-designated projection uses only canonical-authority-controlled media

`CANONICAL` **Build 10 minimum implementation** (2026-08-21, founder-established)

1. Add `rights_holder_ref` (nullable participant FK) and `rights_basis` (nullable text) to `media_asset`
2. Create `media_realization` table (realization_id, master_id, realization_type, rights_holder_ref, rights_basis, production_notes, created_at, created_by)
3. Add `realization_id` (nullable FK) to `projection_media_binding`

`CANONICAL` **Null rights_holder_ref means unknown — not canonical authority** (2026-08-21, founder-established)

Null on `media_asset.rights_holder_ref` means the rights holder has not been recorded.
It must never be treated as implicit canonical authority ownership. Application logic must
treat null as unknown.

`CANONICAL` **Required sequence before tokenization** (2026-08-21, founder-established)

```
Build 10 (media_realization + rights_holder_ref)
  → Founder decision: who controls the existing Super Hero Ego recording (bda79051)?
  → Creative Moment ontology audit
  → mural_moment_context schema design
  → Scene extraction model
  → Tokenization
```

Do not begin Scene extraction or tokenization until Build 10 is implemented and the
Creative Moment ontology audit is complete.

`OPEN QUESTION` **Who controls the existing Super Hero Ego recording (bda79051)?**

The Livepeer asset `5a112ddzzuvlq3a5` / media_asset `bda79051` is currently bound to both
the World projection and the Mural projection. Before `rights_holder_ref` is assigned to
this asset, the founder must confirm who actually controls that recording.

Full discovery report: `.mighty-verse/build10-discovery.md`

---

## Build 10 — Media Realization & Rights Architecture (2026-08-21, CLOSED)

`CANONICAL` **Founder fact: bda79051 rights** (2026-08-21, founder-established)

The animation/visual realization represented by `bda79051` (Livepeer `5a112ddzzuvlq3a5`, ~4:15,
the Super Hero Ego animated video) is owned by Golden Shovel.
`rights_holder_ref = 866390ff`, `rights_basis = 'Golden Shovel — animation/visual realization'`.

This establishes ownership of the animation/visual realization only. It does not establish
ownership of the underlying audio recording/master, which is a separate rights object not yet
formally recorded. Livepeer is delivery infrastructure only — not evidence of rights ownership.

`CANONICAL` **Unknown rights ≠ authorised rights** (2026-08-21, founder-established)

`media_asset.rights_holder_ref = NULL` means the rights holder has not been recorded.
It must never be interpreted as canonical authority ownership, Mighty Verse ownership,
or any other implicit authorisation. Unknown rights are a rights-risk state that blocks
collectible designation.

`CANONICAL` **media_realization is not a canonical Master** (2026-08-21, founder-established)

A `media_realization` record represents a real-world production/performance/broadcast context.
It has no `canonical_state`, no `provenance_record` in the canonical lineage, and no
`integrity_hash` in the canonical sense. It sits outside the canonical domain.

`CANONICAL` **Collectible designation rights-safety invariant** (2026-08-21, founder-established)

`designateCollectible()` now enforces: all media assets bound to a projection must have a
known `rights_holder_ref` before collectible designation is permitted. This check is at the
application layer in `src/lib/authority/operations.ts`.

`CANONICAL` **Build 10 schema changes** (2026-08-21)

| Change | Detail |
|---|---|
| `media_asset.rights_holder_ref` | Nullable FK → participant. NULL = unknown (rights-risk). |
| `media_asset.rights_basis` | Nullable text. Describes the basis of rights. |
| `media_realization` | New table. realization_id, master_id, realization_type, rights_holder_ref, rights_basis, production_notes, created_at, created_by. |
| `projection_media_binding.realization_id` | Nullable FK → media_realization. NULL = no realization context. |

`CANONICAL` **bda79051 annotation** (2026-08-21)

`media_asset` row `bda79051` updated:
- `rights_holder_ref = 866390ff` (Golden Shovel)
- `rights_basis = 'Golden Shovel — animation/visual realization'`

This records ownership of the animation/visual realization specifically.
Audio recording/master rights are a separate object — not established by this fact.
No other existing rows modified. World/Mural projections and canonical states unchanged.

`CANONICAL` **Super Hero Ego realization model** (2026-08-21, founder-established)

Super Hero Ego may have multiple independent media realizations:
- existing ~4:15 animated video (`bda79051`) — Golden Shovel, animation/visual realization
- audio recording/master — rights holder not yet formally recorded
- live performance recording — rights holder TBD
- SABC 1 broadcast/performance — rights holder TBD
- future visualizations — rights holder TBD

These are not collapsed into one generic asset. Each realization has its own rights context.
The canonical World, Mural, and future Scenes remain independent of any particular realization's rights.

**Migration:** `supabase/migrations/20260821020000_media_realization.sql`  
**Commit:** TBD (pending review)

---

## Build 12 — Scene Canonical Primitive (2026-08-21, CLOSED)

`CANONICAL` **Scene is a first-class canonical type** (2026-08-21, founder-established)

`scene` is now a valid `canonical_type`. A Scene is a bounded canonical extraction from a
specific Mural canonical state, given independent canonical identity by an explicit act of
the canonical authority. It is not a UI crop, not a media clip, not a Creative Moment, and
not an Interpretation.

`CANONICAL` **Scene parentage invariant** (2026-08-21, founder-established)

A Scene's `parent_master_id` must reference a `mural` master. Enforced by:
- `master_parent_type_check` CHECK constraint (permits `scene` to have a parent)
- `enforce_mural_parent_type` trigger (validates parent is `mural`)
- `registerMaster()` application-layer check

`CANONICAL` **Canonical hierarchy** (2026-08-21, founder-established)

```
World (song-world)
  └── Mural (mural, parent = World)
        └── Scene (scene, parent = Mural)
```

Creative Moment remains separate:

```
World (song-world)
  └── Creative Moment (creative-moment, parent = World)
```

`CANONICAL` **extraction is a first-class provenance relationship** (2026-08-21, founder-established)

`extraction` is now a valid `provenance_relationship_type`. It represents:
`Scene canonical state → extracted from → source Mural canonical state`.
This is distinct from `canonical-revision` (state supersedes state) and `projection`
(projection derives from state). The three concepts remain separate:
- `parent_master_id` = canonical hierarchy
- `provenance_record / extraction` = source-state lineage
- `content_refs` = extraction details (geometry deferred)

`CANONICAL` **Extraction geometry intentionally deferred** (2026-08-21, founder-established)

The format of `content_refs.extraction_bounds` is not yet defined. The exact geometry or
semantic extraction format (spatial region, visual element, character, compositional unit)
remains deferred until the first Scene ontology audit against the actual Super Hero Ego
Mural material.

`CANONICAL` **No Scene instances created** (2026-08-21)

Build 12 establishes infrastructure only. Zero Scene master records exist. Zero Scene
canonical states, projections, media bindings, or collectibles were created.

`CANONICAL` **Creative Moment remains distinct from Scene** (2026-08-21, founder-established)

Proverb (`3b0de6b4`), Reason (`2745a50a`), Mothipa (`32422bb4`) remain children of the
World. They were not moved, converted, or attached to Scenes. `mural_moment_context`
remains deferred.

`OPEN QUESTION` **First Scene ontology** — What specific bounded visual/canonical units
should become the first Super Hero Ego Scenes? (spatial region, visual element, character,
object, symbol, compositional unit?) This must be answered by the founder against the actual
Mural material before any Scene record is created.

**Migration:** `supabase/migrations/20260821030000_scene_canonical_type.sql`
**Commit:** TBD (pending review)

---

## Build 13 — Scene Ontology Decision (2026-08-21, DISCOVERY ONLY)

`CANONICAL` **Scene definition — Definition 2 adopted** (2026-08-21, founder-established)

**Scene = an independently addressable canonical visual/spatial unit of a Mural.**

The Build 09 vocabulary entry (`Scene = contextual visual appearance of a Creative Moment
within a particular Mural`) is superseded by this decision. Scene is a canonical entity,
not a relationship record.

`CANONICAL` **Product ontology** (2026-08-21, founder-established)

```
World
  ├── Creative Moment  (who / creative contribution)
  │     ├── Proverb
  │     ├── Reason
  │     └── Mothipa
  └── Mural
        └── Scene  (where / visual-spatial canonical unit)
```

- Creative Moment = who / creative contribution
- Scene = where / visual-spatial canonical unit
- Mural = the complete visual expression
- World = the overarching canonical work

A Creative Moment can appear within a Scene but does not become the Scene.

`CANONICAL` **mural_moment_context is a relationship, not the Scene** (2026-08-21, founder-established)

`mural_moment_context`, when eventually introduced, represents:

> "This Creative Moment is expressed/represented within this particular Scene."

It is a relationship between Scene and Creative Moment. It is not the Scene itself.
It must be designed after real Scene data exists — not speculatively.

`CANONICAL` **start_ms/end_ms are media-realization context** (2026-08-21, founder-established)

The Build 09 `start_ms`/`end_ms` interpretation is superseded. Temporal bounds belong to
the media realization/deployment context, not to canonical Scene identity.

```
Scene ≠ video clip
Scene ≠ time segment
Scene ≠ UI crop
```

`CANONICAL` **Scene identity is semantic + spatial** (2026-08-21, founder-established)

Scene identity should be semantic + spatial where established. Example:

```
semantic: "Proverb's visual presence"
spatial:  { ...bounds within Mural... }
```

The semantic identity must not be reduced to coordinates. Coordinates describe where;
the semantic identity describes what canonical unit was designated.

`CANONICAL` **No Scene records created** (2026-08-21)

Build 13 is discovery and product decision only. Zero Scene master records, canonical
states, provenance records, projections, media bindings, collectibles, or tokens were
created. No schema changes were made.

`OPEN QUESTION` **First Scene identification** — The actual Super Hero Ego animation must
be examined by the founder/product authority to identify and define the first Scene(s).
Candidate set: the three artist-associated visual presences (Proverb, Reason, Mothipa).
For each candidate, the following must be established before any Scene record is created:
(1) semantic identity, (2) visual bounds within the Mural, (3) which Creative Moment(s)
it expresses, if any. Do not invent extraction bounds from repository data.

`OPEN QUESTION` **mural_moment_context schema** — Deferred until real Scene data exists.

---

## Build 13 — Evidence Review & Ontology Refinement (2026-08-21, DISCOVERY CONTINUES)

`CANONICAL` **Scene definition — refined** (2026-08-21, founder-established)

> A Scene is an independently addressable canonical visual/spatial unit of a Mural,
> designated by the canonical authority.

A Scene is not required to be a geometric region. It may be a **canonical visual entity
with spatial manifestation** — a semantically meaningful unit that also has a location
within the Mural's visual surface.

`CANONICAL` **Scene ≠ Creative Moment — now evidence-supported** (2026-08-21, founder-established)

External evidence (Golden Shovel official article, 2025-10-30, goldenshovel.co.za) confirms
the Super Hero Ego animation contains four distinct animated warrior identities:

- Golden Shovel — the powerhouse
- Mothipa — the dark knight
- ProVerb — the hand-to-hand specialist
- Reason — the sword master

The animation contains four visual character identities. The repository currently has three
Creative Moments (ProVerb, Reason, Mothipa). Golden Shovel's own visual manifestation is a
candidate Scene with no corresponding Creative Moment. This confirms that Scene and Creative
Moment are not one-to-one and that Scenes are not required to correspond to Creative Moments.

```
Candidate Scene
    ├── may express Creative Moment
    └── may have no Creative Moment counterpart
```

`CANONICAL` **Creative Moment vs Scene — locked definitions** (2026-08-21, founder-established)

| Concept | Meaning |
|---|---|
| Creative Moment | Contributor-centered canonical creative unit belonging to the World |
| Scene | Visual/spatial canonical unit of the Mural, designated by canonical authority |
| Relationship | A Scene may express, depict, or contextualize one or more Creative Moments — but does not require one |
| Media | A video/timecode is a realization of a Scene, not the Scene itself |
| Geometry | Spatial bounds describe the Scene's manifestation within a specific Mural canonical state |
| Semantics | A Scene should have a meaningful semantic identity in addition to spatial bounds |
| Tokenization | A Scene may become tokenizable via its own canonical-state → projection → collectible chain |

`CANONICAL` **2.5D principle — confirmed** (2026-08-21, founder-established)

The source statement "2.5D is the idea of creative moments becoming spatial objects" now maps
cleanly to the architecture:

```
World
  ├── Creative Moment: ProVerb  (creative/contributor identity)
  └── Mural
        └── Scene: ProVerb warrior manifestation  (visual/spatial canonical identity)
                   └── expresses Creative Moment: ProVerb  (via future mural_moment_context)
```

`CANONICAL` **Animation production context** (2026-08-21, founder-established)

External evidence identifies the animation production context:

- Animation: The'Main Man (founder, World Wide Studios)
- Golden Shovel commissioned the visual realization

This does not change `bda79051.rights_holder_ref = 866390ff` (Golden Shovel controls the
animation/visual realization). It provides production provenance that can eventually be
recorded in a `media_realization` record without conflating animator attribution with
rights control. Build 10's rights architecture correctly anticipated this distinction.

`CANONICAL` **First Scene candidates — expanded** (2026-08-21, founder-established)

The candidate set is not limited to the three existing Creative Moments. Candidates include:

- Golden Shovel warrior manifestation
- Mothipa warrior manifestation (dark knight / gargoyle)
- ProVerb warrior manifestation (hand-to-hand specialist)
- Reason warrior manifestation (sword master)
- City / environment elements
- Alien threat / antagonist elements
- Other recurring visual motifs

These are candidates only. None are canonical records. Exact Scene boundaries require
visual inspection of the actual animation.

`OPEN QUESTION` **Visual ontology audit required** — Before any Scene record is created,
the founder must examine the actual Super Hero Ego animation and establish:
(1) what visually constitutes a distinct canonical unit;
(2) which units recur and whether recurrence means one Scene or multiple;
(3) which units are characters, environments, or symbolic elements;
(4) which correspond to existing Creative Moments;
(5) what spatial bounds define each candidate;
(6) what should remain part of the Mural rather than becoming a Scene.

**Build 13 status: DISCOVERY CONTINUES. No implementation. No Scene records.**

---

## Build 13 — Scene Candidate Map Correction (2026-08-21, DISCOVERY CONTINUES)

`CANONICAL` **Media evidence map — corrected** (2026-08-21, founder-established)

Visual audit of the Super Hero Ego animation establishes the following media-realization
observations. These are timecode observations only — they do not define Scene boundaries.

| Media interval | Visual/performer context | Canonical treatment |
|---|---|---|
| 00:00–00:35 | Golden Shovel / hook-led | Mural / Scene evidence — no separate Scene |
| 00:36–01:19 | Golden Shovel warrior | Golden Shovel Scene candidate |
| 01:20–02:04 | Mothipa warrior | Mothipa Scene candidate |
| 02:05–02:28 | Hook / Golden Shovel-led | Mural / recurring manifestation — no separate Scene |
| 02:29–03:12 | ProVerb warrior | ProVerb Scene candidate |
| 03:13–04:14 | Reason warrior | Reason Scene candidate |
| 04:02–04:14 | Final hook overlap | Media transition/overlap — not a new Scene |

`CANONICAL` **Recurring appearance ≠ new Scene** (2026-08-21, founder-established)

A recurring appearance in the media realization does not automatically create another
canonical Scene. The Golden Shovel visual manifestation appears during the intro, hook,
and his verse. Those appearances are media depictions of the same canonical Golden Shovel
Scene — not multiple canonical entities. This is the concrete proof that Scene identity
is canonical visual/spatial identity, not temporal occurrence.

`CANONICAL` **Four authorised first Scene candidates** (2026-08-21, founder-established)

| Candidate | Creative Moment link |
|---|---|
| Golden Shovel warrior manifestation | None currently |
| Mothipa warrior manifestation | `32422bb4` (Mothipa) |
| ProVerb warrior manifestation | `3b0de6b4` (ProVerb) |
| Reason warrior manifestation | `2745a50a` (Reason) |

Intro/hook material, environmental elements, antagonist elements, and media
transitions are not authorised Scene candidates at this stage.

`CANONICAL` **Spatial bounds not yet established** (2026-08-21, founder-established)

Timecodes are media-realization observations. They do not constitute spatial bounds for
canonical Scene identity. Spatial bounds require visual inspection of the Mural's canonical
surface, not inference from video timestamps.

**Build 13 status: DISCOVERY CONTINUES. No Scene records. No implementation.**

---

## Build 13 — Scene Registration (2026-08-21, CLOSED)

`CANONICAL` **Migration split: Build 12 enum/constraint separation** (2026-08-21)

The Build 12 migration was split into two files to satisfy Postgres's requirement that
`ALTER TYPE ... ADD VALUE` be committed before the new value is used in a constraint:
- `20260821030000_scene_canonical_type.sql` — enum additions only
- `20260821031000_scene_constraints.sql` — constraint and trigger extension

`CANONICAL` **Four canonical Scenes registered** (2026-08-21, founder-established)

The four Super Hero Ego warrior manifestations are now canonical Scene records.

| Scene | master_id | canonical_state_id | Creative Moment |
|---|---|---|---|
| Golden Shovel — Powerhouse | `4790c7cf` | `43ad0791` | none (intentional) |
| Mothipa — Dark Knight | `bebb65d2` | `e785f838` | `32422bb4` |
| ProVerb — Hand-to-Hand | `df15ec76` | `3c2de179` | `3b0de6b4` |
| Reason — Sword Master | `65490a92` | `c55a1c13` | `2745a50a` |

All four:
- `canonical_type = 'scene'`
- `parent_master_id = a75ae8af` (Super Hero Ego Mural)
- canonical state with `content_refs` carrying semantic-spatial extraction bounds
- `provenance_record` with `relationship_type = 'extraction'` → source Mural state `8f7fe56d`
- `provenance_record` with `relationship_type = 'canonical-revision'` (standard canonical chain)
- `attribution_entry` with `role_type = 'director'` → Golden Shovel
- `work_presentation` with title and description

`CANONICAL` **Golden Shovel Scene has no Creative Moment counterpart** (2026-08-21, founder-established)

The Golden Shovel warrior manifestation Scene (`4790c7cf`) has `creative_moment_id = null`.
This is intentional and validates the Scene ≠ Creative Moment ontology: a Scene does not
require a Creative Moment counterpart.

`CANONICAL` **Extraction bounds are semantic-spatial only** (2026-08-21, founder-established)

All four Scenes carry `extraction_bounds.type = 'semantic-spatial'` with semantic identity
and spatial description. `geometry = null` — numerical coordinates are not yet established
and were not fabricated. Timecodes from the media realization were not used as bounds.

`CANONICAL` **Zero projections, media bindings, collectibles, or tokens created** (2026-08-21)

Scene registration is canonical identity only. No delivery infrastructure was created.

**Script:** `scripts/build13-create-scenes.ts`
**Migrations:** `20260821030000_scene_canonical_type.sql`, `20260821031000_scene_constraints.sql`

---

## Build 14 — Scene-First V1 Experience (2026-08-21, CLOSED)

`CANONICAL` **Scene projections established** (2026-08-21, founder-established)

Four experiential projections created for the Build 13 Scenes, all bound to `bda79051`
(Mural animation, Golden Shovel-controlled). No new media asset created — reused via
idempotency. This is a V1 bridge: Scene-specific media realizations are a future build.

| Scene | projection_id |
|---|---|
| Golden Shovel — Powerhouse | `3039ca84` |
| Mothipa — Dark Knight | `bb802400` |
| ProVerb — Hand-to-Hand | `9c045ea3` |
| Reason — Sword Master | `8100033e` |

`CANONICAL` **Creative Moment → Scene navigation** (2026-08-21, founder-established)

Creative Moment cards on the World page navigate to their associated Scene's projection.
The relationship is expressed as a static application-layer map (`SCENE_TO_CM` in
`worlds/[masterId]/page.tsx`), explicitly documented as a temporary bridge pending
`mural_moment_context`. When that relationship is implemented, the static map is removed.

Golden Shovel Scene remains independently discoverable in the Scenes section with no
Creative Moment counterpart — preserving the Scene ≠ Creative Moment invariant in live UI.

`CANONICAL` **No Creative Moment projections created** (2026-08-21, founder-established)

Creative Moments remain canonical contributor-centered entities without projections.
Navigation to the Scene experience does not require or imply a Creative Moment projection.

---

## Build 18 — Universe terminology transition (2026-08-21)

`CANONICAL` **Terminology decision: Song World → Universe** (2026-08-21, founder-established)

The top-level canonical container is now a **Universe**.

**Mighty Verse is the multiverse/platform. Each song/work establishes a Universe.**

```
MIGHTY VERSE
   │
   ├── Super Hero Ego Universe  (05ccc0c6)
   │      ├── Creative Moments
   │      ├── Mural
   │      └── Scenes
   │
   └── [future Universes]
```

Prior builds used `song-world` as the canonical type. That history is preserved in
migration records and this evolution document. The transition is:

```
song-world  →  universe
```

**What changed:**

- `canonical_type` enum value renamed: `'song-world'` → `'universe'`
  (migration `20260821050000_universe_terminology.sql`)
- `enforce_mural_parent_type()` trigger updated to validate `'universe'`
- TypeScript union types, string comparisons, discovery type, authority client,
  UI labels and nav copy updated throughout
- Route `/worlds/[masterId]` unchanged — backwards compatibility preserved

**What did not change:**

- Master `05ccc0c6` — same ID, same record, only `canonical_type` value changed
- All other master IDs, canonical states, projections, bindings, media assets
- Historical migrations — not rewritten
- `mural_moment_context` — not introduced

**Important distinction preserved:**

Universe ≠ Multiverse. `universe` is a canonical database type.
`multiverse` is not a canonical type and must not become one.
Mighty Verse is the platform/multiverse; it is not represented as a canonical entity.
