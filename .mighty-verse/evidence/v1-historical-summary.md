# V1 Historical Summary

Evidence from the original Mighty Verse implementation, extracted and classified from source material
provided 2026-08-17. Classifications are preserved from the source extraction — they are not
upgraded or downgraded here.

---

## 1. Original Cultural / Product Idea

`SOURCE` Mighty Verse was conceived to give African creative culture a canonical home.

`SOURCE` Golden Shovel is the founding artist and platform owner.

`SOURCE` The founding vision was that Mighty Verse would be the canonical source rather than
merely a streaming service. The original deck remains at Mighty Verse while external platforms
receive projections.

`SOURCE` The platform was not conceived as fundamentally paywall or subscription locked.

`SOURCE` The core creative units established in V1:
- **Song / Mural** — the complete world/deck
- **Verse / Scene / Featured Moment** — a Creative Moment within that world
- Creative Moments can have multiple **Interpretations**
- Different interpretation styles represent legitimate cultural perspectives
- A Mural has a **Director**

`SOURCE` Three interpretation styles were identified in V1 as representing distinct cultural
perspectives. The specific names/definitions of those three styles are
`UNKNOWN / TO BE ESTABLISHED` from the supplied material — the existence of three styles is
confirmed; their exact taxonomy is not reproduced here to avoid invention.

`SOURCE` **Audience roles** were defined in V1. The specific role taxonomy is
`UNKNOWN / TO BE ESTABLISHED` from the supplied material at this level of detail.

`SOURCE` **Artist experience** was a defined concern in V1 — how artists interact with and
contribute to the universe. The specific model is `UNKNOWN / TO BE ESTABLISHED`.

---

## 2. Proposed Business / Economic Model

`SOURCE` **Collecting / ownership** was a defined concept in V1. Cards or Creative Moments
could be owned/collected.

`SOURCE` **Sponsorship / advertising** was a defined concept in V1 as a revenue mechanism.

`SOURCE` **ISRC legitimacy** was identified — the platform engaged with standard music industry
rights identifiers, not only Web3 mechanisms.

`SOURCE` The platform was not conceived as fundamentally paywall/subscription locked, suggesting
a mixed or tiered access model was intended.

`HISTORICAL` The specific economic model, pricing, revenue splits, and token mechanics from V1
are `UNKNOWN / TO BE ESTABLISHED` from the supplied material at this level of detail and must
not be carried forward as V2 requirements.

---

## 3. Web3 Mechanisms Used in V1

`HISTORICAL` V1 used **ThirdWeb** as the smart contract deployment framework.

`HISTORICAL` V1 used **smart contracts** for ownership/settlement. The specific contract
architecture, chain, and token standard are `UNKNOWN / TO BE ESTABLISHED` from the supplied
material at this level of detail.

`HISTORICAL` V1 used **IPFS** for durable media storage and provenance.

`HISTORICAL` V1 used **wallet** concepts for user ownership.

`HISTORICAL` V1 used **blockchain** mechanisms for ownership and settlement.

`LESSON` ThirdWeb, the specific contracts, and the specific chain used in V1 are historical
implementation choices. They are not constitutional requirements for V2.

`LESSON` IPFS as a durable media/provenance mechanism survives as a valid option (not a
requirement) for V2. See `02-canon.md`.

---

## 4. Technical Architecture (V1)

`HISTORICAL` V1 used **Supabase** as the database. The V1 Supabase schema is explicitly
classified as historical and must not become V2 architecture.

`HISTORICAL` V1 used **React Three Fiber** for 3D/spatial rendering. This is a historical
implementation choice, not a constitutional requirement.

`HISTORICAL` V1 used **Livepeer** for media delivery. This is a historical implementation
choice, not a constitutional requirement.

`HISTORICAL` V1 had a **disconnected upload → mural pipeline**. The upload path and the
processing/rendering path were never properly connected.

`HISTORICAL` V1 had a **JSON-based disconnected processing pipeline** — processing steps
communicated via JSON files rather than a coherent pipeline.

`HISTORICAL` V1 had **dual dashboards** — two separate dashboard surfaces that were not
unified. This is classified as an architectural inconsistency, not a pattern to replicate.

`HISTORICAL` V1 had a **V1 URL structure** and **V1 component names** that are explicitly
classified as historical and must not be carried forward.

`HISTORICAL` V1 had a **V1 MCP/agent taxonomy** and **V1 agent implementation** that are
explicitly classified as historical. The Mighty Verse MCP/agent model for V2 must be
established independently.

---

## 5. V1 AI Tools and Processing

`HISTORICAL` V1 used the following specific AI tools for layer extraction and spatial processing:
- **MiDaS** — depth estimation
- **SAM** (Segment Anything Model) — segmentation
- **CLIP** — semantic understanding / classification

`HISTORICAL` V1 had **V1 tuning constants** for these models. These are historical
implementation details, not constitutional requirements.

`LESSON` These tools represent one possible implementation of the AI adaptation capability.
They are not the only valid approach and are not required in V2.

`LESSON` AI layer extraction is an adaptation capability for legacy/external media. It is not
a mandatory production assumption for native Mighty Verse content. This distinction survives
from V1 as canonical. See `02-canon.md`.

---

## 6. V1 Failures and Architectural Inconsistencies

`LESSON` **The animation was not actually playing in V1.** The real processing path was never
properly connected. The V1 implementation appeared to function in parts but the end-to-end
pipeline from upload to rendered spatial output was broken.

`LESSON` **The upload → mural pipeline was disconnected.** Content could be uploaded but the
path to a complete, rendered Mural was not operational.

`LESSON` **The JSON/disconnected processing pipeline** created fragility and made it difficult
to trace the state of any given piece of content through the system.

`LESSON` **Dual dashboards** created confusion about where canonical state lived and who had
authority over it.

`LESSON` **V1 agent taxonomy** was not constitutionally grounded. Agents were built around
implementation concerns rather than canonical meaning. This is the origin of the Master MCP
concept for V2 — agents must be constitutionally anchored.

`LESSON` **Context loss is architecture debt, not merely documentation debt.** When the
constitutional meaning of Mighty Verse is not encoded in the system, implementation drift
occurs. V1 demonstrated this.

---

## 7. What Was Explicitly Rejected for V2

The following V1 elements are explicitly classified as rejected — they must not become V2
architecture:

`HISTORICAL / REJECTED` V1 Supabase schema
`HISTORICAL / REJECTED` V1 smart contracts and ThirdWeb as a specific dependency
`HISTORICAL / REJECTED` V1 agent taxonomy and MCP implementation
`HISTORICAL / REJECTED` V1 URL structure
`HISTORICAL / REJECTED` V1 component names
`HISTORICAL / REJECTED` V1 JSON/disconnected processing pipeline
`HISTORICAL / REJECTED` Specific V1 AI tools (MiDaS, SAM, CLIP) as requirements
`HISTORICAL / REJECTED` V1 tuning constants
`HISTORICAL / REJECTED` V1 dual dashboards
`HISTORICAL / REJECTED` The disconnected upload → mural pipeline pattern

---

## 8. What Survives from V1 as Canonical Meaning

The following were present in V1 and survive as canonical — not because they were implemented
in V1, but because the source material explicitly classifies them as canonical meaning:

`CANONICAL` Mighty Verse gives African creative culture a canonical home.
`CANONICAL` Song = world. Mural = complete expression of that world.
`CANONICAL` A Creative Moment (verse/scene/featured moment) is a meaningful unit within a world.
`CANONICAL` Creative Moments can have multiple Interpretations.
`CANONICAL` Different interpretation styles represent legitimate cultural perspectives.
`CANONICAL` A Mural has a Director.
`CANONICAL` The Master is the canonical source. External platforms receive projections.
`CANONICAL` The platform is not fundamentally paywall/subscription locked.
`CANONICAL` ISRC legitimacy — standard rights identifiers are relevant, not only Web3 mechanisms.
`CANONICAL` 2.5D is a spatial representation of creative moments, not a visual gimmick.
`CANONICAL` Two legitimate media creation paths exist: native production and legacy adaptation.
`CANONICAL` AI extraction is an adaptation capability, not a mandatory production assumption.

---

## 9. What Survives as Direction / Inference (Not Yet Canonical)

The following were present in V1 and survive as directional — they informed V1 and may inform
V2, but are not yet formally established as canonical:

`SOURCE` Collecting / ownership of Cards or Creative Moments as a concept.
`SOURCE` Sponsorship / advertising as a revenue mechanism.
`SOURCE` Audience roles as a defined model.
`SOURCE` Artist experience as a defined concern.
`SOURCE` Three interpretation styles as a taxonomy (existence confirmed; definitions not yet
formally established for V2).
`SOURCE` Human-in-the-loop governance as a philosophy (agents propose, humans approve).

---

## 10. Unresolved Questions Carried Forward from V1

These questions were present in V1 and remain unresolved. They must not be answered by
assumption:

`OPEN QUESTION` The specific three interpretation style names and definitions.
`OPEN QUESTION` The full audience role taxonomy.
`OPEN QUESTION` The specific economic model (pricing, revenue splits, token mechanics).
`OPEN QUESTION` The specific rights model (ownership, licensing, royalties, attribution).
`OPEN QUESTION` The specific Web3 chain, contract standard, and token model for V2.
`OPEN QUESTION` Whether V2 uses Supabase, a different database, or a different persistence model.
`OPEN QUESTION` Whether V2 uses Livepeer, IPFS, or alternative media delivery.
`OPEN QUESTION` The V2 agent taxonomy and MCP architecture.
`OPEN QUESTION` The V2 processing pipeline architecture.
`OPEN QUESTION` The full artist experience model.
`OPEN QUESTION` The full audience experience model.
`OPEN QUESTION` Whether Mighty Verse expands beyond Golden Shovel's catalogue.
