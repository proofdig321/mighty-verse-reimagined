-- Additive technical metadata for media processing and delivery.
-- Values remain nullable until supplied by the processing pipeline.
alter table public.media_asset
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists aspect_ratio numeric(10, 4),
  add column if not exists frame_rate numeric(10, 4),
  add column if not exists codec text,
  add column if not exists container text,
  add column if not exists bitrate_kbps integer,
  add column if not exists audio_presence boolean,
  add column if not exists audio_channels integer,
  add column if not exists sample_rate_hz integer,
  add column if not exists captions_available boolean;

alter table public.media_asset
  add constraint media_asset_dimensions_check check (width is null or width > 0) not valid,
  add constraint media_asset_height_check check (height is null or height > 0) not valid,
  add constraint media_asset_frame_rate_check check (frame_rate is null or frame_rate > 0) not valid,
  add constraint media_asset_bitrate_check check (bitrate_kbps is null or bitrate_kbps > 0) not valid,
  add constraint media_asset_audio_channels_check check (audio_channels is null or audio_channels > 0) not valid,
  add constraint media_asset_sample_rate_check check (sample_rate_hz is null or sample_rate_hz > 0) not valid;

create index if not exists media_asset_codec_idx on public.media_asset(codec) where codec is not null;