-- Build 20: deploy realization and rights schema without mutating existing assets.
-- The earlier realization migration also annotates the protected legacy asset;
-- that data mutation is intentionally excluded here.

alter table public.media_asset
  add column if not exists rights_holder_ref uuid references public.participant(participant_id),
  add column if not exists rights_basis text;

create index if not exists media_asset_rights_holder_ref_idx
  on public.media_asset(rights_holder_ref) where rights_holder_ref is not null;

create table if not exists public.media_realization (
  realization_id    uuid primary key default uuid_generate_v4(),
  master_id         uuid not null references public.master(master_id),
  realization_type  text not null,
  rights_holder_ref uuid references public.participant(participant_id),
  rights_basis      text,
  production_notes  text,
  created_at        timestamptz not null default now(),
  created_by        uuid not null references public.participant(participant_id),
  constraint realization_type_check check (
    realization_type in (
      'original-recording', 'animated-video', 'live-performance',
      'broadcast-recording', 'music-video', 'visualisation', 'other'
    )
  )
);

create index if not exists media_realization_master_id_idx
  on public.media_realization(master_id);
create index if not exists media_realization_rights_holder_ref_idx
  on public.media_realization(rights_holder_ref) where rights_holder_ref is not null;

alter table public.media_realization enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'media_realization' and policyname = 'anon_read_media_realization') then
    create policy "anon_read_media_realization" on public.media_realization for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'media_realization' and policyname = 'authenticated_read_media_realization') then
    create policy "authenticated_read_media_realization" on public.media_realization for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'media_realization' and policyname = 'service_role_all_media_realization') then
    create policy "service_role_all_media_realization" on public.media_realization for all to service_role using (true) with check (true);
  end if;
end
$$;

grant select on public.media_realization to anon;
grant select on public.media_realization to authenticated;
grant select, insert, update, delete on public.media_realization to service_role;

do $$
begin
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.projection_media_binding'::regclass
      and attname = 'realization_id'
      and not attisdropped
  ) then
    alter table public.projection_media_binding
      add column realization_id uuid references public.media_realization(realization_id);
  end if;
end
$$;

create index if not exists projection_media_binding_realization_id_idx
  on public.projection_media_binding(realization_id) where realization_id is not null;
