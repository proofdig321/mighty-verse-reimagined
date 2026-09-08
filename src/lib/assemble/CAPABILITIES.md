# Creative Suite capabilities

Product: ASSEMBLE / CURATE — the Creative Suite for assembling a complete Universe.
Expressions: Authority now; public-user curation later.
Not EXPERIENCE: do not put playback, Mux, Scene Deck, or public timeline here.

```
CURATE STUDIO  (/authority/curate)
  ├── Incoming media (intake / Sentinel)
  └── Creative Suite  (/authority/universes/{id})
        ├── Identity
        ├── Mural
        ├── Scenes
        └── Creative Moments
```

MEDIA ≠ UNIVERSE. Sentinel inspects; the curator assembles; Authority authorizes; Experience presents.

Creative Moments are related to Scenes via `scene_moment`. They are not owned by the Mural.

| Capability | Location | Data contract | Mutation | Reusable? | Authority? | Experience? | Modularised now? | Reason |
|---|---|---|---|---|---|---|---|---|
| Universe assembly read-model | `src/lib/assemble/load-universe.ts` | `UniverseAssembly` | none (read) | yes | route auth | no | yes | Shared hierarchy |
| Creative Suite sections/nav | `src/lib/assemble/suite.ts` + `creative-suite-nav.tsx` | Identity / Mural / Scenes / Creative Moments | none | yes | hrefs injected | no | yes | Hosts future editors without being an editor |
| Universe assembly presentation | `src/components/assemble/universe-assembly.tsx` | same read-model | none | yes | `openHref` | no | yes | Scenes are suite-level; CMs Universe-parented |
| Hierarchy breadcrumbs | `src/components/assemble/breadcrumb.tsx` | labels + hrefs | none | yes | chrome | no | yes | Ontology chrome |
| Universe identity model/form | `identity.ts` + `universe-identity-form.tsx` | title + description | via injected save | yes | no | no | yes | Stage 2.3 |
| Universe identity mutation | `POST /api/authority/presentation` | `{ master_id, title, description? }` | upsert `work_presentation` | later | yes | no | no | Authority gate; identity-only preserves artwork |
| Universe listing | `/authority/universes` | catalogue rows | none | no | yes | no | no | Authority catalogue |
| Universe create | `POST /api/authority/masters` | `registerMaster` | create master | later | yes | no | no | Later increment |
| Canonical presentation panel | `PresentationPanel` | title, description, MD, artwork | same presentation API | no | yes | no | no | Publishing record, not suite identity |
| Mural identity / expression | suite Mural section; listing `/authority/murals` | mural master + presentation | none in suite | later | listing yes | no | shell only | No Mural editor in 2.4 |
| Curate Studio gateway | `/authority/curate` + `studio.ts` / `load-studio.ts` / `curate-studio-gateway.tsx` | incoming media + association | none | yes (hrefs injected) | route auth | no | yes | Doorway: intake → Sentinel → Creative Suite |
| Associate media with existing Universe | `association.ts` + `associate-with-universe.tsx` + `POST /api/authority/media` `{ asset_id, universe_id }` | bind to existing Mural projection | `projection_media_binding` only | yes (decision/eligibility) | yes | playback consumes | yes | Stage 2.6. No Universe/Mural create. No `media_realization`. Occupied Mural is rejected. |
| `/authority/curate` Sentinel inspect | `curate-client.tsx` | mural-bound HLS, frames, candidates | bind / accept scene (existing) | inspect UI Authority-hosted | yes | no | inspect kept | Evidence only; not Creative Suite |
| Media inspect | `/authority/media/inspect` | asset identity + frames | none canonical | later | yes | no | existing | Asset-level inspect; not a Universe |
| Media intake | `/authority/media/intake` | `media_intake` | create intake | later | yes | no | existing | MEDIA ≠ UNIVERSE |
| Media readiness | `src/lib/media/readiness.ts` | intake / processing / playable / ready | none | yes | no | no | yes | Existing states; no invented workflow table |
| Scene identity / timing / order | suite Scenes section; `POST /api/authority/scenes`; sort-order; timeline PATCH | scene master, binding `start_ms`/`end_ms`, `sort_order` | Authority APIs exist | later | yes | no | shell only | No Scene editor in 2.4 |
| Scene ↔ Creative Moment | `scene_moment` in read-model; `POST/DELETE /api/authority/scene-moment` | primary join | Authority API | later | yes | no | read-model yes | Sharing Proverb is live data, not a defect |
| Creative Moment identity | suite CM section; parent = Universe | master + presentation; `has_experience` | none in suite | later | yes | no | shell only | Not Mural-owned |
| Moment Card / `/moments` / players | `src/components/` | projections | none | no | no | **yes** | no | Do not reuse as assemble UI |
| Public `/worlds`, Scene Deck | `(public)/` | discovery + playback | none | no | no | **yes** | no | EXPERIENCE |
| Media / Mux / bindings / realization / intake | `/authority/media*` | media_asset, bindings, realization | Authority media APIs | later | yes | playback consumes | no | Not this stage |
| Canonical record / publishing | `/authority/[masterId]` | six-stage journey | many | no | yes | no | no | Publishing, not suite |

Future public curator: same suite primitives and identity form; different auth, no Authority privileges, no canonical publishing, no rights/moderation.

Schema: `master`, `work_presentation`, `projection`, `projection_media_binding`, `scene_moment`, `media_asset`, `media_intake`, `inspection_session` already express the required structure. **NO MIGRATION REQUIRED.**

## Product questions after Stage 2.6

- **Sentinel UI persist.** `POST /api/authority/media/inspect` exists; Curate Studio inspection remains ephemeral. Not wired in 2.6 because persist currently requires a `master_id`, and unbound media has none. Provenance quality; deferred.
- Occupied Mural: association does not replace existing Super Hero Ego Mural media. Rebind remains the existing Sentinel mural-media control.
