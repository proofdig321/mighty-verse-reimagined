# 05 — TECHNICAL ARCHITECTURE

The technical architecture of Mighty Verse Reimagined.
Translates the constitutional model into technically enforceable decisions.
Must not redefine or reinterpret the constitutional/economic model.

---

## Implementation Boundary

`CANONICAL` **Implementation commenced** (2026-08-17, founder-established)

Architecture is complete (A1–A14 accepted). Implementation is in progress.

Dependency order:
**Supabase schema → AuthorityRecord → Participant/Identity → Master/CanonicalState/Provenance → Projection → Waterfalls → Next.js + shadcn/ui + MCP → Auth → Media/Livepeer → Collectible → Economic engine → ConsumptionSignal → n8n → thirdweb v5 → Stripe → Vercel**

Q executes implementation in this order. Each layer must not be commenced until its dependencies are in place. Constitutional constraints from Phases 1–4 are immutable architectural constraints on all implementation work.

---

## Governing Constraint

`CANONICAL` (carried from Phases 1–4)

The following concepts must remain technically distinct and must not be collapsed into a single
token, database object, or smart contract:

- **Canonical authority** — held by Mighty Verse / Golden Shovel; non-transferable
- **Creative authorship** — attributable to creators and contributors
- **Provenance** — lineage of canonical state and projections; must remain traceable
- **Ownership** — holder of a particular collectible projection
- **Economic entitlement** — revenue or royalty rights legitimately carried by a collectible or participant
- **Access** — what the holder can experience
- **Web3 representation** — optional technical rail for representing or verifying some of the above

---

## Architecture — Resolved

### A1 — Canonical State Representation

`ARCHITECTURAL DECISION` **A1** (2026-08-17, founder-established)

The canonical model is represented as a versioned lineage of immutable states. A revision never mutates a prior state; it creates a new state that references its predecessor.

**Master**
The Master is the root canonical entity for a Song/World. It is not a media file. It is the authoritative identity record for the canonical work.

Minimum identity:
- `master_id` — stable, permanent identifier for the canonical work; never changes across revisions
- `canonical_type` — the type of canonical entity (Song/World, Creative Moment, Mural, etc.)
- `created_at` — creation timestamp; immutable
- `created_by` — canonical authority reference (Mighty Verse / Golden Shovel); immutable
- `current_state_id` — reference to the current canonical state; mutable pointer, updated on revision
- `attribution_ref` — reference to the attribution record for this work

**Canonical State**
Each revision of a Master produces a new canonical state. The previous state is not modified.

Minimum identity:
- `canonical_state_id` — unique identifier for this specific state; immutable once created
- `master_id` — reference to the parent Master; immutable
- `version` — monotonically increasing version number within this Master's lineage
- `parent_state_id` — reference to the immediately preceding canonical state; null for the initial state; immutable
- `created_at` — timestamp of this state's creation; immutable
- `authorised_by` — canonical authority that created/approved this state
- `authorisation_state` — current authorisation status (draft, authorised, superseded, revoked)
- `attribution_snapshot_ref` — reference to the attribution record as it stood at this state
- `content_refs` — references to media/content assets associated with this state (not the assets themselves)
- `integrity_hash` — a content-addressable hash of the canonical state's defining fields; enables independent verification without requiring blockchain
- `provenance_ref` — reference to the provenance record for this state

**Invariants:**
- A canonical state, once created, is never modified. Corrections create a new state.
- `parent_state_id` is immutable once set. The lineage chain cannot be rewritten.
- `master_id` on a canonical state is immutable. A state cannot be reassigned to a different Master.
- `current_state_id` on the Master is the only mutable pointer; it advances forward only.

**Projection**
A projection is a derived representation of a specific canonical state. It is not the canonical state itself.

Minimum identity:
- `projection_id` — unique identifier for this projection
- `canonical_state_id` — the specific canonical state from which this projection derives; immutable once set
- `master_id` — denormalised reference to the Master for query convenience; immutable
- `projection_type` — the type of projection (experiential, distributional, archival, collectible-designated, etc.)
- `collectible_designated` — boolean; whether Mighty Verse has explicitly designated this projection as collectible
- `created_at` — timestamp
- `content_refs` — references to the media/content assets for this projection
- `integrity_hash` — hash of the projection's defining fields

**Invariants:**
- `canonical_state_id` on a projection is immutable once set. A projection cannot be reassigned to a different canonical state.
- Collectible designation is an explicit act; it is not inferred from projection type.
- A projection becoming obsolete does not alter the canonical state it references.

---

### A2 — Provenance Chain

`ARCHITECTURAL DECISION` **A2** (2026-08-17, founder-established)

Provenance is represented as an append-only directed lineage graph. Each node records its relationship to its source. Relationships are immutable once established.

**Provenance Record**
Each canonical state, projection, interpretation, and collectible carries a provenance record that establishes its position in the lineage.

Minimum identity:
- `provenance_id` — unique identifier
- `subject_id` — the entity this provenance record describes (canonical_state_id, projection_id, interpretation_id, collectible_id)
- `subject_type` — the type of the subject entity
- `source_id` — the entity from which this subject derives; null only for the root Master state
- `source_type` — the type of the source entity
- `relationship_type` — the nature of the relationship (canonical-revision, projection, interpretation, derivative, collectible-issuance)
- `created_at` — timestamp; immutable
- `authorised_by` — the authority that established this provenance relationship
- `public` — whether this provenance record is publicly verifiable
- `integrity_hash` — hash of the provenance record's defining fields

**Lineage chain examples:**

```
Master (root)
  └── CanonicalState v1  [provenance: root]
        └── CanonicalState v2  [provenance: revision of v1]
              └── Projection A  [provenance: projection of v2]
                    └── Collectible X  [provenance: collectible-issuance from Projection A]

CanonicalState v1
  └── Interpretation I  [provenance: interpretation of v1, attributed to Interpretation creator]
        └── Projection B  [provenance: projection of Interpretation I]
              └── Collectible Y  [provenance: collectible-issuance from Projection B]
```

**Invariants:**
- Provenance records are append-only. An established relationship is never deleted or modified.
- A projection's `canonical_state_id` must match the `source_id` in its provenance record. Mismatch is a data integrity violation.
- When a Master evolves, existing projections retain their provenance to the canonical state from which they were issued. They are not automatically reassigned to the new state.
- An Interpretation's provenance records both its source Creative Moment/canonical state and its Interpretation creator attribution.
- Provenance is distinct from ownership. A change of ownership does not alter provenance.
- Public provenance records must be independently verifiable via their `integrity_hash` without requiring access to private system internals.

**Prevention of detachment:**
A projection or collectible cannot reference a `canonical_state_id` that does not exist in the canonical state lineage of the claimed Master. This referential integrity constraint is enforced at the application layer and optionally verifiable on-chain for designated collectibles.

---

### A3 — Collectible Identity

`ARCHITECTURAL DECISION` **A3** (2026-08-17, founder-established)

A collectible is a distinct entity. It references its projection, canonical state, provenance, ownership, and economic terms — but is the authoritative source of none of them. Each reference is immutable once set at issuance.

**Collectible**

Minimum identity:
- `collectible_id` — unique identifier for this collectible; immutable
- `collectible_class` — the class/type (Card, Edition, Interpretation collectible, Mural representation, etc.)
- `projection_id` — the specific projection this collectible represents; immutable once set
- `canonical_state_id` — the canonical state from which this collectible was issued; immutable once set; denormalised from projection for direct traceability
- `master_id` — the Master this collectible ultimately traces to; immutable; denormalised for query convenience
- `provenance_id` — reference to the provenance record for this collectible's issuance; immutable
- `issuance_id` — identifier for the issuance event that created this collectible
- `edition_info` — edition number, edition size, and edition series where applicable; immutable once set
- `issued_at` — issuance timestamp; immutable
- `issued_by` — Mighty Verse authority reference; immutable

**Economic terms — immutable at issuance:**
- `primary_waterfall_id` — reference to the waterfall definition used for primary issuance; immutable once set
- `primary_waterfall_version` — the specific version of that waterfall in force at issuance; immutable once set
- `secondary_waterfall_id` — reference to the secondary transfer waterfall definition; immutable once set; may be null if no secondary economics apply
- `secondary_waterfall_version` — the specific version of that waterfall in force at issuance; immutable once set
- `entitlement_bundle_id` — reference to the entitlement bundle record defining access, recognition, transfer rights, and economic entitlements for this collectible; immutable once set
- `economic_rule_snapshot` — a snapshot or content-addressable reference to the full economic terms as they stood at issuance; ensures historical reproducibility even if the referenced waterfall records are later versioned forward

**Ownership (mutable):**
- `current_owner_ref` — reference to the current owner identity record; mutable on transfer
- `ownership_rail` — Web2 or Web3; indicates which ownership rail is active
- `web3_token_ref` — optional reference to the on-chain token representing this collectible; null if Web2 only

**Transfer history (append-only):**
- `transfer_history` — append-only log of ownership transfer events; each entry records: prior owner, new owner, transfer timestamp, economic event reference, settlement state

**Invariants:**
- `projection_id`, `canonical_state_id`, `master_id`, `provenance_id`, `issuance_id`, `issued_at`, `issued_by`, `primary_waterfall_id`, `primary_waterfall_version`, `entitlement_bundle_id`, and `economic_rule_snapshot` are all immutable once set at issuance.
- A later change to Mighty Verse's default waterfall definitions does not affect `primary_waterfall_version` or `secondary_waterfall_version` on an already-issued collectible.
- `current_owner_ref` is the only ownership field that changes on transfer; it does not affect any canonical, provenance, or economic-terms fields.
- Transfer history is append-only; transfers are never silently removed from the log.
- A collectible's `canonical_state_id` must be traceable through its `provenance_id` back to a valid canonical state in the Master's lineage. This is a hard referential integrity constraint.

---

## Architecture — Unresolved

`OPEN QUESTION` **A1 — Canonical state representation** — How is the Master and each canonical state represented technically? How do projections reference the canonical state from which they derive? How is canonical evolution represented as a new state without destroying historical lineage? UNKNOWN / TO BE ESTABLISHED.

`OPEN QUESTION` **A2 — Provenance chain** — How is the provenance chain (canonical source → interpretation/derivative → projection/distribution) represented and verified technically? What prevents a projection from being detached from its canonical lineage? UNKNOWN / TO BE ESTABLISHED.

`OPEN QUESTION` **A3 — Collectible identity** — How does a collectible reference its projection and the specific canonical state from which it was issued? How are issuance-attached entitlement bundles and economic terms stored so they remain historically authoritative and cannot be silently overwritten by later platform defaults? UNKNOWN / TO BE ESTABLISHED.

### A4 — Economic Rule Representation

`ARCHITECTURAL DECISION` **A4** (2026-08-17, founder-established)

Economic rules are first-class versioned records. They are never hard-coded business logic. A rule change creates a new immutable version; prior versions remain permanently addressable.

**WaterfallDefinition**
The named, reusable economic rule.

- `waterfall_id` — stable identifier for this rule across all versions; never changes
- `name` — human-readable name
- `economic_channel` — the channel this rule applies to (consumption, advertising, primary-issuance, secondary-transfer, interpretation, platform)
- `created_at` — immutable
- `created_by` — authority that created this rule

**WaterfallVersion**
An immutable snapshot of a waterfall at a specific point in time.

- `waterfall_version_id` — unique identifier for this version; immutable once created
- `waterfall_id` — reference to the parent WaterfallDefinition; immutable
- `version` — monotonically increasing version number within this waterfall's lineage
- `effective_from` — the timestamp from which this version applies to new economic events
- `effective_to` — the timestamp at which this version was superseded; null if currently active; set when a new version is created, never modified thereafter
- `status` — draft, active, superseded
- `calculation_mode` — independent (each participant calculated from the gross/net basis independently) or sequential (participants calculated in defined order, each from the remainder)
- `participants` — ordered list of participant role entries (see below)
- `conditions` — any constraints or conditions on applicability
- `integrity_hash` — hash of this version's defining fields; enables independent verification
- `created_at` — immutable
- `authorised_by` — immutable

**WaterfallParticipantEntry** (within a WaterfallVersion)
- `role` — the participant role (canonical-creator, collaborator, featured-artist, interpretation-creator, mighty-verse, collector, other)
- `entitlement_basis` — what the percentage/amount is calculated from (gross-revenue, net-revenue, remainder, fixed-amount, formula)
- `calculation_method` — percentage, fixed, formula-reference
- `value` — the percentage, fixed amount, or formula identifier
- `order` — position in sequential waterfall; null if calculation_mode is independent
- `conditions` — role-specific conditions

**Invariants:**
- A WaterfallVersion, once created, is never modified. `effective_to` is set when superseded but the record itself is immutable.
- `effective_from` on a new version must be after `effective_from` of the prior active version.
- Historical versions remain permanently addressable by `waterfall_version_id`.
- Sequential ordering is only applied when `calculation_mode` is explicitly `sequential`. It is never inferred.

**Rule Attachment**

Rules attach at five levels, in ascending specificity:

```
1. platform/channel default
2. work (Master / Song / World)
3. projection
4. collectible class
5. individual collectible (issuance-attached; immutable)
```

**Precedence:** the most specific applicable rule wins. For an issued collectible, the issuance-attached `waterfall_version_id` and `economic_rule_snapshot` are always authoritative regardless of any higher-level default that has since changed.

**RuleAttachment** record:
- `attachment_id`
- `waterfall_id`
- `waterfall_version_id` — the version in force at the time of attachment
- `attachment_level` — platform, work, projection, collectible-class, collectible
- `subject_id` — the entity this attachment applies to
- `subject_type`
- `effective_from`
- `effective_to` — null if currently active
- `created_at`; `created_by`

**Rule Resolution**

Given an economic event, the applicable rule is resolved as:

1. If the event relates to an issued collectible → use the collectible's `economic_rule_snapshot` (immutable)
2. Else walk attachment levels from most specific to least specific, selecting the version whose `effective_from` ≤ event timestamp < `effective_to` (or `effective_to` is null)
3. If no attachment found at any level → apply platform/channel default for the event's channel

The resolved `waterfall_version_id` is recorded on the economic event at calculation time and never changes thereafter.

**Economic Rule Reproducibility**

Given: `economic_event_id` + its recorded `waterfall_version_id` + its recorded `attribution_snapshot` + its recorded `economic_basis`, the platform can reproduce the entitlement calculation at any future point. No live rule lookup is required for historical reproduction.

---

### A5 — Economic Event Model

`ARCHITECTURAL DECISION` **A5** (2026-08-17, founder-established)

Economic events are append-only records. Each event is independently identifiable and carries all inputs required for historical reproduction. Corrections and reversals are new events; they never overwrite originals.

**EconomicEvent**

- `event_id` — unique identifier; immutable
- `event_type` — consumption, advertising, primary-issuance, secondary-transfer, creator-entitlement, settlement, refund, correction, reversal, other
- `attributed` — boolean; whether this event is attributed to a specific work (true) or is platform-level unattributed (false)
- `source_ref` — the activity or transaction that generated this event (e.g. a stream session, a collectible sale transaction)
- `master_id` — reference to the relevant Master; null if genuinely unattributed
- `canonical_state_id` — the canonical state applicable at the time of the event; null if unattributed
- `projection_id` — the projection involved; null if not applicable
- `collectible_id` — the collectible involved; null if not applicable
- `provenance_id` — provenance reference for the subject of this event
- `attribution_snapshot` — immutable snapshot of the attribution record as it stood at event time (creator, collaborators, featured artists, interpretation creator, etc.)
- `waterfall_version_id` — the specific waterfall version used to calculate entitlements for this event; immutable once set
- `economic_basis` — the gross or net amount from which entitlements are calculated; immutable once set
- `currency` — the currency or unit of account
- `occurred_at` — timestamp of the underlying economic activity; immutable
- `calculated_at` — timestamp when entitlements were calculated; immutable
- `correction_of` — reference to the original `event_id` this event corrects or reverses; null for original events
- `correction_type` — null, correction, reversal, refund
- `status` — active, corrected, reversed (set when a subsequent correction/reversal event references this one)

**EconomicEntitlement** (one per participant per event)

- `entitlement_id` — unique identifier; immutable
- `event_id` — reference to the parent EconomicEvent; immutable
- `participant_ref` — reference to the participant identity record
- `participant_role` — the role under which this entitlement was calculated
- `calculation_basis` — the amount from which this entitlement was calculated
- `calculation_method` — percentage, fixed, formula
- `calculation_value` — the percentage, fixed amount, or formula used
- `entitlement_amount` — the calculated amount; immutable once set
- `currency`
- `calculated_at` — immutable
- `settlement_state` — Calculated, Accrued, Payable, Settled, Held, Reversed
- `settlement_ref` — reference to the SettlementRecord when settled; null until settled

**SettlementRecord**

- `settlement_id`
- `entitlement_ids` — one or more entitlements being settled in this record
- `settlement_amount` — total amount settled
- `currency`
- `settled_at`
- `settlement_method` — Web2-payment, Web3-transfer, other
- `settlement_ref` — external payment/transaction reference

**Attribution in economic events**

An event is `attributed = true` only when the source data directly supports attribution to a specific work. An advertising impression that cannot be traced to a specific Creative Moment or Song must be recorded as `attributed = false` with null `master_id` and `canonical_state_id`. It enters the platform-level unattributed pool. Attribution must not be fabricated to satisfy a waterfall model.

**Correction and reversal chain**

```
EconomicEvent A (original)
  → EconomicEntitlement A1 (participant X, Calculated)
  → EconomicEntitlement A2 (participant Y, Settled)

EconomicEvent B (correction_of: A, correction_type: correction)
  → EconomicEntitlement B1 (participant X, adjusted amount)
  → EconomicEntitlement B2 (participant Z, newly identified participant)

EconomicEvent A status → corrected (set by the system when B is created)
EconomicEntitlement A1 settlement_state → Reversed
```

The original event and its original entitlements remain permanently in the record. The correction event establishes the adjusted position. The historical chain is always reconstructable.

**Invariants:**
- Economic events are append-only. No event record is deleted or modified after creation.
- `waterfall_version_id`, `economic_basis`, `attribution_snapshot`, `occurred_at`, and `calculated_at` are immutable once set on an event.
- `entitlement_amount` and `calculated_at` are immutable once set on an entitlement.
- A correction or reversal event must reference the original `event_id` via `correction_of`.
- `attributed = true` requires a valid `master_id` and `canonical_state_id` traceable through the provenance chain.
- Settlement is a separate record; it does not modify the EconomicEvent or EconomicEntitlement records.
- Web3 settlement is represented as `settlement_method: Web3-transfer` on the SettlementRecord; it does not alter the economic event model.

### A6 — Primary and Secondary Economics

`ARCHITECTURAL DECISION` **A6** (2026-08-17, founder-established)

Primary issuance and secondary transfer are distinct economic event types within the A5 model. They share the same EconomicEvent / EconomicEntitlement / SettlementRecord structure but differ in their source, rule resolution, and what fields are authoritative.

**Primary Issuance Event**

Triggered when Mighty Verse issues a designated collectible.

EconomicEvent fields specific to primary issuance:
- `event_type` = `primary-issuance`
- `collectible_id` — the collectible being issued; immutable
- `canonical_state_id` — the canonical state from which the collectible was issued; resolved from the collectible record; immutable
- `provenance_id` — the collectible's provenance record; immutable
- `waterfall_version_id` — resolved from the collectible's `primary_waterfall_id` + `primary_waterfall_version` (issuance-attached); immutable
- `economic_basis` — the issuance price or defined economic basis; immutable
- `attribution_snapshot` — snapshot of the attribution record for the underlying canonical work at issuance time; immutable

Rule resolution for primary issuance: the collectible's `primary_waterfall_version` is always used. Platform defaults are not consulted. The `economic_rule_snapshot` on the collectible is the authoritative source.

The primary issuance event does not alter: canonical authority, authorship, provenance, or the collectible's issuance-attached economic terms.

**Secondary Transfer Event**

Triggered when an authorised collectible changes ownership after original issuance.

Two separate records are created:

1. **OwnershipTransfer** — records the change of ownership; does not generate economic entitlements directly
   - `transfer_id`
   - `collectible_id`
   - `from_owner_ref`
   - `to_owner_ref`
   - `transferred_at`
   - `transfer_basis` — the transaction or mechanism that authorised the transfer
   - `economic_event_id` — reference to the associated EconomicEvent; null if no secondary economics apply to this collectible

2. **EconomicEvent** (event_type = `secondary-transfer`) — created only where the collectible carries secondary economic terms
   - `collectible_id`
   - `transfer_id` — reference to the OwnershipTransfer record
   - `waterfall_version_id` — resolved from the collectible's `secondary_waterfall_id` + `secondary_waterfall_version` (issuance-attached); immutable
   - `economic_basis` — the transfer price or defined economic basis
   - `attribution_snapshot` — snapshot of attribution at transfer time; immutable

Rule resolution for secondary transfer: the collectible's `secondary_waterfall_version` is always used. If `secondary_waterfall_id` is null on the collectible, no secondary EconomicEvent is created. Platform defaults cannot override issuance-attached secondary terms.

**Ownership / Economic Entitlement Separation**

An OwnershipTransfer always occurs when a collectible changes hands. A secondary EconomicEvent occurs only where the collectible's issuance terms provide for it. These are independent records. A transfer that generates no secondary economics still produces a complete OwnershipTransfer record and updates `current_owner_ref` on the collectible. The canonical state, provenance, authorship, and issuance-attached economic terms of the collectible are unaffected by any transfer.

**Invariants:**
- Primary issuance always uses the collectible's `primary_waterfall_version`; never the current platform default.
- Secondary transfer always uses the collectible's `secondary_waterfall_version`; never the current platform default.
- OwnershipTransfer is always created on transfer; secondary EconomicEvent is created only where secondary economics exist.
- Transfer history on the collectible is append-only; entries are never removed.
- No transfer event modifies canonical state, provenance, authorship, or canonical authority.

---

### A7 — Consumption / Advertising Economics

`ARCHITECTURAL DECISION` **A7** (2026-08-17, founder-established)

Consumption and advertising economics use a distinct event model from collectible issuance and transfer. The critical architectural distinction is between attributed and unattributed activity, which must be determined from source data — never fabricated.

**Attribution Determination**

Before creating a consumption/advertising EconomicEvent, the platform must determine whether the activity is attributable to a specific work. Attribution is supported when the source data (stream session, page view, ad impression, interaction record) contains a traceable reference to a specific Master, CanonicalState, Projection, or Interpretation.

Attribution is not supported when:
- the activity is platform-level (e.g. homepage advertising, general discovery)
- the source data does not contain a traceable work reference
- the work reference cannot be verified against the canonical/provenance chain

**Work-Attributed Consumption Event**

EconomicEvent fields:
- `event_type` = `consumption` or `advertising`
- `attributed` = `true`
- `master_id` — the attributed Master; immutable
- `canonical_state_id` — the canonical state applicable at the time of consumption; immutable
- `projection_id` — the specific projection consumed where determinable; may be null
- `collectible_id` — null (consumption economics are not collectible economics)
- `attribution_basis` — the source data field or mechanism that established attribution (e.g. stream_session_id, ad_placement_ref); immutable
- `attribution_snapshot` — immutable snapshot of the attribution record (creator, collaborators, featured artists, interpretation creator where applicable) as it stood at calculation time
- `waterfall_version_id` — resolved via the A4 rule resolution algorithm for the consumption/advertising channel, walking from work-level attachment to platform default; immutable once set
- `economic_basis` — the revenue amount attributable to this work for this period/event
- `occurred_at` — the period or timestamp of the consumption activity

Where the consumed work is an Interpretation, the attribution chain is:
```
Interpretation → source Creative Moment → Master
```
Both the Interpretation creator's entitlement and the underlying Creative Moment's entitlement are resolved from the applicable waterfall. The waterfall for an Interpretation consumption event may define participation for both layers; the economic engine does not assume they are identical.

**Unattributed Platform-Level Event**

EconomicEvent fields:
- `event_type` = `advertising` (or `platform-consumption`)
- `attributed` = `false`
- `master_id` = null
- `canonical_state_id` = null
- `attribution_basis` = null
- `attribution_snapshot` = null
- `waterfall_version_id` — resolved from the platform/channel default waterfall for unattributed advertising; this waterfall directs revenue to Mighty Verse platform revenue unless an explicit allocation rule has been established
- `economic_basis` — the unattributed revenue amount for this period

Unattributed events are not automatically redistributed to creators. If a future allocation rule is introduced, it is a new WaterfallVersion with a new `effective_from`. Historical unattributed events remain governed by the waterfall version that applied when they occurred.

**Attribution Correction**

If attribution is subsequently discovered to be incorrect (wrong work attributed, attribution fabricated, provenance mismatch):

```
EconomicEvent A (attributed = true, master_id = X) → status: corrected
EconomicEvent B (correction_of: A, correction_type: correction)
  → may be attributed = false, or attributed = true with corrected master_id
  → new attribution_snapshot
  → new waterfall resolution
  → new EconomicEntitlement records
```

The original event and its original entitlements are preserved. The correction establishes the adjusted position.

**Advertising Revenue Classification**

An advertising impression is not automatically a creator royalty event. The economic engine classifies each advertising event as attributed or unattributed based on source data, then resolves the applicable waterfall. The waterfall determines whether and how creators participate. The platform does not force every advertisement into a creator waterfall.

**Invariants:**
- `attributed = true` requires a valid `master_id` traceable through the provenance chain. This is a hard constraint enforced at event creation.
- `attribution_snapshot` is immutable once set on an event.
- Unattributed events default to platform revenue; no automatic creator redistribution.
- Future allocation rules for unattributed revenue must be new WaterfallVersions with explicit `effective_from`; they do not rewrite historical events.
- Interpretation consumption events resolve both Interpretation-layer and Creative Moment-layer economics from the applicable waterfall; neither layer is assumed to be zero.
- Consumption/advertising EconomicEvents never carry `collectible_id`; collectible economics are a separate event type.

### A8 — Settlement Lifecycle

`ARCHITECTURAL DECISION` **A8** (2026-08-17, founder-established)

The settlement lifecycle is a state machine on EconomicEntitlement. States and transitions are formally defined. Thresholds and periods are configurable economic rules, not hard-coded constants.

**States**

- `Calculated` — entitlement has been determined; not yet eligible for settlement
- `Accrued` — accumulating toward a configured threshold or settlement period
- `Payable` — threshold or period met; eligible for settlement
- `Settled` — settlement completed via a SettlementRecord
- `Held` — settlement temporarily blocked by a legitimate condition (validation, dispute, compliance, provenance, attribution)
- `Reversed` — economic position cancelled or corrected through a subsequent correction/reversal event

**Valid transitions**

```
Calculated  → Accrued
Calculated  → Payable
Calculated  → Held
Accrued     → Payable
Accrued     → Held
Payable     → Settled
Payable     → Held
Payable     → Reversed  (via correction/reversal event only)
Held        → Payable
Held        → Reversed  (via correction/reversal event only)
Settled     → Reversed  (via correction/reversal event only; never by modifying the SettlementRecord)
```

No other transitions are valid. A state change must be recorded with a timestamp and reason.

**SettlementThresholdConfig** (configurable economic rule, not a hard-coded constant)
- `config_id`
- `participant_role` — the role this threshold applies to; may be platform-wide or role-specific
- `channel` — the economic channel this threshold applies to
- `minimum_amount` — the minimum accrued amount before an entitlement becomes Payable
- `settlement_period` — optional: a time-based period after which accrued entitlements become Payable regardless of amount
- `currency`
- `effective_from`; `effective_to`; `version`

An entitlement below the configured threshold remains in `Accrued` state. It is never erased. Crossing the threshold transitions it to `Payable`. The threshold configuration is versioned; a change to the threshold does not retroactively alter the state of existing entitlements.

**SettlementRecord** (carried from A5, formalised here)
- `settlement_id`
- `entitlement_ids` — one or more EconomicEntitlement records being settled
- `settlement_amount`; `currency`
- `settled_at`
- `settlement_method` — `web2-payment`, `web3-transfer`, `other`
- `settlement_ref` — external payment or transaction reference
- `settlement_state` — `completed`, `pending`, `failed`

A SettlementRecord is never modified after creation. A failed settlement creates a new SettlementRecord attempt; it does not modify the original. A reversal of a settled entitlement is handled through the A9 correction model, not by modifying the SettlementRecord.

**Invariants:**
- Only the defined transitions are valid; any other state change is a data integrity violation.
- `Settled → Reversed` requires an explicit correction/reversal EconomicEvent; the SettlementRecord is never modified.
- Threshold and period configuration is versioned; changes apply to future eligibility determinations only.
- An entitlement in any state remains permanently in the historical record.

---

### A9 — Economic Corrections and Reversals

`ARCHITECTURAL DECISION` **A9** (2026-08-17, founder-established)

Corrections and reversals are new EconomicEvents. Original records are never modified or deleted. The historical chain is always reconstructable.

**Correction EconomicEvent**

Additional fields beyond the standard A5 EconomicEvent:
- `correction_of` — `event_id` of the original event being corrected; immutable
- `correction_type` — `correction`, `reversal`, `refund`, `attribution-correction`, `provenance-correction`, `participant-correction`, `rule-correction`
- `correction_reason` — human-readable description of why the correction was made
- `correction_basis` — reference to the source of the correction (e.g. updated attribution record, dispute resolution record, cancelled transaction reference)

When a correction event is created:
1. The original EconomicEvent's `status` is set to `corrected` or `reversed` (the only permitted mutation on an original event record)
2. Affected original EconomicEntitlements transition to `Reversed` settlement state
3. The correction EconomicEvent generates new EconomicEntitlement records reflecting the adjusted position
4. The new entitlements proceed through the normal settlement lifecycle

**Correction applies to:**
- incorrect attribution (`attribution-correction`) — wrong work attributed; provenance mismatch
- disputed provenance (`provenance-correction`) — source relationship challenged
- cancelled transaction — primary issuance or secondary transfer cancelled
- refund — payment returned; economic position unwound
- incorrect participant (`participant-correction`) — wrong participant identified in entitlement
- incorrect rule application (`rule-correction`) — wrong waterfall version applied
- other legitimate economic corrections

**Historical chain invariant:**

```
EconomicEvent A  [status: corrected]
  └── EconomicEntitlement A1  [settlement_state: Reversed]
  └── EconomicEntitlement A2  [settlement_state: Reversed]

EconomicEvent B  [correction_of: A, correction_type: attribution-correction]
  └── EconomicEntitlement B1  [new participant, Calculated]
  └── EconomicEntitlement B2  [adjusted amount, Calculated]
```

The original event and entitlements remain permanently in the record. The correction event establishes the adjusted position. Both are always queryable. The net economic position is derived by reading the full chain, not by reading only the latest state.

**Invariants:**
- Original EconomicEvent records are never deleted.
- The only permitted mutation on an original event is setting `status` to `corrected` or `reversed` when a correction event references it.
- Original EconomicEntitlement `entitlement_amount` and `calculated_at` are never modified; only `settlement_state` transitions are permitted.
- Every correction event must carry `correction_of`, `correction_type`, and `correction_reason`.
- Corrections may alter the current economic position; they never erase the historical position.

---

### A10 — Web2 / Web3 Boundary

`ARCHITECTURAL DECISION` **A10** (2026-08-17, founder-established)

Mighty Verse is Web2-first and Web3-optional. The Web2 architecture is authoritative for all canonical, provenance, identity, ownership, economic, and access state. Web3 provides an optional additional representation or settlement rail.

**Web2 is authoritative for:**
- canonical identity (Master, CanonicalState, Projection)
- provenance records
- participant identity and attribution
- collectible identity and ownership records
- economic rules (WaterfallDefinition, WaterfallVersion)
- economic events and entitlements
- settlement state
- access control

**Web3 may optionally represent:**
- collectible ownership proof (token on a chain)
- provenance verification (on-chain hash or reference)
- secondary transfer execution
- economic settlement (on-chain payment)
- public verifiability of selected canonical/provenance hashes

**Web3 reference fields** (optional on relevant records):
- `web3_token_ref` — chain/network identifier + contract identifier + token identifier
- `web3_provenance_ref` — on-chain transaction or record that anchors a provenance hash
- `web3_settlement_ref` — on-chain transaction that executed a settlement

These fields are representations or proofs. They are never the primary source of truth for the records they annotate.

**Collectible identity direction:**

```
Collectible (Mighty Verse record)
  └── web3_token_ref  →  on-chain token  (optional)
```

Not:

```
on-chain token  →  collectible identity  (prohibited as primary model)
```

A wallet is an optional participant capability. It is not the identity of the participant. Participant identity is held in the Identity Layer (A13).

**Web3 settlement path:**

```
EconomicEntitlement  →  SettlementRecord  →  web3_settlement_ref  →  on-chain transaction
```

The on-chain transaction confirms the settlement mechanism. It does not redefine the entitlement calculated by Mighty Verse.

**Failure boundary:**

Web3 infrastructure, wallet access, or a specific chain may be unavailable without making the core platform unavailable. When Web3 is unavailable:
- canonical records remain available
- provenance remains available
- ownership records remain available (Web2 record is authoritative)
- economic history remains available
- Web2 settlement remains possible where applicable
- Web3-specific features degrade gracefully; they do not cascade to platform failure

**Invariants:**
- Mighty Verse canonical state is not blockchain state. A blockchain cannot acquire canonical authority through technical implementation.
- Core platform participation (discovery, consumption, participation) requires no wallet, no cryptocurrency, no blockchain transaction.
- Web3 references on Mighty Verse records are optional annotations; their absence does not invalidate the record.
- Web3 settlement is one valid `settlement_method` on SettlementRecord; it does not alter the EconomicEvent or EconomicEntitlement model.
- Chain, token standard, contract model, and wallet provider are not selected here; they remain part of A14.

### A11 — Canonical Authority Enforcement

`ARCHITECTURAL DECISION` **A11** (2026-08-17, founder-established)

Canonical authority is a first-class access-control domain, entirely separate from ownership, authorship, provenance, and economic entitlement. It is enforced at the application layer on every operation that modifies canonical state.

**AuthorityRecord**

- `authority_id` — unique identifier; immutable
- `holder_ref` — reference to the Participant identity record of the authority holder
- `authority_type` — `ultimate` (Mighty Verse / Golden Shovel only), `delegated`
- `scope_type` — `platform`, `master`, `mural`, `catalogue`, `creative-domain`, `other-bounded`
- `scope_subject_id` — the specific Master, Mural, catalogue, or domain this authority covers; null for platform-level
- `capabilities` — explicit list of granted capabilities (see below)
- `delegated_from` — `authority_id` of the parent authority that granted this delegation; null for ultimate authority
- `effective_from` — immutable
- `effective_to` — null if currently active; set on revocation
- `revoked` — boolean
- `revoked_at` — timestamp; null until revoked
- `revoked_by` — authority_id that performed the revocation
- `revocation_reason`
- `created_at`; `created_by`; `authorisation_evidence`

**Defined capabilities** (explicit enumeration; not inferred):
- `create-canonical-state` — may create a new CanonicalState on the scoped Master(s)
- `advance-master-state` — may advance `Master.current_state_id`
- `authorise-projection` — may designate a Projection as an authorised representation
- `designate-collectible` — may mark a Projection as collectible
- `authorise-interpretation` — may authorise an Interpretation relationship
- `delegate-authority` — may create a new AuthorityRecord delegating a subset of own capabilities
- `revoke-delegation` — may revoke a delegated AuthorityRecord within own scope

**Authority validation on canonical operations**

Every operation that modifies canonical state must pass all of:
1. Caller's `participant_id` resolves to an active AuthorityRecord
2. AuthorityRecord is not revoked (`revoked = false`, `effective_to` is null or in the future)
3. AuthorityRecord's `scope_subject_id` covers the target Master (or scope_type is `platform`)
4. AuthorityRecord's `capabilities` includes the required capability for this operation
5. For `create-canonical-state`: target `parent_state_id` matches `Master.current_state_id` (prevents forked lineage)
6. Required provenance and attribution fields are present and valid

Any failure rejects the operation. The rejection is logged with reason.

**Revocation behaviour**

Revoking an AuthorityRecord sets `revoked = true` and `effective_to`. It does not:
- invalidate CanonicalStates created while the authority was valid
- invalidate Projections authorised while the authority was valid
- alter provenance records established while the authority was valid
- alter economic events calculated while the authority was valid

The historical lineage of work produced under a valid authority is preserved. The revocation prevents only future operations.

**Enforcement invariants:**
- Ownership of a collectible, Web3 token, wallet, or projection grants zero canonical capabilities.
- Attribution (being a collaborator or featured artist) does not grant canonical capabilities.
- Economic entitlement does not grant canonical capabilities.
- Web3 ownership does not grant canonical capabilities.
- Ultimate authority (`authority_type = ultimate`) may only be held by Mighty Verse / Golden Shovel; it is not delegatable as ultimate.
- A delegated authority may only grant capabilities it itself holds; it cannot escalate.
- All canonical operations are logged with the `authority_id` used; this log is append-only.

---

### A12 — Media and Projection Delivery

`ARCHITECTURAL DECISION` **A12** (2026-08-17, founder-established)

Media delivery is the outermost layer. It references projections; it does not define them. The canonical source of truth for any media asset is the Projection record, not the delivery URL or storage location.

**Entity separation**

Five distinct entities, each with its own identity:

**MediaAsset** — a stored media file or data object
- `asset_id`
- `asset_type` — original, transcode, streaming-variant, thumbnail, preview, downloadable, metadata
- `storage_ref` — location in storage infrastructure; mutable (assets may be moved without changing identity)
- `integrity_hash` — content hash of the asset; immutable once set; changes if asset content changes (new asset_id required)
- `format`; `resolution`; `duration` where applicable
- `created_at`

**ProjectionMediaBinding** — the relationship between a Projection and its MediaAssets
- `binding_id`
- `projection_id` — immutable reference to the Projection
- `asset_id` — reference to the MediaAsset
- `binding_type` — primary, variant, thumbnail, preview, downloadable
- `access_level` — public, authenticated, owner-only, collector-only
- `created_at`; `created_by`

Replacing a delivery asset creates a new MediaAsset and a new ProjectionMediaBinding. The Projection record and its `canonical_state_id` are unaffected.

**DeliveryVariant** — a specific delivery configuration for a MediaAsset
- `variant_id`
- `asset_id`
- `delivery_format` — streaming, progressive-download, HLS, DASH, etc.
- `endpoint_ref` — CDN or delivery endpoint reference; mutable
- `access_policy_ref` — reference to the access policy governing this variant

**Canonical provenance from media**

A media URL or delivery endpoint does not carry canonical provenance. Provenance is resolved by:

```
DeliveryVariant → MediaAsset → ProjectionMediaBinding → Projection → canonical_state_id → CanonicalState → master_id → Master
```

This chain must be resolvable for any authorised delivery. A media asset that cannot be traced to a Projection through this chain is not an authorised canonical delivery.

**Consumption instrumentation**

Media playback and activity telemetry produces consumption signals. These signals are evidence, not automatic economic entitlements.

**ConsumptionSignal** — a raw telemetry record
- `signal_id`
- `session_ref` — the playback or interaction session
- `participant_ref` — the consuming participant; may be anonymous
- `projection_id` — the projection being consumed; resolved from the delivery context
- `master_id` — denormalised from projection for attribution
- `canonical_state_id` — denormalised from projection
- `signal_type` — play, pause, complete, interaction, ad-impression, ad-view
- `occurred_at`
- `attribution_confidence` — high (direct projection reference), medium (inferred), low (platform-level only)

The economic engine reads ConsumptionSignals to determine whether an EconomicEvent should be created. `attribution_confidence = low` signals enter the unattributed platform pool. Only `high` confidence signals support `attributed = true` on an EconomicEvent.

**Access control**

`ProjectionMediaBinding.access_level` governs delivery authorisation:
- `public` — no authentication required
- `authenticated` — platform account required
- `owner-only` — collectible ownership required (resolved via Collectible ownership record)
- `collector-only` — any designated collectible ownership required

Access control is enforced at the delivery layer. It does not alter the Projection or CanonicalState records.

**Invariants:**
- Replacing a media asset never modifies Projection identity, `canonical_state_id`, provenance, ownership, or economic history.
- A media URL is not canonical provenance. Provenance is always resolved through the entity chain.
- ConsumptionSignals are evidence; they do not automatically create EconomicEntitlements.
- `attribution_confidence = low` signals never support `attributed = true` on an EconomicEvent.
- Access control is a delivery concern; it does not alter canonical or economic records.

---

### A13 — Identity and Participant Model

`ARCHITECTURAL DECISION` **A13** (2026-08-17, founder-established)

A Participant is the stable internal identity for any actor in the Mighty Verse platform. External identities, wallets, and Web3 references are linked to a Participant; they do not replace it.

**Participant**

- `participant_id` — stable internal identifier; immutable; never changes regardless of external identity changes
- `created_at`; `status` — active, suspended, deleted (soft)

**IdentityLink** — an external identity linked to a Participant
- `link_id`
- `participant_id` — immutable reference to the Participant
- `identity_type` — `web2-account`, `email`, `oauth-provider`, `wallet`, `web3-did`, `isrc-party`, `other`
- `identity_ref` — the external identifier
- `verified` — boolean
- `verified_at`
- `active` — boolean; a link may be deactivated without deleting the Participant
- `created_at`

A Participant may have multiple IdentityLinks of different types. A wallet is one IdentityLink of type `wallet`. Changing or removing a wallet deactivates that IdentityLink; it does not alter `participant_id` or any historical records referencing it.

**Identity direction:**

```
Participant → IdentityLink (wallet, web2-account, etc.)
```

Not:

```
wallet → Participant identity
```

**ParticipantRole** — explicit role assignment; not inferred

- `role_id`
- `participant_id`
- `role_type` — `canonical-creator`, `collaborator`, `featured-artist`, `interpretation-creator`, `collector`, `audience`, `authorised-canonical-authority`, `delegated-authority`, `mighty-verse-platform`, `director`, `other`
- `scope_subject_id` — the Master, Mural, or other entity this role applies to; null for platform-wide roles
- `scope_type`
- `effective_from`; `effective_to`; `active`
- `granted_by`; `created_at`

A Participant may hold multiple ParticipantRoles simultaneously. Roles are explicit and contextual; they are never inferred from ownership, wallet possession, or economic entitlement.

**Attribution**

Attribution references `participant_id`, not external identities. This ensures attribution records remain stable even when a participant's external identities change.

**AttributionRecord** — the attribution state for a canonical work at a point in time
- `attribution_id`
- `master_id` (or `canonical_state_id` for state-specific attribution)
- `entries` — list of AttributionEntry records
- `created_at`; `version`

**AttributionEntry**
- `participant_id`
- `role_type` — the creative role (original-artist, director, collaborator, featured-artist, interpretation-creator, etc.)
- `contribution_description` — optional human-readable description
- `public` — whether this attribution entry is publicly visible

Attribution snapshots on EconomicEvents reference `attribution_id` + `version`, ensuring historical economic calculations remain reproducible even if attribution is later corrected.

**Privacy separation**

Four distinct identity visibility levels:
- `public-attribution` — publicly visible creative role on a work (e.g. "Director of Mural X")
- `private-participant` — internal platform identity; not publicly exposed
- `operational-identity` — identity used for platform operations, moderation, support
- `economic-payment-identity` — payment/settlement details; strictly access-controlled

A public provenance record references `participant_id` and `role_type` only where `public = true` on the AttributionEntry. Private identity details are never exposed through provenance queries.

**Invariants:**
- `participant_id` is immutable and permanent. It is never reassigned or reused.
- Wallet changes deactivate an IdentityLink; they do not alter `participant_id` or historical records.
- Roles are explicit ParticipantRole records; they are never inferred from ownership, wallet, or economic entitlement.
- Creative authorship (ParticipantRole) does not automatically grant canonical authority (AuthorityRecord).
- Ownership (Collectible.current_owner_ref) does not automatically grant any ParticipantRole.
- Economic entitlement (EconomicEntitlement.participant_ref) does not automatically grant any ParticipantRole or AuthorityRecord.
- Attribution snapshots on EconomicEvents reference the attribution state at calculation time; later attribution corrections do not rewrite historical snapshots.

### A14 — Technology Selection

`ARCHITECTURAL DECISION` **A14** (2026-08-17, founder-established)

Technology is selected to implement the constitutional and architectural model. No selection redefines or collapses the nine authoritative systems established in A1–A13.

---

#### 1. Application / UI

| Field | Decision |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI runtime | React |
| Component system | shadcn/ui (architectural decision; not reconsidered) |
| Styling | Tailwind CSS (required by shadcn/ui architecture) |
| Component composition | shadcn/ui primitives and composable patterns; no parallel proprietary framework |

**shadcn/ui MCP — verified current state (2026-08-17)**

The official `shadcn` CLI (v4.18.0, published 2026-08-13) ships a built-in MCP server at `shadcn/mcp`. This is an official capability, not a third-party package. The MCP server exposes eight tools:

- `get_project_registries` — reads configured registries from `components.json`
- `list_items_in_registries` — lists available components with pagination
- `search_items_in_registries` — fuzzy search across registries
- `view_items_in_registries` — detailed component info including file content
- `get_item_examples_from_registries` — full usage examples with code
- `get_add_command_for_items` — generates the correct `shadcn add` CLI command
- `get_audit_checklist` — post-generation checklist for component correctness

The MCP server is invoked via `npx shadcn mcp` and communicates over stdio. It reads `components.json` from the project root to discover configured registries. This must be incorporated into the Mighty Verse development workflow so AI-assisted development uses correct component APIs, discovers available components, and stays aligned with the shadcn/ui architecture.

**Owns:** UI rendering, component composition, user interaction
**Does not own:** canonical state, provenance, ownership, economic entitlement, access control
**Replaceability:** UI layer is replaceable; domain/economic/identity layers are unaffected

---

#### 2. Core Database

| Field | Decision |
|---|---|
| Primary database | Supabase / PostgreSQL (one Supabase project for Mighty Verse) |
| Authoritative system of record | All nine domain entity groups (A1–A13) |
| Access control | Row Level Security (RLS) enforced at database layer |
| Realtime | Supabase Realtime for appropriate subscription use cases |
| Edge functions | Supabase Edge Functions for server-side operations requiring database access |
| MCP | `@supabase/mcp-server-supabase` (v0.10.0) available for AI-assisted database operations |

Firebase is not introduced. No second database is introduced at this stage; if a dedicated time-series or event-store is required for EconomicEvent volume, it is evaluated as a separate architectural decision before adoption.

PostgreSQL satisfies all A1–A13 requirements: immutable-by-convention append-only records (enforced via RLS + application layer), versioned records, referential integrity, auditability, and RLS-based access control per entity type.

**Owns:** authoritative persistence for all nine domain entity groups
**Does not own:** media delivery, on-chain state, payment execution
**Replaceability:** high migration cost; schema must be treated as constitutional infrastructure

---

#### 3. Media / Storage

| Field | Decision |
|---|---|
| Object storage | Supabase Storage (primary) for media assets within the platform boundary |
| Durable/public media | IPFS via Pinata (v2.5.6) for assets requiring durable public addressability and provenance anchoring |
| Integrity | `integrity_hash` (content hash) on every MediaAsset; stored in PostgreSQL |
| CDN | Supabase Storage CDN for authenticated/access-controlled delivery; Pinata gateway for IPFS-pinned public assets |

Neither IPFS, Pinata, nor a CDN URL becomes canonical authority. Provenance is always resolved through the entity chain: `DeliveryVariant → MediaAsset → ProjectionMediaBinding → Projection → CanonicalState → Master`.

**Owns:** asset storage and delivery
**Does not own:** canonical state, provenance, collectible identity
**Replaceability:** storage layer is replaceable; `storage_ref` on MediaAsset is mutable; `integrity_hash` and entity chain are unaffected by storage migration

---

#### 4. Video / Streaming

| Field | Decision |
|---|---|
| Video infrastructure | Livepeer (`livepeer` v3.5.0, `@livepeer/react` v4.3.6) |
| Role | MediaAsset / DeliveryVariant → streaming → ConsumptionSignal |
| Consumption telemetry | Livepeer playback events feed ConsumptionSignal records in PostgreSQL |

Livepeer is not authoritative for canonical state, provenance, ownership, or economic entitlement. Consumption telemetry from Livepeer is evidence; it does not automatically create EconomicEntitlements. `attribution_confidence` is determined by whether the playback session carries a resolvable `projection_id`.

**Owns:** video transcoding, streaming delivery, playback infrastructure
**Does not own:** canonical state, provenance, economic entitlement
**Replaceability:** Livepeer is replaceable at the DeliveryVariant layer; ConsumptionSignal schema is independent of the streaming provider

---

#### 5. Automation

| Field | Decision |
|---|---|
| Workflow automation | n8n (v2.34.6, self-hosted) |
| Role | Media processing workflows; attribution processing; EconomicEvent generation triggers; settlement workflows; notifications; external distribution |

n8n operates against the authoritative application systems (Supabase, application API). It does not hold the authoritative economic ledger. Canonical operations triggered through n8n must pass through the application layer's AuthorityRecord validation — n8n tool access does not equal canonical authority.

**Owns:** workflow orchestration and integration
**Does not own:** canonical state, economic ledger, authority
**Replaceability:** n8n workflows are replaceable; the authoritative records they write to are in PostgreSQL

---

#### 6. AI / MCP Architecture

| Role | Technology | Boundary |
|---|---|---|
| Mighty Verse constitutional guardian | Amazon Q with `.mighty-verse/` context | Read-only constitutional reference; no canonical writes without human approval |
| shadcn/ui component discovery | `shadcn` CLI MCP (`npx shadcn mcp`) | UI layer only; reads `components.json`; no domain writes |
| Database operations | `@supabase/mcp-server-supabase` | Reads schema; assists query/migration authoring; no autonomous canonical writes |
| Workflow automation | n8n MCP (if available) | Workflow authoring only |

**MCP invariants:**
- No MCP agent may bypass AuthorityRecord validation on canonical operations
- Tool access does not equal canonical authority
- MCP agents propose; humans approve canonical state changes
- The MCP layer operates against authoritative application systems; it does not become an alternative source of truth
- shadcn/ui MCP is scoped to UI layer operations only

---

#### 7. Web3 / On-Chain Architecture

**thirdweb current-state assessment (verified 2026-08-17)**

thirdweb has undergone a major architectural revision since V1. The current package is `thirdweb` v5.121.0 (unified SDK, replacing the legacy `@thirdweb-dev/sdk` v4.x which is still published at v4.0.99 but is the legacy package).

thirdweb v5 capability surface (from verified export paths):
- `./react` — React hooks and components for wallet connection and contract interaction
- `./wallets` + `./wallets/in-app` — wallet connectivity including in-app wallets (email/social login without external wallet required)
- `./auth` — authentication via wallet signature
- `./contract` + `./extensions/*` — contract interaction and standard extension patterns (ERC-721, ERC-1155, etc.)
- `./deploys` — contract deployment tooling
- `./engine` — thirdweb Engine (managed backend infrastructure for server-side Web3 operations)
- `./transaction` — transaction building and sending
- `./storage` — IPFS storage integration
- `./pay` — payment/checkout infrastructure
- `./bridge` — cross-chain bridging
- `./insight` — on-chain data indexing/analytics
- `./ai` — AI integration capabilities
- `./social` — social/identity features
- `./tokens` — token utilities
- `./chains` — multi-chain support
- `./x402` — HTTP 402 payment protocol support

thirdweb v5 is materially different from V1's implementation. Key relevant changes: unified SDK (no separate `@thirdweb-dev/sdk`), in-app wallets (email/social login without requiring MetaMask), Engine for server-side operations, and a significantly expanded chain support surface.

**thirdweb v5 evaluation against Mighty Verse requirements:**

| Requirement | thirdweb v5 | Assessment |
|---|---|---|
| Web2-first (no wallet required for core participation) | In-app wallets + Web2 auth path | Satisfies — wallet not required for consumption |
| Optional collectible tokenisation | ERC-721/1155 via `./extensions/*` | Satisfies |
| Optional on-chain ownership | `./contract` + `./wallets` | Satisfies |
| Optional secondary transfer | ERC-721 transfer + Engine | Satisfies |
| Optional provenance anchoring | `./storage` (IPFS) | Satisfies |
| Optional Web3 settlement | `./pay` + `./transaction` | Satisfies |
| Server-side Web3 operations | Engine (`./engine`) | Satisfies — important for backend economic operations |
| Multi-chain portability | `./chains` (broad chain support) | Satisfies |
| AI/MCP integration | `./ai` export present | Requires further investigation before use |
| Identity direction (Participant → wallet, not wallet → Participant) | In-app wallets support this model | Satisfies with correct implementation |

**Decision: thirdweb v5 is selected as the Web3 infrastructure layer.**

Rationale: thirdweb v5 satisfies all Mighty Verse Web3 requirements, supports the Web2-first model via in-app wallets, provides Engine for server-side operations (critical for economic event integrity), and has materially evolved from V1. The legacy `@thirdweb-dev/sdk` v4 is not used.

**Alternatives evaluated and rejected:**

| Alternative | Reason rejected |
|---|---|
| viem + wagmi alone | Lower-level; requires more custom infrastructure for wallet management, contract deployment, and server-side operations; thirdweb v5 wraps viem internally |
| OpenZeppelin alone | Contract standards library only; not a full Web3 infrastructure solution |
| Direct chain SDK | Insufficient abstraction for multi-chain portability requirement |

viem (v2.55.17) and wagmi (v3.7.6) remain available as lower-level primitives where thirdweb v5 adapters are insufficient; thirdweb v5 uses viem internally.

**Chain selection:**

| Requirement | Assessment |
|---|---|
| Transaction cost | Ethereum mainnet too expensive for collectible-scale operations |
| EVM compatibility | Required for thirdweb v5 and OpenZeppelin contract standards |
| Ecosystem maturity | Established L2 ecosystem preferred |
| Wallet support | Broad wallet support required |
| Developer tooling | Strong tooling required |
| Long-term viability | Established network required |

**Decision: Base (Ethereum L2) as primary chain.**

Rationale: Base is an Ethereum L2 with low transaction costs, strong EVM compatibility, broad wallet support, Coinbase ecosystem backing (long-term viability), and first-class thirdweb v5 support. It avoids Ethereum mainnet gas costs while retaining EVM contract standards (ERC-721, ERC-1155) and Ethereum security model. Chain portability is preserved via thirdweb v5's multi-chain architecture; Base is the default, not a lock-in.

**Contract standards:**
- ERC-721 for unique collectibles (Cards, individual Editions)
- ERC-1155 for edition collectibles (multiple copies of the same Edition)
- OpenZeppelin v5.6.1 contract implementations

**Owns:** optional on-chain token representation, optional Web3 settlement, wallet connectivity
**Does not own:** canonical state, provenance, economic entitlement calculation, participant identity
**Replaceability:** Web3 layer is replaceable at the `web3_token_ref` boundary; Mighty Verse records are unaffected by chain migration

---

#### 8. Identity / Authentication

| Field | Decision |
|---|---|
| Web2 authentication | Supabase Auth (email, OAuth providers) |
| Participant identity | Internal `participant_id` in PostgreSQL (stable, immutable) |
| Wallet connection | thirdweb v5 in-app wallets + external wallet support |
| Web3 identity | `IdentityLink` record of type `wallet` linked to `participant_id` |
| Role enforcement | `ParticipantRole` records in PostgreSQL; enforced at application layer |
| Authority enforcement | `AuthorityRecord` in PostgreSQL; validated on every canonical operation |

Authentication does not automatically grant authority. Supabase Auth session → `participant_id` lookup → `ParticipantRole` / `AuthorityRecord` check is the enforced path.

**Owns:** session management, external identity linking
**Does not own:** canonical authority, participant roles, economic entitlement

---

#### 9. Payments / Settlement

| Field | Decision |
|---|---|
| Web2 payment infrastructure | Stripe (v22.5.0) |
| Settlement execution | Stripe for Web2 settlement; thirdweb v5 `./pay` + `./transaction` for Web3 settlement |
| Entitlement records | PostgreSQL (EconomicEntitlement, SettlementRecord) — authoritative |
| Settlement method | `settlement_method` on SettlementRecord distinguishes `web2-payment` from `web3-transfer` |

Stripe and thirdweb execute settlement. They do not become authoritative for EconomicEntitlement. The SettlementRecord in PostgreSQL is the authoritative record of what was settled, referencing the external payment/transaction reference.

**Owns:** payment execution
**Does not own:** EconomicEntitlement calculation, economic history

---

#### 10. Search / Indexing

| Field | Decision |
|---|---|
| Initial search | PostgreSQL full-text search (sufficient for initial scale) |
| Read projections | PostgreSQL views and materialised views for common query patterns |
| Future dedicated search | Deferred; to be evaluated when PostgreSQL search is demonstrably insufficient |

A dedicated search layer (e.g. Algolia, Typesense) remains a future option. If introduced, it is a read model only — never authoritative for canonical state, provenance, ownership, or economic history.

---

#### 11. Deployment / Infrastructure

| Field | Decision |
|---|---|
| Application hosting | Vercel (Next.js-native deployment) |
| Background workers | Supabase Edge Functions + n8n for workflow automation |
| Secrets / configuration | Vercel environment variables + Supabase Vault |
| Observability | To be selected; must not become authoritative for canonical records |
| Backups | Supabase automated backups; point-in-time recovery |
| Disaster recovery | Supabase project backup + restore; canonical records must survive infrastructure failure |

Infrastructure failure must not redefine canonical history. The PostgreSQL database is the authoritative record; infrastructure is replaceable around it.

---

#### 12. Technology Selection Matrix

| Layer | Technology | Owns | Does Not Own | If Unavailable |
|---|---|---|---|---|
| Application / UI | Next.js 16 + React + shadcn/ui + Tailwind | UI rendering, routing, user interaction | Domain state, economic state | UI unavailable; domain records unaffected |
| Core database | Supabase / PostgreSQL | All nine authoritative domain entity groups | Media delivery, on-chain state, payment execution | Platform unavailable; records preserved in backup |
| Media storage | Supabase Storage + IPFS/Pinata | Asset storage and delivery | Canonical state, provenance, collectible identity | Delivery unavailable; entity chain and integrity_hash unaffected |
| Video / streaming | Livepeer | Video transcoding, streaming, playback | Canonical state, economic entitlement | Streaming unavailable; canonical/economic records unaffected |
| Automation | n8n | Workflow orchestration | Canonical authority, economic ledger | Workflows paused; authoritative records unaffected |
| AI / MCP | Amazon Q + shadcn MCP + Supabase MCP | Development assistance | Canonical authority, autonomous writes | Development tooling unavailable; platform unaffected |
| Web3 infrastructure | thirdweb v5 | On-chain token representation, wallet connectivity, Web3 settlement | Canonical state, provenance, economic entitlement calculation | Web3 features unavailable; Web2 platform fully operational |
| Chain | Base (EVM L2) | On-chain token state | Mighty Verse canonical identity | On-chain features unavailable; Web2 records authoritative |
| Identity / auth | Supabase Auth + thirdweb wallets | Session management, external identity linking | Canonical authority, participant roles | Authentication unavailable; records preserved |
| Payments | Stripe + thirdweb Pay | Payment execution | EconomicEntitlement calculation, economic history | Settlement paused; entitlement records preserved |
| Search | PostgreSQL FTS | Read projections | Canonical state, provenance, ownership, economic history | Search degraded; authoritative records unaffected |
| Deployment | Vercel | Application hosting | Canonical records | Platform unavailable; database records preserved |
| Automation | n8n (self-hosted) | Workflow execution | Authoritative records | Workflows paused; records unaffected |

---

#### 13. shadcn/ui MCP — Development Workflow Integration

The official shadcn MCP server is invoked as:

```
npx shadcn mcp
```

It requires `components.json` in the project root (created by `npx shadcn init`). The MCP server must be configured in the Mighty Verse `.amazonq/mcp.json` development configuration so that AI-assisted development can discover components, view usage examples, and generate correct `shadcn add` commands without inventing component APIs.

The eight tools exposed cover the full component development workflow: discovery → detail → examples → add command → audit. This is the official mechanism; the third-party `shadcn-mcp` package (v1.0.0, community-maintained) is not used.

---

#### 14. Mighty Verse MCP / Agent Architecture

| Agent | Technology | Scope | Write boundary |
|---|---|---|---|
| Constitutional guardian | Amazon Q + `.mighty-verse/` rules | Full constitutional context | No autonomous canonical writes |
| UI development | shadcn MCP (`npx shadcn mcp`) | UI layer only | `shadcn add` commands; no domain writes |
| Database assistance | `@supabase/mcp-server-supabase` | Schema and query assistance | Migration authoring only; no autonomous schema changes |
| Workflow automation | n8n | Workflow execution | Writes via application API only; AuthorityRecord enforced |

No agent bypasses AuthorityRecord. No agent becomes an alternative source of truth.

---

#### 15. Implementation Dependency Order

```
1. Supabase project + schema (A1–A13 entity groups)
2. AuthorityRecord + canonical authority enforcement
3. Participant + IdentityLink + ParticipantRole
4. Master + CanonicalState + ProvenanceRecord
5. Projection + ProjectionMediaBinding
6. WaterfallDefinition + WaterfallVersion + RuleAttachment
7. Next.js application scaffold (shadcn/ui init + MCP configuration)
8. Authentication (Supabase Auth + participant identity)
9. MediaAsset + DeliveryVariant + Livepeer integration
10. Collectible + OwnershipTransfer
11. EconomicEvent + EconomicEntitlement + SettlementRecord
12. ConsumptionSignal + attribution pipeline
13. n8n workflow automation
14. thirdweb v5 Web3 integration (optional layer)
15. Stripe payment integration
16. Vercel deployment
```

---

#### 16. Final Architecture Object Flow

```
[Participant] ──identified by──> [participant_id]
  └── [IdentityLink] (web2, wallet, web3-did)
  └── [ParticipantRole] (creator, collector, director, etc.)
  └── [AuthorityRecord] (canonical operations only)

[AuthorityRecord] ──validates──> canonical operations on:
  └── [Master] ──lineage──> [CanonicalState v1] ──> [CanonicalState v2] ...
        └── [ProvenanceRecord] (append-only lineage graph)
        └── [Projection] ──derives from──> [CanonicalState]
              └── [ProjectionMediaBinding] ──> [MediaAsset] ──> [DeliveryVariant]
              └── [Collectible] ──issued from──> [Projection]
                    └── [OwnershipTransfer] (append-only)
                    └── [web3_token_ref] (optional → Base chain via thirdweb v5)

[ConsumptionSignal] (from Livepeer telemetry)
  └── attribution_confidence check
  └── ──> [EconomicEvent] (attributed or unattributed)
        └── [WaterfallVersion] (resolved via RuleAttachment hierarchy)
        └── [EconomicEntitlement] × N participants
              └── settlement_state machine (A8)
              └── [SettlementRecord] (Stripe or thirdweb Pay)

[n8n] ──orchestrates──> media workflows, economic triggers, notifications
  └── writes via application API only
  └── AuthorityRecord enforced on all canonical operations

[shadcn MCP] ──assists──> UI development only
[Supabase MCP] ──assists──> schema and query authoring only
[Amazon Q] ──guards──> constitutional context
```

---

#### 17. Remaining Unresolved Items

The following are not resolved by A14 and remain open for subsequent phases:

- Exact percentage values for WaterfallParticipantEntry (Phase 4 deferred; requires founder decision)
- Specific ERC-721 vs ERC-1155 selection per collectible class (requires collectible class definitions)
- thirdweb v5 `./ai` capability — requires further investigation before use in MCP architecture
- Specific n8n workflow designs for economic event triggers and settlement
- Observability stack selection
- ISRC and music industry rights identifier integration model
- The three Interpretation style names and definitions (open since Phase 1)
- Full audience role taxonomy
- Full artist experience model

---

#### 18. Architecture Contradiction Check

| Constitutional principle | Architecture implementation | Status |
|---|---|---|
| Canonical authority non-transferable | AuthorityRecord enforced at application layer; ownership/wallet/token grant zero capabilities | ✅ |
| Collectibles are projections, not Masters | Collectible references Projection → CanonicalState; never replaces it | ✅ |
| Provenance append-only | ProvenanceRecord immutable once created; PostgreSQL RLS enforces no-delete | ✅ |
| Economic history non-erasable | EconomicEvent append-only; corrections are new events; original status field only permitted mutation | ✅ |
| Issuance-attached economic terms immutable | economic_rule_snapshot immutable on Collectible; waterfall_version_id immutable on EconomicEvent | ✅ |
| Web3 supplementary | thirdweb v5 is optional layer; web3_token_ref is nullable; core platform requires no wallet | ✅ |
| Free tier / no paywall | Supabase Auth supports unauthenticated access; access_level on ProjectionMediaBinding controls gating | ✅ |
| UI not authoritative for domain state | shadcn/ui is presentation layer; all domain state in PostgreSQL | ✅ |
| Seven concepts remain distinct | Nine separate entity groups in PostgreSQL; no single token/table collapses them | ✅ |
| Mighty Verse canonical state ≠ blockchain state | Collectible identity direction: Mighty Verse record → web3_token_ref (not reverse) | ✅ |

---

## Architectural Layer Model

`ARCHITECTURAL DECISION` **Layer separation** (2026-08-17, founder-established)

The following layers are mandatory and must remain technically distinct. A lower layer must never become the authoritative source of state belonging to a higher layer.

```
Domain / Canonical Layer
  Master, canonical states, provenance, projections

Economic Layer
  Ownership, entitlement, waterfalls, economic events, settlement

Identity Layer
  Participants, attribution, Web2/Web3 identity

Media Layer
  Media assets, streaming and projection delivery

Application Layer
  Discovery, consumption, participation, collection, advertising, experiences

UI / Design System Layer
  shadcn/ui, official components, templates/presets, MCP-assisted development

Infrastructure Layer
  Database, storage, delivery, indexing, deployment, optional Web3 infrastructure
```

A UI component must never become the authoritative source of canonical, provenance, ownership, or economic state. Domain state is independently represented and rendered by UI components, not defined by them.

---

## UI / Design System Architecture

`ARCHITECTURAL DECISION` **shadcn/ui as foundational UI component system** (2026-08-17, founder-established)

shadcn/ui is the foundational UI component system for Mighty Verse. This is an architectural decision, not an implementation preference.

- Use official shadcn/ui component primitives and composable patterns.
- Use available official shadcn/ui templates, presets, layouts, and design conventions as the starting UI vocabulary.
- Prefer composition of shadcn/ui components over creating a parallel proprietary component framework.
- Preserve the ability to customise Mighty Verse's visual identity while remaining structurally compatible with shadcn/ui.
- Treat the shadcn/ui component layer as presentation infrastructure, not as the source of truth for canonical, provenance, ownership, or economic state.
- Use shadcn/ui-compatible patterns for responsive, accessible, mobile-first and desktop interfaces.

`ARCHITECTURAL DECISION` **shadcn/ui MCP integration** (2026-08-17, founder-established)

The official shadcn/ui MCP capability and current MCP tooling must be investigated before implementation begins. If the official shadcn/ui MCP integration is available and appropriate, it must be incorporated into the development workflow so that AI-assisted development can: discover available components; use correct component APIs and conventions; compose interfaces from the established component system; reduce arbitrary generated UI patterns; and keep AI-assisted implementation aligned with the shadcn/ui architecture. Do not invent an MCP integration or assume undocumented capabilities. Verify the current official shadcn/ui MCP implementation and use the official mechanism where appropriate.
