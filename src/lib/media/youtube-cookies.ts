/**
 * YouTube session cookies for file fetch. Watch pages are not media files;
 * datacenter IPs are bot-gated unless a signed-in session is presented.
 *
 * Accepts Netscape cookies.txt or a Cookie header string.
 * Never log the values.
 */

const NETSCAPE_HOST = /(?:^|\.)youtube\.com$/i;

export function isNetscapeCookieFile(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^#\s*Netscape HTTP Cookie File/i.test(trimmed)) return true;
  return trimmed.split(/\r?\n/).some((line) => {
    if (!line || line.startsWith("#")) return false;
    const cols = line.split("\t");
    return cols.length >= 7 && cols[0].includes("youtube");
  });
}

export function cookieHeaderFromNetscape(raw: string): string {
  const parts: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t");
    if (cols.length < 7) continue;
    const domain = cols[0].replace(/^\./, "");
    if (!NETSCAPE_HOST.test(domain) && domain !== "youtube.com") continue;
    const name = cols[5]?.trim();
    const value = cols[6]?.trim();
    if (!name || value == null || value === "") continue;
    parts.push(`${name}=${value}`);
  }
  return parts.join("; ");
}

export function cookieHeaderFromInput(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  if (isNetscapeCookieFile(trimmed)) {
    const header = cookieHeaderFromNetscape(trimmed);
    return header || null;
  }
  return trimmed.replace(/\r?\n/g, " ").trim() || null;
}

export function resolveYoutubeCookieInput(requestCookies?: string | null): string | null {
  const fromRequest = cookieHeaderFromInput(requestCookies);
  if (fromRequest) return fromRequest;
  return cookieHeaderFromInput(process.env.YOUTUBE_COOKIES);
}
