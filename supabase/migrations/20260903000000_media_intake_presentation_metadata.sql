-- Additive presentation metadata for media intake.
-- Keeps canonical identity, rights, and media realization relationships separate.
alter table public.media_intake
  add column if not exists description text,
  add column if not exists short_description text,
  add column if not exists original_language text,
  add column if not exists alternate_title text,
  add column if not exists language text,
  add column if not exists genre text,
  add column if not exists subgenre text,
  add column if not exists version text,
  add column if not exists edition text,
  add column if not exists release_date date,
  add column if not exists original_release_date date,
  add column if not exists explicit_content boolean not null default false,
  add column if not exists content_rating text,
  add column if not exists visibility text not null default 'draft',
  add column if not exists search_status text not null default 'pending',
  add column if not exists featured boolean not null default false,
  add column if not exists display_order integer,
  add column if not exists alt_text text;

alter table public.media_intake
  drop constraint if exists media_intake_visibility_check;

alter table public.media_intake
  add constraint media_intake_visibility_check
  check (visibility in ('draft', 'private', 'public'));

alter table public.media_intake
  drop constraint if exists media_intake_search_status_check;

alter table public.media_intake
  add constraint media_intake_search_status_check
  check (search_status in ('pending', 'indexed', 'excluded'));

create table if not exists public.media_intake_credit (
  credit_id uuid primary key default uuid_generate_v4(),
  intake_id uuid not null references public.media_intake(intake_id) on delete cascade,
  participant_id uuid not null references public.participant(participant_id),
  role text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint media_intake_credit_role_check check (
    role in ('primary_artist', 'featured_artist', 'composer', 'lyricist', 'producer', 'director', 'editor', 'cinematographer', 'performer', 'writer', 'contributor')
  )
);

create index if not exists media_intake_credit_intake_idx on public.media_intake_credit(intake_id, display_order);
create index if not exists media_intake_credit_participant_idx on public.media_intake_credit(participant_id);

alter table public.media_intake_credit enable row level security;

create policy "anon_read_media_intake_credit"
  on public.media_intake_credit for select to anon using (true);

create policy "authenticated_read_media_intake_credit"
  on public.media_intake_credit for select to authenticated using (true);

create policy "service_role_all_media_intake_credit"
  on public.media_intake_credit for all to service_role using (true) with check (true);

grant select on public.media_intake_credit to anon;
grant select on public.media_intake_credit to authenticated;
grant select, insert, update, delete on public.media_intake_credit to service_role;
