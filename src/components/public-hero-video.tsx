"use client";

import { useEffect, useRef, useState } from "react";
import { muxPlaybackIdFromRef } from "@/lib/media/thumbnail";

export function PublicHeroVideo({
  playbackId,
  stillUrl,
  title,
}: {
  playbackId: string;
  stillUrl: string | null;
  title: string;
}) {
  const bgRef = useRef<HTMLVideoElement>(null);
  const modalRef = useRef<HTMLVideoElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  const pid = muxPlaybackIdFromRef(playbackId) ?? playbackId;
  const hlsUrl = `https://stream.mux.com/${pid}.m3u8`;

  // Wire hls.js to a video element. Returns cleanup fn.
  async function attachHls(video: HTMLVideoElement, onFail?: () => void) {
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      return;
    }
    try {
      const { default: Hls } = await import("hls.js");
      if (!Hls.isSupported()) { onFail?.(); return; }
      const hls = new Hls({ autoStartLoad: true, startLevel: 0, maxBufferLength: 12 });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) { onFail?.(); hls.destroy(); } });
      // store cleanup on the element so we can call it on unmount
      (video as HTMLVideoElement & { _hlsDestroy?: () => void })._hlsDestroy = () => hls.destroy();
    } catch {
      onFail?.();
    }
  }

  // Background video
  useEffect(() => {
    const video = bgRef.current;
    if (!video) return;
    void attachHls(video, () => setBgFailed(true));
    return () => {
      const v = video as HTMLVideoElement & { _hlsDestroy?: () => void };
      v._hlsDestroy?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlsUrl]);

  // Modal video — attach hls.js when modal opens
  useEffect(() => {
    if (!modalOpen) return;
    const video = modalRef.current;
    if (!video) return;
    void attachHls(video);
    return () => {
      const v = video as HTMLVideoElement & { _hlsDestroy?: () => void };
      v._hlsDestroy?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, hlsUrl]);

  return (
    <>
      {/* Background */}
      <div className="hero-video-bg" aria-hidden="true">
        {!bgFailed ? (
          <video
            ref={bgRef}
            autoPlay
            muted
            loop
            playsInline
            poster={stillUrl ?? undefined}
            onError={() => setBgFailed(true)}
            className="hero-video-el"
          />
        ) : stillUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stillUrl} alt="" className="hero-video-el" />
        ) : null}
        <div className="hero-video-scrim" />
      </div>

      {/* Trailer modal */}
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
              ref={modalRef}
              autoPlay
              controls
              playsInline
              poster={stillUrl ?? undefined}
              className="hero-trailer-video"
            />
          </div>
        </div>
      )}

      {/* Hidden trigger — clicked by HeroTrailerWire via data-hero-trailer-proxy */}
      <button
        type="button"
        className="hero-trailer-trigger"
        data-hero-trailer-trigger=""
        aria-label={`Watch ${title} trailer`}
        onClick={() => setModalOpen(true)}
      />
    </>
  );
}
