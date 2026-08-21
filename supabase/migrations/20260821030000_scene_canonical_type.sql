-- =============================================================================
-- Mighty Verse Reimagined — Build 12a: Scene enum values
--
-- Adds 'scene' to canonical_type and 'extraction' to provenance_relationship_type.
-- These enum additions must be committed before the constraint/trigger that
-- references 'scene' can be applied (Postgres SQLSTATE 55P04 restriction).
--
-- The constraint and trigger extension are in the next migration:
-- 20260821031000_scene_constraints.sql
-- =============================================================================

alter type canonical_type add value 'scene';
alter type provenance_relationship_type add value 'extraction';
