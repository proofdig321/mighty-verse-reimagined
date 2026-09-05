/**
 * Thumbnail resolution utility.
 * Derives a thumbnail URL from a Livepeer playback ID + start time,
 * using the actual VTT keyframe intervals parsed from the real asset.
 *
 * VTT intervals for playbackId 5a112ddzzuvlq3a5 (verified):
 * keyframes_0  0–12s
 * keyframes_1  12–19s
 * keyframes_2  19–29s
 * keyframes_3  29–38s   ← Powerhouse (36s)
 * keyframes_4  38–52s
 * keyframes_5  52–61s
 * keyframes_6  61–70s   ← Dark Knight (80s → use keyframes_6 = closest before 80s)
 * keyframes_7  70–76s
 * keyframes_8  76–88s   ← Dark Knight (80s) is in this range
 * keyframes_9  88–98s
 * keyframes_10 98–109s
 * keyframes_11 109–119s
 * keyframes_12 119–124s ← Hand-to-Hand (149s → keyframes_13)
 * keyframes_13 124–134s ← Hand-to-Hand (149s → keyframes_14)
 * keyframes_14 134–144s
 * keyframes_15 144–154s ← Hand-to-Hand (149s) is in this range
 * keyframes_16 154–164s ← Sword Master (193s → keyframes_19)
 * keyframes_17 164–175s
 * keyframes_18 175–187s
 * keyframes_19 187–193s ← Sword Master (193s) starts here
 * keyframes_20 193–204s
 */

// Parsed from the actual VTT — start times in seconds for each keyframe
const VTT_INTERVALS: Record<string, number[]> = {
  "5a112ddzzuvlq3a5": [0, 12, 19, 29, 38, 52, 61, 70, 76, 88, 98, 109, 119, 124, 134, 144, 154, 164, 175, 187, 193, 204, 211, 220, 231],
};

const LIVEPEER_CDN_BASE = "https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls";

/**
 * Returns the keyframe PNG URL for a given playback ID and start time in ms.
 * Falls back to keyframes_0 if the playback ID is unknown.
 */
export function livepeerThumbnailUrl(playbackId: string, startMs: number): string {
  const intervals = VTT_INTERVALS[playbackId];
  const startSec = startMs / 1000;
  let frameIndex = 0;

  if (intervals) {
    // Find the last interval start that is <= startSec
    for (let i = intervals.length - 1; i >= 0; i--) {
      if (intervals[i] <= startSec) {
        frameIndex = i;
        break;
      }
    }
  }

  return `${LIVEPEER_CDN_BASE}/${playbackId}/thumbnails/keyframes_${frameIndex}.png`;
}

/**
 * Resolve the best thumbnail URL for a scene/moment.
 * Priority: custom artwork_asset_id storage_ref > Livepeer keyframe > null
 */
export function resolveThumbnail(opts: {
  playbackId: string | null;
  startMs: number | null;
  artworkStorageRef?: string | null;
}): string | null {
  if (opts.artworkStorageRef && !opts.artworkStorageRef.startsWith("seed:placeholder:")) {
    // Custom artwork — if it's a Livepeer playback ID treat as thumbnail, else return as-is
    return opts.artworkStorageRef;
  }
  if (opts.playbackId && opts.startMs != null) {
    return livepeerThumbnailUrl(opts.playbackId, opts.startMs);
  }
  if (opts.playbackId) {
    return livepeerThumbnailUrl(opts.playbackId, 0);
  }
  return null;
}
