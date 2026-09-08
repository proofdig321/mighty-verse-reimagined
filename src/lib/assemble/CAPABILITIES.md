# ASSEMBLE capabilities

Product capability: Universe curation/assembly.
Expressions: Authority UI now; public-user curation later.
Not EXPERIENCE: do not put playback, Mux, or public timeline here.

```
ASSEMBLE
  ├── Universe identity          src/lib/assemble/load-universe.ts + UniverseAssembly
  ├── Mural relationship         master.parent_master_id (mural → universe)
  ├── Scene relationship         master.parent_master_id (scene → mural)
  ├── Creative Moment identity   master.parent_master_id (creative-moment → universe)
  └── Scene ↔ Creative Moment    scene_moment (primary)
```

| Capability | Lives today | Reusable? | Modularised now? | Reason |
|---|---|---|---|---|
| Universe assembly read-model | `src/lib/assemble/` | yes | yes | Same hierarchy for Authority and future public curators |
| Universe assembly presentation | `src/components/assemble/universe-assembly.tsx` | yes | yes | Hierarchy UI; routes inject hrefs |
| Hierarchy breadcrumbs | `src/components/assemble/breadcrumb.tsx` | yes | yes | Shared ontology chrome, not EXPERIENCE nav |
| Universe listing (Authority) | `src/app/authority/(workspace)/universes/page.tsx` | no | no | Authority catalogue; public listing is EXPERIENCE `getDiscovery()` |
| Universe create | `create-work-client` + `POST /api/authority/masters` | later | no | Authority-gated `registerMaster`; public create is a later increment |
| Identity edit | `PresentationPanel` → `/api/authority/presentation` | later | no | Authority mutation |
| Mural bind/inspect | `/authority/curate` | no | no | Sentinel/media inspection, not the assembly shell |
| Scene create | `POST /api/authority/scenes` | later | no | Authority mutation; Scene curation is Stage 2.3+ |
| Scene order | `scene-order-client` + sort-order API | later | no | Authority mutation |
| Scene ↔ CM link | `POST /api/authority/scene-moment` | later | no | Authority mutation; read-model already includes the join |
| Canonical record / publishing journey | `/authority/[masterId]` | no | no | Authority publishing, not assembly |
| Public Universe/Mural/Moment pages | `(public)/worlds`, `/moments` | EXPERIENCE | no | Do not reuse as assemble UI |
| MomentCard / Scene Deck / players | `src/components/` | EXPERIENCE | no | Playback and public reveal |

Authority vs public user: same assembly primitives; different permissions. Public users must not inherit Authority privileges, canonical publishing, or rights/moderation.

Schema: `master`, `work_presentation`, `projection`, `projection_media_binding`, `scene_moment` already express the ontology. **NO MIGRATION REQUIRED.**
