# Mighty Verse Constitution / Master MCP Context

This directory is the authoritative constitutional context for Mighty Verse Reimagined.

## Structure

```
.mighty-verse/
├── README.md                     ← this file
├── AGENT.md                      ← practical working context (start here)
├── 01-soul.md                    ← what Mighty Verse fundamentally is
├── 02-canon.md                   ← canonical concepts and their definitions
├── 03-principles.md              ← product, creative, and architectural principles
├── 04-evolution.md               ← decisions, rejected approaches, lessons, open questions
├── 05-architecture.md            ← deep constitutional model
├── 06-product-vision.md          ← product operating constitution (journey, ontology, how to select work)
└── evidence/
    └── v1-historical-summary.md  ← what the old implementation attempted and what was learned
```

`.mighty-verse/AGENT.md` is the practical working context. `.mighty-verse/06-product-vision.md`
is the product operating constitution for choosing and bounding implementation increments.
From Stage 2.5 onward, agents operate as product lead + architect + implementer against that constitution. The founder remains the ultimate product decision-maker. Do not implement the vision as one giant development task.


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
