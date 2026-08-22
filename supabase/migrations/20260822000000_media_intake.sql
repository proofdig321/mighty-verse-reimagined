-- Mighty Verse Reimagined — Build 20 media intake metadata
-- Stores intake identity, source reference, and provenance without duplicating
-- canonical authority, media rights, or realization records.

create table public.media_intake (
  intake_id             uuid primary key default uuid_generate_v4(),
  master_id             uuid references public.master(master_id),
  asset_id              uuid references public.media_asset(asset_id),
  title                 text not null,
  creator_ref           uuid references public.participant(participant_id),
  creator_name          text,
  work_type             text not null,
  version_label         text,
  isrc                  text,
  isrc_status           text not null default 'not-applicable',
  source_type           text not null,
  source_url            text,
  source_provider       text,
  external_identifier   text,
  supplied_by           uuid not null references public.participant(participant_id),
  provenance_notes      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint media_intake_work_type_check check (
    work_type in ('song', 'audio', 'video', 'animation', 'other')
  ),
  constraint media_intake_isrc_status_check check (
    isrc_status in ('verified', 'not-provided', 'not-applicable')
  ),
  constraint media_intake_isrc_check check (
    isrc is null or isrc ~ '^[A-Z]{2}-?[A-Z0-9]{3}-?[0-9]{2}-?[0-9]{5}$'
  ),
  constraint media_intake_source_type_check check (
    source_type in ('upload', 'external-url', 'livepeer-asset', 'other')
  ),
  constraint media_intake_source_url_check check (
    source_type <> 'external-url' or source_url is not null
  ),
  constraint media_intake_isrc_state_check check (
    (isrc is not null and isrc_status = 'verified') or
    (isrc is null and isrc_status in ('not-provided', 'not-applicable'))
  )
);

create index on public.media_intake(master_id);
create index on public.media_intake(asset_id);
create index on public.media_intake(isrc) where isrc is not null;

alter table public.media_intake enable row level security;

create policy "anon_read_media_intake"
  on public.media_intake for select to anon using (true);

create policy "authenticated_read_media_intake"
  on public.media_intake for select to authenticated using (true);

create policy "service_role_all_media_intake"
  on public.media_intake for all to service_role using (true) with check (true);

grant select on public.media_intake to anon;
grant select on public.media_intake to authenticated;
grant select, insert, update, delete on public.media_intake to service_role;
