# Agent instructions

Canonical product context lives in `.mighty-verse/AGENT.md`.
Do not treat Mux playback IDs as identity. Do not add Three.js / R3F.

## Holographic Mux cinema

Custom WebGL1 in `src/components/experience/holographic-theater.tsx`, shared by
Studio preview and public `/worlds/{id}/holographic`.

- `HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y = false` (`UNPACK_FLIP_Y_WEBGL = 0`). Mesh UVs already have `v=0` at the top. Do not invert vertex math.
- Do **not** gate `texImage2D` on HLS `currentTime` equality. Mux VBR clocks stutter the picture against audio.
- First frame (and resolution changes) allocate with `texImage2D`. Steady playback uses `texSubImage2D` in place. rAF always draws so cursor parallax stays live.
- `HOLOGRAPHIC_PARALLAX_STRENGTH = 0.75`.
- WebGL1 has no PIXEL_UNPACK_BUFFER. Do not switch the compositor to Three.js or WebGL2 just for PBOs.

## Storyboard workspace

`StoryboardWorkspace` is a 12-column Shadcn Card/Tabs layout used by `/studio/work` and Universe Storyboard. Keep Script / AI Assist / Sentinel / References tabs, Target Association, Generate storyboard, and Save story body. Do not dump the catalogue onto the dashboard.

## Verification (no screenshots)

Screenshots do not prove orientation or audio sync.

1. `npx tsc --noEmit && npm run build`
2. Warp unit: `src/lib/experience/__tests__/holographic-warp.test.mjs`
3. Playwright `qa/browser/smoke/holographic-playback.smoke.ts` against `http://localhost:3000`:
   - luma-row upright check (`sampleCinemaOrientation`)
   - `data-holographic-flip-y=false`
   - `data-holographic-parallax=0.75`
   - warp `live`, `data-holographic-tex-path=subimage`, stereo pan left/right
   - while paused, Mux `currentTime` holds and rAF continues
