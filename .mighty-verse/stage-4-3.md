# Stage 4.3 — Curate child routes

Loop closed: Curate is a hub that **routes**, not a long page that appends sections.

## User path

- `/authority/curate` — incoming media + Universe picker only.
- `/authority/curate/{id}` — Curate Hub (derived live state).
- `/authority/curate/{id}/mural` — Register Mural (existing API).
- `/authority/curate/{id}/moment` — Add Creative Moment (existing APIs).
- `/authority/curate/{id}/sentinel` — Sentinel Scene establishment (existing `CurateClient`).

Legacy `/authority/curate?universe={id}` redirects to the hub. Bound `?asset=` stays on the incoming catalogue.

## PM recommendations (closed)

- **Scene creation** stays on Curate Sentinel. Studio authors existing Scenes.
- **Timeline tracks** deferred. Do not invent a new media model.
- **Rights checklist vs Experience** is a presentation/ontology distinction. No backend change.

## Preserved

Existing APIs, Super Hero Ego, no Zustand, no `/workspace/*`, no minting, no NLE, no Three.js, no migration.

## Not proven

Fresh browser Create Work upload.
