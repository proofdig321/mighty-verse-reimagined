# Stage 4.1 — Create Work reliability & Curate continuation

**No Supabase migration required.** Existing `media_upload_session` + Mux retrieve is sufficient. No job table.

## Root cause (Father Raymond)

Create Work registered the Universe first, then polled `media_upload_session.phase` only. Phase advances were webhook-driven. `MUX_WEBHOOK_SECRET` is unset and Mux cannot reach localhost. The 27.5 MB upload reached Mux (`asset_created` / asset `ready`) while the UI reported “Video processing timed out…..”. Retry registered a second Universe.

## Repair

- `advanceUploadSession` reads Mux on poll and reconcile.
- Timeout copy is request-timeout, not processing-failed.
- Retry resumes master / state / projection / session.
- Work record resumes in-progress sessions.
- Curate continuation: Inspect → Sentinel → Creative Suite.
- 2.5D remains CSS (`HolographicStage`). Three.js is not installed and is not required.

Super Hero Ego is unchanged.
