-- Migration: Super Hero Ego — rights + recording identity
-- Applied live 2026-09-25 via service client (no schema changes required).
-- This file records the data operations for audit and reproducibility.
--
-- 1. Set rights on SHE media_asset (was null — blocked collectible designation)
UPDATE media_asset
SET
  rights_holder_ref = '866390ff-5d45-4c15-b64e-e7c0655780b8',
  rights_basis      = 'Golden Shovel — original composition and audiovisual work'
WHERE asset_id = '795c057e-2967-4e93-8f5e-06297c674cb0'
  AND rights_holder_ref IS NULL;

-- 2. Create media_realization for SHE Mural (canonical recording identity)
--    isrc_status = 'assignment-required': eligible, registrant not yet configured.
INSERT INTO media_realization (
  realization_id,
  master_id,
  realization_type,
  rights_holder_ref,
  rights_basis,
  production_notes,
  created_by,
  isrc,
  isrc_status,
  version_label,
  source_realization_id
)
VALUES (
  'e297c2aa-880c-4d79-9245-58f934e7149d',
  'a75ae8af-7b48-4b67-8392-d89447bae370',
  'music-video',
  '866390ff-5d45-4c15-b64e-e7c0655780b8',
  'Golden Shovel — original composition and audiovisual work',
  NULL,
  '866390ff-5d45-4c15-b64e-e7c0655780b8',
  NULL,
  'assignment-required',
  'Super Hero Ego — original music video',
  NULL
)
ON CONFLICT (realization_id) DO NOTHING;

-- 3. Link media_asset to realization
UPDATE media_asset
SET realization_id = 'e297c2aa-880c-4d79-9245-58f934e7149d'
WHERE asset_id = '795c057e-2967-4e93-8f5e-06297c674cb0'
  AND realization_id IS NULL;

-- 4. Link projection_media_binding to realization
UPDATE projection_media_binding
SET realization_id = 'e297c2aa-880c-4d79-9245-58f934e7149d'
WHERE binding_id = '374f27cd-25b7-4379-b7d2-b0d324bdd14b'
  AND realization_id IS NULL;

-- ISRC assignment is blocked until an isrc_registrant row is configured.
-- The isrc_registrant table is empty. Required external configuration:
--   INSERT INTO isrc_registrant (registrant_name, prefix_code, active)
--   VALUES ('<registrant_name>', '<XX-XXX>', true);
-- Once configured, POST /api/authority/isrc/assign with realization_id above.
