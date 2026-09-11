/**
 * YouTube is the primary ingest path. Mux pulls the file — Mighty Verse
 * does not treat YouTube as a playback identity, and does not fake HLS.
 */

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export type ParsedMediaSourceUrl =
  | { ok: true; url: string; kind: "youtube" | "direct" }
  | { ok: false; error: string };

export function parseMediaSourceUrl(raw: string): ParsedMediaSourceUrl {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Paste a YouTube or HTTPS video URL." };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "That is not a valid URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Use an HTTPS YouTube or direct video URL." };
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    if (!YOUTUBE_ID.test(id)) return { ok: false, error: "That YouTube link is missing a video id." };
    return { ok: true, url: `https://www.youtube.com/watch?v=${id}`, kind: "youtube" };
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    let id = parsed.searchParams.get("v") ?? "";
    if (!id) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") {
        id = parts[1] ?? "";
      }
    }
    if (!YOUTUBE_ID.test(id)) return { ok: false, error: "That YouTube link is missing a video id." };
    return { ok: true, url: `https://www.youtube.com/watch?v=${id}`, kind: "youtube" };
  }

  return { ok: true, url: parsed.toString(), kind: "direct" };
}

export function isUsableMediaSourceUrl(raw: string): boolean {
  return parseMediaSourceUrl(raw).ok;
}

export const MUX_YOUTUBE_INGEST_FAILURE =
  "Mux could not ingest this URL. YouTube only becomes playable when Mux can pull the file. Upload the animation file, or use a direct HTTPS video URL Mux can fetch.";
