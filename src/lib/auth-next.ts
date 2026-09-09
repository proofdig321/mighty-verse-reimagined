/**
 * Preserve the intended workspace surface across sign-in.
 * Only same-origin relative paths are accepted.
 */
export function safeAuthNext(value: string | null | undefined, fallback = "/authority"): string {
  if (!value) return fallback;
  const next = value.trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) return fallback;
  return next;
}
