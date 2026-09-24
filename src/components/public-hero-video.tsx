"use client";

import { useEffect, useRef, useState } from "react";
import { muxPlaybackIdFromRef } from "@/lib/media/thumbnail";

/**
 * Muted autoplay background video for the hero.
 * Falls back to the still image if video cannot play (mobile data-saver, etc).
 * Also owns the "Watch Trailer" fullscreen modal.
 */
export function PublicHeroVideo({
  playbackId,
  stillUrl,
  title,
}: {
  playbackId: string;
  stillUrl: string | null;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const pid = muxPlaybackIdFromRef(playbackId) ?? playbackId;
  const hlsUrl = `https://stream.mux.com/${pid}.m3u8`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // HLS via native (Safari/iOS) or fall back gracefully
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
    } else {
      // For Chrome/Firefox load hls.js lazily — if it fails, videoFailed handles it
      import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) { setVideoFailed(true); return; }
        const hls = new Hls({ autoStartLoad: true, startLevel: 0, maxBufferLength: 8 });
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) setVideoFailed(true); });
        return () => hls.destroy();
      }).catch(() => setVideoFailed(true));
    }
  }, [hlsUrl]);

  return (
    <>
      {/* Background layer */}
      <div className="hero-video-bg" aria-hidden="true">
        {!videoFailed ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            poster={stillUrl ?? undefined}
            onError={() => setVideoFailed(true)}
            className="hero-video-el"
          />
        ) : stillUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stillUrl} alt="" className="hero-video-el hero-video-still" />
        ) : null}
        <div className="hero-video-scrim" />
      </div>

      {/* Trailer modal trigger — exported as data attr so parent can wire a button */}
      {modalOpen && (
        <div
          className="hero-trailer-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} trailer`}
          onClick={() => setModalOpen(false)}
        >
          <div className="hero-trailer-inner" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="hero-trailer-close"
              aria-label="Close trailer"
              onClick={() => setModalOpen(false)}
            >
              ✕
            </button>
            <video
              autoPlay
              controls
              playsInline
              poster={stillUrl ?? undefined}
              className="hero-trailer-video"
              src={`https://stream.mux.com/${pid}.m3u8`}
            />
          </div>
        </div>
      )}

      {/* Expose open fn via custom event so the server-rendered button can trigger it */}
      <button
        type="button"
        className="hero-trailer-trigger"
        data-hero-trailer-trigger=""
        aria-label={`Watch ${title} trailer`}
        onClick={() => setModalOpen(true)}
      >
        Watch Trailer
      </button>
    </>
  );
}
