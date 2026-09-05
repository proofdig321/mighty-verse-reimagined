-- =============================================================================
-- Mighty Verse Reimagined — Scene sort_order
--
-- Adds sort_order to master for canonical Scene sequencing.
-- By convention this column is only meaningful for canonical_type = 'scene'.
-- NULL = unordered (falls back to created_at ASC in queries).
--
-- Authority sets sort_order via /api/authority/masters/sort-order.
-- The public experience and the Authority scene list both respect this order.
-- =============================================================================

alter table public.master
  add column if not exists sort_order integer;

comment on column public.master.sort_order is
  'Canonical sort position. Meaningful for scene records only. NULL = unordered (falls back to created_at). Set by Authority via the scene ordering API.';

create index if not exists master_sort_order_idx
  on public.master(parent_master_id, sort_order)
  where sort_order is not null;

-- Seed the four existing Scenes with their canonical order
-- (matches the Mural media timeline: Golden Shovel → Mothipa → ProVerb → Reason)
update public.master set sort_order = 1 where master_id = '4790c7cf-bb19-4a01-a243-e5c3eb680555'; -- Golden Shovel — Powerhouse
update public.master set sort_order = 2 where master_id = 'bebb65d2-21ed-4bc9-9fa0-a4857df30a43'; -- Mothipa — Dark Knight
update public.master set sort_order = 3 where master_id = 'df15ec76-6bd8-4956-bbaa-755f72b2b8f8'; -- ProVerb — Hand-to-Hand
update public.master set sort_order = 4 where master_id = '65490a92-8faf-42ea-a391-0e6473360f5c'; -- Reason — Sword Master
