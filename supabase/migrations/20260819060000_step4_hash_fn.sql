-- =============================================================================
-- Mighty Verse Reimagined — Step 4 support: compute_integrity_hash function
--
-- Exposes the canonical hash algorithm (defined in Step 3 seed migration) as
-- a callable Postgres function so the application layer can compute hashes
-- identically to the seed without reimplementing serialisation in JavaScript.
--
-- Algorithm: encode(digest(<jsonb>::text, 'sha256'), 'hex')
-- Keys must be passed pre-sorted (alphabetical) by the caller.
-- =============================================================================

create or replace function public.compute_integrity_hash(fields jsonb)
returns text
language sql
immutable
security definer
as $$
  select encode(digest(fields::text, 'sha256'), 'hex');
$$;

-- Grant to service_role (used by application layer)
grant execute on function public.compute_integrity_hash(jsonb) to service_role;
