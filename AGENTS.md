# Agent instructions

Canonical product context lives in `.mighty-verse/AGENT.md`.
Do not treat Mux playback IDs as identity. Do not add Three.js / R3F.

## Holographic Mux cinema

Custom WebGL1 in `src/components/experience/holographic-theater.tsx`, shared by
Studio preview and public `/worlds/{id}/holographic`.

- `HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y = false` (`UNPACK_FLIP_Y_WEBGL = 0`). Mesh UVs already have `v=0` at the top. Do not invert vertex math.
- `gl.texImage2D` runs only when `shouldUploadMuxVideoFrame` is true: `readyState >= HAVE_CURRENT_DATA` and `currentTime` is a net-new Mux clock. Duplicate clocks skip the CPU→GPU upload. `requestAnimationFrame` still draws so cursor parallax stays live.
- `HOLOGRAPHIC_PARALLAX_STRENGTH = 0.70`.
- Scene seeks reset the upload cache via the video `seeked` event.

## Verification (no screenshots)

Screenshots do not prove orientation, lyric sync, or upload skip.

1. `npx tsc --noEmit && npm run build`
2. Warp unit: `src/lib/experience/__tests__/holographic-warp.test.mjs`
3. Playwright `qa/browser/smoke/holographic-playback.smoke.ts` against `http://localhost:3000`:
   - luma-row upright check (`sampleCinemaOrientation`) — unflipped must beat flipped
   - `data-holographic-flip-y=false`
   - `data-holographic-parallax=0.70`
   - warp `live`, stereo pan left/right
   - while paused, `data-holographic-draws` keeps rising and `data-holographic-tex-uploads` stays flat
