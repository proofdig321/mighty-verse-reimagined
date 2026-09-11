"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isUsableMediaSourceUrl } from "@/lib/media/source-url";

export function CurateYoutubeIngest() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function ingest() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/authority/media/ingest-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name: "YouTube ingest" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Mux could not ingest this URL.");
        return;
      }
      setUrl("");
      setMessage("Mux is pulling the video. This does not create a Universe.");
      router.refresh();
    } catch {
      setMessage("Network error while asking Mux to pull this URL.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-2 rounded-lg border border-border bg-card/40 px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        void ingest();
      }}
    >
      <label htmlFor="curate-youtube-url" className="text-sm font-medium text-foreground">
        YouTube URL
      </label>
      <p className="text-xs text-muted-foreground">
        Primary ingest path. Mux pulls the file for playback. Pasting a link does not create a Universe.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="curate-youtube-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          disabled={busy}
          className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
        />
        <Button type="submit" size="sm" disabled={busy || !isUsableMediaSourceUrl(url)}>
          {busy ? "Ingesting…" : "Ingest with Mux"}
        </Button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </form>
  );
}
