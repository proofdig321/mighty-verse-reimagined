-- Migration: ISRC registrant configuration and initial ISRC assignments
-- Applied live 2026-10-01 via service client (no schema changes required).
-- This file records the data operations for audit and reproducibility.
--
-- Evidence basis for ZA80G prefix:
--   Commit f85f107 (2026-09-21, author prooftv) introduced isrc-recording-identity.test.mjs
--   with fixtures labelled "owner's real ISRC, normalized" using ZA80G1600096–ZA80G1600099.
--   Test title: "owner's real ISRC ZA-80G-16-00096 is valid".
--   ZA = South Africa (correct for Golden Shovel). 80G = registrant code. Year 16 = 2016.
--   This is the authorised registrant prefix for Golden Shovel.
--
-- 1. Configure authorised ISRC registrant
INSERT INTO isrc_registrant (
  registrant_id,
  registrant_name,
  country_code,
  registrant_code,
  prefix_code,
  effective_from,
  active,
  notes,
  created_by
)
VALUES (
  'aba4b4dd-6b34-47dd-a69a-739fb7e6001c',
  'Golden Shovel',
  'ZA',
  '80G',
  'ZA80G',
  '2016-01-01',
  true,
  'Authorised ISRC registrant prefix for Golden Shovel. Prefix ZA80G confirmed from owner ISRC ZA-80G-16-00096 (commit f85f107, test fixture labelled owner''s real ISRC). Country: South Africa (ZA). Registrant code: 80G.',
  '866390ff-5d45-4c15-b64e-e7c0655780b8'
)
ON CONFLICT (registrant_id) DO NOTHING;

-- 2. Initialise designation sequence for 2026 (next_designation = 3 after two assignments)
INSERT INTO isrc_designation_sequence (registrant_id, year_of_reference, next_designation)
VALUES ('aba4b4dd-6b34-47dd-a69a-739fb7e6001c', 26, 3)
ON CONFLICT (registrant_id, year_of_reference) DO NOTHING;

-- 3. Assign ISRC to Super Hero Ego music-video realization
UPDATE media_realization
SET isrc = 'ZA80G2600001', isrc_status = 'assigned'
WHERE realization_id = 'e297c2aa-880c-4d79-9245-58f934e7149d'
  AND isrc IS NULL;

-- 4. Assign ISRC to Father Raymond animated-video realization
UPDATE media_realization
SET isrc = 'ZA80G2600002', isrc_status = 'assigned'
WHERE realization_id = '64f385c8-1841-4bba-bfe1-ea7d4f794d16'
  AND isrc IS NULL;

-- 5. Write assignment log entries
INSERT INTO isrc_assignment_log (
  realization_id, isrc, registrant_id, prefix_code,
  year_of_reference, designation, assignment_status, assigned_by, notes
)
VALUES
  (
    'e297c2aa-880c-4d79-9245-58f934e7149d',
    'ZA80G2600001',
    'aba4b4dd-6b34-47dd-a69a-739fb7e6001c',
    'ZA80G', 26, 1, 'assigned',
    '866390ff-5d45-4c15-b64e-e7c0655780b8',
    'Super Hero Ego — original music video. Registrant ZA80G confirmed from owner ISRC evidence (commit f85f107).'
  ),
  (
    '64f385c8-1841-4bba-bfe1-ea7d4f794d16',
    'ZA80G2600002',
    'aba4b4dd-6b34-47dd-a69a-739fb7e6001c',
    'ZA80G', 26, 2, 'assigned',
    '866390ff-5d45-4c15-b64e-e7c0655780b8',
    'Father Raymond — animated video. Registrant ZA80G confirmed from owner ISRC evidence (commit f85f107).'
  )
ON CONFLICT DO NOTHING;
