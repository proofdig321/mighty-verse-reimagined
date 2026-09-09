# Stage 4.2 — CREATE → CURATE → CREATIVE STUDIO

Product-facing workspace reconciliation. The Google Studio wireframe is a visual reference, not a spec.

## Roles

- **Create Work** — establish the canonical work and start source-media intake.
- **Curate** — state-derived hub for an existing Universe. Friendly path into mural registration, Sentinel review, Scene establishment, Creative Moment registration, Studio, Experience preview.
- **Creative Studio** — existing Creative Suite at `/authority/universes/{id}`. Precision composition.
- **Experience** — public `/worlds/{id}` and holographic. Distinct from Studio preview.
- **Sentinel** — evidence and derived intelligence. Not creative authority.

## Implemented

- Derived Curate Hub (`src/lib/assemble/curate-hub.ts`) from `UniverseAssembly` + `media_upload_session` + `inspection_session`.
- Workspace journey chrome and Creative Studio nav entry (same `/authority/universes` route).
- Create Work completion continues primarily in Curate.
- Contextual Add Creative Moment from Curate (existing master/state/projection APIs).

## Rejected from the wireframe

- Mint Mural / wallet / blockchain as a creative prerequisite
- Zustand or persisted `UniverseProjectState`
- New `/workspace/*` routes
- NLE multi-track editor
- Three.js
- Sentinel bulk-apply to canonical objects
- Fake processing percentages
- Speculative job/workflow tables

## Not proven

A brand-new browser file upload through Create Work after Stage 4.1. Do not claim fresh Mux Direct Upload reliability.

## Schema

**No migration.** Super Hero Ego must remain unchanged.
