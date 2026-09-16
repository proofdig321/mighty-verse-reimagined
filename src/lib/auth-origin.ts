/**
 * Production sign-in origin for Golden Shovel.
 *
 * Magic-link PKCE (`?code=`) must land on `/auth/callback`. If that path is not
 * in Supabase Auth's redirect allow list, GoTrue falls back to Site URL `/`
 * (historically the retired Vercel production alias, which now 404s).
 */
export const PRODUCTION_APP_ORIGIN = "https://mightyverse.goldenshovel.co.za";
export const PRODUCTION_APP_HOST = "mightyverse.goldenshovel.co.za";

function vercelProjectLabel(): string {
  return ["mighty", "verse", "reimagined"].join("-");
}

export const LEGACY_VERCEL_PRODUCTION_HOST = `${vercelProjectLabel()}.vercel.app`;

type HeaderMap = { get(name: string): string | null };

function firstHeader(headers: HeaderMap, name: string): string {
  return (headers.get(name) ?? "").split(",")[0].trim();
}

function hostnameOf(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

export function isAllowedAuthHost(host: string): boolean {
  if (!host) return false;
  const hostname = hostnameOf(host);
  if (hostname === PRODUCTION_APP_HOST) return true;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.endsWith(".vercel.app") && hostname.startsWith(vercelProjectLabel())) {
    return hostname !== LEGACY_VERCEL_PRODUCTION_HOST;
  }
  return false;
}

export function publicAppOriginFromHeaders(headers: HeaderMap): string {
  const host = firstHeader(headers, "x-forwarded-host") || firstHeader(headers, "host");
  const hostname = hostnameOf(host);

  if (hostname === LEGACY_VERCEL_PRODUCTION_HOST) {
    return PRODUCTION_APP_ORIGIN;
  }

  if (isAllowedAuthHost(host)) {
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    const proto =
      firstHeader(headers, "x-forwarded-proto") || (isLocal ? "http" : "https");
    return `${proto}://${host}`;
  }

  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env && /^https?:\/\//i.test(env)) {
    try {
      const url = new URL(env);
      if (url.hostname === LEGACY_VERCEL_PRODUCTION_HOST) return PRODUCTION_APP_ORIGIN;
      return url.origin;
    } catch {
      // fall through
    }
  }

  return PRODUCTION_APP_ORIGIN;
}

export function publicAppOrigin(request: Request): string {
  return publicAppOriginFromHeaders(request.headers);
}

export function shouldInterceptAuthCode(
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  if (!searchParams.get("code")) return false;
  const path = pathname.replace(/\/+$/, "") || "/";
  return path !== "/auth/callback";
}

export function authCallbackPath(searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  return query ? `/auth/callback?${query}` : "/auth/callback";
}

export function authEmailRedirectTo(origin: string, next: string): string {
  return `${origin.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(next)}`;
}
