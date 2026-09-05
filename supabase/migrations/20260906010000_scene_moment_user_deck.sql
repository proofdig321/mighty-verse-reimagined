-- =============================================================================
-- Mighty Verse Reimagined — Scene→Moment relationship + User Decks
--
-- 1. scene_moment — canonical join between a Scene and a Creative Moment.
--    Replaces the static SCENE_TO_CM frontend mapping.
--    A Scene may be associated with zero or more Creative Moments.
--    A Creative Moment may appear in multiple Scenes (e.g. a shared moment).
--
-- 2. user_deck — a participant's named personal deck/sequence.
-- 3. user_deck_item — ordered Scene projections within a user deck.
--
-- These are experience/projection state, NOT canonical content.
-- They reference projection_id (the experiential projection of a Scene),
-- not master_id, because the user is assembling an experience, not
-- redefining canonical identity.
-- =============================================================================

-- =============================================================================
-- 1. scene_moment — canonical Scene → Creative Moment relationship
-- =============================================================================

create table if not exists public.scene_moment (
  scene_moment_id   uuid primary key default gen_random_uuid(),
  scene_master_id   uuid not null references public.master(master_id) on delete cascade,
  moment_master_id  uuid not null references public.master(master_id) on delete cascade,
  relationship_type text not null default 'primary'
    check (relationship_type in ('primary', 'secondary', 'contextual')),
  sort_order        integer,
  created_at        timestamptz not null default now(),
  created_by        uuid not null references public.participant(participant_id),
  constraint scene_moment_unique unique (scene_master_id, moment_master_id)
);

comment on table public.scene_moment is
  'Canonical relationship between a Scene master and a Creative Moment master. Replaces static frontend mapping. Authority-managed.';

create index if not exists scene_moment_scene_idx on public.scene_moment(scene_master_id);
create index if not exists scene_moment_moment_idx on public.scene_moment(moment_master_id);

alter table public.scene_moment enable row level security;

create policy "service_role_all_scene_moment"
  on public.scene_moment for all to service_role using (true) with check (true);

create policy "authenticated_read_scene_moment"
  on public.scene_moment for select to authenticated using (true);

create policy "anon_read_scene_moment"
  on public.scene_moment for select to anon using (true);

grant select on public.scene_moment to authenticated, anon;
grant select, insert, update, delete on public.scene_moment to service_role;

-- Seed the four canonical Scene → Creative Moment relationships
-- Scene: Golden Shovel — Powerhouse → CM: Proverb (3b0de6b4)
-- Scene: Mothipa — Dark Knight      → CM: Mothipa (32422bb4)
-- Scene: ProVerb — Hand-to-Hand     → CM: Proverb (3b0de6b4)
-- Scene: Reason — Sword Master      → CM: Reason  (2745a50a)
-- (Using the participant who created the universe as created_by)
insert into public.scene_moment (scene_master_id, moment_master_id, relationship_type, sort_order, created_by)
values
  ('4790c7cf-bb19-4a01-a243-e5c3eb680555', '3b0de6b4-2ca0-43c0-8561-7dc1c0697435', 'primary', 1,
   (select created_by from public.master where master_id = '05ccc0c6-75f9-4864-b0c1-af5e36bf45cc')),
  ('bebb65d2-21ed-4bc9-9fa0-a4857df30a43', '32422bb4-d03c-465d-8348-942e49ae0051', 'primary', 1,
   (select created_by from public.master where master_id = '05ccc0c6-75f9-4864-b0c1-af5e36bf45cc')),
  ('df15ec76-6bd8-4956-bbaa-755f72b2b8f8', '3b0de6b4-2ca0-43c0-8561-7dc1c0697435', 'primary', 1,
   (select created_by from public.master where master_id = '05ccc0c6-75f9-4864-b0c1-af5e36bf45cc')),
  ('65490a92-8faf-42ea-a391-0e6473360f5c', '2745a50a-5417-4613-b23b-ef4857ab112e', 'primary', 1,
   (select created_by from public.master where master_id = '05ccc0c6-75f9-4864-b0c1-af5e36bf45cc'))
on conflict (scene_master_id, moment_master_id) do nothing;

-- =============================================================================
-- 2. user_deck — participant's named personal deck
-- =============================================================================

create table if not exists public.user_deck (
  deck_id        uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participant(participant_id) on delete cascade,
  name           text not null default 'My Deck',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.user_deck is
  'A participant''s named personal Scene deck/sequence. Experience state, not canonical content.';

create index if not exists user_deck_participant_idx on public.user_deck(participant_id);

alter table public.user_deck enable row level security;

create policy "service_role_all_user_deck"
  on public.user_deck for all to service_role using (true) with check (true);

create policy "owner_all_user_deck"
  on public.user_deck for all to authenticated
  using (participant_id = (
    select il.participant_id from public.identity_link il
    where il.identity_type = 'web2-account' and il.identity_ref = auth.uid()::text and il.active = true
    limit 1
  ))
  with check (participant_id = (
    select il.participant_id from public.identity_link il
    where il.identity_type = 'web2-account' and il.identity_ref = auth.uid()::text and il.active = true
    limit 1
  ));

grant select, insert, update, delete on public.user_deck to authenticated;
grant select, insert, update, delete on public.user_deck to service_role;

-- =============================================================================
-- 3. user_deck_item — ordered Scene projections within a user deck
-- =============================================================================

create table if not exists public.user_deck_item (
  item_id       uuid primary key default gen_random_uuid(),
  deck_id       uuid not null references public.user_deck(deck_id) on delete cascade,
  projection_id uuid not null references public.projection(projection_id) on delete cascade,
  sort_order    integer not null,
  created_at    timestamptz not null default now(),
  constraint user_deck_item_unique unique (deck_id, projection_id)
);

comment on table public.user_deck_item is
  'An ordered Scene projection within a user deck. sort_order is the user''s personal sequence, independent of canonical Scene order.';

create index if not exists user_deck_item_deck_idx on public.user_deck_item(deck_id, sort_order);

alter table public.user_deck_item enable row level security;

create policy "service_role_all_user_deck_item"
  on public.user_deck_item for all to service_role using (true) with check (true);

create policy "owner_all_user_deck_item"
  on public.user_deck_item for all to authenticated
  using (deck_id in (
    select deck_id from public.user_deck
    where participant_id = (
      select il.participant_id from public.identity_link il
      where il.identity_type = 'web2-account' and il.identity_ref = auth.uid()::text and il.active = true
      limit 1
    )
  ))
  with check (deck_id in (
    select deck_id from public.user_deck
    where participant_id = (
      select il.participant_id from public.identity_link il
      where il.identity_type = 'web2-account' and il.identity_ref = auth.uid()::text and il.active = true
      limit 1
    )
  ));

grant select, insert, update, delete on public.user_deck_item to authenticated;
grant select, insert, update, delete on public.user_deck_item to service_role;
