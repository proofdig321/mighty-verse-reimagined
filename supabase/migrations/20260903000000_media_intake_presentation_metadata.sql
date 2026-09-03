-- Additive presentation metadata for media intake.
-- Keeps canonical identity, rights, and media realization relationships separate.
alter table public.media_intake
  add column if not exists description text,
  add column if not exists alternate_title text,
  add column if not exists language text,
  add column if not exists genre text,
  add column if not exists release_date date,
  add column if not exists explicit_content boolean not null default false,
  add column if not exists visibility text not null default 'draft',
  add column if not exists alt_text text;

alter table public.media_intake
  drop constraint if exists media_intake_visibility_check;

alter table public.media_intake
  add constraint media_intake_visibility_check
  check (visibility in ('draft', 'private', 'public'));
