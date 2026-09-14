"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";

export function StoryboardHlsPreview({
  endpoint,
  poster,
  label,
}: {
  endpoint: string;
  poster?: string | null;
  label: string;
}) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    let hls: { destroy: () => void } | undefined;
    let cancelled = false;

    async function load() {
      const { default: Hls } = await import("hls.js");
      if (cancelled || !media) return;
      if (Hls.isSupported()) {
        const instance = new Hls({ enableWorker: false });
        hls = instance;
        instance.loadSource(endpoint);
        instance.attachMedia(media);
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) setState("ready");
        });
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setState("error");
        });
        return;
      }
      if (media.canPlayType("application/vnd.apple.mpegurl")) {
        media.src = endpoint;
        media.addEventListener("canplay", () => setState("ready"), { once: true });
        media.addEventListener("error", () => setState("error"), { once: true });
        return;
      }
      setState("error");
    }

    load().catch(() => {
      if (!cancelled) setState("error");
    });
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [endpoint]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-black">
      <video
        ref={mediaRef}
        controls
        playsInline
        poster={poster ?? undefined}
        aria-label={label}
        className="block aspect-video w-full bg-black object-contain"
      />
      {state === "loading" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
          <LoaderCircle size={16} className="animate-spin text-white/80" />
        </div>
      ) : null}
      {state === "error" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center">
          <div className="space-y-1 text-white/75">
            <AlertCircle size={16} className="mx-auto" />
            <p className="text-xs">Motion preview is not playable yet.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
