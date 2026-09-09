# Creative Suite capabilities

Product: ASSEMBLE / CURATE — the Creative Suite for assembling a complete Universe.
Expressions: Authority now; public-user curation later.
Not EXPERIENCE: Scene Deck shuffle, public holographic, and public mural/Moment playback stay on `/worlds` and `/moments`. Studio may preview bound Mux source media observationally.

```
CURATE STUDIO  (/authority/curate)
  ├── Incoming media (intake / Sentinel inspect)
  └── Creative Suite  (/authority/universes/{id})
        ├── Production path (derived UI state)
        ├── Identity
        ├── Source (Mux preview of bound media)
        ├── Mural
        ├── Sentinel (evidence, storyboard, animation plan, proposals, authorise)
        ├── 2.5D Studio Preview
        ├── Scenes
        ├── Creative Moments
        └── Experience continuation
```

MEDIA ≠ UNIVERSE. Sentinel inspects and remembers; the curator assembles and authorises; Authority authorizes; Experience presents.

Creative Moments are related to Scenes via `scene_moment`. They are not owned by the Mural.

| Capability | Location | Data contract | Mutation | Reusable? | Authority? | Experience? | Modularised now? | Reason |
|---|---|---|---|---|---|---|---|---|
| Universe assembly read-model | `src/lib/assemble/load-universe.ts` | `UniverseAssembly` | none (read) | yes | route auth | no | yes | Shared hierarchy |
| Creative Suite sections/nav | `src/lib/assemble/suite.ts` + `creative-suite-nav.tsx` | Identity / Source / Mural / Sentinel / Storyboard / 2.5D Preview / Scenes / Creative Moments / Experience | none | yes | hrefs injected | no | yes | Hosts future editors without being an editor |
| Universe assembly presentation | `src/components/assemble/universe-assembly.tsx` + Scene/CM/Mural objects | same read-model | none | yes | `openHref` | no | yes | Composition surface: objects not catalogue tables |
| Creative Suite composition helpers | `src/lib/assemble/composition.ts` | ordinals, short titles, shared CM ids, still params | none | yes | no | no | yes | Studio language; not Experience deck |
| Scene object | `scene-object.tsx` | SuiteScene | identity + timing + order + presence | yes | open record | consumes title + still + window | yes | Face-up, numbered, known. Not facedown. Not a timeline dashboard. |
| Scene identity | `scene-identity.ts` + `scene-identity-authoring.tsx` + `POST /api/authority/presentation` | title + description on `work_presentation` | identity-only upsert; preserves artwork/markdown | yes | yes | titles | yes | Stage 3.3. Names the Scene in Studio. Does not create Scenes. |
| Scene timing | `scene-timing.ts` + `scene-timing-authoring.tsx` + `PATCH /api/authority/media/timeline` | binding `start_ms`/`end_ms` | shapes existing window only | yes | yes | stills + playback windows | yes | Stage 3.5. Compact start/end on the Scene object. Sentinel does not create Scenes. |
| Canonical Scene order | `scene-order.ts` + `scene-order-authoring.tsx` + `PATCH /api/authority/masters/sort-order` | `master.sort_order` 1..n | Move earlier / Move later | yes | yes | Suite + catalogue order | yes | Stage 3.7. Does not import Scene Deck shuffle. |
| Creative Moment object | `creative-moment-object.tsx` | UniverseAssemblyMoment | identity + presence | yes | open record | no | yes | Contributor-centred; Proverb sharing is live data |
| Mural presence | `mural-presence.tsx` | UniverseAssemblyMural | none | yes | open record + public mural link | stills only | yes | Stage presence; Studio source preview is the authoring player |
| Production path | `workflow.ts` + `production-path.tsx` | derived from assembly + intelligence | none | yes | in-suite hashes | no | yes | Stage 4.0 navigation/context. Not a workflow-state table. Not a wizard. |
| Source preview | `load-source-preview.ts` + `source-preview.tsx` | existing Mux binding + Scene windows | none (seek only) | yes | Inspect link | observational | yes | Stage 4.0. Reuses ProjectionMediaPlayer. Does not rebind or rewrite timing. |
| Studio 2.5D Preview | `studio-preview.tsx` | existing holographic layers + Scene stills | none | yes | in-suite toggle | preview only | yes | Stage 4.0. Reuses HolographicStage. Public `/holographic` remains Experience. |
| Relationship focus | `composition-surface.tsx` | hover/focus related ids | none | yes | no | no | yes | Makes shared Proverb visible without a graph |
| Hierarchy breadcrumbs | `src/components/assemble/breadcrumb.tsx` | labels + hrefs | none | yes | chrome | no | yes | Ontology chrome |
| Universe identity model/form | `identity.ts` + `universe-identity-form.tsx` | title + description | via injected save | yes | no | no | yes | Stage 2.3 |
| Universe identity mutation | `POST /api/authority/presentation` | `{ master_id, title, description? }` | upsert `work_presentation` | later | yes | no | no | Authority gate; identity-only preserves artwork |
| Universe listing | `/authority/universes` | catalogue rows | none | no | yes | no | no | Authority catalogue |
| Universe create | `POST /api/authority/masters` | `registerMaster` | create master | later | yes | no | no | Later increment |
| Canonical presentation panel | `PresentationPanel` | title, description, MD, artwork | same presentation API | no | yes | no | no | Publishing record, not suite identity |
| Mural identity / expression | suite Mural section; listing `/authority/murals` | mural master + presentation | none in suite | later | listing yes | no | shell only | No Mural editor in 2.4 |
| Curate Studio gateway | `/authority/curate` + `studio.ts` / `load-studio.ts` / `curate-context.ts` / `curate-studio-gateway.tsx` | incoming media + optional `?asset=` / `?universe=` query context | none | yes (hrefs injected) | route auth | no | yes | Doorway: Gallery / Inspect → Curate → Creative Suite. Context is navigation state, not a new entity. |
| Associate media with existing Universe | `association.ts` + `associate-with-universe.tsx` + `POST /api/authority/media` `{ asset_id, universe_id }` | bind to existing Mural projection | `projection_media_binding` only | yes (decision/eligibility) | yes | playback consumes | yes | Stage 2.6. No Universe/Mural create. No `media_realization`. Occupied Mural is rejected. |
| Register Mural for existing Universe | `mural-registration.ts` + `register-mural.tsx` + `POST /api/authority/murals` `{ universe_id, title? }` | compose existing `registerMaster` + `createCanonicalState` + `createProjection` | mural master + state + experiential projection | yes (decision) | yes | later playback | yes | Stage 2.7. No media attach. No second Mural when one exists. Not a Mural editor. Create Work remains the broader optional path. |
| `/authority/curate` Sentinel inspect | `curate-client.tsx` | mural-bound HLS, frames, candidates | bind / accept scene (existing) | inspect UI Authority-hosted | yes | no | inspect kept | Evidence only; not Creative Suite |
| Media inspect | `/authority/media/inspect` | asset identity + frames + saved sessions | persist `inspection_session` + `frame_observation` | yes | yes | no | existing | Stage 3.8. Source-media persist; `master_id` optional. Not a Universe. Links into Suite Sentinel when the asset is bound. |
| Sentinel intelligence | `sentinel-intelligence.ts` + `load-sentinel-intelligence.ts` + `sentinel-intelligence.tsx` + `POST /api/authority/sentinel/authorise` | storyboard, animation plan, 2.5D layers, boundary proposals | existing Scene windows only | yes | yes | 2.5D consumes stills | yes | Stage 3.9. Evidence → proposals. Curator authorises. Extra candidates stay beats. Does not create Scenes. Stage 4.0 surfaces this as a Studio stage. |
| Public `/worlds` holographic | `(public)/worlds/[masterId]/holographic` + `holographic-stage.tsx` | canonical stills as CSS 3D layers | none | yes | no | **yes** | yes | Stage 3.9 2.5D. Creative Moments are spatial objects; Mural is the back plane. Not a Three.js engine. |
| Media intake | `/authority/media/intake` | `media_intake` | create intake | later | yes | no | existing | MEDIA ≠ UNIVERSE |
| Media readiness | `src/lib/media/readiness.ts` | intake / processing / playable / ready | none | yes | no | no | yes | Existing states; no invented workflow table |
| Scene timing / order | suite Scenes section; timeline PATCH; sort-order PATCH | binding `start_ms`/`end_ms`, `sort_order` | Suite hosts existing APIs | yes | yes | stills + sequence | yes | Stage 3.5 / 3.7. Scene creation stays outside Suite. Catalogue drag-order remains; Suite uses accessible Move earlier/later. |
| Scene ↔ Creative Moment | `presence.ts` + `presence-authoring.tsx` + `POST/DELETE /api/authority/scene-moment` | primary `scene_moment` join | relate/unrelate existing objects | yes | yes | consumes existing presence | yes | Stage 3.2. Suite authors who is present in which Scene. No new objects, projections, or media. Proverb sharing remains valid. |
| Creative Moment identity | `creative-moment-identity.ts` + `creative-moment-identity-authoring.tsx` + `POST /api/authority/presentation` | title + description; parent = Universe | identity-only upsert; preserves artwork/markdown | yes | yes | titles | yes | Stage 3.6. Same presentation primitive as Scene identity. Does not create projections. |
| Moment Card / `/moments` / players | `src/components/` | projections | none | no | no | **yes** | no | Do not reuse as assemble UI |
| Public `/worlds` Universe landing | `(public)/worlds/[masterId]` + `src/components/experience/universe-world.tsx` | Universe + Mural + mural-child Scenes + scene_moment + Creative Moments | none | yes | no | **yes** | yes | Stage 3.0 world encounter. Not a second Scene Deck. Not Suite objects. |
| Public `/worlds` Scene Deck / Mural player | `(public)/` Scene Deck + MediaHero | projections + bindings + Scene `start_ms` | none | no | no | **yes** | no | EXPERIENCE playback. Facedown/shuffle stay here. Revealed stills use Scene start time (Stage 3.4). |
| Media / Mux / bindings / realization / intake | `/authority/media*` | media_asset, bindings, realization | Authority media APIs | later | yes | playback consumes | no | Not this stage |
| Canonical record / publishing | `/authority/[masterId]` | six-stage journey | many | no | yes | no | no | Publishing, not suite |

Future public curator: same suite primitives and identity form; different auth, no Authority privileges, no canonical publishing, no rights/moderation.

Schema: `master`, `work_presentation`, `projection`, `projection_media_binding`, `scene_moment`, `media_asset`, `media_intake`, `inspection_session` already express the required structure. **NO MIGRATION REQUIRED.**

## Product questions after Stage 4.0

- Creative Suite now makes the production path visible: source media, Sentinel evidence, storyboard, animation plan, Scene proposals, authorise, 2.5D Studio Preview, then Experience. This is not a wizard, timeline dashboard, Scene creator, Mural editor, or publish/realize workflow.
- Gallery / Inspect still continue into Curate Studio with selected media identity. Bound Inspect continues into Suite Sentinel. Create Work remains independent and still completes on the publishing record.
- **Governance vs Experience.** `/authority/{id}` still carries a rights/realization checklist while authorised public Experience already plays. Solving that through a publish ontology is outside this stage.
- **Sentinel now remembers.** Schema is live (`inspection_session`, `frame_observation`). Stage 3.8 persists source-media inspection. Stage 3.9 derives intelligence and lets the curator authorise existing Scene windows. Stage 4.0 makes those surfaces discoverable. Curate Studio Sentinel remains universe-scoped evidence UI, not the persist surface. Sentinel must not auto-create Scenes.
- Occupied Mural: association does not replace existing Super Hero Ego Mural media. Rebind remains the existing Sentinel mural-media control.
- **Still deferred:** Mural editor, Scene creation in Suite, publish/realize, `media_realization`, facedown authoring in Studio, Three.js engines, collectibles, AI classification / embeddings.
- Scene Deck revealed thumbnails now use each Scene's `start_ms`. Shuffle remains presentation-only.
- Public 2.5D is CSS holographic presentation of canonical stills. Studio 2.5D Preview reuses the same primitives. Neither rewrites canonical geometry.
- **No Supabase migration required.**
