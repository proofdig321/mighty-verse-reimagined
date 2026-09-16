"use client";

/**
 * Optional YouTube session cookies for server-side file fetch.
 * Datacenter IPs are bot-gated; a signed-in youtube.com session is the
 * documented way to obtain the media file. Values are sent only on ingest
 * and are not stored in Gallery.
 */
export function YoutubeCookiesField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <details className="rounded-md border border-border bg-background/40 px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-foreground">
        YouTube session (required when the ingest server is bot-gated)
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        YouTube watch pages are not files Mux can pull. Mighty Verse fetches the
        media file, then Direct Uploads it to Mux. Paste Netscape cookies.txt from
        a signed-in youtube.com session, or set YOUTUBE_COOKIES on the server.
        Cookies are used only for this request.
      </p>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={4}
        spellCheck={false}
        placeholder="# Netscape HTTP Cookie File"
        className="border-input bg-background text-foreground mt-2 w-full rounded-md border px-3 py-2 font-mono text-xs"
        data-youtube-cookies=""
      />
    </details>
  );
}
