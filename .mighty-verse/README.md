# Mighty Verse Constitution / Master MCP Context

This directory is the authoritative constitutional context for Mighty Verse Reimagined.

## Structure

```
.mighty-verse/
├── README.md                     ← this file
├── 01-soul.md                    ← what Mighty Verse fundamentally is
├── 02-canon.md                   ← canonical concepts and their definitions
├── 03-principles.md              ← product, creative, and architectural principles
├── 04-evolution.md               ← decisions, rejected approaches, lessons, open questions
└── evidence/
    └── v1-historical-summary.md  ← what the old implementation attempted and what was learned
```

## Document Status Markers

Documents in this directory use the following markers:

- `SOURCE` — established directly from source material / founder intent
- `CANONICAL` — a principle or definition that has been formally adopted
- `HISTORICAL` — from the old implementation; evidence only, not binding
- `LESSON` — something learned from V1 that informs but does not dictate V2
- `OPEN QUESTION` — a deliberate tension or unresolved decision
- `ARCHITECTURAL DECISION` — a resolved technical or structural choice
- `UNKNOWN / TO BE ESTABLISHED` — information not yet provided; must not be invented

## Authority Rule

If information is not present in this directory with a `SOURCE` or `CANONICAL` marker,
it does not exist as a Mighty Verse decision. Do not infer, extrapolate, or invent it.
