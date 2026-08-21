# Build 10 — Media Realization, Performance & Rights Architecture Discovery

**Status:** DISCOVERY ONLY — no implementation, no schema changes, no commits  
**Base commit:** `801dc66` — Build 09: correct Creative Moment artist attribution  
**Date:** 2026-08-21

---

## 1. Current Model — Exact Entity Meanings

### master
The root canonical identity record for a creative work. It is not a media file and not a
performance. It is the authoritative identity of the work across all time, all versions, and
all realizations. `created_by` identifies the registering canonical authority — not the
creative contributor. `canonical_type` is one of: `song-world`, `mural`, `creative-moment`,
`interpretation`, `other`. `parent_master_id` expresses the structural hierarchy
(World → Mural, World → Creative Moment). `attribution_ref` points to the attribution record
for this work.

### canonical_state
An immutable versioned snapshot of a master at a point in time. It records what the work
*is* at that version — not how it is delivered. `content_refs` (JSONB) holds references to
associated content, but the canonical state is not itself a media file. `attribution_snapshot_ref`
freezes the attribution as it stood at this version. Once created, a canonical state is never
modified.

### projection
A derived representation of a specific canonical state. It is the bridge between the canonical
domain and the delivery/experience domain. `projection_type` is one of: `experiential`,
`distributional`, `archival`, `collectible-designated`, `other`. A projection is authorised by
a canonical authority. It is not a media file. It is the *authorisation* to deliver the
canonical work in a particular context. `collectible_designated` is an explicit flag — never
inferred.

### media_asset
A technical record of a stored media file. Fields: `asset_type`, `storage_ref` (mutable —
assets may be moved), `integrity_hash` (immutable once set), `format`, `resolution`,
`duration_ms`. Critically: **`media_asset` has no owner field, no rights field, no
participant reference, and no provenance reference.** It is a pure technical descriptor.

### projection_media_binding
The join between a projection and a media_asset. Fields: `binding_type` (primary, variant,
thumbnail, preview, downloadable), `access_level`, `created_by` (participant who performed
the binding). This is a technical binding record. It does not assert rights over the asset.
It does not assert that the projection authority owns the asset. It records only that this
projection uses this asset in this binding role.

### delivery_variant
A technical delivery endpoint for a media_asset. `delivery_format` (hls, dash, etc.),
`endpoint_ref` (mutable CDN endpoint), `access_policy_ref`. No rights or ownership fields.

### attribution_record / attribution_entry
Attribution is scoped to a `master` (and optionally a `canonical_state`). It records creative
roles: `original-artist`, `director`, `collaborator`, `featured-artist`,
`interpretation-creator`, `other`. Attribution is about creative contribution to the canonical
work — not about ownership of a recording or rights to a media file.

### participant / authority_record
`participant` is the identity record for any actor in the system. `authority_record` grants
scoped capabilities over canonical operations. Neither record has a field for media ownership,
recording rights, or broadcast rights.

### provenance_record
Records the lineage relationship between entities. `relationship_type` values: `canonical-revision`,
`projection`, `interpretation`, `derivative`, `collectible-issuance`. Provenance is about
canonical lineage — not about media ownership or recording provenance.

### work_presentation / projection_presentation
Application-layer display metadata (title, description, artwork). Explicitly outside the
canonical domain. No rights or ownership fields.

### collectible
References its projection, canonical state, master, provenance, and economic terms — all
immutable at issuance. `current_owner_ref` is the only mutable field. Ownership attaches to
the projection, not the master. No field for recording rights or media ownership.

---

## 2. Existing Super Hero Ego Media Chain

### World chain

```
master (song-world)
  master_id:        05ccc0c6-75f9-4864-b0c1-af5e36bf45cc
  created_by:       866390ff (Golden Shovel — registering authority)
  attribution_ref:  → attribution_record
                      → entry: original-artist → 866390ff (Golden Shovel)
                      → entry: director        → 866390ff (Golden Shovel)
  current_state_id: abe7b1c0-afb6-4786-a4c8-622e1da31602
    │
    └── canonical_state (v1, authorised)
          canonical_state_id: abe7b1c0
          provenance_ref: → provenance_record (canonical-revision, root, public=true)
          │
          └── projection (experiential)
                projection_id:    a66a93b6
                provenance_ref:   → provenance_record (projection of abe7b1c0, public=true)
                │
                └── projection_media_binding (primary, public)
                      binding_id: (World binding)
                      asset_id:   bda79051-6bc9-497f-b0aa-12d95130290c
                        │
                        └── media_asset
                              storage_ref:    5a112ddzzuvlq3a5 (Livepeer playback ID)
                              asset_type:     streaming-variant
                              integrity_hash: (Livepeer asset hash)
                              │
                              └── delivery_variant (hls)
                                    endpoint_ref: Livepeer HLS URL
```

### Mural chain

```
master (mural)
  master_id:        a75ae8af-7b48-4b67-8392-d89447bae370
  parent_master_id: 05ccc0c6 (World)
  created_by:       866390ff (Golden Shovel — registering authority)
  attribution_ref:  → attribution_record
                      → entry: director → 866390ff (Golden Shovel)
  current_state_id: 8f7fe56d-0269-476d-b925-4567c461ee5e
    │
    └── canonical_state (v1, authorised)
          canonical_state_id: 8f7fe56d
          provenance_ref: → provenance_record (canonical-revision, root, public=true)
          │
          └── projection (experiential)
                projection_id:    2e68a8d6-6b15-4d16-a0d9-2ea290815f21
                provenance_ref:   → provenance_record (projection of 8f7fe56d, public=true)
                │
                └── projection_media_binding (primary, public)
                      binding_id: 17294363-9ac2-44c9-bbb5-0fe358b07f86
                      asset_id:   bda79051 ← SAME asset as World projection
                        │
                        └── media_asset (shared)
                              storage_ref: 5a112ddzzuvlq3a5
```

### What the shared asset means in the current model

The same `media_asset` (`bda79051`) is bound to both the World projection and the Mural
projection. The `ingestLivepeerAsset()` idempotency logic explicitly supports this: when the
same Livepeer playback ID is encountered for a second projection, it reuses the existing
`media_asset` and creates only a new `projection_media_binding`. This is architecturally
correct — the same recording can legitimately serve two canonical projection contexts.

What the current model does NOT record: who owns or controls that recording, under what
licence it is used, or whether the rights holder for the recording is the same party as the
canonical authority for the World or Mural.

### Creative Moment chain (Proverb, Reason, Mothipa)

```
master (creative-moment) × 3
  parent_master_id: 05ccc0c6 (World)
  attribution_ref:  → attribution_record
                      → entry: featured-artist → correct participant (post-Build-09)
  current_state_id: → canonical_state (v1, authorised)
  NO projections
  NO media bindings
```

Creative Moments currently have no projection and no media. They are canonical identity
records only.

---

## 3. Ownership / Provenance Analysis — The Ten Distinctions

The discovery prompt identifies ten distinct concepts. Here is what the current model can and
cannot represent for each:

**1. Ownership/authority of the underlying canonical work**
→ REPRESENTED. `authority_record` with `scope_type = 'master'` and `scope_subject_id =
master_id`. Golden Shovel holds ultimate platform authority. This is correctly modelled.

**2. Creative attribution**
→ REPRESENTED. `attribution_entry` with `role_type` (original-artist, director,
featured-artist, etc.) linked to `participant`. Correctly separated from registering authority
since Build 05.

**3. Ownership/control of a particular recording**
→ NOT REPRESENTED. `media_asset` has no owner field, no rights field, no participant
reference. The current model cannot say "Party A owns this recording." There is no mechanism
to assert that the rights holder for `bda79051` is Golden Shovel, a label, a production
company, or any other party.

**4. Ownership/control of visual footage**
→ NOT REPRESENTED. Same gap as (3). An animated video's visual realization, an SABC 1
broadcast recording, or any independently produced footage has no ownership representation
in the current schema.

**5. Performer/contributor to a particular performance**
→ PARTIALLY REPRESENTED. `attribution_entry` can record a `featured-artist` or `collaborator`
on a master. But this attribution is scoped to the canonical work (master), not to a specific
performance or recording. There is no way to say "Proverb performed on the SABC 1 recording
specifically" as distinct from "Proverb is a featured artist on the canonical World."

**6. Broadcaster/platform relationship**
→ NOT REPRESENTED. There is no entity in the current schema for a broadcaster, platform
licence, or broadcast event. SABC 1 as a rights holder or broadcast partner has no
representation.

**7. Projection of a canonical work**
→ REPRESENTED. `projection` is exactly this. A projection is the authorised delivery context
for a canonical state. The current model correctly separates projection from the canonical
work.

**8. Media asset used by that projection**
→ REPRESENTED. `projection_media_binding` links a projection to a `media_asset`. The
technical binding is correctly modelled.

**9. Licensing/permission to use that media asset**
→ NOT REPRESENTED. `projection_media_binding` records that a projection uses an asset. It
does not record the licence under which that use is permitted, who granted that licence, or
what the terms are. There is no licence or permission record in the schema.

**10. Provenance of a media realization**
→ NOT REPRESENTED for media. `provenance_record` tracks canonical lineage (canonical-revision,
projection, interpretation, collectible-issuance). It does not track the production provenance
of a media file — who produced it, when, under what commission, from what source material.

---

## 4. Current Capability

The existing architecture correctly and safely handles:

- Canonical identity of a work across all versions (master + canonical_state)
- Creative attribution separated from registering authority
- Multiple projections of the same canonical state (World projection, Mural projection)
- The same media asset serving multiple projections without duplication
- Provenance lineage from canonical state through projection to collectible
- Economic entitlements attached to projections and collectibles
- Collectible ownership (web2/web3) separated from canonical authority
- Append-only correction chains for economic events
- Authority delegation scoped to specific masters

The architecture already correctly separates:
- canonical work identity ≠ media file
- projection ≠ canonical state
- ownership of collectible ≠ canonical authority
- registering authority ≠ creative contributor (established Build 05)

---

## 5. Current Gap

The architecture cannot currently represent:

**Gap A — Media ownership/rights holder**
There is no way to assert that a specific `media_asset` is owned or controlled by a specific
participant. An animated video produced by Party A and an SABC 1 broadcast recording are
indistinguishable from a rights perspective in the current model — both are just `media_asset`
rows with a `storage_ref`.

**Gap B — Recording/realization provenance**
There is no way to record the production provenance of a media file: who commissioned it, who
produced it, what source material it derives from, when it was created, under what agreement.
`provenance_record` tracks canonical lineage, not media production lineage.

**Gap C — Multiple independent media realizations of the same canonical work**
The current model supports multiple projections of the same canonical state, and each
projection can have its own media binding. However, there is no semantic distinction between:
- a projection that uses a media asset the canonical authority controls, and
- a projection that uses a media asset owned by an independent third party.
Both look identical in the schema. This conflation is the core risk.

**Gap D — Performance as a distinct concept**
A live SABC 1 performance is not a canonical state revision. It is not a new master. It is
not a projection in the current sense (projections are authorised by the canonical authority).
But it is a real event that depicts the canonical work, may have its own rights holder, and
may need to be referenced in provenance chains (e.g. a tokenized Scene that appears in that
performance). The current model has no entity for this.

**Gap E — Licence/permission record**
There is no record of the terms under which a media asset is used by a projection. If Party A
owns a recording and Mighty Verse uses it in a projection, the licence agreement between them
has no representation in the schema.

**Gap F — Tokenized Scene independence from media rights**
When a Scene is extracted from the Mural and tokenized, the token must reference the canonical
Scene (master → canonical_state → projection) without inheriting the rights of any particular
video in which that Scene appears. The current model has no mechanism to make this separation
explicit. A collectible references its projection, and that projection is bound to a media
asset. If the media asset is independently owned, the collectible implicitly references
independently-owned media — which is incorrect.

---

## 6. Tokenization Implications

The canonical tokenization chain the architecture must support:

```
Mural (master, canonical_state)
  → Scene (extracted canonical unit — future master, canonical_state)
      → Scene projection (collectible-designated)
          → Collectible (token)
              → may be depicted in: animated video (Party A's asset)
              → may be depicted in: SABC 1 performance (broadcaster's asset)
              → may be depicted in: future visualization (unknown party's asset)
```

The collectible must reference the Scene's canonical projection — not any particular video.
The videos that depict the Scene are separate realizations. Their rights belong to their
respective owners. The collectible holder's rights derive from the canonical projection, not
from any video.

This means:

1. The Scene's canonical projection must be bound to a media asset that the canonical
   authority controls (or has clear rights to use for collectible purposes). It must NOT be
   bound to Party A's animated video as its primary collectible asset.

2. Party A's animated video may be represented as a separate realization — a different
   projection type, or a separate entity — with its own rights metadata. The collectible
   can reference or link to that realization without being legally dependent on it.

3. The provenance chain of the collectible must be traceable to the canonical work without
   passing through any independently-owned media asset.

The current architecture does not prevent this from being done correctly — but it also does
not enforce it. A developer could today bind a third-party-owned asset to a
`collectible-designated` projection and issue a collectible against it. The schema would not
object. This is the gap that must be closed before tokenization begins.

---

## 7. Recommended Architectural Boundary

The smallest correct model that preserves all required distinctions:

**Layer 1 — Canonical domain (existing, correct)**
```
master → canonical_state → projection
```
This layer is about what the work IS. It is controlled by the canonical authority.
No changes needed here.

**Layer 2 — Media asset (existing, needs rights metadata)**
```
media_asset
```
Currently a pure technical descriptor. Needs a `rights_holder_ref` (participant FK, nullable)
and optionally a `rights_basis` (text, nullable) to record who controls this asset and under
what basis. This is the minimum addition to close Gap A.

**Layer 3 — Media realization (new concept, minimal)**
A media realization is a specific recording or production of the canonical work. It is not a
canonical state. It is not a projection. It is the production artifact — the animated video,
the SABC 1 recording, the live performance capture. It has:
- a reference to the canonical work it depicts (master_id)
- a rights holder (participant FK)
- a realization type (animated-video, live-performance, broadcast-recording, etc.)
- production provenance (who made it, when, under what commission)
- the media asset(s) it consists of

This is a new table. It sits outside the canonical domain. It does not affect canonical state,
projection, or collectible. It is referenced by projections that use independently-owned media.

**Layer 4 — Projection media binding (existing, needs realization reference)**
`projection_media_binding` currently links projection → media_asset directly. For projections
that use independently-owned media, the binding should optionally reference the realization
record, making the rights context explicit.

**Layer 5 — Collectible (existing, correct)**
No changes needed. The collectible references its projection. If the projection is correctly
bound to canonical-authority-controlled media, the collectible is clean. The realization
records are separate and do not affect collectible provenance.

---

## 8. Proposed Build 10 Scope

An actual implementation gap exists. The gap is real and must be closed before Scene
extraction or tokenization begins. However, the scope is narrow:

**Build 10 implementation (if approved after this report):**

1. Add `rights_holder_ref uuid references participant(participant_id)` (nullable) and
   `rights_basis text` (nullable) to `media_asset`. This closes Gap A with minimal schema
   change. Existing rows remain valid (null = rights holder not recorded, which is the
   current implicit state).

2. Create a `media_realization` table. Minimum columns:
   - `realization_id uuid primary key`
   - `master_id uuid not null references master(master_id)` — the canonical work depicted
   - `realization_type text not null` — e.g. 'animated-video', 'live-performance', 'broadcast-recording'
   - `rights_holder_ref uuid references participant(participant_id)` — who controls this realization
   - `rights_basis text` — licence, commission, ownership basis
   - `production_notes text` — provenance narrative
   - `created_at timestamptz not null default now()`
   - `created_by uuid not null references participant(participant_id)`

3. Add `realization_id uuid references media_realization(realization_id)` (nullable) to
   `projection_media_binding`. This makes the rights context of a binding explicit when the
   media is independently owned.

**What Build 10 does NOT do:**
- Does not create a `performance` table (realization covers this)
- Does not create a `rights` table (rights_holder_ref on media_asset and media_realization is sufficient)
- Does not create an `ownership` table
- Does not modify projection, canonical_state, master, or attribution
- Does not create Scenes, tokens, or collectibles
- Does not modify the economic model

---

## 9. Files / Database Objects Potentially Affected

| Object | Change |
|---|---|
| `media_asset` | Add `rights_holder_ref`, `rights_basis` columns |
| `projection_media_binding` | Add `realization_id` column (nullable FK) |
| `media_realization` | New table |
| New migration file | `20260821020000_media_realization.sql` |
| `src/lib/media/ingest.ts` | No change required — existing ingest path remains valid |
| `src/lib/authority/operations.ts` | `attachMediaBinding` may optionally accept `realizationId` |
| `scripts/build10-*.ts` | New script to register SABC 1 and animated video realizations |
| `.mighty-verse/04-evolution.md` | Build 10 milestone record |

---

## 10. Explicit Non-Goals

- Do not model broadcast licensing terms in detail
- Do not model royalty splits for independently-owned recordings
- Do not create a `performance` entity separate from `media_realization`
- Do not modify the canonical state or projection model
- Do not create Scene records (deferred — Creative Moment ontology audit still open)
- Do not create token records
- Do not model SABC 1 as a platform participant with economic entitlements (separate future decision)
- Do not add rights enforcement logic to RLS policies
- Do not add rights validation to `createProjection` or `attachMediaBinding`

---

## 11. Invariants

These must hold after Build 10:

1. A `collectible-designated` projection must be bound to a media asset where either:
   (a) `rights_holder_ref` is the canonical authority for the master, or
   (b) `rights_holder_ref` is null and the binding has no `realization_id` (legacy/unrecorded)
   This invariant is enforced at the application layer, not by a DB constraint.

2. A `media_realization` record does not alter any canonical state, projection, or collectible.
   It is purely descriptive metadata about a production artifact.

3. `media_asset.rights_holder_ref` is nullable. Null means "not recorded" — not "canonical
   authority owns this." The distinction must be preserved in application logic.

4. Adding `realization_id` to `projection_media_binding` is nullable and backward-compatible.
   All existing bindings remain valid with `realization_id = null`.

5. The canonical provenance chain (master → canonical_state → projection → collectible) must
   never pass through a `media_realization` record. Realization is a parallel domain.

---

## 12. Risks

**Risk 1 — Conflating realization with projection**
If `media_realization` is treated as a projection type, the canonical domain becomes polluted
with independently-owned content. The boundary must be enforced: realizations are not
projections. A projection is authorised by the canonical authority. A realization is produced
by whoever produced it.

**Risk 2 — Retroactive rights assignment**
Adding `rights_holder_ref` to `media_asset` creates the temptation to retroactively assign
rights to existing assets. The current `bda79051` asset (the Super Hero Ego Livepeer video)
has no recorded rights holder. Before assigning one, the founder must confirm who actually
controls that recording.

**Risk 3 — Scene extraction before this gap is closed**
If Scene extraction and tokenization proceed before Build 10 is implemented, collectibles may
be issued against projections that are bound to independently-owned media. Correcting this
after issuance is extremely difficult — collectible economic terms are immutable at issuance.
This is the strongest argument for doing Build 10 before any Scene work.

**Risk 4 — Over-engineering the realization model**
`media_realization` must remain minimal. The temptation to model broadcast agreements,
royalty splits, and platform relationships in this table must be resisted. Those are future
decisions. The table's purpose is to record who controls a realization and what it depicts —
nothing more.

**Risk 5 — Null rights_holder_ref ambiguity**
Null on `rights_holder_ref` must mean "not recorded" — not "Mighty Verse owns this." If the
system treats null as implicit canonical authority ownership, it will silently misrepresent
the rights status of assets ingested before Build 10. Application logic must treat null as
unknown, not as owned.

---

## 13. Recommended Next Sequence

```
Build 10 — media_realization table + rights_holder_ref on media_asset
  ↓
Founder decision: who controls the existing Super Hero Ego recording (bda79051)?
  ↓
Creative Moment ontology audit (already deferred — still required before Scene work)
  ↓
mural_moment_context schema design (Scene/appearance relationship)
  ↓
Scene extraction model (Mural → extracted canonical Scene)
  ↓
Tokenization (Scene → collectible-designated projection → collectible)
```

The sequence `media/rights architecture → Scene extraction → tokenization` is architecturally
correct and safer than any alternative. Specifically:

- Build 10 must precede Scene extraction because a Scene's collectible projection must be
  bound to canonical-authority-controlled media. Without the rights model, there is no way
  to enforce or verify this.

- The Creative Moment ontology audit must precede Scene extraction because the audit
  determines what a Scene IS in the context of the real Super Hero Ego material. Scene
  extraction cannot be designed without that answer.

- Tokenization must come last because collectible economic terms are immutable at issuance.
  Any architectural gap that exists at tokenization time is permanently baked into issued
  collectibles.

**Do not begin Scene extraction or tokenization until Build 10 is implemented and the
Creative Moment ontology audit is complete.**

---

*Build 10 discovery complete. No files modified. No database changes. No commits.*
