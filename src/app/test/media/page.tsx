import { LivepeerPlayer } from "@/components/player/livepeer-player";

/**
 * Step 9 smoke test — exercises the full media/playback chain:
 * LivepeerPlayer → /api/livepeer/playback/[playbackId] → Livepeer API
 *                → getSrc() → Player.Root
 *                → onPlaybackEvents → /api/signals → consumption_signal
 *
 * Replace PLAYBACK_ID, PROJECTION_ID, MASTER_ID, CANONICAL_STATE_ID
 * with real values from your Supabase + Livepeer project before testing.
 */
const PLAYBACK_ID = process.env.NEXT_PUBLIC_TEST_PLAYBACK_ID ?? "";
const PROJECTION_ID = process.env.NEXT_PUBLIC_TEST_PROJECTION_ID ?? "";
const MASTER_ID = process.env.NEXT_PUBLIC_TEST_MASTER_ID ?? "";
const CANONICAL_STATE_ID = process.env.NEXT_PUBLIC_TEST_CANONICAL_STATE_ID ?? "";

export default function MediaSmokeTestPage() {
  const missing = !PLAYBACK_ID || !PROJECTION_ID || !MASTER_ID || !CANONICAL_STATE_ID;

  return (
    <main style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>Step 9 — Media / Playback Smoke Test</h1>

      {missing ? (
        <p style={{ color: "red" }}>
          Set NEXT_PUBLIC_TEST_PLAYBACK_ID, NEXT_PUBLIC_TEST_PROJECTION_ID,
          NEXT_PUBLIC_TEST_MASTER_ID, NEXT_PUBLIC_TEST_CANONICAL_STATE_ID in .env.local
        </p>
      ) : (
        <LivepeerPlayer
          playbackId={PLAYBACK_ID}
          projectionId={PROJECTION_ID}
          masterId={MASTER_ID}
          canonicalStateId={CANONICAL_STATE_ID}
        />
      )}

      <section style={{ marginTop: "2rem" }}>
        <h2>Chain under test</h2>
        <ol>
          <li>LivepeerPlayer mounts → fetches /api/livepeer/playback/{"{playbackId}"}</li>
          <li>Route calls livepeer.playback.get() with server-side LIVEPEER_API_KEY</li>
          <li>PlaybackInfo returned → getSrc() → Player.Root receives verified src</li>
          <li>Play event → POST /api/signals → consumption_signal inserted</li>
        </ol>
        <p>
          Verify signals at:{" "}
          <a href="/api/signals" style={{ color: "blue" }}>/api/signals</a> (POST only) and
          check the <code>consumption_signal</code> table in Supabase.
        </p>
      </section>
    </main>
  );
}
