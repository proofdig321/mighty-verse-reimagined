/**
 * CORS origin for Mux Direct Upload. Must be the deployed origin in production.
 */
export function muxUploadCorsOrigin(): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (origin) return origin.startsWith("http") ? origin : `https://${origin}`;
  return process.env.NODE_ENV === "production"
    ? "https://mightyverse.goldenshovel.co.za"
    : "http://localhost:3000";
}
