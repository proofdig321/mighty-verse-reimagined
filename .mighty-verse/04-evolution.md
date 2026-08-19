# 04 — EVOLUTION

The living record of decisions made, approaches rejected, and lessons learned.
This document grows as Mighty Verse Reimagined progresses.

---

## Implementation Steps

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
