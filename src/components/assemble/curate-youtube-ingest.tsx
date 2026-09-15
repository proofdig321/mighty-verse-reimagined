"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isUsableMediaSourceUrl } from "@/lib/media/source-url";
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
import type { CuratePendingIngest } from "@/lib/assemble/load-studio";
import Link from "next/link";

const STORAGE_KEY = "mighty-verse:curate-youtube-ingest";

type StoredIngest = {
  sessionId: string;
  url: string;
  startedAt: number;
};

function readStored(): StoredIngest | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as StoredIngest;
    return saved?.sessionId ? saved : null;
  } catch {
    return null;
  }
}

function writeStored(next: StoredIngest | null) {
  try {
    if (!next) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // sessionStorage may be unavailable
  }
}

export function CurateYoutubeIngest({
  initialSessions = [],
}: {
  initialSessions?: CuratePendingIngest[];
}) {
  const router = useRouter();
  const newestPending = initialSessions[0] ?? null;
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(newestPending?.session_id ?? null);
  const [stage, setStage] = useState<UrlIngestStage | null>(
    newestPending ? classifyUrlIngestStage({ phase: newestPending.phase }) : null,
  );
  const [startedAt, setStartedAt] = useState<number | null>(
    newestPending ? Date.parse(newestPending.created_at) : null,
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeUrl, setActiveUrl] = useState<string | null>(newestPending?.source_url ?? null);
  const [youtubeCookies, setYoutubeCookies] = useState("");

  useEffect(() => {
    const stored = readStored();
    if (stored && !sessionId) {
      setSessionId(stored.sessionId);
      setActiveUrl(stored.url);
      setStartedAt(stored.startedAt);
      setStage("pulling");
    }
  }, [sessionId]);

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
          writeStored(null);
          setBusy(false);
          setMessage("Playable in Incoming and Gallery. This did not create a Universe.");
          setUrl("");
          router.refresh();
          return;
        }
        if (budget === "failed") {
          setStage("failed");
          writeStored(null);
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
          if (next === "ready") {
            writeStored(null);
            setBusy(false);
            setMessage("Playable in Incoming and Gallery. This did not create a Universe.");
            setUrl("");
            router.refresh();
            return;
          }
          if (next === "failed") {
            writeStored(null);
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

  async function ingest() {
    setBusy(true);
    setMessage(null);
    setStage("submitted");
    const started = Date.now();
    setStartedAt(started);
    setElapsedMs(0);
    setActiveUrl(url);
    try {
      const response = await fetch("/api/authority/media/ingest-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          name: "YouTube ingest",
          youtube_cookies: youtubeCookies.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      const canonical = typeof data.url === "string" ? data.url : url;
      setActiveUrl(canonical);
      if (typeof canonical === "string") setUrl(canonical);
      if (!response.ok) {
        setStage("failed");
        setMessage(typeof data.error === "string" ? data.error : URL_INGEST_FAILED_COPY);
        setBusy(false);
        router.refresh();
        return;
      }
      if (typeof data.session_id !== "string") {
        setStage("failed");
        setMessage("Mux accepted the URL but did not return an ingest session. Check Gallery for the intake shell.");
        setBusy(false);
        router.refresh();
        return;
      }
      writeStored({ sessionId: data.session_id, url: canonical, startedAt: started });
      setSessionId(data.session_id);
      setStage("pulling");
    } catch {
      setStage("failed");
        setMessage("Network error while fetching this YouTube file into Mux.");
      setBusy(false);
    }
  }

  const showProgress = stage != null;

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-card/40 px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        void ingest();
      }}
    >
      <label htmlFor="curate-youtube-url" className="text-sm font-medium text-foreground">
        YouTube URL
      </label>
      <p className="text-xs text-muted-foreground">
        Primary ingest path. Mighty Verse fetches the YouTube file, then Mux processes it. Pasting a link does not create a Universe.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="curate-youtube-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          disabled={busy && stage !== "failed" && stage !== "ready"}
          className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
        />
        <Button type="submit" size="sm" disabled={busy || !isUsableMediaSourceUrl(url)}>
          {busy && stage !== "ready" && stage !== "failed" ? "Ingesting…" : "Ingest with Mux"}
        </Button>
      </div>
      <YoutubeCookiesField
        id="curate-youtube-cookies"
        value={youtubeCookies}
        onChange={setYoutubeCookies}
        disabled={busy && stage !== "failed" && stage !== "ready"}
      />
      {showProgress ? (
        <UrlIngestProgress stage={stage} elapsedMs={elapsedMs} sourceUrl={activeUrl} />
      ) : null}
      {message ? (
        <p className={`text-xs ${stage === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>
      ) : null}
      {stage === "failed" ? (
        <p className="text-xs">
          <Link href="/authority/media" className="underline underline-offset-2 hover:text-foreground">
            Open Gallery
          </Link>
          {" "}to upload the file, retry Mux, or delete the shell.
        </p>
      ) : null}
    </form>
  );
}
