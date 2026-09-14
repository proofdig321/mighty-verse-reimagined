-- generation_job was created with RLS and authenticated grants, but the
-- service-role job worker was missing table privileges. That produced
-- "permission denied for table generation_job" instead of honest job state.

grant select, insert, update, delete on public.generation_job to service_role;
