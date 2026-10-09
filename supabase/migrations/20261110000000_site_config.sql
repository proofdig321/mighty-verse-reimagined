-- site_config: platform-level key/value configuration store.
-- Each row is a named config slot. value is JSONB so any shape can be stored.
-- RLS: service role only — never exposed to anon or authenticated users directly.

create table if not exists site_config (
  key         text        primary key,
  value       jsonb       not null default '{}',
  updated_at  timestamptz not null default now()
);

-- Seed the hero config row with the current static defaults.
insert into site_config (key, value) values (
  'hero',
  '{
    "eyebrow": "A living catalogue of Universes",
    "headline": "Every Song is a Universe. Every Moment is a Legend.",
    "description": "Discover a Universe, reveal its Mural, Scenes, and Creative Moments, then enter 2.5D or Holographic Experience.",
    "heroMediaId": null,
    "showTrailerCta": true
  }'::jsonb
) on conflict (key) do nothing;

-- Service role needs explicit DML grants (RLS is on but not forced;
-- service role bypasses RLS only after grants are present).
grant select, insert, update, delete on site_config to service_role;
