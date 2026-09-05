-- =============================================================================
-- Mighty Verse Reimagined — ISRC table DELETE grants
--
-- The original isrc_foundation migration granted only SELECT+INSERT on
-- isrc_assignment_log and SELECT+INSERT+UPDATE on isrc_designation_sequence
-- to service_role. DELETE was omitted.
--
-- This migration adds DELETE grants so the service role can:
--   - Remove test/erroneous records during development
--   - Support future administrative cleanup operations
--
-- The append-only nature of isrc_assignment_log is enforced at the application
-- layer (the assign route never deletes). The DB grant does not change that
-- invariant — it simply removes an unintended restriction on the service role.
-- =============================================================================

grant delete on public.isrc_assignment_log to service_role;
grant delete on public.isrc_designation_sequence to service_role;
