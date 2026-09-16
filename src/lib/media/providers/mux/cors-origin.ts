/**
 * CORS origin for Mux Direct Upload. Must match the browser origin that PUTs
 * the file. Never use VERCEL_URL — that hostname is not the public custom domain.
 */
import { PRODUCTION_APP_ORIGIN, publicAppOrigin } from "../../../auth-origin";

export function muxUploadCorsOrigin(request?: Request | string | null): string {
  if (request instanceof Request) {
    return publicAppOrigin(request);
  }
  if (typeof request === "string" && request.trim()) {
    try {
      return new URL(request).origin;
    } catch {
      // fall through
    }
  }
  return process.env.NODE_ENV === "production" ? PRODUCTION_APP_ORIGIN : "http://localhost:3000";
}
