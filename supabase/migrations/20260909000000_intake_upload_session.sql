-- =============================================================================
-- 20260909000000_intake_upload_session.sql
--
-- Allow intake-only upload sessions that are not yet bound to a canonical
-- projection or master. This supports the workflow:
--
--   Media Intake (no canonical work yet)
--       ↓
--   Upload Session (intake_id set, projection_id/master_id null)
--       ↓
--   Mux Direct Upload
--       ↓
--   Webhook → media_asset + delivery_variant
--       ↓
--   Operator explicitly binds to canonical projection later
--
-- Previously projection_id and master_id were NOT NULL, which forced every
-- upload to originate from an existing canonical projection. This blocked the
-- intake-first workflow.
--
-- No existing data is changed. Existing sessions with projection_id/master_id
-- set remain valid.
-- =============================================================================

alter table public.media_upload_session
  alter column projection_id drop not null,
  alter column master_id     drop not null;

comment on column public.media_upload_session.projection_id is
  'Canonical projection this session is bound to. NULL for intake-only sessions where the canonical binding has not yet been created.';

comment on column public.media_upload_session.master_id is
  'Canonical master this session is bound to. NULL for intake-only sessions where the canonical binding has not yet been created.';
