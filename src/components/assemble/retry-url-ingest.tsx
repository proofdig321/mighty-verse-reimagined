"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  classifyPollBudget,
  classifyUrlIngestStage,
  PROCESSING_POLL_ATTEMPTS,
  PROCESSING_POLL_MS,
  URL_INGEST_FAILED_COPY,
  URL_INGEST_TIMEOUT_COPY,
  type UrlIngestStage,
} from "@/lib/media/processing-state";
import { UrlIngestProgress } from "./url-ingest-progress";
import { YoutubeCookiesField } from "./youtube-cookies-field";

/**
 * Operator retry of a Mux URL pull from Gallery. Does not invent a Universe
 * and does not keep polling after Mux reports failed.
 */
export function RetryUrlIngest({
  intakeId,
  sourceUrl,
}: {
  intakeId: string;
  sourceUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<UrlIngestStage | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [youtubeCookies, setYoutubeCookies] = useState("");

  useEffect(() => {
    if (!startedAt || stage === "ready" || stage === "failed" || !stage) return;
    const tick = () => setElapsedMs(Date.now() - startedAt);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, stage]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let currentPhase = "processing";

    async function poll() {
      setBusy(true);
      for (let attempt = 0; attempt <= PROCESSING_POLL_ATTEMPTS; attempt++) {
        if (cancelled) return;
        const budget = classifyPollBudget({
          phase: currentPhase,
          attempt,
          maxAttempts: PROCESSING_POLL_ATTEMPTS,
        });
        if (budget === "ingested") {
          setStage("ready");
          setBusy(false);
          setMessage("Playable in Gallery. This did not create a Universe.");
          router.refresh();
          return;
        }
        if (budget === "failed") {
          setStage("failed");
          setBusy(false);
          setMessage(URL_INGEST_FAILED_COPY);
          router.refresh();
          return;
        }
        if (budget === "request_timeout") {
          setMessage(URL_INGEST_TIMEOUT_COPY);
          setBusy(false);
          return;
        }
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, PROCESSING_POLL_MS));
        if (cancelled) return;
        try {
          const response = await fetch(`/api/authority/media/upload-session/${sessionId}`);
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            setMessage(typeof data.error === "string" ? data.error : "Could not read ingest progress.");
            setBusy(false);
            return;
          }
          currentPhase = typeof data.phase === "string" ? data.phase : currentPhase;
          const next = classifyUrlIngestStage({
            phase: data.phase,
            providerStatus: data.provider_status,
            outcome: data.outcome,
          });
          setStage(next);
          if (typeof data.provider_error === "string" && data.provider_error && next === "failed") {
            setMessage(data.provider_error);
          }
          if (next === "ready") {
            setBusy(false);
            setMessage("Playable in Gallery. This did not create a Universe.");
            router.refresh();
            return;
          }
          if (next === "failed") {
            setBusy(false);
            setMessage(URL_INGEST_FAILED_COPY);
            router.refresh();
            return;
          }
        } catch {
          setMessage("Network error while checking Mux ingest progress.");
          setBusy(false);
          return;
        }
      }
      setMessage(URL_INGEST_TIMEOUT_COPY);
      setBusy(false);
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  async function retry() {
    setBusy(true);
    setMessage(null);
    setStage("submitted");
    const started = Date.now();
    setStartedAt(started);
    setElapsedMs(0);
    try {
      const response = await fetch("/api/authority/media/ingest-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: sourceUrl,
          intake_id: intakeId,
          youtube_cookies: youtubeCookies.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStage("failed");
        setMessage(typeof data.error === "string" ? data.error : URL_INGEST_FAILED_COPY);
        setBusy(false);
        router.refresh();
        return;
      }
      if (typeof data.session_id !== "string") {
        setStage("failed");
        setMessage("Mux accepted the URL but did not return an ingest session.");
        setBusy(false);
        return;
      }
      setSessionId(data.session_id);
      setStage("pulling");
    } catch {
      setStage("failed");
      setMessage("Network error while fetching this YouTube file into Mux.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        data-retry-url-ingest=""
        onClick={() => void retry()}
      >
        {busy && stage !== "ready" && stage !== "failed" ? "Retrying…" : "Retry Mux"}
      </Button>
      <YoutubeCookiesField
        id={`youtube-cookies-${intakeId}`}
        value={youtubeCookies}
        onChange={setYoutubeCookies}
        disabled={busy && stage !== "ready" && stage !== "failed"}
      />
      {stage ? <UrlIngestProgress stage={stage} elapsedMs={elapsedMs} sourceUrl={sourceUrl} /> : null}
      {message ? (
        <p className={`text-xs ${stage === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>
      ) : null}
    </div>
  );
}
