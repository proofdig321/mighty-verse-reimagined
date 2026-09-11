-- Restore the canonical Sword Master → Reason presence if it is missing.
-- Does not create objects, projections, or media. Does not change Scene timing.
insert into public.scene_moment (scene_master_id, moment_master_id, relationship_type, sort_order, created_by)
values
  (
    '65490a92-8faf-42ea-a391-0e6473360f5c',
    '2745a50a-5417-4613-b23b-ef4857ab112e',
    'primary',
    1,
    (select created_by from public.master where master_id = '05ccc0c6-75f9-4864-b0c1-af5e36bf45cc')
  )
on conflict (scene_master_id, moment_master_id) do nothing;
