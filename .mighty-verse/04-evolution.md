# 04 — EVOLUTION

The living record of decisions made, approaches rejected, and lessons learned.
This document grows as Mighty Verse Reimagined progresses.

---

## Architectural Decisions

`ARCHITECTURAL DECISION` **Q environment isolation** (2026-08-17)
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

---

## Rejected Approaches

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
- Structural relationship between Card / Creative Moment / Mural / Song
- What "navigable" means experientially
- Full audience role taxonomy
- Full artist experience model
- Rights, licensing, and royalty model
- Provenance enforcement mechanism
- Audience and access model (free, gated, purchased, earned)
- Web2/Web3 balance and sequencing
- Specific Web3 chain, contract standard, and token model for V2
- AI participation in canonical production
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
